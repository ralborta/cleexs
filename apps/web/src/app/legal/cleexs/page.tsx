import type { Metadata } from 'next';
import Link from 'next/link';
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
      <header className="sticky top-0 z-20 border-b border-slate-200/90 bg-white/90 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link
            href="/"
            className="text-sm font-semibold tracking-tight text-slate-800 transition hover:text-violet-700"
          >
            ← Cleexs
          </Link>
          <span className="hidden text-xs font-medium uppercase tracking-widest text-slate-400 sm:inline">
            Documento legal
          </span>
        </div>
      </header>

      <main>
        <CleexsLegalDocument />
      </main>

      <CleexsLegalBackFooter />
    </div>
  );
}
