import { CLEEXS_FOUNDER_WHATSAPP_PHONE_E164 } from '@/lib/site';

export function buildOnboardingWhatsAppHref(name: string, domain: string): string {
  const text = `Hola Gonzalo, soy ${name} de ${domain}. Te escribo porque quiero contarte por qué hice el análisis de Cleexs…`;
  return `https://wa.me/${CLEEXS_FOUNDER_WHATSAPP_PHONE_E164.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
}

export function onboardingWhatsAppDisplayName(email: string, fallback = 'Usuario'): string {
  const local = email.trim().split('@')[0]?.trim();
  if (!local) return fallback;
  const word = local.split(/[._-]/)[0]?.trim();
  if (!word) return fallback;
  return word.charAt(0).toUpperCase() + word.slice(1);
}
