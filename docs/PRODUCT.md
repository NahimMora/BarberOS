# Producto — BarberOS

## Qué problema resuelve

Reemplaza planillas, WhatsApp y papel para operar una barbería con una o
más sucursales. El negocio necesita hacer, todos los días, cuatro cosas
bien: agendar turnos sin pisarse, cobrar, cerrar caja cuadrando efectivo
físico contra medios digitales, y calcular cuánto le corresponde a cada
barbero. BarberOS es el sistema que hace esas cuatro cosas con datos
auditables en vez de memoria o papel.

## Para quién

- **Dueño/Admin** — ve todo el negocio, todas las sucursales, configura
  reglas (comisión default, buffers de agenda), accede a legajos y audit
  log.
- **Recepcionista** — agenda, clientes y caja de su sucursal.
- **Barbero** — sus propios turnos, sus ventas, su comisión.

Perfil de negocio objetivo: barbería(s) en Argentina, tamaño chico o
mediano, con staff fijo — no un marketplace de barberos independientes.
Detalle completo de roles y permisos: `docs/USERS.md`.

## Qué NO intenta resolver (fuera de alcance a propósito)

- Reservas públicas online o portal de cliente final — el cliente de la
  barbería no tiene login.
- Marketing, WhatsApp automático, recordatorios (→ roadmap v1.1).
- Pagos reales online (MercadoPago SDK/webhooks) — hoy los pagos se
  **registran**, no se procesan (→ roadmap v1.2).
- Inventario, señas/depósitos, lista de espera, fidelización.
- Facturación AFIP.
- Multi-tenant público / SaaS con billing — el modelo ya lleva
  `organization_id` en toda tabla de negocio pensando en esto, pero v1
  opera con una sola organización real.
- IA/insights automáticos sobre los datos (→ roadmap v1.4/v1.5).

Ver `docs/ROADMAP.md` para cuándo, si alguna vez, algo de esto entra a
alcance activo.

## Cómo genera (o podría generar) valor

- **Hoy:** evita doble reserva de barberos —bloqueada a nivel de base de
  datos, no solo de UI—, hace que la caja cuadre con evidencia auditable
  en vez de depender de un conteo manual sin registro, y calcula
  comisiones de forma consistente en vez de a mano por barbero/mes.
- **A futuro:** los datos ya modelados (`domain_events`, `payments`
  multi-método, `organization_id`) habilitan sin rediseñar el schema: pago
  mixto, recordatorios de WhatsApp, IA/RAG sobre lo que pasó en el
  negocio, y eventualmente un producto SaaS multi-organización.

Fuente completa de reglas de producto y restricciones técnicas:
`AGENTS.md`. Historial de por qué se decidió cada cosa: `docs/DECISIONS.md`.
