/**
 * Utilidades para el canal WhatsApp (QR TV/YouTube → BuilderBot → API).
 */

const URL_IN_TEXT =
  /(?:https?:\/\/)?(?:www\.)?([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+)(?:\/[^\s]*)?/gi;

/** Extrae la primera URL o dominio plausible del mensaje de WhatsApp. */
export function extractUrlFromWhatsAppMessage(message: string): string | null {
  const text = `${message || ''}`.trim();
  if (!text) return null;

  const matches = [...text.matchAll(URL_IN_TEXT)];
  for (const m of matches) {
    const host = (m[1] || '').toLowerCase();
    if (!host || host.length < 4) continue;
    if (host.endsWith('.png') || host.endsWith('.jpg') || host.endsWith('.jpeg')) continue;
    const raw = m[0].trim();
    return raw.startsWith('http') ? raw : `https://${raw.replace(/^www\./i, '')}`;
  }

  const noUrlPhrases = /^(no tengo|sin web|no tengo web|no tengo sitio|no tengo página)/i;
  if (noUrlPhrases.test(text)) return null;

  return null;
}

/** Normaliza teléfono a dígitos con prefijo (sin +). Ej: 54911xxxxxxxx */
export function normalizeWaPhone(phone: string): string | null {
  const digits = `${phone || ''}`.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

export function waPlaceholderEmail(normalizedPhone: string): string {
  return `wa+${normalizedPhone}@whatsapp.cleexs.net`;
}

export function buildWaResultUrl(diagnosticId: string, baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, '');
  return `${base}/r/wa/${encodeURIComponent(diagnosticId)}`;
}

export function isWhatsAppSourceChannel(channel: string | null | undefined): boolean {
  return !!channel && channel.startsWith('whatsapp');
}

export function verifyWhatsAppChannelApiKey(headerValue: string | undefined): boolean {
  const expected = process.env.WHATSAPP_CHANNEL_API_KEY?.trim();
  if (!expected) return false;
  const got = `${headerValue || ''}`.trim();
  return got.length > 0 && got === expected;
}

export function getWaChannelDailyLimit(): number {
  const n = Number(process.env.WA_CHANNEL_DAILY_LIMIT || 5);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 50) : 5;
}

export function getWaCompetitorWaitMs(): number {
  const n = Number(process.env.WA_CHANNEL_COMPETITOR_WAIT_MS || 90_000);
  return Number.isFinite(n) && n > 10_000 ? Math.min(n, 180_000) : 90_000;
}

/** Resumen corto para el mensaje de respuesta del bot. */
export function buildWhatsAppTeaserLine(
  cleexsScore: number | null,
  analysisJson: unknown
): string {
  if (analysisJson && typeof analysisJson === 'object' && !Array.isArray(analysisJson)) {
    const o = analysisJson as Record<string, unknown>;
    if (o.tier === 'gold' && o.analisisOpenAI && typeof o.analisisOpenAI === 'object') {
      const open = o.analisisOpenAI as { resumenEjecutivo?: string };
      if (open.resumenEjecutivo?.trim()) {
        return open.resumenEjecutivo.trim().slice(0, 200);
      }
    }
    const single = o as { resumenEjecutivo?: string };
    if (single.resumenEjecutivo?.trim()) {
      return single.resumenEjecutivo.trim().slice(0, 200);
    }
  }
  if (cleexsScore == null) return 'Tu diagnóstico está listo.';
  if (cleexsScore >= 70) return 'Buena probabilidad de que ChatGPT te recomiende en consultas clave.';
  if (cleexsScore >= 45) return 'Probabilidad media de recomendación en ChatGPT; hay margen de mejora.';
  return 'Probabilidad baja de recomendación en ChatGPT; el diagnóstico muestra cómo mejorar.';
}

export type WaInboundIntent = 'url' | 'no_web' | 'empty' | 'unclear';

export function classifyWaInboundMessage(message: string): WaInboundIntent {
  const text = `${message || ''}`.trim();
  if (!text) return 'empty';
  if (/^(no tengo|sin web|no tengo web|no tengo sitio|no tengo página|no tengo dominio|solo instagram|solo red)/i.test(text)) {
    return 'no_web';
  }
  if (extractUrlFromWhatsAppMessage(text)) return 'url';
  if (text.length < 4) return 'empty';
  return 'unclear';
}

export function buildWhatsAppNoUrlReply(): string {
  return (
    'Para el diagnóstico gratis necesitamos la URL de tu sitio (ej. tudominio.com).\n\n' +
    'Si no tenés web, escribinos por ahora la URL de tu perfil principal (LinkedIn o Instagram con link en bio).'
  );
}

export function buildWhatsAppNeedUrlReply(): string {
  return (
    'Hola, soy Cleexs.net 👋\n\n' +
    'Pasame la URL de tu empresa (ej. tudominio.com) y te digo gratis tu Cleexs Score y qué tan probable es que ChatGPT te recomiende.'
  );
}

export function buildWhatsAppStartedReply(domain: string, resultUrl: string): string {
  return (
    `Perfecto, analizamos *${domain}*.\n\n` +
    `En 2 a 4 minutos te enviamos tu *Cleexs Score* y el link al diagnóstico en el celular.\n\n` +
    `Podés ir abriendo:\n${resultUrl}`
  );
}

export function buildWhatsAppStillRunningReply(domain: string, resultUrl: string): string {
  return (
    `Seguimos analizando *${domain}*… casi listo.\n\n` +
    `Abrí el diagnóstico en tu celular:\n${resultUrl}`
  );
}

export function buildWhatsAppCompletedReply(params: {
  domain: string;
  brandName: string;
  cleexsScore: number;
  teaserLine: string;
  resultUrl: string;
}): string {
  const { domain, brandName, cleexsScore, teaserLine, resultUrl } = params;
  const scoreRounded = Math.round(cleexsScore);
  return (
    `¡Listo! *${brandName}* (${domain})\n\n` +
    `*Cleexs Score: ${scoreRounded}/100*\n` +
    `${teaserLine}\n\n` +
    `Mirá el diagnóstico completo en el celular:\n${resultUrl}`
  );
}

export function buildWhatsAppErrorReply(code: string, fallback?: string): string {
  if (code === 'rate_limited') {
    return 'Alcanzaste el límite de diagnósticos gratis por hoy. Volvé mañana o escribinos a hola@cleexs.net';
  }
  if (code === 'needs_competitors') {
    return (
      'No pudimos detectar competidores automáticamente. Mandanos una URL de un competidor (ej. competidor.com) y relanzamos el análisis.'
    );
  }
  if (code === 'service_unavailable') {
    return 'El análisis no está disponible en este momento. Intentá de nuevo en unos minutos.';
  }
  return fallback || 'No pudimos iniciar el diagnóstico. Revisá la URL e intentá de nuevo.';
}

/** Enlace wa.me para QR de campaña TV/YouTube. */
export function buildWaMeCampaignUrl(phoneE164Digits: string, prefilledText?: string): string {
  const digits = phoneE164Digits.replace(/\D/g, '');
  const text =
    prefilledText ??
    'Hola, soy de Cleexs.net. El url de mi empresa es ';
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
