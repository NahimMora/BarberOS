# Problemas conocidos — BarberOS

> Bugs y limitaciones reales del sistema tal como está hoy — no features
> faltantes (eso es `docs/BACKLOG.md` y `docs/ROADMAP.md`). Última
> revisión: 2026-07-20.

## Limitaciones de diseño v1 (conocidas, aceptadas, no son bugs)

- **Comisión ya liquidada bloquea la anulación de la venta**, sin
  mecanismo de ajuste (409 duro). Documentado en `docs/RUNBOOK.md` §
  "Anulación de venta" con el camino manual de emergencia.
- **Liquidación de comisiones no tiene "deshacer".** Intencional — evita
  reversiones accidentales. Ver `docs/RUNBOOK.md` § "Comisión liquidada
  por error".
- **Cierre de caja con diferencia no bloquea el cierre.** Decisión de
  diseño del MVP: la diferencia queda auditada, no impide operar.
- **No hay reset de contraseña in-app de un admin hacia otro usuario** —
  requiere ir al dashboard de Supabase (ver `docs/RUNBOOK.md`).

## Gaps operativos actuales

- **Producción corre con equipo placeholder**, no con los datos reales
  del negocio (`scripts/seed-production-team.ts`). Ver
  `docs/CURRENT_STATE.md`.
- **Dos scripts usados en el deploy real siguen sin commitear:**
  `scripts/migrate-fresh.ts` (fix SSL) y `scripts/seed-production-team.ts`.
- **Flujo de "olvidé mi contraseña" no confirmado end-to-end contra el
  dominio de producción** — se verificó el mensaje en UI, no la
  recepción real del mail.

## Deuda técnica aceptada

- **`esbuild` vulnerable, anidado en `drizzle-kit`** (herramienta de
  desarrollo, no corre en el build ni el runtime de producción).
  Arreglarlo requiere bajar `drizzle-kit` de `^0.31.10` a `0.18.1` —
  breaking, no se hizo. Riesgo real bajo.
- **Sin paginación real** en `/api/sales`, `/api/cash-movements`,
  `/api/commissions` — `limit` fijo de 100–200. No bloqueante al volumen
  actual.
- **Sin observabilidad externa** (Sentry u otro) en las rutas de dinero.

## Sin ejercitar en QA manual (no implica que estén rotos)

Ver `docs/QA_CHECKLIST.md` para el detalle punto por punto — quedan sin
recorrer principalmente: responsive en 375px/768px de la pantalla de
Caja, y la apertura real del archivo Excel descargado desde
Exportaciones.
