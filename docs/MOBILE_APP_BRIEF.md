# Brief técnico — APP de clientes BarberOS (Android)

> Este documento es el contrato completo para construir la app nativa de
> clientes en un repo separado (`app-BarberOS`, no mezclar con la web app).
> Toda la lógica de negocio (anti-doble-reserva, horarios, comisiones) vive
> en el backend de `barberos.moraapps.com` — esta app es un cliente HTTP
> puro contra esa API. No reimplementar reglas de negocio en el cliente.

## Qué es esta app

App Android para que los **clientes finales** de una barbería (no el
staff) se registren, vean su perfil, agenden turnos y consulten su
historial de cortes con fotos. Todo pasa por la API REST de la web app,
que ya implementa anti-doble-reserva, validación de horarios, y guarda
todo en la misma base Postgres que usa la web — un turno creado desde la
app aparece inmediatamente en la agenda de recepción.

## Stack

- **Expo (React Native) + TypeScript**, Android-only por ahora (Expo
  permite agregar iOS después sin rehacer nada).
- **expo-router** para navegación.
- **@supabase/supabase-js** para auth (OTP por SMS, Google OAuth) —
  hablando directo con el proyecto de Supabase de la web app, mismo
  `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **expo-secure-store** para persistir la sesión de Supabase (nunca
  AsyncStorage plano para tokens).
- **expo-auth-session** + `@react-native-google-signin/google-signin`
  (o el flujo nativo de Supabase con Google) para el login social.
- Cliente HTTP simple (fetch) contra la API de Next.js — no hace falta
  Apollo/React Query obligatoriamente, pero React Query es una buena
  opción para cachear/revalidar (agenda, disponibilidad).

## Variables de entorno de la app

```
EXPO_PUBLIC_SUPABASE_URL=<mismo NEXT_PUBLIC_SUPABASE_URL de la web app>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<mismo NEXT_PUBLIC_SUPABASE_ANON_KEY de la web app>
EXPO_PUBLIC_API_BASE_URL=https://barberos.moraapps.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=<client id de Google Cloud Console para Android>
```

## Auth — flujo completo

**Importante: el teléfono queda siempre verificado antes de poder
"registrarse" de verdad, sin importar el método de entrada.** El backend
(`POST /api/client/register`) rechaza con `403 PHONE_NOT_VERIFIED` si el
usuario de Supabase Auth no tiene `phone_confirmed_at` seteado.

### Camino A — SMS (OTP)

1. Usuario ingresa su teléfono (+54 9 11 ...).
2. App llama `supabase.auth.signInWithOtp({ phone })`. Supabase Auth
   envía el SMS vía Twilio (ya configurado del lado de Supabase, la app
   no toca credenciales de Twilio).
3. Usuario ingresa el código → `supabase.auth.verifyOtp({ phone, token, type: 'sms' })`.
   Esto crea la sesión de Supabase con `phone_confirmed_at` ya seteado.
4. App pide nombre/apellido → `POST /api/client/register`.

### Camino B — Google

1. App hace login con Google (`expo-auth-session` o el SDK nativo),
   obtiene el id_token de Google.
2. `supabase.auth.signInWithIdToken({ provider: 'google', token })` — crea
   la sesión de Supabase, pero **sin teléfono verificado todavía**.
3. App pide el teléfono → `supabase.auth.updateUser({ phone })` →
   Supabase manda el SMS de verificación → `supabase.auth.verifyOtp({ phone, token, type: 'phone_change' })`.
4. Recién ahí `POST /api/client/register` (mismo endpoint que el camino A).

### Sesión / requests autenticados

Todas las llamadas a `/api/client/*` (excepto obviamente el login en sí,
que es contra Supabase Auth directo) llevan:

```
Authorization: Bearer <supabase access_token>
```

Refrescar el token con `supabase.auth.onAuthStateChange` /
`supabase.auth.getSession()` antes de cada llamada si expiró — el SDK de
Supabase ya maneja el refresh automático si se configuró con
`autoRefreshToken: true` (default).

## Contrato de la API (`/api/client/*`)

Todos los endpoints requieren el header `Authorization: Bearer <jwt>` y
devuelven `401 {"error":"Unauthorized"}` si falta o es inválido/expiró.

### `POST /api/client/register`

Idempotente: si el cliente ya está vinculado, devuelve su perfil sin
crear nada nuevo.

```json
// Request
{ "firstName": "Juan", "lastName": "Pérez" }

// 201 Response (o 200 si ya estaba registrado)
{
  "id": "uuid",
  "organizationId": "uuid",
  "authUserId": "uuid",
  "firstName": "Juan",
  "lastName": "Pérez",
  "whatsappE164": "+5491155556666"
}
```

Errores: `403 {"error":"PHONE_NOT_VERIFIED"}` (verificar teléfono antes de
reintentar), `409` (carrera rara, reintentar), `400` (body inválido).

### `GET /api/client/profile`

```json
{
  "id": "uuid",
  "firstName": "Juan",
  "lastName": "Pérez",
  "nickname": "Juancho",
  "birthdayDay": 15,
  "birthdayMonth": 8,
  "profession": "Contador",
  "whatsappE164": "+5491155556666"
}
```

### `PATCH /api/client/profile`

Body: cualquier subconjunto de `firstName`, `lastName`, `nickname`,
`birthdayDay` (1-31 o `null`), `birthdayMonth` (1-12 o `null`),
`profession`. Nunca se puede tocar `notes`/`tags` — son internos del
staff. Devuelve el mismo shape que el GET.

### `GET /api/client/branches`

```json
[{ "id": "uuid", "name": "Sucursal Centro", "address": "...", "timezone": "America/Argentina/Buenos_Aires", "workingHours": {...} }]
```

### `GET /api/client/barbers?branch_id=<uuid>`

```json
[{ "id": "uuid", "fullName": "Carlos Gómez" }]
```

### `GET /api/client/services`

```json
[{ "id": "uuid", "name": "Corte clásico", "durationMinutes": 30, "price": "3500.00" }]
```

### `GET /api/client/availability?branch_id=&barber_id=&date=YYYY-MM-DD&duration_minutes=30`

```json
{ "slots": [{ "startAt": "2026-08-01T13:00:00.000Z", "endAt": "2026-08-01T13:30:00.000Z" }] }
// o, si el barbero no trabaja ese día:
{ "slots": [], "reason": "El barbero no trabaja ese día" }
```

`duration_minutes` = suma de `durationMinutes` de los servicios elegidos
(calcularlo en el cliente antes de pedir disponibilidad).

### `GET /api/client/appointments`

Solo los propios, orden cronológico.

```json
[{
  "id": "uuid",
  "branchId": "uuid",
  "branchName": "Sucursal Centro",
  "barberId": "uuid",
  "status": "scheduled",
  "startAt": "2026-08-01T13:00:00.000Z",
  "endAt": "2026-08-01T13:30:00.000Z",
  "notes": null,
  "services": [{ "name": "Corte clásico", "price": "3500.00" }]
}]
```

`status` es uno de: `scheduled`, `confirmed`, `in_progress`, `completed`,
`cancelled`, `no_show`. Solo se puede cancelar desde la app cuando está en
`scheduled` o `confirmed` (ver abajo).

### `POST /api/client/appointments`

```json
// Request
{
  "branchId": "uuid",
  "barberId": "uuid",
  "startAt": "2026-08-01T13:00:00.000Z",
  "serviceIds": ["uuid", "uuid"],
  "notes": "opcional"
}
// 201 Response: el turno creado (mismo shape que la lista, sin services expandido)
```

Errores a mapear a mensajes de usuario:
- `409 {"error":"El barbero ya tiene un turno en ese horario"}` → alguien
  tomó el horario justo antes, refrescar disponibilidad y pedir elegir
  otro slot.
- `409` con mensaje de `AvailabilityError` (ej. "El barbero no trabaja ese
  horario", "El turno está fuera del horario de la sucursal") → mismo
  tratamiento, refrescar disponibilidad.
- `403 {"error":"El auto-agendado no está habilitado"}` → la barbería
  todavía no activó el auto-agendado (`organization_settings.client_booking_enabled`),
  mostrar un estado "todavía no disponible", no un error genérico.
- `400` → datos inválidos, mostrar el mensaje tal cual (ya viene en
  español, listo para usuario).

### `PATCH /api/client/appointments/{id}`

Solo cancela — no confirma, no reprograma, no completa (eso es staff-only
desde la web).

```json
// Request
{ "cancelReason": "No voy a poder ir" }
// 200 Response: el turno actualizado (status: "cancelled")
```

Errores:
- `404` → no es tuyo o no existe (no distinguir en la UI, mismo mensaje).
- `422 {"error":"Invalid transition: completed → cancelled"}` → el turno
  ya no se puede cancelar (ya pasó/se completó), mostrar "Este turno ya no
  se puede cancelar".
- `400 {"error":"Se requiere motivo de cancelación"}` → el campo
  `cancelReason` es obligatorio, no dejar mandar vacío desde la UI.

### `GET /api/client/cut-history`

```json
[{
  "id": "uuid",
  "caption": "Fade + barba",
  "createdAt": "2026-07-10T15:00:00.000Z",
  "appointmentId": "uuid",
  "branchName": "Sucursal Centro",
  "imageUrl": "https://<account>.r2.cloudflarestorage.com/...(firmada, expira en minutos)"
}]
```

`imageUrl` es una URL firmada de corta duración (5 min) — no cachear la
URL en sí, solo la imagen ya descargada (usar `expo-image` con su cache
propio, no guardar la URL para más tarde).

## Pantallas

1. **Login/Registro** — elegir SMS o Google, según el camino de arriba.
2. **Verificar teléfono** — solo aparece en el camino Google, o si por
   algún motivo `register` devuelve `PHONE_NOT_VERIFIED`.
3. **Completar perfil** — nombre/apellido (lo mínimo que pide
   `POST /api/client/register`); apodo/cumpleaños/profesión son opcionales,
   se pueden cargar después desde "Mi perfil".
4. **Agendar turno** — sucursal → barbero → servicio(s) → horario
   disponible (usa `branches`, `barbers`, `services`, `availability` en
   ese orden, cada paso depende del anterior) → confirmar
   (`POST /api/client/appointments`).
5. **Mis turnos** — lista de `GET /api/client/appointments`, con acción
   "Cancelar" en los que estén en `scheduled`/`confirmed` (pedir motivo,
   confirmar, `PATCH .../{id}`).
6. **Mi perfil** — `GET/PATCH /api/client/profile`.
7. **Historial de cortes** — grilla de `GET /api/client/cut-history`,
   cada foto con sucursal y fecha.

## Qué NO hace esta app (a propósito)

- No confirma/inicia/completa turnos (eso lo hace el staff desde la web).
- No cobra ni muestra precios de venta reales — solo el precio de lista
  del servicio al elegir.
- No sube fotos de corte — eso lo carga el staff desde la web al
  completar el turno (`POST /api/clients/{id}/photos`, staff-only).
- No maneja multi-sucursal como "organización" — hoy hay una sola
  organización real (v1), la app no necesita selector de organización.
