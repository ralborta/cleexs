import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Check,
  Sparkles,
  Target,
  BarChart3,
  Users,
  ListChecks,
  CalendarCheck,
  GraduationCap,
  ClipboardCheck,
  RefreshCw,
  Gift,
} from 'lucide-react';
import { PlanConquistarPromoPrice } from '@/components/planes/plan-conquistar-checkout-button';
import { PlanConquistarPageCheckout } from '@/components/planes/plan-conquistar-page-checkout';

export const metadata: Metadata = {
  title: 'Plan Conquistar ChatGPT en 90 Días | Cleexs',
  description:
    'El plan de acción personalizado para que tu marca sea la favorita de ChatGPT, Claude, Gemini y Perplexity. Pago único de USD 99.',
};

const INCLUYE: Array<{ icon: typeof Check; title: string; desc: string }> = [
  {
    icon: Target,
    title: 'Auditoría avanzada de Visibilidad IA',
    desc: 'Analizamos en profundidad cómo te ven los principales motores de IA y revelamos los factores que están limitando tu visibilidad.',
  },
  {
    icon: BarChart3,
    title: 'Cleexs Score detallado por motor de IA',
    desc: 'Conocé cómo rankea tu marca en los 4 motores más importantes: ChatGPT, Claude, Gemini y Perplexity, para saber dónde estás perdiendo oportunidades.',
  },
  {
    icon: Users,
    title: 'Comparación contra competidores',
    desc: 'Comparate contra las empresas que hoy están capturando la atención que podría ser tuya.',
  },
  {
    icon: ListChecks,
    title: 'Las 20 oportunidades de mayor impacto',
    desc: 'Te mostramos las acciones concretas que pueden generar la mejora más rápida en tu posicionamiento en los motores de IA.',
  },
  {
    icon: CalendarCheck,
    title: 'Plan de acción personalizado de 90 días',
    desc: 'Un plan concreto, paso a paso, priorizado por impacto y facilidad de implementación, para mejorar tu presencia en los motores de IA.',
  },
  {
    icon: GraduationCap,
    title: 'Curso Express de Visibilidad IA',
    desc: 'Aprendé cómo funciona el nuevo SEO para ChatGPT y cómo ganar en este nuevo mundo. Videos cortos y concretos.',
  },
  {
    icon: ClipboardCheck,
    title: 'Checklist de implementación',
    desc: 'Una guía práctica para ejecutar cada recomendación sin perder tiempo.',
  },
  {
    icon: RefreshCw,
    title: 'Re-análisis completo a los 75 días',
    desc: 'Medimos nuevamente tu progreso y verificamos cuánto avanzaste en estos primeros 75 días.',
  },
];

export default function PlanConquistarPage() {
  return (
    <main className="min-h-[calc(100vh-72px)] bg-gradient-to-b from-violet-50/60 via-white to-white">
      {/* Hero */}
      <section className="px-6 pt-16 pb-12">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white px-4 py-2 text-sm font-medium text-violet-700 shadow-sm">
            <Sparkles className="h-4 w-4" />
            Plan Conquistar ChatGPT en 90 Días
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Hacé que tu marca sea la <span className="text-violet-600">favorita de la IA</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">
            El plan de acción personalizado para que tu marca sea la favorita de ChatGPT, Claude, Gemini y
            demás. Básicamente, es lo que haríamos nosotros si tu empresa fuera nuestra.
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-600">
            Descubrí exactamente qué está limitando hoy tu presencia en los motores de respuesta impulsados
            por IA y recibí un plan concreto, priorizado y fácil de ejecutar para mejorar tu posicionamiento.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3">
            <PlanConquistarPageCheckout />
            <PlanConquistarPromoPrice size="md" className="justify-center" />
          </div>
        </div>
      </section>

      {/* Desbloqueá tu Plan */}
      <section className="px-6 py-10">
        <div className="mx-auto max-w-3xl rounded-2xl border border-violet-100 bg-violet-50/50 p-7 text-center sm:p-9">
          <h2 className="text-2xl font-bold text-slate-900">🚀 Desbloqueá tu Plan de Dominación de IA</h2>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-slate-600">
            Descubrí exactamente por qué tus competidores aparecen en ChatGPT, Claude, Gemini y Perplexity más
            que vos... y qué tenés que hacer para superarlos.
          </p>
        </div>
      </section>

      {/* Incluye */}
      <section className="px-6 py-10">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-8 text-center text-2xl font-bold text-slate-900">Todo lo que incluye</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {INCLUYE.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Check className="h-4 w-4 text-emerald-500" />
                    {title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bonus */}
      <section className="px-6 py-10">
        <div className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-7 sm:p-9">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <Gift className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Bonus especial: USD 297 en acceso total a Cleexs Premium por 90 días
              </h2>
              <p className="mt-2 text-base leading-relaxed text-slate-600">
                Monitoreá tu evolución, seguí a tus competidores, detectá nuevas oportunidades y experimentá
                todas las funcionalidades premium sin restricciones. En los próximos 90 días vas a ver
                exactamente qué acciones generan resultados y cuánto crece tu visibilidad frente a la IA.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="px-6 pb-20 pt-8">
        <div className="mx-auto max-w-2xl rounded-3xl border border-violet-200 bg-white p-9 text-center shadow-xl">
          <p className="text-sm font-medium uppercase tracking-wide text-violet-600">Pago único</p>
          <div className="mt-3 flex justify-center">
            <PlanConquistarPromoPrice size="md" className="text-lg [&>span:last-child]:text-3xl [&>span:last-child]:font-bold" />
          </div>
          <p className="mx-auto mt-4 max-w-md text-base text-slate-600">
            Sumate al Plan Conquistar ChatGPT en 90 días y empezá a construir tu ventaja antes de que tus
            competidores se adelanten.
          </p>
          <div className="mt-7">
            <PlanConquistarPageCheckout className="w-full sm:w-auto" />
          </div>
          <p className="mt-6 text-sm text-slate-500">
            ¿Todavía no probaste el diagnóstico?{' '}
            <Link href="/diagnostico/crear" className="font-medium text-violet-600 hover:underline">
              Hacé tu diagnóstico gratuito
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
