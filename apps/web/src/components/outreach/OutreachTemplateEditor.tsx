'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  FileEdit,
  Loader2,
  RotateCcw,
  Save,
  Sparkles,
} from 'lucide-react';
import { leadsApi, type OutreachTemplate } from '@/lib/api';

const DEFAULT_SUBJECT = '{{competitorName}} rankea mejor que {{brandName}} en ChatGPT';
const DEFAULT_BODY =
  'Hola,\n\n' +
  'Detectamos que {{competitorName}} aparece recomendado por encima de {{brandName}} en ChatGPT.\n' +
  'En uno de los prompts relevantes, el Top 3 fue:\n' +
  '{{top3}}\n\n' +
  'Podemos compartirte un reporte gratuito (código CLEEXS) con evidencia completa y acciones para mejorar.\n\n' +
  '¿Te interesa que te lo enviemos?\n\n' +
  '– Cleexs';

function renderPreview(input: string, vars: { brandName: string; competitorName: string; top3: string }): string {
  const top3Inline = vars.top3.split('\n').join(', ');
  return input
    .replace(/\{\{\s*brandName\s*\}\}/g, vars.brandName)
    .replace(/\{\{\s*competitorName\s*\}\}/g, vars.competitorName)
    .replace(/\{\{\s*top3Inline\s*\}\}/g, top3Inline)
    .replace(/\{\{\s*top3\s*\}\}/g, vars.top3);
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function OutreachTemplateEditor() {
  const [template, setTemplate] = useState<OutreachTemplate | null>(null);
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [useAi, setUseAi] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [example, setExample] = useState({
    brandName: 'Marca Ejemplo',
    competitorName: 'Competidor X',
    top3: '1. Competidor X\n2. Marca Ejemplo\n3. Otro Competidor',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await leadsApi.getTemplate();
      setTemplate(data);
      setSubject(data.subject);
      setBody(data.body);
      setUseAi(Boolean(data.useAi));
      if (data.example) setExample(data.example);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la plantilla.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(() => setMessage(null), 6000);
    return () => window.clearTimeout(t);
  }, [message]);

  const dirty = useMemo(() => {
    if (!template) return false;
    return template.subject !== subject || template.body !== body || template.useAi !== useAi;
  }, [template, subject, body, useAi]);

  const previewSubject = useMemo(() => renderPreview(subject, example), [subject, example]);
  const previewBody = useMemo(() => renderPreview(body, example), [body, example]);

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await leadsApi.saveTemplate({ subject, body, useAi });
      setTemplate({
        key: res.key,
        subject: res.subject,
        body: res.body,
        useAi: res.useAi,
        openAiConfigured: template?.openAiConfigured,
        updatedAt: res.updatedAt,
        updatedBy: res.updatedBy,
        variables: template?.variables,
        example: template?.example,
      });
      setMessage('Plantilla guardada. Los próximos drafts ya usan este texto.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  }

  function restoreDefault() {
    setSubject(DEFAULT_SUBJECT);
    setBody(DEFAULT_BODY);
    setUseAi(false);
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
            <FileEdit className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Mensaje de outreach</h2>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
              Este es el texto que se usa para generar el draft de cada competidor. Editalo y guardá; los próximos
              previews lo van a usar tal cual.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={restoreDefault}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restaurar plantilla por defecto
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={!dirty || saving}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Guardando…' : dirty ? 'Guardar cambios' : 'Sin cambios'}
          </button>
        </div>
      </header>

      <div className="grid gap-5 p-5 lg:grid-cols-2">
        <div className="space-y-4">
          {error ? (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>{error}</p>
            </div>
          ) : null}
          {message ? (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>{message}</p>
            </div>
          ) : null}

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Asunto</span>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={loading}
              placeholder={DEFAULT_SUBJECT}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-200 disabled:opacity-60"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cuerpo del email</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={loading}
              rows={12}
              placeholder={DEFAULT_BODY}
              className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-xs leading-relaxed text-slate-900 shadow-sm outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-200 disabled:opacity-60"
            />
          </label>

          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Variables disponibles</p>
            <ul className="mt-2 grid grid-cols-1 gap-1.5 text-xs text-slate-600 sm:grid-cols-2">
              <li>
                <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-violet-700 ring-1 ring-slate-200">
                  {'{{brandName}}'}
                </code>{' '}
                — marca medida
              </li>
              <li>
                <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-violet-700 ring-1 ring-slate-200">
                  {'{{competitorName}}'}
                </code>{' '}
                — competidor detectado
              </li>
              <li>
                <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-violet-700 ring-1 ring-slate-200">
                  {'{{top3}}'}
                </code>{' '}
                — top 3 (en líneas)
              </li>
              <li>
                <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-violet-700 ring-1 ring-slate-200">
                  {'{{top3Inline}}'}
                </code>{' '}
                — top 3 (en línea)
              </li>
            </ul>
          </div>

          <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={useAi}
              onChange={(e) => setUseAi(e.target.checked)}
              disabled={loading}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
            />
            <span>
              <span className="flex items-center gap-1.5 font-semibold text-slate-800">
                <Sparkles className="h-3.5 w-3.5 text-violet-600" />
                Mejorar con IA antes de crear el draft
              </span>
              <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">
                Si está marcado, OpenAI reescribe el cuerpo manteniendo la idea. Si está desmarcado, se usa
                literalmente este texto (recomendado para tener control total).
                {template?.openAiConfigured === false ? (
                  <span className="mt-1 block text-amber-700">
                    Atención: <code className="font-mono">OPENAI_API_KEY</code> no está configurada, así que la IA no va
                    a poder usarse aunque la marques.
                  </span>
                ) : null}
              </span>
            </span>
          </label>

          {template?.updatedAt ? (
            <p className="text-[11px] text-slate-500">
              Última actualización: <strong className="text-slate-700">{formatDateTime(template.updatedAt)}</strong>
              {template.updatedBy ? <span> · {template.updatedBy}</span> : null}
            </p>
          ) : null}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Eye className="h-3.5 w-3.5" />
            Vista previa
          </div>

          <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-xs">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Datos de ejemplo</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block">
                <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">brandName</span>
                <input
                  value={example.brandName}
                  onChange={(e) => setExample((p) => ({ ...p, brandName: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs shadow-sm focus:border-violet-300 focus:ring-2 focus:ring-violet-200"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">competitorName</span>
                <input
                  value={example.competitorName}
                  onChange={(e) => setExample((p) => ({ ...p, competitorName: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs shadow-sm focus:border-violet-300 focus:ring-2 focus:ring-violet-200"
                />
              </label>
            </div>
            <label className="block">
              <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">top3 (uno por línea)</span>
              <textarea
                value={example.top3}
                onChange={(e) => setExample((p) => ({ ...p, top3: e.target.value }))}
                rows={3}
                className="mt-1 w-full resize-y rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-mono text-[11px] shadow-sm focus:border-violet-300 focus:ring-2 focus:ring-violet-200"
              />
            </label>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Asunto</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{previewSubject}</p>
            <div className="my-3 h-px bg-slate-100" />
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Cuerpo</p>
            <pre className="mt-1 whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">
              {previewBody}
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}
