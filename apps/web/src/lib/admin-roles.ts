/** Roles del panel interno /admin */

export type AdminRole = 'admin' | 'marketing';

export const ADMIN_ROLE_LABEL: Record<AdminRole, string> = {
  admin: 'Administrador',
  marketing: 'Marketing',
};

/** Rutas permitidas para el perfil marketing (prefijos). */
export const MARKETING_ADMIN_PATH_PREFIXES = [
  '/admin/conversion',
  '/admin/funnel',
  '/admin/marcas',
  '/admin/reportes',
  '/admin/auditoria-agentica',
  '/admin/analisis-aeo',
  '/admin/promociones',
] as const;

export function normalizeAdminPathname(pathname: string): string {
  const path = pathname.split('?')[0]?.replace(/\/$/, '') || '/admin';
  return path.startsWith('/admin') ? path : `/admin${path.startsWith('/') ? path : `/${path}`}`;
}

export function isAdminPathAllowedForRole(pathname: string, role: AdminRole): boolean {
  if (role === 'admin') return true;
  const path = normalizeAdminPathname(pathname);
  if (path === '/admin/login') return true;
  return MARKETING_ADMIN_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

export function defaultAdminHomeForRole(role: AdminRole): string {
  return role === 'marketing' ? '/admin/conversion' : '/admin/cuentas';
}

/** Prefijos de API /api/admin-ui/* permitidos para marketing. */
export const MARKETING_ADMIN_API_PREFIXES = [
  '/api/admin-ui/conversion',
  '/api/admin-ui/funnel',
  '/api/admin-ui/agentic-audits',
  '/api/admin-ui/aeo-audits',
  '/api/admin-ui/promo',
  '/api/admin-ui/plan-conquistar',
  '/api/admin-ui/email/logs',
  '/api/admin-ui/me',
  '/api/admin-ui/logout',
  '/api/admin-ui/login',
] as const;

export function isAdminApiAllowedForRole(apiPath: string, role: AdminRole): boolean {
  if (role === 'admin') return true;
  const path = apiPath.split('?')[0] || apiPath;
  if (path === '/api/admin-ui/logout' || path === '/api/admin-ui/login') return true;
  if (MARKETING_ADMIN_API_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
    return true;
  }
  // Reportes y marcas usan proxy a /api/reports/internal/*
  if (path.startsWith('/api/reports/')) return true;
  return false;
}
