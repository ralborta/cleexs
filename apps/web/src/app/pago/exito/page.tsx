import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';

export default function PagoExitoPage() {
  return (
    <main className="flex min-h-[calc(100vh-72px)] items-center justify-center bg-slate-50 px-4 py-16">
      <section className="w-full max-w-lg rounded-2xl border border-emerald-100 bg-white p-8 text-center shadow-sm">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Pago recibido</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Mercado Pago nos va a notificar la aprobación por webhook. Si el plan no aparece activo al instante,
          esperá unos segundos y volvé al portal.
        </p>
        <Link
          href="/portal-cliente"
          className="mt-6 inline-flex rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
        >
          Volver al portal
        </Link>
      </section>
    </main>
  );
}
