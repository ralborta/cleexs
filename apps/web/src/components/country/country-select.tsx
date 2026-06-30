'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  ALL_COUNTRIES,
  COUNTRY_OTHER_LABEL,
  COUNTRY_OTHER_VALUE,
  LATAM_COUNTRIES,
  countrySelectStateFromValue,
  findCountryByName,
  isKnownCountryName,
  resolveCountryFormValue,
} from '@/lib/countries';

const selectCls =
  'w-full appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-3 pr-10 text-sm font-medium text-slate-900 shadow-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100';

type CountrySelectProps = {
  id?: string;
  value: string;
  onChange: (countryName: string) => void;
  className?: string;
  selectClassName?: string;
  /** Si el valor detectado no está en catálogo, mostrarlo arriba como opción extra. */
  suggestedName?: string | null;
  disabled?: boolean;
};

export function CountrySelect({
  id,
  value,
  onChange,
  className,
  selectClassName,
  suggestedName,
  disabled = false,
}: CountrySelectProps) {
  const initial = useMemo(() => countrySelectStateFromValue(value), [value]);
  const [selectValue, setSelectValue] = useState(initial.selectValue);
  const [otherText, setOtherText] = useState(initial.otherText);

  useEffect(() => {
    const next = countrySelectStateFromValue(value);
    setSelectValue(next.selectValue);
    setOtherText(next.otherText);
  }, [value]);

  const suggestedOption = useMemo(() => {
    const name = suggestedName?.trim();
    if (!name || isKnownCountryName(name)) return null;
    return name;
  }, [suggestedName]);

  const emit = (selected: string, other: string) => {
    onChange(resolveCountryFormValue(selected, other));
  };

  const handleSelectChange = (next: string) => {
    setSelectValue(next);
    if (next === COUNTRY_OTHER_VALUE) {
      emit(next, otherText);
      return;
    }
    setOtherText('');
    emit(next, '');
  };

  const handleOtherChange = (next: string) => {
    setOtherText(next);
    emit(COUNTRY_OTHER_VALUE, next);
  };

  const showOtherInput = selectValue === COUNTRY_OTHER_VALUE;

  return (
    <div className={className}>
      <div className="relative">
        <select
          id={id}
          value={selectValue}
          disabled={disabled}
          onChange={(e) => handleSelectChange(e.target.value)}
          className={selectClassName ?? selectCls}
        >
          {!selectValue ? (
            <option value="" disabled>
              Seleccioná un país
            </option>
          ) : null}

          {suggestedOption ? (
            <option value={suggestedOption}>{suggestedOption} (detectado)</option>
          ) : null}

          <optgroup label="América Latina">
            {LATAM_COUNTRIES.map((c) => (
              <option key={`latam-${c.iso}`} value={c.name}>
                {c.name}
              </option>
            ))}
          </optgroup>

          <optgroup label="Todos los países (A–Z)">
            {ALL_COUNTRIES.map((c) => (
              <option key={`all-${c.iso}`} value={c.name}>
                {c.name}
              </option>
            ))}
          </optgroup>

          <option value={COUNTRY_OTHER_VALUE}>{COUNTRY_OTHER_LABEL}</option>
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>

      {showOtherInput ? (
        <input
          type="text"
          value={otherText}
          disabled={disabled}
          onChange={(e) => handleOtherChange(e.target.value)}
          placeholder="Escribí tu país"
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          aria-label="Nombre del país"
        />
      ) : null}
    </div>
  );
}

export function countryIsoForDisplay(countryName: string): string {
  return findCountryByName(countryName)?.iso ?? 'XX';
}
