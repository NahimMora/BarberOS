# Decisiones — BarberOS

> Log breve de decisiones de alcance/arquitectura que no son obvias
> leyendo el código, en orden cronológico inverso (más reciente primero).
> No duplica `AGENTS.md`/`docs/PRD.md` (fuente de verdad de alcance del
> producto) — esto es el "por qué" de decisiones puntuales que quedaron
> dispersas en otros docs o que se tomaron sin dejar rastro escrito.

## 2026-07-13 — `npm run db:migrate:fresh` para bases de datos nuevas

`npm run db:migrate` (`drizzle-kit migrate`) aplica **todas** las
migraciones pendientes en una única transacción. Contra el Supabase de
desarrollo actual nunca fue un problema porque las 12 migraciones se
aplicaron incrementalmente, una por una, a medida que se generaban. Pero
contra una base **completamente vacía** (un proyecto de Supabase nuevo, o
cualquier entorno sin ninguna migración corrida todavía), las 12 quedan
pendientes a la vez, y `migrations/0010_void_enum_value.sql` (`ALTER TYPE
cash_movement_type ADD VALUE 'void'`) + `migrations/0011_sale_void_support.sql`
(que usa ese valor nuevo en un índice parcial y en checks) violan una
restricción real de Postgres: no se puede usar un valor de enum recién
agregado dentro de la misma transacción en la que se agregó — ni siquiera
casteando a texto, porque además las funciones de conversión del enum
dejan de ser `IMMUTABLE` mientras el `ADD VALUE` sigue sin commitear
(`unsafe use of new value` primero, `functions in index predicate must be
marked IMMUTABLE` después).

Se probó de dos formas: aplicando las 12 migraciones una por una a mano
con `psql` (pasan todas, porque cada archivo es su propia transacción) y
llamando a `migrate()` de Drizzle directamente para ver el error real
(la CLI de `drizzle-kit` lo oculta detrás de su spinner).

**Decisión:** no reescribir el schema (enum → texto sería un cambio más
invasivo sobre una tabla de dinero) ni depender de aplicar migraciones a
mano en dos tandas. `scripts/migrate-fresh.ts` reutiliza el migrador
interno de Drizzle (`readMigrationFiles` + `dialect.migrate`) y lo llama
dos veces, partiendo en la última migración que hace `ADD VALUE` — mismo
resultado final, pero con un commit en el medio. `npm run db:migrate`
sigue siendo el comando correcto para el Supabase real (incremental);
`npm run db:migrate:fresh` es solo para bootstrap de una base nueva (ver
`docs/DEPLOYMENT.md`) y para el job `rls` de CI.

**Por qué importa:** esto habría bloqueado el primer deploy real a un
Supabase nuevo (el pendiente "Deploy real" de `docs/PRODUCTION_READINESS.md`)
de forma silenciosa — nadie lo había visto porque el único entorno real
nunca se migró desde cero.

## 2026-07-13 — RLS probada en CI con Postgres vanilla, no Supabase CLI

Se evaluó copiar el enfoque del proyecto hermano (Escuela SaaS): Supabase
CLI local + pgTAP. Se descartó — BarberOS maneja el schema 100% con
Drizzle y no usa el Supabase CLI en ningún lado; sumar ese toolchain en
paralelo (con su propia forma de migrar) para un solo job de CI era más
superficie de la que ameritaba el problema. En su lugar, el job `rls` usa
un contenedor `postgres:16` vanilla + `scripts/ci/bootstrap-rls-roles.sql`,
que recrea a mano lo mínimo que Supabase provisiona automáticamente en su
plataforma hosteada (roles `anon`/`authenticated`/`service_role`,
`auth.uid()`/`auth.role()`, una tabla `storage.buckets` mínima) — nunca
corre contra producción, donde Supabase ya lo provee.

**Por qué importa:** RLS está documentado como "backstop, no defensa
primaria" (`docs/DEPLOYMENT.md`) porque Drizzle se conecta como `postgres`
y la bypassa — pero hasta ahora nada probaba que las policies realmente
bloquean acceso cross-organización. `src/test/integration/rls.test.ts`
corre solo en CI (gateado también por `process.env.CI`, no solo
`DIRECT_URL`, para no insertar datos de prueba en el Supabase real de
desarrollo ni depender de sus grants específicos de `service_role`).

## 2026-07-13 — Sin Dockerfile

`docs/DEPLOYMENT.md` ya documentaba que Railway y Render auto-detectan
Next.js vía su propio buildpack (Railpack / buildpack Node) sin necesitar
contenedor. Se evaluó agregar uno igual (como tiene Escuela SaaS) pero se
descartó explícitamente: hubiera contradicho una decisión de deploy ya
tomada y agregado mantenimiento sin un uso real hoy.

## RLS es backstop, no defensa primaria

**Fuente:** `docs/DEPLOYMENT.md`. Autorización backend-first en cada ruta
(`getSession()` + `requireRole()` + `organizationId` en cada query) es la
defensa real. RLS es una segunda capa por si alguna vez se conecta con un
rol más restringido — Drizzle hoy se conecta como `postgres` y la
bypassa.

## Storage se queda en Supabase Storage, no Cloudflare R2

**Fuente:** `docs/DEPLOYMENT.md`. `AGENTS.md` marca "Archivos a Supabase
Storage" como regla técnica innegociable. Migrar a R2 sería una reescritura
de `src/app/api/files/route.ts` (SDK S3 nuevo, credenciales nuevas, migrar
archivos ya subidos) — no una variable de entorno más.

## Railway recomendado sobre Render

**Fuente:** `docs/DEPLOYMENT.md`. El plan free de Render duerme el
servicio tras inactividad — un cold start de varios segundos en el momento
de cobrar en caja es mal timing para un negocio que cobra en el momento.
Railway no duerme servicios activos en planes pagos.

## Venta con comisión ya liquidada no se puede anular

**Fuente:** `docs/PRODUCTION_READINESS.md`. Bloqueo duro v1: si
`commissions.status = 'paid'` para la venta, la anulación se rechaza con
409. Solo una comisión `pending` puede pasar a `cancelled` junto con la
venta. Falta diseñar el mecanismo de ajuste/nota de débito para el caso en
que sí haga falta corregir una comisión ya liquidada — pendiente
documentado, no implementado.
