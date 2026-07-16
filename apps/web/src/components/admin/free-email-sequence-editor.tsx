'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Database,
  Eye,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  Trash2,
} from 'lucide-react';
import { adminUiFetch } from '@/lib/admin-ui-client-fetch';

type TemplateVariant = 'letter' | 'editorial';

type SuggestedDefault = {
  sortOrder: number;
  delayDaysAfterPrevious: number;
  title: string;
  subject: string;
  preheader: string;
  body: string;
  templateVariant: TemplateVariant;
};

type InsightCatalogItem = {
  key: string;
  sortOrder: number;
  title: string;
  description: string;
  sampleLine: string;
};

type StepRow = {
  id: string;
  sortOrder: number;
  delayDaysAfterPrevious: number;
  title: string;
  subject: string | null;
  preheader: string | null;
  body: string | null;
  insightKey: string | null;
  templateVariant: TemplateVariant;
  active: boolean;
  cumulativeDaysLabel: string;
};

type ConfigRow = {
  enabled: boolean;
  sendHourLocal: number;
  sendMinuteLocal: number;
  timezone: string;
};

type PreviewPayload = {
  ok: boolean;
  variant: TemplateVariant;
  subject: string;
  html: string;
  insightPreviewLine?: string | null;
  insightKey?: string | null;
};

const field =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-200';
const labelCls = 'text-xs font-semibold uppercase tracking-wide text-slate-500';
const primaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50';
const secondaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50';

export function FreeEmailSequenceEditor() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<ConfigRow | null>(null);
  const [steps, setSteps] = useState<StepRow[]>([]);
  const [suggestedBySortOrder, setSuggestedBySortOrder] = useState<Record<string, SuggestedDefault>>({});
  const [insightCatalog, setInsightCatalog] = useState<InsightCatalogItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [delayDays, setDelayDays] = useState(0);
  const [variant, setVariant] = useState<TemplateVariant>('letter');
  const [subject, setSubject] = useState('');
  const [preheader, setPreheader] = useState('');
  const [body, setBody] = useState('');
  const [insightKey, setInsightKey] = useState<string>('');
  const [active, setActive] = useState(true);

  const [score, setScore] = useState(62);
  const [domain, setDomain] = useState('empliados.net');
  const [brandName, setBrandName] = useState('Empliados');
  const [testEmail, setTestEmail] = useState('');

  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [triggerBusy, setTriggerBusy] = useState(false);
  const [triggerResult, setTriggerResult] = useState<string | null>(null);

  const selected = useMemo(() => steps.find((s) => s.id === selectedId) ?? null, [steps, selectedId]);

  const suggestedForSelected = useMemo(() => {
    if (!selected) return null;
    return suggestedBySortOrder[String(selected.sortOrder)] ?? null;
  }, [selected, suggestedBySortOrder]);

  const selectedInsight = useMemo(
    () => insightCatalog.find((i) => i.key === insightKey) ?? null,
    [insightCatalog, insightKey]
  );

  function loadSuggestedContent() {
    if (!suggestedForSelected) return;
    setTitle(suggestedForSelected.title);
    setSubject(suggestedForSelected.subject);
    setPreheader(suggestedForSelected.preheader);
    setBody(suggestedForSelected.body);
    setVariant(suggestedForSelected.templateVariant);
    if (selected?.sortOrder !== 1) {
      setDelayDays(suggestedForSelected.delayDaysAfterPrevious);
    }
    setHint('Texto sugerido cargado en el editor. Guardá el paso para persistirlo en la base de datos.');
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminUiFetch('/api/admin-ui/email/free-sequence-preview');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'No se pudo cargar');
      setConfig(json.config);
      const list = (json.steps as StepRow[]) ?? [];
      setSteps(list);
      setSuggestedBySortOrder((json.suggestedBySortOrder as Record<string, SuggestedDefault>) ?? {});
      setInsightCatalog((json.insightCatalog as InsightCatalogItem[]) ?? []);
      if (!selectedId && list[0]) setSelectedId(list[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selected) return;
    setTitle(selected.title);
    setDelayDays(selected.delayDaysAfterPrevious);
    setVariant(selected.templateVariant);
    setSubject(selected.subject ?? '');
    setPreheader(selected.preheader ?? '');
    setBody(selected.body ?? '');
    setInsightKey(selected.insightKey ?? '');
    setActive(selected.active);
  }, [selected?.id]);

  const refreshPreview = useCallback(async () => {
    if (!selected) return;
    setPreviewLoading(true);
    try {
      const effectiveVariant: TemplateVariant = insightKey ? 'letter' : variant;
      const res = await adminUiFetch('/api/admin-ui/email/free-sequence-preview/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variant: effectiveVariant,
          subject: subject.trim() || null,
          preheader: preheader.trim() || null,
          body: body.trim() || null,
          insightKey: insightKey || null,
          sortOrder: selected.sortOrder,
          score,
          domain,
          brandName,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Preview falló');
      setPreview(json as PreviewPayload);
    } catch (e) {
      setPreview(null);
      setError(e instanceof Error ? e.message : 'Error de preview');
    } finally {
      setPreviewLoading(false);
    }
  }, [selected, variant, subject, preheader, body, insightKey, score, domain, brandName]);

  useEffect(() => {
    if (!selected) return undefined;
    const t = window.setTimeout(() => void refreshPreview(), 400);
    return () => window.clearTimeout(t);
  }, [selected, variant, subject, preheader, body, insightKey, score, domain, brandName, refreshPreview]);

  async function saveStep() {
    if (!selected) return;
    setSaveBusy(true);
    setHint(null);
    setError(null);
    try {
      const effectiveVariant: TemplateVariant = insightKey ? 'letter' : variant;
      const res = await adminUiFetch(`/api/admin-ui/email/free-sequence-preview/steps/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          delayDaysAfterPrevious: delayDays,
          templateVariant: effectiveVariant,
          subject: subject.trim() || null,
          preheader: preheader.trim() || null,
          body: body.trim() || null,
          insightKey: insightKey || null,
          active,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'No se pudo guardar');
      setSteps((prev) => prev.map((s) => (s.id === selected.id ? json.step : s)));
      setHint('Paso guardado en la base de datos.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaveBusy(false);
    }
  }

  async function saveConfig(patch: Partial<ConfigRow>) {
    try {
      const res = await adminUiFetch('/api/admin-ui/email/free-sequence-preview', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'No se pudo guardar config');
      setConfig(json.config);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  }

  async function moveStep(stepId: string, dir: -1 | 1) {
    const sorted = [...steps].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex((s) => s.id === stepId);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= sorted.length) return;
    const ids = sorted.map((s) => s.id);
    [ids[idx], ids[swap]] = [ids[swap]!, ids[idx]!];
    const res = await adminUiFetch('/api/admin-ui/email/free-sequence-preview/steps', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stepIds: ids }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'No se pudo reordenar');
    setSteps(json.steps);
  }

  async function addStep() {
    const res = await adminUiFetch('/api/admin-ui/email/free-sequence-preview/steps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ useSuggestedContent: true }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'No se pudo crear');
    await load();
    setSelectedId(json.step.id);
  }

  async function removeStep(stepId: string) {
    if (!window.confirm('¿Eliminar este paso?')) return;
    const res = await adminUiFetch(`/api/admin-ui/email/free-sequence-preview/steps/${stepId}`, {
      method: 'DELETE',
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'No se pudo eliminar');
    await load();
  }

  async function sendTest() {
    if (!selected || !testEmail.trim()) {
      setHint('Ingresá un email de prueba.');
      return;
    }
    setTestBusy(true);
    setHint(null);
    try {
      const res = await adminUiFetch('/api/admin-ui/email/free-sequence-preview/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: testEmail.trim(),
          variant: insightKey ? 'letter' : variant,
          subject: subject.trim() || null,
          preheader: preheader.trim() || null,
          body: body.trim() || null,
          insightKey: insightKey || null,
          sortOrder: selected.sortOrder,
          score,
          domain,
          brandName,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Envío falló');
      setHint(`Prueba enviada: "${json.subject}" → ${testEmail.trim()}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al enviar');
    } finally {
      setTestBusy(false);
    }
  }

  async function triggerBatch(dryRun: boolean) {
    if (!dryRun && !window.confirm('¿Enviar la secuencia ahora a todos los candidatos de hoy? (force, ignora hora y enabled)')) {
      return;
    }
    setTriggerBusy(true);
    setTriggerResult(null);
    setError(null);
    try {
      const res = await adminUiFetch('/api/admin-ui/email/free-sequence-preview/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun, force: true, limit: 50, enrolledWithinDays: 60 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Corrida falló');
      if (dryRun) {
        const steps = (json.steps as Array<{ sortOrder: number; wouldSend?: number; candidates?: number }>) ?? [];
        const summary = steps.map((s) => `paso ${s.sortOrder}: ${s.wouldSend ?? 0} envíos (${s.candidates ?? 0} candidatos)`).join(' · ');
        setTriggerResult(json.due === false ? `No corresponde ahora: ${json.reason ?? '—'}` : `Simulación OK — ${summary || 'sin candidatos hoy'}`);
      } else {
        setTriggerResult(`Enviados: ${json.sent ?? 0} · omitidos: ${json.skipped ?? 0} · fallidos: ${json.failed ?? 0}`);
        setHint('Corrida de secuencia completada. Revisá Email · envíos.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error en corrida');
    } finally {
      setTriggerBusy(false);
    }
  }

  if (loading && steps.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        Cargando secuencia…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-2xl text-sm text-slate-600">
          Secuencia automática para clientes free post-registro. El contenido de cada mail se guarda en la base de datos;
          al abrir un paso se carga desde ahí. Activá &quot;Secuencia activa (prod)&quot; para que el cron envíe según los días configurados.
        </p>
        <button type="button" className={secondaryBtn} onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
      ) : null}
      {hint ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{hint}</div>
      ) : null}

      {config ? (
        <section className="flex flex-wrap items-end gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="block text-sm">
            <span className={labelCls}>Hora envío (AR)</span>
            <input
              type="number"
              min={0}
              max={23}
              className={`${field} w-24`}
              value={config.sendHourLocal}
              onChange={(e) => setConfig({ ...config, sendHourLocal: Number(e.target.value) || 0 })}
              onBlur={() => void saveConfig({ sendHourLocal: config.sendHourLocal, sendMinuteLocal: config.sendMinuteLocal })}
            />
          </label>
          <label className="block text-sm">
            <span className={labelCls}>Minutos</span>
            <input
              type="number"
              min={0}
              max={59}
              className={`${field} w-20`}
              value={config.sendMinuteLocal}
              onChange={(e) => setConfig({ ...config, sendMinuteLocal: Number(e.target.value) || 0 })}
              onBlur={() => void saveConfig({ sendHourLocal: config.sendHourLocal, sendMinuteLocal: config.sendMinuteLocal })}
            />
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => {
                const enabled = e.target.checked;
                setConfig({ ...config, enabled });
                void saveConfig({ enabled });
              }}
            />
            Secuencia activa (prod)
          </label>
        </section>
      ) : null}

      <section className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Probar corrida automática</h2>
        <p className="mt-1 text-xs text-slate-600">
          Simulá quién recibiría mail hoy según días desde el diagnóstico. &quot;Enviar ahora&quot; usa force (ignora hora y el checkbox de arriba).
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={secondaryBtn} disabled={triggerBusy} onClick={() => void triggerBatch(true)}>
            {triggerBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
            Simular corrida
          </button>
          <button type="button" className={primaryBtn} disabled={triggerBusy} onClick={() => void triggerBatch(false)}>
            {triggerBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Enviar ahora (force)
          </button>
        </div>
        {triggerResult ? (
          <p className="mt-3 rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs text-slate-700">{triggerResult}</p>
        ) : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(240px,280px)_minmax(0,1fr)]">
        <aside className="space-y-2 lg:sticky lg:top-6 lg:self-start">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-slate-900">Pasos</h2>
            <button type="button" className={secondaryBtn} onClick={() => void addStep().catch((e) => setError(String(e)))}>
              <Plus className="h-4 w-4" />
            </button>
          </div>
          {[...steps]
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((step, idx, arr) => (
              <div
                key={step.id}
                className={`rounded-xl border p-3 transition ${
                  step.id === selectedId ? 'border-violet-300 bg-violet-50' : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <button type="button" className="w-full text-left" onClick={() => setSelectedId(step.id)}>
                  <p className="text-xs font-semibold text-violet-700">Paso {step.sortOrder}</p>
                  <p className="font-medium text-slate-900">{step.title}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{step.cumulativeDaysLabel}</p>
                  <p className="mt-0.5 text-[10px] uppercase text-slate-400">{step.templateVariant}</p>
                </button>
                <div className="mt-2 flex gap-1">
                  <button type="button" className={secondaryBtn} disabled={idx === 0} onClick={() => void moveStep(step.id, -1)}>
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    className={secondaryBtn}
                    disabled={idx === arr.length - 1}
                    onClick={() => void moveStep(step.id, 1)}
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    className={secondaryBtn}
                    disabled={arr.length <= 1}
                    onClick={() => void removeStep(step.id).catch((e) => setError(String(e)))}
                  >
                    <Trash2 className="h-3 w-3 text-rose-600" />
                  </button>
                </div>
              </div>
            ))}
        </aside>

        {selected ? (
          <div className="min-w-0 space-y-6">
            <section className="w-full space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Contenido · paso {selected.sortOrder}</h2>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                    <Database className="h-3.5 w-3.5" />
                    Editás acá y guardás — el contenido queda en la base de datos del paso.
                  </p>
                </div>
                {suggestedForSelected ? (
                  <button type="button" className={secondaryBtn} onClick={loadSuggestedContent}>
                    <RotateCcw className="h-4 w-4" />
                    Cargar texto sugerido
                  </button>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className={labelCls}>Nombre interno</span>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} className={field} />
                </label>
                <label className="block">
                  <span className={labelCls}>Días después del paso anterior</span>
                  <input
                    type="number"
                    min={0}
                    max={365}
                    disabled={selected.sortOrder === 1}
                    value={delayDays}
                    onChange={(e) => setDelayDays(Number(e.target.value) || 0)}
                    className={field}
                  />
                  {selected.sortOrder === 1 ? (
                    <p className="mt-1 text-[10px] text-slate-400">El paso 1 se envía al registrarse.</p>
                  ) : null}
                </label>
                <label className="block">
                  <span className={labelCls}>Template</span>
                  <select
                    value={insightKey ? 'letter' : variant}
                    disabled={Boolean(insightKey)}
                    onChange={(e) => setVariant(e.target.value as TemplateVariant)}
                    className={field}
                  >
                    <option value="letter">Carta (letter)</option>
                    <option value="editorial">Newsletter (editorial)</option>
                  </select>
                  {insightKey ? (
                    <p className="mt-1 text-[10px] text-slate-400">Con insight elegido, el diseño queda fijo en carta.</p>
                  ) : null}
                </label>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                Paso activo
              </label>
              {selected.sortOrder === 1 ? (
                <p className="-mt-2 text-[10px] text-slate-500">
                  El paso 1 se envía siempre al completar el diagnóstico free (carta + score). El checkbox no lo
                  apaga; sirve de referencia. Los pasos 2+ sí respetan “activo” en el cron.
                </p>
              ) : null}

              <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-4">
                <p className={labelCls}>Insight del reporte (de los 12)</p>
                <p className="mt-1 text-xs text-slate-600">
                  Elegí el tipo → se carga un texto demo editable abajo. El preview usa ese texto en la tarjeta.
                </p>
                <select
                  value={insightKey}
                  onChange={(e) => {
                    const next = e.target.value;
                    setInsightKey(next);
                    if (!next) return;
                    setVariant('letter');
                    const item = insightCatalog.find((i) => i.key === next);
                    if (item) setBody(item.sampleLine);
                  }}
                  className={field}
                >
                  <option value="">Sin insight (solo texto libre)</option>
                  {insightCatalog.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.sortOrder}. {item.title}
                    </option>
                  ))}
                </select>
                {selectedInsight ? (
                  <div className="mt-3 rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs text-slate-700">
                    <p className="font-semibold text-violet-800">{selectedInsight.title}</p>
                    <p className="mt-1 text-slate-500">{selectedInsight.description}</p>
                    <p className="mt-2 italic text-slate-600">Demo base: {selectedInsight.sampleLine}</p>
                  </div>
                ) : null}
              </div>

              <label className="block">
                <span className={labelCls}>Asunto</span>
                <input value={subject} onChange={(e) => setSubject(e.target.value)} className={field} />
              </label>
              <label className="block">
                <span className={labelCls}>Preheader</span>
                <input value={preheader} onChange={(e) => setPreheader(e.target.value)} className={field} />
              </label>
              <label className="block">
                <span className={labelCls}>{insightKey ? 'Comentario editable (va a la tarjeta)' : 'Cuerpo'}</span>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={insightKey ? 8 : 12}
                  className={`${field} font-mono text-[13px] leading-relaxed`}
                  placeholder={
                    insightKey
                      ? 'Editá el demo del insight. Esto es lo que se ve en la tarjeta del mail…'
                      : undefined
                  }
                />
                <p className="mt-1 text-[10px] text-slate-500">
                  {insightKey
                    ? 'Al cambiar de insight se reemplaza este texto con el demo nuevo. Guardá para persistir tu versión. '
                    : ''}
                  Párrafos separados con línea en blanco. Variables:{' '}
                  <code className="rounded bg-slate-100 px-1">{'{{brandName}}'}</code>,{' '}
                  <code className="rounded bg-slate-100 px-1">{'{{domain}}'}</code>,{' '}
                  <code className="rounded bg-slate-100 px-1">{'{{score}}'}</code>,{' '}
                  <code className="rounded bg-slate-100 px-1">{'{{topCompetitor}}'}</code>
                </p>
              </label>

              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block text-sm">
                  <span className={labelCls}>Score ejemplo</span>
                  <input type="number" min={0} max={100} value={score} onChange={(e) => setScore(Number(e.target.value) || 0)} className={field} />
                </label>
                <label className="block text-sm">
                  <span className={labelCls}>Dominio</span>
                  <input value={domain} onChange={(e) => setDomain(e.target.value)} className={field} />
                </label>
                <label className="block text-sm">
                  <span className={labelCls}>Marca</span>
                  <input value={brandName} onChange={(e) => setBrandName(e.target.value)} className={field} />
                </label>
              </div>

              <label className="block">
                <span className={labelCls}>Enviar prueba a</span>
                <input type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} className={field} placeholder="tu@email.com" />
              </label>

              <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                <button type="button" className={primaryBtn} disabled={saveBusy} onClick={() => void saveStep()}>
                  {saveBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Guardar en BD
                </button>
                <button type="button" className={secondaryBtn} disabled={previewLoading} onClick={() => void refreshPreview()}>
                  {previewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                  Actualizar preview
                </button>
                <button type="button" className={secondaryBtn} disabled={testBusy} onClick={() => void sendTest()}>
                  {testBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Enviar prueba
                </button>
              </div>
            </section>

            <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
                <Eye className="h-4 w-4 text-violet-600" />
                Preview · {(insightKey || variant === 'letter') ? 'carta' : 'editorial'}
                {selectedInsight ? ` · ${selectedInsight.title}` : ''} + contenido del editor
              </div>
              {preview ? (
                <div className="space-y-1 border-b border-slate-100 px-4 py-2 text-xs text-slate-600">
                  <p>
                    <span className="font-semibold text-slate-800">Asunto:</span> {preview.subject}
                  </p>
                  {preview.insightPreviewLine ? (
                    <p>
                      <span className="font-semibold text-violet-800">Insight en tarjeta:</span>{' '}
                      {preview.insightPreviewLine}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {previewLoading && !preview ? (
                <div className="flex items-center justify-center gap-2 py-24 text-slate-500">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Generando preview…
                </div>
              ) : preview ? (
                <iframe
                  title="Preview secuencia free"
                  srcDoc={preview.html}
                  className="h-[min(880px,70vh)] w-full border-0 bg-slate-100"
                  sandbox="allow-same-origin"
                />
              ) : (
                <p className="px-4 py-12 text-center text-sm text-slate-500">Sin preview</p>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}
