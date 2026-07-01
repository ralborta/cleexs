import { isExcludedFromEmailBatchMonitor } from './email-batch-status';

/**
 * Campañas de la secuencia configurada con Gonzalo (cron semanal + mensual).
 * Excluye pruebas manuales (test-1, broadcast-*, batches ad-hoc).
 */
export function isConfiguredMarketingCampaignSlug(campaignSlug: string): boolean {
  const slug = campaignSlug.trim().toLowerCase();
  if (!slug || isExcludedFromEmailBatchMonitor(slug)) return false;
  if (slug.startsWith('weekly-auto-w')) return true;
  if (slug.startsWith('monthly-score-')) return true;
  return false;
}

export function isAdHocEmailTestBatch(campaignSlug: string): boolean {
  const slug = campaignSlug.trim().toLowerCase();
  if (isExcludedFromEmailBatchMonitor(slug)) return false;
  return !isConfiguredMarketingCampaignSlug(slug);
}

export const CONFIGURED_CAMPAIGN_SCOPE_NOTE =
  'Solo cuenta envíos programados: semanal (weekly-auto-w…) y mensual score (monthly-score-…). Las pruebas manuales (test-1, etc.) aparecen abajo en detalle operativo.';
