# Production Readiness — BarberOS MVP v1

> Snapshot of where the MVP stands, what was fixed recently, and what's
> genuinely missing before this goes to production. This is a living
> document — update it when the state changes, don't let it go stale.
> Source of truth for scope/rules remains `AGENTS.md` and `docs/PRD.md`.

## Current state

Fases 0–3 del PRD (`AGENTS.md` §Fases) están implementadas: fundación,
agenda con anti doble-reserva, dinero (ventas/caja/comisiones), y paneles de
control/exportación. La app corre sobre Next.js 15 (App Router) + TypeScript,
Supabase (Postgres + Auth), Drizzle ORM con migraciones versionadas, y
Tailwind + shadcn/ui.

## Recent fixes (this cycle)

- **Clientes:** corregido el manejo de consentimiento (`consentData`,
  `consentWhatsapp`) — el formulario ahora rastrea el estado inicial y evita
  perder o pisar el consentimiento registrado al editar un cliente.
- **Operación:** corregidos los horarios por día (`barber_schedules` /
  working hours) — la edición ya distingue correctamente cada día de la
  semana en vez de aplicar un horario genérico.
- **Comisiones:** la liquidación de una comisión ahora exige un paso de
  confirmación explícito ("Confirmar liquidación") antes de marcarla `paid`,
  evitando liquidaciones accidentales de un click.
- **Auth:** flujo de "olvidé mi contraseña" implementado
  (`/recuperar-contrasena`, `/restablecer-contrasena`) sobre Supabase Auth.
- **Caja — anulación de ventas** (ver detalle abajo): implementada de punta
  a punta, admin-only, con reversa de caja y bloqueo cuando la comisión ya
  fue liquidada.

### Void de ventas — detalle

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
  `voided_at`, `voided_by`, `void_reason`; **`paid_at` se conserva** — la
  venta anulada sigue mostrando cuándo se cobró originalmente. Un check de
  base de datos (`sales_void_fields_consistent`) exige que los tres campos
  de trazabilidad viajen juntos.
- **Caja cerrada:** si la sesión de caja original ya está `closed`/
  `reconciled`, el cierre histórico **no se recalcula** — el movimiento de
  reversa queda igual auditado, y la UI muestra una advertencia explícita.
- **Auditoría:** cada anulación escribe `audit_logs` (`action: 'sale.voided'`)
  y `domain_events` (`event_type: 'sale.voided'`) con el motivo, montos y
  sesiones de caja involucradas.
- **Nota sobre el PRD:** `docs/PRD.md` §6 (Ventas) describe `cancelled` como
  "anulada antes del pago". El void implementado reutiliza el mismo status
  `cancelled` para anular **después** del pago, distinguido por
  `voided_at`/`paid_at` ambos no nulos. Es una extensión intencional de la
  máquina de estados, no un bug — vale la pena reflejarlo en el PRD si se
  revisa ese documento más adelante.

## Pendientes reales antes de producción

- [ ] **CI.** No hay `.github/workflows` ni pipeline equivalente en el repo:
  `lint`, `typecheck`, `test` y `build` corren hoy solo a mano/local. Antes
  de producción, al menos esos cuatro deberían correr en cada PR.
- [ ] **Observabilidad / logs en endpoints críticos.** `system_events` existe
  en el modelo y se usa para registrar, pero no hay instrumentación
  sistemática de errores no controlados en rutas de dinero (`/api/sales`,
  `/api/cash-*`, `/api/commissions`) ni alertas — hoy dependemos de logs de
  Vercel/consola.
- [ ] **Revisión de versiones y entorno de deploy.** Confirmar versiones
  fijadas de Next.js/React/Drizzle/Supabase clients contra lo soportado en
  producción, y que las variables de entorno (`DATABASE_URL` con pooler de
  transacciones, `DIRECT_URL` para migraciones, claves de Supabase) estén
  correctamente separadas por entorno en Vercel — no hay `vercel.json` en el
  repo, así que esa configuración vive hoy solo en el dashboard.
- [ ] **Ajuste de comisión ya liquidada.** Hoy, si la comisión está `paid`,
  la venta simplemente no se puede anular (bloqueo duro, decisión v1
  explícita). Falta diseñar el mecanismo de ajuste/nota de débito para
  descontar en la próxima liquidación cuando ese caso real aparezca.
- [ ] **Fixtures/seed más completos.** El seed actual no separa
  deliberadamente casos `paid`, `voided` (venta anulada) y comisión `paid`
  como fixtures reutilizables — hoy existen de forma incidental (una venta
  del seed quedó anulada como parte del QA manual de este ciclo). Vale la
  pena crear fixtures explícitos para los tres casos y que el seed sea
  determinístico para QA/demo.
- [ ] **Paginación.** Los listados de ventas, movimientos de caja y
  comisiones usan límites fijos (`limit(100)`/`limit(200)`) sin paginación
  real. No bloqueante para el volumen actual del MVP, pero va a hacer falta
  con más historial.
- [ ] Otras mejoras no bloqueantes: revisar mensajes de error genéricos
  restantes, cobertura de tests de UI (hoy la cobertura fuerte está en
  lógica de negocio/DB, no en componentes React), y accesibilidad completa
  contra la guía en `docs/UI_STYLE_GUIDE.md`.

## Verification snapshot (this cycle)

- `npx tsc --noEmit`, `npm run lint`, `npm run build`: OK.
- `npm run test`: 90/90 tests passing (incluye constraints de DB reales para
  `sales`/`cash_movements` y el cálculo de reversa de caja).
- QA manual guiado de `/caja` (admin): panel admin-only, búsqueda por
  fecha/sucursal, diálogo de anulación exige motivo, advertencia de caja
  cerrada, movimiento de reversa visible, no re-anulable, bloqueo por
  comisión liquidada con mensaje legible en UI — todo verificado a mano
  contra datos reales en Supabase (dev).
