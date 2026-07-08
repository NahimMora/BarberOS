# Automode Checkpoint — Producción BarberOS

> Estado del automode de 7 fases pedido para llevar BarberOS a
> pre-producción. Se actualiza al cierre de cada fase (o antes, si se corta
> el contexto a mitad de una). No hacer deploy real ni tocar datos
> productivos sin confirmación explícita — ver `AGENTS.md`/`CLAUDE.md`.

## Decisiones de alcance (una sola vez, no repreguntar)

- El usuario confirmó explícitamente hacer las 7 fases en esta misma sesión
  de Claude Code, sin dividir el trabajo de UI/pantallas con otra
  herramienta (aunque `CLAUDE.md` normalmente lo indicaría). No mencionar
  ni sugerir esa división en fases futuras.
- El usuario después pidió explícitamente completar **todas** las fases
  restantes end-to-end sin pausar a pedir aprobación de plan en cada una
  ("toma las decisiones que necesites"). Se sigue documentando cada fase
  acá y commiteando por separado, pero no se vuelve a usar
  EnterPlanMode/ExitPlanMode por fase salvo bloqueo genuino.

## Fase 0 (previa al pedido de hoy) — commit `562ca71`

Trabajo que ya estaba terminado y sin commitear al empezar esta sesión, se
commiteó aparte para no mezclar diffs: void de ventas admin-only, reset de
contraseña (`/recuperar-contrasena`, `/restablecer-contrasena`), `MoneyInput`
+ máscara de miles en `money.ts`, y el resto de la pasada "Soft Studio"
anterior (radios, colores, alturas de 44px en input/select).

## Fase 1 — Primitives visuales + tipografía — COMPLETA — commit `4270505`

- Tipografía global: Plus Jakarta Sans → **Geist** (sans) + **Geist Mono**
  (ya en uso). `src/app/layout.tsx`, `src/app/globals.css`. Criterio
  documentado en `docs/UI_STYLE_GUIDE.md` (Typography).
- `button.tsx`: `size="lg"` / `"icon-lg"` a 44px (antes 36px) para cumplir
  el target táctil propio del style guide.
- `dropdown-menu.tsx`: popups alineados en solidez visual con `Select`
  (`shadow-lg ring-1 ring-foreground/12`).
- **Pendiente real, no bloqueante:** QA visual manual en navegador — la
  extensión de Chrome no estaba conectada en esta sesión. Si se conecta,
  recorrer Login/Operación/Agenda/Caja/Comisiones a 375/768/desktop.

## Fase 2 — Operación — COMPLETA — commit `ae7d088`

- **Equipo:** `StaffDialog` + `ProfileDialog` (legajo) fusionados en un solo
  diálogo de perfil por persona (secciones datos básicos/rol/sucursales y,
  si es barbero, legajo+comisión). Filtro por rol (Todos/Barberos/
  Recepción/Admins). "Deshabilitar" ahora pide confirmación en un `Dialog`.
- **Disponibilidad:** reemplazado el formulario+lista plana global por un
  editor semanal por barbero (elegís barbero+sucursal, ves los 7 días con
  sus rangos como chips, agregás/quitás/copiás un rango a otros días).
  Nuevo `src/lib/staff/schedule-summary.ts` (`summarizeSchedule`,
  `rangesOverlap`) con tests. `POST /api/barber-schedules` ahora rechaza
  solapamientos (409) en vez de solo duplicados exactos.
- Ausencias filtradas por el barbero seleccionado.

## Fase 3 — Agenda + Cobro — COMPLETA — commit `6e45e91`

- Agenda carga `/api/services` + `/api/agenda-context` al montar (no solo
  al abrir un diálogo), habilitando columna/filtro de barbero (punto de
  color de `displayColor` + nombre) en tabla desktop y cards mobile.
- Badges de estado con ícono propio por estado (antes `confirmed`/
  `in_progress` y `completed`/`no_show` compartían variant y eran casi
  indistinguibles).
- "Cobrar turno" ahora hace `GET /api/appointments/[id]` al abrir para
  mostrar el desglose real de servicios/precio, usa `MoneyInput` para el
  descuento, y agrega "Referencia del pago" (mismo patrón que Caja) —
  wireado a `paymentNote`, que el backend ya aceptaba pero la UI nunca
  mandaba.
- Nuevo test de integración: `sales_appointment_id_idx` rechaza cobrar dos
  veces el mismo turno (gap real que no tenía cobertura).

## Fase 4 — Caja como control financiero — COMPLETA — commit `459b6cb`

- Reordenada la jerarquía: "Control de efectivo" (esperado/movimientos/
  cerrar) pasa a ser la columna dominante y la primera en mobile; la venta
  manual deja de competir visualmente.
- "Cobro manual" renombrado a **"Venta rápida (sin turno)"**, colapsado por
  defecto detrás de un botón, con copy explicando que cobrar un turno
  agendado se hace desde Agenda. Se eliminó el selector de turno y todo el
  fetch de `appointments`/`sales` que solo alimentaba eso (dead code).
- Grid de tarjetas de dinero: salto brusco 2→5 columnas corregido
  (`grid-cols-2 md:grid-cols-3` dentro de la tarjeta de efectivo). Se quitó
  el tile duplicado "Efectivo esperado" del listado superior (ahora vive
  una sola vez, en la tarjeta de Control de efectivo).
- `MoneyInput` adoptado en: efectivo inicial, descuento de venta rápida,
  importe de movimiento, efectivo contado, importe de ajuste (con
  `allowNegative`).
- Anulación de ventas (`VoidSalePanel`), cierres recientes y ajuste de caja
  cerrada quedaron sin cambios funcionales (ya cumplían lo pedido).

## Fase 5 — Comisiones, Control, Exportaciones — EN PROGRESO

Todavía no implementada al momento de este checkpoint. Alcance según el
pedido original:
- **Comisiones:** agregar hora, servicio/corte, cliente y contexto de venta
  al detalle (hoy es una lista de registros repetidos sin contexto). Si el
  backend no trae `sale_items`/`services`/`clients`, ajustar query y tests.
  Mantener confirmación antes de liquidar (ya existe, no tocar esa regla).
- **Control:** aclarar propósito con copy, filtros útiles; no convertirlo
  en pantalla técnica inútil.
- **Exportaciones:** presets de período (Hoy/Esta semana/Este mes/Mes
  anterior/Rango personalizado), explicar qué exporta cada opción, tests de
  contenido/bordes de mes, evitar JSON crudo en errores.

**Próximo paso exacto para retomar si se corta acá:** leer
`src/app/(app)/comisiones/commissions-report.tsx`,
`src/app/(app)/control/control-center.tsx`,
`src/app/(app)/exportaciones/export-center.tsx` y las rutas API
correspondientes (`/api/commissions`, `/api/control-events`,
`/api/exports/[resource]`), implementar, correr
`tsc`/`lint`/`test`/`build`, commitear, y seguir con Fase 6.

## Fases pendientes (no empezadas)

- **Fase 6 — Producción técnica:** investigar documentación oficial de
  Railway, Render, Supabase, Cloudflare R2 y Cloudflare DNS antes de tocar
  nada; `.env.example`, `docs/DEPLOYMENT.md`, health endpoint, CI en GitHub
  Actions, revisar versiones raras (`eslint-config-next@^16` con
  `next@15.5.19`, `lucide-react@^1.17.0` — versionado atípico, confirmar
  que no sea un typo/paquete equivocado antes de tocarlo), arreglar el
  warning de "multiple lockfiles" (ver Notas técnicas abajo).
- **Fase 7 — QA final y documentación:** RUNBOOK, checklist manual final,
  resumen entregable con instrucciones de deploy Railway/Render.

## Notas técnicas sueltas (no bloqueantes, revisar en Fase 6)

- Warning de build/dev: "Next.js inferred your workspace root... detected
  multiple lockfiles" — hay un `package-lock.json` en
  `C:\Users\pc10\Desktop` (proyecto TO.NEWS, no relacionado) que Next.js
  detecta como posible root. Se resuelve con `outputFileTracingRoot` /
  `turbopack.root` en `next.config.ts`.
- Puerto 3000 en este entorno suele estar ocupado por TO.NEWS; el dev
  server de BarberOS cae a otro puerto automáticamente.
- Botones de acción primaria en pantallas ya tocadas (Operación, Agenda,
  Caja) no se migraron sistemáticamente a `size="lg"` (44px) — quedó como
  ajuste fino pendiente, no bloqueante, si se hace una pasada visual final
  en Fase 7.
