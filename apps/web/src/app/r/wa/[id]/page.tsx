'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CleexsMark } from '@/components/brand/cleexs-mark';
import { Button } from '@/components/ui/button';
import { publicDiagnosticApi, type PublicDiagnostic } from '@/lib/api';
import { Loader2, Mail } from 'lucide-react';
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
    <div className="min-h-[100dvh] bg-gradient-to-b from-slate-100/80 to-white">
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/95 px-4 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-md flex-col items-center gap-1 text-center">
          <CleexsMark className="h-9 w-9" />
          <p className="text-lg font-bold tracking-tight text-slate-900">Cleexs</p>
          <p className="text-sm font-medium text-slate-500">Tu diagnóstico</p>
        </div>
      </header>

      <main className="mx-auto max-w-md px-3 pb-10 pt-4">
        {loading && (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary-600" />
            <div>
              <p className="text-base font-semibold text-slate-900">Analizando tu sitio</p>
              <p className="mt-1 text-sm text-slate-500">
                {diagnostic?.domain ? diagnostic.domain : 'Esto puede tardar unos minutos'}
              </p>
              {diagnostic?.progressPercent != null && (
                <div className="mx-auto mt-4 h-2 w-56 overflow-hidden rounded-full bg-slate-200">
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

        {!loading && runResult && diagnostic && (
          <div className="space-y-4">
            <WaMobileDashboard
              runResult={runResult}
              analysisJson={diagnostic.analysisJson}
              domain={diagnostic.domain}
            />

            {!emailDone && !diagnostic.email && (
              <section className="rounded-2xl border border-primary-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-center gap-2">
                  <Mail className="h-4 w-4 text-primary-600" />
                  <span className="text-sm font-semibold text-slate-900">Informe por email</span>
                </div>
                <form onSubmit={submitEmail} className="flex flex-col gap-2">
                  <input
                    type="email"
                    placeholder="tu@empresa.com"
                    value={email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm"
                    autoComplete="email"
                  />
                  <Button type="submit" disabled={emailSaving} className="h-11 w-full rounded-xl">
                    {emailSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enviando…
                      </>
                    ) : (
                      'Recibir informe'
                    )}
                  </Button>
                  {emailError && <p className="text-center text-xs text-rose-600">{emailError}</p>}
                </form>
              </section>
            )}

            {(emailDone || diagnostic.email) && (
              <p className="text-center text-sm font-medium text-emerald-700">
                Revisá tu correo en los próximos minutos.
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
