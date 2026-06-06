import { NextResponse } from 'next/server'
import { z } from 'zod'
import { eq, and, isNull, ne } from 'drizzle-orm'
import { db } from '@/lib/db'
import { clients } from '@/db/schema'
import { getSession } from '@/lib/auth/get-session'
import { requireRole } from '@/lib/auth/require-role'
import { normalizePhone } from '@/lib/phone/normalize'

const updateSchema = z.object({
  firstName: z.string().max(255).optional(),
  lastName: z.string().max(255).optional(),
  whatsappRaw: z.string().max(50).optional(),
  phoneAltRaw: z.string().max(50).optional(),
  notes: z.string().optional(),
  cutPreferences: z.string().optional(),
  consentData: z.boolean().optional(),
  consentWhatsapp: z.boolean().optional(),
  active: z.boolean().optional(),
})

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [row] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, id), eq(clients.organizationId, user.organizationId)))
    .limit(1)

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(row)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { whatsappRaw, phoneAltRaw, consentData, consentWhatsapp, ...rest } = parsed.data
  const updates: Record<string, unknown> = { ...rest, updatedAt: new Date() }

  if (whatsappRaw !== undefined) {
    const normalized = whatsappRaw ? normalizePhone(whatsappRaw) : null
    if (whatsappRaw && !normalized) {
      return NextResponse.json({ error: 'WhatsApp inválido' }, { status: 400 })
    }
    updates.whatsappRaw = whatsappRaw
    updates.whatsappE164 = normalized
    if (normalized) {
      const [duplicate] = await db
        .select({ id: clients.id })
        .from(clients)
        .where(
          and(
            eq(clients.organizationId, user.organizationId),
            eq(clients.whatsappE164, normalized),
            ne(clients.id, id),
            isNull(clients.deletedAt),
          ),
        )
        .limit(1)
      if (duplicate) {
        return NextResponse.json(
          { error: 'Ya existe un cliente con ese número de WhatsApp', existingId: duplicate.id },
          { status: 409 },
        )
      }
    }
  }
  if (phoneAltRaw !== undefined) {
    const normalized = phoneAltRaw ? normalizePhone(phoneAltRaw) : null
    if (phoneAltRaw && !normalized) {
      return NextResponse.json({ error: 'Teléfono alternativo inválido' }, { status: 400 })
    }
    updates.phoneAltRaw = phoneAltRaw
    updates.phoneAltE164 = normalized
  }
  if (consentData !== undefined) {
    updates.consentData = consentData
    updates.consentDataAt = consentData ? new Date() : null
  }
  if (consentWhatsapp !== undefined) {
    updates.consentWhatsapp = consentWhatsapp
    updates.consentWhatsappAt = consentWhatsapp ? new Date() : null
  }

  const [row] = await db
    .update(clients)
    .set(updates)
    .where(and(eq(clients.id, id), eq(clients.organizationId, user.organizationId)))
    .returning()

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(row)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    requireRole(user, ['admin', 'receptionist', 'barber'])
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [row] = await db
    .update(clients)
    .set({ active: false, deletedAt: new Date(), deletedBy: user.id, updatedAt: new Date() })
    .where(and(eq(clients.id, id), eq(clients.organizationId, user.organizationId), isNull(clients.deletedAt)))
    .returning()

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true })
}
