import type { Metadata } from 'next';
import { PlanAtaqueUnlocked } from '@/components/planes/plan-ataque-draft';

export const metadata: Metadata = {
  title: 'Tu Plan de Ataque · Plan Conquistar | Cleexs',
  robots: { index: false, follow: false },
};

/**
 * Entregable post-compra Plan Conquistar.
 * Query: ?diagnosticId=…
 */
export default function PortalPlanAtaquePage() {
  return <PlanAtaqueUnlocked />;
}
