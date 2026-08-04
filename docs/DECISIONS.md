# Decisiones — BarberOS

> Registro de decisiones de alcance/arquitectura que no son obvias
> leyendo el código, orden cronológico inverso (más reciente primero). No
> duplica `AGENTS.md`/`docs/PRODUCT.md` (fuente de verdad de alcance del
> producto) — esto es el "por qué" de decisiones puntuales.

## 2026-08-04 — Notificaciones push web para barberos (nuevo alcance activo)

**Decisión:** se agrega un sistema de notificaciones push del navegador
(Web Push API estándar: `web-push`, VAPID, service worker en
`public/sw.js`) para avisar a los barberos de "nuevo turno", "turno
cancelado", "turno reprogramado" y "turno en 30 minutos". No es una
feature del roadmap original, es alcance nuevo.

**Motivo:** pedido explícito del usuario. Sirve directo al trabajo de
"Agendar" (uno de los 4 trabajos de `AGENTS.md`) — un barbero que se
entera al instante de un turno nuevo o cancelado gestiona mejor su día.

**Alternativas rechazadas:** WhatsApp — es justamente lo que
`docs/ROADMAP.md` v1.1 mantiene fuera de alcance ("WhatsApp automático"
prohibido explícitamente en `AGENTS.md`); push web es un canal distinto,
sin ese conflicto. Un sistema de notificaciones in-app con bandeja/
historial persistente — se descartó para no duplicar la agenda como
fuente de verdad de qué pasó con cada turno; el canal real es el push del
navegador, no una inbox nueva.

**Consecuencias:** requiere que cada barbero acepte el permiso de
notificaciones del navegador (opt-in, botón en la campana del header) y,
en iPhone, que instale el sitio como PWA (Safari no entrega push en
Safari normal, ver `docs/DEPLOYMENT.md`). El recordatorio de 30 min
depende de un cron externo (Render Cron Job) que hay que dar de alta a
mano — no corre solo.

**Revisar nuevamente cuando:** si el uso real muestra que los barberos
prefieren WhatsApp a pesar de la fricción de instalar la PWA en iPhone,
reconsiderar si vale la pena adelantar el canal WhatsApp de v1.1.

## 2026-08-04 — Ranking de barberos, ocupación y tendencias salen del roadmap (v1.3) a alcance activo

**Decisión:** se implementa en el panel de Inicio lo que
`docs/ROADMAP.md` v1.3 tenía como "Dashboards avanzados: ranking de
barberos, ocupación de agenda, tendencias" — con una condición: son
**proyecciones estadísticas simples** (promedio, run-rate mensual,
variación % vs mes anterior), calculadas con SQL sobre `sales` y
`appointments` (`src/lib/dashboard/get-dashboard-stats.ts`,
`src/lib/dashboard/projections.ts`). Nada de IA/OpenAI — eso sigue
prohibido en v1 (`v1.4` del roadmap, sin tocar).

**Motivo:** pedido explícito del usuario ("panel de estadísticas y
predicciones" para Inicio) — la nota de `docs/ROADMAP.md` exige
justamente una decisión explícita para sacar algo de ahí, y esto lo es.

**Alternativas rechazadas:** un modelo predictivo real (regresión,
forecasting con librería estadística) — se descartó por alcance: la
regla de los 4 trabajos no pide precisión de forecasting, pide que el
dueño/encargado entienda para dónde va el mes sin abrir una planilla;
un promedio/run-rate ya resuelve eso. Traer `recharts` u otra librería de
gráficos — se descartó a favor de SVG inline hecho a mano (2-3 formas
simples: tendencia y barras), evitando una dependencia nueva para poco.

**Consecuencias:** "clientes recurrentes" y "promociones por fidelidad"
(el resto de v1.3) siguen fuera de alcance, no se tocaron — ver
`docs/ROADMAP.md`. El home ("Inicio") deja de ser solo un panel de
accesos rápidos y pasa a liderar con tendencias/proyección; la agenda del
día y los accesos directos bajaron de posición pero siguen en la página.

**Revisar nuevamente cuando:** si el volumen de datos crece mucho (varias
sucursales, años de historial), evaluar si las queries de agregación
necesitan materialización/caché en vez de calcularse en cada carga de
Inicio.

## 2026-08-04 — Barbershop Dark reemplaza Soft Studio (un solo tema, oscuro)

**Decisión:** se reemplaza por completo la paleta "Soft Studio" (canvas
near-white, primario verde) documentada en `docs/UI_STYLE_GUIDE.md` por
una sola paleta oscura cálida ("Barbershop Dark": canvas espresso,
primario dorado/latón, rojo barber-pole como firma). No queda modo claro
ni toggle — `.dark` se aplica fijo en `<html>` (`src/app/layout.tsx`)
solo para que los ajustes `dark:` de shadcn/ui se apliquen siempre. Se
sacó la dependencia `next-themes` (ya no hace falta, `sonner.tsx` fija
`theme="dark"`).

**Motivo:** pedido explícito del usuario de darle a la app un tono menos
formal/corporativo y más "de barbería" — la dirección Soft Studio (Fase 1,
2026-07-xx) había ido hacia un near-white neutro pensando en un tono
"artisan workshop" claro, que ya no se consideraba representativo del
producto.

**Alternativas rechazadas:** mantener ambos temas con un toggle
claro/oscuro (`next-themes` + `ThemeProvider`) — se descartó porque el
pedido fue explícitamente "definitivamente", una sola dirección, no una
preferencia de usuario; mantener el verde como primario en el nuevo fondo
oscuro — se descartó a favor del dorado/latón ya presente (sin usar) en
el bloque `.dark` anterior, que lee mejor como acento metálico de
barbería.

**Consecuencias:** la sección "Family resemblance with Escuela SaaS" de
`docs/UI_STYLE_GUIDE.md` queda parcialmente desactualizada en lo que
respecta a color (BarberOS verde vs Escuela SaaS azul ya no aplica); las
convenciones estructurales que ahí se listan (headers de tabla, peso de
títulos, badges de estado, popover de rol, radios de controles) siguen
vigentes. Cualquier captura/mockup de UI generado antes de esta fecha
queda desactualizado.

**Revisar nuevamente cuando:** si en algún momento se necesita un modo
claro (ej. para uso en exteriores muy luminosos), habría que reintroducir
`next-themes` y decidir si el modo claro vuelve a ser Soft Studio o una
versión clara de Barbershop Dark.

## 2026-07-27 — DEFAULT_ORGANIZATION_ID explícito para el registro de clientes

**Decisión:** `POST /api/client/register` resuelve la organización con
`process.env.DEFAULT_ORGANIZATION_ID` en vez de `SELECT id FROM
organizations LIMIT 1`.

**Motivo:** la tabla `organizations` tiene 4 filas — la real ("Fusion
Barber", bootstrapeada en producción), una de seed de desarrollo
("Barbería Demo", con 43 sucursales y datos viejos) y dos fixtures
residuales de una corrida local de `rls.test.ts` contra la base real (no
es un problema de CI — el job `rls` de GitHub Actions usa un contenedor
Postgres descartable, aislado; esto vino de otro lado). `LIMIT 1` sin
`ORDER BY` no tiene garantía de qué fila devuelve, y en la práctica
devolvía "Barbería Demo" — el primer cliente real registrado desde la APP
("Emiliano Martinez") quedó ahí en vez de en "Fusion Barber", por eso no
aparecía en la web.

**Alternativas rechazadas:** `ORDER BY created_at LIMIT 1` — seguiría
siendo ambiguo/incorrecto porque "Barbería Demo" es más vieja que "Fusion
Barber", así que el orden por fecha tampoco elegía la correcta. Limpiar
las filas de más y confiar de nuevo en `LIMIT 1` — más frágil a futuro,
cualquier corrida de seed o test mal aislada vuelve a romperlo.

**Consecuencias:** `DEFAULT_ORGANIZATION_ID=697fd668-5fb2-4915-9558-dec327b3e5ee`
en `.env`/`.env.production.local` — Render necesita la misma variable
cargada a mano en su dashboard. El cliente mal registrado se migró a mano
(`UPDATE clients SET organization_id = ...`) a la organización correcta.
Las dos organizaciones de test residuales no se borraron (acción
destructiva bloqueada por el classifier de auto mode) — quedan como
basura inofensiva mientras `DEFAULT_ORGANIZATION_ID` esté seteado.

**Revisar nuevamente cuando:** se encare multi-tenant real (v2) — ahí
`DEFAULT_ORGANIZATION_ID` deja de alcanzar y hace falta resolver la
organización por subdominio/código de invitación como ya anotaba el
comentario original en el código.

## 2026-07-27 — Teléfono confirmado deja de ser obligatorio para registrarse desde la APP

**Decisión:** se saca la exigencia de teléfono confirmado en
`POST /api/client/register` y en la APP (ya no existe el estado
`phone-unverified` ni la pantalla de verificar teléfono) — reemplaza la
decisión "provisoria" de abajo (2026-07-26), ahora es el comportamiento
definitivo, no una flag de testing.

**Motivo:** pedido explícito del usuario. El plan pasa a ser que el
teléfono se cargue/confirme en persona en la barbería (recepción, desde
la web app) cuando el cliente se presente sin haberlo hecho desde la APP,
en vez de depender de verificación por SMS.

**Alternativas rechazadas:** mantener la flag `ALLOW_UNVERIFIED_PHONE_REGISTRATION`/
`EXPO_PUBLIC_ALLOW_UNVERIFIED_PHONE` como testing-only y reactivar la
exigencia más adelante — descartado, el usuario pidió sacarla, no
pausarla. Las variables quedan comentadas en los `.env*` por si se
reconsidera.

**Consecuencias:** un `clients` registrado solo con Google puede no tener
ningún teléfono cargado — `whatsapp_e164`/`whatsapp_raw` quedan `null`
indefinidamente hasta que alguien lo complete a mano (recepción o el
propio cliente desde "Mi perfil", que hoy no expone editar el teléfono
tampoco — pendiente si se quiere permitir). Sin teléfono no hay dedupe
posible contra un walk-in cargado por recepción con ese mismo número —
puede terminar habiendo dos filas de `clients` para la misma persona si
después carga el teléfono real por otro lado.

**Revisar nuevamente cuando:** se compre un número de Twilio — ahí es una
decisión de producto nueva si se vuelve a exigir verificación o se deja
opcional como quedó ahora.

## 2026-07-26 — Bypass provisorio de teléfono confirmado en el registro de clientes

> **Superada por la decisión del 2026-07-27 de arriba** — dejó de ser
> "provisoria", el teléfono ya no es obligatorio de forma permanente.

**Decisión:** `POST /api/client/register` y la APP (`lib/auth-context.tsx`)
permiten saltear la exigencia de teléfono confirmado cuando
`ALLOW_UNVERIFIED_PHONE_REGISTRATION` (backend) /
`EXPO_PUBLIC_ALLOW_UNVERIFIED_PHONE` (app) están en `true`. Apagado por
defecto en ambos — hay que setearlo explícitamente en cada entorno.

**Motivo:** todavía no hay un número de Twilio comprado, así que ni el SMS
OTP ni la verificación de teléfono tras Google funcionan. Pedido explícito
del usuario para poder seguir probando el resto del flujo (agenda, perfil,
historial de cortes) sin quedar bloqueado.

**Alternativas rechazadas:** sacar la exigencia de teléfono directamente
del código — descartado porque es un requisito de producto explícito
("confirmar el teléfono antes de poder registrarse", ver el pedido
original de la APP), no algo que deba desaparecer, solo pausarse.

**Consecuencias:** mientras la flag esté prendida en producción, cualquier
registro por Google sin verificar teléfono crea un `clients` sin
`whatsapp_e164` (columna ya nullable, sin cambio de schema) — sin dedupe
posible contra un walk-in cargado por recepción con ese mismo número. Esto
afecta el backend real (Render), no solo desarrollo — el usuario tiene que
cargar `ALLOW_UNVERIFIED_PHONE_REGISTRATION=true` a mano en el dashboard
de Render para que aplique ahí (este repo no controla esa variable).

**Revisar nuevamente cuando:** se compre un número de Twilio y se pruebe
el flujo de SMS/verificación real — ahí hay que apagar la flag en Render
y en el `.env` de la APP, y idealmente limpiar los `clients` de prueba
creados sin teléfono durante esta ventana.

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
