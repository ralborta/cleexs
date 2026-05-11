/**
 * IA para el diagnóstico público: determinar industria y competidores
 */

import type { BrandClassification } from './classifier';
import { discoverCompetitors, validateCompetitors } from './classifier';

export interface IndustryResult {
  industry: string;
}

export interface CompetitorsResult {
  competitors: string[];
  country?: string;
  verticalSummary?: string;
  customerSegment?: 'B2B' | 'B2C' | 'B2B2C' | 'mixto' | 'desconocido';
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
  /** Qué hace el negocio y nicho (ancla competidores). */
  verticalSummary?: string;
  /** Segmento de cliente inferido. */
  customerSegment?: 'B2B' | 'B2C' | 'B2B2C' | 'mixto' | 'desconocido';
}

export interface ResolvedBrandAnalysisContext {
  country: string;
  industry: string;
  confidence: number;
  verticalSummary?: string;
  customerSegment?: 'B2B' | 'B2C' | 'B2B2C' | 'mixto' | 'desconocido';
  competitors: CompetitorDomainResolution[];
  sourceUrls: string[];
}

function normalizeCompetitorName(value: string): string {
  return `${value || ''}`
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function mergeUniqueCompetitorNames(...lists: Array<string[] | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const list of lists) {
    for (const raw of list || []) {
      const name = `${raw || ''}`.trim();
      const normalized = normalizeCompetitorName(name);
      if (!name || !normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      out.push(name);
    }
  }
  return out;
}

async function selectBestCompetitors(input: {
  brandName: string;
  websiteUrl?: string;
  country?: string;
  industry?: string;
  verticalSummary?: string;
  customerSegment?: string;
  searchEvidence?: string;
  classification?: BrandClassification;
  candidates: string[];
}): Promise<string[]> {
  const uniqueCandidates = mergeUniqueCompetitorNames(input.candidates);
  if (uniqueCandidates.length <= 1) return uniqueCandidates;

  const classificationLines = input.classification
    ? [
        `Tipo de negocio: ${input.classification.businessType}`,
        `Categoría: ${input.classification.category}${input.classification.subcategory ? ` > ${input.classification.subcategory}` : ''}`,
        `Mercado: ${input.classification.geoMarket}`,
        `Segmento: ${input.classification.sizeSegment}`,
      ]
        .filter(Boolean)
        .join('\n')
    : '';
  const evidenceParts = [
    input.country?.trim() ? `País/mercado: ${input.country.trim()}` : '',
    input.industry?.trim() ? `Industria: ${input.industry.trim()}` : '',
    input.verticalSummary?.trim() ? `Resumen del negocio: ${input.verticalSummary.trim()}` : '',
    input.customerSegment?.trim() ? `Tipo de cliente: ${input.customerSegment.trim()}` : '',
    input.websiteUrl?.trim() ? `Sitio web: ${input.websiteUrl.trim()}` : '',
    classificationLines,
    input.searchEvidence?.trim()
      ? `Resultados de búsqueda / evidencia externa:\n${input.searchEvidence.trim().slice(0, 2500)}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const content = await callOpenAI(
    [
      {
        role: 'system',
        content:
          'Respondé SOLO con JSON válido. Ejemplo: {"competitors":["Marca A","Marca B","Marca C"]}. ' +
          'Tu tarea es revisar una lista CERRADA de candidatos y quedarte solo con los competidores DIRECTOS más probables. ' +
          'Reglas estrictas: ' +
          '1) Elegí únicamente nombres que ya estén en la lista entregada. No inventes ni agregues otros. ' +
          '2) Un competidor directo debe vender una oferta comparable, para un cliente parecido y en el mismo mercado principal. ' +
          '3) Excluí partners, clientes, integradores, marketplaces generales, medios, directorios, consultoras si la marca no es consultora, y categorías vecinas. ' +
          '4) Si hay suficientes candidatos sólidos, devolvé exactamente 5. Si no, devolvé menos pero no metas basura. ' +
          '5) Priorizá coincidencia de necesidad principal, mercado y tipo de negocio.',
      },
      {
        role: 'user',
        content:
          `Marca analizada: ${input.brandName}\n\n` +
          `${evidenceParts}\n\n` +
          `Candidatos permitidos:\n${uniqueCandidates.map((name, index) => `${index + 1}. ${name}`).join('\n')}\n\n` +
          'Devolvé solo JSON con la forma {"competitors":["..."]}.',
      },
    ],
    undefined,
    500,
    process.env.DIAGNOSTIC_COMPETITORS_OPENAI_MODEL?.trim() || 'gpt-4o'
  );

  try {
    const parsed = JSON.parse(content) as { competitors?: string[] };
    const selected = Array.isArray(parsed.competitors) ? parsed.competitors : [];
    const allowed = new Map(uniqueCandidates.map((name) => [normalizeCompetitorName(name), name]));
    const filtered = mergeUniqueCompetitorNames(
      selected.map((name) => allowed.get(normalizeCompetitorName(name)) || '').filter(Boolean)
    );
    return filtered.slice(0, 5);
  } catch {
    return uniqueCandidates.slice(0, 5);
  }
}

async function expandCompetitorCandidates(input: {
  brandName: string;
  websiteUrl?: string;
  country?: string;
  industry?: string;
  verticalSummary?: string;
  customerSegment?: string;
  searchEvidence?: string;
  classification?: BrandClassification;
  existing: string[];
  targetCount?: number;
}): Promise<string[]> {
  const existing = mergeUniqueCompetitorNames(input.existing);
  const targetCount = Math.max(1, input.targetCount ?? 5);
  const missing = targetCount - existing.length;
  if (missing <= 0) return [];

  const classificationLines = input.classification
    ? [
        `Tipo de negocio: ${input.classification.businessType}`,
        `Categoría: ${input.classification.category}${input.classification.subcategory ? ` > ${input.classification.subcategory}` : ''}`,
        `Mercado: ${input.classification.geoMarket}`,
        `Segmento: ${input.classification.sizeSegment}`,
      ]
        .filter(Boolean)
        .join('\n')
    : '';
  const evidenceParts = [
    input.country?.trim() ? `País/mercado: ${input.country.trim()}` : '',
    input.industry?.trim() ? `Industria: ${input.industry.trim()}` : '',
    input.verticalSummary?.trim() ? `Resumen del negocio: ${input.verticalSummary.trim()}` : '',
    input.customerSegment?.trim() ? `Tipo de cliente: ${input.customerSegment.trim()}` : '',
    input.websiteUrl?.trim() ? `Sitio web: ${input.websiteUrl.trim()}` : '',
    classificationLines,
    input.searchEvidence?.trim()
      ? `Resultados de búsqueda / evidencia externa:\n${input.searchEvidence.trim().slice(0, 3000)}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const content = await callOpenAI(
    [
      {
        role: 'system',
        content:
          'Respondé SOLO con JSON válido. Ejemplo: {"competitors":["Marca D","Marca E"]}. ' +
          'Tu tarea es proponer competidores ADICIONALES para completar una lista total de 5 competidores directos y locales. ' +
          'Reglas estrictas: ' +
          '1) NO repitas marcas ya listadas. ' +
          '2) Priorizá el mismo producto/servicio principal, mismo mercado y mismo tipo de cliente. ' +
          '3) Excluí holdings, directorios, asociaciones, medios, comparadores, partners, proveedores y categorías vecinas. ' +
          '4) Si el mercado es común y la evidencia alcanza, devolvé exactamente la cantidad faltante. ' +
          '5) Si no alcanza para completar todo, devolvé los adicionales más probables, pero no inventes basura.',
      },
      {
        role: 'user',
        content:
          `Marca analizada: ${input.brandName}\n\n` +
          `${evidenceParts}\n\n` +
          `Competidores ya detectados:\n${existing.map((name, index) => `${index + 1}. ${name}`).join('\n')}\n\n` +
          `Faltan ${missing} competidores para completar 5.\n\n` +
          'Devolvé solo JSON con la forma {"competitors":["..."]}.',
      },
    ],
    undefined,
    500,
    process.env.DIAGNOSTIC_COMPETITORS_OPENAI_MODEL?.trim() || 'gpt-4o'
  );

  try {
    const parsed = JSON.parse(content) as { competitors?: string[] };
    const selected = Array.isArray(parsed.competitors) ? parsed.competitors : [];
    const existingSet = new Set(existing.map((name) => normalizeCompetitorName(name)));
    const filtered = mergeUniqueCompetitorNames(
      selected.filter((name) => {
        const normalized = normalizeCompetitorName(name);
        return normalized && !existingSet.has(normalized);
      })
    );
    return filtered.slice(0, missing);
  } catch {
    return [];
  }
}

interface WebsiteEvidence {
  title?: string;
  metaDescription?: string;
  h1?: string;
  h2?: string;
  bodyTextExcerpt?: string;
  sourceUrl?: string;
}

async function callOpenAI(
  messages: Array<{ role: string; content: string }>,
  JsonSchema?: object,
  maxTokens = 500,
  model?: string
): Promise<string> {
  const resolvedModel = model?.trim() || process.env.DIAGNOSTIC_AI_OPENAI_MODEL?.trim() || 'gpt-4o-mini';
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: resolvedModel,
      temperature: 0.2,
      max_tokens: maxTokens,
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

function extractBodyTextExcerpt(html: string): string | undefined {
  const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const raw = match?.[1] ?? html;
  const text = stripHtml(raw).replace(/\s+/g, ' ').trim();
  if (!text) return undefined;
  return text.slice(0, 2400);
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
    const bodyTextExcerpt = extractBodyTextExcerpt(html);
    return { title, metaDescription, h1, h2, bodyTextExcerpt, sourceUrl: normalized };
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
export async function fetchSearchEvidence(
  brandName: string,
  websiteUrl?: string,
  countryHint?: string,
  businessHint?: string
): Promise<string> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey?.trim()) return '';

  const siteHint = websiteUrl?.trim()
    ? websiteUrl.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/.*$/, '')
    : '';
  const countryPart = countryHint?.trim() ? ` "${countryHint.trim()}"` : '';
  const compactBusinessHint = `${businessHint || ''}`
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  const queries = [
    `"${brandName}"${countryPart} país origen sede marca ${siteHint}`.trim(),
    `"${brandName}"${countryPart} competidores alternativas mercado local ${siteHint}`.trim(),
    ...(compactBusinessHint ? [`${compactBusinessHint} ${countryHint || ''} competidores marcas locales`.trim()] : []),
  ];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const blocks: string[] = [];
    for (const query of queries) {
      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: query, num: 6 }),
        signal: controller.signal,
      });
      if (!response.ok) continue;
      const data = (await response.json()) as {
        organic?: Array<{ title?: string; snippet?: string; link?: string }>;
      };
      const organic = data?.organic ?? [];
      const parts = organic
        .slice(0, 6)
        .map((o) => [o.title, o.snippet].filter(Boolean).join(': '))
        .filter(Boolean);
      if (parts.length) {
        blocks.push(`Consulta: ${query}\n${parts.join('\n')}`);
      }
    }
    return blocks.length ? `Resultados de búsqueda web relevantes:\n${blocks.join('\n\n')}` : '';
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
export async function getTop5Competitors(input: {
  brandName: string;
  country?: string;
  websiteUrl?: string;
  industryHint?: string;
  niche?: { verticalSummary?: string; customerSegment?: string };
  searchEvidence?: string;
  allowProbableLocalFallback?: boolean;
}): Promise<CompetitorsResult> {
  const competitorModel = process.env.DIAGNOSTIC_COMPETITORS_OPENAI_MODEL?.trim() || 'gpt-4o';
  const marketContext = input.country?.trim()
    ? `País/mercado principal: ${input.country.trim()}. Usalo como filtro fuerte para elegir competidores del mismo mercado.`
    : 'País/mercado principal: no informado. Si inferís uno con alta confianza desde el sitio, usalo; si no, evitá asumir.';
  const siteEvidence = await fetchWebsiteEvidence(input.websiteUrl);
  const siteEvidenceBlock = siteEvidence
    ? [
        `URL evaluada: ${siteEvidence.sourceUrl || input.websiteUrl}.`,
        siteEvidence.title ? `Title: ${siteEvidence.title}` : '',
        siteEvidence.metaDescription ? `Meta description: ${siteEvidence.metaDescription}` : '',
        siteEvidence.h1 ? `H1 principal: ${siteEvidence.h1}` : '',
        siteEvidence.h2 ? `H2 destacado: ${siteEvidence.h2}` : '',
        siteEvidence.bodyTextExcerpt ? `Texto visible del sitio: ${siteEvidence.bodyTextExcerpt}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    : 'Sin evidencia HTML resumida del sitio.';
  const hintBlock = [
    input.industryHint?.trim() ? `Pista secundaria de industria (no rígida): ${input.industryHint.trim()}` : '',
    input.niche?.verticalSummary?.trim()
      ? `Resumen del negocio (pista secundaria): ${input.niche.verticalSummary.trim()}`
      : '',
    input.niche?.customerSegment?.trim()
      ? `Tipo de cliente principal (pista secundaria): ${input.niche.customerSegment.trim()}.`
      : '',
    input.searchEvidence?.trim() ? input.searchEvidence.trim() : '',
  ]
    .filter(Boolean)
    .join('\n');
  const useUrlFirstPrompt = Boolean(input.websiteUrl?.trim());

  const content = await callOpenAI([
    {
      role: 'system',
      content: useUrlFirstPrompt
        ? 'Respondé SOLO con un JSON válido. Ejemplo: {"country":"Bolivia","verticalSummary":"Urbanizadora que vende lotes y proyectos inmobiliarios a familias e inversionistas.","customerSegment":"B2C","competitors":["Marca A","Marca B","Marca C"]}. ' +
          'Analizá únicamente la URL y el contenido visible del sitio para entender qué vende esta empresa y a quién le vende. ' +
          'Primero identificá la oferta principal y el tipo de cliente. Después elegí solo competidores DIRECTOS y REALES que compitan por esa misma necesidad principal. ' +
          'country: si viene informado, usá exactamente ese valor; si no viene, inferilo solo si es claro por el sitio o la URL; si no, devolvé null. ' +
          'verticalSummary: 1-2 frases en español sobre qué vende la empresa y a quién. ' +
          'customerSegment: exactamente uno de B2B, B2C, B2B2C, mixto, desconocido. ' +
          'Aplicá filtro local estricto: priorizá misma ciudad o zona si aparece en el sitio; si no, mismo país. No elijas marcas extranjeras ni cadenas globales si no operan claramente en el país detectado. ' +
          'Aplicá filtro de producto exacto: no alcanza con la misma categoría amplia. Tienen que competir por la misma oferta principal. Ejemplo: un restaurante de pollos en Bolivia debe compararse con restaurantes de pollos en Bolivia, no con cadenas internacionales ni comidas generales. ' +
          'Ignorá por completo clientes, partners, integraciones, marcas mencionadas como casos de éxito, certificaciones, proveedores, medios, distribuidores, revendedores y marketplaces generales. ' +
          'Tampoco devuelvas directorios, holdings, medios de comunicación, comparadores, cámaras, franquicias paraguas ni marcas de la misma empresa. ' +
          'No mezcles industrias ni categorías vecinas. ' +
          (input.allowProbableLocalFallback
            ? 'Si el negocio pertenece a una categoría local común con muchos actores (por ejemplo ópticas, restaurantes, farmacias, gimnasios, inmobiliarias, clínicas o ferreterías), no devuelvas una lista vacía: devolvé los competidores locales directos más probables según la evidencia disponible. '
            : '') +
          'No inventes ni fuerces cantidad. Si solo estás seguro de 2 o 3, devolvé 2 o 3. Solo devolvé 0 si la evidencia realmente no permite ubicar ninguna alternativa local directa. ' +
          'Devolvé solo nombres de marcas/empresas.'
        : 'Respondé SOLO con un JSON válido. Ejemplo: {"competitors":["Marca A","Marca B","Marca C"]}. ' +
          'Tu tarea es identificar competidores DIRECTOS y REALES de la empresa indicada. ' +
          'Reglas estrictas: ' +
          '1) Si hay evidencia del sitio, usala como fuente principal y suficiente para entender el negocio. ' +
          '2) No dependas de clasificaciones previas ni de categorías inventadas si el sitio ya deja claro qué hace la empresa. ' +
          '3) El país/mercado indicado es el único filtro duro si viene informado; si no viene, inferilo desde la URL y el sitio. ' +
          '4) Un competidor directo debe resolver la misma necesidad principal, con una oferta comparable y para un tipo de cliente similar. ' +
          '5) NO incluyas marketplaces generales, partners, proveedores, medios, revendedores, categorías vecinas ni productos de la misma empresa. ' +
          '6) Excluí directorios, holdings, asociaciones, software complementario, agencias de marketing, cámaras y comparadores si no compiten directamente por la misma compra. ' +
          '7) NO inventes marcas ni fuerces cantidad. Si solo estás seguro de 2 o 3, devolvé 2 o 3. ' +
          '8) Devolvé solo nombres de marcas/empresas, nunca URLs, dominios ni texto extra. ' +
          '9) Si las pistas secundarias contradicen al sitio, ignorá las pistas secundarias y priorizá el sitio.',
    },
    {
      role: 'user',
      content: useUrlFirstPrompt
        ? `Principales competidores directos de ${input.websiteUrl}\n\n` +
          `Marca / empresa: ${input.brandName}\n\n` +
          (input.country?.trim() ? `País/mercado confirmado: ${input.country.trim()}\n\n` : '') +
          `Evidencia resumida del sitio:\n${siteEvidenceBlock}\n\n` +
          (hintBlock ? `Evidencia adicional:\n${hintBlock}\n\n` : '') +
          'Devolvé un JSON con la forma {"country":"..."|null,"verticalSummary":"...","customerSegment":"B2B|B2C|B2B2C|mixto|desconocido","competitors":["..."]} con hasta 5 competidores directos de la misma oferta principal y para el mismo tipo de cliente.'
        : `Marca: ${input.brandName}\n` +
          `${marketContext}\n` +
          (input.websiteUrl ? `Sitio web: ${input.websiteUrl}\n` : '') +
          `\nEvidencia resumida del sitio:\n${siteEvidenceBlock}\n\n` +
          (hintBlock ? `Pistas secundarias:\n${hintBlock}\n\n` : '') +
          'Devolvé un JSON con la forma {"competitors":["..."]} incluyendo solo competidores directos reales de esta empresa.',
    },
  ], undefined, 500, competitorModel);

  try {
    const parsed = JSON.parse(content) as {
      competitors?: string[];
      country?: string | null;
      verticalSummary?: string;
      customerSegment?: string;
    };
    const raw = Array.isArray(parsed.competitors) ? parsed.competitors : [];
    const competitors = raw
      .slice(0, 5)
      .map((c) => `${c}`.trim())
      .filter(Boolean);
    const country = `${parsed.country || ''}`.trim() || undefined;
    const verticalSummary = `${parsed.verticalSummary || ''}`.trim().slice(0, 600) || undefined;
    const seg = `${parsed.customerSegment || ''}`.trim().toLowerCase();
    const segMap: Record<string, NonNullable<CompetitorsResult['customerSegment']>> = {
      b2b: 'B2B',
      b2c: 'B2C',
      b2b2c: 'B2B2C',
      mixto: 'mixto',
      desconocido: 'desconocido',
    };
    return {
      competitors,
      ...(country ? { country } : {}),
      ...(verticalSummary ? { verticalSummary } : {}),
      ...(segMap[seg] ? { customerSegment: segMap[seg] } : {}),
    };
  } catch {
    return { competitors: [] };
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
      `Evidencia website (HTML liviano):\n${websiteEvidenceText}`,
      hasSearchEvidence ? `\n${searchEvidence!.trim()}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

  const systemPrompt =
    'Respondé SOLO con JSON válido. Ejemplo: {"country":"Colombia","industry":"Logística 3PL B2B","confidence":88,"verticalSummary":"Operador de transporte y almacenaje para empresas.","customerSegment":"B2B"}. ' +
    (countryFixed
      ? `El país es ${countryFixed}; devolvé ese mismo valor en country. Inferí industria, confidence (0-100), verticalSummary y customerSegment. `
      : 'Inferí país/mercado principal e industria de la marca priorizando la evidencia (website y/o resultados de búsqueda). ') +
    'Industria: SECTOR donde compiten pares directos (2-7 palabras en español), lo más específico posible sin ser un producto aislado. ' +
    'Ejemplos: "Logística y transporte de carga B2B", "Telecomunicaciones móviles", "Banca retail", "Supermercados". ' +
    'verticalSummary: 1-3 frases en español describiendo qué vende y a quién. ' +
    'customerSegment: exactamente uno de: B2B, B2C, B2B2C, mixto, desconocido. ' +
    'Si no es claro, usá fallbacks y baja confidence.';

  const content = await callOpenAI(
    [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content:
          `Marca: ${brandName}. Fallback país: ${fallbackCountry}. Fallback industria: ${fallbackIndustry}.\n\n${evidenceBlock}\n\n` +
          'Devolvé solo JSON con claves: country, industry, confidence, verticalSummary, customerSegment.',
      },
    ],
    undefined,
    900
  );

  try {
    const parsed = JSON.parse(content) as {
      country?: string;
      industry?: string;
      confidence?: number | string;
      verticalSummary?: string;
      customerSegment?: string;
    };
    const country = countryFixed
      ? countryFixed
      : `${parsed.country || fallbackCountry}`.trim() || fallbackCountry;
    const industry = `${parsed.industry || fallbackIndustry}`.trim() || fallbackIndustry;
    const rawConfidence = Number(parsed.confidence);
    const confidence = Number.isFinite(rawConfidence)
      ? Math.max(0, Math.min(100, Math.round(rawConfidence)))
      : 50;
    const verticalSummary = `${parsed.verticalSummary || ''}`.trim().slice(0, 600) || undefined;
    const seg = `${parsed.customerSegment || ''}`.trim().toLowerCase();
    const segMap: Record<string, NonNullable<MarketProfileResult['customerSegment']>> = {
      b2b: 'B2B',
      b2c: 'B2C',
      b2b2c: 'B2B2C',
      mixto: 'mixto',
      desconocido: 'desconocido',
    };
    const customerSegment = segMap[seg];
    return {
      country,
      industry,
      confidence,
      ...(verticalSummary ? { verticalSummary } : {}),
      ...(customerSegment ? { customerSegment } : {}),
    };
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
  industry?: string,
  verticalSummary?: string
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
  if (verticalSummary?.trim()) contextParts.push(`Qué hace la marca medida: ${verticalSummary.trim().slice(0, 400)}`);
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

export async function resolveBrandAnalysisContext(input: {
  brandName: string;
  websiteUrl?: string;
  fallbackCountry?: string;
  fallbackIndustry?: string;
  knownCountry?: string;
  classification?: BrandClassification;
  useSearchEvidence?: boolean;
}): Promise<ResolvedBrandAnalysisContext> {
  const fallbackCountry = input.fallbackCountry?.trim() || 'Argentina';
  const fallbackIndustry = input.fallbackIndustry?.trim() || 'General';
  const knownCountry = input.knownCountry?.trim() || undefined;
  const hasWebsite = Boolean(input.websiteUrl?.trim());
  const useSearchEvidence = input.useSearchEvidence !== false;

  let sourceUrls: string[] = [];

  let competitorNames: string[] = [];
  let country = knownCountry || fallbackCountry;
  let industry = fallbackIndustry;
  let confidence = knownCountry ? 90 : 0;
  let verticalSummary: string | undefined;
  let customerSegment: ResolvedBrandAnalysisContext['customerSegment'];
  const searchEvidence = useSearchEvidence
    ? await fetchSearchEvidence(input.brandName, input.websiteUrl, knownCountry)
    : '';

  if (hasWebsite) {
    const firstPass = await getTop5Competitors({
      brandName: input.brandName,
      websiteUrl: input.websiteUrl,
      country: knownCountry,
      searchEvidence: searchEvidence || undefined,
    });
    competitorNames = firstPass.competitors;
    country = knownCountry || firstPass.country || fallbackCountry;
    industry = input.classification?.category || fallbackIndustry;
    verticalSummary = firstPass.verticalSummary;
    customerSegment = firstPass.customerSegment;
    confidence = knownCountry ? 95 : firstPass.country ? 85 : competitorNames.length > 0 ? 70 : 40;
    if (country || verticalSummary || customerSegment) {
      const refinedPass = await getTop5Competitors({
        brandName: input.brandName,
        websiteUrl: input.websiteUrl,
        country,
        niche: {
          verticalSummary,
          customerSegment,
        },
        searchEvidence: searchEvidence || undefined,
      });
      if (refinedPass.competitors.length > 0) competitorNames = refinedPass.competitors;
      if (refinedPass.country) country = refinedPass.country;
      if (refinedPass.verticalSummary) verticalSummary = refinedPass.verticalSummary;
      if (refinedPass.customerSegment) customerSegment = refinedPass.customerSegment;
      confidence = Math.max(confidence, refinedPass.country ? 90 : confidence);
    }
    if (competitorNames.length === 0) {
      const rescueSearchEvidence = useSearchEvidence
        ? await fetchSearchEvidence(
            input.brandName,
            input.websiteUrl,
            country,
            verticalSummary
          )
        : '';
      const rescuePass = await getTop5Competitors({
        brandName: input.brandName,
        websiteUrl: input.websiteUrl,
        country,
        niche: {
          verticalSummary,
          customerSegment,
        },
        searchEvidence: rescueSearchEvidence || searchEvidence || undefined,
        allowProbableLocalFallback: true,
      });
      if (rescuePass.competitors.length > 0) competitorNames = rescuePass.competitors;
      if (rescuePass.country) country = rescuePass.country;
      if (rescuePass.verticalSummary) verticalSummary = rescuePass.verticalSummary;
      if (rescuePass.customerSegment) customerSegment = rescuePass.customerSegment;
      confidence = Math.max(confidence, rescuePass.competitors.length > 0 ? 80 : confidence);
    }
  } else {
    const marketProfile = await determineMarketProfileForBrand(
      input.brandName,
      fallbackCountry,
      fallbackIndustry,
      input.websiteUrl,
      searchEvidence || undefined,
      knownCountry
    );
    country = knownCountry || marketProfile.country || fallbackCountry;
    industry = marketProfile.industry || fallbackIndustry;
    verticalSummary = marketProfile.verticalSummary;
    customerSegment = marketProfile.customerSegment;
    confidence = marketProfile.confidence;
    const followup = await getTop5Competitors({
      brandName: input.brandName,
      country,
      websiteUrl: input.websiteUrl,
      industryHint: industry,
      niche: {
        verticalSummary: marketProfile.verticalSummary,
        customerSegment: marketProfile.customerSegment,
      },
      searchEvidence: searchEvidence || undefined,
    });
    competitorNames = followup.competitors;
  }

  let validatedCompetitorNames: string[] = [];
  if (input.classification) {
    try {
      const discovered = await discoverCompetitors(input.classification);
      const validated = await validateCompetitors(input.classification, discovered);
      validatedCompetitorNames = validated
        .filter((candidate) => candidate.valid)
        .map((candidate) => candidate.name);
    } catch {
      validatedCompetitorNames = [];
    }
  }

  competitorNames = mergeUniqueCompetitorNames(competitorNames, validatedCompetitorNames);
  if (competitorNames.length > 0 && competitorNames.length < 5) {
    const extraCompetitors = await expandCompetitorCandidates({
      brandName: input.brandName,
      websiteUrl: input.websiteUrl,
      country,
      industry,
      verticalSummary,
      customerSegment,
      searchEvidence: searchEvidence || undefined,
      classification: input.classification,
      existing: competitorNames,
      targetCount: 5,
    });
    competitorNames = mergeUniqueCompetitorNames(competitorNames, extraCompetitors);
  }
  if (competitorNames.length > 1) {
    competitorNames = await selectBestCompetitors({
      brandName: input.brandName,
      websiteUrl: input.websiteUrl,
      country,
      industry,
      verticalSummary,
      customerSegment,
      searchEvidence: searchEvidence || undefined,
      classification: input.classification,
      candidates: competitorNames,
    });
  }
  const competitors = await resolveCompetitorDomains(
    competitorNames,
    country,
    hasWebsite ? undefined : industry,
    verticalSummary
  );

  return {
    country,
    industry,
    confidence,
    ...(verticalSummary ? { verticalSummary } : {}),
    ...(customerSegment ? { customerSegment } : {}),
    sourceUrls,
    competitors,
  };
}
