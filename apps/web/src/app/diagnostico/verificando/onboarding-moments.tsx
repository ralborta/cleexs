'use client';

import { Button } from '@/components/ui/button';
import { getPartialInsight, type SitePreviewContext } from './diagnostic-onboarding';
import { cn } from '@/lib/utils';
import { TrendingUp } from 'lucide-react';

export type MomentKind =
  | { type: 'idle' }
  | { type: 'quiz1' }
  | { type: 'quiz2' }
  | { type: 'insight'; stepIndex: number; ctx: SitePreviewContext }
  | { type: 'social' }
  | { type: 'social2' }
  | { type: 'prediction' };

type Props = {
  moment: MomentKind;
  onClose: () => void;
  onQuiz1: (value: string) => void;
  onQuiz2: (value: string) => void;
  onPredict: (range: string) => void;
  industry?: string | null;
  className?: string;
};

export function OnboardingMomentStack({ moment, onClose, onQuiz1, onQuiz2, onPredict, industry, className }: Props) {
  if (moment.type === 'idle') return null;

  return (
    <div
      className={cn(
        'relative z-20 mt-3 overflow-hidden rounded-xl border border-slate-200/90 bg-white p-4 text-left shadow-lg ring-1 ring-slate-100/80',
        className
      )}
    >
      {moment.type === 'quiz1' && (
        <div>
          <p className="text-sm font-bold text-slate-900">Una pregunta rápida</p>
          <p className="mt-1.5 text-xs text-slate-600">
            Hoy, si alguien le pregunta a ChatGPT por tu servicio, ¿cómo creés que te trata en la respuesta?
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {[
              { v: 'recomienda', label: 'Me prioriza o recomienda' },
              { v: 'menciona_tarde', label: 'Me menciona al final o poco' },
              { v: 'poco', label: 'Casi no me nombra' },
            ].map((o) => (
              <Button
                key={o.v}
                type="button"
                variant="outline"
                className="h-auto justify-start whitespace-normal border-slate-200 py-2 text-left text-sm font-medium text-slate-800"
                onClick={() => onQuiz1(o.v)}
              >
                {o.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {moment.type === 'quiz2' && (
        <div>
          <p className="text-sm font-bold text-slate-900">Segundo pulso</p>
          <p className="mt-1.5 text-xs text-slate-600">¿Ves a tus competidores aparecer en las respuestas de IA hoy?</p>
          <div className="mt-3 flex flex-col gap-2">
            {[
              { v: 'si', label: 'Sí, a menudo' },
              { v: 'a_veces', label: 'A veces' },
              { v: 'no', label: 'No estoy seguro' },
            ].map((o) => (
              <Button
                key={o.v}
                type="button"
                variant="outline"
                className="h-auto justify-start border-slate-200 py-2 text-left text-sm"
                onClick={() => onQuiz2(o.v)}
              >
                {o.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {moment.type === 'insight' && (() => {
        const { text } = getPartialInsight(moment.stepIndex, moment.ctx);
        return (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700/90">Hallazgo en curso</p>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-800">{text}</p>
            <p className="mt-1 text-[10px] text-slate-400">Paso {moment.stepIndex + 1} de 11</p>
            <Button type="button" size="sm" className="mt-3 w-full bg-slate-900 text-white" onClick={onClose}>
              Entendido, seguimos
            </Button>
          </div>
        );
      })()}

      {moment.type === 'social' && (
        <div>
          <p className="text-sm font-bold text-slate-900">El terreno se mueve</p>
          <p className="mt-1.5 text-xs text-slate-600">
            Otras empresas{industry ? ` en ${industry}` : ' de tu industria'} ya compiten en cómo responde la IA. Cada
            análisis suma señal frente a tu competencia.
          </p>
          <Button type="button" size="sm" variant="secondary" className="mt-3 w-full" onClick={onClose}>
            Seguir
          </Button>
        </div>
      )}

      {moment.type === 'social2' && (
        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-100/70">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 ring-1 ring-blue-100">
              <TrendingUp className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900">Tu categoría hoy</p>
              <p className="mt-1.5 text-sm leading-snug text-slate-600">
                Las búsquedas conversacionales y las respuestas de asistentes ya priorizan marcas con señal fuerte.
                Estamos anotando dónde te ubicás.
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            className="mt-3 h-10 w-full rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 text-sm font-semibold text-white shadow-md shadow-blue-600/20 hover:from-blue-700 hover:to-blue-600"
            onClick={onClose}
          >
            Continuar
          </Button>
        </div>
      )}

      {moment.type === 'prediction' && (
        <div>
          <p className="text-sm font-bold text-slate-900">¿Cuánto creés que es tu Cleexs Score?</p>
          <p className="mb-2 mt-0.5 text-xs text-slate-500">Una estimación antes de ver el número final.</p>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { v: '0-25', l: '0 – 25' },
                { v: '25-50', l: '25 – 50' },
                { v: '50-75', l: '50 – 75' },
                { v: '75-100', l: '75 – 100' },
              ] as const
            ).map((b) => (
              <Button
                key={b.v}
                type="button"
                variant="outline"
                className="h-11 border-violet-200 text-sm font-semibold text-violet-900"
                onClick={() => onPredict(b.v)}
              >
                {b.l}
              </Button>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
