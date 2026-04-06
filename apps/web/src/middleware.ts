import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/', '/login', '/api/auth']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow exact root path (redirects to /chat)
  if (pathname === '/') {
    return NextResponse.next()
  }

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => p !== '/' && pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Allow API routes (they handle their own auth or are proxied)
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Allow static assets and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Protected routes (like /chat) — check for session cookie
  const sessionCookie =
    request.cookies.get('better-auth.session_token') ||
    request.cookies.get('__Secure-better-auth.session_token')

  if (!sessionCookie?.value) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
