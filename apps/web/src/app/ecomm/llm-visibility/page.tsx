import type { Metadata } from 'next';
import { AgencyLlmVisibilityView } from '../portal-empliados/agency-llm-visibility-view';

export const metadata: Metadata = {
  title: 'Cleexs LLM Visibility Dashboard | Cleexs',
  description:
    'Cleexs · Medición de Visibilidad LLM (Piloto Empliados). Dashboard Stitch: Cleexs LLM Visibility Dashboard.',
  robots: { index: false, follow: false },
};

/**
 * Ruta dedicada al proyecto Stitch "Cleexs LLM Visibility Dashboard"
 * (projects/4675951797588718112) — preview EasyPanel sin gate de login.
 */
export default function CleexsLlmVisibilityDashboardPage() {
  return (
    <main className="min-h-screen bg-[#070a11] p-3 sm:p-5">
      <AgencyLlmVisibilityView />
    </main>
  );
}
