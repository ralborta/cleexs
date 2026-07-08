'use client';

import { ChevronDown } from 'lucide-react';
import { CountrySelect, countryIsoForDisplay } from '@/components/country/country-select';
import { CountryFlag } from '@/components/country/country-picker';
import { findCountryByName } from '@/lib/countries';

const LANGUAGES = [
  { id: 'es', label: 'Español', flagIso: 'ES' },
  { id: 'pt', label: 'Português', flagIso: 'BR' },
  { id: 'en', label: 'English', flagIso: 'GB' },
  { id: 'fr', label: 'Français', flagIso: 'FR' },
  { id: 'de', label: 'Deutsch', flagIso: 'DE' },
  { id: 'it', label: 'Italiano', flagIso: 'IT' },
] as const;

export function defaultLanguageForCountry(countryName: string): string {
  const c = findCountryByName(countryName);
  if (!c) return 'es';
  switch (c.iso) {
    case 'BR':
      return 'pt';
    case 'US':
    case 'CA':
    case 'GB':
    case 'NL':
    case 'SG':
    case 'IN':
      return 'en';
    case 'FR':
      return 'fr';
    case 'DE':
      return 'de';
    case 'IT':
      return 'it';
    case 'PT':
      return 'pt';
    default:
      return 'es';
  }
}

const selectCls =
  'w-full appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-11 pr-10 text-sm font-medium text-slate-900 shadow-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100';

const flagCls =
  'pointer-events-none absolute left-3 top-1/2 h-4 w-6 -translate-y-1/2 overflow-hidden rounded-[2px] shadow-sm ring-1 ring-black/5';

export function OnboardingCountryLanguageFields({
  country,
  onCountry,
  language,
  onLanguage,
}: {
  country: string;
  onCountry: (v: string) => void;
  language: string;
  onLanguage: (v: string) => void;
}) {
  const countryIso = countryIsoForDisplay(country);
  const selectedLanguage = LANGUAGES.find((l) => l.id === language) ?? LANGUAGES[0];

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="text-xs font-semibold text-slate-500">País detectado</span>
        <div className="relative mt-1.5">
          <CountryFlag iso={countryIso} className={flagCls} />
          <CountrySelect
            value={country}
            onChange={onCountry}
            suggestedName={country}
            selectClassName={selectCls}
          />
        </div>
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-slate-500">Idioma detectado</span>
        <div className="relative mt-1.5">
          <CountryFlag iso={selectedLanguage.flagIso} className={flagCls} />
          <select
            value={language}
            onChange={(e) => onLanguage(e.target.value)}
            className={selectCls}
            aria-label="Idioma del análisis"
          >
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>
        <p className="mt-1.5 text-[11px] text-slate-400">
          Sugerido según tu país. Por ahora es orientativo — pronto lo usaremos en el análisis.
        </p>
      </label>
    </div>
  );
}
