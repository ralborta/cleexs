/** Cliente server-side hacia la API del Agente Cleexs (Discovery / oportunidades). */

export function agenteCleexsApiUrl(): string {
  const u =
    process.env.AGENTE_CLEEXS_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_AGENTE_CLEEXS_API_URL?.trim() ||
    'https://agente-cleexs-api.wd75db.easypanel.host';
  return u.replace(/\/$/, '');
}

export function agenteCleexsPortalSecret(): string {
  const s =
    process.env.AGENTE_CLEEXS_PORTAL_SECRET?.trim() ||
    process.env.AGENTE_CLEEXS_CRON_SECRET?.trim();
  if (!s) throw new Error('AGENTE_CLEEXS_PORTAL_SECRET no configurado en el servidor web');
  return s;
}

export async function agenteCleexsFetch(path: string, init?: RequestInit): Promise<Response> {
  const secret = agenteCleexsPortalSecret();
  const base = agenteCleexsApiUrl();
  const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? path : `/${path}`}`;
  return fetch(url, {
    ...init,
    headers: {
      'x-portal-secret': secret,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });
}
