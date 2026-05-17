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
