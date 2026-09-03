import type { Metadata } from 'next';
import { PlanConquistarLandingDraft } from '@/components/planes/plan-conquistar-landing-draft';

export const metadata: Metadata = {
  title: 'Borrador · Plan Conquistar personalizado | Cleexs',
  description:
    'Espejo de la landing Plan Conquistar personalizada. La producción vive en /plan-conquistar.',
  robots: { index: false, follow: false },
};

export default function BorradorPlanConquistarPage() {
  return <PlanConquistarLandingDraft />;
}
