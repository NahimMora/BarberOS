import { NextResponse } from 'next/server'
import { z } from 'zod'
import { zodErrorMessage } from '@/lib/validation/zod-error'
import { eq, and, isNull, or, ilike, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { clients } from '@/db/schema'
import { getSession } from '@/lib/auth/get-session'
import { normalizePhone } from '@/lib/phone/normalize'

const createSchema = z.object({
  firstName: z.string().max(255).optional(),
  lastName: z.string().max(255).optional(),
  nickname: z.string().max(100).optional(),
  birthdayDay: z.number().int().min(1).max(31).nullable().optional(),
  birthdayMonth: z.number().int().min(1).max(12).nullable().optional(),
  profession: z.string().max(150).optional(),
  whatsappRaw: z.string().max(50).optional(),
  phoneAltRaw: z.string().max(50).optional(),
  notes: z.string().optional(),
  cutPreferences: z.string().optional(),
  consentData: z.boolean().optional().default(false),
  consentWhatsapp: z.boolean().optional().default(false),
}).refine(
  (value) => Boolean(value.firstName?.trim() || value.lastName?.trim() || value.whatsappRaw?.trim() || value.phoneAltRaw?.trim()),
  { message: 'Debe indicar nombre o teléfono' },
)

export async function GET(req: Request) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('q')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = 50
  const offset = (page - 1) * limit

  const conditions = [
    eq(clients.organizationId, user.organizationId),
    isNull(clients.deletedAt),
  ]

  if (search) {
    const pattern = `%${search}%`
    conditions.push(
      or(
        sql`unaccent(${clients.firstName}) ilike unaccent(${pattern})`,
        sql`unaccent(${clients.lastName}) ilike unaccent(${pattern})`,
        ilike(clients.whatsappRaw, pattern),
        ilike(clients.whatsappE164, pattern),
      )!,
    )
  }

  const rows = await db
    .select()
    .from(clients)
    .where(and(...conditions))
    .orderBy(clients.lastName, clients.firstName)
    .limit(limit)
    .offset(offset)

  return NextResponse.json({ data: rows, page, limit })
}

export async function POST(req: Request) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 })
  }

  const { whatsappRaw, phoneAltRaw, consentData, consentWhatsapp, ...rest } = parsed.data

  const whatsappE164 = whatsappRaw ? normalizePhone(whatsappRaw) : null
  const phoneAltE164 = phoneAltRaw ? normalizePhone(phoneAltRaw) : null
  if (whatsappRaw && !whatsappE164) {
    return NextResponse.json({ error: 'WhatsApp inválido' }, { status: 400 })
  }
  if (phoneAltRaw && !phoneAltE164) {
    return NextResponse.json({ error: 'Teléfono alternativo inválido' }, { status: 400 })
  }

  // Duplicate detection by whatsapp_e164
  if (whatsappE164) {
    const [existing] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(
        and(
          eq(clients.organizationId, user.organizationId),
          eq(clients.whatsappE164, whatsappE164),
          isNull(clients.deletedAt),
        ),
      )
      .limit(1)

    if (existing) {
      return NextResponse.json(
        { error: 'Ya existe un cliente con ese número de WhatsApp', existingId: existing.id },
        { status: 409 },
      )
    }
  }

  const now = new Date()
  const [row] = await db
    .insert(clients)
    .values({
      organizationId: user.organizationId,
      whatsappRaw: whatsappRaw ?? null,
      whatsappE164,
      phoneAltRaw: phoneAltRaw ?? null,
      phoneAltE164,
      consentData: consentData ?? false,
      consentDataAt: consentData ? now : null,
      consentWhatsapp: consentWhatsapp ?? false,
      consentWhatsappAt: consentWhatsapp ? now : null,
      ...rest,
    })
    .returning()

  return NextResponse.json(row, { status: 201 })
}
