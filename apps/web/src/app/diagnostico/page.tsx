'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { publicDiagnosticApi } from '@/lib/api';
import { Search } from 'lucide-react';

export default function DiagnosticoPage() {
  const router = useRouter();
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
    if (!trimmedBrand) {
      setError('Ingresá el nombre de tu marca');
      return;
    }
    if (!trimmedUrl) {
      setError('Ingresá la URL de tu sitio o dominio');
      return;
    }
    setLoading(true);
    try {
      const urlToSend = normalizeUrl(trimmedUrl);
      const { diagnosticId } = await publicDiagnosticApi.create(trimmedBrand, urlToSend);
      router.push(`/diagnostico/verificando?diagnosticId=${diagnosticId}`);
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
              Ingresá tu marca y la URL de tu sitio. Analizamos cómo aparece recomendado y te mostramos el resultado.
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
                  URL de tu sitio
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
