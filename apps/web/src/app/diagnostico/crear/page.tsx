'use client';

/**
 * Página pública de diagnóstico (entrada para pruebas).
 * URL: /diagnostico/crear o /prueba-gratuita
 * Query desde marketing (cleexs.net) o enlaces directos (app.cleexs.net):
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
import { usePublicFunnelBackToMarketing } from '@/lib/public-funnel-exit';
import { trackPageview } from '@/lib/track';
import { Search, Globe, Loader2 } from 'lucide-react';

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
  const manualParam = searchParams.get('manual');
  const refParam = searchParams.get('ref') ?? searchParams.get('ref_code') ?? '';
  const utmSourceParam = searchParams.get('utm_source') ?? '';
  const utmMediumParam = searchParams.get('utm_medium') ?? '';
  const utmCampaignParam = searchParams.get('utm_campaign') ?? '';
  const serpParam = (searchParams.get('serp') ?? searchParams.get('useSerp') ?? '').trim().toLowerCase();
  const useSerp =
    serpParam === '0' || serpParam === 'false' || serpParam === 'off'
      ? false
      : serpParam === '1' || serpParam === 'true' || serpParam === 'on'
        ? true
        : undefined;
  const tier = tierParam === 'gold' ? ('gold' as const) : undefined;
  const hasAutostartUrl = Boolean(
    (urlParam || '').trim() || ((qParam || '').trim() && looksLikeDomain(qParam || ''))
  );
  const hasAutostartInput = Boolean(
    (urlParam || '').trim() || (brandParam || '').trim() || (qParam || '').trim()
  );
  const autostartExplicit = autostartParam === '1' || autostartParam === 'true';
  // Fallback robusto para WP: si llega input por query, autoinicia salvo que se pida modo manual explícito.
  const autostart = autostartExplicit || (hasAutostartInput && manualParam !== '1');
  const [brandName, setBrandName] = useState('');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoStartRunning, setAutoStartRunning] = useState(false);
  const autoStartTriggered = useRef(false);

  usePublicFunnelBackToMarketing();

  // Pageview para el funnel de conversión interno (anónimo). Una vez por sesión/ruta.
  useEffect(() => {
    trackPageview('/diagnostico/crear', {
      refCode: refParam || undefined,
      utmSource: utmSourceParam || undefined,
      utmMedium: utmMediumParam || undefined,
      utmCampaign: utmCampaignParam || undefined,
    });
  }, [refParam, utmSourceParam, utmMediumParam, utmCampaignParam]);

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
    if (!hasAutostartUrl) return;

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

    if (!nextUrl) {
      setError('Necesitamos la URL de tu sitio (ej. tudominio.com) en el enlace.');
      return;
    }

    autoStartTriggered.current = true;
    setAutoStartRunning(true);
    void startDiagnostic(nextBrand, nextUrl, true);
  }, [autostart, hasAutostartUrl, urlParam, brandParam, qParam, tier]);

  function normalizeUrl(input: string): string {
    const trimmed = input.trim();
    if (!trimmed) return trimmed;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  }

  function normalizeTrackingValue(input: string): string | undefined {
    const cleaned = input.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!cleaned) return undefined;
    return cleaned.slice(0, 120);
  }

  const ATTRIBUTION_STORAGE_KEY = 'cleexs_diagnostic_attribution';

  /** ref/utm desde URL real + respaldo en sessionStorage (useSearchParams a veces llega tarde o se pierde). */
  function getAttributionForCreate(): {
    refCode?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
  } {
    let ref = refParam || '';
    let utmSrc = utmSourceParam;
    let utmMed = utmMediumParam;
    let utmCamp = utmCampaignParam;

    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      ref = sp.get('ref') || sp.get('ref_code') || refParam || '';
      utmSrc = sp.get('utm_source') || utmSourceParam || '';
      utmMed = sp.get('utm_medium') || utmMediumParam || '';
      utmCamp = sp.get('utm_campaign') || utmCampaignParam || '';
      try {
        const raw = sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY);
        if (raw) {
          const j = JSON.parse(raw) as {
            ref?: string;
            utm_source?: string;
            utm_medium?: string;
            utm_campaign?: string;
          };
          if (!ref) ref = j.ref || '';
          if (!utmSrc) utmSrc = j.utm_source || '';
          if (!utmMed) utmMed = j.utm_medium || '';
          if (!utmCamp) utmCamp = j.utm_campaign || '';
        }
      } catch {
        /* ignore */
      }
    }

    return {
      refCode: normalizeTrackingValue(ref),
      utmSource: normalizeTrackingValue(utmSrc),
      utmMedium: normalizeTrackingValue(utmMed),
      utmCampaign: normalizeTrackingValue(utmCamp),
    };
  }

  // Guardar atribución en cuanto exista en la URL (para el POST y por si cambia la ruta).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    const ref = sp.get('ref') || sp.get('ref_code') || '';
    const utm_source = sp.get('utm_source') || '';
    const utm_medium = sp.get('utm_medium') || '';
    const utm_campaign = sp.get('utm_campaign') || '';
    if (ref || utm_source || utm_medium || utm_campaign) {
      try {
        sessionStorage.setItem(
          ATTRIBUTION_STORAGE_KEY,
          JSON.stringify({ ref, utm_source, utm_medium, utm_campaign })
        );
      } catch {
        /* ignore */
      }
    }
  }, [refParam, utmSourceParam, utmMediumParam, utmCampaignParam]);

  async function startDiagnostic(nextBrandName: string, nextUrl: string, fromAutoStart = false) {
    setError(null);
    const trimmedBrand = nextBrandName.trim();
    const trimmedUrl = nextUrl.trim();
    if (!trimmedUrl) {
      setError('Ingresá la URL de tu sitio (obligatorio). La marca es opcional.');
      return;
    }
    setLoading(true);
    try {
      const urlToSend = normalizeUrl(trimmedUrl);
      const attribution = getAttributionForCreate();
      const createPromise = publicDiagnosticApi.create({
        url: urlToSend,
        brandName: trimmedBrand || undefined,
        tier,
        useSerp,
        tracking: attribution,
      });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT_DIAGNOSTIC_CREATE')), 25000)
      );
      const { diagnosticId } = await Promise.race([createPromise, timeoutPromise]);
      router.push(`/diagnostico/verificando?diagnosticId=${diagnosticId}${tier ? `&tier=${tier}` : ''}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setError(
        msg === 'TIMEOUT_DIAGNOSTIC_CREATE'
          ? 'El servicio está tardando más de lo esperado. Probá de nuevo en unos segundos.'
          : msg === 'Not Found' || msg.includes('404')
          ? 'No se pudo conectar con el servicio. Probá de nuevo en unos minutos.'
          : msg || 'Esta URL ya tiene un diagnóstico. Revisá tu correo o probá otra.'
      );
      setLoading(false);
      if (fromAutoStart) setAutoStartRunning(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await startDiagnostic(brandName, url);
  }

  useEffect(() => {
    if (!(autostart && hasAutostartUrl && (autoStartRunning || loading))) return;
    const watchdog = setTimeout(() => {
      setLoading(false);
      setAutoStartRunning(false);
      setError('El inicio automático tardó demasiado. Podés continuar manualmente.');
    }, 30000);
    return () => clearTimeout(watchdog);
  }, [autostart, hasAutostartUrl, autoStartRunning, loading]);

  function cancelAutostart() {
    setLoading(false);
    setAutoStartRunning(false);
    setError('Inicio automático cancelado. Podés continuar manualmente.');
  }

  if (autostart && hasAutostartUrl && !error && (autoStartRunning || loading)) {
    return (
      <main className="min-h-[calc(100vh-72px)] bg-slate-100 px-6 py-16">
        <div className="mx-auto max-w-lg">
          <Card className="border border-slate-200/80 bg-white shadow-lg shadow-slate-200/50">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-2xl">Iniciando diagnóstico</CardTitle>
              <CardDescription>
                Estamos preparando tu corrida y en breve te llevamos a la pantalla de verificación.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 py-8">
              <div className="flex items-center justify-center">
                <div className="inline-flex items-center gap-2 text-sm text-slate-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Procesando datos...
                </div>
              </div>
              <div className="flex justify-center">
                <Button type="button" variant="outline" onClick={cancelAutostart}>
                  Cancelar y continuar manualmente
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-72px)] bg-slate-100 px-6 py-16">
      <div className="mx-auto max-w-lg">
        <Card className="border border-slate-200/80 bg-white shadow-lg shadow-slate-200/50">
          <CardHeader className="pb-2 text-center">
            <CardTitle className="text-2xl font-bold text-slate-900">Diagnóstico de recomendación</CardTitle>
            <CardDescription className="text-base leading-relaxed text-slate-600">
              Ingresá la URL de tu sitio y te mostramos cómo aparecés recomendado en ChatGPT y otros motores de IA.
              Confirmás correo y competidores antes de arrancar el análisis completo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="url" className="flex items-center gap-2 text-sm font-medium text-foreground mb-1">
                  <Globe className="h-4 w-4 text-primary-600 shrink-0" aria-hidden />
                  URL de tu sitio
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
                className="w-full bg-primary-600 text-white shadow-sm hover:bg-primary-700"
                disabled={loading || !url.trim()}
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
