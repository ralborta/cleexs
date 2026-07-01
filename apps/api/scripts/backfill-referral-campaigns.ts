/**
 * Registra en referral_campaigns los refs de auspiciador vistos en tracking (últimas 3 semanas).
 *
 * Uso:
 *   npx tsx scripts/backfill-referral-campaigns.ts
 *   npx tsx scripts/backfill-referral-campaigns.ts --apply
 */

import { runBackfillReferralCampaigns } from '../src/lib/backfill-referral-campaigns';

async function main() {
  const apply = process.argv.includes('--apply');
  if (!process.env.DATABASE_URL) {
    console.error('❌ Falta DATABASE_URL');
    process.exit(1);
  }

  console.log(apply ? '🔧 Aplicando backfill de campañas…' : '🔍 Dry-run (sin cambios)');

  const result = await runBackfillReferralCampaigns({ apply });

  console.log(`\nCandidatos: ${result.candidates}`);
  if (apply) {
    console.log(`Creados: ${result.created} | Actualizados: ${result.updated}`);
  }
  if (result.sample.length) {
    console.log('\nMuestra:');
    for (const row of result.sample) {
      console.log(`  ${row.refCode} → ${row.name} (${row.source})`);
    }
  }

  if (!apply && result.candidates > 0) {
    console.log('\nPara aplicar: npx tsx scripts/backfill-referral-campaigns.ts --apply');
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
