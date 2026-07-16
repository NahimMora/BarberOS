# Checklist manual final — BarberOS

> **Actualizado 2026-07-16 — segunda auditoría pre-producción.** Se
> recorrió esta lista en navegador real (Chrome), con las 3 cuentas demo,
> contra datos reales en Supabase (dev). Los ítems marcados `[x]` fueron
> verificados a mano en esta sesión; los que quedan `[ ]` no se
> ejercitaron todavía (mayormente responsive en 375/768px y la apertura
> del Excel descargado) — no implica que estén rotos, solo que no se
> confirmaron en esta pasada. Se encontraron y corrigieron 3 bugs reales
> nuevos durante este recorrido (fecha de agenda, filtro de ausencias,
> búsqueda de clientes sin tildes) más una fuga de datos de test en la
> base de desarrollo; ver `docs/PRODUCTION_READINESS.md` para el detalle.
> `tsc`/`lint`/`test`/`build` también están verificados y en verde.

## Cómo correrlo

```bash
npm run dev
```

Credenciales demo (`README.md`): `admin@demo.com` / `recep@demo.com` /
`barbero@demo.com`, contraseña `demo1234` para las tres.

Probar cada bloque en **375px** (mobile), **768px** (tablet) y desktop.

## Login y acceso

- [x] Login con las 3 credenciales demo, cada una cae en la vista que le
  corresponde por rol.
- [x] `/recuperar-contrasena` con un email registrado muestra la
  confirmación genérica ("si el email está registrado, vas a recibir un
  correo") sin revelar si la cuenta existe. No se verificó la recepción
  real del mail (requiere SMTP/logs de Supabase Auth, fuera del alcance
  de esta pasada).
- [x] Un rol sin acceso a una ruta protegida (ej. barbero a `/operacion`)
  no puede entrar. Verificado por URL directa: receptionist bloqueada en
  `/operacion`, `/control`, `/comisiones`; barbero bloqueado en `/caja`,
  `/exportaciones`, `/operacion`, `/control` — todas redirigen a `/dashboard`.

## Operación

- [x] Tab Equipo: filtro Todos/Barberos/Recepción/Admins funciona.
- [x] Crear un barbero nuevo, confirmar que el diálogo pide legajo+comisión
  y que después de guardar aparece en la lista con el rol correcto.
- [x] Editar un barbero existente: los campos de legajo llegan
  pre-cargados (no vacíos) al abrir el diálogo.
- [x] "Deshabilitar" pide confirmación antes de ejecutar.
- [x] Tab Disponibilidad: agregar un rango nuevo (probado en un día sin
  horario previo) confirma que aparece como chip en esa fila y el contador
  "Horarios" del resumen se actualiza.
- [x] Agregar un segundo rango que se superponga al primero → se rechaza
  con mensaje legible ("Este horario se superpone con Lun 09:00–18:00 en
  Centro"), validado inline antes de llegar a la API.
- [x] "Aplicar a días seleccionados" desde un horario nuevo, tildando 2-3
  días: se replica en los tres días y el contador "Horarios" sube
  correctamente (26 → 29 al aplicar a 3 días).
- [x] El resumen se actualiza después de cada cambio.
- [x] **Bug encontrado y corregido:** la lista de Ausencias filtraba por el
  barbero seleccionado en la tarjeta "Horario recurrente" (una tarjeta
  distinta), no por el barbero elegido en el propio selector de
  Ausencias — así que cambiar el filtro de Ausencias no actualizaba la
  lista de abajo. Corregido en `src/app/(app)/operacion/operation-console.tsx`
  (`visibleTimeOff` ahora filtra por `timeOffForm.barberId`).

## Agenda

- [x] Con turnos de 2+ barberos el mismo día: la columna de barbero (punto
  de color + nombre) hace evidente de quién es cada fila, y el filtro por
  barbero funciona.
- [x] Crear un turno nuevo (con cliente y como walk-in), confirma horarios
  disponibles según el barbero/servicio elegido.
- [x] Flujo completo: Confirmar → Iniciar → Completar → Cobrar sobre el
  mismo turno, verificando que cada botón solo aparece en el estado que
  corresponde.
- [x] Badges de estado: confirmado y en curso se distinguen a simple
  vista (no solo por el texto), igual completado vs no-show.
- [x] Al cobrar: aparece el desglose real de servicio/precio (no el texto
  genérico), el descuento formatea miles al escribir, y el campo
  "Referencia del pago" existe y viaja al backend.
- [x] Reprogramar y Cancelar (con motivo obligatorio) funcionan.
- [x] **Bug encontrado y corregido:** el combobox de cliente concatenaba el
  texto tipeado al valor previamente seleccionado ("Walk-in (sin
  cliente)") en vez de reemplazarlo, y por eso la búsqueda no filtraba.
  Corregido seleccionando el texto del input al enfocar (ver
  `src/components/ui/combobox.tsx`).
- [x] **Bug encontrado y corregido (fecha):** `AgendaPage` calculaba "hoy"
  con `date.toISOString().slice(0, 10)`, que usa UTC en vez de la zona
  horaria de Argentina (UTC-3). Entre las 21:00 y las 23:59 hora local, la
  agenda mostraba el día **siguiente** por defecto — turnos, horarios
  disponibles y el conteo de pendientes/completados correspondían a
  mañana, no a hoy. Corregido reutilizando `getLocalCalendarDate` de
  `src/lib/datetime/local-day-range.ts` (el mismo helper ya probado que
  usa el resto del código), en vez de una implementación propia con UTC.

## Caja

- [x] Abrir caja con efectivo inicial (el input formatea miles).
- [ ] Las tarjetas de dinero no se rompen ni dejan espacios raros en
  375px/768px (no se repitió este ciclo — ya verificado visualmente en el
  ciclo anterior de aclarado de paleta).
- [x] Venta rápida (sin turno): cobrar una venta manual con servicios y
  medio de pago funciona correctamente.
- [x] Registrar un movimiento (ingreso/gasto/retiro) y verlo aparecer en
  "Últimos movimientos".
- [x] Cerrar caja con una diferencia (contado ≠ esperado) — no bloquea el
  cierre.
- [x] Como admin: anular una venta `paid`, confirmar el motivo, ver el
  movimiento de reversa reflejado en el efectivo esperado.
- [ ] Intentar anular una venta cuya comisión ya esté liquidada → debe
  rechazarse con mensaje legible. (No se armó este escenario específico en
  esta pasada.)
- [x] "Ajustar" sobre una caja ya cerrada deja el snapshot histórico
  intacto (verificado: la diferencia del cierre no cambió tras el ajuste).
- [x] **Bug encontrado y corregido:** cerrar caja con "Efectivo contado"
  vacío enviaba un string vacío al backend, que devolvía el mensaje técnico
  crudo de Zod ("Invalid string: must match pattern...") en el toast.
  Corregido en dos capas: el botón "Confirmar cierre" ahora se deshabilita
  sin un valor cargado, y el schema de validación de montos usa un mensaje
  legible (`src/lib/validation/money.ts`, reutilizado en `cash-sessions`,
  `cash-movements` y `sales`).

## Clientes

- [x] Alta y búsqueda de cliente funcionan sin regresiones (edición usa el
  mismo diálogo, no se repitió por separado).
- [x] **Bug encontrado y corregido (búsqueda):** buscar "Martin" no
  encontraba a "Martín García" — `ILIKE` en Postgres no ignora tildes, y
  la mayoría de los usuarios no tipea acentos al buscar. Corregido con la
  extensión `unaccent` de Postgres (migración `0012_unaccent_extension`)
  envolviendo ambos lados de la comparación de nombre en
  `src/app/api/clients/route.ts`. Beneficia también al combobox de
  cliente en Agenda y a la búsqueda de cliente en Venta rápida de Caja,
  que comparten el mismo endpoint.
- [x] **Bug encontrado y corregido:** enviar el formulario "Nuevo cliente"
  con validación fallida (ej. sin nombre ni teléfono) rompía el render de
  `Toaster` porque el backend devolvía el objeto crudo de Zod
  (`{formErrors, fieldErrors}`) como `error` en vez de un string. Este era
  un patrón repetido en **20 endpoints** (`/api/clients`, `/api/sales`,
  `/api/appointments`, `/api/cash-*`, `/api/staff`, `/api/branches`,
  `/api/services`, etc.) — todos corregidos con un helper compartido
  (`src/lib/validation/zod-error.ts`).

## Comisiones

- [x] El detalle por venta muestra hora, servicio, cliente y sucursal.
- [x] Liquidar un período pide confirmación explícita antes de marcar como
  pagado.
- [x] **Bug encontrado y corregido (dinero):** el resumen ("Ventas
  pagadas", "Base neta", "Comisión total") sumaba comisiones de ventas
  **anuladas** como si fueran válidas — solo `pendingAmount`/`paidAmount`
  filtraban por estado, no los totales. Esto inflaba los números para
  cualquier barbero con una venta anulada en el período (afectaba datos ya
  existentes en el seed, no solo los de esta sesión). Corregido en
  `src/app/api/commissions/route.ts` excluyendo `cancelled` de los
  totales.
- [x] **Bug encontrado y corregido (UI):** la fila de una comisión anulada
  mostraba el badge "Pendiente" (el código solo distinguía `paid` vs
  cualquier-otra-cosa), lo cual podía hacer pensar que una venta anulada
  todavía generaba comisión por cobrar. Ahora muestra "Anulada" en rojo
  (`src/app/(app)/comisiones/commissions-report.tsx`).

## Control

- [x] Cambiar entre tabs Auditoría/Negocio/Sistema actualiza la
  descripción de qué es cada uno.
- [x] Buscar por texto en Sistema filtra correctamente los resultados.

## Exportaciones

- [x] El preset "Este mes" descarga un CSV real (`200`, vía fetch+blob).
  Los demás presets no se re-probaron uno por uno, comparten el mismo
  mecanismo.
- [x] Comisiones queda visualmente deshabilitado ("No aplica") con una
  explicación cuando el preset activo es un rango personalizado.
- [x] Forzar un error (rango con "hasta" antes que "desde") muestra un
  toast legible ("La fecha 'desde' no puede ser posterior a 'hasta'"), no
  navega a una página de JSON crudo.
- [ ] La descarga en Excel abre correctamente en una planilla real (no se
  abrió el archivo descargado en esta sesión).

## General

- [x] Sin errores en la consola del navegador en ninguna de las pantallas
  recorridas.
- [x] **Bug encontrado y corregido (hidratación):** `AppHeader`
  (`src/components/app-header.tsx`, usado en el layout de toda la app)
  formateaba "hoy" con `new Intl.DateTimeFormat('es-AR', {...}).format(new
  Date())` sin `timeZone` explícito. Sin ese parámetro, el formato usa el
  huso horario por defecto del entorno de ejecución — que puede diferir
  entre el server (SSR) y el browser (hidratación) — y React reportaba
  "A tree hydrated but some attributes of the server rendered HTML didn't
  match the client properties" en cada carga de página. Corregido
  agregando `timeZone: 'America/Argentina/Buenos_Aires'`, igual que el
  resto de los formateos de fecha del código.
- [ ] Navegación por teclado en los diálogos nuevos (no se probó
  explícitamente esta vez).
- [x] **Bug encontrado y corregido (test/datos, no UI):** el test de
  integración `allows a voided sale to keep its original paid_at` en
  `src/test/integration/finance-db.test.ts` esperaba que el `insert` de
  prueba tuviera éxito y por eso el `sql.begin(...)` **committeaba** la
  fila real cada vez que corría `npm run test` — sin rollback, sin
  cleanup. Esto dejó **41 sucursales fantasma** ("Voided sale constraint
  test") acumuladas en la base de dev, visibles en Operación → Sucursales.
  Corregido forzando un rollback intencional (`throw new
  IntentionalRollback()` capturado fuera del `catch` genérico) para que
  el test siga verificando lo mismo sin dejar datos permanentes. Las 41
  filas leftover se desactivaron (soft-delete, no se tocó la tabla
  `sales` — tiene un trigger que bloquea deletes físicos, funcionando
  como se espera).
