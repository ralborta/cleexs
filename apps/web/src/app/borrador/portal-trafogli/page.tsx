import type { Metadata } from 'next';
import { PortalTrafogliDraft } from './portal-trafogli-draft';

export const metadata: Metadata = {
  title: 'Borrador · Portal Trafogli | Cleexs',
  description:
    'Borrador de portal de marca para Trafogli (sábanas de bambú): AI Share of Voice, funnel, contenido, email y agentes Cleexs.',
  robots: { index: false, follow: false },
};

export default function BorradorPortalTrafogliPage() {
  return <PortalTrafogliDraft />;
}
