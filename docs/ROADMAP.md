# Roadmap — BarberOS

> Todo lo de acá está **fuera del MVP v1** a propósito (`AGENTS.md` —
> regla de los 4 trabajos: agendar, cobrar, cerrar caja, calcular
> comisiones). El modelo de datos ya contempla varias de estas cosas
> (`domain_events`, `payments` multi-método, `organization_id`) para no
> tener que rediseñar el schema cuando llegue el momento, pero la
> funcionalidad no está construida. No implementar nada de esto sin una
> decisión explícita de sacarlo del roadmap y meterlo a alcance activo.

## v1.1 — Comunicación y carga de datos

- WhatsApp con plantillas aprobadas, recordatorios de turno, registro de
  notificaciones enviadas.
- Importación CSV/Excel (desde Google Sheets/Excel/papel digitalizado) de
  clientes, servicios y eventualmente historial — para negocios que
  migran desde planillas.

## v1.2 — Pagos reales

- MercadoPago real (SDK + webhooks), reemplazando el registro manual
  actual (`payments.method = 'mercadopago_manual'`).
- Señas/depósitos.
- Conciliación automática.

## v1.3 — Dashboards avanzados

- Ranking de barberos, ocupación de agenda, tendencias, clientes
  recurrentes, promociones por fidelidad.

## v1.4 — IA sobre datos agregados

- Resúmenes por rol y alertas inteligentes usando OpenAI sobre los datos
  ya existentes (ventas, agenda, comisiones).

## v1.5 — RAG sobre eventos

- El admin pregunta "¿qué pasó acá?" y la IA responde en base a
  `audit_logs`, `domain_events` y `system_events` — ya se registran desde
  v1, listos para esto.

## v2 — SaaS multi-tenant público

- Múltiples organizaciones reales operando a la vez (hoy el modelo lo
  soporta vía `organization_id`, pero opera con una sola organización
  real).
- Superadmin, bloqueo/desbloqueo de organizaciones por falta de pago,
  planes, facturación (manual primero, automática después).

## v2+ — Expansión de producto

- Inventario, gastos avanzados, lista de espera, fidelización avanzada.
- ~~Portal de cliente, usuario final del cliente con su propio login~~ —
  salió de acá el 2026-07-20 (decisión explícita, ver
  `docs/DECISIONS.md`): ya tiene su propio backend (`/api/client/*`) y una
  APK (`docs/MOBILE_APP_BRIEF.md`).

## Explícitamente descartado, no "todavía no"

Ver `docs/PRODUCT.md` § "Qué NO intenta resolver". Nada ahí tiene fecha
planeada en este roadmap; si algún día entra, es una decisión de producto
nueva, no una continuación natural de lo de arriba.
