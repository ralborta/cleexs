'use client';

import { Coffee, ExternalLink, Loader2, MessageCircle, Play, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function OnboardingPreviewCafecito({
  userName,
  domain,
  brandLabel,
  founderPhotoUrl,
  youtubeVideoId,
  whatsappHref,
  reportReady,
  reportHref,
}: {
  userName: string;
  domain: string;
  brandLabel?: string;
  founderPhotoUrl?: string;
  youtubeVideoId?: string;
  whatsappHref: string;
  reportReady: boolean;
  reportHref: string;
}) {
  const embedId = youtubeVideoId?.trim();
  const showEmbed = embedId && embedId !== 'off';
  const waMessage = `Hola Gonzalo, soy ${userName} de ${domain}. Te escribo porque quiero contarte por qué hice el análisis de Cleexs…`;

  return (
    <div className="m-auto w-full max-w-2xl">
      <div className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-xl shadow-slate-200/50">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-violet-600 via-violet-700 to-indigo-800 px-6 py-8 text-white sm:px-8">
          <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-12 left-1/4 h-32 w-32 rounded-full bg-indigo-400/20 blur-2xl" />
          <div className="relative flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur-sm">
              <Coffee className="h-7 w-7" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold leading-tight sm:text-2xl">
                Un cafecito mientras terminamos ☕
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-violet-100/95">
                Te hice un videíto para contarte por qué armé Cleexs y qué me gustaría que sepas
                antes de ver tu diagnóstico{brandLabel ? ` de ${brandLabel}` : ''}.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6 p-5 sm:p-7">
          {/* Video */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-inner">
            {!showEmbed ? (
              <div className="relative flex aspect-video flex-col items-center justify-center gap-4 bg-gradient-to-br from-slate-900 via-slate-900 to-violet-950 p-8 text-center">
                <div className="absolute inset-0 opacity-30">
                  <div className="absolute left-1/4 top-1/4 h-32 w-32 rounded-full bg-violet-500/40 blur-3xl" />
                  <div className="absolute bottom-1/4 right-1/4 h-24 w-24 rounded-full bg-indigo-400/30 blur-2xl" />
                </div>
                <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20 backdrop-blur-sm">
                  <Play className="ml-1 h-7 w-7 text-white/90" fill="currentColor" />
                </div>
                <div className="relative max-w-sm">
                  <p className="text-sm font-semibold text-white">Video de Gonzalo</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    Acá va el embed de YouTube cuando esté grabado. Mientras tanto, podés seguir
                    abajo por WhatsApp.
                  </p>
                </div>
              </div>
            ) : (
              <iframe
                title="Video fundador Cleexs"
                className="aspect-video w-full"
                src={`https://www.youtube.com/embed/${embedId}?rel=0`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            )}
          </div>

          {/* WhatsApp block */}
          <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-white p-5 sm:p-6">
            <div className="flex items-start gap-3">
              {founderPhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={founderPhotoUrl}
                  alt=""
                  className="h-11 w-11 shrink-0 rounded-full border-2 border-white object-cover shadow-md"
                />
              ) : (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-700">
                  GA
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">Seguimos la charla por WhatsApp</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Me encantaría escuchar qué te motiva a hacer el análisis de Cleexs mientras
                  armamos tu informe.
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Tu mensaje
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">{waMessage}</p>
            </div>

            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#25D366] px-4 py-3.5 text-sm font-semibold text-white shadow-md shadow-emerald-600/20 transition hover:bg-[#20bd5a] active:scale-[0.99]"
            >
              <MessageCircle className="h-5 w-5" />
              Enviar por WhatsApp
            </a>
          </div>

          {/* Report CTA */}
          <div
            className={cn(
              'rounded-2xl border p-5 text-center transition-all sm:p-6',
              reportReady
                ? 'border-primary-200 bg-gradient-to-b from-primary-50 to-white'
                : 'border-slate-200 bg-slate-50/80'
            )}
          >
            {!reportReady ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-violet-600" aria-hidden />
                <p className="text-sm font-medium text-slate-700">Armando tu diagnóstico…</p>
                <p className="max-w-xs text-xs text-slate-500">
                  Podés ver el video o escribirme por WhatsApp. Te avisamos acá cuando esté listo.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                  <Sparkles className="h-3.5 w-3.5" />
                  Informe listo
                </span>
                <p className="text-sm text-slate-600">Se abre en una pestaña nueva — no corta el video.</p>
              </div>
            )}

            <Button
              type="button"
              size="lg"
              disabled={!reportReady}
              className={cn(
                'mt-4 min-w-[240px] shadow-md transition-all',
                reportReady && 'shadow-primary-600/25'
              )}
              onClick={() => {
                if (reportReady) window.open(reportHref, '_blank', 'noopener,noreferrer');
              }}
            >
              Ver mi diagnóstico
              {reportReady ? <ExternalLink className="ml-2 h-4 w-4" /> : null}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
