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
| `DATABASE_URL` | Supabase → Project Settings → Database → Connection Pooling → Transaction mode (puerto 6543) |
| `DIRECT_URL` | Supabase → Project Settings → Database → Direct Connection (puerto 5432) |

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

## Arquitectura

Ver [`docs/PRD.md`](docs/PRD.md) para el detalle completo del producto y [`AGENTS.md`](AGENTS.md) para las reglas técnicas.
