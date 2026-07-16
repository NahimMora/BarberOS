# Production Readiness — BarberOS MVP v1

> Snapshot de dónde está el MVP, qué se arregló recientemente, y qué falta
> genuinamente antes de producción. Documento vivo — actualizar cuando
> cambie el estado, no dejar que quede viejo. Fuente de verdad de alcance/
> reglas sigue siendo `AGENTS.md` y `docs/PRD.md`.

## Estado actual

Fases 0–3 del PRD (`AGENTS.md` §Fases) están implementadas: fundación,
agenda con anti doble-reserva, dinero (ventas/caja/comisiones), y paneles
de control/exportación. Sobre esa base, este ciclo hizo una pasada de
producción (7 fases, ver `docs/AUTOMODE_CHECKPOINT.md` para el detalle
completo por commit) que tocó primitives visuales, Operación, Agenda,
Caja, Comisiones/Control/Exportaciones, e infraestructura de deploy.

## Auditoría (2026-07-16)

Segunda pasada de QA manual en navegador real, sobre el estado del ciclo
anterior (más los cambios sin commitear que ya estaban en el working
tree). Se encontraron y corrigieron 3 bugs de producto y 1 problema de
higiene de datos:

1. **Agenda mostraba el día siguiente en vez de "hoy" durante la noche
   argentina.** `toLocalDateString` en `src/app/(app)/agenda/page.tsx`
   usaba `date.toISOString().slice(0, 10)` (UTC) en vez de la zona horaria
   de Argentina. Entre las 21:00 y las 23:59 hora local, la agenda del día
   —turnos, horarios disponibles, contadores— correspondía a mañana, no a
   hoy. Corregido reutilizando `getLocalCalendarDate` de
   `src/lib/datetime/local-day-range.ts`, el helper ya probado que usa el
   resto del código para esto mismo.
2. **Ausencias (Operación → Disponibilidad) no filtraba por su propio
   selector de barbero.** La lista usaba `selectedBarberId`, el estado del
   barbero elegido en la tarjeta *Horario recurrente* (un control
   distinto), en vez de `timeOffForm.barberId`, el selector que el usuario
   realmente tenía debajo de "Ausencias". Cambiar el filtro de Ausencias
   no actualizaba la lista. Corregido en
   `src/app/(app)/operacion/operation-console.tsx`.
3. **Búsqueda de clientes no ignoraba tildes.** Buscar "Martin" no
   encontraba a "Martín García" porque `ILIKE` en Postgres compara
   literal, sin normalizar acentos. Corregido habilitando la extensión
   `unaccent` de Postgres (migración `0012_unaccent_extension.sql`) y
   envolviendo la comparación de nombre en `src/app/api/clients/route.ts`.
   Beneficia también al combobox de cliente en Agenda y a Venta rápida en
   Caja, que comparten el mismo endpoint.
4. **Un test de integración dejaba datos permanentes en la base de dev.**
   `allows a voided sale to keep its original paid_at`
   (`src/test/integration/finance-db.test.ts`) esperaba que su `insert`
   tuviera éxito, así que la transacción `sql.begin(...)` committeaba de
   verdad en cada corrida de `npm run test` — sin rollback. Acumuló 41
   sucursales fantasma ("Voided sale constraint test") visibles en
   Operación → Sucursales. Corregido forzando un rollback intencional
   dentro del test. Las filas leftover se desactivaron (soft-delete); no
   se tocaron las ventas asociadas porque `sales` tiene un trigger que
   bloquea deletes físicos (comportamiento esperado, no un bug).

Verificado también en esta pasada (antes marcado `[ ]` en
`docs/QA_CHECKLIST.md`): filtro Todos/Barberos/Recepción/Admins en
Equipo, alta de barbero (legajo + comisión precargada con el default de
la organización), edición de barbero con campos precargados,
confirmación antes de "Deshabilitar", "Aplicar a días seleccionados" en
Disponibilidad replicando un horario a 3 días, `/recuperar-contrasena`
con mensaje genérico que no revela si el email existe, y bloqueo de
rutas admin-only para barbero (`/caja`, `/exportaciones`, `/operacion`,
`/control`) además de las ya verificadas para receptionist. Detalle
punto por punto en `docs/QA_CHECKLIST.md`.

## Auditoría final (2026-07-12)

Primera pasada de QA manual en navegador real (`docs/QA_CHECKLIST.md`)
contra las 8 pantallas principales y los 3 roles, con datos reales en
Supabase. Se encontraron y corrigieron 4 bugs reales, dos de ellos de
dinero:

1. **Comisiones sumaba ventas anuladas en los totales.** El resumen por
   barbero (`salesCount`, `baseAmount`, `commissionAmount`) no filtraba por
   `status`, así que una venta anulada seguía inflando "Comisión total" y
   "Base neta" — solo `pendingAmount`/`paidAmount` excluían `cancelled`.
   Afectaba datos ya existentes en el seed (Barbero Norte pasó de 5 a 4
   ventas contadas tras el fix). Corregido en
   `src/app/api/commissions/route.ts`.
2. **Badge de comisión anulada mostraba "Pendiente".** La UI solo
   distinguía `paid` de todo lo demás; ahora `cancelled` muestra "Anulada"
   en rojo (`src/app/(app)/comisiones/commissions-report.tsx`).
3. **`toast.error` con un objeto crudo de Zod rompía el `Toaster`.** 20
   endpoints devolvían `{ error: parsed.error.flatten() }` (un objeto) en
   vez de un string, violando el contrato `{ error: string }` documentado
   en `docs/UI_STYLE_GUIDE.md`. Cualquier validación fallida en esos
   endpoints crasheaba la página en vez de mostrar un toast. Corregido con
   un helper compartido (`src/lib/validation/zod-error.ts`) que siempre
   devuelve un mensaje legible.
4. **Cerrar caja sin cargar "Efectivo contado" mostraba el mensaje técnico
   de Zod** ("Invalid string: must match pattern..."). Corregido
   deshabilitando "Confirmar cierre" sin valor y dando mensajes legibles a
   los 4 campos de dinero validados por regex (`openingAmount`,
   `countedCash`, `amount` de movimientos, `discount` de ventas) vía
   `src/lib/validation/money.ts`.
5. **Combobox de cliente en Agenda concatenaba texto en vez de
   reemplazarlo** al escribir sobre el valor ya seleccionado ("Walk-in
   (sin cliente)"), rompiendo la búsqueda. Corregido seleccionando el
   texto del input al enfocar (`src/components/ui/combobox.tsx`).

Verificado también: acceso por rol bloqueado en backend (no solo oculto en
el menú) para receptionist y barbero en las rutas admin-only; flujo
completo de turno (crear → confirmar → iniciar → completar → cobrar →
reprogramar → cancelar); apertura/cierre de caja con diferencia; ajuste de
caja cerrada sin tocar el snapshot histórico; anulación de venta con
reversa correcta; liquidación de comisiones; exportaciones con manejo de
error legible; tabs de Control con copy específico. Detalle punto por
punto en `docs/QA_CHECKLIST.md`.

**No se tocó en esta auditoría** (fuera de alcance, por diseño): deploy
real, integración de Sentry/observabilidad externa, downgrade de
`drizzle-kit` para la vulnerabilidad de `esbuild`, ni ningún pendiente ya
documentado abajo como decisión de alcance v1.

## Qué cambió en este ciclo

- **Visual:** tipografía Geist (reemplaza Plus Jakarta Sans), botones/
  targets táctiles a 44px, popups de menú consistentes con los selects.
- **Operación:** perfil de staff unificado (antes dos diálogos separados
  para datos básicos y legajo), filtro por rol en Equipo, Disponibilidad
  rediseñada por barbero (antes una lista plana de todos los horarios de
  todos los barberos), validación de solapamiento de horarios en backend.
- **Agenda:** columna/filtro de barbero, badges de estado con ícono propio
  por estado, cobro de turno con desglose real de servicios, `MoneyInput`,
  y campo de referencia de pago (antes solo existía en Caja).
- **Caja:** reordenada como control financiero primero (antes el cobro
  manual era la sección dominante); "Cobro manual" ahora es "Venta rápida
  (sin turno)", colapsada por defecto, sin selector de turno (cobrar un
  turno se hace desde Agenda); `MoneyInput` en todos los montos.
- **Comisiones:** el detalle por venta ahora muestra hora, servicio,
  cliente y sucursal (antes solo fecha/base/tasa/comisión).
- **Control:** cada tab (Auditoría/Negocio/Sistema) explica su propio
  propósito en vez de una descripción genérica.
- **Exportaciones:** presets de período (Hoy/Esta semana/Este mes/Mes
  anterior/Rango personalizado) con soporte real de rango de fechas en
  backend para ventas/caja/auditoría/eventos; descargas por fetch+blob en
  vez de `<a href>` crudo, así un error muestra un toast en vez de navegar
  a JSON crudo.
- **Deploy:** `output: 'standalone'`, `/api/health`, CI en GitHub Actions,
  `docs/DEPLOYMENT.md` (Railway/Render/Supabase/Cloudflare), `.env.example`
  corregido para plataformas persistentes (Session Pooler de Supabase en
  vez de guía específica de Vercel/serverless).

### Void de ventas — detalle (sin cambios este ciclo, sigue vigente)

- **Alcance:** cualquier venta `paid` de la organización, por ID, incluso si
  la caja original ya está cerrada. Búsqueda admin-only en `/caja` con
  filtros de fecha y sucursal (`GET /api/sales?status=paid&from=&to=&branch_id=`).
- **Autorización:** `POST /api/sales/[id]/void` exige rol `admin`
  (`requireRole`). El frontend solo renderiza el panel para admin, pero la
  autorización real vive en el backend.
- **Bloqueo de comisión liquidada:** si `commissions.status = 'paid'` para la
  venta, la anulación se rechaza con `409` y un mensaje legible
  ("No se puede anular: la comisión de esta venta ya fue liquidada"). Solo
  una comisión `pending` puede pasar a `cancelled` junto con la venta.
- **Reversa de caja:** se buscan **todos** los `cash_movements` de
  `type='sale'` referenciando la venta (no se asume un único movimiento por
  venta) y se inserta un `type='void'` por cada uno, mismo `payment_method`
  y `cash_session_id`, importe negativo.
- **Trazabilidad de la venta:** `status` pasa a `cancelled`, se completan
  `voided_at`, `voided_by`, `void_reason`; **`paid_at` se conserva**. Un
  check de base de datos (`sales_void_fields_consistent`) exige que los
  tres campos de trazabilidad viajen juntos.
- **Caja cerrada:** si la sesión de caja original ya está `closed`/
  `reconciled`, el cierre histórico **no se recalcula** — el movimiento de
  reversa queda igual auditado, y la UI muestra una advertencia explícita.
- **Auditoría:** cada anulación escribe `audit_logs` (`action: 'sale.voided'`)
  y `domain_events` (`event_type: 'sale.voided'`) con el motivo, montos y
  sesiones de caja involucradas.

## Pendientes reales antes de producción

- [ ] **Deploy real.** Todo lo de `docs/DEPLOYMENT.md` está preparado
  (build standalone, healthcheck, CI, env vars documentadas) pero **no se
  hizo ningún deploy real** — requiere confirmación explícita y elegir
  Railway o Render (recomendación: Railway, ver el documento).
- [ ] **Observabilidad real.** `system_events` existe y se usa en rutas
  como exports/control-events, pero sigue sin instrumentación sistemática
  de errores no controlados en las rutas de dinero (`/api/sales`,
  `/api/cash-*`, `/api/commissions`), y no hay un servicio externo tipo
  Sentry conectado (requiere credenciales/decisión de cuenta, no se agregó
  sin confirmación).
- [ ] **Ajuste de comisión ya liquidada.** Si la comisión está `paid`, la
  venta simplemente no se puede anular (bloqueo duro, decisión v1
  explícita). Falta diseñar el mecanismo de ajuste/nota de débito.
- [ ] **Fixtures/seed más completos.** El seed no separa deliberadamente
  casos `paid`/`voided`/comisión `paid` como fixtures reutilizables.
- [ ] **Paginación.** Ventas, movimientos de caja y comisiones siguen sin
  paginación real (`limit(100)`/`limit(200)` fijo). No bloqueante al
  volumen actual.
- [x] **QA visual en navegador real.** Hecho en la auditoría del
  2026-07-12 (ver sección arriba y `docs/QA_CHECKLIST.md`) — quedan
  algunos ítems puntuales sin recorrer (altas/ediciones de staff,
  responsive 375/768px en Caja, apertura de Excel descargado), marcados
  `[ ]` en el checklist.
- [ ] **Vulnerabilidad moderada aceptada:** `npm audit` reporta un
  `esbuild` vulnerable anidado en `drizzle-kit` (herramienta de desarrollo,
  no corre en producción). Arreglarla requeriría bajar `drizzle-kit` a
  `0.18.1` (breaking, muy por debajo de la versión actual `^0.31.10`) — no
  se hizo. Bajo riesgo real: afecta al dev server de esbuild, no al build
  de producción ni al runtime desplegado.
- [ ] Otras mejoras no bloqueantes: mensajes de error genéricos
  restantes, cobertura de tests de UI (la cobertura fuerte sigue en lógica
  de negocio/DB, no en componentes React), accesibilidad completa contra
  `docs/UI_STYLE_GUIDE.md`.

## Verification snapshot (auditoría 2026-07-16)

- `npx tsc --noEmit`, `npm run lint`, `npm run test` (131/131, 4 skipped),
  `npm run build`: OK, corridos al cierre de esta auditoría, después de
  los 4 fixes descriptos arriba.

## Verification snapshot (auditoría 2026-07-12)

- `npx tsc --noEmit`, `npm run lint`, `npm run test` (123/123), `npm run
  build`: OK, corridos al cierre de la auditoría final, después de los 5
  fixes descriptos arriba.

## Verification snapshot (ciclo de producción anterior)

- `npx tsc --noEmit`, `npm run lint`, `npm run build`: OK, corridos al
  cierre de cada una de las 6 fases implementadas.
- `npm run test`: 122/122 tests (subieron de 90 al empezar el ciclo — se
  agregaron tests de `schedule-summary` (resumen/solapamiento de
  horarios), un test de integración para el índice único
  `sales_appointment_id_idx` (turno cobrado dos veces), y tests de borde
  de mes/día para `local-day-range` (bisiestos, rollover de mes, huso
  horario fijo de Argentina) que no existían.
- QA manual guiado previo (ciclo anterior) de `/caja` (admin): panel
  admin-only, búsqueda por fecha/sucursal, diálogo de anulación exige
  motivo, advertencia de caja cerrada, movimiento de reversa visible, no
  re-anulable, bloqueo por comisión liquidada con mensaje legible —
  verificado a mano contra datos reales en Supabase (dev). No se repitió
  en este ciclo porque `void-sale-panel.tsx` no se tocó.
