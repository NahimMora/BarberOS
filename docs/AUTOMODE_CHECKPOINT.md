# Automode Checkpoint — Producción BarberOS

> Estado del automode de 7 fases pedido para llevar BarberOS a
> pre-producción. Se actualiza al cierre de cada fase (o antes, si se corta
> el contexto a mitad de una). No hacer deploy real ni tocar datos
> productivos sin confirmación explícita — ver `AGENTS.md`/`CLAUDE.md`.

## Decisión de alcance (una sola vez, no repreguntar)

El usuario confirmó explícitamente hacer las 7 fases en esta misma sesión de
Claude Code, sin dividir el trabajo de UI/pantallas con otra herramienta
(aunque `CLAUDE.md` normalmente lo indicaría). No mencionar ni sugerir esa
división en fases futuras.

## Fase 0 (previa al pedido de hoy) — commit `562ca71`

Trabajo que ya estaba terminado y sin commitear al empezar esta sesión, se
commiteó aparte para no mezclar diffs: void de ventas admin-only, reset de
contraseña (`/recuperar-contrasena`, `/restablecer-contrasena`), `MoneyInput`
+ máscara de miles en `money.ts`, y el resto de la pasada "Soft Studio"
anterior (radios, colores, alturas de 44px en input/select).

## Fase 1 — Primitives visuales + tipografía — COMPLETA (sin commitear aún)

Qué se hizo:

- Tipografía global: `Plus Jakarta Sans` → **Geist** (sans), manteniendo
  **Geist Mono** para dinero/timestamps. `src/app/layout.tsx`,
  `src/app/globals.css` (`--font-sans`/`--font-heading`). Decisión y
  criterio documentados en `docs/UI_STYLE_GUIDE.md` (sección Typography).
- `src/components/ui/button.tsx`: `size="lg"` e `"icon-lg"` subidos de
  36px/36px a **44px** (`h-11`/`size-11`) para cumplir el target táctil de
  "acciones primarias de formulario" que el propio style guide exige. No
  había usos de `size="lg"` en el código, así que no rompe nada existente;
  queda pendiente **migrar los botones de acción primaria de cada pantalla a
  `size="lg"`** a medida que se toquen esas pantallas en fases siguientes
  (Fase 2-5), no se hizo un barrido global todavía.
- `src/components/ui/dropdown-menu.tsx`: contenido y sub-contenido del menú
  alineados al mismo tratamiento visual que `SelectContent`
  (`shadow-lg ring-1 ring-foreground/12` en vez de `shadow-md`/`ring/10`),
  para que todos los popups floten con la misma solidez.

Checks corridos y en verde: `npx tsc --noEmit`, `npm run lint`,
`npm run build`, `npm run test` (96/96).

**Pendiente real de Fase 1: QA visual manual en navegador.** El QA
automatizado con `claude-in-chrome` no se pudo correr — la extensión de
Chrome no estaba conectada en esta sesión ("Browser extension is not
connected"). El dev server quedó corriendo en `http://localhost:3004`
(puerto 3000 estaba ocupado por otro proyecto del usuario, TO.NEWS). Falta
recorrer Login, Operación, Agenda, Caja y Comisiones a 375px/768px/desktop
para confirmar que Geist no rompe truncados/alturas y que los popups se ven
consistentes, antes de dar Fase 1 por 100% cerrada.

**Próximo comando exacto para retomar:** conectar la extensión de Chrome
(`https://claude.ai/chrome`, misma cuenta que Claude Code) y pedir "hacé el
QA visual de Fase 1 en localhost:3004 (o el puerto que esté libre) y
commiteá Fase 1" — o si el usuario ya lo revisó a mano, pedir directamente
"commiteá Fase 1 y seguí con Fase 2".

## Fases pendientes (no empezadas)

- **Fase 2 — Operación:** rediseño de Equipo (separar admin/recepción/
  barberos, perfil unificado con legajo) y Disponibilidad (por barbero,
  múltiples días/rangos, copiar horario, resumen humano).
- **Fase 3 — Agenda + Cobro:** vista por hora/barbero/estado, flujo
  crear→atender→completar→cobrar, comprobante/referencia y `MoneyInput` en
  el cobro de turno.
- **Fase 4 — Caja como control financiero:** reordenar jerarquía visual,
  arreglar responsive de tarjetas de dinero, minimizar cobro manual como
  "venta rápida/sin turno".
- **Fase 5 — Comisiones/Control/Exportaciones:** contexto de venta en el
  detalle de comisiones, propósito/copy claro en Control, presets de
  período + tests de bordes de mes en Exportaciones.
- **Fase 6 — Producción técnica:** investigar documentación oficial de
  Railway, Render, Supabase, Cloudflare R2 y Cloudflare DNS antes de tocar
  nada; `.env.example`, `docs/DEPLOYMENT.md`, health endpoint, CI en GitHub
  Actions, revisar versiones raras (`eslint-config-next@^16` con
  `next@15.5.19`, `lucide-react@^1.17.0` — versionado atípico, confirmar que
  no sea un typo/paquete equivocado antes de tocarlo).
- **Fase 7 — QA final y documentación:** RUNBOOK, checklist manual final,
  resumen entregable con instrucciones de deploy Railway/Render.

Cada fase se planifica con Plan Mode y espera aprobación antes de escribir
código, por regla explícita de `CLAUDE.md`/`AGENTS.md`.

## Notas técnicas sueltas (no bloqueantes, revisar en Fase 6)

- Warning de build/dev: "Next.js inferred your workspace root... detected
  multiple lockfiles" — hay un `package-lock.json` en
  `C:\Users\pc10\Desktop` (proyecto TO.NEWS, no relacionado) que Next.js
  detecta como posible root. Se resuelve con `outputFileTracingRoot` /
  `turbopack.root` en `next.config.ts`. No afecta el build de hoy, pero
  conviene fijarlo antes de deploy para evitar ambigüedad de working
  directory en CI/Railway/Render.
- Puerto 3000 en este entorno suele estar ocupado por TO.NEWS; el dev
  server de BarberOS cae a otro puerto automáticamente (hoy: 3004).
