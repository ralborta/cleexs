/**
 * Proveedores de IA para el análisis del diagnóstico.
 * Freemium: solo OpenAI. Gold: OpenAI + Gemini (+ futuros).
 */

export type AIProvider = 'openai' | 'gemini';

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

function parseAnalysisResponse(content: string): DiagnosticAnalysisSingle | null {
  try {
    const cleaned = content.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (!parsed.resumenEjecutivo || !Array.isArray(parsed.fortalezas)) return null;
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
    return null;
  }
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

// Orden de modelos a probar: el primero que responda se usa. gemini-3-flash-preview es el de la doc actual de Google.
const GEMINI_MODELS_TO_TRY = [
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-2.0-flash-001',
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
          maxOutputTokens: 4500,
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
