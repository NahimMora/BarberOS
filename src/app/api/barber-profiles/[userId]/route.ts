import { NextResponse } from 'next/server'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { barberProfiles, files, users } from '@/db/schema'
import { getSession } from '@/lib/auth/get-session'
import { requireRole } from '@/lib/auth/require-role'

const profileSchema = z.object({
  address: z.string().max(1000).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  emergencyContactName: z.string().max(255).nullable().optional(),
  emergencyContactPhone: z.string().max(50).nullable().optional(),
  hireDate: z.string().date().nullable().optional(),
  relationshipType: z.enum(['empleado', 'socio', 'monotributista', 'colaborador']).nullable().optional(),
  commissionRate: z.string().regex(/^\d{1,3}(\.\d{1,2})?$/).nullable().optional(),
  medicalCertExpiry: z.string().date().nullable().optional(),
  documentationExpiry: z.string().date().nullable().optional(),
  internalNotes: z.string().max(5000).nullable().optional(),
  displayColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  active: z.boolean().optional(),
})

async function getAdmin() {
  const user = await getSession()
  if (!user) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  try {
    requireRole(user, ['admin'])
  } catch {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { user }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const auth = await getAdmin()
  if ('response' in auth) return auth.response
  const { userId } = await params

  const [profile] = await db
    .select({
      id: barberProfiles.id,
      userId: barberProfiles.userId,
      fullName: users.fullName,
      address: barberProfiles.address,
      phone: barberProfiles.phone,
      emergencyContactName: barberProfiles.emergencyContactName,
      emergencyContactPhone: barberProfiles.emergencyContactPhone,
      hireDate: barberProfiles.hireDate,
      relationshipType: barberProfiles.relationshipType,
      commissionRate: barberProfiles.commissionRate,
      medicalCertExpiry: barberProfiles.medicalCertExpiry,
      documentationExpiry: barberProfiles.documentationExpiry,
      internalNotes: barberProfiles.internalNotes,
      displayColor: barberProfiles.displayColor,
      active: barberProfiles.active,
    })
    .from(barberProfiles)
    .innerJoin(users, eq(users.id, barberProfiles.userId))
    .where(
      and(
        eq(barberProfiles.userId, userId),
        eq(barberProfiles.organizationId, auth.user.organizationId),
      ),
    )
    .limit(1)
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const documents = await db
    .select()
    .from(files)
    .where(
      and(
        eq(files.organizationId, auth.user.organizationId),
        eq(files.entityType, 'barber_profile'),
        eq(files.entityId, userId),
      ),
    )
    .orderBy(files.createdAt)

  return NextResponse.json({ ...profile, documents })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const auth = await getAdmin()
  if ('response' in auth) return auth.response
  const { userId } = await params
  const parsed = profileSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const [profile] = await db
    .update(barberProfiles)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(
      and(
        eq(barberProfiles.userId, userId),
        eq(barberProfiles.organizationId, auth.user.organizationId),
      ),
    )
    .returning()
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(profile)
}
