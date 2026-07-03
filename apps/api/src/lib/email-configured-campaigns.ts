import { isExcludedFromEmailBatchMonitor } from './email-batch-status';

/**
 * Campañas de la secuencia configurada con Gonzalo (cron semanal + mensual).
 */
export function isConfiguredMarketingCampaignSlug(campaignSlug: string): boolean {
  const slug = campaignSlug.trim().toLowerCase();
  if (!slug || isExcludedFromEmailBatchMonitor(slug)) return false;
  if (slug.startsWith('weekly-auto-w')) return true;
  if (slug.startsWith('monthly-score-')) return true;
  if (slug.startsWith('free-onboarding-s')) return true;
  return false;
}

export function isAdHocEmailTestBatch(campaignSlug: string): boolean {
  const slug = campaignSlug.trim().toLowerCase();
  if (isExcludedFromEmailBatchMonitor(slug)) return false;
  return !isConfiguredMarketingCampaignSlug(slug);
}

/** Mismo alcance que el monitor de batches: incluye pruebas (test-1), excluye transaccionales. */
export function isEmailBatchAnalyticsSlug(campaignSlug: string): boolean {
  return !isExcludedFromEmailBatchMonitor(campaignSlug);
}

export const CONFIGURED_CAMPAIGN_SCOPE_NOTE =
  'Incluye secuencia programada (semanal + mensual) y batches de prueba (test-1, etc.). Excluye solo correos transaccionales (link diagnóstico).';
