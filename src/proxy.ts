import { NextRequest, NextResponse } from "next/server";

// Public paths (no auth required)
const PUBLIC_PATHS = [
  "/",
  "/auth",
  "/auth/error",
  "/api/oauth",          // your custom GitHub OAuth routes
  "/favicon.ico",
];

// Helper: is the request path public?
function isPublic(req: NextRequest) {
  const { pathname } = req.nextUrl;
  return (
    PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + "/")) ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/images/") ||
    pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt)$/i) !== null
  );
}

export function proxy(req: NextRequest) {
  const url = req.nextUrl;
  const session = req.cookies.get("refreshToken")?.value ?? null;

  // Allow logout paths to proceed even if a session exists
  if (url.pathname === "/refresh" ||url.pathname === "/logout" || url.pathname.startsWith("/api/auth/logout")) {
    return NextResponse.next();
  }

  // console.log('session',session)
  // 1) Block protected paths if no session cookie
//   if (!isPublic(req)) {
    if (!session) {
      return NextResponse.next();
    }else{
        return NextResponse.redirect(process.env.NEXT_PUBLIC_REDIRECT_URL??'');
    }
    // // session exists -> allow through
    // return NextResponse.next();
//   }

  // 2) Optional UX: if already signed in, keep them out of /auth
  if (url.pathname.startsWith("/auth") && session) {
    return NextResponse.redirect(new URL("/dashboard", url.origin));
  }

  return NextResponse.next();
}

// Only run middleware on your protected areas to keep things simple/fast
export const config = {
  matcher: ["/((?!api|proxy|_next/static|_next/image|favicon.ico|refresh).*)"], // protect these routes
};
