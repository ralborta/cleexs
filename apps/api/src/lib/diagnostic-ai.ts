/**
 * IA para el diagnóstico público: determinar industria y competidores
 */

export interface IndustryResult {
  industry: string;
}

export interface CompetitorsResult {
  competitors: string[];
}

export interface CompetitorDomainResolution {
  name: string;
  domain: string | null;
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
 * Búsqueda web (Serper) para inferir país/origen de la marca cuando el dominio es genérico (.com, .net).
 * Devuelve texto con snippets para incluir en el prompt. Si no hay API key o falla, devuelve string vacío.
 */
export async function fetchSearchEvidence(brandName: string): Promise<string> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey?.trim()) return '';

  const query = `"${brandName}" país origen sede marca`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, num: 8 }),
      signal: controller.signal,
    });
    if (!response.ok) return '';
    const data = (await response.json()) as {
      organic?: Array<{ title?: string; snippet?: string; link?: string }>;
    };
    const organic = data?.organic ?? [];
    const parts = organic.slice(0, 8).map((o) => [o.title, o.snippet].filter(Boolean).join(': ')).filter(Boolean);
    return parts.length ? `Resultados de búsqueda (origen/país de la marca):\n${parts.join('\n')}` : '';
  } catch {
    return '';
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
        'Reglas estrictas: ' +
        '1) Solo marcas/empresas que sean competidores DIRECTOS (misma industria, mismo mercado). ' +
        '2) NO incluyas productos, servicios o submarcas de la misma empresa (ej. si la marca es una operadora, no incluyas su billetera móvil; si es un banco, no incluyas su app de pagos). ' +
        '3) NO inventes marcas. Solo listá empresas que existan realmente en ese país. Si no estás seguro de que exista, no la incluyas. ' +
        '4) Solo nombres de marcas/empresas, nunca URLs ni dominios.',
    },
    {
      role: 'user',
      content:
        `Marca: ${brandName}. Industria: ${industry}.${marketContext}\n\n` +
        `Listá exactamente 5 competidores directos (empresas reales de ese país). Solo marcas que existan. Respuesta (solo JSON):`,
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
 * identifica país/mercado e industria. Si knownCountry viene dado (ej. por TLD), solo se infiere industria.
 * Si searchEvidence viene dado (búsqueda web), se usa para inferir país cuando el dominio es .com/.net.
 */
export async function determineMarketProfileForBrand(
  brandName: string,
  fallbackCountry = 'Argentina',
  fallbackIndustry = 'General',
  websiteUrl?: string,
  searchEvidence?: string,
  knownCountry?: string
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

  const hasSearchEvidence = searchEvidence?.trim().length ? true : false;
  const countryFixed = knownCountry?.trim();

  const evidenceBlock =
    [
      countryFixed ? `País/mercado ya determinado: ${countryFixed}. Solo inferí industria y confidence.` : '',
      `Evidencia website:\n${websiteEvidenceText}`,
      hasSearchEvidence ? `\n${searchEvidence!.trim()}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

  const systemPrompt =
    'Respondé SOLO con JSON válido. Ejemplo: {"country":"Colombia","industry":"Telecomunicaciones móviles","confidence":88}. ' +
    (countryFixed
      ? `El país es ${countryFixed}; devolvé ese mismo valor en country. Inferí solo industria y confidence (0-100). `
      : 'Inferí país/mercado principal e industria de la marca priorizando la evidencia (website y/o resultados de búsqueda). ') +
    'Industria: debe ser el SECTOR PRINCIPAL de negocio (2-5 palabras en español), al nivel donde se comparan competidores directos. ' +
    'Ejemplos correctos: "Telecomunicaciones móviles", "Supermercados", "Bancos", "Cafeterías", "Restaurantes", "Operadores de telecomunicaciones". ' +
    'Evitá rubros de producto/servicio específico (ej. no "billeteras móviles" si la marca es una operadora; usá "Telecomunicaciones móviles"). ' +
    'No inventes rubro que contradiga la evidencia. Si no es claro, usá los fallbacks y baja confidence.';

  const content = await callOpenAI([
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content:
        `Marca: ${brandName}. Fallback país: ${fallbackCountry}. Fallback industria: ${fallbackIndustry}.\n\n${evidenceBlock}\n\nDevolvé solo JSON con claves: country, industry, confidence.`,
    },
  ]);

  try {
    const parsed = JSON.parse(content) as { country?: string; industry?: string; confidence?: number | string };
    const country = countryFixed
      ? countryFixed
      : `${parsed.country || fallbackCountry}`.trim() || fallbackCountry;
    const industry = `${parsed.industry || fallbackIndustry}`.trim() || fallbackIndustry;
    const rawConfidence = Number(parsed.confidence);
    const confidence = Number.isFinite(rawConfidence)
      ? Math.max(0, Math.min(100, Math.round(rawConfidence)))
      : 50;
    return { country, industry, confidence };
  } catch {
    return {
      country: countryFixed || fallbackCountry,
      industry: fallbackIndustry,
      confidence: countryFixed ? 90 : 0,
    };
  }
}

function sanitizeDomain(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = `${raw}`
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .replace(/[^a-z0-9.-]/g, '');
  if (!cleaned || !cleaned.includes('.')) return null;
  return cleaned;
}

/**
 * Resuelve el dominio oficial de una lista de marcas/competidores.
 * Útil para enriquecer competidores detectados (que solo tienen nombre) con su sitio web oficial
 * y habilitar scraping/lookup de contactos (Firecrawl, Hunter.io).
 */
export async function resolveCompetitorDomains(
  names: string[],
  country?: string,
  industry?: string
): Promise<CompetitorDomainResolution[]> {
  const unique = Array.from(
    new Set(
      names
        .map((n) => `${n || ''}`.trim())
        .filter((n) => n.length > 0)
    )
  );
  if (unique.length === 0) return [];

  const contextParts: string[] = [];
  if (country) contextParts.push(`País/mercado: ${country}.`);
  if (industry) contextParts.push(`Industria: ${industry}.`);
  const context = contextParts.length ? ' ' + contextParts.join(' ') : '';

  const content = await callOpenAI([
    {
      role: 'system',
      content:
        'Respondé SOLO con JSON válido. Ejemplo: {"resolved":[{"name":"McDonald\'s","domain":"mcdonalds.com.ar"}]}. ' +
        'Reglas: ' +
        '1) Para cada marca entregada, devolvé el dominio OFICIAL más probable (sin "https://", sin "www.", sin rutas). ' +
        '2) Preferí el dominio del país/mercado indicado (ej. mcdonalds.com.ar para Argentina). Si no existe uno local claro, devolvé el dominio global. ' +
        '3) Si no estás seguro de qué dominio oficial usa la marca, devolvé null en domain (no inventes). ' +
        '4) Respetá exactamente los nombres recibidos en el campo name.',
    },
    {
      role: 'user',
      content:
        `Marcas:${context}\n` +
        unique.map((n, i) => `${i + 1}. ${n}`).join('\n') +
        '\n\nDevolvé solo JSON con la forma {"resolved":[{"name":"...","domain":"..."|null}, ...]}',
    },
  ]);

  try {
    const parsed = JSON.parse(content) as {
      resolved?: Array<{ name?: string; domain?: string | null }>;
    };
    const resolved = Array.isArray(parsed.resolved) ? parsed.resolved : [];
    const byName = new Map<string, string | null>();
    for (const entry of resolved) {
      const name = `${entry?.name || ''}`.trim();
      if (!name) continue;
      byName.set(name.toLowerCase(), sanitizeDomain(entry?.domain));
    }
    return unique.map((name) => ({
      name,
      domain: byName.get(name.toLowerCase()) ?? null,
    }));
  } catch {
    return unique.map((name) => ({ name, domain: null }));
  }
}
