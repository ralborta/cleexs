'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { publicDiagnosticApi } from '@/lib/api';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

function VerificandoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const diagnosticId = searchParams.get('diagnosticId');
  const [diagnostic, setDiagnostic] = useState<Awaited<ReturnType<typeof publicDiagnosticApi.get>> | null>(null);
  const [error, setError] = useState<string | null>(null);

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
            <button className="mt-4 rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90">
              Ir al diagnóstico
            </button>
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
            <button className="mt-4 rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90">
              Volver al diagnóstico
            </button>
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

  return (
    <main className="min-h-[calc(100vh-72px)] bg-gradient-to-br from-background via-white to-primary-50 px-6 py-16">
      <div className="mx-auto max-w-xl">
        <Card className="border-transparent bg-white shadow-md">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl">Analizando</CardTitle>
            <CardDescription>
              {title}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Lista de progresión (estilo costado izquierdo) */}
            <ul className="space-y-3">
              {steps.length > 0 ? (
                steps.map((step) => (
                  <li key={step.id} className="flex items-center gap-3">
                    {step.completed ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                    ) : (
                      <Circle className="h-5 w-5 shrink-0 text-muted-300" />
                    )}
                    <span className={step.completed ? 'text-foreground' : 'text-muted-foreground'}>
                      {step.label}
                    </span>
                    {!step.completed && steps.some((s) => !s.completed) && steps.indexOf(step) === steps.findIndex((s) => !s.completed) && (
                      <Loader2 className="ml-auto h-4 w-4 animate-spin text-primary-600" />
                    )}
                  </li>
                ))
              ) : (
                <li className="flex items-center gap-3 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin text-primary-600" />
                  <span>Iniciando análisis…</span>
                </li>
              )}
            </ul>

            {/* Barra inferior progresiva */}
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {diagnostic?.status === 'running' ? 'En curso…' : diagnostic?.status === 'completed' ? 'Listo' : 'Preparando…'}
                </span>
                {steps.length > 0 && (
                  <span className="font-medium">{progress}%</span>
                )}
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
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
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </main>
      }
    >
      <VerificandoContent />
    </Suspense>
  );
}
