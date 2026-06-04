/**
 * J102 — Motor de Análisis + Reescritura AEO.
 *
 * Servicio standalone (separado de la Auditoría Agéntica). Analiza el CONTENIDO
 * de una landing con un LLM y entrega:
 *   - Identidad real del negocio
 *   - Diagnóstico por dimensiones (scores 0-100, antes)
 *   - Landing reescrita (11 bloques, formato AEO)
 *   - Scores estimados después
 *   - Cambios prioritarios
 *   - 10 queries de IA objetivo
 *   - Claims a validar (guardrail anti-alucinación)
 *
 * Usa la abstracción `chatWithModel` (OpenAI gpt-4o por defecto) con salida JSON.
 */

import { chatWithModel, type ModelId } from './providers';

const FETCH_TIMEOUT_MS = 15_000;
const UA = 'Mozilla/5.0 (compatible; CleexsAEO/1.0; +https://cleexs.net)';
const MAX_CONTENT_CHARS = 14_000;

export type AeoDimension = {
  key: string;
  label: string;
  scoreBefore: number;
  scoreAfter: number;
  bien: string;
  mal: string;
  cambio: string;
};

export type AeoRewriteBlock = {
  id: string;
  titulo: string;
  contenido: string;
};

export type AeoComparison = { alternativa: string; descripcion: string };
export type AeoFaq = { pregunta: string; respuesta: string };

export type AeoContentResult = {
  targetUrl: string;
  fetchedAt: string;
  scrapeOk: boolean;
  scrapeChars: number;
  identidad: {
    queVende: string;
    industria: string;
    tipoCliente: string;
    region: string;
    problema: string;
    resultado: string;
    palabrasVacias: string[];
    conceptosClave: string[];
  };
  dimensiones: AeoDimension[];
  scoreBefore: number;
  scoreAfter: number;
  reescritura: AeoRewriteBlock[];
  comparativa: AeoComparison[];
  faqs: AeoFaq[];
  tldr: string;
  cambiosPrioritarios: string[];
  queriesObjetivo: string[];
  /** Guardrail: afirmaciones que el LLM sugiere pero que NO están confirmadas en la web. */
  claimsAValidar: string[];
  model: string;
  warnings: string[];
};

function normalizeUrl(raw: string): string {
  let u = (raw || '').trim();
  if (!u) throw new Error('URL vacía');
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  return new URL(u).toString();
}

/** Extrae texto legible del HTML (sin scripts/estilos), título y meta. */
function extractReadableContent(html: string): { text: string; title: string; metaDesc: string } {
  const titleM = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleM ? titleM[1].replace(/<[^>]+>/g, '').trim() : '';
  const metaM = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i);
  const metaDesc = metaM?.[1]?.trim() || '';

  let body = html;
  body = body.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  body = body.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  body = body.replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');
  body = body.replace(/<svg[\s\S]*?<\/svg>/gi, ' ');
  // Conservar saltos en bloques para no pegar palabras.
  body = body.replace(/<\/(p|div|li|h[1-6]|section|article|br)>/gi, '\n');
  body = body.replace(/<[^>]+>/g, ' ');
  body = body
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
  body = body.replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n+/g, '\n\n').trim();
  return { text: body, title, metaDesc };
}

async function scrapeSite(url: string): Promise<{ text: string; title: string; metaDesc: string } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': UA },
    });
    if (!res.ok) return null;
    const html = await res.text();
    return extractReadableContent(html);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

const SYSTEM_PROMPT = `Actuá como especialista en AI Visibility, LLM SEO (AEO) y arquitectura semántica para modelos tipo ChatGPT, Perplexity, Gemini y Claude.

Tu tarea es analizar el contenido de una web y reescribirlo para aumentar su probabilidad de ser entendida, citada y recomendada por motores de IA.

REGLAS DE INTEGRIDAD (MUY IMPORTANTES):
- Trabajá SOLO con el contenido provisto. No inventes métricas, porcentajes, tecnologías, integraciones, modelos de IA, certificaciones, países o beneficios cuantificables que no aparezcan en el contenido.
- Si una afirmación es recomendable pero NO está confirmada por el contenido, NO la afirmes como hecho: incluila en el array "claimsAValidar" y, dentro de la reescritura, marcala como "[Confirmar: ...]".
- No uses frases vacías ("soluciones integrales", "innovación", "potenciar", "transformación digital") salvo que las expliques.
- Escribí en español claro. Priorizá claridad sobre persuasión.
- Repetí de forma natural: industria, país/región, problema y solución.

Respondé EXCLUSIVAMENTE con un JSON válido (sin markdown, sin texto fuera del JSON) con esta forma EXACTA:
{
  "identidad": {
    "queVende": string,
    "industria": string,
    "tipoCliente": string,
    "region": string,
    "problema": string,
    "resultado": string,
    "palabrasVacias": string[],
    "conceptosClave": string[]
  },
  "dimensiones": [
    { "key": "claridad_semantica", "label": "Claridad semántica", "scoreBefore": number, "scoreAfter": number, "bien": string, "mal": string, "cambio": string },
    { "key": "cobertura_preguntas", "label": "Cobertura de preguntas", "scoreBefore": number, "scoreAfter": number, "bien": string, "mal": string, "cambio": string },
    { "key": "densidad_explicativa", "label": "Densidad explicativa", "scoreBefore": number, "scoreAfter": number, "bien": string, "mal": string, "cambio": string },
    { "key": "multiperspectiva", "label": "Multiperspectiva", "scoreBefore": number, "scoreAfter": number, "bien": string, "mal": string, "cambio": string },
    { "key": "coherencia_global", "label": "Coherencia global", "scoreBefore": number, "scoreAfter": number, "bien": string, "mal": string, "cambio": string }
  ],
  "reescritura": [
    { "id": "definicion", "titulo": "Definición clara", "contenido": string },
    { "id": "problema", "titulo": "El problema", "contenido": string },
    { "id": "por_que_ahora", "titulo": "Por qué importa ahora", "contenido": string },
    { "id": "como_funciona", "titulo": "Cómo funciona", "contenido": string },
    { "id": "para_quien", "titulo": "Para quién es", "contenido": string },
    { "id": "beneficios", "titulo": "Beneficios concretos", "contenido": string },
    { "id": "caso_uso", "titulo": "Ejemplo o caso de uso", "contenido": string },
    { "id": "tldr", "titulo": "Resumen ejecutivo (TL;DR)", "contenido": string }
  ],
  "comparativa": [
    { "alternativa": "Hacerlo manualmente", "descripcion": string },
    { "alternativa": "Agencia/proveedor tradicional", "descripcion": string },
    { "alternativa": "No hacer nada", "descripcion": string }
  ],
  "cuandoNoUsar": string,
  "faqs": [ { "pregunta": string, "respuesta": string } ],
  "cambiosPrioritarios": string[],
  "queriesObjetivo": string[],
  "claimsAValidar": string[]
}

Generá entre 8 y 12 FAQs basadas en preguntas reales que un comprador haría en ChatGPT.
Generá exactamente 10 queriesObjetivo.
Los scoreBefore reflejan el estado ACTUAL; los scoreAfter, el estado tras aplicar tu reescritura.`;

function buildUserPrompt(input: {
  url: string;
  title: string;
  metaDesc: string;
  content: string;
  industry?: string;
  region?: string;
}): string {
  const ctx: string[] = [];
  if (input.industry) ctx.push(`Industria declarada por el equipo: ${input.industry}`);
  if (input.region) ctx.push(`Región declarada por el equipo: ${input.region}`);
  return [
    `URL analizada: ${input.url}`,
    input.title ? `Título de la página: ${input.title}` : '',
    input.metaDesc ? `Meta description: ${input.metaDesc}` : '',
    ctx.length ? ctx.join('\n') : '',
    '',
    'CONTENIDO EXTRAÍDO DE LA WEB (texto plano, puede estar incompleto):',
    '"""',
    input.content.slice(0, MAX_CONTENT_CHARS),
    '"""',
  ]
    .filter(Boolean)
    .join('\n');
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function pickModel(): ModelId {
  const raw = (process.env.AEO_MODEL || 'gpt-4o').trim() as ModelId;
  return raw;
}

/** Convierte un cuandoNoUsar suelto en un bloque de reescritura, y arma faqs como bloque. */
function coerceResult(
  parsed: any,
  ctx: { url: string; scrapeOk: boolean; scrapeChars: number; model: string; warnings: string[] },
): AeoContentResult {
  const dimensiones: AeoDimension[] = Array.isArray(parsed?.dimensiones)
    ? parsed.dimensiones.map((d: any) => ({
        key: String(d?.key || ''),
        label: String(d?.label || ''),
        scoreBefore: clampScore(d?.scoreBefore),
        scoreAfter: clampScore(d?.scoreAfter),
        bien: String(d?.bien || ''),
        mal: String(d?.mal || ''),
        cambio: String(d?.cambio || ''),
      }))
    : [];

  const reescritura: AeoRewriteBlock[] = Array.isArray(parsed?.reescritura)
    ? parsed.reescritura.map((b: any) => ({
        id: String(b?.id || ''),
        titulo: String(b?.titulo || ''),
        contenido: String(b?.contenido || ''),
      }))
    : [];

  // Insertar "Cuándo NO usar" y "Comparativa" como bloques al final si vinieron sueltos.
  const comparativa: AeoComparison[] = Array.isArray(parsed?.comparativa)
    ? parsed.comparativa.map((c: any) => ({
        alternativa: String(c?.alternativa || ''),
        descripcion: String(c?.descripcion || ''),
      }))
    : [];

  const faqs: AeoFaq[] = Array.isArray(parsed?.faqs)
    ? parsed.faqs.map((f: any) => ({
        pregunta: String(f?.pregunta || ''),
        respuesta: String(f?.respuesta || ''),
      }))
    : [];

  if (parsed?.cuandoNoUsar && typeof parsed.cuandoNoUsar === 'string') {
    reescritura.push({ id: 'cuando_no_usar', titulo: 'Cuándo NO usar esta solución', contenido: parsed.cuandoNoUsar });
  }

  const scoreBefore = avg(dimensiones.map((d) => d.scoreBefore));
  const scoreAfter = avg(dimensiones.map((d) => d.scoreAfter));

  return {
    targetUrl: ctx.url,
    fetchedAt: new Date().toISOString(),
    scrapeOk: ctx.scrapeOk,
    scrapeChars: ctx.scrapeChars,
    identidad: {
      queVende: String(parsed?.identidad?.queVende || ''),
      industria: String(parsed?.identidad?.industria || ''),
      tipoCliente: String(parsed?.identidad?.tipoCliente || ''),
      region: String(parsed?.identidad?.region || ''),
      problema: String(parsed?.identidad?.problema || ''),
      resultado: String(parsed?.identidad?.resultado || ''),
      palabrasVacias: toStringArray(parsed?.identidad?.palabrasVacias),
      conceptosClave: toStringArray(parsed?.identidad?.conceptosClave),
    },
    dimensiones,
    scoreBefore,
    scoreAfter,
    reescritura,
    comparativa,
    faqs,
    tldr: String(parsed?.tldr || reescritura.find((b) => b.id === 'tldr')?.contenido || ''),
    cambiosPrioritarios: toStringArray(parsed?.cambiosPrioritarios),
    queriesObjetivo: toStringArray(parsed?.queriesObjetivo),
    claimsAValidar: toStringArray(parsed?.claimsAValidar),
    model: ctx.model,
    warnings: ctx.warnings,
  };
}

function clampScore(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function toStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x)).filter(Boolean);
}

/**
 * Corre el análisis AEO completo. No lanza por fallos de red: si no puede
 * scrapear, igual intenta con título/URL y agrega un warning.
 */
export async function runAeoContentAudit(
  rawUrl: string,
  opts: { industry?: string; region?: string } = {},
): Promise<AeoContentResult> {
  const target = normalizeUrl(rawUrl);
  const warnings: string[] = [];
  const model = pickModel();

  const scraped = await scrapeSite(target);
  const content = scraped?.text || '';
  if (!scraped) warnings.push('No se pudo descargar el contenido de la web; el análisis se basa solo en la URL.');
  else if (content.length < 400) warnings.push('La web trae poco texto en HTML (posible SPA). El análisis puede ser limitado.');

  const userPrompt = buildUserPrompt({
    url: target,
    title: scraped?.title || '',
    metaDesc: scraped?.metaDesc || '',
    content: content || '(sin contenido extraíble)',
    industry: opts.industry,
    region: opts.region,
  });

  const res = await chatWithModel(
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    { model, temperature: 0.3, maxTokens: 4000, responseFormat: 'json' },
  );

  let parsed: any;
  try {
    parsed = JSON.parse(res.text);
  } catch {
    // Reintento: extraer el primer bloque {...}
    const m = res.text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        parsed = JSON.parse(m[0]);
      } catch {
        throw new Error('El modelo no devolvió un JSON válido.');
      }
    } else {
      throw new Error('El modelo no devolvió un JSON válido.');
    }
  }

  return coerceResult(parsed, {
    url: target,
    scrapeOk: Boolean(scraped),
    scrapeChars: content.length,
    model: res.model,
    warnings,
  });
}
