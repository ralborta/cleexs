import type { Metadata } from 'next';
import { PlanConquistarLandingDraft } from '@/components/planes/plan-conquistar-landing-draft';

export const metadata: Metadata = {
  title: 'Borrador · Plan Conquistar personalizado | Cleexs',
  description:
    'Borrador de landing Plan Conquistar personalizada con datos del diagnóstico. No es producción.',
  robots: { index: false, follow: false },
};

export default function BorradorPlanConquistarPage() {
  return <PlanConquistarLandingDraft />;
}
