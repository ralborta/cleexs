import type { Metadata } from 'next';
import { PortalEmpliadosDraft } from './portal-empliados-draft';

export const metadata: Metadata = {
  title: 'Borrador · Portal Empliados | Cleexs',
  description: 'Portal de marca Empliados (empliados.net) con score y SOV reales de Cleexs.',
  robots: { index: false, follow: false },
};

export default function BorradorPortalEmpliadosPage() {
  return <PortalEmpliadosDraft />;
}
