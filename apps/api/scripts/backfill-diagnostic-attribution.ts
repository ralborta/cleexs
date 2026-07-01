/**
 * Recupera ref_code en diagnósticos históricos sin atribución.
 *
 * Uso:
 *   npx tsx scripts/backfill-diagnostic-attribution.ts           # dry-run
 *   npx tsx scripts/backfill-diagnostic-attribution.ts --apply   # escribe en BD
 *
 * En producción (Railway API):
 *   railway service link @cleexs/api
 *   railway run npx tsx scripts/backfill-diagnostic-attribution.ts --apply
 */

import { runBackfillDiagnosticAttribution } from '../src/lib/backfill-diagnostic-attribution';

async function main() {
  const apply = process.argv.includes('--apply');
  if (!process.env.DATABASE_URL) {
    console.error('❌ Falta DATABASE_URL');
    process.exit(1);
  }

  console.log(apply ? '🔧 Aplicando backfill...' : '🔍 Dry-run (sin cambios). Pasá --apply para escribir.');

  const result = await runBackfillDiagnosticAttribution({ apply, sampleSize: 20 });

  console.log(`\nCandidatos: ${result.candidates}`);
  if (apply) {
    console.log(`Actualizados: ${result.updated}`);
  }
  console.log('Por fuente:', result.bySource);

  if (result.sample.length > 0) {
    console.log('\nMuestra:');
    for (const row of result.sample) {
      console.log(`  ${row.diagnosticId.slice(0, 8)}… → ref=${row.refCode} (${row.source})`);
    }
  }

  if (!apply && result.candidates > 0) {
    console.log('\nPara aplicar: npx tsx scripts/backfill-diagnostic-attribution.ts --apply');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import('../src/lib/prisma');
    await prisma.$disconnect();
  });
