/**
 * Borra toda la data de diagnósticos públicos y runs asociados,
 * dejando solo el último test (el PublicDiagnostic más reciente).
 *
 * Uso (desde la raíz del repo, con DATABASE_URL disponible):
 *   npx tsx prisma/clean-keep-last-test.ts
 * Si tenés .env en apps/api o en la raíz, cargalo antes, ej.:
 *   cd apps/api && npx dotenv -e .env -- npx tsx ../../prisma/clean-keep-last-test.ts
 *   o: export $(grep -v '^#' .env | xargs) && npx tsx prisma/clean-keep-last-test.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const last = await prisma.publicDiagnostic.findFirst({
    orderBy: { createdAt: 'desc' },
  });

  if (!last) {
    console.log('No hay diagnósticos. Nada que limpiar.');
    return;
  }

  const runIds = [last.runId, last.runGeminiId].filter(Boolean) as string[];
  const brandIds =
    runIds.length > 0
      ? (
          await prisma.run.findMany({
            where: { id: { in: runIds } },
            select: { brandId: true },
          })
        )
          .map((r) => r.brandId)
          .filter((id, i, arr) => arr.indexOf(id) === i)
      : [];

  console.log('Se mantiene el último test:', last.id, last.brandName, last.createdAt);
  console.log('Runs a mantener:', runIds);
  console.log('Brands a mantener:', brandIds);

  await prisma.$transaction(async (tx) => {
    // 1. Borrar otros diagnósticos
    const delDiag = await tx.publicDiagnostic.deleteMany({
      where: { id: { not: last.id } },
    });
    console.log('Diagnósticos borrados:', delDiag.count);

    // 2. Borrar runs que no son del último test
    const delRuns = await tx.run.deleteMany({
      where: { id: { notIn: runIds } },
    });
    console.log('Runs borrados:', delRuns.count);

    // 3. Borrar brands que no son del último test
    const brandsToDelete =
      brandIds.length > 0
        ? await tx.brand.findMany({
            where: { id: { notIn: brandIds } },
            select: { id: true },
          })
        : await tx.brand.findMany({ select: { id: true } });
    if (brandsToDelete.length > 0) {
      await tx.brand.deleteMany({
        where: { id: { in: brandsToDelete.map((b) => b.id) } },
      });
      console.log('Brands borrados:', brandsToDelete.length);
    }

    // 4. Borrar versiones de prompts de diagnósticos viejos (DIAG_* salvo el del último)
    const versionNameToKeep = `DIAG_${last.id}`;
    const delVersions = await tx.promptVersion.deleteMany({
      where: {
        AND: [
          { name: { startsWith: 'DIAG_' } },
          { name: { not: versionNameToKeep } },
        ],
      },
    });
    console.log('PromptVersions (DIAG_*) borrados:', delVersions.count);
  });

  console.log('Listo. Solo queda el último test.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
