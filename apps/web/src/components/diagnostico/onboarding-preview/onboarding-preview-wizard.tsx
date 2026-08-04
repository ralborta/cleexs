'use client';

import { useState } from 'react';
import {
  Briefcase,
  Check,
  ChevronDown,
  Globe,
  Lightbulb,
  Mail,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  OnboardingPreviewCard,
  OnboardingPreviewNav,
  OnboardingPreviewTrustFooter,
} from './onboarding-preview-frame';
import { OnboardingCountryLanguageFields, defaultLanguageForCountry } from '@/components/diagnostico/onboarding-country-language-fields';

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
  const [engines, setEngines] = useState<string[]>([]);
  const [competitors, setCompetitors] = useState(mock.competitors);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [howFound, setHowFound] = useState('');
  const [previewCountry, setPreviewCountry] = useState(mock.country);
  const [previewLanguage, setPreviewLanguage] = useState(() => defaultLanguageForCountry(mock.country));

  const handlePreviewCountry = (v: string) => {
    setPreviewCountry(v);
    setPreviewLanguage(defaultLanguageForCountry(v));
  };

  const toggleEngine = (id: string) => {
    setEngines((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    );
  };

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

        <div className="mt-5">
          {idx === 0 && (
            <OnboardingCountryLanguageFields
              country={previewCountry}
              onCountry={handlePreviewCountry}
              language={previewLanguage}
              onLanguage={setPreviewLanguage}
            />
          )}

          {idx === 1 && (
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">Rubro sugerido</span>
              <div className="relative mt-1.5">
                <input
                  readOnly
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-3 pr-10 text-sm font-medium text-slate-900 shadow-sm"
                  value={mock.industry}
                />
                <Check className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-violet-600" />
              </div>
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
                    onClick={() => toggleEngine(eng.id)}
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
              {competitors.map((c, i) => (
                <div key={`${c}-${i}`} className="flex items-center gap-2">
                  <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                    <Globe className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="truncate font-mono text-xs text-slate-800">{c}</span>
                  </div>
                  <button
                    type="button"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    aria-label="Quitar competidor"
                    onClick={() => setCompetitors((list) => list.filter((_, j) => j !== i))}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {competitors.length < 5 ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-600 hover:text-violet-800"
                  onClick={() =>
                    setCompetitors((list) => [...list, `competidor${list.length + 1}.com`])
                  }
                >
                  <Plus className="h-4 w-4" />
                  Agregar otro competidor
                </button>
              ) : null}
            </div>
          )}

          {idx === 4 && (
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Correo electrónico</span>
                <input
                  readOnly
                  type="email"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm"
                  value={mock.email}
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
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-500">Apellido (opcional)</span>
                  <input
                    type="text"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm"
                    placeholder="Tu apellido"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">¿Cómo nos encontraste?</span>
                <div className="relative mt-1.5">
                  <select
                    className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-10 text-sm text-slate-900 shadow-sm"
                    value={howFound}
                    onChange={(e) => setHowFound(e.target.value)}
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
              <OnboardingPreviewTrustFooter variant="email" />
            </div>
          )}
        </div>

        <OnboardingPreviewNav
          onBack={onBack}
          onNext={onNext}
          nextLabel={idx === 4 ? 'Arrancar análisis' : 'Continuar'}
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
