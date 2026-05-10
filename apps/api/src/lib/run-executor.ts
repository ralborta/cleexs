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

export type OpenAIRankingInput = {
  promptText: string;
  brandName: string;
  competitors: Array<{ name: string; aliases?: string[] }>;
  brandAliases: string[];
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
        { role: 'system', content: OPENAI_RANKING_SYSTEM },
        {
          role: 'user',
          content:
            `${input.promptText}\n\n` +
            `Marca a medir: ${input.brandName}.\n` +
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
