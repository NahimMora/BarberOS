import { systemEvents } from '@/db/schema'
import { db } from '@/lib/db'

export type SystemEventInput = {
  level?: 'info' | 'warn' | 'error'
  source: string
  message: string
  organizationId?: string
  context?: Record<string, unknown>
}

export async function recordSystemEvent(input: SystemEventInput): Promise<void> {
  await db.insert(systemEvents).values({
    level: input.level ?? 'info',
    source: input.source,
    message: input.message,
    context: {
      ...(input.organizationId ? { organizationId: input.organizationId } : {}),
      ...input.context,
    },
  })
}
