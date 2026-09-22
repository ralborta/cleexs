import type { Metadata } from 'next';
import { EcommPortalAuthGate } from '@/components/ecomm/ecomm-portal-auth-gate';
import { PortalEmpliadosDraft } from './portal-empliados-draft';

export const metadata: Metadata = {
  title: 'Admin Ecomm · Portal Empliados | Cleexs',
  description: 'Admin Ecomm — portal de marca Empliados (empliados.net).',
  robots: { index: false, follow: false },
};

export default function EcommPortalEmpliadosPage() {
  return (
    <EcommPortalAuthGate>
      <PortalEmpliadosDraft />
    </EcommPortalAuthGate>
  );
}
