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
  fallbackIndustry = 'General'
): Promise<MarketProfileResult> {
  const content = await callOpenAI([
    {
      role: 'system',
      content:
        'Respondé SOLO con JSON válido. Ejemplo: {"country":"Colombia","industry":"Telecomunicaciones móviles","confidence":88}. ' +
        'Inferí país/mercado principal e industria/rubro de la marca basándote en conocimiento de marca, no en dominio. ' +
        'Agregá confidence (0-100) según qué tan seguro estás. Si no es claro, usá los fallbacks provistos y baja confidence.',
    },
    {
      role: 'user',
      content:
        `Marca: ${brandName}. Fallback país: ${fallbackCountry}. Fallback industria: ${fallbackIndustry}.\n` +
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
