# Runbook — BarberOS

> Procedimientos operativos para soporte de primer nivel (admin de la
> barbería) y para quien mantenga la app técnicamente. No requiere leer el
> código para los primeros cuatro; los dos últimos sí asumen acceso a la
> plataforma de deploy y a Supabase.

## Reset de contraseña

**Autoservicio (el usuario tiene acceso a su email):**
1. En `/login`, ir a "¿Olvidaste tu contraseña?" → `/recuperar-contrasena`.
2. Cargar el email → Supabase manda un mail con un link.
3. El link vuelve a `/auth/callback?next=/restablecer-contrasena` y de ahí
   a `/restablecer-contrasena`, donde carga la contraseña nueva.
4. Si el mail no llega: confirmar que el dominio de producción esté en
   Supabase → Authentication → URL Configuration → Redirect URLs (ver
   `docs/DEPLOYMENT.md`). Sin eso, Supabase rechaza el redirect en
   silencio y el usuario nunca recibe nada útil.

**El usuario no tiene acceso a su email (soporte manual):**
1. No hay una acción in-app para que un admin le resetee la contraseña a
   otro usuario — `PATCH /api/staff/[id]` no acepta `password`.
2. Ir a Supabase Dashboard → Authentication → Users, buscar al usuario por
   email, y usar "Send password recovery" (le llega el mismo flujo de
   arriba) o "Reset password" para fijar una temporal a mano.

## Cierre de caja con diferencia

El cierre **no bloquea** por tener diferencia — es una decisión de diseño
del MVP (la diferencia queda auditada, no impide operar). Pasos:

1. En `/caja`, con la sesión abierta, click "Cerrar caja".
2. Cargar el efectivo contado. El diálogo ya muestra el esperado y el
   total operativo antes de confirmar.
3. Al confirmar, la sesión pasa a `closed` con `expected_cash`,
   `counted_cash` y `cash_difference` guardados — ese snapshot **no se
   recalcula nunca más**, ni siquiera si después se anula una venta de esa
   sesión (la reversa se ve como movimiento nuevo, el cierre histórico
   queda igual).
4. Si la diferencia es significativa y hace falta dejar una nota o
   corregir el efectivo esperado de una sesión ya cerrada: usar "Ajustar"
   en la tabla de "Cierres recientes" (solo admin). Esto inserta un
   `cash_movement` tipo `adjustment` con motivo obligatorio — no toca el
   snapshot del cierre, queda auditado por separado.

## Anulación de venta

Solo admin, desde `/caja`:

1. Buscar la venta por sucursal/fecha en el panel de anulación (aparece
   solo para admin).
2. Confirmar la anulación con un motivo — es obligatorio.
3. Qué pasa automáticamente: la venta pasa a `cancelled` (conservando
   `paid_at` original), se revierte cada `cash_movement` tipo `sale`
   asociado con un movimiento `void` de signo contrario, y si la comisión
   de esa venta todavía estaba `pending` pasa a `cancelled`.
4. **Si la comisión ya fue liquidada (`paid`), la anulación se rechaza**
   con un mensaje explícito. Hoy no hay forma de anular esa venta desde la
   UI — es una limitación conocida (ver "Pendientes reales" en
   `docs/PRODUCTION_READINESS.md`). Si de verdad hace falta corregirlo,
   requiere intervención manual en la base de datos por alguien que
   entienda las tres tablas involucradas (`sales`, `commissions`,
   `cash_movements`) y deje su propio registro de auditoría — no
   improvisar un `UPDATE` suelto.

## Comisión liquidada por error

1. Liquidar es a propósito difícil de deshacer: `POST /api/commissions`
   con `action: 'settle'` marca todas las comisiones `pending` de ese
   barbero/período como `paid` en una transacción, y pide confirmación
   explícita antes en la UI (`commissions-report.tsx`).
2. **No existe un botón de "deshacer liquidación"** hoy. Si se liquidó por
   error:
   - Si el error es de monto (la venta que la generó estaba mal
     cobrada): corregir la venta primero (anularla, si la comisión
     todavía no estaba liquidada en ese momento — si ya lo estaba, ver el
     punto anterior).
   - Si el error es "no correspondía liquidar todavía": es una corrección
     manual en la tabla `commissions` (volver `status` a `pending`) más un
     registro en `audit_logs` explicando por qué, hecho por alguien con
     acceso directo a la base — no hay ruta de API para esto porque es
     intencionalmente un camino sin salida fácil (evita liquidaciones
     accidentales revertidas a la ligera).

## Restauración ante deploy fallido

1. **Railway:** Deployments → elegir el deploy anterior que funcionaba →
   "Redeploy". Railway mantiene el historial de builds.
2. **Render:** Events/Deploys del servicio → "Rollback" al deploy anterior,
   o simplemente re-desplegar el commit anterior desde GitHub.
3. **Importante — migraciones no se revierten solas.** Si el deploy fallido
   incluía una migración de Drizzle ya aplicada (`npm run db:migrate` corrió
   antes de que el deploy del código fallara), hacer rollback del código a
   una versión anterior puede dejar la app corriendo contra un schema más
   nuevo del que espera. Antes de hacer rollback de código:
   - Si la migración nueva es aditiva (agregó columnas/tablas nullable),
     el código viejo generalmente sigue funcionando sin problema.
   - Si la migración fue destructiva o cambió un tipo/constraint, el
     rollback de código **no alcanza** — hay que revisar si además hace
     falta una migración correctiva hacia adelante (nunca "deshacer" a
     mano fuera de una migración versionada, por regla de `AGENTS.md`).
4. Verificar `/api/health` después de cualquier rollback.

## Revisar logs

- **Logs de la plataforma** (errores de proceso, crashes, requests):
  Railway → Deployments → View Logs, o Render → Logs del servicio. Esto es
  lo primero para un 500 genérico o un deploy que no arranca.
- **Errores de aplicación ya clasificados:** `/control` → tab "Sistema"
  (solo admin) — son los `system_events` que la app ya registra en rutas
  como exportaciones o consulta de eventos, con nivel (info/warn/error) y
  contexto.
- **Qué pasó y quién lo hizo** (turno cancelado, venta anulada, caja
  cerrada, comisión liquidada): `/control` → tab "Auditoría" — son los
  `audit_logs`, con actor y diff del cambio.
- **Secuencia de hechos de negocio de un día puntual:** `/control` → tab
  "Negocio" (`domain_events`) — útil para reconstruir qué pasó sin el
  ruido técnico de "Sistema".
