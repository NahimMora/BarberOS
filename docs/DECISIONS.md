# Decisiones — BarberOS

> Registro de decisiones de alcance/arquitectura que no son obvias
> leyendo el código, orden cronológico inverso (más reciente primero). No
> duplica `AGENTS.md`/`docs/PRODUCT.md` (fuente de verdad de alcance del
> producto) — esto es el "por qué" de decisiones puntuales.

## 2026-07-20 — Portal de cliente (APP + ampliación de clientes) sale del roadmap a alcance activo

**Decisión:** se construye una APK de clientes (registro, agenda,
historial de cortes) y se amplía el modelo de `clients` en la web app
(apodo, cumpleaños, profesión, historial de cortes con fotos), tanto
backend como UI.

**Motivo:** pedido explícito del usuario. Esto era "portal de cliente",
marcado como fuera de v1 en `AGENTS.md` ("portal público") y ubicado en
v2+ de `docs/ROADMAP.md` — sale de ahí por decisión de producto explícita,
no por reinterpretación de alcance.

**Alternativas rechazadas:** ninguna — no había ambigüedad, el pedido fue
directo.

**Consecuencias:** nuevo actor de auth (`clients.auth_user_id`, separado
de `users`/staff), nuevo endpoint namespace `/api/client/*` con su propia
sesión (bearer token, no cookies), lógica de agenda (crear/cancelar/
disponibilidad) extraída a `src/lib/appointments/{create-appointment,cancel-appointment,availability}.ts`
para que la web y la APP compartan exactamente el mismo motor de
anti-doble-reserva y validación — nunca dos implementaciones que puedan
divergir. `docs/ROADMAP.md` y `docs/CURRENT_STATE.md` actualizados para
reflejar que esto ya no es v2+.

**Revisar nuevamente cuando:** se evalúe multi-tenant real (v2) — hoy
`POST /api/client/register` resuelve la organización tomando la única fila
de `organizations` (asume single-org, ver el comentario en ese archivo);
con multi-tenant hace falta resolverla por subdominio o código de
invitación.

## 2026-07-20 — Cloudflare R2 para fotos de cliente (revierte parcialmente la decisión del 2026-07-08)

**Decisión:** las fotos de historial de cortes (`client_visit_photos` →
`files` con `storage_provider = 'r2'`) se suben a Cloudflare R2, no a
Supabase Storage. El resto de `files` (certificados médicos, contratos,
documentos de staff) **sigue en Supabase Storage sin tocarse** —
`AGENTS.md` sigue rigiendo para todo lo que no sea foto de cliente.

**Motivo:** pedido explícito del usuario, con foco en costo de egress a
futuro ("prefiero hacerlo correctamente desde el principio"). Es una
excepción acotada, no una migración completa: se evaluó mantener todo en
Supabase Storage (más simple, un solo proveedor) pero el usuario ya tiene
ambas cuentas disponibles y priorizó R2 para este caso de uso
específicamente foto-pesado.

**Alternativas rechazadas:** Supabase Storage para también las fotos de
cliente (mi recomendación original, más simple/consistente) — descartada
por decisión explícita del usuario, no por un problema técnico con
Supabase Storage.

**Consecuencias:** dos proveedores de storage en paralelo (`files.storage_provider`
enum `'supabase' | 'r2'`), dos SDKs (`@supabase/supabase-js` para uno,
`@aws-sdk/client-s3` para el otro), credenciales nuevas
(`R2_ACCOUNT_ID`/`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`R2_BUCKET_NAME`,
ver `.env.example`), y `src/app/api/files/[id]/download/route.ts` rama
según el proveedor. `AGENTS.md` actualizado para reflejar la excepción
acotada — la regla "Archivos a Supabase Storage" ya no es absoluta, es
"Supabase Storage salvo fotos de cliente/cortes, que van a R2".

**Revisar nuevamente cuando:** se evalúe mover el resto de `files` a R2
también (hoy no hay necesidad — esos documentos son de bajo volumen), o si
el costo real de R2 en producción no justifica mantener dos proveedores.

## 2026-07-20 — Twilio como proveedor SMS para OTP de clientes

**Decisión:** el provider de teléfono de Supabase Auth (para el OTP de
registro/login de la APP de clientes) se configura con Twilio.

**Motivo:** elegido por el usuario entre las opciones soportadas
nativamente por Supabase Auth Phone provider (Twilio, Vonage, MessageBird,
TextLocal) — Twilio tiene la integración más probada y buena cobertura en
Argentina.

**Alternativas rechazadas:** Vonage (igual de soportado, no elegido).

**Consecuencias:** la cuenta de Twilio y sus credenciales (Account SID,
Auth Token, Messaging Service SID) se configuran del lado del dashboard de
Supabase Auth, no en el código de este repo — ver `docs/DEPLOYMENT.md`.
Costo por SMS enviado, a monitorear si el volumen de registros crece.

**Revisar nuevamente cuando:** el volumen de SMS genere un costo
significativo, o Supabase deprecie/cambie su integración con Twilio.

## 2026-07-16 — Deploy real en Render, no Railway

**Decisión:** el deploy de producción se hizo en Render.

**Motivo:** al momento de deployar, la guía de Render en
`docs/DEPLOYMENT.md` ya estaba tan probada como la de Railway; se eligió
Render en el momento del deploy real.

**Alternativas rechazadas:** Railway — era la recomendación original (ver
decisión del 2026-07-08 más abajo), pero no se usó para el deploy real.

**Consecuencias:** `docs/DEPLOYMENT.md` documenta ambas plataformas por
igual, pero solo Render tiene un deploy real corriendo. El riesgo de
cold-start que motivó la recomendación original de Railway (plan free de
Render duerme el servicio) queda pendiente de confirmar contra el plan
real contratado — no verificado en este registro.

**Revisar nuevamente cuando:** se confirme el plan de Render contratado
y si sufre cold starts, o si el volumen/costo justifica migrar a Railway
(los pasos ya están documentados).

## 2026-07-16 — Fix de SSL en `scripts/migrate-fresh.ts`

**Decisión:** cambiar `ssl: true` (full chain verification) por
`ssl: 'require'` (encripta sin validar la cadena de certificados) en la
conexión de `migrate-fresh.ts`.

**Motivo:** `ssl: true` falla con `self-signed certificate in certificate
chain` en redes con un proxy de inspección TLS o antivirus que inyecta su
propio certificado raíz — no es un problema de Supabase. Bloqueaba correr
la migración inicial contra el Supabase de producción nuevo.

**Alternativas rechazadas:** pedir desactivar el proxy/antivirus de la
red (no práctico, depende de la red de cada quien); `ssl: false` (inseguro,
no encripta la conexión).

**Consecuencias:** `migrate-fresh.ts` encripta la conexión sin validar la
cadena completa de certificados — aceptable para un script de bootstrap
de un solo uso, ejecutado manualmente. El resto del proyecto
(`src/lib/db/index.ts`, `drizzle-kit` normal) no fija `ssl` explícitamente
y no le pasa esto. **Este cambio seguía sin commitear al 2026-07-20** —
ver `docs/CURRENT_STATE.md`.

**Revisar nuevamente cuando:** se corra este script desde una red sin
proxy de inspección TLS y se quiera volver a validación completa, o si se
automatiza este script en un pipeline (ahí sí importaría validar la
cadena en vez de solo encriptar).

## 2026-07-13 — `npm run db:migrate:fresh` para bases de datos nuevas

**Decisión:** agregar `scripts/migrate-fresh.ts` como comando separado
para migrar un proyecto de Supabase completamente vacío, en dos tandas.

**Motivo:** `npm run db:migrate` (`drizzle-kit migrate`) aplica todas las
migraciones pendientes en una única transacción. Contra una base vacía,
`migrations/0010_void_enum_value.sql` (`ALTER TYPE cash_movement_type ADD
VALUE 'void'`) + `migrations/0011_sale_void_support.sql` (que usa ese
valor nuevo en un índice parcial y en checks) violan una restricción real
de Postgres: no se puede usar un valor de enum recién agregado dentro de
la misma transacción en la que se agregó.

**Alternativas rechazadas:** reescribir el schema (enum → texto, cambio
más invasivo sobre una tabla de dinero); aplicar las 12 migraciones a
mano con `psql` en cada base nueva (funciona, pero no es reproducible ni
scriptable).

**Consecuencias:** `scripts/migrate-fresh.ts` reutiliza el migrador
interno de Drizzle y lo llama dos veces, partiendo justo antes de la
migración que hace `ADD VALUE` — mismo resultado final que `db:migrate`,
con un commit en el medio. `npm run db:migrate` sigue siendo el comando
correcto para una base ya migrada incrementalmente (el Supabase de
desarrollo); `db:migrate:fresh` es solo para bootstrap de una base nueva
y para el job `rls` de CI. **Este mecanismo terminó siendo necesario de
verdad**: se usó para el deploy real del 2026-07-16.

**Revisar nuevamente cuando:** se agregue una migración futura que
también use un valor de enum recién creado en la misma migración — el
mismo problema puede repetirse y requerir extender el split de
`migrate-fresh.ts`.

## 2026-07-13 — RLS probada en CI con Postgres vanilla, no Supabase CLI

**Decisión:** el job `rls` de CI usa un contenedor `postgres:16` vanilla
+ `scripts/ci/bootstrap-rls-roles.sql` en vez del Supabase CLI local.

**Motivo:** BarberOS maneja el schema 100% con Drizzle y no usa el
Supabase CLI en ningún otro lado; sumar ese toolchain en paralelo (con su
propia forma de migrar) para un solo job de CI era más superficie de la
que ameritaba el problema.

**Alternativas rechazadas:** copiar el enfoque de un proyecto hermano
(Supabase CLI local + pgTAP).

**Consecuencias:** `scripts/ci/bootstrap-rls-roles.sql` recrea a mano lo
mínimo que Supabase provisiona automáticamente (roles
`anon`/`authenticated`/`service_role`, `auth.uid()`/`auth.role()`, una
tabla `storage.buckets` mínima). `src/test/integration/rls.test.ts` corre
solo en CI (gateado por `process.env.CI`, no solo `DIRECT_URL`) para no
insertar datos de prueba en el Supabase real de desarrollo.

**Revisar nuevamente cuando:** se necesite probar una policy RLS que
dependa de una función o extensión de Supabase que este bootstrap manual
no replique.

## 2026-07-13 — Sin Dockerfile

**Decisión:** no agregar un Dockerfile al proyecto.

**Motivo:** `docs/DEPLOYMENT.md` ya documentaba que Railway y Render
auto-detectan Next.js vía su propio buildpack (Railpack / buildpack Node)
sin necesitar contenedor.

**Alternativas rechazadas:** agregar un Dockerfile igual, siguiendo el
patrón de un proyecto hermano.

**Consecuencias:** un Dockerfile hubiera contradicho la decisión de
deploy ya tomada y agregado mantenimiento sin uso real. El deploy depende
de que Railway/Render sigan soportando su auto-detección de Next.js.

**Revisar nuevamente cuando:** se necesite un entorno reproducible fuera
de Railway/Render (ej. self-host en VPS), donde sí haría falta
contenerizar.

## 2026-07-08 — Storage se queda en Supabase Storage, no Cloudflare R2

> **Parcialmente revertida el 2026-07-20**: las fotos de historial de
> cortes de clientes ahora van a R2 (ver esa decisión más arriba). Esta
> entrada sigue vigente para todo lo demás (`files` de staff/documentos).

**Decisión:** no migrar los archivos de `src/app/api/files/route.ts` a
Cloudflare R2.

**Motivo:** `AGENTS.md` marca "archivos a Supabase Storage" como regla
técnica innegociable, y la implementación actual ya sube a un bucket
privado de Supabase Storage end-to-end.

**Alternativas rechazadas:** Cloudflare R2 — evaluado por costo de
egress y por poder servir archivos públicos vía CDN a futuro.

**Consecuencias:** migrar a R2 sería una reescritura de esa ruta (SDK S3
nuevo, credenciales nuevas, migrar archivos ya subidos), no agregar
variables de entorno. Lo que haría falta si se decide migrar más
adelante queda documentado en `docs/DEPLOYMENT.md` § "Cloudflare R2
(opcional, no implementado)".

**Revisar nuevamente cuando:** el costo de egress de Supabase Storage se
vuelva significativo, o se necesite servir `client_photo`/
`public_profile` públicamente desde un CDN.

## 2026-07-08 — Railway recomendado sobre Render (recomendación original)

**Decisión:** recomendar Railway como plataforma de deploy en
`docs/DEPLOYMENT.md`.

**Motivo:** el plan free de Render duerme el servicio tras inactividad —
un cold start de varios segundos en el momento de cobrar en caja es mal
timing para un negocio que cobra en el momento. Railway no duerme
servicios activos en planes pagos.

**Alternativas rechazadas:** Render como recomendación principal (quedó
documentado igual de completo, como alternativa).

**Consecuencias:** esta fue la recomendación **al momento de escribir la
guía**, pero el deploy real del 2026-07-16 terminó siendo en Render (ver
esa decisión arriba) — la recomendación no se siguió al momento de
deployar.

**Revisar nuevamente cuando:** se confirme si el plan de Render
contratado sufre cold starts en producción; si es así, esta
recomendación original vuelve a ser relevante.

## Sin fecha registrada — RLS es backstop, no defensa primaria

**Decisión:** la autorización real vive en el backend (`getSession()` +
`requireRole()` + `organization_id` en cada query); RLS en Postgres es
una segunda capa, no la defensa primaria.

**Motivo:** Drizzle se conecta a Postgres como el rol `postgres`, que
bypassa RLS — las políticas no reemplazan la autorización de la
aplicación.

**Alternativas rechazadas:** depender solo de RLS y conectar con un rol
más restringido desde el backend (más costoso de implementar bien para
el mismo resultado en v1).

**Consecuencias:** RLS sirve como backstop para el día en que algo se
conecte con un rol más restringido (ej. un cliente directo a Supabase).
Hoy no reemplaza nada de la autorización real de cada endpoint.

**Revisar nuevamente cuando:** se agregue algún acceso que no pase por el
backend de Next.js (ej. Supabase client directo desde otro servicio).

## Resueltas en el PRD original (v3.0, ya no abiertas)

- **La comisión se calcula sobre el total neto pagado después de
  descuentos**, no sobre el subtotal. Ver la regla completa en
  `AGENTS.md`.
- **El walk-in entra al MVP en versión simple** (venta rápida +
  opcionalmente turno inmediato, sin flujo avanzado).
- **Venta con comisión ya liquidada no se puede anular** (bloqueo duro
  v1): si `commissions.status = 'paid'` para la venta, la anulación se
  rechaza con 409. Solo una comisión `pending` puede pasar a `cancelled`
  junto con la venta. Falta diseñar el mecanismo de ajuste/nota de débito
  para cuando sí haga falta corregir una comisión ya liquidada —
  pendiente en `docs/BACKLOG.md`, no implementado.
