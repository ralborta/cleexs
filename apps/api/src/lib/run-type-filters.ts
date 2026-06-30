import type { Prisma } from '@prisma/client';

/** Corridas auxiliares por motor (Gemini/Perplexity/Claude); no son la corrida principal ChatGPT. */
export const DIAGNOSTIC_ENGINE_RUN_TYPES = [
  'diagnostic_gemini',
  'diagnostic_perplexity',
  'diagnostic_claude',
] as const;

/** Filtro Prisma: solo corridas de producto (ChatGPT / diagnostic / monthly / etc.). */
export function primaryRunWhere(): Prisma.RunWhereInput {
  return {
    AND: [
      { runType: { notIn: [...DIAGNOSTIC_ENGINE_RUN_TYPES] } },
      { NOT: { runType: { startsWith: 'engine_' } } },
    ],
  };
}
