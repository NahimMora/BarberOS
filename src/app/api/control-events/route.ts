import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  and,
  desc,
  eq,
  ilike,
  or,
  sql,
  type SQL,
} from 'drizzle-orm'
import {
  auditLogs,
  domainEvents,
  systemEvents,
  users,
} from '@/db/schema'
import { recordSystemEvent } from '@/lib/audit/record-system-event'
import { getSession } from '@/lib/auth/get-session'
import { db } from '@/lib/db'

const querySchema = z.object({
  kind: z.enum(['audit', 'domain', 'system']).default('audit'),
  q: z.string().trim().max(100).default(''),
  level: z.enum(['info', 'warn', 'error']).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(10).max(100).default(30),
})

export async function GET(request: Request) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = querySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  )
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { kind, q, level, page, limit } = parsed.data
  const offset = (page - 1) * limit

  try {
    const items = kind === 'audit'
      ? await getAuditItems(user.organizationId, q, limit, offset)
      : kind === 'domain'
        ? await getDomainItems(user.organizationId, q, limit, offset)
        : await getSystemItems(user.organizationId, q, level, limit, offset)

    return NextResponse.json({
      items: items.slice(0, limit),
      page,
      hasMore: items.length > limit,
    })
  } catch (error) {
    await recordSystemEvent({
      level: 'error',
      source: 'api.control-events',
      message: 'No se pudieron consultar los eventos de control',
      organizationId: user.organizationId,
      context: {
        kind,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    }).catch(() => undefined)

    return NextResponse.json(
      { error: 'No se pudieron cargar los eventos' },
      { status: 500 },
    )
  }
}

async function getAuditItems(
  organizationId: string,
  query: string,
  limit: number,
  offset: number,
) {
  const conditions: SQL[] = [eq(auditLogs.organizationId, organizationId)]
  if (query) {
    const pattern = `%${query}%`
    conditions.push(or(
      ilike(auditLogs.action, pattern),
      ilike(auditLogs.entity, pattern),
      ilike(users.fullName, pattern),
      sql`${auditLogs.diff}::text ilike ${pattern}`,
    )!)
  }

  const rows = await db
    .select({
      id: auditLogs.id,
      title: auditLogs.action,
      entity: auditLogs.entity,
      entityId: auditLogs.entityId,
      actor: users.fullName,
      data: auditLogs.diff,
      occurredAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.userId))
    .where(and(...conditions))
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(limit + 1)
    .offset(offset)

  return rows.map((row) => ({
    kind: 'audit' as const,
    id: row.id,
    title: row.title,
    subtitle: `${row.entity}${row.entityId ? ` · ${row.entityId}` : ''}`,
    actor: row.actor ?? 'Sistema',
    level: null,
    data: row.data,
    occurredAt: row.occurredAt,
  }))
}

async function getDomainItems(
  organizationId: string,
  query: string,
  limit: number,
  offset: number,
) {
  const conditions: SQL[] = [eq(domainEvents.organizationId, organizationId)]
  if (query) {
    const pattern = `%${query}%`
    conditions.push(or(
      ilike(domainEvents.eventType, pattern),
      sql`${domainEvents.payload}::text ilike ${pattern}`,
    )!)
  }

  const rows = await db
    .select({
      id: domainEvents.id,
      title: domainEvents.eventType,
      data: domainEvents.payload,
      occurredAt: domainEvents.occurredAt,
    })
    .from(domainEvents)
    .where(and(...conditions))
    .orderBy(desc(domainEvents.occurredAt), desc(domainEvents.id))
    .limit(limit + 1)
    .offset(offset)

  return rows.map((row) => ({
    kind: 'domain' as const,
    id: row.id,
    title: row.title,
    subtitle: 'Evento de negocio',
    actor: null,
    level: null,
    data: row.data,
    occurredAt: row.occurredAt,
  }))
}

async function getSystemItems(
  organizationId: string,
  query: string,
  level: 'info' | 'warn' | 'error' | undefined,
  limit: number,
  offset: number,
) {
  const conditions: SQL[] = [
    sql`${systemEvents.context}->>'organizationId' = ${organizationId}`,
  ]
  if (level) conditions.push(eq(systemEvents.level, level))
  if (query) {
    const pattern = `%${query}%`
    conditions.push(or(
      ilike(systemEvents.message, pattern),
      ilike(systemEvents.source, pattern),
      sql`${systemEvents.context}::text ilike ${pattern}`,
    )!)
  }

  const rows = await db
    .select({
      id: systemEvents.id,
      title: systemEvents.message,
      source: systemEvents.source,
      level: systemEvents.level,
      data: systemEvents.context,
      occurredAt: systemEvents.createdAt,
    })
    .from(systemEvents)
    .where(and(...conditions))
    .orderBy(desc(systemEvents.createdAt), desc(systemEvents.id))
    .limit(limit + 1)
    .offset(offset)

  return rows.map((row) => ({
    kind: 'system' as const,
    id: row.id,
    title: row.title,
    subtitle: row.source ?? 'Aplicación',
    actor: null,
    level: row.level,
    data: row.data,
    occurredAt: row.occurredAt,
  }))
}
