import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  ADMIN_UI_COOKIE_NAME,
  adminRequireAuthEnabled,
  parseAdminSessionLite,
} from '@/lib/admin-auth-config';
import {
  defaultAdminHomeForRole,
  isAdminPathAllowedForRole,
} from '@/lib/admin-roles';

/**
 * Rutas públicas para pruebas (sin login).
 * Solo estas URLs son accesibles sin autenticación cuando se active auth.
 */
const PUBLIC_PATHS = [
  '/',
  '/diagnostico/crear',
  '/diagnostico/verificando',
  '/diagnostico/onboarding-preview',
  '/ver-resultado',
  '/prueba-gratuita',
  '/planes',
  '/score',
  '/r/wa',
  '/terminos',
  '/privacidad',
  '/legal/cleexs',
  '/contacto',
  '/email/unsubscribe',
  '/plan-conquistar',
  '/tools/auspiciadores',
  '/borrador',
];

/**
 * En el subdominio de pruebas (ej. prueba.cleexs.com) solo se permite el flujo de diagnóstico.
 * Definir PUBLIC_TEST_HOST en Vercel (ej. prueba.cleexs.com) para activar esta restricción.
 */
const PUBLIC_TEST_HOST = process.env.PUBLIC_TEST_HOST || '';

const MARKETING_HOSTS = new Set(['cleexs.net', 'www.cleexs.net']);
const APP_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.cleexs.net').replace(/\/$/, '');

/** cleexs.net/diagnostico/* → app.cleexs.net (mismo path y query, para links de auspiciador). */
function marketingToAppRedirect(request: NextRequest): NextResponse | null {
  const host = (request.headers.get('host') || request.nextUrl.hostname || '').split(':')[0];
  if (!MARKETING_HOSTS.has(host)) return null;
  if (!request.nextUrl.pathname.startsWith('/diagnostico')) return null;

  const target = new URL(request.nextUrl.pathname + request.nextUrl.search, APP_ORIGIN);
  return NextResponse.redirect(target);
}

/** Rutas permitidas cuando se accede desde el subdominio de pruebas (solo esa página + flujo resultado) */
function isAllowedOnPublicTestHost(pathname: string): boolean {
  if (pathname === '/' || pathname === '/diagnostico/crear' || pathname === '/prueba-gratuita') return true;
  if (pathname === '/planes') return true;
  if (pathname.startsWith('/diagnostico/verificando')) return true;
  if (pathname.startsWith('/diagnostico/onboarding-preview')) return true;
  if (pathname.startsWith('/ver-resultado')) return true;
  if (pathname.startsWith('/score')) return true;
  if (pathname.startsWith('/r/wa')) return true;
  if (pathname.startsWith('/legal/')) return true;
  if (pathname === '/terminos' || pathname === '/privacidad' || pathname === '/contacto') return true;
  if (pathname.startsWith('/admin')) return true;
  if (pathname.startsWith('/tools/auspiciadores')) return true;
  if (pathname.startsWith('/borrador')) return true;
  return false;
}

function adminRoleGuard(request: NextRequest): NextResponse | null {
  const pathname = request.nextUrl.pathname;
  if (!pathname.startsWith('/admin')) return null;
  if (pathname.startsWith('/admin/login')) return null;

  const token = request.cookies.get(ADMIN_UI_COOKIE_NAME)?.value;
  const session = parseAdminSessionLite(token);
  if (!session || session.role === 'admin') return null;

  if (!isAdminPathAllowedForRole(pathname, session.role)) {
    const url = request.nextUrl.clone();
    url.pathname = defaultAdminHomeForRole(session.role);
    url.search = '';
    return NextResponse.redirect(url);
  }

  return null;
}

function clearAdminSessionCookie(res: NextResponse) {
  const secure = process.env.NODE_ENV === 'production';
  res.cookies.set(ADMIN_UI_COOKIE_NAME, '', {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  res.cookies.set(ADMIN_UI_COOKIE_NAME, '', {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/admin',
    maxAge: 0,
  });
}

function adminLoginRedirect(request: NextRequest): NextResponse | null {
  const pathname = request.nextUrl.pathname;
  if (!pathname.startsWith('/admin')) return null;
  if (pathname.startsWith('/admin/login')) return null;
  if (!adminRequireAuthEnabled()) return null;

  const token = request.cookies.get(ADMIN_UI_COOKIE_NAME)?.value;
  if (parseAdminSessionLite(token)) return null;

  const url = request.nextUrl.clone();
  url.pathname = '/admin/login';
  url.search = '';
  const res = NextResponse.redirect(url);
  if (token) clearAdminSessionCookie(res);
  return res;
}

function isPublicPath(pathname: string): boolean {
  const path = pathname.replace(/\?.*$/, '').replace(/\/$/, '') || '/';
  if (PUBLIC_PATHS.includes(path)) return true;
  if (path.startsWith('/diagnostico/verificando')) return true;
  if (path.startsWith('/diagnostico/onboarding-preview')) return true;
  if (path.startsWith('/ver-resultado')) return true;
  if (path.startsWith('/score')) return true;
  if (path.startsWith('/r/wa')) return true;
  if (path.startsWith('/legal/')) return true;
  if (path === '/terminos' || path === '/privacidad' || path === '/contacto') return true;
  if (path.startsWith('/email/unsubscribe')) return true;
  if (path.startsWith('/plan-conquistar')) return true;
  if (path.startsWith('/borrador')) return true;
  return false;
}

function nextWithPathname(request: NextRequest): NextResponse {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', request.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export function middleware(request: NextRequest) {
  const marketingRedirect = marketingToAppRedirect(request);
  if (marketingRedirect) return marketingRedirect;

  const pathname = request.nextUrl.pathname;
  const roleRedirect = adminRoleGuard(request);
  if (roleRedirect) return roleRedirect;

  const adminRedirect = adminLoginRedirect(request);
  if (adminRedirect) return adminRedirect;

  const host = request.headers.get('host') || request.nextUrl.hostname || '';

  // Subdominio solo para pruebas: raíz y todo lo no permitido → /diagnostico/crear
  if (PUBLIC_TEST_HOST && host === PUBLIC_TEST_HOST) {
    const allowed =
      pathname === '/diagnostico/crear' ||
      pathname === '/prueba-gratuita' ||
      pathname === '/planes' ||
      pathname.startsWith('/diagnostico/verificando') ||
      pathname.startsWith('/diagnostico/onboarding-preview') ||
      pathname.startsWith('/ver-resultado') ||
      pathname.startsWith('/score') ||
      pathname.startsWith('/r/wa') ||
      pathname.startsWith('/legal/') ||
      pathname === '/terminos' ||
      pathname === '/privacidad' ||
      pathname === '/contacto' ||
      pathname.startsWith('/admin') ||
      pathname.startsWith('/borrador');
    if (!allowed || pathname === '/' || pathname === '') {
      const url = request.nextUrl.clone();
      url.pathname = '/diagnostico/crear';
      // No borrar url.search: conserva ?ref=, utm_*, etc.
      return NextResponse.redirect(url);
    }
  }

  const publicAccess = isPublicPath(pathname);
  const res = nextWithPathname(request);
  if (publicAccess) res.headers.set('x-cleexs-public', '1');
  return res;
}

export const config = {
  matcher: [
    /*
     * Match all paths except static files and api.
     */
    '/((?!_next/static|_next/image|favicon.ico|api|borrador/).*)',
  ],
};
