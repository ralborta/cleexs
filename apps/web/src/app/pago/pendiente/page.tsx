import Link from 'next/link';
import { Clock3 } from 'lucide-react';

export default function PagoPendientePage() {
  return (
    <main className="flex min-h-[calc(100vh-72px)] items-center justify-center bg-slate-50 px-4 py-16">
      <section className="w-full max-w-lg rounded-2xl border border-amber-100 bg-white p-8 text-center shadow-sm">
        <Clock3 className="mx-auto h-12 w-12 text-amber-500" />
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Pago pendiente</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          La suscripción quedó pendiente de confirmación. Te avisaremos cuando Mercado Pago confirme el cobro.
        </p>
        <Link
          href="/portal-cliente"
          className="mt-6 inline-flex rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Volver al portal
        </Link>
      </section>
    </main>
  );
}
