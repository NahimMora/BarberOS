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
- [ ] **QA visual en navegador real.** Los cambios de este ciclo pasaron
  `tsc`/`lint`/`test`/`build`, pero no se pudo recorrer la UI en un
  navegador real dentro de esta sesión (extensión de Chrome no conectada
  en el momento de trabajar Fase 1; no se reintentó en fases posteriores
  para no interrumpir el flujo). Ver `docs/QA_CHECKLIST.md` para lo que
  falta recorrer a mano antes de dar por cerrado el ciclo visual.
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

## Verification snapshot (este ciclo)

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
