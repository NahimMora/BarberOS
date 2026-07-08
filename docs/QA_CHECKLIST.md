# Checklist manual final — BarberOS

> Ninguno de estos ítems se pudo correr en navegador real durante esta
> sesión (la extensión de Chrome no estaba conectada). `tsc`/`lint`/
> `test`/`build` sí están verificados y en verde en cada fase — esto cubre
> lo que esos comandos no pueden ver: que la UI real se sienta bien y
> funcione en un navegador. Recorrer esta lista antes de dar el ciclo por
> cerrado.

## Cómo correrlo

```bash
npm run dev
```

Credenciales demo (`README.md`): `admin@demo.com` / `recep@demo.com` /
`barbero@demo.com`, contraseña `demo1234` para las tres.

Probar cada bloque en **375px** (mobile), **768px** (tablet) y desktop.

## Login y acceso

- [ ] Login con las 3 credenciales demo, cada una cae en la vista que le
  corresponde por rol.
- [ ] `/recuperar-contrasena` → llega el mail (o revisar logs de Supabase
  Auth si el proyecto no tiene SMTP real configurado) → el link vuelve a
  `/restablecer-contrasena` → la contraseña nueva funciona para loguearse.
- [ ] Un rol sin acceso a una ruta protegida (ej. barbero a `/operacion`)
  no puede entrar.

## Operación

- [ ] Tab Equipo: filtro Todos/Barberos/Recepción/Admins funciona.
- [ ] Crear un barbero nuevo, confirmar que el diálogo pide legajo+comisión
  y que después de guardar aparece en la lista con el rol correcto.
- [ ] Editar un barbero existente: los campos de legajo llegan
  pre-cargados (no vacíos) al abrir el diálogo.
- [ ] "Deshabilitar" pide confirmación antes de ejecutar.
- [ ] Tab Disponibilidad: elegir un barbero con 0 horarios, agregar un
  rango en Lunes, confirmar que aparece como chip en esa fila.
- [ ] Agregar un segundo rango que se superponga al primero → la API debe
  rechazarlo (409, mensaje legible, no un error crudo).
- [ ] "Copiar a otros días" desde un rango ya cargado, tildar 2-3 días,
  confirmar que se replican.
- [ ] El resumen ("Resumen: Lun–Vie 09:00–19:00 · Sáb...") se actualiza
  después de cada cambio.
- [ ] Ausencias: registrar una, confirmar que la lista de abajo queda
  filtrada al barbero seleccionado arriba.

## Agenda

- [ ] Con turnos de 2+ barberos el mismo día: la columna de barbero (punto
  de color + nombre) hace evidente de quién es cada fila, y el filtro por
  barbero funciona.
- [ ] Crear un turno nuevo (con cliente y como walk-in), confirma horarios
  disponibles según el barbero/servicio elegido.
- [ ] Flujo completo: Confirmar → Iniciar → Completar → Cobrar sobre el
  mismo turno, verificando que cada botón solo aparece en el estado que
  corresponde.
- [ ] Badges de estado: confirmado y en curso se distinguen a simple
  vista (no solo por el texto), igual completado vs no-show.
- [ ] Al cobrar: aparece el desglose real de servicio/precio (no el texto
  genérico), el descuento formatea miles al escribir, y el campo
  "Referencia del pago" existe y viaja al backend.
- [ ] Reprogramar y Cancelar (con motivo obligatorio) funcionan.

## Caja

- [ ] Abrir caja con efectivo inicial (el input formatea miles).
- [ ] Las tarjetas de dinero no se rompen ni dejan espacios raros en
  375px/768px (antes tenían un salto brusco de 2 a 5 columnas).
- [ ] "Venta rápida (sin turno)" aparece colapsada por defecto; al
  expandirla, cobrar una venta manual funciona igual que antes.
- [ ] Registrar un movimiento (ingreso/gasto/retiro) y verlo aparecer en
  "Últimos movimientos" sin que la sección quede con espacio en blanco de
  más.
- [ ] Cerrar caja con una diferencia (contado ≠ esperado) — no debe
  bloquear el cierre.
- [ ] Como admin: anular una venta `paid`, confirmar el motivo, ver el
  movimiento de reversa, y confirmar que no se puede volver a anular.
- [ ] Intentar anular una venta cuya comisión ya esté liquidada → debe
  rechazarse con mensaje legible.
- [ ] "Ajustar" sobre una caja ya cerrada dejando el snapshot histórico
  intacto (comparar antes/después).

## Clientes

- [ ] Alta, edición y búsqueda de cliente funcionan sin regresiones.

## Comisiones

- [ ] El detalle por venta muestra hora, servicio, cliente y sucursal (no
  solo fecha/base/tasa/comisión).
- [ ] Liquidar un período pide confirmación explícita antes de marcar como
  pagado.

## Control

- [ ] Cambiar entre tabs Auditoría/Negocio/Sistema actualiza la
  descripción de qué es cada uno (no queda un texto genérico fijo).
- [ ] Buscar por texto y, en Sistema, filtrar por nivel.

## Exportaciones

- [ ] Cada preset (Hoy, Esta semana, Este mes, Mes anterior, Rango
  personalizado) descarga un archivo con datos del período correcto — no
  solo cambia el badge visual.
- [ ] Comisiones queda visualmente deshabilitado con una explicación
  cuando el preset activo es Hoy/Esta semana/Rango personalizado.
- [ ] Forzar un error (ej. rango con "hasta" antes que "desde") muestra un
  toast, no navega a una página de JSON crudo.
- [ ] La descarga en Excel abre correctamente en una planilla real.

## General

- [ ] Sin errores en la consola del navegador en ninguna de las pantallas
  de arriba.
- [ ] Navegación por teclado funciona en los diálogos nuevos (perfil de
  staff, agregar rango, copiar horario, cobro de turno).
