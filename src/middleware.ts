import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Correlate this request across client response headers and server logs.
  // Reused if the caller already set one (e.g. an upstream proxy).
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID()
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-request-id', requestId)

  let supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — must call getUser() to keep tokens alive
  const { data: { user } } = await supabase.auth.getUser()

  const isProtected = request.nextUrl.pathname.startsWith('/dashboard') ||
    request.nextUrl.pathname.startsWith('/admin') ||
    request.nextUrl.pathname.startsWith('/agenda') ||
    request.nextUrl.pathname.startsWith('/caja') ||
    request.nextUrl.pathname.startsWith('/comisiones') ||
    request.nextUrl.pathname.startsWith('/clientes')

  if (!user && isProtected) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    const redirectResponse = NextResponse.redirect(loginUrl)
    redirectResponse.headers.set('x-request-id', requestId)
    return redirectResponse
  }

  supabaseResponse.headers.set('x-request-id', requestId)
  return supabaseResponse
}

export const config = {
  matcher: [
    // api/health is excluded on purpose: platform liveness checks (Railway/
    // Render) must not depend on a Supabase round-trip to answer.
    '/((?!_next/static|_next/image|favicon.ico|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
