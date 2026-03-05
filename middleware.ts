import { NextResponse, type NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

export async function middleware(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  })

  if (token) {
    return NextResponse.next()
  }

  const loginUrl = new URL("/login", request.url)
  const callbackUrl = `${request.nextUrl.pathname}${request.nextUrl.search}`
  loginUrl.searchParams.set("callbackUrl", callbackUrl)

  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/prompts/:path*",
    "/collections/:path*",
    "/billing/:path*",
    "/support/:path*",
    "/branding/:path*",
    "/sla/:path*",
    "/sso/:path*",
    "/compliance/:path*",
    "/ads/:path*",
    "/growth-lab/:path*",
    "/connectors/:path*",
    "/prompt-flow/:path*",
    "/governance/:path*",
    "/interoperability/:path*",
    "/ops-center/:path*",
    "/notification-orchestration/:path*",
    "/ops-analytics/:path*",
    "/playbook-market/:path*",
    "/reliability-gates/:path*",
    "/self-heal/:path*",
    "/release-orchestration/:path*",
    "/phase6-closure/:path*",
    "/partners/:path*",
    "/marketplace/:path*",
    "/developer-api/:path*",
    "/admin/:path*",
  ],
}
