'use client';

import { useMemo, useState, type ComponentType, type SVGProps } from 'react';
import * as Flags from 'country-flag-icons/react/3x2';
import { Check, Search } from 'lucide-react';
import {
  COUNTRIES,
  REGION_ORDER,
  normalizeText,
  type CountryOption,
  type CountryRegion,
} from '@/lib/countries';

type FlagComponent = ComponentType<SVGProps<SVGSVGElement> & { title?: string }>;
const FLAGS = Flags as unknown as Record<string, FlagComponent>;

export function CountryFlag({ iso, className }: { iso: string; className?: string }) {
  const Flag = FLAGS[iso.toUpperCase()];
  if (!Flag) {
    return (
      <span className={`inline-flex items-center justify-center bg-slate-100 text-[10px] font-bold text-slate-500 ${className ?? ''}`}>
        {iso.toUpperCase()}
      </span>
    );
  }
  return <Flag className={className} title={iso} />;
}

interface CountryPickerProps {
  /** ISO seleccionado actualmente. */
  value: string | null;
  onChange: (iso: string) => void;
  /** Países ya medidos (ISO) — se marcan con un badge. */
  usedIsos?: string[];
  /** Si true, no se puede cambiar la selección (plan free). */
  disabled?: boolean;
}

/** Grid de países con banderas SVG, agrupado por región y con buscador. */
export function CountryPicker({ value, onChange, usedIsos = [], disabled = false }: CountryPickerProps) {
  const [query, setQuery] = useState('');
  const used = useMemo(() => new Set(usedIsos.map((i) => i.toUpperCase())), [usedIsos]);

  const grouped = useMemo(() => {
    const q = normalizeText(query.trim());
    const map = new Map<CountryRegion, CountryOption[]>();
    for (const c of COUNTRIES) {
      if (q && !normalizeText(c.name).includes(q) && !normalizeText(c.iso).includes(q)) continue;
      const arr = map.get(c.region) ?? [];
      arr.push(c);
      map.set(c.region, arr);
    }
    return map;
  }, [query]);

  const hasResults = Array.from(grouped.values()).some((arr) => arr.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar país…"
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
        />
      </div>

      <div className="max-h-[52vh] space-y-5 overflow-y-auto pr-1">
        {!hasResults && (
          <p className="py-8 text-center text-sm text-slate-400">No encontramos ese país.</p>
        )}
        {REGION_ORDER.map((region) => {
          const items = grouped.get(region);
          if (!items || items.length === 0) return null;
          return (
            <div key={region}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                {region}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {items.map((c) => {
                  const selected = value === c.iso;
                  const isUsed = used.has(c.iso);
                  return (
                    <button
                      key={c.iso}
                      type="button"
                      onClick={() => !disabled && onChange(c.iso)}
                      disabled={disabled}
                      className={`group relative flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition ${
                        selected
                          ? 'border-violet-400 bg-violet-50 ring-2 ring-violet-100'
                          : 'border-slate-200 bg-white hover:border-violet-200 hover:bg-violet-50/40'
                      } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                    >
                      <CountryFlag
                        iso={c.iso}
                        className="h-6 w-9 shrink-0 overflow-hidden rounded-[3px] shadow-sm ring-1 ring-black/5"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-800">{c.name}</span>
                        {isUsed && (
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
                            Medido
                          </span>
                        )}
                      </span>
                      {selected && (
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white">
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
