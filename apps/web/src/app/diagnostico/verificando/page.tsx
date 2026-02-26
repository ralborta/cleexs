'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { publicDiagnosticApi } from '@/lib/api';
import { CheckCircle2, Circle, Loader2, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function VerificandoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const diagnosticId = searchParams.get('diagnosticId');
  const [diagnostic, setDiagnostic] = useState<Awaited<ReturnType<typeof publicDiagnosticApi.get>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!diagnosticId) return;
    startTimeRef.current = Date.now();

    const timer = setInterval(() => {
      if (startTimeRef.current) {
        setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [diagnosticId]);

  useEffect(() => {
    if (!diagnosticId) return;
    const id = diagnosticId;

    const poll = async () => {
      try {
        const data = await publicDiagnosticApi.get(id);
        setDiagnostic(data);
        if (data.status === 'completed') {
          router.replace(`/ver-resultado?diagnosticId=${id}`);
          return false;
        }
        if (data.status === 'failed') return false;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar el diagnóstico');
        return false;
      }
      return true;
    };

    let cancelled = false;
    const interval = setInterval(async () => {
      if (cancelled) return;
      const keepPolling = await poll();
      if (!keepPolling) clearInterval(interval);
    }, 1500);

    poll();

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [diagnosticId, router]);

  if (!diagnosticId) {
    return (
      <main className="min-h-[calc(100vh-72px)] px-6 py-16">
        <div className="mx-auto max-w-lg text-center">
          <p className="text-muted-foreground">Faltan datos del diagnóstico. Volvé a empezar desde la pantalla anterior.</p>
          <Link href="/diagnostico">
            <Button className="mt-4">Ir al diagnóstico</Button>
          </Link>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-[calc(100vh-72px)] px-6 py-16">
        <div className="mx-auto max-w-lg text-center">
          <p className="text-destructive">{error}</p>
          <Link href="/diagnostico">
            <Button className="mt-4" variant="outline">Volver al diagnóstico</Button>
          </Link>
        </div>
      </main>
    );
  }

  const steps = diagnostic?.steps ?? [];
  const progress = diagnostic?.progressPercent ?? 0;
  const title = diagnostic?.brandName
    ? `${diagnostic.brandName} & competidores`
    : 'Analizando…';
  const isRunning = diagnostic?.status === 'running';

  return (
    <main className="min-h-[calc(100vh-72px)] bg-gradient-to-br from-slate-50 via-white to-blue-50/50 px-6 py-12">
      <div className="mx-auto max-w-xl">
        <Card className="overflow-hidden border-0 bg-white/80 shadow-xl backdrop-blur-sm">
          <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500" />
          <CardHeader className="pb-4 pt-6">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold text-slate-800">Analizando</CardTitle>
                <CardDescription className="text-slate-600">
                  {title}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pb-8">
            {/* Lista de progresión */}
            <ul className="space-y-2">
              {steps.length > 0 ? (
                steps.map((step, idx) => {
                  const isActive = !step.completed && steps.findIndex((s) => !s.completed) === idx;
                  return (
                    <li
                      key={step.id}
                      className={`flex items-center gap-3 rounded-lg px-4 py-3 transition-all duration-300 ${
                        step.completed
                          ? 'bg-emerald-50/80'
                          : isActive
                            ? 'bg-blue-50/80 ring-1 ring-blue-200'
                            : 'bg-slate-50/50'
                      }`}
                    >
                      {step.completed ? (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                          <CheckCircle2 className="h-5 w-5" />
                        </div>
                      ) : (
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                            isActive ? 'bg-blue-500 text-white' : 'border-2 border-slate-200 bg-white'
                          }`}
                        >
                          {isActive ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Circle className="h-4 w-4 text-slate-300" />
                          )}
                        </div>
                      )}
                      <span
                        className={`flex-1 text-sm ${
                          step.completed
                            ? 'font-medium text-emerald-800'
                            : isActive
                              ? 'font-medium text-slate-800'
                              : 'text-slate-500'
                        }`}
                      >
                        {step.label}
                      </span>
                    </li>
                  );
                })
              ) : (
                <li className="flex items-center gap-3 rounded-lg bg-blue-50/80 px-4 py-3">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                  <span className="text-slate-700">Iniciando análisis…</span>
                </li>
              )}
            </ul>

            {/* Barra de progreso */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600">
                  {isRunning ? 'En curso…' : diagnostic?.status === 'completed' ? 'Listo' : 'Preparando…'}
                </span>
                {steps.length > 0 && (
                  <span className="rounded-full bg-blue-100 px-3 py-0.5 text-sm font-semibold text-blue-700">
                    {progress}%
                  </span>
                )}
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-700 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* IA + tiempo transcurrido */}
              <div className="mt-4 flex items-center gap-3 rounded-lg bg-white/80 py-3 px-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 text-white">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Análisis con IA</p>
                  <p className="text-sm font-semibold text-slate-800">
                    Tiempo transcurrido: {formatElapsed(elapsedSeconds)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default function VerificandoPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-[calc(100vh-72px)] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
            <p className="text-sm text-slate-500">Cargando…</p>
          </div>
        </main>
      }
    >
      <VerificandoContent />
    </Suspense>
  );
}
