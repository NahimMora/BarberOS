# AGENTS.md — Plataforma de Gestión de Barbería (MVP v1)

> Archivo canónico de instrucciones para agentes (Codex, Claude Code y cualquier otro).
> **Fuente de verdad del producto y el negocio:** `docs/PRODUCT.md` (qué
> problema resuelve, para quién, qué no resuelve), `docs/USERS.md` (roles
> y permisos), `docs/ARCHITECTURE.md` (stack y componentes),
> `docs/ROADMAP.md` (qué queda fuera de v1 y cuándo podría entrar). Ante
> cualquier duda de alcance o reglas, esos documentos mandan.
> **Estado real del proyecto ahora mismo:** `docs/CURRENT_STATE.md`
> (documento vivo — el MVP ya está completo y deployado en producción,
> esto ya no es un proyecto en Fase 0).

---

## Qué es este proyecto

Webapp de gestión para una barbería con múltiples sucursales. MVP enfocado en cuatro trabajos.

## Regla de oro

El producto existe para hacer cuatro cosas, bien:

> **Agendar · Cobrar · Cerrar caja · Calcular comisiones**

Si una funcionalidad **no sirve directamente** a uno de esos cuatro trabajos, **no se construye**: va a `docs/ROADMAP.md`. No agregar features "porque estaría bueno".

---

## Cómo trabajamos (CRÍTICO)

> **Las 4 fases del MVP (§Fases más abajo) ya están completas y
> deployadas en producción** — ver `docs/CURRENT_STATE.md`. Las reglas de
> abajo siguen aplicando para cualquier trabajo nuevo (un módulo grande
> nuevo sigue mereciendo su propio plan aprobado antes de código), pero ya
> no hay "Fase 0/1/2/3" pendiente. Trabajo real pendiente vive en
> `docs/BACKLOG.md`; features nuevas fuera de alcance en `docs/ROADMAP.md`.

1. **Plan antes de código para cualquier trabajo no trivial.** Proponer un
   plan y **esperar aprobación humana** antes de escribir código — esto
   valía por fase durante el MVP, sigue valiendo por feature/cambio grande
   ahora.
2. **Validar y commitear al terminar cada unidad de trabajo.** Correr
   `npm run qa` (ver §Comandos) antes de dar algo por terminado.
3. **No implementar features del roadmap.** Está fuera de v1: IA/OpenAI,
   RAG, Google Maps, MercadoPago real (SDK/webhooks), WhatsApp automático,
   inventario, señas, lista de espera, fidelización, AFIP, multi-tenant
   público, billing SaaS, superadmin, pago mixto. El modelo de datos los
   contempla, pero **no se construye su funcionalidad** — detalle y cuándo
   en `docs/ROADMAP.md`. (El portal de cliente/app nativa de clientes
   **salió de esta lista el 2026-07-20** por decisión explícita — ver
   `docs/DECISIONS.md` — y ya tiene su propio backend + APK, documentado en
   `docs/MOBILE_APP_BRIEF.md`.)
4. **No sobre-explorar el repo** ni instalar dependencias sin necesidad
   real.

---

## Stack (decisión final, no discutir en MVP)

- **Next.js (App Router) + TypeScript** — frontend y backend.
- **Supabase** — Postgres, Auth y Storage.
- **Drizzle ORM** + migraciones versionadas.
- **Tailwind + shadcn/ui** — UI.
- **Render** — hosting de producción (decisión final tomada en el deploy
  real del 2026-07-16; Railway quedó documentado como alternativa
  equivalente en `docs/DEPLOYMENT.md`, no se usó).
- IA/OpenAI: **fuera del MVP**.

Detalle completo de componentes, flujo de datos, servicios externos y
entornos: `docs/ARCHITECTURE.md`.

---

## Reglas técnicas innegociables

- **Dinero:** `numeric(12,2)`. **NUNCA** `float`/`double`.
- **Autorización backend-first:** todo endpoint valida **rol + `organization_id` + `branch_id`** antes de responder. Hay **RLS** en tablas críticas (`sales`, `payments`, `cash_sessions`, `cash_movements`, `commissions`, `appointments`, `clients`, `barber_profiles`, `files`). **Nunca confiar solo en el frontend** (el front oculta, el backend autoriza).
- **`organization_id` en TODAS las tablas de negocio.** Aunque hoy haya una sola organización.
- **Anti doble-reserva:** exclusion constraint parcial en Postgres sobre `(barber_id, tstzrange(start_at, end_at))` con `btree_gist`, **solo para estados activos** (`scheduled`, `confirmed`, `in_progress`). Los estados `cancelled`/`no_show`/`completed` **no** bloquean. Implementar con **migración SQL raw** si Drizzle no lo soporta bien. Siempre: **validación en backend + constraint en base + tests de solapamiento**.
- **Soft delete** (`deleted_at`, `deleted_by`, `active`/`status`) en `users`, `branches`, `services`, `clients`, `barber_profiles`. **Ventas, pagos, caja, comisiones y audit logs NO se borran físicamente**; las correcciones se hacen con `adjustment` + audit.
- **Archivos a Supabase Storage, salvo fotos de cliente/historial de cortes → Cloudflare R2.** En la base solo metadata (tabla `files`, con `storage_provider` indicando cuál de los dos). Nunca binarios en Postgres. Certificados médicos y documentos personales = `admin_only`. La excepción de R2 está acotada a `client_visit_photos`/`file_category = 'client_photo'` — ver `docs/DECISIONS.md` (2026-07-20) por qué.
- **Teléfonos:** guardar valor crudo (`*_raw`) + normalizado **E.164** (`*_e164`). País por defecto **Argentina**. Índice único parcial `(organization_id, whatsapp_e164)` cuando exista.
- **Zona horaria:** almacenar en **UTC**, mostrar en hora local. Default `America/Argentina/Buenos_Aires`. Sin DST.
- **Comisión:** sobre el **total neto pagado después de descuentos**, solo ventas `paid`, guardando `rate_snapshot`. Sin comisión sobre `cancelled`/`no_show`. Si el barbero no tiene comisión: usar `organization_settings.default_commission_rate`; si no hay, **0 + advertencia**.
- **Auditoría:** toda corrección sensible (turno completado, venta pagada, caja cerrada) **queda auditada**. Registrar eventos de negocio en `domain_events` y técnicos en `system_events`.
- **Configuración, no hardcode:** reglas como buffer, intervalo de slot, comisión default, permisos de cobro/walk-in viven en `organization_settings`, no en el código.

---

## Convenciones

- TypeScript estricto. Validación de inputs (zod o equivalente) en cada endpoint.
- **Código y nombres de DB en inglés; UI en español.**
- Migraciones versionadas con Drizzle. **Prohibido** tocar la base a mano fuera de migraciones.
- Tests obligatorios para lógica crítica: agenda/anti-doble-reserva, caja, comisiones.
- Commits chicos y descriptivos. No mezclar fases en un mismo commit.
- Secretos solo en variables de entorno. **Nunca** en el repo.

---

## Comandos

```
npm run dev                     # entorno local (Turbopack)
npm run build                   # build de producción
npm start                       # servir el build de producción
npm run lint                    # ESLint
npm run typecheck               # tsc --noEmit
npm run test                    # tests unitarios/integración (Vitest)
npm run test:e2e                # tests end-to-end (Playwright)
npm run qa                      # lint + typecheck + test + build — correr esto antes de dar algo por terminado
npm run qa:full                 # qa + test:e2e
npm run db:generate             # generar migración nueva (drizzle-kit)
npm run db:migrate              # aplicar migraciones pendientes contra una base ya migrada (incremental)
npm run db:migrate:fresh        # migrar un proyecto de Supabase completamente nuevo (dos tandas — ver docs/DECISIONS.md)
npm run db:seed                 # cargar datos demo (idempotente)
npm run db:bootstrap-production # un solo uso: crea la organización + admin real en un Supabase de producción nuevo
```

`scripts/seed-production-team.ts` (equipo placeholder post-bootstrap) no
tiene alias de `npm run` todavía — se corre con
`npx tsx --env-file=.env.production.local scripts/seed-production-team.ts`.
Ver `docs/DEPLOYMENT.md`.

## Cómo validar cambios

**Antes de marcar cualquier tarea como terminada:** correr `npm run qa`
(lint + typecheck + test + build) y que pase en verde. Si el cambio toca
agenda, caja o comisiones, además correr los tests de integración
relevantes en `src/test/integration/` contra una base real si aplica.
Nunca marcar algo "terminado" con `qa` en rojo.

## Carpetas y archivos que NO se tocan a mano

- **`migrations/`** — nunca editar una migración ya aplicada ni tocar el
  schema de Postgres fuera de una migración nueva generada con
  `npm run db:generate`.
- **`.env`, `.env.local`, `.env.production.local`, cualquier `.env*`** —
  nunca commitear secretos; ya están en `.gitignore`.
- **`node_modules/`** — nunca editar directamente.
- **`scripts/bootstrap-production.ts` y `scripts/seed-production-team.ts`**
  — son de un solo uso contra un Supabase de producción. **No correrlos
  de nuevo sin confirmación explícita** — ya corrieron contra la
  producción real el 2026-07-16 (ver `docs/DECISIONS.md`); volver a
  correrlos podría duplicar datos o pisar la organización real.
- **`src/db/schema/`** — se edita, pero todo cambio necesita su migración
  correspondiente generada con Drizzle, nunca `ALTER` manual contra la
  base.

---

## Fases del MVP (ya completas — referencia histórica)

Las 4 fases originales del MVP, hoy completas y deployadas
(`docs/CURRENT_STATE.md`):

- **Fase 0 — Fundación:** proyecto, stack, Supabase, auth, roles, layout base, modelo base, seed inicial.
- **Fase 1 — Agenda:** sucursales, usuarios/staff, servicios, clientes, barberos, `barber_schedules`/`barber_time_off`, turnos, anti doble-reserva, `appointment_history`.
- **Fase 2 — Dinero:** ventas, `payments` manuales, caja, movimientos, cierre de caja, comisiones.
- **Fase 3 — Paneles y control:** dashboard admin básico, vista recepcionista, vista barbero, export CSV/Excel, audit log visible, `domain_events`/`system_events` consultables.

Reglas cerradas que estas fases tuvieron que cumplir para darse por
terminadas (siguen siendo el estándar para tocar estas áreas hoy):
- La agenda **bloquea doble reserva con constraint + validación + tests**.
- La caja **separa efectivo físico de métodos digitales** y deja la
  diferencia auditada.
- Las comisiones **calculan por barbero/período con `rate_snapshot`**
  según la regla cerrada (total neto pagado después de descuentos).

---

## Definition of Done

Un cambio está terminado cuando:

- [ ] `npm run qa` pasa en verde (lint, typecheck, test, build).
- [ ] Si toca agenda/caja/comisiones: hay test nuevo o existente que
  cubre el caso, no solo verificación manual.
- [ ] No rompe autorización backend-first (rol + `organization_id` +
  `branch_id` validados en cada endpoint tocado).
- [ ] No usa `float`/`double` para dinero, no borra físicamente ventas/
  caja/comisiones/audit, no toca la base fuera de una migración.
- [ ] Si cambió una decisión de alcance/arquitectura no obvia: queda
  registrada en `docs/DECISIONS.md`.
- [ ] Si cambió el estado real del proyecto (qué funciona, qué falta):
  `docs/CURRENT_STATE.md` está actualizado, no desactualizado.
- [ ] No mezcla trabajo de features distintas en el mismo commit.

---

## Qué NO hacer

- No agregar features de `docs/ROADMAP.md` a alcance activo sin decisión
  explícita.
- No borrar físicamente datos sensibles (ventas, caja, comisiones, audit).
- No confiar en el frontend para permisos.
- No usar `float` para dinero.
- No tocar la base fuera de migraciones.
- No instalar dependencias innecesarias ni sobre-explorar el repo.
- No correr `scripts/bootstrap-production.ts` ni
  `scripts/seed-production-team.ts` contra producción sin confirmación
  explícita — ya se usaron una vez, correrlos de nuevo no es idempotente
  de la misma forma que `db:seed`.
