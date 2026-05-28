/**
 * Proveedores de IA para el análisis del diagnóstico.
 * Freemium: solo OpenAI. Gold: OpenAI + Gemini + Perplexity + Claude (via OpenRouter).
 */

import {
  callOpenRouterChat,
  getClaudeModelId,
  getPerplexityModelId,
  isOpenRouterConfigured,
} from './openrouter-runner';

export type AIProvider = 'openai' | 'gemini' | 'perplexity' | 'claude';

export interface DiagnosticAnalysisSingle {
  resumenEjecutivo: string;
  contextoCompetitivo?: string;
  comentariosPorIntencion: Array<{
    intencion: string;
    score: number;
    comentario: string;
    interpretacion?: string;
  }>;
  aspectosAdicionales?: string;
  fortalezas: string[];
  debilidades: string[];
  sugerencias: string[];
  proximosPasos: string[];
}

const ANALYSIS_JSON_SCHEMA = `{
  "resumenEjecutivo": "3-4 párrafos extensos...",
  "contextoCompetitivo": "1-2 párrafos...",
  "comentariosPorIntencion": [{"intencion":"Urgencia","score":67,"comentario":"...","interpretacion":"..."}],
  "aspectosAdicionales": "1-2 párrafos...",
  "fortalezas": ["..."],
  "debilidades": ["..."],
  "sugerencias": ["..."],
  "proximosPasos": ["..."]
}`;

const SYSTEM_PROMPT = `Sos un analista senior de marketing digital y posicionamiento de marcas ante la IA. Explicá de forma CLARA y EXTENSA los resultados del diagnóstico. Escribí de forma explicativa y didáctica. Cada sección extensa y clara.

Generá ÚNICAMENTE un JSON válido, sin markdown ni texto extra. Estructura exacta:
${ANALYSIS_JSON_SCHEMA}

REGLAS: comentariosPorIntencion con las intenciones de los datos (Urgencia, Consideración, Calidad, Precio). Scores deben coincidir con los datos. Fortalezas, debilidades, sugerencias: oraciones completas. Todo en español. No uses markdown (**).`;

/** Primer objeto `{ … }` balanceado respetando strings JSON (no cortar en `}` dentro de texto). */
function extractBalancedJsonObject(s: string): string | null {
  const start = s.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  for (let i = start; i < s.length; ) {
    const c = s[i];
    if (inString) {
      if (c === '\\') {
        i += 2;
        continue;
      }
      if (c === '"') inString = false;
      i++;
      continue;
    }
    if (c === '"') {
      inString = true;
      i++;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
    i++;
  }
  return null;
}

function stripTrailingCommasInJsonText(s: string): string {
  return s.replace(/,(\s*[}\]])/g, '$1');
}

function parseAnalysisResponse(content: string): DiagnosticAnalysisSingle | null {
  let t = content.trim();
  const block = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (block) t = block[1].trim();
  else t = t.replace(/^```(?:json)?\s*|\s*```$/gim, '').trim();

  /** Orden: texto completo → objeto balanceado → recorte naive (último recurso). */
  const balanced = extractBalancedJsonObject(t);
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  const naive =
    start !== -1 && end > start ? t.slice(start, end + 1) : null;
  const variants = [...new Set([t, balanced, naive].filter((x): x is string => typeof x === 'string' && x.length > 0))];

  for (const raw of variants) {
    try {
      const cleaned = stripTrailingCommasInJsonText(raw);
      const parsed = JSON.parse(cleaned);
      if (!parsed.resumenEjecutivo || !Array.isArray(parsed.fortalezas)) continue;
      return {
        resumenEjecutivo: String(parsed.resumenEjecutivo || ''),
        contextoCompetitivo: typeof parsed.contextoCompetitivo === 'string' ? parsed.contextoCompetitivo.trim() : undefined,
        comentariosPorIntencion: Array.isArray(parsed.comentariosPorIntencion)
          ? parsed.comentariosPorIntencion.map((c: { intencion?: string; comentario?: string; score?: number; interpretacion?: string }) => ({
              intencion: String(c.intencion || ''),
              comentario: String(c.comentario || ''),
              score: Number(c.score) || 0,
              interpretacion: typeof c.interpretacion === 'string' ? c.interpretacion.trim() : undefined,
            }))
          : [],
        aspectosAdicionales: typeof parsed.aspectosAdicionales === 'string' ? parsed.aspectosAdicionales.trim() : undefined,
        fortalezas: Array.isArray(parsed.fortalezas) ? parsed.fortalezas.map(String).filter(Boolean) : [],
        debilidades: Array.isArray(parsed.debilidades) ? parsed.debilidades.map(String).filter(Boolean) : [],
        sugerencias: Array.isArray(parsed.sugerencias) ? parsed.sugerencias.map(String).filter(Boolean) : [],
        proximosPasos: Array.isArray(parsed.proximosPasos) ? parsed.proximosPasos.map(String).filter(Boolean) : [],
      };
    } catch {
      continue;
    }
  }
  return null;
}

export async function generateWithOpenAI(
  contextText: string
): Promise<DiagnosticAnalysisSingle | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.3,
        max_tokens: 4500,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Analizá este diagnóstico y generá el informe JSON:\n\n${contextText}` },
        ],
      }),
    });

    const json = (await response.json()) as {
      error?: { message?: string };
      choices?: Array<{ message?: { content?: string } }>;
    };
    if (!response.ok) throw new Error(json?.error?.message || 'OpenAI error');
    const content = json?.choices?.[0]?.message?.content?.trim();
    return content ? parseAnalysisResponse(content) : null;
  } catch {
    return null;
  }
}

// Gemini es complementario en el reporte gold; OpenAI es la estrella.
// Mantenemos SOLO modelos Flash baratos para que el costo no se dispare si Flash falla.
// (Antes habia fallback a gemini-2.5-pro que cuesta ~4x mas que Flash.)
const GEMINI_MODELS_TO_TRY = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
];

export async function generateWithGemini(
  contextText: string
): Promise<DiagnosticAnalysisSingle | null> {
  // Doc: GEMINI_API_KEY o GOOGLE_API_KEY; si ambas están, GOOGLE_API_KEY tiene prioridad. Mantenemos GOOGLE_AI_API_KEY por compatibilidad.
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    console.warn('[Gemini] No GOOGLE_API_KEY ni GEMINI_API_KEY; se omite el análisis con Gemini.');
    return null;
  }

  const prompt = `${SYSTEM_PROMPT}\n\nAnalizá este diagnóstico y generá el informe JSON:\n\n${contextText}`;
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  for (const modelId of GEMINI_MODELS_TO_TRY) {
    try {
      console.log(`[Gemini] Probando modelo ${modelId}…`);
      const response = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
          temperature: 0.3,
          // Gemini es LLM de soporte (no estrella). Menos tokens = menos costo.
          maxOutputTokens: 3000,
        },
      });

      const content = response.text?.trim();

      if (!content) {
        console.warn(`[Gemini] ${modelId}: respuesta vacía. finishReason: ${(response as { candidates?: Array<{ finishReason?: string }> }).candidates?.[0]?.finishReason}`);
        continue;
      }

      const parsed = parseAnalysisResponse(content);
      if (parsed) {
        console.log(`[Gemini] OK con modelo ${modelId}.`);
        return parsed;
      }
      console.warn(`[Gemini] ${modelId}: respuesta no parseó como JSON. Primeros 200 chars:`, content.slice(0, 200));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('API_KEY') || msg.includes('403') || msg.includes('permission') || msg.includes('not valid')) {
        console.error(`[Gemini] Error de API key (no se reintenta con otros modelos): ${msg}`);
        return null;
      }
      console.warn(`[Gemini] ${modelId} no disponible: ${msg}`);
    }
  }

  console.warn('[Gemini] Ningún modelo respondió. Probados:', GEMINI_MODELS_TO_TRY.join(', '));
  return null;
}

/**
 * Genera el analisis con Perplexity Sonar via OpenRouter.
 * Sonar es ideal para Cleexs porque su respuesta esta "grounded" en busqueda web reciente,
 * con citations. Reusamos el mismo SYSTEM_PROMPT (JSON estricto) que los otros providers.
 */
export async function generateWithPerplexity(
  contextText: string
): Promise<DiagnosticAnalysisSingle | null> {
  if (!isOpenRouterConfigured()) return null;

  const userPrompt = `Analizá este diagnóstico y generá el informe JSON:\n\n${contextText}`;
  const content = await callOpenRouterChat({
    model: getPerplexityModelId(),
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    temperature: 0.3,
    // LLM complementario (OpenAI es la estrella del reporte). Output mas corto = menor costo.
    maxTokens: 3000,
  });

  if (!content) return null;
  return parseAnalysisResponse(content);
}

/**
 * Genera el analisis con Anthropic Claude (modelo configurable via env) via OpenRouter.
 * Por defecto usa claude-haiku-4.5; se puede bajar a claude-3.5-haiku (legacy, mas barato).
 */
export async function generateWithClaude(
  contextText: string
): Promise<DiagnosticAnalysisSingle | null> {
  if (!isOpenRouterConfigured()) return null;

  const userPrompt = `Analizá este diagnóstico y generá el informe JSON:\n\n${contextText}`;
  const content = await callOpenRouterChat({
    model: getClaudeModelId(),
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    temperature: 0.3,
    // LLM complementario (OpenAI es la estrella del reporte). Output mas corto = menor costo.
    maxTokens: 3000,
  });

  if (!content) return null;
  return parseAnalysisResponse(content);
}

export async function generatePerspectivaAmbos(
  contextText: string,
  openaiAnalysis: DiagnosticAnalysisSingle,
  geminiAnalysis: DiagnosticAnalysisSingle
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const prompt = `Dado estos dos análisis del mismo diagnóstico de marca:

--- ANÁLISIS OPENAI (ChatGPT) ---
Resumen: ${openaiAnalysis.resumenEjecutivo.slice(0, 500)}...
Fortalezas: ${openaiAnalysis.fortalezas.join('; ')}
Debilidades: ${openaiAnalysis.debilidades.join('; ')}

--- ANÁLISIS GEMINI ---
Resumen: ${geminiAnalysis.resumenEjecutivo.slice(0, 500)}...
Fortalezas: ${geminiAnalysis.fortalezas.join('; ')}
Debilidades: ${geminiAnalysis.debilidades.join('; ')}

Generá UN solo párrafo de síntesis (4-6 oraciones) que unifique ambas perspectivas: dónde coinciden, qué conclusión principal sacarías combinando ambas visiones. En español, tono profesional. Sin JSON, solo el párrafo.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.3,
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json?.choices?.[0]?.message?.content?.trim();
    return content || null;
  } catch {
    return null;
  }
}

/**
 * Sintesis combinada de los 4 LLMs cuando estan todos disponibles.
 * Se usa solo en gold y solo si Perplexity y/o Claude respondieron ademas de OpenAI/Gemini.
 */
export async function generatePerspectivaTodas(
  contextText: string,
  providers: {
    openai: DiagnosticAnalysisSingle;
    gemini: DiagnosticAnalysisSingle;
    perplexity?: DiagnosticAnalysisSingle | null;
    claude?: DiagnosticAnalysisSingle | null;
  }
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const blocks: string[] = [
    `--- ANÁLISIS OPENAI (ChatGPT) ---\nResumen: ${providers.openai.resumenEjecutivo.slice(0, 400)}...\nFortalezas: ${providers.openai.fortalezas.join('; ')}\nDebilidades: ${providers.openai.debilidades.join('; ')}`,
    `--- ANÁLISIS GEMINI ---\nResumen: ${providers.gemini.resumenEjecutivo.slice(0, 400)}...\nFortalezas: ${providers.gemini.fortalezas.join('; ')}\nDebilidades: ${providers.gemini.debilidades.join('; ')}`,
  ];
  if (providers.perplexity) {
    blocks.push(
      `--- ANÁLISIS PERPLEXITY (Sonar) ---\nResumen: ${providers.perplexity.resumenEjecutivo.slice(0, 400)}...\nFortalezas: ${providers.perplexity.fortalezas.join('; ')}\nDebilidades: ${providers.perplexity.debilidades.join('; ')}`
    );
  }
  if (providers.claude) {
    blocks.push(
      `--- ANÁLISIS CLAUDE (Sonnet) ---\nResumen: ${providers.claude.resumenEjecutivo.slice(0, 400)}...\nFortalezas: ${providers.claude.fortalezas.join('; ')}\nDebilidades: ${providers.claude.debilidades.join('; ')}`
    );
  }

  const prompt = `Dados estos análisis del mismo diagnóstico de marca generados por distintas IAs:

${blocks.join('\n\n')}

Generá UN solo párrafo de síntesis (5-7 oraciones) que combine las perspectivas: dónde coinciden las IAs (mayor consenso), dónde difieren (matices propios de cada una) y cuál es la conclusión principal combinando todas las visiones. En español, tono profesional, sin JSON ni listas.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.3,
        max_tokens: 700,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json?.choices?.[0]?.message?.content?.trim();
    return content || null;
  } catch {
    return null;
  }
}
