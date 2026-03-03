'use client';

/**
 * Página pública de diagnóstico (entrada para pruebas).
 * URL: /diagnostico/crear o /prueba-gratuita
 * No requiere login; el middleware mantiene esta ruta como pública.
 */
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { publicDiagnosticApi } from '@/lib/api';
import { Search, Tag, Globe } from 'lucide-react';

export default function CrearDiagnosticoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tierParam = searchParams.get('tier');
  const tier = tierParam === 'gold' ? 'gold' as const : undefined;
  const [brandName, setBrandName] = useState('');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    const trimmedUrl = url.trim();
    if (!trimmedBrand && !trimmedUrl) {
      setError('Ingresá la marca o la URL de tu sitio (al menos uno).');
      return;
    }
    setLoading(true);
    try {
      const urlToSend = trimmedUrl ? normalizeUrl(trimmedUrl) : undefined;
      const { diagnosticId } = await publicDiagnosticApi.create(trimmedBrand || undefined, urlToSend, tier);
      router.push(`/diagnostico/verificando?diagnosticId=${diagnosticId}${tier ? `&tier=${tier}` : ''}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setError(
        msg === 'Not Found' || msg.includes('404')
          ? 'No se pudo conectar con el servicio. Probá de nuevo en unos minutos.'
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
              Ingresá tu marca o la URL de tu sitio (o ambos). Determinamos tu industria, competidores y generamos tu Cleexs Score.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="brand" className="flex items-center gap-2 text-sm font-medium text-foreground mb-1">
                  <Tag className="h-4 w-4 text-primary-600 shrink-0" aria-hidden />
                  Marca
                </label>
                <div className="relative">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden />
                  <input
                    id="brand"
                    type="text"
                    placeholder="Ej: Argento's Italian Bistro"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    className="w-full rounded-md border border-input bg-background pl-10 pr-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    disabled={loading}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="url" className="flex items-center gap-2 text-sm font-medium text-foreground mb-1">
                  <Globe className="h-4 w-4 text-primary-600 shrink-0" aria-hidden />
                  URL de tu sitio <span className="text-muted-foreground font-normal">(opcional)</span>
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden />
                  <input
                    id="url"
                    type="text"
                    inputMode="url"
                    placeholder="tudominio.com o https://tudominio.com"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="w-full rounded-md border border-input bg-background pl-10 pr-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    disabled={loading}
                  />
                </div>
              </div>
              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={loading || (!brandName.trim() && !url.trim())}
              >
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
