# PRD MVP v1 definitivo + Roadmap — Plataforma de Gestión de Barbería

**Versión:** 3.0 (definitiva para implementación)
**Estado:** Listo para implementar — sin código todavía
**Alcance:** MVP funcional y barato, diseñado para crecer. Una organización operativa en v1.
**Región:** Argentina (UTC−3, sin horario de verano)

---

## 0. Filosofía del MVP

El MVP existe para que la barbería haga **cuatro cosas, bien**:

> **Agendar · Cobrar · Cerrar caja · Calcular comisiones**

Cualquier feature que no sirva directamente a uno de esos cuatro trabajos no entra al MVP y va al roadmap.

**Principio arquitectónico:** todas las tablas de negocio llevan `organization_id` desde el día uno. En v1 hay una sola organización, pero esto evita rehacer la arquitectura al pasar a SaaS. La autorización vive en el **backend**, reforzada con **RLS** en tablas críticas (ver sección 4).

---

## 1. Alcance

### Incluido en MVP v1
Autenticación · Roles (admin/dueño, recepcionista, barbero) · Sucursales · Usuarios/staff · Legajo básico del barbero · Clientes (perfil preparado para IA futura) · Catálogo de servicios · Agenda/turnos · Control anti doble-reserva · Reprogramación/cancelación con historial · **Walk-in simple** · Venta manual · Métodos de pago manuales (efectivo, transferencia, tarjeta, MercadoPago manual, otro) · Tabla `payments` (un pago por venta en v1) · Caja diaria/sesiones de caja + movimientos · Comisiones simples por barbero · Dashboard básico admin · Vista barbero · Vista recepcionista · Audit log + domain events + system events (solo registrar/consultar/exportar) · Exportación CSV/Excel · Modo demo/seed.

### Fuera del MVP v1 (al roadmap)
IA/insights · RAG sobre logs · Google Maps · MercadoPago real (SDK/webhooks) · WhatsApp automático · Portal público de reservas · Usuario final del cliente · App nativa · Inventario · Señas/depósitos · Lista de espera · Fidelización · Facturación AFIP · Multi-tenant público · Planes y billing SaaS · Superadmin · Pago mixto/múltiples pagos por venta.

> El modelo de datos contempla varios de estos (ej. `domain_events` para RAG, `payments` para pago mixto, `organization_id` para SaaS) pero **no se construye su funcionalidad** en v1.

---

## 2. Stack tecnológico (decisión final)

| Capa | Elección |
|---|---|
| Frontend/backend fullstack | **Next.js + TypeScript** |
| Hosting | **Vercel** |
| Base de datos | **Supabase Postgres** |
| Auth | **Supabase Auth** |
| Storage | **Supabase Storage** |
| Seguridad | Autorización en backend + **RLS** en tablas críticas |
| UI | **Tailwind + shadcn/ui** |
| ORM / migraciones | **Drizzle** (recomendado — ver 2.1) |
| IA / OpenAI | Fuera del MVP, solo roadmap |

### 2.1 Recomendación de ORM: Drizzle

Se recomienda **Drizzle** sobre Prisma para este MVP, por tres razones concretas:

1. **SQL-first:** el proyecto necesita features específicas de Postgres (exclusion constraint con `tstzrange`/`btree_gist`, políticas RLS). Drizzle es cercano a SQL y facilita expresarlas; las migraciones conviven naturalmente con SQL raw.
2. **Serverless/Vercel:** Drizzle es liviano y arranca rápido en funciones serverless, sin el overhead del engine de Prisma.
3. **Tipado:** inferencia de tipos excelente en TypeScript.

**Prisma es aceptable** si el equipo prefiere su DX; en ese caso, las restricciones específicas de Postgres (exclusion constraint, RLS) igualmente se implementan vía **migración SQL raw**. La decisión no bloquea nada del modelo; solo cambia la herramienta.

---

## 3. Personas y roles

| Persona | Descripción | Dispositivo |
|---|---|---|
| **Admin / Dueño** | Ve todo el negocio y todas las sucursales. Único con acceso a legajos, audit log y configuración. | Escritorio + móvil |
| **Recepcionista** | Gestiona agenda, clientes, turnos y caja de su sucursal. | Tablet / escritorio |
| **Barbero** | Atiende clientes; gestiona sus turnos y ve sus métricas. | Móvil / tablet |

### Matriz de permisos (RBAC)

| Capacidad | Admin | Recepcionista | Barbero |
|---|:---:|:---:|:---:|
| Dashboard global (todas las sucursales) | ✅ | ❌ | ❌ |
| Métricas de su sucursal | ✅ | ✅ | Solo propias |
| CRUD sucursales | ✅ | ❌ | ❌ |
| CRUD usuarios y roles | ✅ | ❌ | ❌ |
| Ver/editar legajo de barbero | ✅ | ❌ | ❌ |
| CRUD servicios y precios | ✅ | ❌ | ❌ |
| Configurar comisiones y settings | ✅ | ❌ | ❌ |
| CRUD clientes | ✅ | ✅ | ✅ |
| Crear/reprogramar/cancelar turnos | ✅ | ✅ | Solo propios |
| Marcar completado / no-show | ✅ | ✅ | ✅ (propios) |
| Registrar venta / cobro | ✅ | ✅ | Según `allow_barber_charge` |
| Abrir/cerrar/reconciliar caja | ✅ | ✅ | ❌ |
| Ver audit log y eventos | ✅ | ❌ | ❌ |
| Exportar CSV/Excel | ✅ | Parcial | ❌ |

Scoping: el admin ve todo (sin sucursal asignada). Recepcionista y barbero se vinculan a una o más sucursales vía `user_branches`.

---

## 4. Infraestructura, seguridad y autorización

**Decisión final: Supabase + Vercel.** El MVP se diseña exclusivamente para este camino.

- **Supabase** provee **Postgres, Auth, Storage y RLS**.
- **Vercel** hospeda la webapp **Next.js**.
- **Imágenes y documentos van a Supabase Storage**, nunca a PostgreSQL (en la base solo metadata y ruta — ver `files`).
- **Tablas críticas con RLS:** `sales`, `payments`, `cash_sessions`, `cash_movements`, `commissions`, `appointments`, `clients`, `barber_profiles`, `files`.
- **Además de RLS, el backend valida permisos** (rol + pertenencia a `organization_id`/`branch_id`) en cada endpoint. **No confiar solo en el frontend**: el front oculta acciones, el backend autoriza.

> **Nota de evolución:** VPS + Docker + Postgres propio, o Railway/Fly.io, podrían evaluarse a futuro si los costos crecen o se necesita más control. No es parte del MVP; el diseño backend-first hace que esa migración sea posible sin rehacer la lógica de autorización.

---

## 5. Modelo de datos

PostgreSQL (Supabase). Todas las tablas de negocio incluyen `organization_id`, `created_at`, `updated_at`.

### 5.1 Decisión sobre dinero
**`numeric(12,2)` para todos los montos.** Postgres maneja decimal exacto; simplifica reportes. **Nunca `float`/`double` para dinero.**

### 5.2 Estrategia de borrado (soft delete)
Las entidades **users, branches, services, clients, barber_profiles** no se borran físicamente: usan `active`/`status` + `deleted_at` + `deleted_by`. **Ventas, pagos, caja, comisiones y audit logs no se borran físicamente** en operación normal; las correcciones sensibles se hacen con ajustes (`adjustment`) y quedan en audit log.

### 5.3 Configuración

**organization_settings** — evita hardcodear reglas de negocio. Aunque v1 tenga una sola organización, convierte reglas fijas en configuración futura (clave para SaaS).
- `organization_id`
- `currency` (default `ARS`)
- `default_timezone` (default `America/Argentina/Buenos_Aires`)
- `slot_interval_minutes`
- `default_appointment_buffer_minutes`
- `default_commission_rate` `numeric(5,2)`
- `allow_barber_charge` (bool)
- `allow_anonymous_walkin` (bool)
- `created_at`, `updated_at`

### 5.4 Organización y sucursales

**organizations** — `id`, `name`, `created_at`. (v1: una fila.)

**branches** — `id`, `organization_id`, `name`, `address`, `phone`, `timezone` (puede override del default), `working_hours` (JSON por día), `active`, `deleted_at`, `deleted_by`.

### 5.5 Usuarios y staff

**users** — `id`, `organization_id`, `auth_id` (Supabase Auth), `full_name`, `email`, `role` (`admin`|`receptionist`|`barber`), `status` (`active`|`invited`|`disabled`), `phone`, `deleted_at`, `deleted_by`.

**user_branches** — `user_id`, `branch_id` (N:N).

**barber_profiles (legajo)** — `user_id`, `organization_id`, `address`, `phone`, `emergency_contact_name`, `emergency_contact_phone`, `hire_date`, `relationship_type` (`empleado`|`socio`|`monotributista`|`colaborador`), `commission_rate` `numeric(5,2)`, `medical_cert_expiry` (nullable), `documentation_expiry` (nullable), `internal_notes`, `display_color`, `active`, `deleted_at`, `deleted_by`. **Acceso solo admin.** Documentos vía `files`.

### 5.6 Disponibilidad de barberos

**barber_schedules** (disponibilidad recurrente) — `id`, `organization_id`, `barber_id`, `branch_id`, `weekday` (0–6), `start_time`, `end_time`, `active`, `created_at`, `updated_at`.

**barber_time_off** (excepciones) — `id`, `organization_id`, `barber_id`, `branch_id` (nullable), `start_at`, `end_at`, `reason`, `created_by`, `created_at`.

> Ambas tablas **alimentan la validación de agenda y el control anti doble-reserva** (sección 7).

### 5.7 Servicios

**services** — `id`, `organization_id`, `name`, `duration_minutes`, `price` `numeric(12,2)`, `active`, `deleted_at`, `deleted_by`. (Precio uniforme en MVP — ver decisiones abiertas.)

### 5.8 Clientes

**clients** — `id`, `organization_id`, `first_name`, `last_name`, `whatsapp_raw`, `whatsapp_e164` (nullable), `phone_alt_raw`, `phone_alt_e164` (nullable), `photo_file_id` (nullable → `files`), `notes`, `cut_preferences`, `tags` (array, opcional), `extra_profile` (JSONB, opcional y controlado), `consent_data` (bool + fecha), `consent_whatsapp` (bool + fecha), `active`, `deleted_at`, `deleted_by`, `created_at`.

Reglas de teléfono:
- Se guarda el valor crudo (`*_raw`) y la versión normalizada **E.164** (`*_e164`).
- **País por defecto: Argentina.** El E.164 se usará para integraciones de WhatsApp futuras.
- **Índice único parcial: `(organization_id, whatsapp_e164)` cuando `whatsapp_e164` no sea null.**
- Debe haber **detección de duplicados**, pero sin bloquear casos especiales irresolubles (cliente sin WhatsApp, etc.).

Privacidad: los datos personales extra (trabajo, estudiante, hijos, contexto) son **opcionales, controlados y visibles según permisos**, dentro de `extra_profile`. No guardar datos sensibles innecesarios.

### 5.9 Turnos

**appointments** — `id`, `organization_id`, `branch_id`, `barber_id`, `client_id` (nullable para walk-in anónimo), `created_by_user_id`, `status` (ver 6), `source` (`booked`|`walk_in`), `start_at` (UTC), `end_at` (UTC), `cancel_reason` (nullable), `notes`.

**appointment_services** — `appointment_id`, `service_id`, `price_at_time`, `duration_at_time` (snapshot al momento).

**appointment_history** — reconstruye los cambios del turno sin depender solo del audit log genérico.
- `id`
- `organization_id`
- `appointment_id`
- `action` (`created`|`rescheduled`|`cancelled`|`status_changed`|`barber_changed`)
- `from_status`, `to_status`
- `from_start_at`, `to_start_at`
- `from_end_at`, `to_end_at`
- `from_barber_id`, `to_barber_id`
- `reason`
- `metadata` (JSONB)
- `user_id`
- `created_at`

### 5.10 Ventas y pagos

**sales** — `id`, `organization_id`, `branch_id`, `appointment_id` (nullable), `barber_id`, `client_id` (nullable), `subtotal`, `discount` `numeric(12,2)`, `total`, `status` (ver 6), `created_by`, `paid_at` (nullable). *(El método de pago vive en `payments`, no en `sales`. Propina = campo futuro.)*

**sale_items** — `sale_id`, `service_id`, `description`, `qty`, `unit_price`, `line_total`.

**payments** — se agrega **desde el MVP** para habilitar pago mixto a futuro sin rehacer el modelo.
- `id`
- `organization_id`
- `sale_id`
- `method` (`cash`|`transfer`|`card`|`mercadopago_manual`|`other`)
- `amount` `numeric(12,2)`
- `note`
- `created_by`
- `created_at`

> **En MVP: un solo pago por venta.** En el futuro se habilitan múltiples pagos/pagos parciales por venta (pago mixto) **sin cambiar el modelo**.

### 5.11 Caja

**cash_sessions** — representa el **cierre operativo de una sucursal**. El MVP usa una sesión diaria por sucursal, pero el modelo permite múltiples sesiones futuras (turno mañana/tarde) sin cambios de esquema.
- `id`, `organization_id`, `branch_id`
- `opened_by`, `opened_at`, `opening_amount` (efectivo inicial)
- `closed_by`, `closed_at`
- **Snapshot al cierre (persistido para inmutabilidad):** `expected_cash`, `expected_transfer`, `expected_card`, `expected_mercadopago_manual`, `expected_other`, `expected_total`, `counted_cash` (conteo físico), `cash_difference`
- `status` (`open`|`closed`|`reconciled`)

**cash_movements** — `id`, `cash_session_id`, `type` (`sale`|`income`|`expense`|`withdrawal`|`adjustment`), `amount`, `payment_method`, `reference_sale_id` (nullable), `note`, `created_by`, `created_at`.

**Separación clave (caja física vs métodos de pago):**
- `cash_session` es el cierre operativo; **solo el efectivo se cuenta físicamente** (`counted_cash` vs `expected_cash` → `cash_difference`).
- Transferencia, tarjeta y MercadoPago manual **se registran para conciliación**, pero no son billetes físicos en caja.
- El cierre **debe mostrar el desglose por método de pago** (`expected_*`). Los `expected_*` pueden calcularse desde `payments`/`cash_movements`, pero al cerrar se **persiste el snapshot** para que un cierre histórico no cambie.

### 5.12 Comisiones

**commissions** — `id`, `organization_id`, `barber_id`, `sale_id`, `base_amount`, `rate_snapshot` `numeric(5,2)`, `commission_amount`, `period` (YYYY-MM), `status` (`pending`|`paid`|`cancelled`). (Regla de cálculo en sección 8.)

### 5.13 Archivos

**files** — **no se guardan binarios en PostgreSQL**, solo metadata; los binarios van a **Supabase Storage**.
- `id`, `organization_id`
- `entity_type`, `entity_id`
- `file_category` (`client_photo`|`barber_document`|`medical_certificate`|`contract`|`other`)
- `visibility` (`admin_only`|`staff_related`|`public_profile`)
- `storage_bucket`, `storage_path`, `original_filename`
- `mime_type`, `size_bytes`
- `uploaded_by`, `created_at`

Reglas: **certificados médicos y documentos personales = `admin_only`**. Foto de cliente o de perfil puede tener permisos más abiertos según necesidad.

### 5.14 Auditoría y eventos

**audit_logs** — `id`, `organization_id`, `user_id`, `action`, `entity`, `entity_id`, `diff` (JSON before/after), `created_at`. Cambios de entidades sensibles.

**domain_events** — `id`, `organization_id`, `event_type` (`appointment.created`, `sale.paid`, `cash.closed`, …), `payload` (JSONB), `occurred_at`. Base para **RAG futuro (v1.5)**. En MVP solo se registran.

**system_events** — `id`, `level`, `source`, `message`, `context` (JSONB), `created_at`. Errores técnicos, jobs, integraciones. Solo registrar/consultar en MVP.

---

## 6. Máquinas de estado y reglas

### Turnos
`scheduled → confirmed → in_progress → completed`
`scheduled|confirmed → cancelled` (requiere `cancel_reason`)
`scheduled|confirmed → no_show`

- Un turno **completado no se edita libremente**; toda corrección queda en audit log.
- **No cancelar sin motivo.**
- **No se genera comisión sobre `no_show` ni `cancelled`.**
- Reprogramar o cambiar de barbero genera entrada en `appointment_history`.

### Ventas
- `draft`: venta iniciada pero no confirmada.
- `pending`: confirmada pero no pagada.
- `partially_paid`: **futuro** (múltiples pagos / pagos parciales).
- `paid`: total pagado.
- `cancelled`: anulada antes del pago.
- `refunded / manual_adjustment`: **roadmap**.

La comisión se calcula al pasar a `paid`. Anular/ajustar una venta pagada queda auditado.

### Caja
`open → closed → reconciled`

- **No modificar una caja cerrada** sin un movimiento `adjustment` que quede en audit log.
- Al cerrar se calculan y persisten los `expected_*` y la `cash_difference`.

> Toda corrección sensible (turno completado, venta pagada, caja cerrada) **debe quedar auditada**.

---

## 7. Control anti doble-reserva

- **Validación en backend dentro de una transacción** al crear/reprogramar/cambiar de barbero.
- **Exclusion constraint en PostgreSQL** sobre `(barber_id, tstzrange(start_at, end_at))` con `btree_gist`, **aplicado solo a turnos activos**.
  - **Estados que bloquean disponibilidad:** `scheduled`, `confirmed`, `in_progress`.
  - **Estados que NO bloquean:** `cancelled`, `no_show`, y `completed` (histórico, no debe interferir con nuevas operaciones).
  - Implementación típica: constraint con cláusula `WHERE status IN ('scheduled','confirmed','in_progress')` (exclusion constraint parcial).
- Si el ORM elegido no soporta bien exclusion constraints, **se implementa con migración SQL raw**.
- Debe existir: **validación en backend + constraint en base + tests de solapamiento**.
- Casos borde: mismo barbero/misma sucursal, solapamiento parcial, reprogramación que genera nuevo solapamiento, `barber_time_off`, horario fuera de `barber_schedules` o del `working_hours` de la sucursal.

---

## 8. Regla de comisión (decisión cerrada)

La comisión se calcula sobre el **total neto pagado después de descuentos**.

Ejemplo:
- Subtotal: $10.000
- Descuento: $2.000
- Total pagado: $8.000
- Comisión 25% → **$2.000**

Reglas:
- Comisión **solo sobre ventas `paid`**.
- **Sin comisión** sobre `cancelled`, `no_show` ni ventas anuladas.
- Guardar `rate_snapshot` al momento de la venta.
- Si el barbero **no tiene comisión configurada**: usar `organization_settings.default_commission_rate`; si tampoco hay default, usar **0 y mostrar advertencia**.
- Reporte de comisiones por barbero y período.

---

## 9. Walk-in (decisión cerrada: entra al MVP, simple)

- **Walk-in = cliente que llega sin turno previo.**
- Puede registrarse como **venta rápida** y, opcionalmente, crear un **turno inmediato**.
- El cliente puede ser **anónimo si `organization_settings.allow_anonymous_walkin = true`**.
- Si no es anónimo, se carga **cliente mínimo**: nombre/apellido opcional + WhatsApp/teléfono si existe.
- No se construye flujo avanzado de walk-in; solo lo necesario para **cobrar y asociar al barbero**.

---

## 10. Requerimientos funcionales + Acceptance criteria

Cada módulo define cuándo está **terminado**.

- **Autenticación** — *Terminado cuando:* un usuario `disabled` no puede iniciar sesión; sesiones seguras vía Supabase Auth.
- **Usuarios/staff** — *Terminado cuando:* el admin crea los tres roles y el scoping por sucursal se respeta en backend.
- **Legajo de barbero** — *Terminado cuando:* solo el admin accede, se adjuntan documentos (`files`, `admin_only`) y se registran vencimientos.
- **Sucursales** — *Terminado cuando:* los horarios alimentan la validación de agenda.
- **Servicios** — *Terminado cuando:* la duración define la longitud del turno y el precio alimenta la venta.
- **Clientes** — *Terminado cuando:* se detecta duplicado por `whatsapp_e164`, los teléfonos se normalizan a E.164 y los consentimientos quedan con fecha.
- **Agenda/turnos** — *Terminado cuando:* bloquea doble reserva (backend + constraint + tests), respeta horarios y disponibilidad, permite reprogramar, registra `appointment_history` y genera audit log.
- **Venta manual** — *Terminado cuando:* registra ítems, aplica descuento, calcula total, crea el `payment` y queda asociada a barbero/sucursal/caja.
- **Caja** — *Terminado cuando:* abre, registra ventas y movimientos, calcula los `expected_*` por método, separa efectivo físico de digitales, cierra y deja la `cash_difference` auditada.
- **Comisiones** — *Terminado cuando:* calcula por barbero y período con `rate_snapshot`, sobre ventas `paid`, según la regla de la sección 8, y produce reporte por período.
- **Dashboard admin (básico)** — Ingresos del día/mes por sucursal y global, ventas, estado de caja, comisiones a pagar. *Terminado cuando:* los números cuadran con caja y ventas. *(Ranking/ocupación/tendencias/recurrentes → v1.3.)*
- **Vista barbero** — Su agenda + métricas básicas (cortes, ingresos generados, comisión acumulada).
- **Vista recepcionista** — Agenda de la sucursal + acciones rápidas (agendar, reprogramar, registrar cliente, cobrar) + estado de caja.
- **Audit log y eventos** — *Terminado cuando:* cambios sensibles en `audit_logs`, eventos de negocio en `domain_events`, técnicos en `system_events`, todos consultables/exportables.
- **Exportación CSV/Excel** — Ventas, comisiones, caja y clientes.
- **Modo demo/seed** — Ver sección 12.

---

## 11. Casos borde a contemplar

Turno que termina **después del cierre** de caja · servicio con **duración irregular** · barbero en **más de una sucursal** · venta con **descuento** · **pago mixto** (futuro, el modelo no debe impedirlo) · **caja cerrada** + corrección posterior (vía `adjustment` + audit) · **cliente duplicado** · **cliente sin WhatsApp** · **barbero sin comisión configurada** (default global → 0 + advertencia) · **reprogramación de turno confirmado** · **cancelación con motivo** · **no-show** (sin comisión) · **usuario deshabilitado**.

---

## 12. Modo demo / seed data

Script de seed: 1 organización, `organization_settings`, varias sucursales, barberos y recepcionistas, clientes, servicios, `barber_schedules`, turnos en distintos estados, ventas con sus `payments` por distintos métodos, y sesiones de caja (abierta y cerrada). Permite probar dashboards, roles y flujos end-to-end sin cargar datos a mano.

---

## 13. Fases internas de implementación del MVP

En una futura implementación, **construir una fase por vez y validar antes de avanzar** (no hacer todo de una).

**Fase 0 — Fundación:** proyecto, stack, Supabase, config de Vercel, auth, roles, layout base, modelo base, seed inicial.

**Fase 1 — Agenda:** sucursales, usuarios/staff, servicios, clientes, barberos, `barber_schedules`/`barber_time_off`, turnos, anti doble-reserva, historial de reprogramación.

**Fase 2 — Dinero:** ventas, `payments` manuales, caja, movimientos, cierre de caja, comisiones.

**Fase 3 — Paneles y control:** dashboard admin básico, vista recepcionista, vista barbero, export CSV/Excel, audit log visible, `domain_events`/`system_events` consultables.

---

## 14. Requerimientos no funcionales

- **Seguridad:** autorización backend-first + RLS en tablas críticas; contraseñas gestionadas por Supabase Auth; HTTPS; secretos en variables de entorno.
- **Dinero:** `numeric(12,2)`, nunca float.
- **Zona horaria:** almacenar UTC, mostrar local por sucursal (default `America/Argentina/Buenos_Aires`). Sin DST.
- **Mobile-first:** web responsive/PWA; sin app nativa.
- **Archivos:** binarios en Supabase Storage; en base solo metadata.
- **Backups:** respaldo diario (incluido en Supabase Pro; verificar retención).
- **Privacidad:** Ley 25.326 (Argentina) — consentimiento, minimización, derecho de acceso/borrado. No es asesoramiento legal; conviene revisión profesional para el contrato con el cliente.

---

## 15. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Lógica de agenda mal resuelta | Motor anti-doble-reserva primero: exclusion constraint parcial + validación backend + tests |
| Números de caja que no cuadran | Movimientos atómicos, snapshot de `expected_*` al cierre, diferencia auditada |
| Redondeo de dinero | `numeric(12,2)`, nunca float |
| Costos variables (egress/compute Supabase/Vercel) | Monitoreo semanal, topes de gasto; opción de migrar a VPS/Railway si escala |
| Datos personales mal manejados | Autorización backend + RLS, consentimientos con fecha, minimización, `admin_only` en documentos |
| Desconfianza entre sucursales | Audit log + domain events desde el día uno |
| Alcance que se infla | Regla de los 4 trabajos |

---

## 16. Roadmap

**v1.1** — WhatsApp con plantillas aprobadas; recordatorios; registro de notificaciones; **importación CSV/Excel** (desde Google Sheets/Excel/papel digitalizado): clientes, servicios y eventualmente historial.

**v1.2** — MercadoPago real; webhooks; señas/depósitos; conciliación.

**v1.3** — Dashboards avanzados; ranking de barberos; ocupación de agenda; tendencias; clientes recurrentes; promociones por fidelidad.

**v1.4** — IA con OpenAI sobre datos agregados; resúmenes por rol; alertas inteligentes.

**v1.5** — RAG sobre `audit_logs`, `domain_events` y `system_events`; el admin pregunta "¿qué pasó acá?" y la IA responde en base a logs/eventos.

**v2** — SaaS multi-tenant público; superadmin; bloqueo/desbloqueo de organizaciones por falta de pago; planes; facturación manual primero, automática después.

**v2+** — Inventario; gastos avanzados; lista de espera; fidelización avanzada; portal de cliente; usuario final del cliente.

---

## 17. Decisiones abiertas

Resueltas (ya no abiertas): la comisión se calcula sobre **total neto pagado**; el **walk-in entra al MVP en versión simple**.

Siguen abiertas:
- ¿El barbero puede **cobrar** o solo registrar el servicio? (controlado por `allow_barber_charge`)
- ¿Precio de servicios **uniforme o variable por sucursal**? (MVP: uniforme)
- ¿Una **sesión de caja diaria por sucursal** alcanza para v1?
- ¿Qué campos del **legajo del barbero** son obligatorios?
- ¿Qué nivel de **datos extra del cliente** se permite por privacidad?

---

## 18. Checklist — "Listo para implementar"

El PRD queda listo para implementación cuando:

- [x] El alcance MVP **no** incluye IA, Maps, MP real ni WhatsApp automático.
- [x] **Supabase + Vercel** figuran como decisión final.
- [x] El modelo de datos incluye `organization_id` en todas las tablas de negocio.
- [x] **RLS** y **autorización en backend** están definidos.
- [x] La agenda tiene **anti doble-reserva** con constraint + validación + tests.
- [x] La caja **separa efectivo físico** de métodos digitales/manuales.
- [x] Las **comisiones** tienen regla cerrada (total neto pagado).
- [x] Los **clientes** tienen WhatsApp normalizado (E.164).
- [x] Los **archivos** van a Supabase Storage.
- [x] Hay **fases internas** de implementación.
- [x] El **roadmap** está separado del MVP.
- [x] No hay features futuras mezcladas como si fueran parte de v1.
