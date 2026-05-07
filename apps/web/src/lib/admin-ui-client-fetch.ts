/** Todas las rutas `/api/admin-ui/*` requieren la cookie HttpOnly de sesión. */
export async function adminUiFetch(input: string | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, {
    ...init,
    credentials: 'include',
    cache: init?.cache ?? 'no-store',
  });
}
