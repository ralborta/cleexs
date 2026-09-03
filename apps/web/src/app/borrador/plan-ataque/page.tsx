import type { Metadata } from 'next';
import { PlanAtaqueDraft } from '@/components/planes/plan-ataque-draft';

export const metadata: Metadata = {
  title: 'Borrador · Plan de Ataque | Cleexs',
  description:
    'Borrador visual del Plan de Ataque con acentos de color de marca. Menú no funcional. No es producción.',
  robots: { index: false, follow: false },
};

export default function BorradorPlanAtaquePage() {
  return <PlanAtaqueDraft />;
}
