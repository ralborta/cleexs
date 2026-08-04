'use client';

import {
  Briefcase,
  Check,
  ChevronDown,
  Globe,
  Lightbulb,
  Loader2,
  Mail,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LegalSectionId } from '@/components/legal/legal-acceptance-modal';
import { OnboardingCountryLanguageFields } from '@/components/diagnostico/onboarding-country-language-fields';
import {
  OnboardingPreviewCard,
  OnboardingPreviewNav,
  OnboardingPreviewTrustFooter,
} from '@/components/diagnostico/onboarding-preview/onboarding-preview-frame';
import { OnboardingEmailCountdown } from '@/components/diagnostico/onboarding-email-countdown';

const ENGINES = [
  { id: 'chatgpt', label: 'ChatGPT', logo: '/engines/chatgpt.png' },
  { id: 'gemini', label: 'Gemini', logo: '/engines/gemini.png' },
  { id: 'perplexity', label: 'Perplexity', logo: '/engines/perplexity.png' },
  { id: 'claude', label: 'Claude', logo: '/engines/claude.png' },
] as const;

const HOW_FOUND_OPTIONS = [
  { value: '', label: 'Seleccioná una opción (opcional)' },
  { value: 'google', label: 'Búsqueda en Google' },
  { value: 'redes', label: 'Redes sociales' },
  { value: 'recomendacion', label: 'Recomendación de alguien' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'podcast', label: 'Podcast o video' },
  { value: 'otro', label: 'Otro' },
] as const;

const STEPS = [
  { title: '¿En qué país operás?', icon: Globe },
  { title: '¿Cuál es tu rubro?', icon: Briefcase },
  { title: 'Motores de IA', icon: Sparkles },
  { title: 'Competidores', icon: Globe },
  { title: 'Recibí tu informe por mail', icon: Mail },
] as const;

export type OnboardingWizardProps = {
  step: number;
  country: string;
  onCountry: (v: string) => void;
  industry: string;
  onIndustry: (v: string) => void;
  engines: string[];
  onToggleEngine: (id: string) => void;
  competitorUrls: string[];
  onCompetitorChange: (idx: number, val: string) => void;
  onCompetitorRemove: (idx: number) => void;
  onRestoreSuggested: () => void;
  competitorsLoading: boolean;
  competitorsDetectEmpty?: boolean;
  suggestedCompetitorCount?: number;
  filledCompetitorCount: number;
  email: string;
  onEmail: (v: string) => void;
  language: string;
  onLanguage: (v: string) => void;
  firstName: string;
  onFirstName: (v: string) => void;
  lastName: string;
  onLastName: (v: string) => void;
  howFound: string;
  onHowFound: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
  nextLoading?: boolean;
  error?: string | null;
  onOpenLegal?: (section: LegalSectionId) => void;
  showEmailCountdown?: boolean;
  diagnosticId?: string;
  onEmailCountdownExpire?: () => void;
};

export function OnboardingWizard({
  step,
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
  competitorsDetectEmpty,
  suggestedCompetitorCount = 0,
  filledCompetitorCount,
  email,
  onEmail,
  language,
  onLanguage,
  firstName,
  onFirstName,
  lastName,
  onLastName,
  howFound,
  onHowFound,
  onBack,
  onNext,
  nextLoading,
  error,
  onOpenLegal,
  showEmailCountdown,
  diagnosticId,
  onEmailCountdownExpire,
}: OnboardingWizardProps) {
  const idx = Math.min(Math.max(step, 1), 5) - 1;
  const meta = STEPS[idx]!;
  const Icon = meta.icon;

  const canNext =
    idx === 0
      ? Boolean(country.trim())
      : idx === 1
        ? Boolean(industry.trim())
        : idx === 2
          ? engines.length > 0
          : idx === 3
            ? filledCompetitorCount >= 1 && filledCompetitorCount <= 5
            : email.trim().includes('@');

  return (
    <OnboardingPreviewCard>
      <div className="p-6 sm:p-7">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 ring-1 ring-violet-200/60">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-bold leading-snug text-slate-900">{meta.title}</h2>
            {idx === 0 ? (
              <p className="mt-1.5 text-sm text-slate-600">
                Detectamos país e idioma. Confirmalos o elegí otros: definen el mercado del análisis.
              </p>
            ) : null}
            {idx === 1 ? (
              <p className="mt-1.5 text-sm text-slate-600">
                Confirmá o ajustá el rubro que detectamos para tu sector.
              </p>
            ) : null}
            {idx === 2 ? (
              <p className="mt-1.5 text-sm text-slate-600">
                Elegí en qué motores de IA querés medir tu visibilidad.
              </p>
            ) : null}
            {idx === 3 ? (
              <p className="mt-1.5 text-sm text-slate-600">
                Agregá los competidores que querés analizar (mínimo 1, máximo 5).
              </p>
            ) : null}
            {idx === 4 ? (
              <p className="mt-1.5 text-sm text-slate-600">
                Te enviamos el informe por correo cuando esté listo. Los campos opcionales podés dejarlos vacíos.
              </p>
            ) : null}
          </div>
        </div>

        {error ? (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
        ) : null}

        <div className="mt-5">
          {idx === 0 && (
            <OnboardingCountryLanguageFields
              country={country}
              onCountry={onCountry}
              language={language}
              onLanguage={onLanguage}
            />
          )}

          {idx === 1 && (
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">Rubro sugerido</span>
              <input
                type="text"
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 shadow-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                value={industry}
                onChange={(e) => onIndustry(e.target.value)}
                placeholder="Ej. Software B2B, Estudio jurídico…"
              />
            </label>
          )}

          {idx === 2 && (
            <div className="grid grid-cols-2 gap-2.5">
              {ENGINES.map((eng) => {
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
                        : 'border-slate-200 bg-white hover:border-violet-200'
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={eng.logo}
                      alt=""
                      className="h-8 w-8 shrink-0 rounded-md object-contain"
                    />
                    <span className="min-w-0 flex-1 text-sm font-bold leading-tight text-slate-900">
                      {eng.label}
                    </span>
                    <span
                      className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border',
                        selected
                          ? 'border-violet-600 bg-violet-600 text-white'
                          : 'border-slate-300 bg-white'
                      )}
                    >
                      {selected ? <Check className="h-3 w-3" /> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {idx === 3 && (
            <div className="space-y-2">
              {competitorsLoading && filledCompetitorCount < 1 ? (
                <div className="mb-3 flex items-center gap-3 rounded-xl border border-violet-200/80 bg-violet-50/60 px-4 py-3 text-sm text-violet-900">
                  <Loader2 className="h-5 w-5 shrink-0 animate-spin text-violet-600" />
                  <span>Buscando competidores de tu rubro…</span>
                </div>
              ) : null}
              {!competitorsLoading && competitorsDetectEmpty && filledCompetitorCount < 1 ? (
                <div className="mb-3 rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
                  No encontramos sugeridos automáticos para tu rubro. Ingresá al menos 1 URL de competidor abajo
                  (ej. <span className="font-mono text-xs">https://otra-empresa.com</span>).
                </div>
              ) : null}
              {competitorUrls.map((val, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                    <Globe className="h-4 w-4 shrink-0 text-slate-400" />
                    <input
                      type="text"
                      value={val}
                      onChange={(e) => onCompetitorChange(i, e.target.value)}
                      placeholder="https://competidor.com"
                      className="min-w-0 flex-1 bg-transparent font-mono text-xs text-slate-800 outline-none placeholder:text-slate-400"
                    />
                  </div>
                  <button
                    type="button"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    aria-label="Quitar competidor"
                    onClick={() => onCompetitorRemove(i)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {suggestedCompetitorCount > 0 ? (
                <button
                  type="button"
                  className="text-xs font-semibold text-violet-600 hover:text-violet-800"
                  onClick={onRestoreSuggested}
                >
                  Restaurar sugeridos
                </button>
              ) : null}
            </div>
          )}

          {idx === 4 && (
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Correo electrónico</span>
                <input
                  type="email"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                  value={email}
                  onChange={(e) => onEmail(e.target.value)}
                  placeholder="correo@empresa.com"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-500">Nombre (opcional)</span>
                  <input
                    type="text"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm"
                    placeholder="Tu nombre"
                    value={firstName}
                    onChange={(e) => onFirstName(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-500">Apellido (opcional)</span>
                  <input
                    type="text"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm"
                    placeholder="Tu apellido"
                    value={lastName}
                    onChange={(e) => onLastName(e.target.value)}
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">¿Cómo nos encontraste?</span>
                <div className="relative mt-1.5">
                  <select
                    className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-10 text-sm text-slate-900 shadow-sm"
                    value={howFound}
                    onChange={(e) => onHowFound(e.target.value)}
                  >
                    {HOW_FOUND_OPTIONS.map((opt) => (
                      <option key={opt.value || 'empty'} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </label>
              {onOpenLegal ? (
                <p className="text-[11px] leading-relaxed text-slate-400">
                  Al continuar aceptás los{' '}
                  <button
                    type="button"
                    className="font-medium text-violet-600 hover:underline"
                    onClick={() => onOpenLegal('terminos-de-servicio')}
                  >
                    términos de uso
                  </button>{' '}
                  y la{' '}
                  <button
                    type="button"
                    className="font-medium text-violet-600 hover:underline"
                    onClick={() => onOpenLegal('politica-de-privacidad')}
                  >
                    política de privacidad
                  </button>
                  .
                </p>
              ) : null}
              <OnboardingPreviewTrustFooter variant="email" />
            </div>
          )}
        </div>

        {idx === 4 && showEmailCountdown && onEmailCountdownExpire ? (
          <OnboardingEmailCountdown
            active
            variant="inline"
            diagnosticId={diagnosticId}
            onExpire={onEmailCountdownExpire}
            className="mt-5"
          />
        ) : null}

        <OnboardingPreviewNav
          onBack={onBack}
          onNext={onNext}
          nextLabel={idx === 4 ? (nextLoading ? 'Arrancando…' : 'Arrancar análisis') : 'Continuar'}
          nextDisabled={!canNext || nextLoading}
        />

        {idx === 0 ? (
          <div className="mt-4 flex gap-2.5 rounded-xl border border-violet-100 bg-violet-50/60 p-3.5">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
            <p className="text-xs leading-relaxed text-violet-900/80">
              Este dato nos ayuda a personalizar benchmarks y competidores para tu mercado.
            </p>
          </div>
        ) : null}
      </div>
    </OnboardingPreviewCard>
  );
}
