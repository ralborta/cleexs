/**
 * Sitio de marketing (WordPress en cleexs.net). Usar solo para enlaces explícitos al sitio público.
 */
import { parseYoutubeVideoId } from './youtube';

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

/** Número WhatsApp del bot de diagnósticos (solo dígitos E.164, ej. 54911…).
 * Usado en QR de auspiciadores (wa.me) y canal Baileys / BuilderBot.
 * Override: NEXT_PUBLIC_CLEEXS_WHATSAPP_PHONE=54911…
 * Default: +54 9 11 6263-0542
 */
export const CLEEXS_WHATSAPP_PHONE_E164 = (
  process.env.NEXT_PUBLIC_CLEEXS_WHATSAPP_PHONE?.replace(/\D/g, '').trim() || '5491162630542'
) as string;

/** WhatsApp directo de Gonzalo — solo pantalla cafecito del onboarding.
 * Override: NEXT_PUBLIC_CLEEXS_FOUNDER_WHATSAPP_PHONE=54911…
 * Default: +54 9 11 6015-6473
 */
export const CLEEXS_FOUNDER_WHATSAPP_PHONE_E164 = (
  process.env.NEXT_PUBLIC_CLEEXS_FOUNDER_WHATSAPP_PHONE?.replace(/\D/g, '').trim() ||
  '5491160156473'
) as string;

/** Formato legible AR para UI (+54 9 11 …). */
export function formatCleexsWhatsAppPhoneDisplay(
  digits: string = CLEEXS_WHATSAPP_PHONE_E164
): string {
  const d = digits.replace(/\D/g, '');
  if (d.startsWith('549') && d.length >= 12) {
    const area = d.slice(3, 5);
    const rest = d.slice(5);
    const a = rest.slice(0, 4);
    const b = rest.slice(4);
    return `+54 9 ${area} ${a}${b ? `-${b}` : ''}`.trim();
  }
  return d ? `+${d}` : '—';
}

/** Contacto general (soporte, ventas, consultas). */
export const CLEEXS_CONTACT_EMAIL = 'info@cleexs.net' as const;

/** Foto del fundador (onboarding / cafecito). */
export const CLEEXS_FOUNDER_PHOTO_URL = '/gonzalo-founder.png' as const;

/**
 * Video de Gonzalo en la pantalla “cafecito” del onboarding.
 * Acepta URL completa o solo el ID vía NEXT_PUBLIC_ONBOARDING_YOUTUBE_URL.
 */
export const CLEEXS_ONBOARDING_YOUTUBE_VIDEO_ID = (() => {
  const fromEnv =
    process.env.NEXT_PUBLIC_ONBOARDING_YOUTUBE_URL?.trim() ||
    process.env.NEXT_PUBLIC_ONBOARDING_YOUTUBE_VIDEO_ID?.trim();
  if (!fromEnv || fromEnv === 'off') return 'o9cgoy7MaxA';
  return parseYoutubeVideoId(fromEnv) ?? 'o9cgoy7MaxA';
})();

export const CLEEXS_SOCIAL_LINKS = {
  instagram: 'https://www.instagram.com/cleexsnet/',
  youtube: 'https://www.youtube.com/@cleexsnet',
  twitter: 'https://x.com/cleexsnet',
} as const;
