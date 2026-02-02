import { prisma } from './prisma';
import { calculateScore, calculatePRIA, findBrandPosition, type Top3Entry } from '@cleexs/shared';

/**
 * Calcula PRIA para un Run completo
 */
export async function calculatePRIAForRun(runId: string, brandId: string): Promise<{
  priaTotal: number;
  priaByCategory: Record<string, number>;
}> {
  const run = await prisma.run.findUnique({
    where: { id: runId },
    include: {
      brand: {
        include: {
          aliases: true,
        },
      },
      promptResults: {
        include: {
          prompt: {
            include: {
              category: true,
            },
          },
        },
      },
    },
  });

  if (!run) {
    throw new Error('Run no encontrado');
  }

  const brandAliases = run.brand.aliases.map((a) => a.alias);
  const brandName = run.brand.name;

  // Calcular scores por prompt
  const scoresByCategory: Record<string, number[]> = {};
  const allScores: number[] = [];

  for (const result of run.promptResults) {
    const top3 = result.top3Json as unknown as Top3Entry[];
    const position = findBrandPosition(top3, brandName, brandAliases);

    // Si hay override manual, usar ese
    let finalPosition = position;
    if (result.manualOverride && result.overrideTop3Json) {
      const overrideTop3 = result.overrideTop3Json as unknown as Top3Entry[];
      finalPosition = findBrandPosition(overrideTop3, brandName, brandAliases);
    }

    const score = calculateScore(finalPosition);
    allScores.push(score);

    // Agrupar por categoría
    const categoryId = result.prompt.categoryId || 'uncategorized';
    if (!scoresByCategory[categoryId]) {
      scoresByCategory[categoryId] = [];
    }
    scoresByCategory[categoryId].push(score);
  }

  // Calcular PRIA total
  const priaTotal = calculatePRIA(allScores);

  // Calcular PRIA por categoría
  const priaByCategory: Record<string, number> = {};
  for (const [categoryId, scores] of Object.entries(scoresByCategory)) {
    priaByCategory[categoryId] = calculatePRIA(scores);
  }

  return {
    priaTotal,
    priaByCategory,
  };
}

/**
 * Actualiza o crea PRIAReport para un Run
 */
export async function updatePRIAReport(runId: string, brandId: string): Promise<void> {
  const { priaTotal, priaByCategory } = await calculatePRIAForRun(runId, brandId);

  await prisma.pRIAReport.upsert({
    where: {
      runId_brandId: {
        runId,
        brandId,
      },
    },
    create: {
      runId,
      brandId,
      priaTotal,
      priaByCategoryJson: priaByCategory,
    },
    update: {
      priaTotal,
      priaByCategoryJson: priaByCategory,
    },
  });
}
