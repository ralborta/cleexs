'use client';

import { useEffect, useMemo, useState } from 'react';
import { Globe, Loader2, Lock, Sparkles, X } from 'lucide-react';
import { CountryPicker, CountryFlag } from './country-picker';
import { findCountryByIso, type CountryOption } from '@/lib/countries';

const MAX_DISTINCT = 5;

export interface RunCountrySelection {
  iso: string;
  name: string;
  geoMarket: string;
}

interface RunCountryModalProps {
  open: boolean;
  /** Plan premium habilita elegir cualquier país; free queda fijo en su país. */
  isPremium: boolean;
  /** País por defecto detectado (ISO) — preseleccionado. */
  defaultIso?: string | null;
  /** Países distintos ya medidos (ISO) para el contador X/5. */
  usedIsos?: string[];
  /** Indica que la corrida se está lanzando. */
  busy?: boolean;
  onClose: () => void;
  onConfirm: (selection: RunCountrySelection) => void;
}

/**
 * Paso previo a generar una corrida: el usuario elige el país (mercado) para
 * el que quiere medir. Free queda fijo en su país; premium elige cualquiera,
 * acumulando hasta 5 países distintos.
 */
export function RunCountryModal({
  open,
  isPremium,
  defaultIso,
  usedIsos = [],
  busy = false,
  onClose,
  onConfirm,
}: RunCountryModalProps) {
  const [selectedIso, setSelectedIso] = useState<string | null>(defaultIso ?? null);

  useEffect(() => {
    if (open) setSelectedIso(defaultIso ?? null);
  }, [open, defaultIso]);

  const distinctUsed = useMemo(() => new Set(usedIsos.map((i) => i.toUpperCase())), [usedIsos]);
  const selected: CountryOption | undefined = findCountryByIso(selectedIso);

  // ¿La selección agrega un país nuevo superando el tope de 5?
  const wouldExceed =
    isPremium &&
    !!selectedIso &&
    !distinctUsed.has(selectedIso.toUpperCase()) &&
    distinctUsed.size >= MAX_DISTINCT;

  if (!open) return null;

  function confirm() {
    if (!selected || wouldExceed) return;
    onConfirm({ iso: selected.iso, name: selected.name, geoMarket: selected.geoMarket });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        {/* Header */}
        <div className="relative shrink-0 overflow-hidden border-b border-slate-100 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-5">
          <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-violet-200/30 blur-3xl" aria-hidden />
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/70 hover:text-slate-600 disabled:opacity-50"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="relative flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white ring-1 ring-violet-100">
              <Globe className="h-5 w-5 text-violet-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">¿Para qué país querés medir?</h2>
              <p className="mt-0.5 text-sm text-slate-600">
                Los modelos de IA responden distinto según el mercado. Elegí el país de esta corrida.
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-hidden p-5">
          {isPremium ? (
            <>
              <div className="mb-3 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700 ring-1 ring-violet-200">
                  <Sparkles className="h-3 w-3" /> Premium
                </span>
                <span className="text-xs font-medium text-slate-500">
                  Países medidos: <span className="tabular-nums text-slate-700">{distinctUsed.size}/{MAX_DISTINCT}</span>
                </span>
              </div>
              <CountryPicker value={selectedIso} onChange={setSelectedIso} usedIsos={usedIsos} />
              {wouldExceed && (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
                  Llegaste al tope de {MAX_DISTINCT} países distintos. Para medir uno nuevo, repetí uno
                  ya usado o escribinos para ampliar tu plan.
                </p>
              )}
            </>
          ) : (
            <FreeNotice iso={selectedIso} />
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-100 bg-slate-50/60 p-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={busy || !selected || wouldExceed}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : selected ? (
                <CountryFlag iso={selected.iso} className="h-4 w-6 overflow-hidden rounded-[2px] ring-1 ring-white/40" />
              ) : null}
              {busy ? 'Generando…' : selected ? `Medir en ${selected.name}` : 'Elegí un país'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FreeNotice({ iso }: { iso: string | null }) {
  const country = findCountryByIso(iso);
  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center">
      {country && (
        <CountryFlag
          iso={country.iso}
          className="h-16 w-24 overflow-hidden rounded-lg shadow-md ring-1 ring-black/5"
        />
      )}
      <div>
        <p className="text-sm font-semibold text-slate-900">
          {country ? `Vamos a medir en ${country.name}` : 'Medimos en tu país'}
        </p>
        <p className="mx-auto mt-1 max-w-xs text-sm text-slate-500">
          Tu plan mide 1 país. Detectamos el tuyo automáticamente.
        </p>
      </div>
      <div className="flex items-center gap-2 rounded-xl bg-violet-50 px-3 py-2 text-xs font-medium text-violet-700 ring-1 ring-violet-200">
        <Lock className="h-3.5 w-3.5" />
        Con Premium podés medir hasta 5 países distintos.
      </div>
    </div>
  );
}
