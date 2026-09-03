import type { Metadata } from 'next';
import { EmailDia0OpcionBDraft } from '@/components/planes/email-dia0-opcion-b-draft';

export const metadata: Metadata = {
  title: 'Borrador · Email día 0 opción B | Cleexs',
  description:
    'Opción B: tarjeta score/rivales arriba, sin pie del Plan de Ataque. Solo borrador interno.',
  robots: { index: false, follow: false },
};

export default function BorradorEmailDia0OpcionBPage() {
  return <EmailDia0OpcionBDraft />;
}
