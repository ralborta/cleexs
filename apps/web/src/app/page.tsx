import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, TrendingUp, ShieldCheck } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-[calc(100vh-72px)] bg-slate-50">

      {/* Hero */}
      <section className="border-b border-slate-200 bg-white px-6 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary-600 mb-4">
            AI Recommendation Index
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl mb-4">
            ¿Cómo te recomienda la IA?
          </h1>
          <p className="text-lg text-slate-500 max-w-xl mx-auto mb-8">
            Medí qué tan bien aparece tu marca cuando la gente le pregunta a ChatGPT o Gemini.
            Comparate con tus competidores con evidencia real.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/diagnostico">
              <Button size="lg" className="bg-primary-600 hover:bg-primary-700 text-white">
                Iniciar diagnóstico gratuito
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/planes">
              <Button size="lg" variant="outline" className="text-slate-600">
                Ver planes
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Feature cards */}
      <section className="px-6 py-12">
        <div className="mx-auto max-w-4xl grid gap-4 md:grid-cols-2">

          <Link href="/dashboard" className="group block rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-slate-300">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50">
                <TrendingUp className="h-5 w-5 text-primary-600" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900 mb-1 group-hover:text-primary-600 transition-colors">
                  Dashboard
                </h2>
                <p className="text-sm text-slate-500">
                  Rankings, tendencias y Cleexs Score con comparación frente a competidores.
                </p>
              </div>
            </div>
          </Link>

          <Link href="/runs" className="group block rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-slate-300">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50">
                <ShieldCheck className="h-5 w-5 text-primary-600" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900 mb-1 group-hover:text-primary-600 transition-colors">
                  Runs
                </h2>
                <p className="text-sm text-slate-500">
                  Corridas auditables con evidencia completa y trazabilidad por prompt.
                </p>
              </div>
            </div>
          </Link>

        </div>
      </section>

    </main>
  );
}
