'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { publicDiagnosticApi, type PublicDiagnostic } from '@/lib/api';
import { Loader2, LogIn, FileCheck, AlertCircle, Mail } from 'lucide-react';

function VerResultadoContent() {
  const searchParams = useSearchParams();
  const diagnosticId = searchParams.get('diagnosticId');
  const [diagnostic, setDiagnostic] = useState<PublicDiagnostic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailSendFailed, setEmailSendFailed] = useState(false);

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

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!diagnosticId || !email.trim()) return;
    setEmailLoading(true);
    try {
      const res = await publicDiagnosticApi.setEmail(diagnosticId, email.trim());
      setEmailSent(true);
      if (res.emailSent === false) setEmailSendFailed(true);
    } catch {
      setEmailSendFailed(true);
    } finally {
      setEmailLoading(false);
    }
  }

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
  const runResult = diagnostic.runResult;

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
              <span className="font-medium">{diagnostic.brandName}</span>
              {diagnostic.industry && ` · ${diagnostic.industry}`}
              {!diagnostic.domain.startsWith('brand-') && ` · ${diagnostic.domain}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isPending && (
              <div className="flex items-center gap-3 rounded-lg border border-primary-200 bg-primary-50 p-4 text-primary-800">
                <Loader2 className="h-5 w-5 animate-spin shrink-0" />
                <p>Tu diagnóstico sigue en proceso. Cuando esté listo podés recargar la página o te enviamos el link por correo si ingresás tu email abajo.</p>
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
                {runResult ? (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">
                      <p className="font-medium">Diagnóstico listo</p>
                      <p className="text-2xl font-bold mt-2">
                        Cleexs Score: {runResult.cleexsScore.toFixed(1)}%
                      </p>
                      <p className="text-sm mt-1">
                        Índice de recomendación de {runResult.brandName}
                      </p>
                    </div>
                    {runResult.promptResults.length > 0 && (
                      <div className="rounded-lg border border-border bg-muted/20 p-4">
                        <p className="text-sm font-medium text-muted-foreground mb-2">Por categoría</p>
                        <ul className="space-y-1">
                          {runResult.promptResults.map((pr, i) => (
                            <li key={i} className="flex justify-between text-sm">
                              <span>{pr.category}</span>
                              <span className="font-medium">{(pr.score * 100).toFixed(0)}%</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">
                    <p className="font-medium">Diagnóstico listo</p>
                    <p className="text-sm mt-1">Cargando detalle del reporte…</p>
                  </div>
                )}

                {/* Email al final del flujo */}
                <div className="pt-4 border-t">
                  <p className="text-sm font-medium text-foreground mb-2">¿Querés recibir el resultado por correo?</p>
                  {emailSent ? (
                    emailSendFailed ? (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
                        <p className="text-sm">Guardamos tu email pero no pudimos enviar el correo. Podés compartir este link para ver el resultado.</p>
                      </div>
                    ) : (
                      <p className="text-sm text-green-700">Te enviamos el link por correo. Revisá tu bandeja (y spam).</p>
                    )
                  ) : (
                    <form onSubmit={handleEmailSubmit} className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="email"
                        placeholder="tu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="flex-1 rounded-md border border-input bg-background px-4 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        disabled={emailLoading}
                      />
                      <Button type="submit" disabled={emailLoading || !email.trim()}>
                        {emailLoading ? 'Enviando…' : <><Mail className="mr-2 h-4 w-4" />Enviar</>}
                      </Button>
                    </form>
                  )}
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
