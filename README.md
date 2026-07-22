# BarberOS

Plataforma de gestión para barbería — MVP v1.

## Setup local

### Requisitos previos

- Node.js 20+
- Proyecto en [Supabase](https://supabase.com) (Free tier alcanza para el MVP)

### 1. Variables de entorno

```bash
cp .env.example .env.local
```

Completá las 5 variables en `.env.local`:

| Variable | Dónde encontrarla |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API (secret) |
| `DATABASE_URL` | Supabase → Project Settings → Database → Connection Pooling → Session mode (puerto 5432) |
| `DIRECT_URL` | Igual que `DATABASE_URL` — ver comentarios en `.env.example` sobre por qué |

### 2. Instalar dependencias

```bash
npm install
```

### 3. Aplicar migraciones

```bash
npm run db:migrate
```

### 4. Cargar datos demo

```bash
npm run db:seed
```

### 5. Levantar el servidor

```bash
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000).

### Credenciales demo

| Email | Contraseña | Rol |
|---|---|---|
| `admin@demo.com` | `demo1234` | Admin / Dueño |
| `recep@demo.com` | `demo1234` | Recepcionista |
| `barbero@demo.com` | `demo1234` | Barbero |

## Comandos

```bash
npm run dev          # servidor de desarrollo
npm run build        # build de producción
npm run lint         # linter
npm run typecheck    # tsc --noEmit
npm run test         # tests (Vitest)
npm run db:generate  # generar nueva migración
npm run db:migrate   # aplicar migraciones pendientes
npm run db:seed      # cargar datos demo (idempotente)
```

## Documentación

- [`docs/PRODUCT.md`](docs/PRODUCT.md) — qué problema resuelve, para quién, qué no resuelve.
- [`docs/USERS.md`](docs/USERS.md) — roles y permisos.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — stack, componentes, entornos.
- [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md) — qué funciona, qué falta, próximo objetivo (documento vivo).
- [`docs/BACKLOG.md`](docs/BACKLOG.md) / [`docs/KNOWN_ISSUES.md`](docs/KNOWN_ISSUES.md) / [`docs/ROADMAP.md`](docs/ROADMAP.md) — pendiente real, problemas conocidos, y qué queda fuera de v1.
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — por qué se decidió cada cosa no obvia.
- [`AGENTS.md`](AGENTS.md) — reglas técnicas y convenciones para agentes.

## Producción

Ver [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) para el paso a paso de deploy (Render/Railway), [`docs/RUNBOOK.md`](docs/RUNBOOK.md) para procedimientos operativos, y [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md) para el estado real del deploy ya hecho.
