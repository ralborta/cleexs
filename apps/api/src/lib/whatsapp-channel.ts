/**
 * Canal WhatsApp TV: BuilderBot enruta mensajes; Cleexs solo analiza URLs y avisa al terminar.
 */

const URL_IN_TEXT =
  /(?:https?:\/\/)?(?:www\.)?([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+)(?:\/[^\s]*)?/gi;

const URL_PREFIX_NOISE =
  /^(?:hola[,!.\s]*)?(?:soy de cleexs(?:\.net)?[,.!\s]*)?(?:el\s+)?(?:url|link|sitio|web|dominio)\s*(?:de\s+mi\s+empresa\s*)?(?:es\s*)?/i;

const CLEEXS_FAQ =
  /\b(qu[eé]\s+es\s+cleexs|cleexs\s+score|es\s+gratis|precio|chatgpt|c[oó]mo\s+funciona|cleexs\.net)\b/i;

/**
 * Prompt del flow «Consultas IA» en BuilderBot (add_chatpdf + base de conocimiento).
 * Copiar en assistantInstructions; los docs ampliados van en file search / vector store.
 */
export const BUILDERBOT_FAQ_ASSISTANT_PROMPT = `Sos el asistente oficial de Cleexs.net en WhatsApp (campaña diagnóstico gratis por QR/TV).

IDIOMA Y FORMATO
- Español rioplatense, tono claro y profesional.
- Máximo 4 líneas por mensaje (WhatsApp).
- Sin listas largas ni markdown complejo.

QUÉ ES CLEEXS (podés ampliar con la base de conocimiento adjunta)
- Cleexs ayuda a marcas y empresas a entender y mejorar su visibilidad en respuestas de inteligencia artificial (ChatGPT, Gemini y similares).
- Analiza si la IA recomienda tu marca frente a competidores en consultas reales de usuarios.
- El Cleexs Score (0 a 100) resume esa visibilidad: más alto = mayor probabilidad de ser mencionado o recomendado.
- El diagnóstico por este canal de WhatsApp es gratuito; el informe detallado se abre en el celular (app.cleexs.net).
- Cleexs no es un chat genérico ni un buscador: es diagnóstico de presencia en IA para tu negocio.

CÓMO SE MIDE (resumen; detalle en documentos si están cargados)
- Se simulan consultas tipo las que haría un usuario en ChatGPT sobre tu rubro y mercado.
- Se observa si tu marca aparece, en qué posición, frente a competidores detectados.
- El score combina señales de mención, contexto y comparación competitiva (no es SEO tradicional ni tráfico web).

QUÉ PODÉS RESPONDER
- Qué es Cleexs, para quién sirve, qué es el Cleexs Score, cómo funciona el diagnóstico por WhatsApp.
- Si es gratis por acá, tiempos aproximados (unos minutos tras enviar la URL), qué reciben (score + link al informe).
- Diferencia entre visibilidad en Google/SEO y visibilidad en IA.
- Cómo empezar: necesitamos la URL del sitio web de su empresa.

FUERA DE ALCANCE — RECHAZÁ SIEMPRE (respuesta fija corta, sin inventar)
- Clima, deportes, política, salud personal, recetas, chistes, tareas escolares, código, traducciones largas.
- Opiniones sobre terceros, noticias del día, temas personales no relacionados con Cleexs.
- Pedidos de análisis sin URL, scores inventados, precios exactos de planes si no están en los documentos.
Plantilla de rechazo: "Solo puedo ayudarte con Cleexs y tu diagnóstico de visibilidad en IA. Pasame la URL de tu empresa (ej. empresa.com) o preguntame qué es el Cleexs Score."

SI ENVÍAN URL DE SU EMPRESA
- No digas que ya analizaste ni des un score.
- Respondé: "Perfecto. Enviá solo la URL en un mensaje (ej. tuempresa.com) y en minutos te llega tu Cleexs Score por acá."

REGLAS ESTRICTAS
- Usá la base de conocimiento cuando exista; si no hay dato, decí que más info está en https://cleexs.net — no inventes cifras ni promesas.
- No pidas email, tarjeta ni contraseñas en este chat.
- No des asesoramiento legal, médico ni financiero.
- Terminá casi siempre invitando a pasar la URL del sitio si aún no la dieron.`;

/** Extrae dominio/URL (http/https, www, rutas). Síncrono, sin IA. */
export function extractUrlFromWhatsAppMessage(message: string): string | null {
  const text = `${message || ''}`.trim().replace(URL_PREFIX_NOISE, '').trim();
  if (!text) return null;

  for (const m of text.matchAll(URL_IN_TEXT)) {
    const host = (m[1] || '').toLowerCase();
    if (host.length < 4 || host.endsWith('.png') || host.endsWith('.jpg')) continue;
    const raw = m[0].trim();
    return raw.startsWith('http') ? raw : `https://${raw.replace(/^www\./i, '')}`;
  }
  return null;
}

/**
 * Para el plugin HTTP del flow URL: regex primero; si falla, IA extrae el sitio del texto ({body}).
 */
export async function resolveWebsiteUrlFromWhatsAppMessage(message: string): Promise<string | null> {
  const quick = extractUrlFromWhatsAppMessage(message);
  if (quick) return quick;

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const text = `${message || ''}`.trim().slice(0, 2000);
  if (text.length < 4) return null;

  try {
    const model = process.env.DIAGNOSTIC_AI_OPENAI_MODEL?.trim() || 'gpt-4o-mini';
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 120,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'wa_url_extract',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                url: { type: ['string', 'null'], description: 'Dominio o URL del sitio de la empresa' },
              },
              required: ['url'],
              additionalProperties: false,
            },
          },
        },
        messages: [
          {
            role: 'system',
            content:
              'Extraé SOLO la URL o dominio del sitio web de la empresa del mensaje de WhatsApp. ' +
              'Si no hay sitio claro, url=null. Sin explicación.',
          },
          { role: 'user', content: text },
        ],
      }),
      signal: AbortSignal.timeout(12_000),
    });
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = json?.choices?.[0]?.message?.content;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { url?: string | null };
    const candidate = `${parsed.url || ''}`.trim();
    if (!candidate) return null;
    return extractUrlFromWhatsAppMessage(candidate) ?? extractUrlFromWhatsAppMessage(text);
  } catch {
    return null;
  }
}

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
  return `${headerValue || ''}`.trim() === expected;
}

export function getWaChannelDailyLimit(): number {
  const n = Number(process.env.WA_CHANNEL_DAILY_LIMIT || 5);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 50) : 5;
}

export function getWaCompetitorWaitMs(): number {
  const n = Number(process.env.WA_CHANNEL_COMPETITOR_WAIT_MS || 90_000);
  return Number.isFinite(n) && n > 10_000 ? Math.min(n, 180_000) : 90_000;
}

export function buildWhatsAppTeaserLine(
  cleexsScore: number | null,
  analysisJson: unknown
): string {
  if (analysisJson && typeof analysisJson === 'object' && !Array.isArray(analysisJson)) {
    const o = analysisJson as Record<string, unknown>;
    const open =
      o.tier === 'gold' && o.analisisOpenAI && typeof o.analisisOpenAI === 'object'
        ? (o.analisisOpenAI as { resumenEjecutivo?: string })
        : null;
    const line = open?.resumenEjecutivo?.trim() || (o as { resumenEjecutivo?: string }).resumenEjecutivo?.trim();
    if (line) return line.slice(0, 120);
  }
  if (cleexsScore == null) return 'Tu diagnóstico está listo.';
  if (cleexsScore >= 70) return 'Buena visibilidad en ChatGPT.';
  if (cleexsScore >= 45) return 'Visibilidad media en ChatGPT.';
  return 'Hay margen para mejorar en ChatGPT.';
}

/** Ack inmediato tras HTTP (flow URL en BuilderBot). */
export function buildWhatsAppStillRunningReply(domain: string, resultUrl: string): string {
  return `Seguimos con *${domain}*…\n${resultUrl}`;
}

export function buildWhatsAppStartedReply(domain: string, resultUrl: string): string {
  return (
    `Perfecto, analizamos *${domain}*.\n` +
    `En unos minutos te enviamos tu Cleexs Score por acá.\n` +
    `${resultUrl}`
  );
}

/** Mensaje final: backend → API BuilderBot (cuando termina el análisis). */
export function buildWhatsAppCompletedReply(params: {
  domain: string;
  brandName: string;
  cleexsScore: number;
  teaserLine: string;
  resultUrl: string;
}): string {
  const { domain, brandName, cleexsScore, teaserLine, resultUrl } = params;
  return (
    `*${brandName}* · Cleexs Score: *${Math.round(cleexsScore)}/100*\n` +
    `${teaserLine}\n\n` +
    `Informe: ${resultUrl}`
  );
}

export function buildWhatsAppErrorReply(code: string, fallback?: string): string {
  if (code === 'rate_limited') return 'Límite diario alcanzado. Probá mañana.';
  if (code === 'service_unavailable') return 'No disponible ahora. Intentá en unos minutos.';
  return fallback || 'No pudimos analizar esa URL. Revisala e intentá de nuevo.';
}

export function buildWhatsAppAskUrlReply(): string {
  return 'Pasame la URL de tu empresa (ej. tudominio.com) y te damos gratis tu Cleexs Score.';
}

export function buildWhatsAppCleexsFaqReply(): string {
  return (
    'Cleexs mide si ChatGPT recomienda tu marca (score 0-100). Es gratis.\n\n' +
    'Pasame la URL de tu sitio, ej. empresa.com'
  );
}

export function buildWhatsAppMissingUrlReply(): string {
  return buildWhatsAppAskUrlReply();
}

export function isCleexsFaqOnlyMessage(message: string): boolean {
  const text = `${message || ''}`.trim();
  return text.length >= 6 && !extractUrlFromWhatsAppMessage(text) && CLEEXS_FAQ.test(text);
}

export function buildWaMeCampaignUrl(phoneE164Digits: string, prefilledText?: string): string {
  const digits = phoneE164Digits.replace(/\D/g, '');
  const text = prefilledText ?? 'Hola, soy de Cleexs.net. El url de mi empresa es ';
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
