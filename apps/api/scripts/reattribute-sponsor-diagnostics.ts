/**
 * Reparto histórico tipito / herederos / eldo (últimas 3 semanas).
 *
 *   npx tsx scripts/reattribute-sponsor-diagnostics.ts
 *   npx tsx scripts/reattribute-sponsor-diagnostics.ts --apply
 */

import {
  applySponsorReattribution,
  planSponsorReattribution,
} from '../src/lib/sponsor-reattribution';

async function main() {
  const apply = process.argv.includes('--apply');
  if (!process.env.DATABASE_URL) {
    console.error('❌ Falta DATABASE_URL');
    process.exit(1);
  }

  if (!apply) {
    console.log('🔍 Dry-run — reparto por mensajes WA + proporción 60/34/6 web\n');
    const { summary } = await planSponsorReattribution({ sampleSize: 10 });
    console.log(JSON.stringify(summary, null, 2));
    console.log('\nPara aplicar: npx tsx scripts/reattribute-sponsor-diagnostics.ts --apply');
    return;
  }

  console.log('🔧 Aplicando reparto y campañas…\n');
  const result = await applySponsorReattribution();
  console.log(JSON.stringify(result, null, 2));
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
