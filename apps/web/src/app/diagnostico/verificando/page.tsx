'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { publicDiagnosticApi } from '@/lib/api';
import { Check } from 'lucide-react';
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
      <main className="min-h-[calc(100vh-72px)] flex items-center justify-center px-6">
        <div className="text-center space-y-4">
          <p className="text-sm text-slate-500">Faltan datos del diagnóstico. Volvé a empezar.</p>
          <Link href="/diagnostico">
            <Button variant="outline" size="sm">Volver al diagnóstico</Button>
          </Link>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-[calc(100vh-72px)] flex items-center justify-center px-6">
        <div className="text-center space-y-4">
          <p className="text-sm text-destructive">{error}</p>
          <Link href="/diagnostico">
            <Button variant="outline" size="sm">Volver al diagnóstico</Button>
          </Link>
        </div>
      </main>
    );
  }

  const steps = diagnostic?.steps ?? [];
  const progress = diagnostic?.progressPercent ?? 0;
  const brandLabel = diagnostic?.brandName ? diagnostic.brandName : null;
  const isRunning = diagnostic?.status === 'running';

  return (
    <main className="min-h-[calc(100vh-72px)] bg-slate-50 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary-600 mb-2">
            Análisis en curso
          </p>
          <h1 className="text-2xl font-bold text-slate-900">
            {brandLabel ? brandLabel : 'Procesando diagnóstico'}
          </h1>
          {brandLabel && (
            <p className="mt-1 text-sm text-slate-500">Comparando con competidores en tiempo real</p>
          )}
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

          {/* Progress bar top */}
          <div className="h-0.5 w-full bg-slate-100">
            <div
              className="h-full bg-primary-600 transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="p-6 space-y-5">

            {/* Steps */}
            <ul className="space-y-1">
              {steps.length > 0 ? (
                steps.map((step, idx) => {
                  const isActive = !step.completed && steps.findIndex((s) => !s.completed) === idx;
                  const isPending = !step.completed && !isActive;

                  return (
                    <li key={step.id} className="flex items-center gap-4 py-2.5">
                      {/* Step indicator */}
                      <div className="shrink-0 relative flex h-7 w-7 items-center justify-center">
                        {step.completed ? (
                          <div className="h-7 w-7 rounded-full bg-primary-600 flex items-center justify-center">
                            <Check className="h-3.5 w-3.5 text-white stroke-[2.5]" />
                          </div>
                        ) : isActive ? (
                          <>
                            <div className="absolute h-7 w-7 rounded-full bg-primary-100 animate-ping opacity-60" />
                            <div className="h-7 w-7 rounded-full border-2 border-primary-600 bg-white flex items-center justify-center">
                              <div className="h-2 w-2 rounded-full bg-primary-600" />
                            </div>
                          </>
                        ) : (
                          <div className="h-7 w-7 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center">
                            <span className="text-xs font-medium text-slate-400">{idx + 1}</span>
                          </div>
                        )}
                      </div>

                      {/* Label */}
                      <span
                        className={`text-sm leading-snug ${
                          step.completed
                            ? 'text-slate-400 line-through'
                            : isActive
                              ? 'font-semibold text-slate-900'
                              : 'text-slate-400'
                        }`}
                      >
                        {step.label}
                      </span>
                    </li>
                  );
                })
              ) : (
                <li className="flex items-center gap-4 py-2.5">
                  <div className="relative flex h-7 w-7 items-center justify-center shrink-0">
                    <div className="absolute h-7 w-7 rounded-full bg-primary-100 animate-ping opacity-60" />
                    <div className="h-7 w-7 rounded-full border-2 border-primary-600 bg-white flex items-center justify-center">
                      <div className="h-2 w-2 rounded-full bg-primary-600" />
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-slate-900">Iniciando análisis…</span>
                </li>
              )}
            </ul>

            {/* Divider */}
            <div className="border-t border-slate-100" />

            {/* Footer: status + elapsed */}
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>
                {isRunning ? 'Procesando' : diagnostic?.status === 'completed' ? 'Completado' : 'Preparando'}
              </span>
              <div className="flex items-center gap-3">
                {steps.length > 0 && (
                  <span className="font-semibold text-slate-600">{progress}%</span>
                )}
                <span>{formatElapsed(elapsedSeconds)}</span>
              </div>
            </div>

          </div>
        </div>

        {/* Disclaimer */}
        <p className="mt-5 text-center text-xs text-slate-400">
          El análisis puede demorar entre 30 y 90 segundos.
        </p>

      </div>
    </main>
  );
}

export default function VerificandoPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-[calc(100vh-72px)] flex items-center justify-center">
          <div className="relative flex h-8 w-8 items-center justify-center">
            <div className="absolute h-8 w-8 rounded-full bg-primary-100 animate-ping opacity-60" />
            <div className="h-4 w-4 rounded-full bg-primary-600" />
          </div>
        </main>
      }
    >
      <VerificandoContent />
    </Suspense>
  );
}
