# Arquitectura — BarberOS

## Stack

| Capa | Elección |
|---|---|
| Framework fullstack | Next.js 15 (App Router) + TypeScript estricto |
| Base de datos | PostgreSQL vía Supabase |
| Auth | Supabase Auth |
| Storage de archivos | Supabase Storage (binarios nunca en Postgres) |
| ORM / migraciones | Drizzle ORM + `drizzle-kit`, migraciones SQL versionadas |
| UI | Tailwind CSS v4 + shadcn/ui |
| Validación | Zod en cada endpoint |
| Tests | Vitest + Testing Library (unit/integration), Playwright (`test:e2e`) |
| Hosting producción | Render |
| DNS / dominio | Cloudflare |
| CI | GitHub Actions (`.github/workflows/ci.yml`) |

## Componentes (carpetas principales)

- `src/app/(app)/*` — páginas autenticadas: `agenda`, `caja`, `clientes`,
  `comisiones`, `control`, `dashboard`, `exportaciones`, `operacion`.
- `src/app/(auth)/*` — login, recuperar/restablecer contraseña.
- `src/app/api/*` — route handlers; es el backend real, cada uno valida
  sesión + rol + organización antes de tocar datos.
- `src/app/api/client/*` — mismo backend, pero para la APP de clientes
  (Android, repo separado): sesión por bearer token
  (`src/lib/auth/get-client-session.ts`), nunca cookies. Ver
  `docs/MOBILE_APP_BRIEF.md` para el contrato completo.
- `src/db/schema/*` — schema Drizzle, fuente de verdad del modelo de
  datos.
- `src/lib/*` — lógica de negocio compartida: `appointments`
  (anti-doble-reserva; `create-appointment.ts`/`cancel-appointment.ts`/
  `availability.ts` son el motor único que usan tanto la web como la APP),
  `finance` (ventas/caja/comisiones), `datetime` (UTC ↔ zona horaria AR),
  `phone` (E.164), `audit`, `exports`, `validation`, `money`, `storage/r2.ts`
  (fotos de cliente, ver más abajo).
- `migrations/` — migraciones SQL versionadas (14 al 2026-07-20); nunca se
  toca el schema fuera de una migración.
- `scripts/` — `seed.ts` (datos demo), `bootstrap-production.ts`
  (organización + admin real, un solo uso), `seed-production-team.ts`
  (equipo placeholder para un Supabase de producción nuevo, un solo uso),
  `migrate-fresh.ts` (migra una base de Supabase completamente nueva en
  dos tandas — ver `docs/DECISIONS.md` para por qué hace falta).

## Flujo de datos

Browser → Next.js route handler (`src/app/api/**`) → `getSession()`
(Supabase Auth) + `requireRole()` → query Drizzle con `organization_id`/
`branch_id` en el `WHERE` → Postgres (Supabase). Los archivos suben desde
el backend a Supabase Storage (bucket privado `barberos-private`); el
browser nunca habla directo con el storage. No hay estado global
client-side más allá de lo que cada página fetchea — no hay Redux/Zustand
ni cache compleja.

**APP de clientes (Android, repo separado):** App → `src/app/api/client/**`
→ `getClientSession()` (bearer token de Supabase Auth, resuelve contra
`clients.auth_user_id`, no contra `users`) → misma base Postgres. Nunca
hay una segunda base ni un endpoint público sin auth: cualquier cambio
hecho desde la app (agendar, cancelar) pasa por el mismo motor de agenda
que usa la web (`src/lib/appointments/*`) y se refleja ahí al instante.
Las fotos de historial de cortes suben del backend a **Cloudflare R2**
(`src/lib/storage/r2.ts`, bucket privado, URLs firmadas de corta
duración) — excepción acotada a esa entidad, ver `AGENTS.md` y
`docs/DECISIONS.md`.

## Servicios externos

- **Supabase** — Postgres, Auth, Storage. El proyecto de desarrollo y el
  de producción son **instancias separadas**. Auth también sirve a la APP
  de clientes (Phone provider vía Twilio, Google OAuth).
- **Cloudflare R2** — storage de fotos de historial de cortes de clientes
  únicamente (`src/lib/storage/r2.ts`); todo lo demás sigue en Supabase
  Storage. Ver `AGENTS.md` y `docs/DECISIONS.md` (2026-07-20).
- **Twilio** — proveedor de SMS para el OTP de teléfono de la APP de
  clientes, configurado del lado del dashboard de Supabase Auth (no hay
  credenciales de Twilio en este repo).
- **Render** — hosting de la app Next.js en producción (`npm run build &&
  npm start`, `output: 'standalone'` en `next.config.ts`).
- **Cloudflare** — DNS del dominio de producción, apuntando a Render.
- **GitHub Actions** — CI en cada push/PR a `main`: install → lint →
  typecheck → test → build, más un job `rls` que levanta un contenedor
  `postgres:16` vanilla para probar las políticas RLS sin depender del
  Supabase CLI (ver `docs/DECISIONS.md`).

No hay integraciones de terceros para pagos ni IA en v1 — están modeladas
(`payments.method`, `domain_events`) pero no conectadas a ningún proveedor
real.

## Dependencias críticas

`drizzle-orm` + `postgres` (todas las queries), `@supabase/supabase-js` +
`@supabase/ssr` (auth + storage), `zod` (validación de cada input de
API), `libphonenumber-js` (normalización E.164), `next`/`react` 19. Ver
`package.json` para versiones exactas.

## Entornos

| Entorno | DB | Dónde corre | Notas |
|---|---|---|---|
| Local (dev) | Supabase — proyecto de desarrollo | `npm run dev` (localhost, puerto 3000 o el siguiente libre) | Credenciales demo en `README.md` |
| CI | Postgres vanilla en contenedor (solo job `rls`); el resto de los jobs no abre conexión real | GitHub Actions | Variables placeholder, no secretos reales |
| Producción | Supabase — proyecto de producción (bootstrapeado 2026-07-16) | Render, dominio propio vía Cloudflare | Ver `docs/CURRENT_STATE.md` para el estado real y `docs/DEPLOYMENT.md` para el paso a paso |

## Reglas de arquitectura no negociables

Dinero en `numeric(12,2)` (nunca float), autorización backend-first + RLS
como backstop, `organization_id` en toda tabla de negocio,
anti-doble-reserva vía exclusion constraint parcial en Postgres
(`btree_gist`) + validación en la app + tests, soft delete en entidades
maestras y sin borrado físico en dinero/auditoría. Detalle completo y por
qué: `AGENTS.md`.

## Referencias operativas más detalladas

Esta guía cubre el panorama general. Para el paso a paso real:
- **Deploy** (Render/Railway/Supabase/Cloudflare, variables de entorno,
  checklist pre/postdeploy): `docs/DEPLOYMENT.md`.
- **Procedimientos de soporte** (reset de contraseña, cierre de caja con
  diferencia, anulación de venta, rollback de deploy): `docs/RUNBOOK.md`.
- **Sistema de diseño / UI**: `docs/UI_STYLE_GUIDE.md`.
