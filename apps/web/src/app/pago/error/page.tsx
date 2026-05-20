import Link from 'next/link';
import { AlertCircle } from 'lucide-react';

export default function PagoErrorPage() {
  return (
    <main className="flex min-h-[calc(100vh-72px)] items-center justify-center bg-slate-50 px-4 py-16">
      <section className="w-full max-w-lg rounded-2xl border border-rose-100 bg-white p-8 text-center shadow-sm">
        <AlertCircle className="mx-auto h-12 w-12 text-rose-500" />
        <h1 className="mt-4 text-2xl font-bold text-slate-900">No se pudo confirmar el pago</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Podés volver a intentar desde la pantalla de suscripción. Si el problema sigue, contactanos y revisamos el caso.
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
