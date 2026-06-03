/**
 * Sitio de marketing (WordPress en cleexs.net). Usar solo para enlaces explícitos al sitio público.
 */
export const CLEEXS_MARKETING_URL = 'https://cleexs.net' as const;

/** Variante con www. */
export const CLEEXS_MARKETING_WWW_URL = 'https://www.cleexs.net' as const;

/**
 * App Cleexs (Next.js): dominio canónico del producto — diagnóstico, dashboard, planes.
 * En Vercel: NEXT_PUBLIC_APP_URL=https://app.cleexs.net
 * En local: .env.local con NEXT_PUBLIC_APP_URL=http://localhost:3000
 */
export const CLEEXS_APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '') || 'https://app.cleexs.net'
) as string;

/**
 * Base marketing para links de campaña (home cleexs.net con ?ref= y UTM).
 * Override opcional: NEXT_PUBLIC_SPONSOR_LINK_BASE_URL
 */
export const CLEEXS_SPONSOR_LINK_BASE_URL = (
  process.env.NEXT_PUBLIC_SPONSOR_LINK_BASE_URL?.trim().replace(/\/$/, '') || CLEEXS_MARKETING_URL
) as string;

/** URL opcional (despliegue) para “análisis técnico ampliado” del sitio; si está vacío, no hay botón extra. */
export const CLEEXS_TOOLS_PUBLIC_URL = (
  process.env.NEXT_PUBLIC_CLEEXS_TOOLS_URL?.trim().replace(/\/$/, '') || ''
) as string;

/**
 * Número WhatsApp Business de Cleexs (solo dígitos E.164, ej. 54911…).
 * Usado en QR de auspiciadores (wa.me).
 */
export const CLEEXS_WHATSAPP_PHONE_E164 = (
  process.env.NEXT_PUBLIC_CLEEXS_WHATSAPP_PHONE?.trim().replace(/\D/g, '') || '541153866372'
) as string;
