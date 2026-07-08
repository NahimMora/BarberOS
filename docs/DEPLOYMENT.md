# Deployment — BarberOS

> Guía de despliegue a pre-producción/producción. Cubre Railway y Render
> (los dos targets pedidos), Supabase (DB/Auth/Storage), Cloudflare DNS, y
> por qué Cloudflare R2 quedó documentado pero **no implementado**. Basado
> en documentación oficial citada en cada sección — no en supuestos.
>
> **No hacer un deploy real sin confirmación explícita del usuario.**

## Resumen de decisiones

- **App:** Railway o Render, ambos preparados. **Recomendación: Railway**
  (ver comparación al final).
- **DB / Auth:** Supabase, sin cambios — ya es la decisión de `AGENTS.md`.
- **Archivos:** se queda en **Supabase Storage**, no Cloudflare R2. `AGENTS.md`
  marca "Archivos a Supabase Storage" como regla técnica innegociable, y la
  implementación actual (`src/app/api/files/route.ts`) ya sube a un bucket
  privado de Supabase Storage end-to-end. Migrar a R2 es una reescritura de
  esa ruta (SDK S3 nuevo, credenciales nuevas, y migrar los archivos ya
  subidos), no "agregar variables de entorno" — así que no se hizo sin
  aprobación explícita. Ver [Cloudflare R2 (opcional, no implementado)](#cloudflare-r2-opcional-no-implementado)
  para lo que haría falta si se decide migrar más adelante.
- **Dominio/DNS:** Cloudflare, apuntando a Railway o Render.

## Antes de desplegar

1. `npx tsc --noEmit`, `npm run lint`, `npm run test`, `npm run build` en
   verde (ver `docs/PRODUCTION_READINESS.md` para el último snapshot).
2. Las 5 variables de `.env.example` cargadas en la plataforma (ver
   [Variables de entorno](#variables-de-entorno)).
3. Migraciones aplicadas contra la base de producción: `npm run db:migrate`
   (usa `DIRECT_URL`, requiere permisos de DDL).
4. En Supabase → Authentication → URL Configuration, agregar el dominio de
   producción a **Redirect URLs** (lo necesita el flujo de "olvidé mi
   contraseña", que arma la URL de retorno con `window.location.origin` —
   ver `src/app/(auth)/recuperar-contrasena/page.tsx`). Sin esto, Supabase
   rechaza el redirect y el link del mail no vuelve a la app.
5. Bucket de Supabase Storage `barberos-private` creado (privado, no
   público) — ver [Supabase Storage](#supabase-storage).

## Variables de entorno

Fuente de verdad: `.env.example`. Resumen:

| Variable | Uso | Dónde conseguirla |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Cliente Supabase (browser + server) | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente Supabase (browser + server) | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo server: `createSupabaseAdminClient` (alta/baja de usuarios, Storage admin). **Nunca `NEXT_PUBLIC_*`** | Supabase → Project Settings → API (secret) |
| `DATABASE_URL` | Runtime de la app (Drizzle, todas las queries) | Supabase → Database → Connection Pooling → **Session mode**, puerto 5432 |
| `DIRECT_URL` | `drizzle-kit migrate`/`generate` (DDL) | Igual que `DATABASE_URL` en Railway/Render — ver nota de IPv4 abajo |

**Por qué Session Pooler y no Transaction Pooler ni Direct:** Railway y
Render corren un proceso Node persistente, no funciones serverless — el
motivo típico para usar el Transaction Pooler (reciclar conexiones
efímeras) no aplica igual acá. Lo que sí aplica: la conexión **Direct** de
Supabase es IPv6 por defecto, y no todas las plataformas garantizan
egress IPv6 sin configuración extra. El **Session Pooler** es compatible
con IPv4 en todos los planes de Supabase, soporta prepared statements
igual que una conexión directa, y no cierra conexiones inactivas a los 5
minutos como el Transaction pooler. Fuente oficial:
[Supabase — IPv4 and IPv6 compatibility](https://supabase.com/docs/guides/troubleshooting/supabase--your-network-ipv4-and-ipv6-compatibility-cHe3BP),
[Supabase — Connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres).

Si confirmás que tu plataforma tiene egress IPv6 (o pagás el IPv4 add-on de
Supabase), podés usar la conexión Direct para `DIRECT_URL` sin problema.

**No commitear secretos.** `.env`, `.env.local` ya están fuera del repo
(ver `.gitignore`). Cargar las variables en el dashboard de Railway/Render,
nunca en el código.

## Supabase

### Base de datos

Ya cubierto arriba (pooler). Migraciones: `npm run db:migrate` corre
`drizzle-kit migrate` contra `DIRECT_URL` — hacerlo antes de que la nueva
versión de la app reciba tráfico, no después (evita que código nuevo
consulte columnas que todavía no existen).

### Autorización (RLS)

`AGENTS.md` establece autorización backend-first: cada endpoint valida
`rol + organization_id + branch_id` en código antes de responder — eso ya
está implementado en todas las rutas (`getSession()` + `requireRole()` +
filtros por `organizationId` en cada query). RLS en Postgres es un
backstop, no la única defensa: Drizzle se conecta como el rol `postgres`
(bypassa RLS), así que las políticas RLS no reemplazan la autorización de
la app — son una segunda capa por si algún día se conecta con un rol más
restringido (ej. desde el cliente directamente). No hay trabajo pendiente
acá para el MVP: la autorización real ya vive en el código de cada ruta.

### Supabase Storage

El bucket `barberos-private` (ver `src/app/api/files/route.ts`) debe
existir en el proyecto de producción **como bucket privado** (no público) —
créalo desde Supabase → Storage → New bucket, sin marcar "Public bucket".
Los documentos de barberos (`barber_document`, `medical_certificate`,
`contract`) siempre se suben como `admin_only` — la app ya lo valida en el
backend (`POST /api/files`), pero el bucket también debe ser privado para
que una URL filtrada no sirva de nada sin pasar por
`GET /api/files/[id]/download` (que sí valida sesión y rol).

## Railway

Fuentes oficiales:
[Deploy a Full-Stack Next.js App](https://docs.railway.com/guides/fullstack-nextjs),
[Quick Start](https://docs.railway.com/quick-start),
[Public Networking / Custom Domains](https://docs.railway.com/guides/public-networking).

1. **Crear proyecto** → "Deploy from GitHub repo" → seleccionar este repo.
2. **Build/start:** Railway detecta Next.js automáticamente vía Railpack y
   corre `npm run build && npm start` sin configuración manual. Ya se
   agregó `output: 'standalone'` a `next.config.ts` (build self-contenido,
   recomendado explícitamente por la guía de Railway para Next.js
   full-stack).
3. **Node version:** se fijó `engines.node: >=20.9.0` en `package.json`;
   Railway lo respeta si Railpack detecta el campo. No hace falta un
   `.nvmrc` adicional.
4. **Variables de entorno:** Project → Variables → cargar las 5 de la
   tabla de arriba. Railway también permite variables de referencia
   (`${{Postgres.DATABASE_URL}}`) si en algún momento se agrega una base
   propia en Railway — no aplica acá porque la DB es Supabase externa.
5. **Healthcheck:** Railway usa el healthcheck para no cortar tráfico
   durante un deploy. Configurar el path a `/api/health` (Settings →
   Healthcheck Path) — la ruta ya existe (`src/app/api/health/route.ts`),
   no requiere auth ni toca la base.
6. **Dominio:** Settings → Networking → Custom Domain. Railway entrega un
   `CNAME` y un `TXT` para verificar — se agregan en Cloudflare DNS (ver
   sección de Cloudflare abajo).

## Render

Fuentes oficiales:
[Deploy a Next.js App](https://render.com/docs/deploy-nextjs-app),
[Custom Domains](https://render.com/docs/custom-domains).

1. **Crear Web Service** → conectar el repo → Environment: **Node**.
2. **Build command:** `npm install && npm run build`.
3. **Start command:** `npm start` (Render inyecta `$PORT` automáticamente;
   `next start` ya lo respeta, no hace falta pasar `-p`).
4. **Node version:** Render lee `engines.node` de `package.json` (ya
   fijado en `>=20.9.0`); si hace falta forzar una versión exacta, se
   puede agregar la variable de entorno `NODE_VERSION`.
5. **Variables de entorno:** Environment → Environment Variables, cargar
   las 5 de la tabla de arriba.
6. **Health check path:** `/api/health` en la config del servicio (o
   `healthCheckPath: /api/health` si se usa `render.yaml`). Zero-downtime
   deploy: Render no corta tráfico de la instancia vieja hasta que la
   nueva pasa el healthcheck.
7. **Dominio:** Settings → Custom Domains → agregar el dominio, Render
   pide un registro DNS (CNAME al subdominio `onrender.com` del servicio).
   **Nota Cloudflare:** si el dominio raíz está proxy­ado (nube naranja),
   Render documenta desactivar el proxy (nube gris) para el dominio raíz
   durante la validación, para evitar que el tráfico se enrute mal.

## Railway vs Render — recomendación

Ambos quedan preparados de forma equivalente (mismo build/start, mismo
healthcheck, mismas env vars). Diferencia práctica para este proyecto:

- **Railway**: build/despliegue con cero configuración (Railpack detecta
  todo), variables de referencia si algún día se agrega infra propia en la
  misma plataforma. Dominio requiere `CNAME`+`TXT`.
- **Render**: healthcheck y custom domains muy documentados, plan free
  duerme el servicio tras inactividad (no ideal para un negocio que cobra
  en el momento — un cold start de varios segundos en la caja es un mal
  momento para que tarde). Un plan pago evita esto.

**Recomendación: Railway** para este caso — el negocio necesita que Agenda
y Caja respondan sin cold starts desde el primer request del día, y
Railway no duerme servicios activos por defecto en los planes de pago
estándar. Si el presupuesto es cero durante el piloto, Render free sirve
para validar el flujo completo sabiendo que el primer request del día
puede tardar.

## Cloudflare DNS

Fuente oficial: [Cloudflare DNS — Full setup](https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/),
[Custom Domains — Cloudflare Workers docs](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).

1. Agregar el dominio a Cloudflare como **Full setup** (cambiar los
   nameservers del dominio a los de Cloudflare) — es el caso normal cuando
   Cloudflare es el DNS autoritativo, no el "CNAME setup (partial)" que
   Cloudflare reserva para planes Business/Enterprise que mantienen otro
   DNS primario.
2. Crear el registro que pida Railway o Render (`CNAME` apuntando al host
   que te dan — `<algo>.up.railway.app` o `<servicio>.onrender.com` — o
   los `CNAME`/`TXT` de verificación que pida cada uno).
3. **Proxy (nube naranja) sí o no:** Render documenta explícitamente
   desactivar el proxy (nube gris, "DNS only") para el dominio raíz
   durante la emisión del certificado. Si algo no valida o el sitio no
   carga después de apuntar el DNS, probar primero con el registro en
   modo "DNS only" — Railway/Render ya sirven HTTPS con su propio
   certificado; el proxy de Cloudflare es una capa extra (CDN/WAF) que se
   puede activar después de confirmar que el certificado de origen quedó
   emitido.
4. Confirmar HTTPS: ambas plataformas emiten certificado automático una
   vez que el DNS resuelve correctamente — no hace falta subir un
   certificado propio.

## Cloudflare R2 (opcional, no implementado)

**No se migró el storage de archivos a R2** — ver la decisión al principio
de este documento. Si en el futuro se decide migrar (por costo de egress,
o para servir `client_photo`/`public_profile` públicamente desde un CDN en
vez de por bucket privado de Supabase), esto es lo que haría falta,
según la documentación oficial de Cloudflare R2:

- **Endpoint S3-compatible:** `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
  ([S3 API compatibility](https://developers.cloudflare.com/r2/api/s3/api/)).
- **Región:** `auto` (R2 no tiene regiones múltiples vía S3 API; `us-east-1`
  también resuelve a `auto` para SDKs que no aceptan región vacía).
- **Credenciales:** un API Token de R2 (access key id + secret access key),
  separado de las API keys generales de Cloudflare.
- **Variables de entorno que haría falta agregar** (no están en
  `.env.example` hoy porque nada las lee): `R2_ACCOUNT_ID`,
  `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, y
  opcionalmente `R2_PUBLIC_DOMAIN` si se configura un dominio custom para
  servir objetos públicos directamente.
- **CORS:** si algún día se sube desde el browser directo a R2 (URLs
  prefirmadas) en vez de por el backend como hoy, hay que configurar una
  política CORS en el bucket (`AllowedOrigins`, `AllowedMethods`,
  `AllowedHeaders`) — ver [Configure CORS](https://developers.cloudflare.com/r2/buckets/cors/).
  Con el patrón actual (el backend sube el archivo, el browser nunca habla
  directo con el storage) esto no hace falta.
- **Dominio público:** para servir objetos públicos con URL propia
  (`archivos.tudominio.com`) en vez de la URL default de R2, se conecta un
  dominio custom desde el bucket — recomendado para producción si se migra,
  ya que la URL default de R2 no está pensada para tráfico público
  sostenido.
- **Compatibilidad:** R2 no soporta ACLs, bucket policies, versionado,
  object lock ni server-side encryption gestionada — si la lógica de
  migración asume alguna de esas features de S3, hay que revisarla.

## CI

`.github/workflows/ci.yml` corre en cada push a `main` y en cada PR:
install → lint → typecheck → test → build. Usa variables de entorno
placeholder (no secretos reales) porque ninguno de esos pasos abre una
conexión real — los tests de integración contra Postgres real
(`src/test/integration/*.test.ts`) se saltean solos si `DIRECT_URL` no
apunta a una base real, por diseño (`describe.skip` condicional). Si más
adelante se quiere que CI también corra esos tests de integración, hay que
cargar `DIRECT_URL` como secret de un proyecto Supabase de staging — no
hecho todavía porque requiere aprovisionar esa base y no es parte de este
pedido.

## Observabilidad mínima

`system_events` ya existe en el modelo (`recordSystemEvent`, usado en
rutas críticas como exports y control-events) y `docs/PRODUCTION_READINESS.md`
señala que falta instrumentación sistemática de errores no controlados en
las rutas de dinero (`/api/sales`, `/api/cash-*`, `/api/commissions`). No
se agregó un servicio externo (Sentry u otro) en este ciclo — requiere
credenciales/decisión de cuenta que no estaba confirmada; queda como
recomendación explícita para antes de producción real, no bloqueante para
pre-producción.

## Checklist predeploy / postdeploy

**Predeploy**
- [ ] `tsc`/`lint`/`test`/`build` en verde
- [ ] Variables de entorno cargadas en la plataforma
- [ ] Migraciones aplicadas contra la DB de producción
- [ ] Bucket `barberos-private` creado y privado en el proyecto de Supabase de producción
- [ ] Dominio de producción agregado a Supabase Auth → Redirect URLs

**Postdeploy**
- [ ] `/api/health` responde 200
- [ ] Login con credenciales reales funciona
- [ ] Flujo "olvidé mi contraseña" llega el mail y el link vuelve a la app
- [ ] Un ciclo completo turno → cobro → cierre de caja → comisión en datos reales (no demo)
- [ ] Exportación de un reporte descarga bien (no JSON crudo)
- [ ] HTTPS activo en el dominio custom
