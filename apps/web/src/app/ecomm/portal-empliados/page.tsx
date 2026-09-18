import type { Metadata } from 'next';
import { PortalEmpliadosDraft } from './portal-empliados-draft';

export const metadata: Metadata = {
  title: 'Ecomm · Portal Empliados | Cleexs',
  description: 'Portal de marca Empliados (empliados.net) — demo ecomm Cleexs.',
  robots: { index: false, follow: false },
};

export default function EcommPortalEmpliadosPage() {
  return <PortalEmpliadosDraft />;
}
