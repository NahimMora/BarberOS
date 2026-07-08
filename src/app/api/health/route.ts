import { NextResponse } from 'next/server'

/**
 * Liveness check for platform health checks (Railway/Render). Deliberately
 * doesn't touch the database — coupling liveness to a downstream dependency
 * turns a transient DB blip into a cascading deploy failure. No auth: the
 * platform's health checker hits this anonymously.
 */
export async function GET() {
  return NextResponse.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } })
}
