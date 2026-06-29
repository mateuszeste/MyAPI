import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  let result = 0;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const charA = i < a.length ? a.charCodeAt(i) : 0;
    const charB = i < b.length ? b.charCodeAt(i) : 0;
    result |= charA ^ charB;
  }
  return result === 0 && a.length === b.length;
}

export function proxy(req: NextRequest) {
  const basicAuth = req.headers.get('authorization');

  // If password isn't configured in environment:
  // Bypass auth in local development. Fail closed securely in production.
  const expectedPwd = process.env.ADMIN_PASSWORD?.trim();
  if (!expectedPwd) {
    if (process.env.NODE_ENV === 'production') {
      return new NextResponse('Authentication misconfigured. ADMIN_PASSWORD required in production.', { status: 500 });
    }
    return NextResponse.next();
  }

  if (basicAuth) {
    try {
      const authValue = basicAuth.split(' ')[1];
      if (authValue) {
        const [user, pwd] = atob(authValue).split(':');
        const expectedUser = process.env.ADMIN_USERNAME?.trim();

        if (expectedUser && timingSafeEqual(user, expectedUser) && timingSafeEqual(pwd, expectedPwd)) {
          return NextResponse.next();
        }
      }

    } catch {
      // Invalid base64 or malformed header; safely ignore and drop down to 401
    }
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Secure Dashboard"',
    },
  });
}

export const config = {
  // Match all request paths except static files and images
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
