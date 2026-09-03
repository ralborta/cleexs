import type { Metadata } from 'next';
import { PlanConquistarLandingDraft } from '@/components/planes/plan-conquistar-landing-draft';

export const metadata: Metadata = {
  title: 'Plan Conquistar ChatGPT en 90 Días | Cleexs',
  description:
    'El plan de acción personalizado para que tu marca sea la favorita de ChatGPT, Claude, Gemini y Perplexity. Pago único de USD 99.',
};

/**
 * Landing Plan Conquistar (producción).
 * Versión personalizada (ex-borrador). Backup de la anterior:
 * `/borrador/plan-conquistar-prod-bkp`
 */
export default function PlanConquistarPage() {
  return <PlanConquistarLandingDraft production />;
}
