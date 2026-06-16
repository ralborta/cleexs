'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Lock, Megaphone, Unlock } from 'lucide-react';

type PromoConfig = {
  enabled: boolean;
  startsAt: string | null;
  endsAt: string | null;
  updatedBy?: string | null;
  updatedAt?: string | null;
};

type PromoResponse = {
  ok: boolean;
  config: PromoConfig;
  active: boolean;
  error?: string;
};

const ENDPOINT = '/api/admin-ui/promo/plan-conquistar-upsell';

/** Convierte ISO a valor para <input type="datetime-local"> en hora local. */
function isoToLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => `${n}`.padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export default function AdminPromocionesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [active, setActive] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [updatedInfo, setUpdatedInfo] = useState<{ by?: string | null; at?: string | null }>({});

  const applyConfig = useCallback((data: PromoResponse) => {
    setEnabled(data.config.enabled);
    setStartsAt(isoToLocalInput(data.config.startsAt));
    setEndsAt(isoToLocalInput(data.config.endsAt));
    setActive(data.active);
    setUpdatedInfo({ by: data.config.updatedBy, at: data.config.updatedAt });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(ENDPOINT, { cache: 'no-store' });
      const body = (await res.json().catch(() => ({}))) as PromoResponse;
      if (!res.ok) throw new Error(body.error || `Error ${res.status}`);
      applyConfig(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la configuración.');
    } finally {
      setLoading(false);
    }
  }, [applyConfig]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payload = {
        enabled,
        startsAt: localInputToIso(startsAt),
        endsAt: localInputToIso(endsAt),
      };
      const res = await fetch(ENDPOINT, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as PromoResponse;
      if (!res.ok) throw new Error(body.error || `Error ${res.status}`);
      applyConfig(body);
      setNotice('Guardado. Los cambios aplican al instante en los nuevos resultados.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-700 to-indigo-700 p-6 text-white shadow-sm">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-xs font-semibold ring-1 ring-white/20">
          <Megaphone className="h-4 w-4" />
          Promociones
        </div>
        <h1 className="mt-3 text-2xl font-bold">Upsell Plan Conquistar en resultados</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-violet-50">
          Controla si el reporte bloqueado del Plan Conquistar aparece al final del diagnóstico gratuito. Cuando está
          apagado, la página de resultados queda exactamente como siempre. Solo afecta a usuarios free (los Premium nunca
          lo ven).
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin text-violet-600" /> Cargando configuración...
        </div>
      ) : (
        <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {/* Estado actual */}
          <div
            className={`flex items-center gap-3 rounded-xl border p-4 ${
              active ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'
            }`}
          >
            {active ? (
              <Unlock className="h-5 w-5 text-emerald-600" />
            ) : (
              <Lock className="h-5 w-5 text-slate-400" />
            )}
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Estado actual: {active ? 'VISIBLE para usuarios free' : 'OCULTO (reporte normal)'}
              </p>
              <p className="text-xs text-slate-500">
                {active
                  ? 'El upsell se está mostrando según la configuración de abajo.'
                  : 'Nadie ve el upsell. El reporte de resultados funciona como siempre.'}
              </p>
            </div>
          </div>

          {/* Toggle */}
          <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-slate-200 p-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">Mostrar el upsell Plan Conquistar</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Prende o apaga la promo. Si definís fechas abajo, solo se muestra dentro de esa ventana.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={() => setEnabled((v) => !v)}
              className={`relative mt-1 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
                enabled ? 'bg-violet-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                  enabled ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </label>

          {/* Ventana de fechas */}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Desde (opcional)</span>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
              />
              <span className="mt-1 block text-[11px] text-slate-400">Vacío = empieza apenas lo prendas.</span>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Hasta (opcional)</span>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
              />
              <span className="mt-1 block text-[11px] text-slate-400">Vacío = sigue hasta que lo apagues.</span>
            </label>
          </div>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          {notice ? (
            <p className="flex items-center gap-1.5 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4" /> {notice}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <p className="text-[11px] text-slate-400">
              {updatedInfo.at
                ? `Última actualización: ${new Date(updatedInfo.at).toLocaleString('es-AR')}${
                    updatedInfo.by ? ` · ${updatedInfo.by}` : ''
                  }`
                : 'Sin cambios guardados aún.'}
            </p>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Guardar cambios
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
