/** Base URL de la API Cleexs solo en servidor (Route Handlers, no expuesto al cliente). */
export function cleexsApiServerBaseUrl(): string {
  const u = process.env.API_URL?.trim() || process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!u) {
    throw new Error(
      'Falta API_URL o NEXT_PUBLIC_API_URL en Vercel (Settings → Environment Variables).'
    );
  }
  return u.replace(/\/$/, '');
}

export async function fetchCleexsApiServer(path: string, init?: RequestInit): Promise<Response> {
  const base = cleexsApiServerBaseUrl();
  const url = path.startsWith('/') ? `${base}${path}` : `${base}/${path}`;
  return fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });
}
