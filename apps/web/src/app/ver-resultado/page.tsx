'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { publicDiagnosticApi, type PublicDiagnostic } from '@/lib/api';
import { Loader2, LogIn, FileCheck, AlertCircle } from 'lucide-react';

function VerResultadoContent() {
  const searchParams = useSearchParams();
  const diagnosticId = searchParams.get('diagnosticId');
  const [diagnostic, setDiagnostic] = useState<PublicDiagnostic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = searchParams.get('diagnosticId');
    if (!id) {
      setLoading(false);
      setError('Falta el ID del diagnóstico.');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await publicDiagnosticApi.get(id);
        if (!cancelled) setDiagnostic(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudo cargar el diagnóstico.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [diagnosticId, searchParams]);

  if (loading) {
    return (
      <main className="min-h-[calc(100vh-72px)] flex items-center justify-center px-6">
        <div className="text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary-600" />
          <p className="mt-4 text-muted-foreground">Cargando resultado…</p>
        </div>
      </main>
    );
  }

  if (error || !diagnostic) {
    return (
      <main className="min-h-[calc(100vh-72px)] px-6 py-16">
        <div className="mx-auto max-w-lg text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
          <p className="mt-4 text-muted-foreground">{error || 'Diagnóstico no encontrado.'}</p>
          <Link href="/diagnostico">
            <Button className="mt-4">Hacer un nuevo diagnóstico</Button>
          </Link>
        </div>
      </main>
    );
  }

  const isCompleted = diagnostic.status === 'completed';
  const isPending = diagnostic.status === 'pending' || diagnostic.status === 'running';
  const isFailed = diagnostic.status === 'failed';

  return (
    <main className="min-h-[calc(100vh-72px)] bg-gradient-to-br from-background via-white to-primary-50 px-6 py-16">
      <div className="mx-auto max-w-2xl space-y-6">
        <Card className="border-transparent bg-white shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="h-6 w-6 text-primary-600" />
              Resultado del diagnóstico
            </CardTitle>
            <CardDescription>
              Dominio: <strong>{diagnostic.domain}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isPending && (
              <div className="flex items-center gap-3 rounded-lg border border-primary-200 bg-primary-50 p-4 text-primary-800">
                <Loader2 className="h-5 w-5 animate-spin shrink-0" />
                <p>Tu diagnóstico sigue en proceso. Revisá tu correo: te enviamos el link cuando esté listo.</p>
              </div>
            )}

            {isFailed && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive">
                <p>El análisis no pudo completarse. Podés intentar de nuevo con un nuevo diagnóstico.</p>
                <Link href="/diagnostico">
                  <Button variant="outline" className="mt-3">Nuevo diagnóstico</Button>
                </Link>
              </div>
            )}

            {isCompleted && (
              <>
                <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">
                  <p className="font-medium">Diagnóstico listo</p>
                  <p className="text-sm mt-1">
                    Aquí podrás ver el reporte completo cuando integremos la medición real. Por ahora este es un placeholder.
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-6 text-center text-muted-foreground">
                  <p className="text-sm">Reporte PRIA (próximamente)</p>
                  <p className="text-xs mt-2">runId: {diagnostic.runId ?? '—'}</p>
                </div>
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-3">
                    Creá una cuenta o iniciá sesión para guardar resultados y hacer más análisis.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Link href="/dashboard">
                      <Button>
                        <LogIn className="mr-2 h-4 w-4" />
                        Ir al dashboard
                      </Button>
                    </Link>
                    <Link href="/diagnostico">
                      <Button variant="outline">Otro diagnóstico</Button>
                    </Link>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default function VerResultadoPage() {
  return (
    <Suspense fallback={
      <main className="min-h-[calc(100vh-72px)] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </main>
    }>
      <VerResultadoContent />
    </Suspense>
  );
}
