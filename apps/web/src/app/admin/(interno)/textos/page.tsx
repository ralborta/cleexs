'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Languages,
  Loader2,
  PencilLine,
  RotateCcw,
  Save,
  Search,
  Sparkles,
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

type OverrideMap = Record<string, AppStringRow>;

const SUPPORTED_LOCALES = [{ value: 'es', label: 'Español' }] as const;

const SECTION_ACCENT_BORDERS = [
  'border-l-violet-200',
  'border-l-indigo-200',
  'border-l-emerald-200',
  'border-l-amber-200',
  'border-l-sky-200',
];

const SECTION_ACCENT_ICON_BG = [
  'bg-violet-50 text-violet-500 ring-violet-100',
  'bg-indigo-50 text-indigo-500 ring-indigo-100',
  'bg-emerald-50 text-emerald-500 ring-emerald-100',
  'bg-amber-50 text-amber-500 ring-amber-100',
  'bg-sky-50 text-sky-500 ring-sky-100',
];

function pickAccentBorder(idx: number) {
  return SECTION_ACCENT_BORDERS[idx % SECTION_ACCENT_BORDERS.length];
}
function pickAccentIcon(idx: number) {
  return SECTION_ACCENT_ICON_BG[idx % SECTION_ACCENT_ICON_BG.length];
}

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
  const totalPending = Math.max(0, totalCatalog - totalEdited);

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
      setFlash({
        kind: 'ok',
        msg: `Texto actualizado. Los cambios se reflejan en la app en ~1 minuto.`,
      });
    } catch (e) {
      setFlash({ kind: 'error', msg: e instanceof Error ? e.message : 'Error guardando' });
    } finally {
      setSaving(null);
    }
  }

  async function resetToDefault(entry: AppStringCatalogEntry) {
    if (!confirm(`¿Restaurar este texto al valor original del código?\n\nKey: ${entry.key}`)) return;
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
      setFlash({ kind: 'ok', msg: 'Texto restaurado al default.' });
    } catch (e) {
      setFlash({ kind: 'error', msg: e instanceof Error ? e.message : 'Error restaurando' });
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-3xl border border-violet-100 bg-gradient-to-br from-violet-50/80 via-white to-indigo-50/60 p-6 shadow-sm md:p-8">
        <div className="absolute -right-24 -top-24 h-56 w-56 rounded-full bg-violet-200/30 blur-3xl" aria-hidden />
        <div className="absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-indigo-200/30 blur-3xl" aria-hidden />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white ring-1 ring-violet-100 shadow-sm">
              <Type className="h-6 w-6 text-violet-500" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-500/80">
                Portal interno · Configuración
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
                Textos editables
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
                Editá los textos clave de <strong className="font-semibold text-slate-800">app.cleexs.net</strong>{' '}
                sin tocar código. Los cambios impactan en la app en ~1 minuto y son reversibles.
              </p>
            </div>
          </div>
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
            <Languages className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-slate-500">Idioma</span>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              className="rounded-md bg-white px-1 py-0.5 text-xs font-medium text-slate-800 outline-none focus:text-violet-700"
            >
              {SUPPORTED_LOCALES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Stats inline */}
        <div className="relative mt-6 grid grid-cols-3 gap-3">
          <StatPill label="Textos en catálogo" value={totalCatalog} icon={<FileText className="h-3.5 w-3.5" />} tone="slate" />
          <StatPill label="Editados" value={totalEdited} icon={<PencilLine className="h-3.5 w-3.5" />} tone="violet" />
          <StatPill label="Sin editar" value={totalPending} icon={<Sparkles className="h-3.5 w-3.5" />} tone="slate" />
        </div>
      </section>

      {/* Flash */}
      {flash && (
        <div
          className={`flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-sm shadow-sm ${
            flash.kind === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-rose-200 bg-rose-50 text-rose-900'
          }`}
        >
          <div className="flex items-start gap-2">
            {flash.kind === 'ok' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
            )}
            <span className="leading-relaxed">{flash.msg}</span>
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

      {/* Toolbar / search */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm ring-1 ring-slate-900/[0.03]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por key, texto o descripción…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2.5 pl-10 pr-3 text-sm placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-100"
            />
          </div>
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="inline-flex items-center gap-1.5 self-start rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 sm:self-auto"
            >
              <X className="h-3.5 w-3.5" /> Limpiar
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 shadow-sm">
          <p className="font-semibold">No se pudo cargar.</p>
          <p className="mt-0.5 text-rose-800">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-2xl border border-slate-200/70 bg-gradient-to-b from-slate-50 to-white"
            />
          ))}
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
          <Search className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm font-semibold text-slate-700">Sin resultados</p>
          <p className="mt-1 text-xs text-slate-500">
            Probá con otra palabra clave o limpiá la búsqueda.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {filteredGroups.map(({ section, items }, idx) => {
            const editedInSection = items.filter(
              (i) => overrides[i.key] && overrides[i.key].value !== i.default,
            ).length;
            return (
            <section
              key={section}
              className={`rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm md:p-7 border-l-[3px] ${pickAccentBorder(idx)}`}
            >
              <header className="flex items-start gap-3.5">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${pickAccentIcon(idx)}`}>
                  <FileText className="h-4.5 w-4.5" aria-hidden />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold tracking-tight text-slate-900">{section}</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {items.length} {items.length === 1 ? 'texto' : 'textos'}
                    <span className="text-slate-300"> · </span>
                    <span className="text-slate-400">{editedInSection} editados en esta sección</span>
                  </p>
                </div>
              </header>
              <ul className="mt-4 divide-y divide-slate-100">
                {items.map((entry) => {
                  const override = overrides[entry.key];
                  const currentValue = override?.value ?? entry.default;
                  const isOverridden = !!override && override.value !== entry.default;
                  const isEditing = editingKey === entry.key;
                  const isSaving = saving === entry.key;

                  return (
                    <li
                      key={entry.key}
                      className={`-mx-2 rounded-xl px-2 py-4 transition first:pt-1 last:pb-1 ${
                        isEditing ? 'bg-violet-50/40' : 'hover:bg-slate-50/60'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <code className="rounded-md bg-slate-900/[0.04] px-2 py-0.5 text-[11px] font-mono font-medium text-slate-700 ring-1 ring-slate-200">
                              {entry.key}
                            </code>
                            {isOverridden ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 ring-1 ring-amber-200">
                                <PencilLine className="h-3 w-3" /> Editado
                              </span>
                            ) : (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                Default
                              </span>
                            )}
                            {entry.multiline && (
                              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
                                Multilínea
                              </span>
                            )}
                          </div>
                          <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                            {entry.description}
                          </p>
                        </div>
                        {!isEditing && (
                          <div className="flex shrink-0 gap-1.5">
                            <button
                              type="button"
                              onClick={() => startEdit(entry)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-700 shadow-sm transition hover:bg-violet-50 hover:shadow"
                            >
                              <PencilLine className="h-3.5 w-3.5" /> Editar
                            </button>
                            {isOverridden && (
                              <button
                                type="button"
                                onClick={() => resetToDefault(entry)}
                                disabled={isSaving}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
                              >
                                {isSaving ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <RotateCcw className="h-3.5 w-3.5" />
                                )}
                                Restaurar
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="mt-3">
                        {isEditing ? (
                          <div className="space-y-3">
                            {entry.multiline ? (
                              <textarea
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                rows={5}
                                className="w-full rounded-xl border border-violet-300 bg-white p-3 text-sm leading-relaxed text-slate-900 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-4 focus:ring-violet-500/15"
                              />
                            ) : (
                              <input
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="w-full rounded-xl border border-violet-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-4 focus:ring-violet-500/15"
                              />
                            )}
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => saveEdit(entry)}
                                disabled={isSaving}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-60"
                              >
                                {isSaving ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Save className="h-3.5 w-3.5" />
                                )}
                                Guardar cambios
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                disabled={isSaving}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
                              >
                                <X className="h-3.5 w-3.5" /> Cancelar
                              </button>
                              <span className="ml-auto rounded-md bg-slate-50 px-2.5 py-1 text-[11px] text-slate-500 ring-1 ring-slate-200">
                                Default:{' '}
                                <span className="italic text-slate-600">
                                  {`"${entry.default.length > 90 ? entry.default.slice(0, 90) + '…' : entry.default}"`}
                                </span>
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div
                            className={`rounded-xl border px-3.5 py-2.5 text-sm leading-relaxed ${
                              isOverridden
                                ? 'border-amber-200/60 bg-amber-50/40 text-slate-900'
                                : 'border-slate-200/70 bg-slate-50/50 text-slate-700'
                            }`}
                          >
                            <p className="whitespace-pre-line">{currentValue}</p>
                          </div>
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
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatPill({
  label,
  value,
  icon,
  tone = 'slate',
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone?: 'slate' | 'violet';
}) {
  const toneCls =
    tone === 'violet'
      ? 'border-violet-100 bg-white text-violet-700'
      : 'border-slate-200 bg-white text-slate-500';
  return (
    <div className={`rounded-xl border px-3 py-2.5 shadow-sm ${toneCls}`}>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold leading-none text-slate-900">{value}</div>
    </div>
  );
}
