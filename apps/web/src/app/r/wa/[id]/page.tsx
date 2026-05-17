'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CleexsMark } from '@/components/brand/cleexs-mark';
import { Button } from '@/components/ui/button';
import {
  publicDiagnosticApi,
  type DiagnosticAnalysisJson,
  type DiagnosticAnalysisSingle,
  type PublicDiagnostic,
  isDiagnosticAnalysisGold,
} from '@/lib/api';
import { Loader2, Mail, Sparkles, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

function pickAnalysisSingle(json: DiagnosticAnalysisJson | null | undefined): DiagnosticAnalysisSingle | null {
  if (!json) return null;
  if (isDiagnosticAnalysisGold(json)) return json.analisisOpenAI ?? null;
  return json;
}

function scoreTone(score: number): { label: string; ring: string; text: string } {
  if (score >= 70) {
    return { label: 'Alta', ring: 'stroke-emerald-500', text: 'text-emerald-700' };
  }
  if (score >= 45) {
    return { label: 'Media', ring: 'stroke-amber-500', text: 'text-amber-700' };
  }
  return { label: 'Baja', ring: 'stroke-rose-500', text: 'text-rose-700' };
}

function ScoreRing({ value }: { value: number }) {
  const tone = scoreTone(value);
  const r = 52;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;

  return (
    <div className="relative mx-auto h-40 w-40">
      <svg className="h-40 w-40 -rotate-90" viewBox="0 0 120 120" aria-hidden>
        <circle cx="60" cy="60" r={r} className="stroke-slate-100" strokeWidth="10" fill="none" />
        <circle
          cx="60"
          cy="60"
          r={r}
          className={cn(tone.ring, 'transition-all duration-700')}
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold tabular-nums text-slate-900">{Math.round(value)}</span>
        <span className="text-xs font-medium text-slate-500">Cleexs Score</span>
        <span className={cn('mt-0.5 text-xs font-semibold', tone.text)}>{tone.label}</span>
      </div>
    </div>
  );
}

export default function WhatsAppResultPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';

  const [diagnostic, setDiagnostic] = useState<PublicDiagnostic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailDone, setEmailDone] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return null;
    return publicDiagnosticApi.get(id);
  }, [id]);

  useEffect(() => {
    if (!id) {
      setError('Enlace inválido.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      try {
        const d = await load();
        if (cancelled || !d) return;
        setDiagnostic(d);
        setError(null);
        if (d.status === 'failed') {
          setLoading(false);
          if (timer) clearInterval(timer);
          return;
        }
        if (d.status === 'completed' && d.runResult) {
          setLoading(false);
          if (timer) clearInterval(timer);
          return;
        }
      } catch {
        if (!cancelled) setError('No pudimos cargar tu diagnóstico. Reintentá en un momento.');
      }
    };

    void poll();
    timer = setInterval(() => void poll(), 4000);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [id, load]);

  const score = diagnostic?.runResult?.cleexsScore ?? null;
  const analysis = pickAnalysisSingle(diagnostic?.analysisJson ?? null);
  const competitors = diagnostic?.runResult?.competitorDetails ?? [];

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !id) return;
    setEmailSaving(true);
    setEmailError(null);
    try {
      await publicDiagnosticApi.setEmail(id, trimmed);
      setEmailDone(true);
    } catch {
      setEmailError('No pudimos guardar el email. Revisá el formato e intentá de nuevo.');
    } finally {
      setEmailSaving(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-slate-50 to-white">
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center justify-center gap-2">
          <CleexsMark className="h-7 w-auto" />
          <span className="text-sm font-semibold text-slate-800">Tu diagnóstico</span>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pb-10 pt-6">
        {loading && (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary-600" />
            <div>
              <p className="text-base font-semibold text-slate-900">Analizando tu sitio</p>
              <p className="mt-1 text-sm text-slate-500">
                {diagnostic?.domain ? diagnostic.domain : 'Esto puede tardar unos minutos'}
              </p>
              {diagnostic?.progressPercent != null && (
                <div className="mt-4 h-2 w-56 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-primary-600 transition-all duration-500"
                    style={{ width: `${diagnostic.progressPercent}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-6 text-center text-sm text-rose-800">
            {error}
          </div>
        )}

        {!loading && diagnostic?.status === 'failed' && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-900">
            No pudimos completar el análisis. Escribinos por WhatsApp y lo revisamos.
          </div>
        )}

        {!loading && score != null && diagnostic && (
          <div className="space-y-5">
            <div className="text-center">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {diagnostic.brandName}
              </p>
              <p className="text-sm text-slate-600">{diagnostic.domain}</p>
            </div>

            <ScoreRing value={score} />

            <p className="text-center text-sm leading-relaxed text-slate-600">
              Probabilidad de que <strong>ChatGPT</strong> te recomiende en consultas de tu rubro.
            </p>

            {analysis?.resumenEjecutivo && (
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Sparkles className="h-4 w-4 text-primary-600" />
                  Resumen
                </div>
                <p className="text-sm leading-relaxed text-slate-700">{analysis.resumenEjecutivo}</p>
              </section>
            )}

            {(analysis?.fortalezas?.length || analysis?.debilidades?.length) ? (
              <section className="grid gap-3">
                {analysis.fortalezas && analysis.fortalezas.length > 0 && (
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4">
                    <p className="mb-2 text-xs font-semibold uppercase text-emerald-800">Fortalezas</p>
                    <ul className="space-y-1 text-sm text-emerald-900">
                      {analysis.fortalezas.slice(0, 3).map((f) => (
                        <li key={f}>• {f}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {analysis.debilidades && analysis.debilidades.length > 0 && (
                  <div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-4">
                    <p className="mb-2 text-xs font-semibold uppercase text-amber-800">A mejorar</p>
                    <ul className="space-y-1 text-sm text-amber-900">
                      {analysis.debilidades.slice(0, 3).map((d) => (
                        <li key={d}>• {d}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            ) : null}

            {competitors.length > 0 && (
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <TrendingUp className="h-4 w-4 text-primary-600" />
                  Competidores analizados
                </div>
                <ul className="flex flex-wrap gap-2">
                  {competitors.slice(0, 5).map((c) => (
                    <li
                      key={c.name}
                      className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                    >
                      {c.name.replace(/\s*\([^)]+\)\s*$/, '').trim() || c.name}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {!emailDone && !diagnostic.email && (
              <section className="rounded-2xl border border-primary-200 bg-primary-50/50 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Mail className="h-4 w-4 text-primary-600" />
                  Recibí el informe por email
                </div>
                <p className="mb-3 text-xs text-slate-600">
                  Sin spam en WhatsApp: te enviamos el resumen y tips semanales por correo.
                </p>
                <form onSubmit={submitEmail} className="flex flex-col gap-2">
                  <input
                    type="email"
                    placeholder="tu@empresa.com"
                    value={email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
                    autoComplete="email"
                  />
                  <Button type="submit" disabled={emailSaving} className="w-full">
                    {emailSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Guardando…
                      </>
                    ) : (
                      'Enviar informe'
                    )}
                  </Button>
                  {emailError && <p className="text-xs text-rose-600">{emailError}</p>}
                </form>
              </section>
            )}

            {(emailDone || diagnostic.email) && (
              <p className="text-center text-sm text-emerald-700">
                Listo: revisá tu bandeja de entrada (y spam) en los próximos minutos.
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
