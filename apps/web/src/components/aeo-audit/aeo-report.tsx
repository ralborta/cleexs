'use client';

import { useState } from 'react';
import { AlertTriangle, Check, ChevronDown, Copy, Sparkles, TrendingUp } from 'lucide-react';

export type AeoDimension = {
  key: string;
  label: string;
  scoreBefore: number;
  scoreAfter: number;
  bien: string;
  mal: string;
  cambio: string;
};

export type AeoRewriteBlock = { id: string; titulo: string; contenido: string };
export type AeoComparison = { alternativa: string; descripcion: string };
export type AeoFaq = { pregunta: string; respuesta: string };

export interface AeoContentResult {
  targetUrl: string;
  fetchedAt: string;
  scrapeOk: boolean;
  scrapeChars: number;
  identidad: {
    queVende: string;
    industria: string;
    tipoCliente: string;
    region: string;
    problema: string;
    resultado: string;
    palabrasVacias: string[];
    conceptosClave: string[];
  };
  dimensiones: AeoDimension[];
  scoreBefore: number;
  scoreAfter: number;
  reescritura: AeoRewriteBlock[];
  comparativa: AeoComparison[];
  faqs: AeoFaq[];
  tldr: string;
  cambiosPrioritarios: string[];
  queriesObjetivo: string[];
  claimsAValidar: string[];
  model?: string;
  warnings?: string[];
}

function scoreColor(s: number): string {
  if (s >= 75) return 'text-emerald-600';
  if (s >= 50) return 'text-amber-600';
  return 'text-rose-600';
}
function barColor(s: number): string {
  if (s >= 75) return 'bg-emerald-500';
  if (s >= 50) return 'bg-amber-500';
  return 'bg-rose-500';
}

/** Informe AEO. Usado por el panel admin y la página pública del cliente. */
export function AeoReport({ result, showInternal = false }: { result: AeoContentResult; showInternal?: boolean }) {
  return (
    <div className="space-y-6">
      {/* Resumen score antes/después */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-500">
          Diagnóstico de contenido para IA
        </p>
        <h2 className="mt-1 text-xl font-bold text-slate-900">
          ¿Tu contenido responde lo que se le pregunta a ChatGPT?
        </h2>
        <div className="mt-5 flex flex-wrap items-center gap-6">
          <ScoreBlock label="Score actual" value={result.scoreBefore} />
          <TrendingUp className="h-6 w-6 text-slate-300" />
          <ScoreBlock label="Estimado tras reescritura" value={result.scoreAfter} highlight />
        </div>
      </div>

      {/* Identidad */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900">Identidad del negocio (según la web)</h3>
        <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Qué vende" value={result.identidad.queVende} />
          <Field label="Industria" value={result.identidad.industria} />
          <Field label="Tipo de cliente" value={result.identidad.tipoCliente} />
          <Field label="Región" value={result.identidad.region} />
          <Field label="Problema que resuelve" value={result.identidad.problema} />
          <Field label="Resultado que promete" value={result.identidad.resultado} />
        </dl>
        {result.identidad.conceptosClave.length > 0 && (
          <div className="mt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Conceptos a reforzar</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {result.identidad.conceptosClave.map((c, i) => (
                <span key={i} className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-violet-200">
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}
        {result.identidad.palabrasVacias.length > 0 && (
          <div className="mt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Palabras vacías a evitar</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {result.identidad.palabrasVacias.map((c, i) => (
                <span key={i} className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-600 ring-1 ring-rose-200 line-through">
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Dimensiones */}
      {result.dimensiones.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900">Diagnóstico por dimensión</h3>
          <ul className="mt-4 space-y-4">
            {result.dimensiones.map((d) => (
              <li key={d.key} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-slate-900">{d.label}</p>
                  <div className="flex items-center gap-2 text-sm font-bold tabular-nums">
                    <span className={scoreColor(d.scoreBefore)}>{d.scoreBefore}</span>
                    <span className="text-slate-300">→</span>
                    <span className={scoreColor(d.scoreAfter)}>{d.scoreAfter}</span>
                  </div>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div className={`h-full ${barColor(d.scoreBefore)}`} style={{ width: `${d.scoreBefore}%` }} />
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
                  <p className="text-emerald-700"><span className="font-semibold">Bien:</span> {d.bien}</p>
                  <p className="text-rose-700"><span className="font-semibold">Mal:</span> {d.mal}</p>
                  <p className="text-slate-700"><span className="font-semibold">Cambio:</span> {d.cambio}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Claims a validar (guardrail) */}
      {result.claimsAValidar.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-6 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-bold text-amber-900">
            <AlertTriangle className="h-4 w-4" /> Datos a validar antes de publicar
          </h3>
          <p className="mt-1 text-xs text-amber-700">
            La IA sugirió estas afirmaciones, pero no están confirmadas en la web actual. Verificalas antes de usarlas.
          </p>
          <ul className="mt-3 space-y-1.5">
            {result.claimsAValidar.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-amber-900">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Reescritura */}
      {result.reescritura.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Sparkles className="h-4 w-4 text-violet-500" /> Landing reescrita (optimizada para IA)
            </h3>
          </div>
          <div className="mt-4 space-y-3">
            {result.reescritura.map((b) => (
              <RewriteBlock key={b.id} block={b} />
            ))}
          </div>
        </div>
      )}

      {/* Comparativa */}
      {result.comparativa.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900">Comparativa con alternativas</h3>
          <ul className="mt-3 space-y-2">
            {result.comparativa.map((c, i) => (
              <li key={i} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="font-semibold text-slate-800">{c.alternativa}:</span>{' '}
                <span className="text-slate-600">{c.descripcion}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* FAQs */}
      {result.faqs.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900">Preguntas frecuentes (ChatGPT-ready)</h3>
          <ul className="mt-3 divide-y divide-slate-100">
            {result.faqs.map((f, i) => (
              <li key={i} className="py-3 first:pt-0 last:pb-0">
                <p className="text-sm font-semibold text-slate-900">{f.pregunta}</p>
                <p className="mt-1 text-sm text-slate-600">{f.respuesta}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Queries objetivo */}
      {result.queriesObjetivo.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900">Queries de IA para las que deberías competir</h3>
          <ul className="mt-3 space-y-1.5">
            {result.queriesObjetivo.map((q, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
                {q}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Cambios prioritarios */}
      {result.cambiosPrioritarios.length > 0 && (
        <div className="rounded-2xl border border-violet-100 bg-violet-50/40 p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900">Cambios prioritarios</h3>
          <ol className="mt-3 space-y-2">
            {result.cambiosPrioritarios.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[11px] font-bold text-white">
                  {i + 1}
                </span>
                {c}
              </li>
            ))}
          </ol>
        </div>
      )}

      {showInternal && result.warnings && result.warnings.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
          <p className="font-semibold">Notas técnicas:</p>
          <ul className="mt-1 list-disc pl-4">
            {result.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
            {result.model && <li>Modelo: {result.model}</li>}
            <li>Caracteres analizados: {result.scrapeChars}</li>
          </ul>
        </div>
      )}
    </div>
  );
}

function ScoreBlock({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-xl px-4 py-3 ${highlight ? 'bg-violet-50 ring-1 ring-violet-200' : 'bg-slate-50'}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`text-3xl font-bold tabular-nums ${scoreColor(value)}`}>
        {value}
        <span className="text-base font-medium text-slate-400">/100</span>
      </p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-700">{value}</dd>
    </div>
  );
}

function RewriteBlock({ block }: { block: AeoRewriteBlock }) {
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  function copy() {
    void navigator.clipboard.writeText(block.contenido);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="rounded-xl border border-slate-200">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5">
        <button onClick={() => setOpen((v) => !v)} className="flex flex-1 items-center gap-2 text-left">
          <ChevronDown className={`h-4 w-4 text-slate-400 transition ${open ? '' : '-rotate-90'}`} />
          <span className="text-sm font-semibold text-slate-900">{block.titulo}</span>
        </button>
        <button
          onClick={copy}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-50"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      {open && (
        <div className="border-t border-slate-100 px-4 py-3">
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{block.contenido}</p>
        </div>
      )}
    </div>
  );
}
