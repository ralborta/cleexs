'use client';

import { Coffee, ExternalLink, MessageCircle, Play, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { youtubeEmbedUrl } from '@/lib/youtube';

export function OnboardingPreviewCafecito({
  userName,
  domain,
  brandLabel,
  founderPhotoUrl,
  youtubeVideoId,
  whatsappHref,
  reportReady,
  reportProgress,
  reportHref,
}: {
  userName: string;
  domain: string;
  brandLabel?: string;
  founderPhotoUrl?: string;
  youtubeVideoId?: string;
  whatsappHref: string;
  reportReady: boolean;
  reportProgress: number;
  reportHref: string;
}) {
  const embedId = youtubeVideoId?.trim();
  const showEmbed = embedId && embedId !== 'off';
  const waMessage = `Hola Gonzalo, soy ${userName} de ${domain}. Te escribo porque quiero contarte por qué hice el análisis de Cleexs…`;
  const progress = reportReady ? 100 : reportProgress;

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-lg shadow-slate-200/40">
        <div className="bg-gradient-to-r from-violet-600 to-indigo-700 px-6 py-5 text-white sm:px-8">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
              <Coffee className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-lg font-bold sm:text-xl">Un cafecito mientras terminamos ☕</h1>
              <p className="mt-0.5 text-sm text-violet-100/90">
                Videíto de Gonzalo antes de ver tu diagnóstico
                {brandLabel ? ` de ${brandLabel}` : ''}.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[1.15fr,0.85fr]">
          <div className="border-b border-slate-100 p-5 sm:p-6 lg:border-b-0 lg:border-r">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950 shadow-inner">
              {!showEmbed ? (
                <div className="relative flex aspect-video flex-col items-center justify-center gap-3 bg-gradient-to-br from-slate-900 via-slate-900 to-violet-950 p-6 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
                    <Play className="ml-0.5 h-6 w-6 text-white" fill="currentColor" />
                  </div>
                  <p className="text-sm font-semibold text-white">Video de Gonzalo</p>
                </div>
              ) : (
                <iframe
                  title="Video fundador Cleexs"
                  className="aspect-video w-full"
                  src={youtubeEmbedUrl(embedId)}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4 p-5 sm:p-6">
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <div className="flex items-start gap-3">
                {founderPhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={founderPhotoUrl}
                    alt="Gonzalo"
                    className="h-10 w-10 shrink-0 rounded-full border-2 border-white object-cover object-top shadow"
                  />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">
                    GA
                  </div>
                )}
                <div>
                  <p className="text-sm font-bold text-slate-900">Seguimos la charla por WhatsApp</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                    Contame qué te motiva a hacer el análisis.
                  </p>
                </div>
              </div>
              <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-700">
                {waMessage}
              </div>
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#20bd5a]"
              >
                <MessageCircle className="h-4 w-4" />
                Escribime por WhatsApp
              </a>
            </div>

            <div
              className={cn(
                'rounded-xl border p-4 transition-all duration-500',
                reportReady
                  ? 'border-violet-300 bg-gradient-to-br from-violet-50 to-indigo-50 shadow-md shadow-violet-200/50'
                  : 'border-slate-200 bg-slate-50/80'
              )}
            >
              <p className="text-sm font-bold text-slate-900">Tu diagnóstico</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {reportReady
                  ? '¡Listo! Ya podés ver tu informe completo.'
                  : 'Estamos analizando tu sitio. El botón se activa al terminar.'}
              </p>

              {reportReady ? (
                <Button
                  type="button"
                  className="mt-4 h-12 w-full gap-2 bg-violet-600 text-base font-bold shadow-lg shadow-violet-600/35 ring-2 ring-violet-400/40 hover:bg-violet-700"
                  onClick={() => window.open(reportHref, '_blank', 'noopener,noreferrer')}
                >
                  <Sparkles className="h-4 w-4" />
                  Ver mi diagnóstico
                  <ExternalLink className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  disabled
                  variant="secondary"
                  className="mt-4 h-11 w-full cursor-not-allowed border border-slate-200 bg-slate-200 text-slate-500"
                >
                  Ver mi diagnóstico
                </Button>
              )}

              <div className="mt-4">
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-200/90">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500 ease-out',
                      reportReady ? 'bg-emerald-500' : 'bg-blue-600'
                    )}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="mt-2 text-center text-xs font-medium text-slate-600">
                  {reportReady ? (
                    <span className="text-emerald-700">Análisis completado</span>
                  ) : (
                    <>Progreso del análisis — {progress}%</>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
