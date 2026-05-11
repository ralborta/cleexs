import { Prisma } from '@prisma/client';
import type { PromptResultFlags, Top3Entry } from '@cleexs/shared';
import { prisma } from './prisma';
import { parseTop3 } from './parsing';
import { calculateScore } from '@cleexs/shared';
import { updatePRIAReport } from './pria';

/** Versión de prompts activa del tenant, o la del tenant root (000) si el cliente no tiene la suya. */
export async function resolveActivePromptVersion(
  runTenantId: string,
  explicitVersionId?: string | null
) {
  if (explicitVersionId) {
    return prisma.promptVersion.findUnique({ where: { id: explicitVersionId } });
  }
  const own = await prisma.promptVersion.findFirst({
    where: { tenantId: runTenantId, active: true },
    orderBy: { createdAt: 'desc' },
  });
  if (own) return own;
  const root = await prisma.tenant.findFirst({
    where: { tenantCode: '000' },
    select: { id: true },
  });
  if (!root) return null;
  return prisma.promptVersion.findFirst({
    where: { tenantId: root.id, active: true },
    orderBy: { createdAt: 'desc' },
  });
}

export interface ExecuteRunOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  promptVersionId?: string;
  onProgress?: (completed: number, total: number, promptName?: string) => void;
}

type RunForPromptLoad = {
  runType: string;
  weeklyPortalSavedPromptId: string | null;
  brand: { selectedWeeklyPortalPromptId: string | null };
};

/** Prompts a ejecutar: conjunto activo de la versión, o un solo “sombra” solo si runType === weekly_portal. */
export async function loadPromptsForRunExecution(
  run: RunForPromptLoad,
  promptVersionId: string
): Promise<Awaited<ReturnType<typeof prisma.prompt.findMany>>> {
  if (run.runType === 'weekly_portal') {
    const savedId = run.weeklyPortalSavedPromptId ?? run.brand.selectedWeeklyPortalPromptId;

    if (savedId) {
      const shadow = await prisma.prompt.findFirst({
        where: { brandPortalSavedPromptId: savedId },
      });
      if (!shadow?.promptText?.trim()) {
        throw new Error(
          'Corrida weekly_portal: el prompt elegido no está disponible. Volvé a guardarlo en el portal premium o elegí otra opción.'
        );
      }
      return [shadow];
    }

    throw new Error(
      'Corrida weekly_portal: no hay prompt guardado seleccionado. Elegí una de las 5 opciones en el portal premium (Prompts) o enviá weeklyPortalSavedPromptId al crear el run.'
    );
  }

  return prisma.prompt.findMany({
    where: { promptVersionId, active: true },
    orderBy: { createdAt: 'asc' },
  });
}

const OPENAI_RANKING_SYSTEM =
  'Respondé con un ranking claro del Top 3 en formato numerado (1., 2., 3.). ' +
  'Incluí marcas y luego un breve motivo por cada una.';

/** Portal: fuerza coherencia de rubro y evita comparaciones absurdas entre sectores. */
const PORTAL_CONTEXTUAL_RANKING_SYSTEM =
  'Sos un analista de visibilidad de marca ante respuestas de IA. ' +
  'Reglas estrictas:\n' +
  '- Leé el bloque CONTEXTO DEL NEGOCIO: ahí está el rubro, mercado y descripción real del cliente.\n' +
  '- La marca del cliente y los competidores listados pertenecen a ESE mismo universo. No la compares con empresas de sectores totalmente ajenos (ej. software vs cemento) salvo que la consulta del usuario lo pida explícitamente.\n' +
  '- Si la consulta es ambigua, interpretala favoreciendo el sector y el tipo de negocio del contexto.\n' +
  'Respondé en español con un Top 3 numerado (1. 2. 3.) con nombre de marca y un motivo breve por ítem.';

export function buildPortalBrandContextBlock(brand: {
  name: string;
  domain: string | null;
  industry: string | null;
  country: string | null;
  productType: string | null;
  objective: string | null;
  description: string | null;
  businessType: string | null;
  category: string | null;
  subcategory: string | null;
  geoMarket: string | null;
  competitors: { name: string }[];
}): string {
  const desc = brand.description?.trim();
  const comp = brand.competitors.map((c) => c.name).filter(Boolean);
  const lines = [
    '=== CONTEXTO DEL NEGOCIO (usá solo esto para situar marca y competidores) ===',
    `Marca del cliente: ${brand.name}`,
    brand.domain ? `Dominio / web: ${brand.domain}` : null,
    brand.industry ? `Industria / sector: ${brand.industry}` : null,
    brand.businessType ? `Tipo de negocio: ${String(brand.businessType)}` : null,
    brand.category ? `Categoría: ${brand.category}` : null,
    brand.subcategory ? `Subcategoría: ${brand.subcategory}` : null,
    brand.productType ? `Producto / servicio: ${brand.productType}` : null,
    brand.country ? `País: ${brand.country}` : null,
    brand.geoMarket ? `Mercado geo: ${brand.geoMarket}` : null,
    brand.objective ? `Objetivo: ${brand.objective}` : null,
    desc ? `Descripción del negocio: ${desc.slice(0, 1500)}${desc.length > 1500 ? '…' : ''}` : null,
    comp.length > 0
      ? `Competidores del diagnóstico (mismo contexto): ${comp.join(', ')}`
      : 'Competidores del diagnóstico: (ninguno cargado; inferí competidores plausibles del mismo rubro si hace falta).',
    '=== Fin contexto ===',
  ];
  return lines.filter((x): x is string => Boolean(x)).join('\n');
}

export type OpenAIRankingInput = {
  promptText: string;
  brandName: string;
  competitors: Array<{ name: string; aliases?: string[] }>;
  brandAliases: string[];
  /** Si viene informado, se usa prompt contextual de portal (rubro + marca). */
  brandContextBlock?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
};

/**
 * Una sola consulta contra OpenAI (mismo formato que executeRun): sin Persistir Run ni PromptResult.
 * Para previews del portal antes de guardar el texto en BrandPortalSavedPrompt.
 */
export async function executeOpenAIRankingPrompt(input: OpenAIRankingInput): Promise<{
  responseText: string;
  top3: Top3Entry[];
  flags: PromptResultFlags;
  score: number;
  brandPosition: number | null;
  totalTokens: number;
}> {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY no configurada');

  const competitors = input.competitors.map((c) => ({
    name: c.name,
    aliases: (c.aliases as string[]) || [],
  }));
  const competitorList = competitors.map((c) => c.name).join(', ');
  const brandAliases = input.brandAliases;
  const model = input.model ?? 'gpt-4o-mini';
  const temperature = input.temperature ?? 0.2;
  const maxTokens = input.maxTokens ?? 800;
  const usePortalContext = Boolean(input.brandContextBlock?.trim());

  const systemContent = usePortalContext ? PORTAL_CONTEXTUAL_RANKING_SYSTEM : OPENAI_RANKING_SYSTEM;
  const userContent = usePortalContext
    ? `${input.brandContextBlock!.trim()}\n\n--- Consulta simulada (usuario ante una IA) ---\n${input.promptText}\n\n` +
      `Marca del cliente a tener en cuenta: ${input.brandName}.\n` +
      `Competidores de referencia (si aplica): ${competitorList || 'ver contexto'}.`
    : `${input.promptText}\n\n` +
      `Marca a medir: ${input.brandName}.\n` +
      `Competidores: ${competitorList || 'no informados'}.`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90_000);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    signal: controller.signal,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      temperature,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemContent },
        {
          role: 'user',
          content: userContent,
        },
      ],
    }),
  }).finally(() => clearTimeout(timeoutId));

  const responseJson = (await response.json()) as {
    error?: { message?: string };
    usage?: { total_tokens?: number };
    choices?: Array<{ message?: { content?: string } }>;
  };

  if (!response.ok) {
    throw new Error(responseJson?.error?.message || 'Error en OpenAI');
  }

  const totalTokens = responseJson?.usage?.total_tokens ?? 0;
  const raw = responseJson?.choices?.[0]?.message?.content?.trim() || '';

  const { top3, flags } = parseTop3(raw, input.brandName, competitors);
  const brandPosition =
    top3.find(
      (e) =>
        e.name.toLowerCase() === input.brandName.toLowerCase() ||
        brandAliases.some((a) => a.toLowerCase() === e.name.toLowerCase())
    )?.position ?? null;

  const score = calculateScore(brandPosition);
  const maxSize = 100 * 1024;
  const truncated = raw.length > maxSize;
  const responseText = truncated ? raw.slice(0, maxSize) : raw;

  return { responseText, top3, flags, score, brandPosition, totalTokens };
}

export type PortalPromptAnalysis = {
  resumen: string;
  puntos_clave: string[];
  graficos: Array<{ titulo: string; items: Array<{ etiqueta: string; valor: number }> }>;
};

/**
 * Segunda pasada: lectura de la respuesta (sin “score Cleexs”) + datos para 2 gráficos simples.
 */
export async function analyzePortalCustomPromptResponse(input: {
  userPrompt: string;
  responseText: string;
  brandName: string;
  brandContextBlock: string;
}): Promise<PortalPromptAnalysis | null> {
  if (!process.env.OPENAI_API_KEY) return null;

  const model = 'gpt-4o-mini';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000);

  const instruction =
    'Sos analista. Con el contexto del negocio y la respuesta del modelo, generá un análisis en español.\n' +
    'Devolvé SOLO un JSON válido (sin markdown) con esta forma exacta:\n' +
    '{"resumen":"2-4 oraciones","puntos_clave":["máx 5 strings"],"graficos":[' +
    '{"titulo":"string","items":[{"etiqueta":"string","valor":0-100}]},' +
    '{"titulo":"string","items":[{"etiqueta":"string","valor":0-100}]}]}\n' +
    'Los "valor" son relevancia o peso relativo (0-100), no un score de producto Cleexs.\n' +
    'Los gráficos deben ayudar a interpretar la respuesta (ej. marcas mencionadas, temas, tono).\n' +
    'Si hay pocas marcas, completá el segundo gráfico con aspectos del texto (claridad, recomendación, riesgos).';

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    signal: controller.signal,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      max_tokens: 900,
      messages: [
        { role: 'system', content: instruction },
        {
          role: 'user',
          content:
            `${input.brandContextBlock}\n\n` +
            `Marca cliente: ${input.brandName}\n` +
            `Consulta del usuario:\n${input.userPrompt}\n\n` +
            `Respuesta del modelo a analizar:\n${input.responseText.slice(0, 12000)}`,
        },
      ],
    }),
  }).finally(() => clearTimeout(timeoutId));

  const responseJson = (await response.json()) as {
    error?: { message?: string };
    choices?: Array<{ message?: { content?: string } }>;
  };
  if (!response.ok) return null;

  const raw = responseJson?.choices?.[0]?.message?.content?.trim() || '';
  const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try {
    const parsed = JSON.parse(jsonStr) as PortalPromptAnalysis;
    if (typeof parsed.resumen !== 'string' || !Array.isArray(parsed.puntos_clave) || !Array.isArray(parsed.graficos)) {
      return null;
    }
    const graficos = parsed.graficos
      .slice(0, 2)
      .map((g) => ({
        titulo: String(g.titulo ?? '').slice(0, 120),
        items: (Array.isArray(g.items) ? g.items : [])
          .slice(0, 6)
          .map((it) => ({
            etiqueta: String((it as { etiqueta?: string }).etiqueta ?? '').slice(0, 80),
            valor: Math.min(100, Math.max(0, Number((it as { valor?: number }).valor) || 0)),
          }))
          .filter((it) => it.etiqueta),
      }))
      .filter((g) => g.titulo && g.items.length > 0);
    if (graficos.length === 0) return null;
    return {
      resumen: parsed.resumen.slice(0, 2000),
      puntos_clave: parsed.puntos_clave.map((s) => String(s).slice(0, 300)).filter(Boolean).slice(0, 5),
      graficos,
    };
  } catch {
    return null;
  }
}

/**
 * Ejecuta un Run: llama a OpenAI por cada prompt, guarda resultados y actualiza PRIA.
 * Usado por el endpoint de runs y por el flujo de diagnóstico público.
 */
export async function executeRun(
  runId: string,
  options: ExecuteRunOptions = {}
): Promise<{ promptsExecuted: number; tokensUsed: number }> {
  const model = options.model ?? 'gpt-4o-mini';
  const temperature = options.temperature ?? 0.2;
  const maxTokens = options.maxTokens ?? 800;

  const run = await prisma.run.findUnique({
    where: { id: runId },
    include: {
      brand: {
        include: {
          aliases: true,
          competitors: true,
        },
      },
    },
  });

  if (!run) throw new Error('Run no encontrado');

  const promptVersion = await resolveActivePromptVersion(run.tenantId, options.promptVersionId ?? null);

  if (!promptVersion) throw new Error('No hay versión de prompts activa');

  const prompts = await loadPromptsForRunExecution(run, promptVersion.id);

  if (prompts.length === 0) throw new Error('No hay prompts activos');

  await prisma.run.update({
    where: { id: runId },
    data: {
      status: 'running',
      modelMeta: {
        model,
        temperature,
        maxTokens,
        promptVersionId: promptVersion.id,
        promptVersionSource:
          promptVersion.tenantId === run.tenantId ? 'tenant' : 'root_fallback',
      } as unknown as Prisma.InputJsonValue,
    },
  });

  const competitors = run.brand.competitors.map((c) => ({
    name: c.name,
    aliases: (c.aliases as string[]) || [],
  }));
  const competitorList = competitors.map((c) => c.name).join(', ');
  const brandAliases = run.brand.aliases.map((a) => a.alias);
  let totalTokens = 0;

  const OPENAI_TIMEOUT_MS = 90_000; // 90s por prompt para evitar que el run quede colgado

  for (let i = 0; i < prompts.length; i++) {
    const prompt = prompts[i];
    options.onProgress?.(i, prompts.length, prompt.name ?? prompt.promptText?.slice(0, 40));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      signal: controller.signal,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: maxTokens,
        messages: [
          {
            role: 'system',
            content: OPENAI_RANKING_SYSTEM,
          },
          {
            role: 'user',
            content:
              `${prompt.promptText}\n\n` +
              `Marca a medir: ${run.brand.name}.\n` +
              `Competidores: ${competitorList || 'no informados'}.`,
          },
        ],
      }),
    }).finally(() => clearTimeout(timeoutId));

    const responseJson = (await response.json()) as {
      error?: { message?: string };
      usage?: { total_tokens?: number };
      choices?: Array<{ message?: { content?: string } }>;
    };

    if (!response.ok) {
      throw new Error(responseJson?.error?.message || 'Error en OpenAI');
    }

    totalTokens += responseJson?.usage?.total_tokens || 0;
    const responseText = responseJson?.choices?.[0]?.message?.content?.trim() || '';

    const { top3, flags } = parseTop3(responseText, run.brand.name, competitors);
    const brandPosition =
      top3.find(
        (e) =>
          e.name.toLowerCase() === run.brand.name.toLowerCase() ||
          brandAliases.some((a) => a.toLowerCase() === e.name.toLowerCase())
      )?.position || null;

    const score = calculateScore(brandPosition);
    const maxSize = 100 * 1024;
    const truncated = responseText.length > maxSize;
    const finalResponseText = truncated ? responseText.substring(0, maxSize) : responseText;

    await prisma.promptResult.create({
      data: {
        runId,
        promptId: prompt.id,
        responseText: finalResponseText,
        top3Json: top3 as unknown as Prisma.InputJsonValue,
        score,
        flags: flags as unknown as Prisma.InputJsonValue,
        truncated,
      },
    });
  }

  await updatePRIAReport(runId, run.brandId);

  await prisma.run.update({
    where: { id: runId },
    data: {
      status: 'completed',
      tokensUsed: totalTokens,
    },
  });

  return { promptsExecuted: prompts.length, tokensUsed: totalTokens };
}

const GEMINI_MODELS_TO_TRY = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-3-flash-preview',
];

/**
 * Llama a Gemini con un prompt de ranking y devuelve el texto de la respuesta.
 * Prueba modelos en orden hasta que uno responda.
 */
async function callGeminiForRanking(
  userMessage: string,
  systemInstruction: string
): Promise<string> {
  const apiKey =
    process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error('Gemini API key no configurada (GOOGLE_API_KEY o GEMINI_API_KEY)');

  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });
  const fullContent = `${systemInstruction}\n\n${userMessage}`;

  for (const modelId of GEMINI_MODELS_TO_TRY) {
    try {
      const response = await ai.models.generateContent({
        model: modelId,
        contents: fullContent,
        config: {
          temperature: 0.2,
          maxOutputTokens: 800,
        },
      });
      const text = response.text?.trim();
      if (text) return text;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('API_KEY') || msg.includes('403') || msg.includes('not valid')) throw err;
      // probar siguiente modelo
    }
  }
  throw new Error('Ningún modelo Gemini respondió');
}

export interface ExecuteRunGeminiOptions {
  promptVersionId?: string;
  onProgress?: (completed: number, total: number, promptName?: string) => void;
}

/**
 * Ejecuta un Run con Gemini: mismos prompts que executeRun, respuestas de Gemini.
 * Guarda PromptResults y actualiza PRIA. Usado solo en diagnóstico público (runGeminiId).
 */
export async function executeRunGemini(
  runId: string,
  options: ExecuteRunGeminiOptions = {}
): Promise<{ promptsExecuted: number }> {
  const run = await prisma.run.findUnique({
    where: { id: runId },
    include: {
      brand: {
        include: {
          aliases: true,
          competitors: true,
        },
      },
    },
  });

  if (!run) throw new Error('Run no encontrado');

  const promptVersion = await resolveActivePromptVersion(run.tenantId, options.promptVersionId ?? null);

  if (!promptVersion) throw new Error('No hay versión de prompts activa');

  const prompts = await loadPromptsForRunExecution(run, promptVersion.id);

  if (prompts.length === 0) throw new Error('No hay prompts activos');

  await prisma.run.update({
    where: { id: runId },
    data: {
      status: 'running',
      modelMeta: {
        provider: 'gemini',
        promptVersionId: promptVersion.id,
        promptVersionSource:
          promptVersion.tenantId === run.tenantId ? 'tenant' : 'root_fallback',
      } as unknown as Prisma.InputJsonValue,
    },
  });

  const competitors = run.brand.competitors.map((c) => ({
    name: c.name,
    aliases: (c.aliases as string[]) || [],
  }));
  const competitorList = competitors.map((c) => c.name).join(', ');
  const allowedBrands = [run.brand.name, ...competitors.map((c) => c.name)].join(', ');
  const brandAliases = run.brand.aliases.map((a) => a.alias);
  const systemInstruction =
    'Respondé SOLO con un ranking Top 3 en formato numerado estricto: "1. Marca - motivo", "2. Marca - motivo", "3. Marca - motivo". ' +
    'Usá exclusivamente marcas de la lista entregada. No inventes marcas nuevas. No agregues introducción ni cierre.';

  for (let i = 0; i < prompts.length; i++) {
    const prompt = prompts[i];
    options.onProgress?.(i, prompts.length, prompt.name ?? prompt.promptText?.slice(0, 40));

    const userMessage =
      `${prompt.promptText}\n\n` +
      `Marca a medir: ${run.brand.name}.\n` +
      `Competidores: ${competitorList || 'no informados'}.\n` +
      `Marcas permitidas para rankear: ${allowedBrands}.`;

    const responseText = await callGeminiForRanking(userMessage, systemInstruction);

    const { top3, flags } = parseTop3(responseText, run.brand.name, competitors);
    const brandPosition =
      top3.find(
        (e) =>
          e.name.toLowerCase() === run.brand.name.toLowerCase() ||
          brandAliases.some((a) => a.toLowerCase() === e.name.toLowerCase())
      )?.position || null;

    const score = calculateScore(brandPosition);
    const maxSize = 100 * 1024;
    const truncated = responseText.length > maxSize;
    const finalResponseText = truncated ? responseText.substring(0, maxSize) : responseText;

    await prisma.promptResult.create({
      data: {
        runId,
        promptId: prompt.id,
        responseText: finalResponseText,
        top3Json: top3 as unknown as Prisma.InputJsonValue,
        score,
        flags: flags as unknown as Prisma.InputJsonValue,
        truncated,
      },
    });
  }

  await updatePRIAReport(runId, run.brandId);

  await prisma.run.update({
    where: { id: runId },
    data: { status: 'completed' },
  });

  return { promptsExecuted: prompts.length };
}
