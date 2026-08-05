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
    <main className="min-h-[calc(100vh-72px)] bg-gradient-to-b from-violet-50/60 via-white to-white pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:pb-0">
      {/* Hero */}
      <section className="px-4 pt-10 pb-8 sm:px-6 sm:pt-16 sm:pb-12">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-4 inline-flex max-w-full items-center gap-2 rounded-full border border-violet-200 bg-white px-3 py-1.5 text-xs font-medium text-violet-700 shadow-sm sm:mb-5 sm:px-4 sm:py-2 sm:text-sm">
            <Sparkles className="h-4 w-4 shrink-0" />
            <span className="truncate">Plan Conquistar ChatGPT en 90 Días</span>
          </div>
          <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl">
            Hacé que tu marca sea la <span className="text-violet-600">favorita de la IA</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-600 sm:mt-5 sm:text-lg">
            El plan de acción personalizado para que tu marca sea la favorita de ChatGPT, Claude, Gemini y
            demás. Básicamente, es lo que haríamos nosotros si tu empresa fuera nuestra.
          </p>
          <p className="mx-auto mt-3 hidden max-w-2xl text-base leading-relaxed text-slate-600 sm:mt-4 sm:block">
            Descubrí exactamente qué está limitando hoy tu presencia en los motores de respuesta impulsados
            por IA y recibí un plan concreto, priorizado y fácil de ejecutar para mejorar tu posicionamiento.
          </p>

          <div className="mt-6 flex w-full flex-col items-stretch gap-3 sm:mt-8 sm:items-center">
            <PlanConquistarPageCheckout className="w-full sm:w-auto" />
            <PlanConquistarPromoPrice size="md" className="justify-center" />
          </div>
        </div>
      </section>

      {/* Desbloqueá tu Plan */}
      <section className="px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-3xl rounded-2xl border border-violet-100 bg-violet-50/50 p-5 text-center sm:p-9">
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
            Desbloqueá tu Plan de Dominación de IA
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Descubrí exactamente por qué tus competidores aparecen en ChatGPT, Claude, Gemini y Perplexity más
            que vos... y qué tenés que hacer para superarlos.
          </p>
        </div>
      </section>

      {/* Incluye */}
      <section className="px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-5 text-center text-xl font-bold text-slate-900 sm:mb-8 sm:text-2xl">
            Todo lo que incluye
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
            {INCLUYE.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md sm:gap-4 sm:p-5"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="flex items-start gap-2 text-sm font-semibold text-slate-900">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    <span>{title}</span>
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bonus */}
      <section className="px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 sm:p-9">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <Gift className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-900 sm:text-xl">
                Bonus especial: USD 297 en acceso total a Cleexs Premium por 90 días
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-base">
                Monitoreá tu evolución, seguí a tus competidores, detectá nuevas oportunidades y experimentá
                todas las funcionalidades premium sin restricciones. En los próximos 90 días vas a ver
                exactamente qué acciones generan resultados y cuánto crece tu visibilidad frente a la IA.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="px-4 pb-8 pt-4 sm:px-6 sm:pb-20 sm:pt-8">
        <div className="mx-auto max-w-2xl rounded-3xl border border-violet-200 bg-white p-6 text-center shadow-xl sm:p-9">
          <p className="text-sm font-medium uppercase tracking-wide text-violet-600">Pago único</p>
          <div className="mt-3 flex justify-center">
            <PlanConquistarPromoPrice
              size="md"
              className="text-base [&>span:last-child]:text-2xl [&>span:last-child]:font-bold sm:text-lg sm:[&>span:last-child]:text-3xl"
            />
          </div>
          <p className="mx-auto mt-4 max-w-md text-sm text-slate-600 sm:text-base">
            Sumate al Plan Conquistar ChatGPT en 90 días y empezá a construir tu ventaja antes de que tus
            competidores se adelanten.
          </p>
          <div className="mt-6 sm:mt-7">
            <PlanConquistarPageCheckout className="w-full" />
          </div>
          <p className="mt-5 text-sm text-slate-500 sm:mt-6">
            ¿Todavía no probaste el diagnóstico?{' '}
            <Link href="/diagnostico/crear" className="font-medium text-violet-600 hover:underline">
              Hacé tu diagnóstico gratuito
            </Link>
          </p>
        </div>
      </section>

      {/* Sticky buy bar — mobile */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-violet-200/80 bg-white/95 px-3 pt-2.5 shadow-[0_-10px_40px_rgba(15,23,42,0.12)] backdrop-blur-sm sm:hidden pb-[max(0.65rem,env(safe-area-inset-bottom))]">
        <PlanConquistarPageCheckout className="w-full min-h-[48px]" />
        <p className="mt-1.5 text-center text-[11px] font-medium text-slate-500">
          <PlanConquistarPromoPrice size="sm" className="justify-center" />
        </p>
      </div>
    </main>
  );
}
