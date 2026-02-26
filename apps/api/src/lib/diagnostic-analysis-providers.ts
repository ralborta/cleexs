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

export async function generateWithGemini(
  contextText: string
): Promise<DiagnosticAnalysisSingle | null> {
  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[Gemini] No GOOGLE_AI_API_KEY ni GEMINI_API_KEY; se omite el análisis con Gemini.');
    return null;
  }

  const MODEL = 'gemini-2.5-pro';
  try {
    console.log(`[Gemini] Iniciando llamada con modelo ${MODEL}…`);
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: MODEL,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4500,
        responseMimeType: 'application/json',
      },
    });

    const prompt = `${SYSTEM_PROMPT}\n\nAnalizá este diagnóstico y generá el informe JSON:\n\n${contextText}`;
    const result = await model.generateContent(prompt);
    const response = result.response;
    const content = response.text()?.trim();

    if (!content) {
      console.warn(`[Gemini] Respuesta vacía. finishReason: ${response.candidates?.[0]?.finishReason}`);
      return null;
    }

    const parsed = parseAnalysisResponse(content);
    if (parsed) {
      console.log('[Gemini] Análisis recibido y parseado correctamente.');
    } else {
      console.warn('[Gemini] Respuesta recibida pero no parseó como JSON válido. Primeros 200 chars:', content.slice(0, 200));
    }
    return parsed;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Gemini] Error con modelo ${MODEL}: ${msg}`);
    if (msg.includes('404') || msg.includes('not found')) {
      console.error('[Gemini] El modelo no existe o no está disponible para esta API key. Verificá en: https://ai.google.dev/gemini-api/docs/models');
    }
    if (msg.includes('API_KEY') || msg.includes('403') || msg.includes('permission')) {
      console.error('[Gemini] Problema de autenticación. Verificá que GOOGLE_AI_API_KEY sea válida y tenga acceso a Gemini API.');
    }
    return null;
  }
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
