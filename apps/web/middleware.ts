import { NextResponse, type NextRequest } from 'next/server'

// Optional global Basic Auth gate for the whole site, controlled entirely
// by the SITE_PASSWORD env var. Leave it unset to keep the app fully
// public (the original/default behavior) — this is intentionally additive
// so it stays a no-op unless a deployment explicitly opts in, minimizing
// merge conflicts with branches that don't set this var.
const SITE_PASSWORD = process.env.SITE_PASSWORD

export default function middleware(req: NextRequest) {
  if (!SITE_PASSWORD) {
    return NextResponse.next()
  }

  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Basic ')) {
    const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8')
    const separatorIndex = decoded.indexOf(':')
    const password = separatorIndex === -1 ? decoded : decoded.slice(separatorIndex + 1)
    if (password === SITE_PASSWORD) {
      return NextResponse.next()
    }
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="TrialChat"' },
  })
}

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
