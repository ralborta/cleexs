/** Normaliza código ref/UTM (misma regla que diagnóstico web). */
export function normalizeSponsorTrackingCode(input: string): string | undefined {
  const cleaned = input.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (!cleaned) return undefined;
  return cleaned.slice(0, 120);
}

export function slugifySponsorDisplayName(label: string): string {
  return normalizeSponsorTrackingCode(label.trim().replace(/\s+/g, '_')) ?? '';
}

export type SponsorWhatsAppMessageInput = {
  /** Nombre visible del auspiciador (ej. "Radio La Red"). */
  sponsorDisplayName: string;
  /** Código ref para tracking en BD (slug). Si falta, se deriva del nombre. */
  refCode?: string;
  /** Mensaje principal editable; si falta, se usa la plantilla por defecto. */
  customBody?: string;
};

const DEFAULT_BODY_TEMPLATE =
  'El Cleexs Score y el diagnóstico de tu marca en ChatGPT son gratis gracias a {sponsor}';

/** Línea de cortesía visible en el chat. */
export function buildSponsorGentilezaLine(sponsorDisplayName: string): string {
  const name = sponsorDisplayName.trim();
  return name ? `Gentileza de ${name}` : '';
}

/** Cuerpo del mensaje (sin la línea ref interna). */
export function buildSponsorWhatsAppPublicMessage(input: SponsorWhatsAppMessageInput): string {
  const sponsor = input.sponsorDisplayName.trim();
  const custom = input.customBody?.trim();
  if (custom) {
    return custom.includes('{sponsor}')
      ? custom.replace(/\{sponsor\}/g, sponsor || 'nuestro auspiciador')
      : custom;
  }
  if (!sponsor) return DEFAULT_BODY_TEMPLATE.replace('{sponsor}', 'nuestro auspiciador');
  return DEFAULT_BODY_TEMPLATE.replace('{sponsor}', sponsor);
}

/**
 * Mensaje completo para wa.me: gentileza + cuerpo + ref interno (parseado en API al recibir la URL).
 */
export function buildSponsorWhatsAppPrefillMessage(input: SponsorWhatsAppMessageInput): string {
  const sponsor = input.sponsorDisplayName.trim();
  const ref =
    normalizeSponsorTrackingCode(input.refCode || '') || slugifySponsorDisplayName(sponsor);
  const parts: string[] = [];
  const gentileza = buildSponsorGentilezaLine(sponsor);
  if (gentileza) parts.push(gentileza);
  parts.push(buildSponsorWhatsAppPublicMessage(input));
  if (ref) parts.push(`ref:${ref}`);
  return parts.join('\n\n');
}

/** Extrae ref del mensaje entrante (QR / copy-paste). */
export function extractSponsorRefFromWhatsAppMessage(message: string): {
  refCode?: string;
  sponsorDisplayName?: string;
} {
  const text = `${message || ''}`.trim();
  if (!text) return {};

  const refTag = text.match(/\bref:\s*([a-z0-9_-]{2,120})\b/i);
  if (refTag) {
    const refCode = normalizeSponsorTrackingCode(refTag[1]);
    if (refCode) return { refCode };
  }

  const gracias = text.match(/gracias a\s+([^\n]+?)(?:\s*\n\n|\s*ref:|\s*$)/i);
  if (gracias) {
    const sponsorDisplayName = gracias[1].trim();
    const refCode = slugifySponsorDisplayName(sponsorDisplayName);
    if (refCode) return { refCode, sponsorDisplayName };
  }

  const gentileza = text.match(/gentileza de\s+([^\n]+?)(?:\s*\n\n|\s*ref:|\s*$)/i);
  if (gentileza) {
    const sponsorDisplayName = gentileza[1].trim();
    const refCode = slugifySponsorDisplayName(sponsorDisplayName);
    if (refCode) return { refCode, sponsorDisplayName };
  }

  return {};
}

export function buildWaMeUrl(phoneE164Digits: string, prefilledText: string): string | null {
  const digits = phoneE164Digits.replace(/\D/g, '');
  if (digits.length < 10) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(prefilledText)}`;
}
