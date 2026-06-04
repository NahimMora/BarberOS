# AGENTS.md — Plataforma de Gestión de Barbería (MVP v1)

> Archivo canónico de instrucciones para agentes (Codex, Claude Code y cualquier otro).
> **Fuente de verdad del producto: `docs/PRD.md`.** Ante cualquier duda de alcance o reglas, ese documento manda.

---

## Qué es este proyecto

Webapp de gestión para una barbería con múltiples sucursales. MVP enfocado en cuatro trabajos.

## Regla de oro

El producto existe para hacer cuatro cosas, bien:

> **Agendar · Cobrar · Cerrar caja · Calcular comisiones**

Si una funcionalidad **no sirve directamente** a uno de esos cuatro trabajos, **no se construye**: va al roadmap (PRD §16). No agregar features "porque estaría bueno".

---

## Cómo trabajamos (CRÍTICO)

1. **Una fase por vez.** No saltar ni adelantar fases. Orden: Fase 0 → 1 → 2 → 3 (ver §Fases).
2. **Plan antes de código.** Antes de implementar una fase, proponer un plan y **esperar aprobación humana**. No escribir código sin plan aprobado.
3. **Validar y commitear al terminar cada fase.** No avanzar a la siguiente fase si la actual no pasa su "definición de terminado".
4. **No implementar features del roadmap.** Está fuera del MVP: IA/OpenAI, RAG, Google Maps, MercadoPago real (SDK/webhooks), WhatsApp automático, portal público, app nativa, inventario, señas, lista de espera, fidelización, AFIP, multi-tenant público, billing SaaS, superadmin, pago mixto. El modelo de datos los contempla, pero **no se construye su funcionalidad**.
5. **No sobre-explorar el repo** ni instalar dependencias sin necesidad real.

---

## Stack (decisión final, no discutir en MVP)

- **Next.js (App Router) + TypeScript** — frontend y backend.
- **Supabase** — Postgres, Auth y Storage.
- **Drizzle ORM** + migraciones versionadas.
- **Tailwind + shadcn/ui** — UI.
- **Vercel** — hosting.
- IA/OpenAI: **fuera del MVP**.

---

## Reglas técnicas innegociables

- **Dinero:** `numeric(12,2)`. **NUNCA** `float`/`double`.
- **Autorización backend-first:** todo endpoint valida **rol + `organization_id` + `branch_id`** antes de responder. Hay **RLS** en tablas críticas (`sales`, `payments`, `cash_sessions`, `cash_movements`, `commissions`, `appointments`, `clients`, `barber_profiles`, `files`). **Nunca confiar solo en el frontend** (el front oculta, el backend autoriza).
- **`organization_id` en TODAS las tablas de negocio.** Aunque hoy haya una sola organización.
- **Anti doble-reserva:** exclusion constraint parcial en Postgres sobre `(barber_id, tstzrange(start_at, end_at))` con `btree_gist`, **solo para estados activos** (`scheduled`, `confirmed`, `in_progress`). Los estados `cancelled`/`no_show`/`completed` **no** bloquean. Implementar con **migración SQL raw** si Drizzle no lo soporta bien. Siempre: **validación en backend + constraint en base + tests de solapamiento**.
- **Soft delete** (`deleted_at`, `deleted_by`, `active`/`status`) en `users`, `branches`, `services`, `clients`, `barber_profiles`. **Ventas, pagos, caja, comisiones y audit logs NO se borran físicamente**; las correcciones se hacen con `adjustment` + audit.
- **Archivos a Supabase Storage.** En la base solo metadata (tabla `files`). Nunca binarios en Postgres. Certificados médicos y documentos personales = `admin_only`.
- **Teléfonos:** guardar valor crudo (`*_raw`) + normalizado **E.164** (`*_e164`). País por defecto **Argentina**. Índice único parcial `(organization_id, whatsapp_e164)` cuando exista.
- **Zona horaria:** almacenar en **UTC**, mostrar en hora local. Default `America/Argentina/Buenos_Aires`. Sin DST.
- **Comisión:** sobre el **total neto pagado después de descuentos**, solo ventas `paid`, guardando `rate_snapshot`. Sin comisión sobre `cancelled`/`no_show`. Si el barbero no tiene comisión: usar `organization_settings.default_commission_rate`; si no hay, **0 + advertencia**.
- **Auditoría:** toda corrección sensible (turno completado, venta pagada, caja cerrada) **queda auditada**. Registrar eventos de negocio en `domain_events` y técnicos en `system_events`.
- **Configuración, no hardcode:** reglas como buffer, intervalo de slot, comisión default, permisos de cobro/walk-in viven en `organization_settings`, no en el código.

---

## Convenciones

- TypeScript estricto. Validación de inputs (zod o equivalente) en cada endpoint.
- **Código y nombres de DB en inglés; UI en español.**
- Migraciones versionadas con Drizzle. **Prohibido** tocar la base a mano fuera de migraciones.
- Tests obligatorios para lógica crítica: agenda/anti-doble-reserva, caja, comisiones.
- Commits chicos y descriptivos. No mezclar fases en un mismo commit.
- Secretos solo en variables de entorno. **Nunca** en el repo.

---

## Comandos

> Placeholders — actualizar con los reales tras la Fase 0.

```
npm run dev          # entorno local
npm run build        # build de producción
npm run lint         # linter
npm run typecheck    # tsc --noEmit
npm run test         # tests
npx drizzle-kit generate   # generar migración
npx drizzle-kit migrate    # aplicar migraciones
npm run db:seed      # cargar seed/demo
```

**Antes de marcar una tarea como terminada:** correr `lint`, `typecheck` y `test`.

---

## Fases (detalle en PRD §13)

- **Fase 0 — Fundación:** proyecto, stack, Supabase, config Vercel, auth, roles, layout base, modelo base, seed inicial.
- **Fase 1 — Agenda:** sucursales, usuarios/staff, servicios, clientes, barberos, `barber_schedules`/`barber_time_off`, turnos, anti doble-reserva, `appointment_history`.
- **Fase 2 — Dinero:** ventas, `payments` manuales, caja, movimientos, cierre de caja, comisiones.
- **Fase 3 — Paneles y control:** dashboard admin básico, vista recepcionista, vista barbero, export CSV/Excel, audit log visible, `domain_events`/`system_events` consultables.

### Definición de "terminado" por fase
- Solo se avanza si la fase pasa los acceptance criteria del PRD §10.
- La agenda no está terminada hasta que **bloquea doble reserva con constraint + validación + tests**.
- La caja no está terminada hasta que **separa efectivo físico de métodos digitales** y deja la diferencia auditada.
- Las comisiones no están terminadas hasta que **calculan por barbero/período con `rate_snapshot`** según la regla cerrada.

---

## Qué NO hacer

- No agregar features del roadmap al MVP.
- No borrar físicamente datos sensibles (ventas, caja, comisiones, audit).
- No confiar en el frontend para permisos.
- No usar `float` para dinero.
- No tocar la base fuera de migraciones.
- No instalar dependencias innecesarias ni sobre-explorar el repo.
- No avanzar de fase sin validar la anterior.
