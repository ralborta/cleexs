/**
 * Fetch del admin UI. En el portal Empliados se puede overridear para
 * redirigir /api/admin-ui/* → /api/borrador/portal-email/* (sin cookie).
 */

type FetchFn = (input: string | URL, init?: RequestInit) => Promise<Response>;

let overrideFetch: FetchFn | null = null;

export function setAdminUiFetchOverride(fn: FetchFn | null) {
  overrideFetch = fn;
}

export function createPortalEmailFetch(): FetchFn {
  return (input, init) => {
    let url = String(input);
    if (url.startsWith('/api/admin-ui/email/')) {
      url = url.replace('/api/admin-ui/email/', '/api/borrador/portal-email/');
    } else if (url.startsWith('/api/admin-ui/monthly-score-emails/')) {
      url = url.replace('/api/admin-ui/monthly-score-emails/', '/api/borrador/portal-email/monthly-score-emails/');
    }
    return fetch(url, {
      ...init,
      credentials: 'omit',
      cache: init?.cache ?? 'no-store',
    });
  };
}

/** Portal → BFF auditoría (proceso real vía API Cleexs, sin cookie admin). */
export function createPortalAuditoriaFetch(): FetchFn {
  return (input, init) => {
    let url = String(input);
    if (url.startsWith('/api/admin-ui/agentic-audits')) {
      url = url.replace('/api/admin-ui/agentic-audits', '/api/borrador/portal-auditoria');
    }
    return fetch(url, {
      ...init,
      credentials: 'omit',
      cache: init?.cache ?? 'no-store',
    });
  };
}

/** Todas las rutas `/api/admin-ui/*` requieren la cookie HttpOnly de sesión (salvo override portal). */
export async function adminUiFetch(input: string | URL, init?: RequestInit): Promise<Response> {
  if (overrideFetch) return overrideFetch(input, init);
  return fetch(input, {
    ...init,
    credentials: 'include',
    cache: init?.cache ?? 'no-store',
  });
}
