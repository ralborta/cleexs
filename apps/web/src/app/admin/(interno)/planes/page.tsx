'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  adminPlansApi,
  type AdminPlanItem,
  type AdminPlanUpdate,
} from '@/lib/api';

export const dynamic = 'force-dynamic';

const TIER_OPTIONS = [
  { value: '', label: '— sin tier —' },
  { value: 'free', label: 'free' },
  { value: 'premium', label: 'premium' },
  { value: 'enterprise', label: 'enterprise' },
] as const;

const ENGINE_SUGGESTIONS = ['ChatGPT', 'Gemini', 'Perplexity', 'Claude'];

type Draft = AdminPlanItem & { _dirty: boolean; _saving: boolean; _error?: string; _saved?: boolean };

function toDraft(p: AdminPlanItem): Draft {
  return { ...p, _dirty: false, _saving: false };
}

function diff(original: AdminPlanItem, draft: Draft): AdminPlanUpdate {
  const patch: AdminPlanUpdate = {};
  const keys: (keyof AdminPlanUpdate)[] = [
    'name',
    'tier',
    'description',
    'ctaLabel',
    'badge',
    'isRecommended',
    'isPublic',
    'displayOrder',
    'priceMonthly',
    'runsPerMonth',
    'promptsActiveLimit',
    'brandsLimit',
    'competitorsLimit',
    'retentionMonths',
    'automationEnabled',
    'features',
    'engines',
  ];
  for (const k of keys) {
    const a = original[k] as unknown;
    const b = draft[k] as unknown;
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length || a.some((v, i) => v !== b[i])) {
        (patch as Record<string, unknown>)[k] = b;
      }
    } else if (a !== b) {
      (patch as Record<string, unknown>)[k] = b;
    }
  }
  return patch;
}

function PlanCard({
  draft,
  original,
  onChange,
  onSave,
  onReset,
}: {
  draft: Draft;
  original: AdminPlanItem;
  onChange: (next: Draft) => void;
  onSave: () => Promise<void>;
  onReset: () => void;
}) {
  const set = (patch: Partial<Draft>) => onChange({ ...draft, ...patch, _dirty: true, _saved: false });

  const [newFeature, setNewFeature] = useState('');
  const [newEngine, setNewEngine] = useState('');

  const addFeature = () => {
    const value = newFeature.trim();
    if (!value) return;
    set({ features: [...draft.features, value] });
    setNewFeature('');
  };

  const removeFeature = (idx: number) => {
    set({ features: draft.features.filter((_, i) => i !== idx) });
  };

  const addEngine = (engine: string) => {
    const value = engine.trim();
    if (!value) return;
    if (draft.engines.includes(value)) return;
    set({ engines: [...draft.engines, value] });
    setNewEngine('');
  };

  const removeEngine = (engine: string) => {
    set({ engines: draft.engines.filter((e) => e !== engine) });
  };

  const input =
    'mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-200';
  const label = 'text-xs font-semibold uppercase tracking-wide text-slate-500';

  return (
    <article className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">{draft.name || 'Sin nombre'}</h2>
            <p className="text-xs text-slate-500">
              {draft.tenantsCount ?? 0} tenants · {draft.subscriptionsCount ?? 0} suscripciones · orden {draft.displayOrder}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {draft.isRecommended ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-1 text-xs font-semibold text-violet-700">
              <Sparkles className="h-3 w-3" /> Recomendado
            </span>
          ) : null}
          {draft.isPublic ? (
            <span className="inline-flex rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
              Público
            </span>
          ) : (
            <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
              Oculto
            </span>
          )}
        </div>
      </header>

      <div className="grid gap-6 px-5 py-5 sm:grid-cols-2">
        <div className="space-y-4">
          <div>
            <label className={label}>Nombre</label>
            <input
              className={input}
              value={draft.name}
              onChange={(ev) => set({ name: ev.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Tier</label>
              <select
                className={input}
                value={draft.tier ?? ''}
                onChange={(ev) => set({ tier: ev.target.value || null })}
              >
                {TIER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Orden</label>
              <input
                type="number"
                min={0}
                className={input}
                value={draft.displayOrder}
                onChange={(ev) => set({ displayOrder: Number(ev.target.value) || 0 })}
              />
            </div>
          </div>
          <div>
            <label className={label}>Descripción</label>
            <textarea
              className={`${input} min-h-[80px] resize-y`}
              value={draft.description ?? ''}
              onChange={(ev) => set({ description: ev.target.value || null })}
              placeholder="Texto corto que aparece debajo del nombre del plan."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Etiqueta (badge)</label>
              <input
                className={input}
                value={draft.badge ?? ''}
                onChange={(ev) => set({ badge: ev.target.value || null })}
                placeholder="Recomendado, Beta, etc."
              />
            </div>
            <div>
              <label className={label}>Texto del botón (CTA)</label>
              <input
                className={input}
                value={draft.ctaLabel ?? ''}
                onChange={(ev) => set({ ctaLabel: ev.target.value || null })}
                placeholder="Elegir Premium"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={draft.isRecommended}
                onChange={(ev) => set({ isRecommended: ev.target.checked })}
              />
              Marcar como recomendado
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={draft.isPublic}
                onChange={(ev) => set({ isPublic: ev.target.checked })}
              />
              Visible en la página pública
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={draft.automationEnabled}
                onChange={(ev) => set({ automationEnabled: ev.target.checked })}
              />
              Automatización
            </label>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className={label}>Precio mensual (USD)</label>
            <input
              type="number"
              min={0}
              step={0.01}
              className={input}
              value={draft.priceMonthly ?? ''}
              onChange={(ev) =>
                set({
                  priceMonthly: ev.target.value === '' ? null : Number(ev.target.value),
                })
              }
              placeholder="0"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Runs / mes</label>
              <input
                type="number"
                min={0}
                className={input}
                value={draft.runsPerMonth}
                onChange={(ev) => set({ runsPerMonth: Number(ev.target.value) || 0 })}
              />
            </div>
            <div>
              <label className={label}>Prompts activos</label>
              <input
                type="number"
                min={0}
                className={input}
                value={draft.promptsActiveLimit}
                onChange={(ev) => set({ promptsActiveLimit: Number(ev.target.value) || 0 })}
              />
            </div>
            <div>
              <label className={label}>Marcas máx.</label>
              <input
                type="number"
                min={0}
                className={input}
                value={draft.brandsLimit}
                onChange={(ev) => set({ brandsLimit: Number(ev.target.value) || 0 })}
              />
            </div>
            <div>
              <label className={label}>Competidores máx.</label>
              <input
                type="number"
                min={0}
                className={input}
                value={draft.competitorsLimit}
                onChange={(ev) => set({ competitorsLimit: Number(ev.target.value) || 0 })}
              />
            </div>
            <div>
              <label className={label}>Retención (meses)</label>
              <input
                type="number"
                min={0}
                className={input}
                value={draft.retentionMonths}
                onChange={(ev) => set({ retentionMonths: Number(ev.target.value) || 0 })}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 border-t border-slate-100 px-5 py-5 sm:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Motores incluidos</h3>
          <p className="mt-1 text-xs text-slate-500">
            Estos aparecen como chips en el card del plan (sección «Motores incluidos»).
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {draft.engines.length === 0 ? (
              <span className="text-xs text-slate-500">Sin motores configurados.</span>
            ) : (
              draft.engines.map((engine) => (
                <span
                  key={engine}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                >
                  {engine}
                  <button
                    type="button"
                    className="text-slate-400 hover:text-rose-500"
                    onClick={() => removeEngine(engine)}
                    aria-label={`Quitar ${engine}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {ENGINE_SUGGESTIONS.filter((e) => !draft.engines.includes(e)).map((engine) => (
              <button
                key={engine}
                type="button"
                onClick={() => addEngine(engine)}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:border-violet-300 hover:text-violet-700"
              >
                <Plus className="h-3 w-3" /> {engine}
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              className={`${input} flex-1`}
              value={newEngine}
              onChange={(ev) => setNewEngine(ev.target.value)}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter') {
                  ev.preventDefault();
                  addEngine(newEngine);
                }
              }}
              placeholder="Agregar otro motor"
            />
            <button
              type="button"
              onClick={() => addEngine(newEngine)}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
            >
              <Plus className="h-3 w-3" /> Agregar
            </button>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-900">Features visibles</h3>
          <p className="mt-1 text-xs text-slate-500">
            Cada uno aparece como un check en el card. Sin links ni HTML.
          </p>
          <ul className="mt-3 space-y-2">
            {draft.features.length === 0 ? (
              <li className="text-xs text-slate-500">Sin features cargadas.</li>
            ) : (
              draft.features.map((feature, idx) => (
                <li key={`${feature}-${idx}`} className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2">
                  <Check className="mt-0.5 h-4 w-4 text-emerald-600" />
                  <span className="flex-1 text-sm text-slate-700">{feature}</span>
                  <button
                    type="button"
                    onClick={() => removeFeature(idx)}
                    className="text-slate-400 hover:text-rose-500"
                    aria-label="Quitar feature"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))
            )}
          </ul>
          <div className="mt-3 flex gap-2">
            <input
              className={`${input} flex-1`}
              value={newFeature}
              onChange={(ev) => setNewFeature(ev.target.value)}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter') {
                  ev.preventDefault();
                  addFeature();
                }
              }}
              placeholder="Ej. Hasta 25 prompts trackeados"
            />
            <button
              type="button"
              onClick={addFeature}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
            >
              <Plus className="h-3 w-3" /> Agregar
            </button>
          </div>
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
        <div className="text-xs text-slate-500">
          {draft._saving ? (
            <span className="inline-flex items-center gap-1 text-violet-700">
              <Loader2 className="h-3 w-3 animate-spin" /> Guardando…
            </span>
          ) : draft._error ? (
            <span className="text-rose-600">{draft._error}</span>
          ) : draft._saved ? (
            <span className="inline-flex items-center gap-1 text-emerald-700">
              <Check className="h-3 w-3" /> Cambios guardados
            </span>
          ) : draft._dirty ? (
            <span className="text-amber-700">Tenés cambios sin guardar.</span>
          ) : (
            <span>Sin cambios pendientes.</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onReset}
            disabled={!draft._dirty || draft._saving}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40"
          >
            Descartar
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!draft._dirty || draft._saving}
            className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40"
          >
            <Save className="h-3.5 w-3.5" /> Guardar cambios
          </button>
        </div>
      </footer>

      {process.env.NODE_ENV !== 'production' ? (
        <details className="border-t border-slate-100 px-5 py-2 text-[10px] text-slate-400">
          <summary className="cursor-pointer">debug · diff</summary>
          <pre className="mt-1 overflow-auto whitespace-pre-wrap font-mono">
            {JSON.stringify(diff(original, draft), null, 2)}
          </pre>
        </details>
      ) : null}
    </article>
  );
}

export default function AdminPlanesPage() {
  const [originals, setOriginals] = useState<AdminPlanItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPlans = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await adminPlansApi.list();
      setOriginals(result.items);
      setDrafts(
        Object.fromEntries(result.items.map((p) => [p.id, toDraft(p)] as const))
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error cargando planes';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPlans();
  }, []);

  const dirtyCount = useMemo(
    () => Object.values(drafts).filter((d) => d._dirty).length,
    [drafts]
  );

  const handleSave = async (planId: string) => {
    const original = originals.find((p) => p.id === planId);
    const draft = drafts[planId];
    if (!original || !draft) return;
    const patch = diff(original, draft);
    if (Object.keys(patch).length === 0) return;

    setDrafts((prev) => ({
      ...prev,
      [planId]: { ...prev[planId], _saving: true, _error: undefined, _saved: false },
    }));
    try {
      const updated = await adminPlansApi.update(planId, patch);
      const merged: AdminPlanItem = { ...original, ...updated };
      setOriginals((prev) => prev.map((p) => (p.id === planId ? merged : p)));
      setDrafts((prev) => ({
        ...prev,
        [planId]: { ...merged, _dirty: false, _saving: false, _saved: true },
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error guardando';
      setDrafts((prev) => ({
        ...prev,
        [planId]: { ...prev[planId], _saving: false, _error: message },
      }));
    }
  };

  const handleReset = (planId: string) => {
    const original = originals.find((p) => p.id === planId);
    if (!original) return;
    setDrafts((prev) => ({ ...prev, [planId]: toDraft(original) }));
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
            <Layers className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Planes</h1>
            <p className="text-sm text-slate-600">
              Editá precio, descripción, motores incluidos, features visibles y límites técnicos de cada plan.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {dirtyCount > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
              {dirtyCount} con cambios sin guardar
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => void loadPlans()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" /> Refrescar
          </button>
        </div>
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">
          Cargando planes…
        </div>
      ) : originals.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">
          No hay planes cargados en la base.
        </div>
      ) : (
        <div className="space-y-5">
          {originals.map((p) => (
            <PlanCard
              key={p.id}
              original={p}
              draft={drafts[p.id] ?? toDraft(p)}
              onChange={(next) => setDrafts((prev) => ({ ...prev, [p.id]: next }))}
              onSave={() => handleSave(p.id)}
              onReset={() => handleReset(p.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
