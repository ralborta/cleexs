import type { Metadata } from 'next';
import { CleexsLegalBackFooter } from '@/components/legal/cleexs-legal-back-footer';
import { CleexsLegalDocument } from '@/components/legal/cleexs-legal-document';

export const metadata: Metadata = {
  title: 'Términos de servicio y política de privacidad | Cleexs',
  description:
    'Términos de servicio y política de privacidad de Cleexs: análisis de visibilidad, SEO, IA y datos personales.',
};

export default function LegalCleexsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50/90 text-slate-900">
      <main>
        <CleexsLegalDocument />
      </main>

      <CleexsLegalBackFooter />
    </div>
  );
}
