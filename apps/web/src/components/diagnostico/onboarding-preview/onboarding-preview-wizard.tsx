'use client';

import { Building2, Globe, Mail, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const STEPS = [
  { title: '¿En qué país operás?', icon: Globe },
  { title: '¿Cuál es tu rubro?', icon: Building2 },
  { title: 'Motores de IA', icon: Sparkles },
  { title: 'Competidores', icon: Globe },
  { title: 'Recibí tu informe por mail', icon: Mail },
] as const;

export function OnboardingPreviewWizard({
  step,
  mock,
  onBack,
  onNext,
}: {
  step: number;
  mock: {
    country: string;
    industry: string;
    email: string;
    competitors: string[];
  };
  onBack: () => void;
  onNext: () => void;
}) {
  const idx = Math.min(Math.max(step, 1), 5) - 1;
  const meta = STEPS[idx]!;
  const Icon = meta.icon;

  return (
    <div className="m-auto w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-lg">
      <div className="flex gap-1.5 border-b border-slate-100 px-5 pb-3 pt-4">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-1.5 flex-1 rounded-full',
              i <= idx ? 'bg-violet-600' : 'bg-slate-200'
            )}
          />
        ))}
      </div>
      <div className="p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">
          Paso {idx + 1} de 5
        </p>
        <div className="mt-2 flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
            <Icon className="h-5 w-5" />
          </span>
          <h2 className="text-lg font-bold text-slate-900">{meta.title}</h2>
        </div>

        <div className="mt-5 space-y-3 text-sm">
          {idx === 0 && (
            <label className="block">
              <span className="text-slate-600">País detectado</span>
              <input
                readOnly
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-900"
                value={mock.country}
              />
            </label>
          )}
          {idx === 1 && (
            <label className="block">
              <span className="text-slate-600">Rubro sugerido</span>
              <input
                readOnly
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-900"
                value={mock.industry}
              />
            </label>
          )}
          {idx === 2 && (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-slate-700">
              ChatGPT incluido en el plan gratuito. Gemini, Perplexity y Claude quedan registrados
              para Plan Conquistar.
            </p>
          )}
          {idx === 3 && (
            <ul className="space-y-2">
              {mock.competitors.map((c) => (
                <li
                  key={c}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-800"
                >
                  {c}
                </li>
              ))}
            </ul>
          )}
          {idx === 4 && (
            <label className="block">
              <span className="text-slate-600">Correo</span>
              <input
                readOnly
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900"
                value={mock.email}
              />
            </label>
          )}
        </div>

        <div className="mt-6 flex gap-2">
          {idx > 0 ? (
            <Button type="button" variant="outline" onClick={onBack}>
              Atrás
            </Button>
          ) : null}
          <Button type="button" className="flex-1" onClick={onNext}>
            {idx === 4 ? 'Arrancar análisis' : 'Continuar'}
          </Button>
        </div>
      </div>
    </div>
  );
}
