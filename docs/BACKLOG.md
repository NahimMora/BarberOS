# Backlog — BarberOS

> Trabajo real pendiente sobre lo ya construido — no features nuevas
> (eso es `docs/ROADMAP.md`). Ordenado por prioridad aproximada. Fuentes:
> `docs/CURRENT_STATE.md`, `docs/KNOWN_ISSUES.md`, y las "decisiones
> abiertas" que quedaron del PRD original.

## Alta prioridad

1. **Commitear `scripts/migrate-fresh.ts` (fix SSL) y
   `scripts/seed-production-team.ts`.** Ya se usaron para el deploy real
   del 2026-07-16, siguen sin estar en el repo — verificar con
   `git status` si esto sigue vigente.
2. **Reemplazar el equipo/sucursal/servicios placeholder de producción
   por los datos reales del negocio.** Cargar desde Operación y dar de
   baja las cuentas `+alias` de `seed-production-team.ts`.
3. **Mecanismo de ajuste para comisión ya liquidada.** Hoy, si
   `commissions.status = 'paid'`, anular la venta asociada es un bloqueo
   duro (409) sin salida desde la UI. Falta diseñar un ajuste o nota de
   débito (ver `docs/DECISIONS.md` y `docs/RUNBOOK.md`).

## Media prioridad

4. **Observabilidad real en rutas de dinero.** `/api/sales`,
   `/api/cash-*`, `/api/commissions` no tienen instrumentación
   sistemática de errores no controlados; no hay Sentry ni equivalente
   conectado.
5. **Confirmar entrega real del mail de "olvidé mi contraseña" en
   producción.** Se verificó el flujo en la UI (mensaje genérico) pero
   no la recepción real del mail contra el dominio de producción.
6. **Paginación real** en ventas, movimientos de caja y comisiones (hoy
   `limit(100)`/`limit(200)` fijo). No bloqueante al volumen actual.
7. **Fixtures/seed más completos** que separen deliberadamente casos
   `paid`/`voided`/comisión `paid` como fixtures reutilizables para
   tests.

## Baja prioridad — decisiones abiertas del PRD original, sin resolver

8. ¿El barbero puede cobrar o solo registrar el servicio? Hoy controlado
   por `organization_settings.allow_barber_charge`, sin una postura de
   producto fija sobre cuál debería ser el default.
9. ¿Precio de servicios uniforme o variable por sucursal? MVP: uniforme,
   sin decidir si eso cambia.
10. ¿Alcanza una sesión de caja diaria por sucursal, o hace falta más de
    una (mañana/tarde)? El modelo ya lo permite; no se construyó UI para
    eso.
11. ¿Qué campos del legajo del barbero deberían ser obligatorios (vs
    opcionales)?
12. ¿Qué nivel de datos extra del cliente se permite guardar por
    privacidad (`extra_profile`)?

## No bloqueante, aceptado como está

13. Vulnerabilidad `esbuild` anidada en `drizzle-kit` (dev-only, no corre
    en producción) — bajarla requeriría un downgrade breaking de
    `drizzle-kit`, no se hizo.
14. Ítems puntuales de `docs/QA_CHECKLIST.md` sin ejercitar (responsive
    375px/768px en Caja, apertura del Excel descargado) — no implica que
    estén rotos, solo que no se confirmaron a mano.
