import type { Metadata } from 'next';
import Link from 'next/link';
import { CleexsContactLinks } from '@/components/layout/cleexs-contact-links';
import { CleexsMark } from '@/components/brand/cleexs-mark';

export const metadata: Metadata = {
  title: 'Contacto | Cleexs',
  description: 'Escribinos a info@cleexs.net o seguinos en Instagram, YouTube y X.',
};

export default function ContactoPage() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-gradient-to-b from-slate-50 via-white to-slate-50/90 text-slate-900">
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8 flex items-center gap-3">
          <CleexsMark className="h-10 w-10" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Cleexs</p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Contactanos</h1>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-slate-600">
          ¿Tenés dudas sobre tu diagnóstico, un plan o tu cuenta? Escribinos o seguinos en redes. Te respondemos lo antes
          posible.
        </p>

        <div className="mt-8">
          <CleexsContactLinks variant="full" />
        </div>

        <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
          <p className="font-semibold text-slate-900">Temas de privacidad</p>
          <p className="mt-2 leading-relaxed">
            Para ejercer derechos sobre tus datos personales, usá{' '}
            <a href="mailto:privacidad@cleexs.net" className="font-medium text-violet-700 hover:underline">
              privacidad@cleexs.net
            </a>
            . Consultá también nuestros{' '}
            <Link href="/legal/cleexs" className="font-medium text-violet-700 hover:underline">
              términos y política de privacidad
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
