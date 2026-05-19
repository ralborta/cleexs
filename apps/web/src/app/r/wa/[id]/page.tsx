'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { publicDiagnosticApi, type PublicDiagnostic } from '@/lib/api';
import { CheckCircle2, Loader2, Mail, MessageCircle } from 'lucide-react';
import { WaMobileDashboard } from './wa-mobile-dashboard';

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
    const pollStartedAt = Date.now();
    const STUCK_MS = 6 * 60 * 1000;

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
        const stuck =
          Date.now() - pollStartedAt > STUCK_MS &&
          (d.status === 'awaiting_user' || d.status === 'detecting_competitors');
        if (stuck) {
          setLoading(false);
          setError(
            'El análisis está tardando más de lo habitual. Volvé a WhatsApp: reenviá la URL de tu sitio para reintentar.'
          );
          if (timer) clearInterval(timer);
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

  const runResult = diagnostic?.runResult;

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
    <div className="relative min-h-[100dvh] overflow-x-hidden bg-[#0b1220]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(37,99,235,0.35),transparent)]" />
      <div className="pointer-events-none absolute -right-24 top-32 h-64 w-64 rounded-full bg-violet-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -left-16 bottom-40 h-48 w-48 rounded-full bg-sky-500/15 blur-3xl" />

      <header className="relative z-10 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Image
              src="/CleexsLogo.png"
              alt="Cleexs"
              width={40}
              height={40}
              className="h-10 w-10 rounded-xl shadow-lg shadow-primary-900/40 ring-1 ring-white/10"
              priority
            />
            <div>
              <p className="text-base font-bold tracking-tight text-white">Cleexs</p>
              <p className="text-[11px] font-medium text-slate-400">Diagnóstico IA</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
            <MessageCircle className="h-3 w-3" aria-hidden />
            WhatsApp
          </span>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-md px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-2">
        {loading && (
          <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-5 text-center">
              <div className="relative">
                <div className="absolute inset-0 animate-ping rounded-full bg-primary-500/20" />
                <Loader2 className="relative h-11 w-11 animate-spin text-primary-400" />
              </div>
              <div>
                <p className="text-lg font-semibold text-white">Analizando tu sitio</p>
                <p className="mt-1.5 text-sm text-slate-400">
                  {diagnostic?.domain ? diagnostic.domain : 'Simulando consultas en ChatGPT…'}
                </p>
              </div>
              {diagnostic?.progressPercent != null && (
                <div className="w-full max-w-[240px]">
                  <div className="mb-1.5 flex justify-between text-[10px] font-medium tabular-nums text-slate-500">
                    <span>Progreso</span>
                    <span>{diagnostic.progressPercent}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary-500 to-sky-400 transition-all duration-500"
                      style={{ width: `${diagnostic.progressPercent}%` }}
                    />
                  </div>
                </div>
              )}
              <p className="text-xs text-slate-500">Podés volver a WhatsApp; te avisamos cuando esté listo.</p>
            </div>
          </section>
        )}

        {!loading && error && (
          <section className="mt-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-6 text-center text-sm text-rose-100">
            {error}
          </section>
        )}

        {!loading && diagnostic?.status === 'failed' && (
          <section className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-6 text-center text-sm text-amber-100">
            No pudimos completar el análisis. Escribinos por WhatsApp y lo revisamos.
          </section>
        )}

        {!loading && runResult && diagnostic && (
          <div className="space-y-5">
            <WaMobileDashboard
              runResult={runResult}
              analysisJson={diagnostic.analysisJson}
              domain={diagnostic.domain}
            />

            {!emailDone && !diagnostic.email && (
              <section className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-white/[0.03] p-5 shadow-xl shadow-black/20 backdrop-blur-md">
                <div className="mb-4 flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-500/20">
                    <Mail className="h-5 w-5 text-primary-300" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Informe completo por email</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
                      Te enviamos el detalle ampliado y cómo mejorar tu visibilidad en IA.
                    </p>
                  </div>
                </div>
                <form onSubmit={submitEmail} className="flex flex-col gap-2.5">
                  <input
                    type="email"
                    placeholder="tu@empresa.com"
                    value={email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                    required
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-primary-400/50 focus:ring-2 focus:ring-primary-500/40"
                    autoComplete="email"
                  />
                  <Button
                    type="submit"
                    disabled={emailSaving}
                    className="h-12 w-full rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 text-sm font-semibold shadow-lg shadow-primary-900/30 hover:from-primary-500 hover:to-primary-400"
                  >
                    {emailSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enviando…
                      </>
                    ) : (
                      'Recibir informe'
                    )}
                  </Button>
                  {emailError && <p className="text-center text-xs text-rose-300">{emailError}</p>}
                </form>
              </section>
            )}

            {(emailDone || diagnostic.email) && (
              <p className="flex items-center justify-center gap-2 text-center text-sm font-medium text-emerald-300">
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                Revisá tu correo en los próximos minutos.
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
