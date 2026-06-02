'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  PencilLine,
  RotateCcw,
  Save,
  Search,
  Type,
  X,
} from 'lucide-react';
import { adminUiFetch } from '@/lib/admin-ui-client-fetch';
import {
  APP_STRINGS_CATALOG,
  groupCatalogBySection,
  type AppStringCatalogEntry,
} from '@/lib/app-strings-catalog';

export const dynamic = 'force-dynamic';

type AppStringRow = {
  id: string;
  key: string;
  locale: string;
  value: string;
  notes: string | null;
  updatedBy: string | null;
  updatedAt: string;
};

type OverrideMap = Record<string, AppStringRow>; // key -> row

const SUPPORTED_LOCALES = [{ value: 'es', label: 'Español' }] as const;

export default function AdminTextosPage() {
  const [locale, setLocale] = useState<string>('es');
  const [overrides, setOverrides] = useState<OverrideMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ kind: 'ok' | 'error'; msg: string } | null>(null);

  const loadOverrides = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminUiFetch(`/api/admin-ui/strings?locale=${encodeURIComponent(locale)}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as any)?.error || `Error ${res.status}`);
      }
      const data = (await res.json()) as { items?: AppStringRow[] };
      const map: OverrideMap = {};
      for (const r of data.items ?? []) map[r.key] = r;
      setOverrides(map);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    void loadOverrides();
  }, [loadOverrides]);

  const grouped = useMemo(() => groupCatalogBySection(), []);
  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return grouped;
    return grouped
      .map(({ section, items }) => ({
        section,
        items: items.filter(
          (i) =>
            i.key.toLowerCase().includes(q) ||
            i.default.toLowerCase().includes(q) ||
            i.description.toLowerCase().includes(q) ||
            (overrides[i.key]?.value || '').toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [grouped, search, overrides]);

  const totalCatalog = APP_STRINGS_CATALOG.length;
  const totalEdited = Object.keys(overrides).length;

  function startEdit(entry: AppStringCatalogEntry) {
    setEditingKey(entry.key);
    setEditValue(overrides[entry.key]?.value ?? entry.default);
    setFlash(null);
  }

  function cancelEdit() {
    setEditingKey(null);
    setEditValue('');
  }

  async function saveEdit(entry: AppStringCatalogEntry) {
    setSaving(entry.key);
    setError(null);
    try {
      const res = await adminUiFetch(`/api/admin-ui/strings/${encodeURIComponent(entry.key)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          value: editValue,
          locale,
          notes: entry.description,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as any)?.error || `Error ${res.status}`);
      }
      const data = (await res.json()) as { item: AppStringRow };
      setOverrides((prev) => ({ ...prev, [entry.key]: data.item }));
      setEditingKey(null);
      setEditValue('');
      setFlash({ kind: 'ok', msg: `Texto "${entry.key}" actualizado. Los cambios se reflejan en ~1 minuto.` });
    } catch (e) {
      setFlash({ kind: 'error', msg: e instanceof Error ? e.message : 'Error guardando' });
    } finally {
      setSaving(null);
    }
  }

  async function resetToDefault(entry: AppStringCatalogEntry) {
    if (!confirm(`¿Restaurar "${entry.key}" al texto original del código?`)) return;
    setSaving(entry.key);
    try {
      const res = await adminUiFetch(
        `/api/admin-ui/strings/${encodeURIComponent(entry.key)}?locale=${encodeURIComponent(locale)}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as any)?.error || `Error ${res.status}`);
      }
      setOverrides((prev) => {
        const next = { ...prev };
        delete next[entry.key];
        return next;
      });
      setFlash({ kind: 'ok', msg: `"${entry.key}" volvió al default.` });
    } catch (e) {
      setFlash({ kind: 'error', msg: e instanceof Error ? e.message : 'Error restaurando' });
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Type className="h-6 w-6 text-violet-600" /> Textos editables
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Editá los textos críticos de <strong>app.cleexs.net</strong> sin tocar código.
            Los cambios se reflejan en la app en ~1 minuto.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-800">
            {totalEdited} / {totalCatalog} editados
          </span>
          <label className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">Idioma:</span>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm focus:border-violet-400 focus:outline-none"
            >
              {SUPPORTED_LOCALES.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {/* Flash */}
      {flash && (
        <div
          className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
            flash.kind === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          <div className="flex items-start gap-2">
            {flash.kind === 'ok' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>{flash.msg}</span>
          </div>
          <button
            type="button"
            onClick={() => setFlash(null)}
            className="text-xs font-semibold opacity-70 hover:opacity-100"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por key, texto o descripción…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <p className="font-semibold">No se pudo cargar.</p>
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-violet-500" />
          <p className="mt-2 text-sm text-slate-600">Cargando textos…</p>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
          No hay textos que coincidan con tu búsqueda.
        </div>
      ) : (
        <div className="space-y-5">
          {filteredGroups.map(({ section, items }) => (
            <section key={section} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <header className="border-b border-slate-100 px-5 py-3">
                <h2 className="text-sm font-semibold text-slate-900">{section}</h2>
                <p className="text-xs text-slate-500">{items.length} {items.length === 1 ? 'texto' : 'textos'}</p>
              </header>
              <ul className="divide-y divide-slate-100">
                {items.map((entry) => {
                  const override = overrides[entry.key];
                  const currentValue = override?.value ?? entry.default;
                  const isOverridden = !!override && override.value !== entry.default;
                  const isEditing = editingKey === entry.key;
                  const isSaving = saving === entry.key;

                  return (
                    <li key={entry.key} className="px-5 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-mono text-slate-700">
                            {entry.key}
                          </code>
                          {isOverridden && (
                            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                              Editado
                            </span>
                          )}
                          <p className="mt-1 text-xs text-slate-500">{entry.description}</p>
                        </div>
                        {!isEditing && (
                          <div className="flex shrink-0 gap-1.5">
                            <button
                              type="button"
                              onClick={() => startEdit(entry)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-50"
                            >
                              <PencilLine className="h-3.5 w-3.5" /> Editar
                            </button>
                            {isOverridden && (
                              <button
                                type="button"
                                onClick={() => resetToDefault(entry)}
                                disabled={isSaving}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                              >
                                <RotateCcw className="h-3.5 w-3.5" /> Restaurar
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="mt-3">
                        {isEditing ? (
                          <div className="space-y-2">
                            {entry.multiline ? (
                              <textarea
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                rows={4}
                                className="w-full rounded-xl border border-violet-200 bg-white p-3 text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                              />
                            ) : (
                              <input
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                              />
                            )}
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => saveEdit(entry)}
                                disabled={isSaving}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
                              >
                                {isSaving ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Save className="h-3.5 w-3.5" />
                                )}
                                Guardar
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                disabled={isSaving}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                              >
                                <X className="h-3.5 w-3.5" /> Cancelar
                              </button>
                              <span className="text-[11px] text-slate-500">
                                Default: <span className="italic">"{entry.default.length > 80 ? entry.default.slice(0, 80) + '…' : entry.default}"</span>
                              </span>
                            </div>
                          </div>
                        ) : (
                          <p
                            className={`whitespace-pre-line text-sm ${
                              isOverridden ? 'font-medium text-slate-900' : 'text-slate-700'
                            }`}
                          >
                            {currentValue}
                          </p>
                        )}
                      </div>

                      {!isEditing && isOverridden && override?.updatedAt && (
                        <p className="mt-2 text-[11px] text-slate-400">
                          Última edición: {new Date(override.updatedAt).toLocaleString('es-AR')}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
