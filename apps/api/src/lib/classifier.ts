/**
 * Classifier: a partir de un dominio, deriva toda la identidad del negocio.
 * Usa SOLO el dominio + conocimiento del modelo (sin Firecrawl por costo).
 *
 * Pipeline:
 *   1. classifyDomain(domain)       -> marca, tipo, categoria, vertical, mercado
 *   2. discoverCompetitors(info)    -> 3-7 competidores del MISMO tipo/vertical/mercado
 *   3. validateCompetitor(domain)   -> re-clasifica cada competidor para validar
 *   4. generatePrompts(info)        -> 10 prompts contextualizados
 */

import { chatWithModel, defaultClassifierModel, type ModelId } from './providers';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type BusinessType =
  | 'brand'
  | 'retailer_multibrand'
  | 'distributor'
  | 'importer'
  | 'marketplace'
  | 'service'
  | 'saas'
  | 'unknown';

export type SizeSegment = 'premium' | 'mid' | 'value' | 'unknown';

export interface BrandClassification {
  domain: string;
  brandName: string;
  businessType: BusinessType;
  category: string;
  subcategory: string;
  geoMarket: string; // AR | BR | MX | US | LATAM | EU | global
  sizeSegment: SizeSegment;
  aliases: string[];
  description: string;
  confidence: number; // 0..1
  knownEntity: boolean;
  reasoning: string;
}

export interface CompetitorCandidate {
  domain: string;
  name: string;
  reason: string;
}

export interface CompetitorValidated extends CompetitorCandidate {
  valid: boolean;
  classification?: BrandClassification;
  rejectionReason?: string;
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function normalizeDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '')
    .split('/')[0];
}

function stripJsonFences(text: string): string {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (m ? m[1] : text).trim();
}

function safeParseJson<T = unknown>(text: string): T | null {
  try {
    return JSON.parse(stripJsonFences(text)) as T;
  } catch {
    // intento agresivo: quedarme con el primer objeto/array
    const cleaned = stripJsonFences(text);
    const start = cleaned.search(/[\[{]/);
    const end = Math.max(cleaned.lastIndexOf(']'), cleaned.lastIndexOf('}'));
    if (start === -1 || end === -1 || end <= start) return null;
    try {
      return JSON.parse(cleaned.slice(start, end + 1)) as T;
    } catch {
      return null;
    }
  }
}

const BUSINESS_TYPE_HELP = `
- brand: marca propia (vende solo su propio producto). Ej: nike.com, apple.com
- retailer_multibrand: retail multimarca (vende varias marcas al consumidor final B2C). Ej: dexter.com.ar, falabella.com
- distributor: distribuidor mayorista B2B (no vende al publico final). Ej: distribuidor*.com.ar
- importer: importador (representante oficial de una marca extranjera). Ej: "importador oficial de X en AR"
- marketplace: plataforma donde terceros venden. Ej: mercadolibre.com, amazon.com
- service: presta un servicio no-producto. Ej: agencias, estudios, consultoras
- saas: software como servicio. Ej: hubspot.com, slack.com
`.trim();

const SIZE_SEGMENT_HELP = `
- premium: gama alta / lujo
- mid: masivo / mid-market
- value: discount / low-cost
`.trim();

// Categorias cerradas (taxonomia base)
const CATEGORIES_HELP = `
Categorias validas (elegi la que mejor aplica):
Apparel & Sportswear, Footwear, Electronics, Home & Garden, Food & Beverage,
Health & Beauty, Financial Services, SaaS & Software, Travel & Hospitality,
Automotive, Education, Real Estate, Media & Entertainment, Professional Services,
Logistics & Shipping, Retail (generalista si no encaja arriba).
`.trim();

// ---------------------------------------------------------------------------
// 1) Clasificacion de marca por dominio
// ---------------------------------------------------------------------------

export async function classifyDomain(
  rawDomain: string,
  model?: ModelId
): Promise<BrandClassification> {
  const domain = normalizeDomain(rawDomain);
  const useModel = model || defaultClassifierModel();

  const system = `Sos un clasificador experto de negocios web. Analizas un dominio y respondes SOLO en JSON valido. No inventes.
${CATEGORIES_HELP}

Tipos de negocio:
${BUSINESS_TYPE_HELP}

Segmento de tamaño:
${SIZE_SEGMENT_HELP}

Reglas:
- Si es un subdominio tipo "tienda.X.com" o "shop.X.com" -> probablemente retailer_multibrand.
- TLD .ar => geoMarket AR, .br => BR, .mx => MX, .com generico => global o US.
- Si no reconoces la marca con certeza -> knownEntity: false y confidence bajo.
- NUNCA mezcles: si es retailer multimarca NO lo clasifiques como brand aunque venda productos.`;

  const user = `Dominio a clasificar: ${domain}

Devolve SOLO este JSON (sin markdown):
{
  "brandName": "Nombre comercial real de la marca",
  "businessType": "brand|retailer_multibrand|distributor|importer|marketplace|service|saas|unknown",
  "category": "de la lista",
  "subcategory": "nivel mas especifico dentro de la categoria",
  "geoMarket": "AR|BR|MX|US|LATAM|EU|global",
  "sizeSegment": "premium|mid|value|unknown",
  "aliases": ["variante 1", "variante 2"],
  "description": "1 frase de que hace el negocio",
  "confidence": 0.85,
  "knownEntity": true,
  "reasoning": "por que clasificaste asi"
}`;

  const res = await chatWithModel(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    {
      model: useModel,
      temperature: 0.1,
      maxTokens: 600,
      responseFormat: 'json',
    }
  );

  const parsed = safeParseJson<Partial<BrandClassification>>(res.text);
  if (!parsed) {
    return fallbackClassification(domain);
  }

  return {
    domain,
    brandName: String(parsed.brandName || domain),
    businessType: (parsed.businessType as BusinessType) || 'unknown',
    category: String(parsed.category || 'Retail'),
    subcategory: String(parsed.subcategory || ''),
    geoMarket: String(parsed.geoMarket || 'global'),
    sizeSegment: (parsed.sizeSegment as SizeSegment) || 'unknown',
    aliases: Array.isArray(parsed.aliases) ? parsed.aliases.map(String) : [],
    description: String(parsed.description || ''),
    confidence:
      typeof parsed.confidence === 'number'
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 0.5,
    knownEntity: Boolean(parsed.knownEntity),
    reasoning: String(parsed.reasoning || ''),
  };
}

function fallbackClassification(domain: string): BrandClassification {
  const tld = domain.split('.').pop() || '';
  const geo =
    tld === 'ar'
      ? 'AR'
      : tld === 'br'
      ? 'BR'
      : tld === 'mx'
      ? 'MX'
      : 'global';
  return {
    domain,
    brandName: domain,
    businessType: 'unknown',
    category: 'Retail',
    subcategory: '',
    geoMarket: geo,
    sizeSegment: 'unknown',
    aliases: [],
    description: '',
    confidence: 0.2,
    knownEntity: false,
    reasoning: 'Fallback: no se pudo parsear la clasificacion del modelo.',
  };
}

// ---------------------------------------------------------------------------
// 2) Descubrimiento de competidores
// ---------------------------------------------------------------------------

export async function discoverCompetitors(
  brand: BrandClassification,
  model?: ModelId
): Promise<CompetitorCandidate[]> {
  const useModel = model || defaultClassifierModel();

  const system = `Sos un analista de mercado experto. Devolves SOLO competidores DIRECTOS del MISMO tipo de negocio, MISMA categoria y MISMO mercado. Nunca mezclas categorias.

Reglas DURAS:
1. Devolve entre 3 y 7 competidores maximo.
2. TODOS deben ser del mismo businessType que el negocio dado.
3. TODOS deben operar en el mismo geoMarket (o global si corresponde).
4. TODOS deben estar en la misma category/subcategory.
5. NO inventes dominios: solo dominios reales que conoces con certeza.
6. NO incluyas la marca medida ni variantes.
7. Si el negocio es retailer_multibrand => NO devuelvas marcas de producto (solo otros retailers).
8. Si el negocio es brand => NO devuelvas retailers ni marketplaces.
9. Si el negocio es distributor => solo otros distribuidores B2B.
10. Cada competidor debe tener una razon concreta (1 frase) por la que compite DIRECTO.
11. Si no tenes certeza de un competidor -> NO lo incluyas. Preferible 3 buenos que 7 dudosos.`;

  const user = `Negocio a analizar:
- Dominio: ${brand.domain}
- Marca: ${brand.brandName}
- Tipo: ${brand.businessType}
- Categoria: ${brand.category}${brand.subcategory ? ' > ' + brand.subcategory : ''}
- Mercado: ${brand.geoMarket}
- Segmento: ${brand.sizeSegment}

Devolve SOLO un JSON array (sin markdown, sin texto extra):
[
  { "domain": "dominio.com", "name": "Nombre Oficial", "reason": "por que compite directo" }
]`;

  const res = await chatWithModel(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    {
      model: useModel,
      temperature: 0.2,
      maxTokens: 900,
      responseFormat: 'json',
    }
  );

  // Algunos providers con response_format json envuelven el array en un objeto { competitors: [...] }
  const parsed = safeParseJson<unknown>(res.text);
  let arr: unknown[] = [];
  if (Array.isArray(parsed)) {
    arr = parsed;
  } else if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    const candidates = obj.competitors || obj.results || obj.data;
    if (Array.isArray(candidates)) arr = candidates;
  }

  const out: CompetitorCandidate[] = [];
  const seen = new Set<string>();
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const domain = normalizeDomain(String(obj.domain || ''));
    const name = String(obj.name || '').trim();
    const reason = String(obj.reason || '').trim();
    if (!domain || !name) continue;
    if (domain === brand.domain) continue;
    if (seen.has(domain)) continue;
    seen.add(domain);
    out.push({ domain, name, reason });
  }

  return out.slice(0, 7);
}

// ---------------------------------------------------------------------------
// 3) Validacion de competidores (re-clasificacion cruzada)
// ---------------------------------------------------------------------------

export async function validateCompetitors(
  brand: BrandClassification,
  candidates: CompetitorCandidate[],
  model?: ModelId
): Promise<CompetitorValidated[]> {
  if (candidates.length === 0) return [];

  const useModel = model || defaultClassifierModel();

  const results = await Promise.all(
    candidates.map(async (cand) => {
      try {
        const cls = await classifyDomain(cand.domain, useModel);
        const typeMatch = cls.businessType === brand.businessType;
        const categoryMatch =
          cls.category.toLowerCase() === brand.category.toLowerCase();
        const geoMatch =
          cls.geoMarket === brand.geoMarket ||
          cls.geoMarket === 'global' ||
          brand.geoMarket === 'global';

        const valid = typeMatch && categoryMatch && geoMatch && cls.confidence >= 0.4;

        let rejectionReason: string | undefined;
        if (!typeMatch) {
          rejectionReason = `Tipo distinto: ${cls.businessType} vs ${brand.businessType}`;
        } else if (!categoryMatch) {
          rejectionReason = `Categoria distinta: ${cls.category} vs ${brand.category}`;
        } else if (!geoMatch) {
          rejectionReason = `Mercado distinto: ${cls.geoMarket} vs ${brand.geoMarket}`;
        } else if (cls.confidence < 0.4) {
          rejectionReason = `Baja confianza (${cls.confidence.toFixed(2)})`;
        }

        return {
          ...cand,
          valid,
          classification: cls,
          rejectionReason,
        };
      } catch (err) {
        return {
          ...cand,
          valid: false,
          rejectionReason:
            err instanceof Error ? err.message : 'Error al validar',
        };
      }
    })
  );

  return results;
}

// ---------------------------------------------------------------------------
// 4) Generacion de prompts contextualizados
// ---------------------------------------------------------------------------

export async function generatePrompts(
  brand: BrandClassification,
  n = 10,
  model?: ModelId
): Promise<Array<{ name: string; text: string; category: string }>> {
  const useModel = model || defaultClassifierModel();

  const system = `Sos un experto en SEO de IA y comportamiento de usuario. Generas prompts REALES que usuarios harian en ChatGPT al buscar en esta categoria.

Reglas:
- Los prompts deben ser del punto de vista de un USUARIO REAL buscando.
- NO menciones marcas especificas en los prompts (el modelo las debe recomendar solo).
- Usa la categoria, subcategoria y mercado para contextualizar.
- Variar las intenciones: recomendacion, comparacion, urgencia, precio, calidad, ubicacion.
- En idioma del mercado (AR/BR/MX/LATAM => español, US => ingles, etc).
- Maximo 1 oracion por prompt.`;

  const user = `Generar ${n} prompts para medir visibilidad del siguiente negocio en ChatGPT:
- Tipo: ${brand.businessType}
- Categoria: ${brand.category}${brand.subcategory ? ' > ' + brand.subcategory : ''}
- Mercado: ${brand.geoMarket}

Devolve SOLO un JSON array (sin markdown):
[
  { "name": "Recomendacion directa", "text": "...", "category": "recomendacion|comparacion|urgencia|precio|calidad|ubicacion" }
]`;

  const res = await chatWithModel(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    {
      model: useModel,
      temperature: 0.4,
      maxTokens: 1200,
      responseFormat: 'json',
    }
  );

  const parsed = safeParseJson<unknown>(res.text);
  let arr: unknown[] = [];
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    const candidates = obj.prompts || obj.results || obj.data;
    if (Array.isArray(candidates)) arr = candidates;
  }

  const out: Array<{ name: string; text: string; category: string }> = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const name = String(obj.name || '').trim();
    const text = String(obj.text || obj.prompt || '').trim();
    const category = String(obj.category || 'recomendacion').trim().toLowerCase();
    if (!text) continue;
    out.push({
      name: name || `Prompt ${out.length + 1}`,
      text,
      category,
    });
  }

  return out.slice(0, n);
}

// ---------------------------------------------------------------------------
// Helpers publicos
// ---------------------------------------------------------------------------

export { normalizeDomain };
