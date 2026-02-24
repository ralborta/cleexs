'use client';

import { useState, useLayoutEffect } from 'react';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { publicDiagnosticApi } from '@/lib/api';
import { Search } from 'lucide-react';

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export default function DiagnosticoPage() {
  const router = useRouter();
  const [brandName, setBrandName] = useState('');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileError, setTurnstileError] = useState<string | null>(null);

  useLayoutEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    (window as Window & { __onTurnstileSuccess?: (token: string) => void }).__onTurnstileSuccess = (token: string) => {
      setTurnstileToken(token);
      setError(null);
      setTurnstileError(null);
    };
    (window as Window & { __onTurnstileExpire?: () => void }).__onTurnstileExpire = () => {
      setTurnstileToken(null);
    };
    (window as Window & { __onTurnstileError?: (errorCode?: string | number) => void }).__onTurnstileError = (errorCode?: string | number) => {
      setTurnstileToken(null);
      const code = String(errorCode ?? '');
      if (code.includes('110200')) {
        setTurnstileError('Dominio no autorizado. Agregalo en Cloudflare Dashboard → Turnstile → tu widget → Hostname Management.');
      } else {
        setTurnstileError('La verificación no pudo cargar. Probá en otra red o desactivá extensiones/bloqueadores.');
      }
    };
    return () => {
      delete (window as Window & { __onTurnstileSuccess?: (token: string) => void }).__onTurnstileSuccess;
      delete (window as Window & { __onTurnstileExpire?: () => void }).__onTurnstileExpire;
      delete (window as Window & { __onTurnstileError?: (errorCode?: string | number) => void }).__onTurnstileError;
    };
  }, []);

  function normalizeUrl(input: string): string {
    const trimmed = input.trim();
    if (!trimmed) return trimmed;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmedBrand = brandName.trim();
    if (!trimmedBrand) {
      setError('Ingresá el nombre de tu marca');
      return;
    }
    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setError(turnstileError || 'Completá la verificación de seguridad antes de continuar.');
      return;
    }
    setLoading(true);
    try {
      const trimmedUrl = url.trim();
      const urlToSend = trimmedUrl ? normalizeUrl(trimmedUrl) : undefined;
      const { diagnosticId } = await publicDiagnosticApi.create(trimmedBrand, urlToSend, turnstileToken ?? undefined);
      router.push(`/diagnostico/verificando?diagnosticId=${diagnosticId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      const code = (err as Error & { code?: string }).code;
      const isCaptchaError = code === 'CAPTCHA_FAILED' || code === 'CAPTCHA_MISSING' || msg.includes('verificación de seguridad') || msg.includes('captcha');
      if (isCaptchaError) {
        setTurnstileToken(null);
        try {
          (window as Window & { turnstile?: { reset: (id?: string) => void } }).turnstile?.reset?.('turnstile-widget');
        } catch {
          /* widget might not be ready */
        }
      }
      setError(
        msg === 'Not Found' || msg.includes('404')
          ? 'No se pudo conectar con el servicio. Probá de nuevo en unos minutos.'
          : isCaptchaError
            ? 'La verificación de seguridad falló. Completá el captcha de nuevo e intentá.'
            : msg || 'Esta URL ya tiene un diagnóstico. Revisá tu correo o probá otra.'
      );
      setLoading(false);
    }
  }

  return (
    <main className="min-h-[calc(100vh-72px)] bg-gradient-to-br from-background via-white to-primary-50 px-6 py-16">
      <div className="mx-auto max-w-lg">
        <Card className="border-transparent bg-white shadow-md">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl">Diagnóstico de recomendación</CardTitle>
            <CardDescription>
              Ingresá tu marca (la URL es opcional). Determinamos tu industria, competidores y generamos tu Cleexs Score.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="brand" className="block text-sm font-medium text-foreground mb-1">
                  Marca
                </label>
                <input
                  id="brand"
                  type="text"
                  placeholder="Ej: Argento's Italian Bistro"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  disabled={loading}
                />
              </div>
              <div>
                <label htmlFor="url" className="block text-sm font-medium text-foreground mb-1">
                  URL de tu sitio <span className="text-muted-foreground font-normal">(opcional)</span>
                </label>
                <input
                  id="url"
                  type="text"
                  inputMode="url"
                  placeholder="tudominio.com o https://tudominio.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  disabled={loading}
                />
              </div>
              {TURNSTILE_SITE_KEY && (
                <>
                  <Script
                    src="https://challenges.cloudflare.com/turnstile/v0/api.js"
                    strategy="afterInteractive"
                  />
                  <div className="flex justify-center min-h-[65px]">
                    <div
                      id="turnstile-widget"
                      className="cf-turnstile"
                      data-sitekey={TURNSTILE_SITE_KEY}
                      data-theme="light"
                      data-size="normal"
                      data-callback="__onTurnstileSuccess"
                      data-expired-callback="__onTurnstileExpire"
                      data-error-callback="__onTurnstileError"
                    />
                  </div>
                  {turnstileError && (
                    <p className="text-sm text-amber-600 bg-amber-50 rounded-md px-3 py-2">
                      {turnstileError}
                    </p>
                  )}
                </>
              )}
              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  'Iniciando…'
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Iniciar diagnóstico
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
