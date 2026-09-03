import type { Metadata } from 'next';
import { EmailPlanAtaqueDraft } from '@/components/planes/email-plan-ataque-draft';

export const metadata: Metadata = {
  title: 'Borrador · Email Plan de Ataque | Cleexs',
  description:
    'Maqueta del email post-diagnóstico con carátula del Plan de Ataque. Solo borrador interno.',
  robots: { index: false, follow: false },
};

export default function BorradorEmailPlanAtaquePage() {
  return <EmailPlanAtaqueDraft />;
}
