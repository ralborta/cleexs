/** URL base de la API — misma lógica en cliente, checkout y track. */
export function resolveApiBaseUrl(): string {
  // En el navegador siempre same-origin (/proxy-api): evita CORS +
  // Cross-Origin-Resource-Policy: same-origin de Helmet en la API.
  if (typeof window !== 'undefined') return '/proxy-api';
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  if (process.env.NODE_ENV === 'development') return '/proxy-api';
  return 'https://cleexsapi-production.up.railway.app';
}
