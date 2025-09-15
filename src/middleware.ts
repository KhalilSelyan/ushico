import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Redirect old watch URLs to room format
  if (pathname.match(/^\/watch\/[^\/]+--[^\/]+$/)) {
    const chatId = pathname.split('/')[2];
    // Create temporary room or redirect to create room page
    return NextResponse.redirect(new URL(`/dashboard?migrate=${chatId}`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};