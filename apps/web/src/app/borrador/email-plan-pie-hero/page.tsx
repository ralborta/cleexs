import type { Metadata } from 'next';
import { EmailPlanPieHeroDraft } from '@/components/planes/email-plan-pie-hero-draft';

export const metadata: Metadata = {
  title: 'Borrador · Pie Plan listo (2 clientes) | Cleexs',
  description:
    'Maqueta del pie del email con diseño Plan de Ataque listo, datos reales de 2 clientes.',
  robots: { index: false, follow: false },
};

export default function BorradorEmailPlanPieHeroPage() {
  return <EmailPlanPieHeroDraft />;
}
