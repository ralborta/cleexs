/**
 * Canal WhatsApp TV: BuilderBot enruta mensajes; Cleexs solo analiza URLs y avisa al terminar.
 */

import { isBuilderBotSendConfigured, sendWhatsAppMessage } from './builderbot';

export type WaChannelLog = {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
};

const recentWaOutgoing = new Map<string, number>();
const WA_OUTGOING_DEDUPE_MS = 12_000;

/** Dominios que son solo sufijo público (.edu.ar), no un sitio real. */
export function isPlaceholderPublicSuffixOnlyDomain(domain: string): boolean {
  const d = domain.toLowerCase().replace(/^www\./, '').trim();
  if (!d || !d.includes('.')) return true;
  const parts = d.split('.');
  if (parts.length === 2 && parts[1] === 'ar') {
    return ['com', 'edu', 'gob', 'gov', 'org', 'net', 'mil', 'int', 'tur'].includes(parts[0]);
  }
  const compoundOnly = new Set([
    'com.ar',
    'edu.ar',
    'gob.ar',
    'gov.ar',
    'org.ar',
    'net.ar',
    'mil.ar',
    'int.ar',
    'tur.ar',
  ]);
  return compoundOnly.has(d);
}

/** Envío fiable por API (el flow {{reply}} a veces no llega en el 2.º mensaje). */
export async function deliverWaReplyToUser(
  log: WaChannelLog,
  recipient: string,
  replyText: string
): Promise<void> {
  const text = replyText.trim();
  if (!text || !isBuilderBotSendConfigured()) return;

  const dedupeKey = `${recipient.trim()}:${text}`;
  const now = Date.now();
  const prev = recentWaOutgoing.get(dedupeKey);
  if (prev != null && now - prev < WA_OUTGOING_DEDUPE_MS) {
    log.info({ recipient: recipient.trim() }, 'Canal WA: mensaje duplicado omitido');
    return;
  }
  recentWaOutgoing.set(dedupeKey, now);
  if (recentWaOutgoing.size > 500) {
    for (const [k, t] of recentWaOutgoing) {
      if (now - t > WA_OUTGOING_DEDUPE_MS) recentWaOutgoing.delete(k);
    }
  }

  try {
    await sendWhatsAppMessage({ number: recipient.trim(), message: text, checkIfExists: true });
    log.info({ recipient: recipient.trim() }, 'Canal WA: mensaje enviado por BuilderBot API');
  } catch (err) {
    log.error({ err, recipient: recipient.trim() }, 'Canal WA: error al enviar por BuilderBot API');
  }
}

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
- Español rioplatense, cercano y profesional.
- Máximo 5 líneas por mensaje (WhatsApp).
- Usá emojis con moderación (1-3 por mensaje): 👋 ✨ 📊 🎯 💡 🤖
- Podés usar *negrita* de WhatsApp para resaltar 1-2 palabras clave.
- Sin listas numeradas largas ni bloques densos.

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
- Precios, planes, costos, versión paga y comparación entre planes (ver sección PRECIOS Y PLANES abajo).
- Cómo empezar: necesitamos la URL del sitio web de su empresa.

PRECIOS Y PLANES — OBLIGATORIO
- Ante preguntas de precio, costo, plan, versión paga, Premium o Enterprise: intentá buscar en planes.pdf / faq_cleexs, pero SIEMPRE respondé (no te quedes en silencio).
- Usá esta referencia oficial si file search no trae detalle:
  • *Plan gratis* ($0/mes): Cleexs Score, 1 sitio, motor ChatGPT, reportes esenciales, soporte email.
  • *Premium* ($99/mes; anual con 20% off): ChatGPT + Gemini + Perplexity + Claude, 25 prompts, 10 competidores, alertas, GA, soporte prioritario.
  • *Enterprise*: contactar ventas; múltiples sitios/marcas, prompts y competidores ampliados, soporte dedicado.
- Respondé con nombre de plan, precio USD/mes y 2-3 beneficios concretos. No te quedes solo en "hay versión gratis y otra paga".
- Si falta algún dato puntual, sumá https://cleexs.net/planes — no inventes cifras distintas a las de arriba.

FUERA DE ALCANCE — RECHAZÁ SOLO ESTO (temas ajenos a Cleexs)
- Clima, deportes, política, salud personal, recetas, chistes, tareas escolares, código, traducciones largas.
- Opiniones sobre terceros, noticias del día, temas personales no relacionados con Cleexs.
- Pedidos de análisis sin URL, scores inventados, o precios/planes inventados que NO figuren en los documentos adjuntos.
- NUNCA uses la plantilla de rechazo si preguntan qué es Cleexs, de qué se trata el servicio, cómo funciona, precios, planes, o cualquier follow-up sobre Cleexs (ej. "de q se trata", "explicame", "q paso", "si yo se por eso preguntaba").
Plantilla de rechazo (solo temas ajenos): "🙂 Solo puedo ayudarte con Cleexs y tu visibilidad en IA. Pasame la URL de tu empresa (ej. empresa.com) o preguntame qué es el *Cleexs Score*."

SI TE SALUDAN (hola, buenas, etc.)
- Respondé: "¡Hola! 👋 Soy tu asistente de *Cleexs*. ¿En qué puedo ayudarte? Si querés tu diagnóstico gratis, pasame la URL de tu sitio (ej. empresa.com)."

SI ENVÍAN URL DE SU EMPRESA
- No digas que ya analizaste ni des un score (eso lo envía el sistema automático).
- Respondé breve: "¡Genial! 🙌 Si aún no arrancó solo, mandá la URL en un mensaje aparte (ej. tuempresa.com)."

REGLAS ESTRICTAS
- Para precios/planes: respondé siempre con la referencia de PRECIOS Y PLANES; ampliá con archivos si file search devuelve más detalle.
- Respondé SIEMPRE en cada turno; si la pregunta es sobre Cleexs, nunca te quedes en silencio ni mezcles la plantilla de rechazo con una respuesta válida.
- Si no hay dato en archivos, decí que más info está en https://cleexs.net — no inventes cifras ni promesas.
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

/** Identificador de chat tal como lo envía BuilderBot (teléfono o JID/LID). */
export function waRecipientFromFlowBody(body: unknown): string {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return '';
  const o = body as Record<string, unknown>;
  for (const key of ['recipient', 'chatId', 'jid', 'lid', 'from', 'phone']) {
    const v = o[key];
    if (v != null && `${v}`.trim()) return `${v}`.trim();
  }
  return '';
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

function scoreBandEmoji(score: number): string {
  if (score >= 70) return '🟢';
  if (score >= 45) return '🟡';
  return '🔴';
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
    if (line) return line.slice(0, 140);
  }
  if (cleexsScore == null) return '✨ Tu diagnóstico ya está disponible.';
  if (cleexsScore >= 70) return '💡 Buena visibilidad: ChatGPT suele recomendar tu marca.';
  if (cleexsScore >= 45) return '💡 Visibilidad media: hay espacio para destacar más.';
  return '💡 Hay margen para mejorar tu presencia en ChatGPT.';
}

/** Keywords del flow BBC «Cleexs - Saludo». */
const WA_GREETING_KEYWORDS = new Set([
  'hola',
  'holaa',
  'hola!',
  'buenas',
  'buenas!',
  'buenos dias',
  'buenas tardes',
  'buenas noches',
  'hi',
  'hello',
  'buen dia',
  'hey',
  'que tal',
  'como estas',
  'como andas',
]);

/** Saludo simple (hola, buenas…). */
export function isWaGreetingMessage(message: string): boolean {
  const t = `${message || ''}`.trim().toLowerCase();
  if (!t || t.length > 40) return false;
  if (extractUrlFromWhatsAppMessage(message)) return false;
  const normalized = t.replace(/[¡!?.]+$/g, '').trim();
  return WA_GREETING_KEYWORDS.has(t) || WA_GREETING_KEYWORDS.has(normalized);
}

/** Texto exacto del answer BBC «Cleexs - Saludo». */
export function buildWhatsAppGreetingReply(): string {
  return (
    '¡Hola! 👋 Soy *Cleexs*. Te digo gratis qué tan probable es que ChatGPT recomiende tu marca.\n\n' +
    '👉 Pasame la URL de tu sitio (ej. tuempresa.com).'
  );
}

type WaChatTurn = { role: 'user' | 'assistant'; content: string };
const waAssistantHistory = new Map<string, WaChatTurn[]>();
const WA_ASSISTANT_HISTORY_MAX = 12;

/**
 * Responde como el flow BBC «Cleexs — Consultas IA» (mismo system prompt).
 * Usado por Baileys / BBC Open cuando no hay URL.
 */
export async function replyWhatsAppAssistant(params: {
  phone: string;
  message: string;
}): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const phone = normalizeWaPhone(params.phone) || `${params.phone || ''}`.replace(/\D/g, '');
  const userText = `${params.message || ''}`.trim().slice(0, 2000);
  if (!phone || !userText) return null;

  const prior = waAssistantHistory.get(phone) ?? [];
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: BUILDERBOT_FAQ_ASSISTANT_PROMPT },
    ...prior,
    { role: 'user', content: userText },
  ];

  const model = process.env.DIAGNOSTIC_AI_OPENAI_MODEL?.trim() || 'gpt-4o-mini';
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        max_tokens: 400,
        messages,
      }),
      signal: AbortSignal.timeout(45_000),
    });
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };
    if (!res.ok) {
      throw new Error(json?.error?.message || `OpenAI ${res.status}`);
    }
    const reply = `${json?.choices?.[0]?.message?.content || ''}`.trim();
    if (!reply) return null;

    const next: WaChatTurn[] = [...prior, { role: 'user', content: userText }, { role: 'assistant', content: reply }];
    waAssistantHistory.set(phone, next.slice(-WA_ASSISTANT_HISTORY_MAX));
    return reply;
  } catch {
    return null;
  }
}

/** Ack inmediato: link primero, score llega después en otro mensaje. */
export function buildWhatsAppStartedReply(domain: string, resultUrl: string): string {
  return (
    '✅ *¡Recibido!* Ya analizamos tu sitio\n' +
    `🌐 *${domain}*\n\n` +
    '📱 *Seguí tu informe en vivo:*\n' +
    `${resultUrl}\n\n` +
    '⏳ En *2 a 5 min* te enviamos tu *Cleexs Score* por acá.\n' +
    '_Podés abrir el link mientras tanto._'
  );
}

export function buildWhatsAppStillRunningReply(domain: string, resultUrl: string): string {
  return (
    '⏳ *Seguimos analizando*\n' +
    `🌐 *${domain}*\n\n` +
    '📱 Informe en vivo:\n' +
    `${resultUrl}`
  );
}

/** Re-envío del mismo diagnóstico reciente. */
export function buildWhatsAppAlreadyStartedReply(domain: string, resultUrl: string): string {
  return (
    'ℹ️ *Ya tenemos este análisis*\n' +
    `🌐 *${domain}*\n\n` +
    '📱 Tu informe:\n' +
    `${resultUrl}\n\n` +
    '🔄 Para *otro sitio*, mandá solo la nueva URL en un mensaje.'
  );
}

/** Mensaje final: solo score (el link ya se envió al inicio). */
export function buildWhatsAppCompletedReply(params: {
  domain: string;
  brandName: string;
  cleexsScore: number;
  teaserLine: string;
  resultUrl: string;
}): string {
  const { brandName, cleexsScore, teaserLine, resultUrl } = params;
  const score = Math.round(cleexsScore);
  const emoji = scoreBandEmoji(score);
  return (
    '🎯 *¡Tu Cleexs Score está listo!*\n\n' +
    `${emoji} *${brandName}*\n` +
    `📊 *${score}/100*\n\n` +
    `${teaserLine}\n\n` +
    '👇 *Mirá el informe completo acá:*\n' +
    `${resultUrl}`
  );
}

export function buildWhatsAppErrorReply(code: string, fallback?: string): string {
  if (code === 'rate_limited') {
    return '⏸️ *Límite diario alcanzado*\n\nProbá de nuevo mañana o escribinos en cleexs.net 🙂';
  }
  if (code === 'analysis_in_progress') {
    return (
      fallback ||
      '⏳ *Ya hay un análisis en curso*\n\nEsperá unos minutos o abrí el link que te enviamos antes.'
    );
  }
  if (code === 'invalid_domain') {
    return (
      fallback ||
      '⚠️ *URL incompleta*\n\nEnviá el dominio completo\n_(ej. colegio.edu.ar, no solo .edu.ar)_'
    );
  }
  if (code === 'needs_competitors' || code === 'competitors_timeout' || code === 'pipeline_failed') {
    return (
      fallback ||
      '😕 *No pudimos completar el análisis*\n\nReenviá la URL de tu sitio en un mensaje nuevo.'
    );
  }
  if (code === 'service_unavailable') {
    return '🔧 *Servicio no disponible*\n\nIntentá de nuevo en unos minutos.';
  }
  return fallback || '😕 No pudimos analizar esa URL. Revisala e intentá de nuevo.';
}

export function buildWhatsAppAskUrlReply(): string {
  return (
    '✨ *Cleexs Score gratis*\n\n' +
    'Medimos si la IA (ChatGPT y similares) recomienda tu marca. ' +
    'El *Cleexs Score* (0–100) resume esa visibilidad y por WhatsApp es *gratis* 🎁\n\n' +
    '👉 Pasame la URL de tu empresa _(ej. tuempresa.com)_ y arrancamos 🚀\n\n' +
    '⏳ _El análisis puede demorar unos minutos (entre 2 y 5)._'
  );
}

export function buildWhatsAppCleexsFaqReply(): string {
  return (
    '✨ *Cleexs* mide si la IA (ChatGPT y similares) recomienda tu marca.\n\n' +
    '📊 El *Cleexs Score* (0–100) resume esa visibilidad.\n' +
    '🎁 Por WhatsApp es *gratis*.\n\n' +
    '👉 Pasame la URL de tu sitio _(ej. empresa.com)_ y arrancamos.\n\n' +
    '⏳ _El análisis puede demorar unos minutos (entre 2 y 5)._'
  );
}

/** Envío inmediato al iniciar diagnóstico (link + aviso de espera). */
export async function deliverWaChannelStart(
  log: WaChannelLog,
  recipient: string,
  domain: string,
  resultUrl: string,
  reused: boolean
): Promise<void> {
  const text = reused
    ? buildWhatsAppAlreadyStartedReply(domain, resultUrl)
    : buildWhatsAppStartedReply(domain, resultUrl);
  await deliverWaReplyToUser(log, recipient, text);
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
