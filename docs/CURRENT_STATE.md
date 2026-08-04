# Estado actual — BarberOS

> **Última actualización:** 2026-08-04 (notificaciones push, Inicio con
> estadísticas/proyecciones, tema Barbershop Dark).
> Documento vivo — actualizar cada vez que cambie el estado real, no
> dejar que quede desactualizado. Antes de confiar en esto para planificar
> trabajo, cruzar con `git log --oneline` y `git status` — la
> documentación queda vieja rápido en este proyecto (ya pasó antes: ver
> `docs/DECISIONS.md` y la memoria de proyecto de sesiones anteriores).

## Qué funciona

- Las 4 fases del PRD completas: fundación/auth/roles, agenda con
  anti-doble-reserva, dinero (ventas/pagos/caja/comisiones), paneles de
  control/dashboard/exportación.
- **Deploy real en producción**, no solo staging: Render + Supabase de
  producción (organización y admin reales, bootstrapeados con
  `scripts/bootstrap-production.ts`) + dominio propio vía Cloudflare,
  desde el 2026-07-16.
- Flujo completo turno → confirmar → iniciar → completar → cobrar →
  cierre de caja → comisión, verificado a mano contra producción real
  (no solo dev).
- CI en verde: lint, typecheck, test (131/131 en la última corrida
  conocida), build, y el job `rls` que prueba las políticas de Postgres.
- **Backend del portal de cliente** (2026-07-20): auth por bearer token
  separada de staff (`src/lib/auth/get-client-session.ts`), endpoints
  `/api/client/*` (registro con teléfono verificado obligatorio, perfil,
  sucursales/barberos/servicios, disponibilidad, agendar/cancelar turno,
  historial de cortes), motor de agenda compartido entre web y APP
  (`src/lib/appointments/{create-appointment,cancel-appointment,availability}.ts`),
  RLS nueva para el self-access del cliente. Ampliación de `clients` (apodo,
  cumpleaños, profesión, `favoriteBranch` calculado) y galería de historial
  de cortes con fotos (Cloudflare R2) visibles desde la ficha de cliente de
  la web y cargables al completar un turno. Contrato completo en
  `docs/MOBILE_APP_BRIEF.md`.
- **Notificaciones push para barberos** (2026-08-04): Web Push API
  (`web-push`, VAPID, `public/sw.js`, campana en `app-header.tsx`) para
  "nuevo turno", "cancelado", "reprogramado" y "turno en 30 minutos"
  (`src/app/api/cron/appointment-reminders`). El cron de recordatorio
  necesita un Render Cron Job dado de alta a mano contra producción —
  todavía no se hizo, ver `docs/DEPLOYMENT.md`.
- **Inicio rediseñado como panel de estadísticas y proyecciones**
  (2026-08-04): tendencia de facturación 30 días, proyección run-rate del
  mes, ocupación de agenda por día de semana, ausentismo, ranking de
  barberos/servicios (`src/lib/dashboard/get-dashboard-stats.ts`). Esto
  pull-eó "Dashboards avanzados" (v1.3) de `docs/ROADMAP.md` a alcance
  activo — ver `docs/DECISIONS.md`.
- **Tema visual Barbershop Dark** (2026-08-04): reemplaza la paleta Soft
  Studio (near-white) por un tema único oscuro cálido, sin modo claro ni
  toggle — ver `docs/UI_STYLE_GUIDE.md` y `docs/DECISIONS.md`.

## Qué funciona parcialmente

- **El equipo en producción es placeholder.**
  `scripts/seed-production-team.ts` cargó una sucursal, un menú de
  servicios genérico, y un barbero/recepcionista ficticios (emails
  `+alias` sobre el email del admin, contraseña temporal) para que la app
  tuviera algo coherente que mostrar apenas se deployó. Sigue así — falta
  cargar desde Operación los datos reales del negocio.
- **Anulación de venta con comisión ya liquidada:** bloqueada por diseño
  (409), sin mecanismo de ajuste/nota de débito todavía. Ver
  `docs/KNOWN_ISSUES.md` y `docs/RUNBOOK.md`.
- **Paginación:** ventas, movimientos de caja y comisiones usan `limit`
  fijo (100–200), no paginación real. No es un problema al volumen
  actual.
- **Observabilidad:** `system_events` existe y se usa en algunas rutas,
  pero no hay instrumentación sistemática de errores no controlados en
  las rutas de dinero, ni un servicio externo (Sentry) conectado.
- **Portal de cliente:** el backend (`/api/client/*`) está implementado y
  probado, pero `organization_settings.client_booking_enabled` arranca en
  `false` — nadie puede agendar desde la APP hasta que se active a mano.
  La APK en sí (`app-BarberOS`) todavía no existe como proyecto — ver
  `docs/MOBILE_APP_BRIEF.md`. Falta también configurar Twilio/Google en el
  dashboard de Supabase Auth (`docs/DEPLOYMENT.md` § App de clientes) antes
  de que el registro funcione contra producción.

## Qué está roto

Nada identificado como roto en producción al momento de esta
actualización. La única vulnerabilidad conocida (`esbuild` anidado en
`drizzle-kit`) es una herramienta de desarrollo, no corre en el build ni
en el runtime de producción — ver `docs/KNOWN_ISSUES.md`.

## Trabajo sin commitear (working tree al 2026-07-20)

Dos archivos usados para hacer el deploy real siguen sin estar en el
repo — verificar con `git status` si esto sigue vigente:
- `scripts/migrate-fresh.ts` — fix de `ssl: true` → `ssl: 'require'`
  (ver `docs/DECISIONS.md`).
- `scripts/seed-production-team.ts` — script nuevo, no trackeado.

## Próximo objetivo operativo

1. Commitear los dos archivos de arriba.
2. Reemplazar el equipo/sucursal/servicios placeholder de producción por
   los datos reales del negocio (desde Operación) y dar de baja las
   cuentas placeholder.
3. Construir la APK en `app-BarberOS` (repo separado) siguiendo
   `docs/MOBILE_APP_BRIEF.md`; configurar Twilio/Google en Supabase Auth;
   activar `client_booking_enabled` recién cuando esté probada.
4. Cargar las variables de entorno de notificaciones push
   (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`,
   `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `CRON_SECRET`) en Render y dar de alta
   el Render Cron Job del recordatorio de 30 min — ver
   `docs/DEPLOYMENT.md` § Notificaciones push. Sin esto, el código ya
   deployado no manda recordatorios (el resto de los eventos push sí
   funcionan, no dependen del cron).
5. Después de eso: encarar la lista priorizada en `docs/BACKLOG.md`.
