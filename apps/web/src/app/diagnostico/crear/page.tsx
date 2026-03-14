'use client';

/**
 * Página pública de diagnóstico (entrada para pruebas).
 * URL: /diagnostico/crear o /prueba-gratuita
 * Query desde WP (cleexs.net):
 *   ?url=dominio.com   → prefill URL
 *   ?brand=NombreMarca → prefill marca
 *   ?q=valor           → si parece dominio (ej. tiene punto) prefill URL, sino prefill marca
 * No requiere login; el middleware mantiene esta ruta como pública.
 */
import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { publicDiagnosticApi } from '@/lib/api';
import { Search, Tag, Globe } from 'lucide-react';

/** Si parece dominio (tiene punto, sin espacios) → true */
function looksLikeDomain(value: string): boolean {
  const v = value.trim();
  if (!v || /\s/.test(v)) return false;
  return v.includes('.');
}

export default function CrearDiagnosticoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlParam = searchParams.get('url') ?? '';
  const brandParam = searchParams.get('brand') || searchParams.get('marca') || '';
  const qParam = searchParams.get('q') ?? '';
  const tierParam = searchParams.get('tier');
  const autostartParam = searchParams.get('autostart');
  const tier = tierParam === 'gold' ? 'gold' as const : undefined;
  const autostart = autostartParam === '1' || autostartParam === 'true';
  const [brandName, setBrandName] = useState('');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoStartTriggered = useRef(false);

  // Prefill cuando vienen desde WP (Checkear visibilidad): ?url=, ?brand= o ?q=
  useEffect(() => {
    const u = (urlParam || '').trim();
    const b = (brandParam || '').trim();
    const q = (qParam || '').trim();
    if (u) setUrl(u);
    if (b) setBrandName(b);
    if (q && !u && !b) {
      if (looksLikeDomain(q)) setUrl(q);
      else setBrandName(q);
    }
  }, [urlParam, brandParam, qParam]);

  // Modo WP: /diagnostico/crear?autostart=1&q=pepsi.com
  // Crea diagnóstico automáticamente y pasa directo a la pantalla de checks.
  useEffect(() => {
    if (!autostart || autoStartTriggered.current) return;

    const u = (urlParam || '').trim();
    const b = (brandParam || '').trim();
    const q = (qParam || '').trim();

    let nextUrl = '';
    let nextBrand = '';

    if (u) nextUrl = u;
    if (b) nextBrand = b;
    if (q && !u && !b) {
      if (looksLikeDomain(q)) nextUrl = q;
      else nextBrand = q;
    }

    if (!nextUrl && !nextBrand) return;

    autoStartTriggered.current = true;
    void startDiagnostic(nextBrand, nextUrl);
  }, [autostart, urlParam, brandParam, qParam, tier]);

  function normalizeUrl(input: string): string {
    const trimmed = input.trim();
    if (!trimmed) return trimmed;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  }

  async function startDiagnostic(nextBrandName: string, nextUrl: string) {
    setError(null);
    const trimmedBrand = nextBrandName.trim();
    const trimmedUrl = nextUrl.trim();
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await startDiagnostic(brandName, url);
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
