import type { Metadata } from 'next';
import { EcommPortalAuthGate } from '@/components/ecomm/ecomm-portal-auth-gate';
import { AgencyLlmVisibilityView } from '../portal-empliados/agency-llm-visibility-view';

export const metadata: Metadata = {
  title: 'Cleexs LLM Visibility Dashboard | Cleexs',
  description:
    'Cleexs · Medición de Visibilidad LLM (Piloto Empliados). Dashboard Stitch: Cleexs LLM Visibility Dashboard.',
  robots: { index: false, follow: false },
};

/**
 * Ruta dedicada al proyecto Stitch "Cleexs LLM Visibility Dashboard"
 * (projects/4675951797588718112) — sin chrome del Agency portal.
 */
export default function CleexsLlmVisibilityDashboardPage() {
  return (
    <EcommPortalAuthGate
      title="Cleexs LLM Visibility Dashboard"
      subtitle="Piloto Empliados · Stitch · acceso demo"
    >
      <main className="min-h-screen bg-[#070a11] p-3 sm:p-5">
        <AgencyLlmVisibilityView />
      </main>
    </EcommPortalAuthGate>
  );
}
