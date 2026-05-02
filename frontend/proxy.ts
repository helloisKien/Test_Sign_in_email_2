import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { AUTH_COOKIE_NAME, verifyAuthCookieValue } from './lib/auth-cookie';
import { getDefaultRouteForRole } from './lib/role-routing';

export async function proxy(request: NextRequest) {
    const authPayload = await verifyAuthCookieValue(request.cookies.get(AUTH_COOKIE_NAME)?.value);
    const role = authPayload?.role ?? null;
    const { pathname } = request.nextUrl;

    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/api') ||
        pathname.startsWith('/backend-api') ||
        pathname === '/favicon.ico'
    ) {
        return NextResponse.next();
    }

    if (
        !role &&
        pathname !== '/' &&
        pathname !== '/login' &&
        pathname !== '/signup' &&
        pathname !== '/reset-password' &&
        pathname !== '/verify-email' &&
        pathname !== '/faq' &&
        pathname !== '/updates'
    ) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    if (role === 'Teacher') {
        if (
            pathname === '/login' ||
            pathname === '/signup' ||
            pathname === '/auditor' ||
            pathname.startsWith('/admin')
        ) {
            return NextResponse.redirect(new URL(getDefaultRouteForRole(role), request.url));
        }
    }

    if (role === 'QA') {
        if (
            pathname === '/login' ||
            pathname === '/signup' ||
            pathname === '/generator' ||
            pathname.startsWith('/admin')
        ) {
            return NextResponse.redirect(new URL(getDefaultRouteForRole(role), request.url));
        }
    }

    if (role === 'Admin') {
        if (pathname === '/login' || pathname === '/signup') {
            return NextResponse.redirect(new URL(getDefaultRouteForRole(role), request.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
