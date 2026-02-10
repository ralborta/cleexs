'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { publicDiagnosticApi } from '@/lib/api';
import { Search } from 'lucide-react';

export default function DiagnosticoPage() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = url.trim();
    if (!trimmed) {
      setError('Ingresá una URL');
      return;
    }
    setLoading(true);
    try {
      const { diagnosticId } = await publicDiagnosticApi.create(trimmed);
      router.push(`/diagnostico/verificando?diagnosticId=${diagnosticId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Esta URL ya tiene un diagnóstico. Revisá tu correo o probá otra.');
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
              Ingresá la URL de tu sitio o dominio. Te mostramos cómo aparece recomendado y te enviamos el resultado por correo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="url" className="sr-only">
                  URL o dominio
                </label>
                <input
                  id="url"
                  type="url"
                  placeholder="https://tudominio.com"
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
                  'Verificando…'
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Ver diagnóstico
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
