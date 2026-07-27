import { NextResponse } from 'next/server'
import { z } from 'zod'
import { zodErrorMessage } from '@/lib/validation/zod-error'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { clients, auditLogs } from '@/db/schema'
import { getSupabaseAuthUser, getClientSession } from '@/lib/auth/get-client-session'
import { normalizePhone } from '@/lib/phone/normalize'

const registerSchema = z.object({
  firstName: z.string().min(1).max(255),
  lastName: z.string().max(255).optional(),
})

export async function POST(req: Request) {
  // Ya registrado (llamada repetida/idempotente) — devolvemos el perfil tal
  // cual, sin tocar nada.
  const existing = await getClientSession(req)
  if (existing) return NextResponse.json(existing)

  const authUser = await getSupabaseAuthUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 })
  }

  // El teléfono ya no es obligatorio para registrarse desde la APP (decisión
  // 2026-07-27, ver docs/DECISIONS.md — reemplaza la exigencia original).
  // Sin Twilio activo, la carga/verificación de teléfono pasa a hacerse en
  // persona en la barbería (recepción, vía la web app) en vez de por SMS.
  let normalized: string | null = null
  if (authUser.phone) {
    normalized = normalizePhone(authUser.phone)
    if (!normalized) {
      return NextResponse.json({ error: 'Teléfono inválido' }, { status: 400 })
    }
  }

  // v1 opera con una sola organización real (ver AGENTS.md). No se resuelve
  // con "la primera fila de organizations": esa tabla acumuló organizaciones
  // de prueba (seed de desarrollo, fixtures de tests de RLS) y una consulta
  // sin orden explícito terminó registrando clientes reales contra una
  // organización de demo en vez de la real — ver docs/DECISIONS.md
  // (2026-07-27). DEFAULT_ORGANIZATION_ID fija esto sin ambigüedad.
  const organizationId = process.env.DEFAULT_ORGANIZATION_ID
  if (!organizationId) {
    return NextResponse.json({ error: 'No hay organización configurada' }, { status: 500 })
  }

  try {
    const client = await db.transaction(async (tx) => {
      // Dedupe: si recepción ya cargó este cliente como walk-in con el mismo
      // teléfono, lo vinculamos en vez de duplicar su historial. Sin
      // teléfono (registro solo con Google, sin cargarlo después) no hay
      // nada contra qué deduplicar — siempre se crea un cliente nuevo.
      const [walkIn] = normalized
        ? await tx
            .select({ id: clients.id })
            .from(clients)
            .where(
              and(
                eq(clients.organizationId, organizationId),
                eq(clients.whatsappE164, normalized),
                isNull(clients.authUserId),
                isNull(clients.deletedAt),
              ),
            )
            .limit(1)
        : []

      let row
      if (walkIn) {
        ;[row] = await tx
          .update(clients)
          .set({
            authUserId: authUser.id,
            phoneVerifiedAt: new Date(),
            firstName: parsed.data.firstName,
            lastName: parsed.data.lastName ?? null,
            updatedAt: new Date(),
          })
          .where(eq(clients.id, walkIn.id))
          .returning()
      } else {
        ;[row] = await tx
          .insert(clients)
          .values({
            organizationId: organizationId,
            firstName: parsed.data.firstName,
            lastName: parsed.data.lastName ?? null,
            whatsappRaw: authUser.phone ?? null,
            whatsappE164: normalized,
            authUserId: authUser.id,
            phoneVerifiedAt: normalized ? new Date() : null,
          })
          .returning()
      }

      await tx.insert(auditLogs).values({
        organizationId: organizationId,
        actorClientId: row.id,
        action: 'client.registered',
        entity: 'clients',
        entityId: row.id,
        diff: { linkedExistingRecord: Boolean(walkIn) },
      })

      return row
    })

    return NextResponse.json(
      {
        id: client.id,
        organizationId: client.organizationId,
        authUserId: authUser.id,
        firstName: client.firstName,
        lastName: client.lastName,
        whatsappE164: client.whatsappE164,
      },
      { status: 201 },
    )
  } catch (err: unknown) {
    const pgErr = err as { code?: string }
    if (pgErr?.code === '23505') {
      return NextResponse.json({ error: 'Ya existe un cliente con ese teléfono' }, { status: 409 })
    }
    throw err
  }
}
