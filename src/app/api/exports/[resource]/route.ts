import { NextResponse } from 'next/server'
import { z } from 'zod'
import { and, eq, isNull } from 'drizzle-orm'
import {
  auditLogs,
  branches,
  organizationSettings,
} from '@/db/schema'
import { recordSystemEvent } from '@/lib/audit/record-system-event'
import { getSession } from '@/lib/auth/get-session'
import { hasBranchAccess } from '@/lib/auth/authorization'
import {
  getLocalCalendarMonth,
  getLocalDayUtcRange,
} from '@/lib/datetime/local-day-range'
import { db } from '@/lib/db'
import {
  buildExport,
  canExportResource,
  ExportAuthorizationError,
  exportResources,
} from '@/lib/exports/build-export'
import {
  serializeCsv,
  serializeSpreadsheetXml,
} from '@/lib/exports/serialize'

const paramsSchema = z.object({
  resource: z.enum(exportResources),
})

const querySchema = z.object({
  format: z.enum(['csv', 'xls']).default('csv'),
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  branch_id: z.string().uuid().optional(),
}).refine((value) => Boolean(value.from) === Boolean(value.to), {
  message: 'from y to deben usarse juntos',
})

export async function GET(
  request: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsedParams = paramsSchema.safeParse(await params)
  const parsedQuery = querySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  )
  if (!parsedParams.success || !parsedQuery.success) {
    return NextResponse.json({ error: 'Parámetros de exportación inválidos' }, { status: 400 })
  }

  const { resource } = parsedParams.data
  const { format, branch_id: branchId } = parsedQuery.data
  if (!canExportResource(user.role, resource)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const [settings] = await db
      .select({ defaultTimezone: organizationSettings.defaultTimezone })
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, user.organizationId))
      .limit(1)
    const timeZone = settings?.defaultTimezone ?? 'America/Argentina/Buenos_Aires'
    const period = parsedQuery.data.period ?? getLocalCalendarMonth(new Date(), timeZone)

    let range: { start: Date; end: Date } | undefined
    let periodLabel = period
    if (parsedQuery.data.from && parsedQuery.data.to) {
      if (resource === 'commissions') {
        return NextResponse.json(
          { error: 'Comisiones se exporta por período mensual completo, no por rango de fechas' },
          { status: 400 },
        )
      }
      if (parsedQuery.data.from > parsedQuery.data.to) {
        return NextResponse.json(
          { error: 'La fecha "desde" no puede ser posterior a "hasta"' },
          { status: 400 },
        )
      }
      range = {
        start: getLocalDayUtcRange(parsedQuery.data.from, timeZone).start,
        end: getLocalDayUtcRange(parsedQuery.data.to, timeZone).end,
      }
      periodLabel = parsedQuery.data.from === parsedQuery.data.to
        ? parsedQuery.data.from
        : `${parsedQuery.data.from}_a_${parsedQuery.data.to}`
    }

    if (branchId) {
      if (!hasBranchAccess(user, branchId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      const [branch] = await db
        .select({ id: branches.id })
        .from(branches)
        .where(and(
          eq(branches.id, branchId),
          eq(branches.organizationId, user.organizationId),
          eq(branches.active, true),
          isNull(branches.deletedAt),
        ))
        .limit(1)
      if (!branch) {
        return NextResponse.json({ error: 'Sucursal no encontrada' }, { status: 404 })
      }
    }

    const definition = await buildExport({
      user,
      resource,
      period,
      periodLabel,
      range,
      branchId,
      timeZone,
    })
    const headers = definition.columns.map((column) => column.label)
    const content = format === 'csv'
      ? serializeCsv(headers, definition.rows)
      : serializeSpreadsheetXml(definition.sheetName, definition.columns, definition.rows)
    const extension = format === 'csv' ? 'csv' : 'xls'

    await db.insert(auditLogs).values({
      organizationId: user.organizationId,
      userId: user.id,
      action: 'export.generated',
      entity: 'exports',
      diff: {
        resource,
        format,
        period: periodLabel,
        from: parsedQuery.data.from ?? null,
        to: parsedQuery.data.to ?? null,
        branchId: branchId ?? null,
        rowCount: definition.rows.length,
      },
    })

    return new Response(content, {
      headers: {
        'Content-Type': format === 'csv'
          ? 'text/csv; charset=utf-8'
          : 'application/vnd.ms-excel; charset=utf-8',
        'Content-Disposition': `attachment; filename="${definition.filename}.${extension}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    if (error instanceof ExportAuthorizationError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await recordSystemEvent({
      level: 'error',
      source: 'api.exports',
      message: 'No se pudo generar una exportación',
      organizationId: user.organizationId,
      context: {
        resource,
        format,
        branchId: branchId ?? null,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    }).catch(() => undefined)

    return NextResponse.json(
      { error: 'No se pudo generar la exportación' },
      { status: 500 },
    )
  }
}
