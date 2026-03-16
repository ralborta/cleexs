/**
 * IA para el diagnóstico público: determinar industria y competidores
 */

export interface IndustryResult {
  industry: string;
}

export interface CompetitorsResult {
  competitors: string[];
}

export interface CountryResult {
  country: string;
}

export interface MarketProfileResult {
  country: string;
  industry: string;
  confidence: number;
}

interface WebsiteEvidence {
  title?: string;
  metaDescription?: string;
  h1?: string;
  h2?: string;
  sourceUrl?: string;
}

async function callOpenAI(messages: Array<{ role: string; content: string }>, JsonSchema?: object): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      max_tokens: 500,
      messages: messages.map((m) => ({ role: m.role as 'system' | 'user', content: m.content })),
      ...(JsonSchema && {
        response_format: { type: 'json_schema', json_schema: JsonSchema as object },
      }),
    }),
  });

  const json = (await response.json()) as {
    error?: { message?: string };
    choices?: Array<{ message?: { content?: string } }>;
  };
  if (!response.ok) throw new Error(json?.error?.message || 'Error en OpenAI');
  return json?.choices?.[0]?.message?.content?.trim() || '';
}

function stripHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractFirstMatch(html: string, regex: RegExp): string | undefined {
  const m = html.match(regex);
  const raw = m?.[1]?.trim();
  if (!raw) return undefined;
  return stripHtml(raw).slice(0, 220);
}

async function fetchWebsiteEvidence(url?: string): Promise<WebsiteEvidence | null> {
  if (!url) return null;
  const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(normalized, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'CleexsBot/1.0 (+https://cleexs.com)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!response.ok) return null;
    const html = await response.text();
    const title = extractFirstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
    const metaDescription =
      extractFirstMatch(html, /<meta[^>]+name=["']description["'][^>]*content=["']([\s\S]*?)["'][^>]*>/i) ||
      extractFirstMatch(html, /<meta[^>]+content=["']([\s\S]*?)["'][^>]*name=["']description["'][^>]*>/i);
    const h1 = extractFirstMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const h2 = extractFirstMatch(html, /<h2[^>]*>([\s\S]*?)<\/h2>/i);
    return { title, metaDescription, h1, h2, sourceUrl: normalized };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Determina el tipo de industria de una marca (con URL opcional como contexto)
 */
export async function determineIndustry(
  brandName: string,
  url?: string,
  country?: string
): Promise<IndustryResult> {
  const context = url ? ` URL/sitio: ${url}` : '';
  const marketContext = country ? ` País/mercado objetivo: ${country}.` : '';
  const content = await callOpenAI([
    {
      role: 'system',
      content:
        'Respondé SOLO con un JSON válido. Ejemplo: {"industry": "Restaurantes italianos"}. ' +
        'La industria debe ser específica y en español, 2-5 palabras.',
    },
    {
      role: 'user',
      content: `¿Qué tipo de industria o sector es la marca "${brandName}"?${context}${marketContext}\n\nRespuesta (solo JSON):`,
    },
  ]);

  try {
    const parsed = JSON.parse(content) as { industry?: string };
    const industry = `${parsed.industry || 'General'}`.trim() || 'General';
    return { industry };
  } catch {
    return { industry: 'General' };
  }
}

/**
 * Selecciona los 5 mejores competidores para una marca en una industria
 */
export async function getTop5Competitors(
  brandName: string,
  industry: string,
  country?: string
): Promise<CompetitorsResult> {
  const marketContext = country ? ` País/mercado: ${country}.` : '';
  const content = await callOpenAI([
    {
      role: 'system',
      content:
        'Respondé SOLO con un JSON válido. Ejemplo: {"competitors": ["Marca A", "Marca B", "Marca C", "Marca D", "Marca E"]}. ' +
        'Listá exactamente 5 competidores directos, marcas reales conocidas. Sin explicaciones.',
    },
    {
      role: 'user',
      content: `Marca: ${brandName}. Industria: ${industry}.${marketContext}\n\n¿Cuáles son los 5 principales competidores? Priorizá marcas relevantes de ese país/mercado. Respuesta (solo JSON):`,
    },
  ]);

  try {
    const parsed = JSON.parse(content) as { competitors?: string[] };
    const raw = Array.isArray(parsed.competitors) ? parsed.competitors : [];
    const competitors = raw
      .slice(0, 5)
      .map((c) => `${c}`.trim())
      .filter(Boolean);
    return { competitors: competitors.length >= 5 ? competitors : [...competitors, ...Array(5 - competitors.length).fill('Competidor')] };
  } catch {
    return { competitors: ['Competidor 1', 'Competidor 2', 'Competidor 3', 'Competidor 4', 'Competidor 5'] };
  }
}

/**
 * Intenta inferir país/mercado principal de la marca cuando no hay dominio con TLD claro.
 */
export async function determineCountryForBrand(
  brandName: string,
  fallbackCountry = 'Argentina'
): Promise<CountryResult> {
  const content = await callOpenAI([
    {
      role: 'system',
      content:
        'Respondé SOLO con JSON válido. Ejemplo: {"country":"Colombia"}. ' +
        'Inferí el país/mercado principal más probable de la marca. ' +
        'Si no es claro, devolvé el país de fallback recibido.',
    },
    {
      role: 'user',
      content: `Marca: ${brandName}. País de fallback: ${fallbackCountry}.\n\nDevuelve solo JSON con la clave country.`,
    },
  ]);

  try {
    const parsed = JSON.parse(content) as { country?: string };
    const country = `${parsed.country || fallbackCountry}`.trim() || fallbackCountry;
    return { country };
  } catch {
    return { country: fallbackCountry };
  }
}

/**
 * Primer paso del diagnóstico:
 * identifica país/mercado e industria SOLO desde la marca (sin depender del dominio).
 */
export async function determineMarketProfileForBrand(
  brandName: string,
  fallbackCountry = 'Argentina',
  fallbackIndustry = 'General',
  websiteUrl?: string
): Promise<MarketProfileResult> {
  const evidence = await fetchWebsiteEvidence(websiteUrl);
  const websiteEvidenceText = evidence
    ? [
        `URL evaluada: ${evidence.sourceUrl || websiteUrl}.`,
        evidence.title ? `Title: ${evidence.title}` : '',
        evidence.metaDescription ? `Meta description: ${evidence.metaDescription}` : '',
        evidence.h1 ? `H1 principal: ${evidence.h1}` : '',
        evidence.h2 ? `H2 destacado: ${evidence.h2}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    : 'Sin evidencia de website disponible.';

  const content = await callOpenAI([
    {
      role: 'system',
      content:
        'Respondé SOLO con JSON válido. Ejemplo: {"country":"Colombia","industry":"Telecomunicaciones móviles","confidence":88}. ' +
        'Inferí país/mercado principal e industria/rubro de la marca priorizando evidencia real del website si existe. ' +
        'No inventes rubro que contradiga la evidencia (title/meta/h1). ' +
        'Agregá confidence (0-100) según qué tan seguro estás. Si no es claro, usá los fallbacks provistos y baja confidence.',
    },
    {
      role: 'user',
      content:
        `Marca: ${brandName}. Fallback país: ${fallbackCountry}. Fallback industria: ${fallbackIndustry}.\n` +
        `Evidencia website:\n${websiteEvidenceText}\n` +
        'Devolvé solo JSON con claves: country, industry, confidence.',
    },
  ]);

  try {
    const parsed = JSON.parse(content) as { country?: string; industry?: string; confidence?: number | string };
    const country = `${parsed.country || fallbackCountry}`.trim() || fallbackCountry;
    const industry = `${parsed.industry || fallbackIndustry}`.trim() || fallbackIndustry;
    const rawConfidence = Number(parsed.confidence);
    const confidence = Number.isFinite(rawConfidence)
      ? Math.max(0, Math.min(100, Math.round(rawConfidence)))
      : 50;
    return { country, industry, confidence };
  } catch {
    return { country: fallbackCountry, industry: fallbackIndustry, confidence: 0 };
  }
}
