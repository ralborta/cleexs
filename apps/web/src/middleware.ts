import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Rutas públicas para pruebas (sin login).
 * Solo estas URLs son accesibles sin autenticación cuando se active auth.
 */
const PUBLIC_PATHS = [
  '/',
  '/diagnostico/crear',
  '/diagnostico/verificando',
  '/ver-resultado',
  '/prueba-gratuita',
  '/planes',
];

/**
 * En el subdominio de pruebas (ej. prueba.cleexs.com) solo se permite el flujo de diagnóstico.
 * Definir PUBLIC_TEST_HOST en Vercel (ej. prueba.cleexs.com) para activar esta restricción.
 */
const PUBLIC_TEST_HOST = process.env.PUBLIC_TEST_HOST || '';

/** Rutas permitidas cuando se accede desde el subdominio de pruebas (solo esa página + flujo resultado) */
function isAllowedOnPublicTestHost(pathname: string): boolean {
  if (pathname === '/' || pathname === '/diagnostico/crear' || pathname === '/prueba-gratuita') return true;
  if (pathname.startsWith('/diagnostico/verificando')) return true;
  if (pathname.startsWith('/ver-resultado')) return true;
  return false;
}

function isPublicPath(pathname: string): boolean {
  const path = pathname.replace(/\?.*$/, '').replace(/\/$/, '') || '/';
  if (PUBLIC_PATHS.includes(path)) return true;
  if (path.startsWith('/diagnostico/verificando')) return true;
  if (path.startsWith('/ver-resultado')) return true;
  return false;
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const host = request.headers.get('host') || request.nextUrl.hostname || '';

  // Subdominio solo para pruebas: raíz y todo lo no permitido → /diagnostico/crear
  if (PUBLIC_TEST_HOST && host === PUBLIC_TEST_HOST) {
    const allowed =
      pathname === '/diagnostico/crear' ||
      pathname === '/prueba-gratuita' ||
      pathname.startsWith('/diagnostico/verificando') ||
      pathname.startsWith('/ver-resultado');
    if (!allowed || pathname === '/' || pathname === '') {
      const url = request.nextUrl.clone();
      url.pathname = '/diagnostico/crear';
      url.search = '';
      return NextResponse.redirect(url);
    }
  }

  const publicAccess = isPublicPath(pathname);
  // Sin auth por ahora: todo pasa. Cuando agregues sesión, redirigir a /diagnostico/crear si !publicAccess && !hasSession(request).
  const res = NextResponse.next();
  if (publicAccess) res.headers.set('x-cleexs-public', '1');
  return res;
}

export const config = {
  matcher: [
    /*
     * Match all paths except static files and api.
     */
    '/((?!_next/static|_next/image|favicon.ico|api).*)',
  ],
};
