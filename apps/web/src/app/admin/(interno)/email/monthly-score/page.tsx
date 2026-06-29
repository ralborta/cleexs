'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, Loader2, Mail, RefreshCw, Send } from 'lucide-react';
import Link from 'next/link';
import { adminUiFetch } from '@/lib/admin-ui-client-fetch';

export const dynamic = 'force-dynamic';

type PreviewPayload = {
  ok: boolean;
  subject: string;
  html: string;
  text: string;
  assets: {
    logoUrl: string;
    heroImageUrl?: string | null;
    founderPhotoUrl?: string | null;
  };
  sampleScore: number;
  newDiagnosticUrl: string;
  plansUrl: string;
};

const field =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-200';
const primaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50';

export default function MonthlyScoreEmailPreviewPage() {
  const [score, setScore] = useState(62);
  const [testEmail, setTestEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewPayload | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminUiFetch(`/api/admin-ui/email/monthly-score/preview?score=${score}`);
      const data = (await res.json()) as PreviewPayload & { error?: string };
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setPreview(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el preview');
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }, [score]);

  useEffect(() => {
    void load();
  }, [load]);

  const iframeSrcDoc = useMemo(() => preview?.html ?? '', [preview?.html]);

  async function sendTest() {
    if (!testEmail.trim()) {
      setHint('Ingresá un email de prueba.');
      return;
    }
    setSending(true);
    setHint(null);
    setError(null);
    try {
      const res = await adminUiFetch('/api/admin-ui/email/monthly-score/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: testEmail.trim(), score }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; subject?: string };
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setHint(`Enviado: "${data.subject ?? preview?.subject}" → ${testEmail.trim()}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al enviar prueba');
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">Email · score mensual</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Template de ejemplo</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            Un solo dato personalizado: <strong>Cleexs Score</strong>. CTA a nuevo diagnóstico. Cuando tengas el hero
            custom, lo cableamos con <code className="rounded bg-slate-100 px-1 text-xs">MONTHLY_SCORE_EMAIL_HERO_URL</code>{' '}
            o subiendo el PNG a <code className="rounded bg-slate-100 px-1 text-xs">/public</code>.
          </p>
        </div>
        <Link
          href="/admin/email"
          className="text-sm font-medium text-violet-600 hover:text-violet-800"
        >
          ← Volver a secuencia
        </Link>
      </div>

      <div className="mb-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="font-semibold text-slate-700">Score de muestra</span>
            <input
              type="number"
              min={0}
              max={100}
              value={score}
              onChange={(e) => setScore(Number(e.target.value) || 0)}
              className={field}
            />
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-slate-700">Enviar prueba a</span>
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="tu@email.com"
              className={field}
            />
          </label>
        </div>
        <div className="flex flex-col justify-end gap-2">
          <button type="button" onClick={() => void load()} disabled={loading} className={primaryBtn}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Actualizar preview
          </button>
          <button type="button" onClick={() => void sendTest()} disabled={sending} className={primaryBtn}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar prueba
          </button>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
      ) : null}
      {hint ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{hint}</div>
      ) : null}

      {preview ? (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <p>
            <span className="font-semibold text-slate-900">Asunto:</span> {preview.subject}
          </p>
          <p className="mt-1">
            <span className="font-semibold text-slate-900">CTA diagnóstico:</span>{' '}
            <a href={preview.newDiagnosticUrl} className="text-violet-600 hover:underline" target="_blank" rel="noreferrer">
              {preview.newDiagnosticUrl}
              <ExternalLink className="ml-1 inline h-3.5 w-3.5" />
            </a>
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Logo: {preview.assets.logoUrl}
            {preview.assets.heroImageUrl ? ` · Hero: ${preview.assets.heroImageUrl}` : ' · Hero: CSS (pendiente imagen)'}
          </p>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
          <Mail className="h-4 w-4 text-violet-600" />
          Vista previa HTML
        </div>
        {loading && !preview ? (
          <div className="flex items-center justify-center gap-2 py-24 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando…
          </div>
        ) : (
          <iframe
            title="Preview email score mensual"
            srcDoc={iframeSrcDoc}
            className="h-[920px] w-full border-0 bg-slate-100"
            sandbox="allow-same-origin"
          />
        )}
      </section>
    </main>
  );
}
