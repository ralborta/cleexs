'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { publicDiagnosticApi } from '@/lib/api';
import { CheckCircle2, Circle, Loader2, Mail } from 'lucide-react';
import Link from 'next/link';

const STEPS = [
  { id: 'domain', label: 'Verificando dominio' },
  { id: 'index', label: 'Analizando índice de recomendación' },
  { id: 'report', label: 'Generando reporte' },
];

function VerificandoContent() {
  const searchParams = useSearchParams();
  const diagnosticId = searchParams.get('diagnosticId');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [emailSendFailed, setEmailSendFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Ingresá tu correo');
      return;
    }
    const id = searchParams.get('diagnosticId');
    if (!id) return;
    setLoading(true);
    setEmailSendFailed(false);
    try {
      const res = await publicDiagnosticApi.setEmail(id, trimmed);
      setSent(true);
      if (res.emailSent === false) setEmailSendFailed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos guardar el correo. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-[calc(100vh-72px)] bg-gradient-to-br from-background via-white to-primary-50 px-6 py-16">
      <div className="mx-auto max-w-lg space-y-6">
        <Card className="border-transparent bg-white shadow-md">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl">Estamos verificando</CardTitle>
            <CardDescription>
              En unos segundos tendremos tu diagnóstico. Dejanos tu correo y te enviamos el link cuando esté listo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ul className="space-y-3">
              {STEPS.map((step, i) => (
                <li key={step.id} className="flex items-center gap-3 text-muted-foreground">
                  {i < 2 ? (
                    <Loader2 className="h-5 w-5 animate-spin text-primary-600" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                  <span>{step.label}</span>
                  {i < 2 && <CheckCircle2 className="ml-auto h-5 w-5 text-green-600" />}
                </li>
              ))}
            </ul>

            {sent ? (
              <>
                {emailSendFailed ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center text-amber-800">
                    <p className="font-medium">Correo no enviado</p>
                    <p className="text-sm mt-1">
                      Guardamos tu email pero no pudimos enviar el correo (revisá la configuración SMTP del servicio). Podés ir directo al resultado con el link que te mostramos abajo.
                    </p>
                    <Link href={`/ver-resultado?diagnosticId=${diagnosticId}`}>
                      <Button variant="outline" className="mt-3">Ver resultado</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center text-green-800">
                    <p className="font-medium">Listo</p>
                    <p className="text-sm mt-1">
                      Te enviamos un correo con el link a tu resultado. Revisá tu bandeja (y spam) y hacé clic en el enlace cuando esté listo.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">
                    Correo electrónico
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    disabled={loading}
                  />
                </div>
                {error && (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                )}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Enviando…' : <><Mail className="mr-2 h-4 w-4" />Enviar</>}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default function VerificandoPage() {
  return (
    <Suspense fallback={
      <main className="min-h-[calc(100vh-72px)] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </main>
    }>
      <VerificandoContent />
    </Suspense>
  );
}
