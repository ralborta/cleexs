'use client';

import { Check, Loader2, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';

export type CampaignRow = {
  id: string;
  slug: string;
  weekIndex: number;
  scoreBucket: string;
  title: string;
  description: string | null;
  espTemplateId: string | null;
  subject: string | null;
  body: string | null;
  preheader: string | null;
  active: boolean;
  priority: number;
};

const FIELD =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:ring-2 focus:ring-violet-200';
const LABEL = 'text-xs font-semibold uppercase tracking-wide text-slate-500';
const PRIMARY =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50';
const SUBTLE =
  'inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50';

export const WEEKLY_DEFAULTS_PREVIEW: Record<number, { subject: string; body: string; preheader: string }> = {
  1: {
    subject: '{{brandName}}: tu Cleexs Score es {{score}}',
    preheader: 'Resumen mensual de visibilidad en IA.',
    body:
      'Hola, esta semana miramos el estado general de {{brandName}}.\n\nTu Cleexs Score actual es {{score}}. Este número resume qué tan visible y confiable aparecés frente a motores de IA y buscadores conversacionales.\n\nTip rápido: {{tip1}}',
  },
  2: {
    subject: 'Un competidor que deberías mirar: {{topCompetitor}}',
    preheader: 'Una señal competitiva simple para mantenerte atento.',
    body:
      'En las consultas de IA, la pelea no es solo por tráfico: también es por ser mencionado como opción.\n\nEsta semana te sugerimos mirar a {{topCompetitor}} y revisar si tu sitio explica con la misma claridad por qué elegir {{brandName}}.\n\nTip rápido: {{tip2}}',
  },
  3: {
    subject: '3 ajustes para mejorar {{domain}}',
    preheader: 'Acciones simples para que la IA entienda mejor tu negocio.',
    body:
      'Para {{domain}}, estas son tres mejoras de bajo esfuerzo que suelen ayudar a subir presencia en motores de IA:\n\n1. {{tip1}}\n2. {{tip2}}\n3. {{tip3}}\n\nNo hace falta rehacer todo: conviene empezar por la home, servicios y preguntas frecuentes.',
  },
  4: {
    subject: 'Cómo aparecer mejor en ChatGPT y otros motores',
    preheader: 'Una recomendación semanal para sostener presencia de marca.',
    body:
      'Cada vez más personas descubren proveedores preguntándole a ChatGPT, Gemini o Perplexity. Para aparecer mejor, la IA necesita señales claras: qué hacés, para quién, dónde operás y por qué sos confiable.\n\nPara {{brandName}}, el mejor próximo paso es: {{tip1}}\n\nSi querés medirlo todas las semanas y ver motores extra, Premium lo deja automatizado.',
  },
};

export function defaultsForWeek(week: number) {
  const w = ((week - 1) % 4) + 1;
  return WEEKLY_DEFAULTS_PREVIEW[w] ?? WEEKLY_DEFAULTS_PREVIEW[1];
}

export function renderPreview(text: string) {
  return text
    .replace(/{{brandName}}/g, 'Acme')
    .replace(/{{domain}}/g, 'acme.com')
    .replace(/{{score}}/g, '62')
    .replace(/{{tip1}}/g, 'Agregá una sección "Por qué elegirnos" en home.')
    .replace(/{{tip2}}/g, 'Mejorá la página de servicios con texto claro.')
    .replace(/{{tip3}}/g, 'Sumá FAQ con preguntas reales de clientes.')
    .replace(/{{topCompetitor}}/g, 'CompetidorX');
}

export function CampaignContentEditor({
  c,
  onSave,
}: {
  c: CampaignRow;
  onSave: (payload: {
    subject: string | null;
    body: string | null;
    preheader: string | null;
  }) => Promise<void>;
}) {
  const defaults = defaultsForWeek(c.weekIndex);
  const [subject, setSubject] = useState(c.subject ?? '');
  const [preheader, setPreheader] = useState(c.preheader ?? '');
  const [body, setBody] = useState(c.body ?? '');
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setSubject(c.subject ?? '');
    setPreheader(c.preheader ?? '');
    setBody(c.body ?? '');
  }, [c.id, c.subject, c.preheader, c.body]);

  const effectiveSubject = (subject || '').trim() || defaults.subject;
  const effectiveBody = (body || '').trim() || defaults.body;
  const effectivePreheader = (preheader || '').trim() || defaults.preheader;

  async function handleSave() {
    setBusy(true);
    setLocalError(null);
    try {
      await onSave({
        subject: subject.trim() ? subject.trim() : null,
        body: body.trim() ? body.trim() : null,
        preheader: preheader.trim() ? preheader.trim() : null,
      });
      setSavedAt(Date.now());
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  function loadDefaults() {
    setSubject(defaults.subject);
    setPreheader(defaults.preheader);
    setBody(defaults.body);
  }

  function clearOverrides() {
    setSubject('');
    setPreheader('');
    setBody('');
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-semibold text-slate-900">Editar mensaje</h4>
          <div className="flex gap-2">
            <button type="button" onClick={loadDefaults} className={`${SUBTLE} text-[11px]`}>
              <RotateCcw className="h-3 w-3" />
              Cargar por defecto
            </button>
            <button type="button" onClick={clearOverrides} className={`${SUBTLE} text-[11px]`}>
              Quitar override
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Si dejás un campo vacío, esa parte se manda con el texto por defecto de la semana {c.weekIndex}. Variables
          disponibles:{' '}
          <code className="rounded bg-slate-100 px-1 font-mono text-[11px]">{'{{brandName}}'}</code>,{' '}
          <code className="rounded bg-slate-100 px-1 font-mono text-[11px]">{'{{domain}}'}</code>,{' '}
          <code className="rounded bg-slate-100 px-1 font-mono text-[11px]">{'{{score}}'}</code>,{' '}
          <code className="rounded bg-slate-100 px-1 font-mono text-[11px]">{'{{tip1}}'}</code>,{' '}
          <code className="rounded bg-slate-100 px-1 font-mono text-[11px]">{'{{tip2}}'}</code>,{' '}
          <code className="rounded bg-slate-100 px-1 font-mono text-[11px]">{'{{tip3}}'}</code>,{' '}
          <code className="rounded bg-slate-100 px-1 font-mono text-[11px]">{'{{topCompetitor}}'}</code>.
        </p>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className={LABEL}>Asunto</span>
            <input
              value={subject}
              onChange={(ev) => setSubject(ev.target.value)}
              placeholder={defaults.subject}
              className={FIELD}
            />
          </label>
          <label className="block">
            <span className={LABEL}>Preheader (texto preview en bandeja)</span>
            <input
              value={preheader}
              onChange={(ev) => setPreheader(ev.target.value)}
              placeholder={defaults.preheader}
              className={FIELD}
            />
          </label>
          <label className="block">
            <span className={LABEL}>Mensaje</span>
            <textarea
              rows={9}
              value={body}
              onChange={(ev) => setBody(ev.target.value)}
              placeholder={defaults.body}
              className={`${FIELD} resize-y font-mono text-[12px]`}
            />
          </label>
        </div>
        {localError ? (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {localError}
          </div>
        ) : null}
        <div className="mt-4 flex items-center justify-end gap-3">
          {savedAt ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
              <Check className="h-3.5 w-3.5" />
              Guardado
            </span>
          ) : null}
          <button type="button" onClick={() => void handleSave()} disabled={busy} className={PRIMARY}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {busy ? 'Guardando…' : 'Guardar contenido'}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h4 className="text-sm font-semibold text-slate-900">Vista previa</h4>
        <p className="mt-1 text-xs text-slate-500">
          Cómo se vería con datos de ejemplo (Acme · acme.com · score 62). Esto es lo que recibe el destinatario.
        </p>
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <div className="bg-slate-50 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Asunto</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">{renderPreview(effectiveSubject)}</p>
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Preheader</p>
            <p className="mt-0.5 text-xs text-slate-600">{renderPreview(effectivePreheader)}</p>
          </div>
          <div className="bg-white px-4 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-700">Secuencia semanal</p>
            <p className="mt-1 text-base font-semibold text-slate-900">Semana {c.weekIndex}</p>
            <p className="mt-3 text-sm font-medium text-slate-900">{c.title}</p>
            {renderPreview(effectiveBody)
              .split(/\n{2,}/)
              .map((p, idx) => (
                <p key={idx} className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-700">
                  {p}
                </p>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
