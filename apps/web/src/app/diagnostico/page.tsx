'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { publicDiagnosticApi } from '@/lib/api';
import { ArrowRight } from 'lucide-react';

export default function DiagnosticoPage() {
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
    if (!trimmedBrand) {
      setError('Ingresá el nombre de tu marca');
      return;
    }
    setLoading(true);
    try {
      const trimmedUrl = url.trim();
      const urlToSend = trimmedUrl ? normalizeUrl(trimmedUrl) : undefined;
      const { diagnosticId } = await publicDiagnosticApi.create(trimmedBrand, urlToSend, tier);
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
    <main className="min-h-[calc(100vh-72px)] bg-slate-50 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary-600 mb-2">
            Diagnóstico gratuito
          </p>
          <h1 className="text-2xl font-bold text-slate-900">Analizá tu marca</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Determinamos tu industria, competidores y Cleexs Score. Sin registro.
          </p>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">

            <div className="space-y-1.5">
              <label htmlFor="brand" className="block text-sm font-medium text-slate-700">
                Nombre de marca
              </label>
              <input
                id="brand"
                type="text"
                placeholder="Ej: Argento's Italian Bistro"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100 transition-colors"
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="url" className="block text-sm font-medium text-slate-700">
                Sitio web{' '}
                <span className="font-normal text-slate-400">(opcional)</span>
              </label>
              <input
                id="url"
                type="text"
                inputMode="url"
                placeholder="tudominio.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100 transition-colors"
                disabled={loading}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive" role="alert">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full bg-primary-600 hover:bg-primary-700 text-white"
              disabled={loading}
            >
              {loading ? (
                'Iniciando…'
              ) : (
                <>
                  Iniciar diagnóstico
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          Gratis · Sin registro · Resultado por email
        </p>

      </div>
    </main>
  );
}
