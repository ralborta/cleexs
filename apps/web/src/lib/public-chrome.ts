export const WA_RESULT_PATH_PREFIX = '/r/wa';
export const TOOLS_PATH_PREFIX = '/tools';
export const VERIFYING_PATH_PREFIX = '/diagnostico/verificando';

const MINIMAL_HEADER_PATHS = [
  '/diagnostico/crear',
  '/ver-resultado',
  '/prueba-gratuita',
  '/plan-conquistar',
  '/planes',
  '/dashboard',
  '/runs',
  '/outreach',
  '/settings',
  '/facturas',
  '/configuracion',
  '/contacto',
];

export function pathMatchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function shouldHidePublicChrome(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname.startsWith('/admin')) return true;
  if (pathMatchesPrefix(pathname, TOOLS_PATH_PREFIX)) return true;
  if (pathMatchesPrefix(pathname, WA_RESULT_PATH_PREFIX)) return true;
  return false;
}

export function isPublicDiagnosticPath(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname === '/' || pathname === '/diagnostico') return true;
  if (pathname.startsWith('/planes')) return true;
  if (pathname.startsWith('/score')) return true;
  if (MINIMAL_HEADER_PATHS.some((p) => pathMatchesPrefix(pathname, p))) return true;
  if (pathname.startsWith(VERIFYING_PATH_PREFIX)) return true;
  return false;
}

export function isStandalonePortalPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname.startsWith('/portal-crecimiento') || pathname.startsWith('/portal-cliente');
}

export function isPublicLegalPath(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname.startsWith('/legal/')) return true;
  if (pathname === '/terminos' || pathname === '/privacidad' || pathname === '/contacto') return true;
  return false;
}

export function logoHrefForPath(pathname: string | null): string {
  if (!pathname) return '/';
  if (pathname.startsWith('/portal-cliente')) return '/portal-cliente';
  if (pathname.startsWith('/portal-crecimiento')) return '/portal-crecimiento';
  return '/';
}

export function usesMinimalPublicHeader(pathname: string | null): boolean {
  return isPublicDiagnosticPath(pathname) || isStandalonePortalPath(pathname) || isPublicLegalPath(pathname);
}
