# Usuarios — BarberOS

## Roles (los únicos que existen hoy — no hay usuario "cliente final")

| Persona | Qué hace | Dispositivo típico | Alcance |
|---|---|---|---|
| **Admin / Dueño** | Ve y configura todo el negocio: todas las sucursales, legajos de staff, comisión default, audit log y eventos. Único rol sin sucursal fija asignada. | Escritorio + móvil | Todas las sucursales de la organización |
| **Recepcionista** | Agenda turnos, gestiona clientes, cobra, abre/cierra caja de su sucursal. | Tablet / escritorio | Sucursal(es) asignadas vía `user_branches` |
| **Barbero** | Atiende sus turnos, cobra si `organization_settings.allow_barber_charge` lo permite, ve sus propias métricas y comisión. | Móvil / tablet | Solo sus propios turnos/datos |

## Matriz de permisos (RBAC)

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
| Anular venta | ✅ | ❌ | ❌ |
| Ver audit log y eventos | ✅ | ❌ | ❌ |
| Exportar CSV/Excel | ✅ | Parcial | ❌ |

La autorización real vive en el **backend** (`getSession()` +
`requireRole()` + filtro por `organization_id`/`branch_id` en cada query),
nunca solo en la UI. RLS en Postgres es un backstop, no la defensa
primaria — ver `docs/DECISIONS.md`.

## Quién NO es usuario del sistema (todavía)

El cliente de la barbería (quien se corta el pelo) **no tiene login ni
portal**. Existe como registro (`clients`) que el staff carga y consulta,
con datos pensados para eventualmente habilitar WhatsApp o reservas
propias (roadmap v1.1+), pero hoy es puramente un dato interno del
negocio, no un usuario del sistema.
