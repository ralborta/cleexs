'use client';

import { useMemo } from 'react';
import {
  ArrowLeft,
  Building2,
  Check,
  Globe,
  Loader2,
  Lock,
  Mail,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { COUNTRIES } from '@/lib/countries';

export type SetupStep = 1 | 2 | 3 | 4 | 5 | 6;

/** Motores de IA. En free todos disponibles; la selección queda registrada para plan pago. */
export const ENGINE_OPTIONS: Array<{ id: string; label: string; sub: string }> = [
  { id: 'chatgpt', label: 'ChatGPT', sub: 'OpenAI' },
  { id: 'gemini', label: 'Gemini', sub: 'Google' },
  { id: 'perplexity', label: 'Perplexity', sub: 'Búsqueda IA' },
  { id: 'claude', label: 'Claude', sub: 'Anthropic' },
];

const STEP_META: Record<SetupStep, { label: string; title: string; icon: typeof Globe }> = {
  1: { label: 'Paso 1 de 6', title: 'Confirmá que sos humano', icon: Lock },
  2: { label: 'Paso 2 de 6', title: '¿En qué país operás?', icon: Globe },
  3: { label: 'Paso 3 de 6', title: '¿Cuál es tu rubro?', icon: Building2 },
  4: { label: 'Paso 4 de 6', title: 'Motores de IA', icon: Sparkles },
  5: { label: 'Paso 5 de 6', title: 'Competidores', icon: Globe },
  6: { label: 'Paso 6 de 6', title: 'Recibí tu informe por mail', icon: Mail },
};

interface OnboardingSetupWizardProps {
  step: SetupStep;
  /** step 1 */
  humanOk: boolean;
  onHumanOk: (v: boolean) => void;
  /** step 2 */
  country: string;
  onCountry: (v: string) => void;
  /** step 3 */
  industry: string;
  onIndustry: (v: string) => void;
  /** step 4 */
  engines: string[];
  onToggleEngine: (id: string) => void;
  /** step 5 */
  competitorUrls: string[];
  onCompetitorChange: (idx: number, val: string) => void;
  onCompetitorRemove: (idx: number) => void;
  onRestoreSuggested: () => void;
  competitorsLoading: boolean;
  filledCompetitorCount: number;
  /** step 6 */
  email: string;
  onEmail: (v: string) => void;
  /** acciones */
  onStepNext: () => void;
  onBack: (to: SetupStep) => void;
  onExit: () => void;
  contextLoading: boolean;
  finalizeLoading: boolean;
  error: string | null;
}

export function OnboardingSetupWizard(props: OnboardingSetupWizardProps) {
  const {
    step,
    humanOk,
    onHumanOk,
    country,
    onCountry,
    industry,
    onIndustry,
    engines,
    onToggleEngine,
    competitorUrls,
    onCompetitorChange,
    onCompetitorRemove,
    onRestoreSuggested,
    competitorsLoading,
    filledCompetitorCount,
    email,
    onEmail,
    onStepNext,
    onBack,
    onExit,
    contextLoading,
    finalizeLoading,
    error,
  } = props;

  const meta = STEP_META[step];
  const StepIcon = meta.icon;

  // Lista de países: aseguramos que el sugerido (aunque no esté en el catálogo) sea elegible.
  const countryNames = useMemo(() => {
    const base = COUNTRIES.map((c) => c.name);
    if (country && !base.includes(country)) return [country, ...base];
    return base;
  }, [country]);

  const canNext =
    step === 1
      ? humanOk
      : step === 2
        ? Boolean(country.trim())
        : step === 3
          ? Boolean(industry.trim())
          : step === 4
            ? engines.length > 0
            : step === 5
              ? filledCompetitorCount >= 1 && filledCompetitorCount <= 5
              : email.trim().includes('@');

  const primaryLoading = step === 3 ? contextLoading : step === 6 ? finalizeLoading : false;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 shadow-lg backdrop-blur-sm">
      {/* Progreso de pasos */}
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 pb-3 pt-4">
        <div className="flex flex-1 gap-1.5" aria-hidden>
          {([1, 2, 3, 4, 5, 6] as const).map((s) => (
            <div
              key={s}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors',
                step >= s ? 'bg-violet-600' : 'bg-slate-200'
              )}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={onExit}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label="Salir"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-5">
        {/* Encabezado del paso */}
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 ring-1 ring-violet-200/60">
            <StepIcon className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-600">{meta.label}</p>
            <h2 className="mt-0.5 text-lg font-bold leading-tight text-slate-900">{meta.title}</h2>
          </div>
        </div>

        <form
          className="mt-5 flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            if (canNext && !primaryLoading) onStepNext();
          }}
        >
          {/* ---------- Paso 1: humano ---------- */}
          {step === 1 && (
            <div className="flex flex-1 flex-col">
              <p className="text-sm leading-relaxed text-slate-600">
                Con un click activamos el análisis en vivo de tu sitio. Vas a confirmar país y rubro, y después ver el
                progreso paso a paso hasta tu Cleexs Score.
              </p>
              <label className="mt-5 flex w-full cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-left">
                <input
                  type="checkbox"
                  checked={humanOk}
                  onChange={(e) => onHumanOk(e.target.checked)}
                  className="h-[18px] w-[18px] shrink-0 rounded border-slate-400 text-violet-600 focus:ring-2 focus:ring-violet-500"
                />
                <span className="text-sm font-medium text-slate-800">Soy humano</span>
              </label>
            </div>
          )}

          {/* ---------- Paso 2: país ---------- */}
          {step === 2 && (
            <div className="flex flex-1 flex-col">
              <p className="text-sm leading-relaxed text-slate-600">
                Detectamos este país. Confirmalo o elegí otro: define el mercado del análisis.
              </p>
              <div className="mt-4">
                <label htmlFor="setup-country" className="text-xs font-semibold text-slate-500">
                  País
                </label>
                <select
                  id="setup-country"
                  value={country}
                  onChange={(e) => onCountry(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                >
                  {countryNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-violet-50/70 px-3 py-2 text-xs text-violet-800">
                <Check className="h-3.5 w-3.5 shrink-0" />
                Sugerido por Cleexs según tu sitio. Podés cambiarlo.
              </div>
            </div>
          )}

          {/* ---------- Paso 3: rubro ---------- */}
          {step === 3 && (
            <div className="flex flex-1 flex-col">
              <p className="text-sm leading-relaxed text-slate-600">
                Este es el rubro que inferimos. Confirmalo o reescribilo con tus palabras: ajusta los competidores y el
                análisis.
              </p>
              <div className="mt-4">
                <label htmlFor="setup-industry" className="text-xs font-semibold text-slate-500">
                  Rubro / industria
                </label>
                <input
                  id="setup-industry"
                  type="text"
                  value={industry}
                  onChange={(e) => onIndustry(e.target.value)}
                  placeholder="Ej. Estudio jurídico, Logística 3PL, Restaurante…"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                />
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                Al confirmar, arranca el análisis y detectamos competidores de tu rubro.
              </div>
            </div>
          )}

          {/* ---------- Paso 4: motores ---------- */}
          {step === 4 && (
            <div className="flex flex-1 flex-col">
              <p className="text-sm leading-relaxed text-slate-600">
                Hoy el análisis es gratis con ChatGPT. Elegí qué motores querés medir: dejamos registrada tu selección
                para cuando sumes el plan pago.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                {ENGINE_OPTIONS.map((eng) => {
                  const selected = engines.includes(eng.id);
                  return (
                    <button
                      key={eng.id}
                      type="button"
                      onClick={() => onToggleEngine(eng.id)}
                      className={cn(
                        'flex items-center gap-2.5 rounded-xl border p-3 text-left transition',
                        selected
                          ? 'border-violet-400 bg-violet-50 ring-2 ring-violet-100'
                          : 'border-slate-200 bg-white hover:border-violet-200 hover:bg-violet-50/40'
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border',
                          selected ? 'border-violet-600 bg-violet-600 text-white' : 'border-slate-300 bg-white'
                        )}
                      >
                        {selected && <Check className="h-3 w-3" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-slate-800">{eng.label}</span>
                        <span className="block truncate text-[11px] text-slate-500">{eng.sub}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ---------- Paso 5: competidores ---------- */}
          {step === 5 && (
            <div className="flex flex-1 flex-col">
              <p className="text-sm leading-relaxed text-slate-600">
                Estos son los competidores de tu sector. Dejá los que quieras comparar (al menos 1, hasta 5).
              </p>
              {competitorsLoading && filledCompetitorCount < 1 && (
                <div className="mt-4 flex items-center gap-3 rounded-xl border border-violet-200/80 bg-violet-50/60 px-4 py-3 text-sm text-violet-900">
                  <Loader2 className="h-5 w-5 shrink-0 animate-spin text-violet-600" />
                  <span>Buscando competidores de tu rubro… podés cargarlos a mano abajo.</span>
                </div>
              )}
              <div className="mt-4 space-y-2">
                {competitorUrls.map((val, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/50 px-2 py-1.5"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-bold tabular-nums text-slate-500 ring-1 ring-slate-200/80">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      inputMode="url"
                      id={`comp-url-${idx}`}
                      value={val}
                      onChange={(e) => onCompetitorChange(idx, e.target.value)}
                      className="min-w-0 flex-1 border-0 bg-transparent py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring-0"
                      placeholder="https://competidor.com"
                    />
                    <button
                      type="button"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-violet-600 transition hover:bg-violet-50"
                      aria-label={`Editar URL ${idx + 1}`}
                      onClick={() => document.getElementById(`comp-url-${idx}`)?.focus()}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onCompetitorRemove(idx)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-red-500 transition hover:bg-red-50"
                      aria-label={`Quitar competidor ${idx + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={onRestoreSuggested}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-600 hover:text-violet-700"
                >
                  <Plus className="h-4 w-4" />
                  Restaurar sugeridos
                </button>
              </div>
            </div>
          )}

          {/* ---------- Paso 6: email ---------- */}
          {step === 6 && (
            <div className="flex flex-1 flex-col">
              <p className="text-sm leading-relaxed text-slate-600">
                Escribí el correo donde querés recibir el aviso y el resumen cuando cierre el análisis. Sin spam.
              </p>
              <div className="mt-4">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => onEmail(e.target.value)}
                  placeholder="correo@empresa.com"
                  autoComplete="email"
                  className="w-full rounded-xl border border-violet-200/90 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                />
              </div>
              <p className="mt-4 text-[11px] text-slate-500">
                Al iniciar aceptás los{' '}
                <a href="/legal/cleexs#terminos-de-servicio" className="text-violet-600 underline">
                  Términos
                </a>{' '}
                y la{' '}
                <a href="/legal/cleexs#politica-de-privacidad" className="text-violet-600 underline">
                  Privacidad
                </a>
                .
              </p>
            </div>
          )}

          {error && (
            <p className="mt-3 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          {/* Acciones */}
          <div className="mt-5 flex items-center justify-between gap-2 border-t border-slate-100 pt-4">
            {step > 1 ? (
              <Button
                type="button"
                variant="ghost"
                className="gap-1 rounded-xl text-slate-700"
                onClick={() => onBack((step - 1) as SetupStep)}
                disabled={primaryLoading}
              >
                <ArrowLeft className="h-4 w-4" />
                Atrás
              </Button>
            ) : (
              <Button type="button" variant="outline" className="rounded-xl" onClick={onExit}>
                Cancelar
              </Button>
            )}
            <Button
              type="submit"
              disabled={!canNext || primaryLoading}
              className="gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 text-sm font-semibold text-white shadow-md shadow-violet-600/25 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-40"
            >
              {step === 3 && (primaryLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />)}
              {step === 6 && (primaryLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />)}
              {step === 1 && 'Continuar'}
              {step === 2 && 'Continuar'}
              {step === 3 && (primaryLoading ? 'Iniciando…' : 'Confirmar y empezar')}
              {step === 4 && 'Continuar'}
              {step === 5 && 'Continuar'}
              {step === 6 && (primaryLoading ? 'Iniciando…' : 'Ver mi Cleexs Score')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
