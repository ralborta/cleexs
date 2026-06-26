'use client';

import {
  BarChart3,
  Coffee,
  ExternalLink,
  Loader2,
  MessageCircle,
  Play,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { youtubeEmbedUrl } from '@/lib/youtube';
import { OnboardingPreviewTrustFooter } from './onboarding-preview-frame';

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
          {/* Video — columna izquierda */}
          <div className="border-b border-slate-100 p-5 sm:p-6 lg:border-b-0 lg:border-r">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950 shadow-inner">
              {!showEmbed ? (
                <div className="relative flex aspect-video flex-col items-center justify-center gap-3 bg-gradient-to-br from-slate-900 via-slate-900 to-violet-950 p-6 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
                    <Play className="ml-0.5 h-6 w-6 text-white" fill="currentColor" />
                  </div>
                  <p className="text-sm font-semibold text-white">Video de Gonzalo</p>
                  <p className="max-w-xs text-xs leading-relaxed text-slate-400">
                    Placeholder — embed de YouTube cuando esté grabado.
                  </p>
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

          {/* Sidebar — WhatsApp + informe */}
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
                Enviar por WhatsApp
              </a>
            </div>

            <div
              className={cn(
                'flex flex-1 flex-col items-center justify-center rounded-xl border p-4 text-center transition',
                reportReady
                  ? 'border-violet-200 bg-violet-50/50'
                  : 'border-slate-200 bg-slate-50/80'
              )}
            >
              {!reportReady ? (
                <>
                  <Loader2 className="h-7 w-7 animate-spin text-violet-600" aria-hidden />
                  <p className="mt-2 text-sm font-medium text-slate-700">Armando tu diagnóstico…</p>
                </>
              ) : (
                <>
                  <BarChart3 className="h-8 w-8 text-violet-600" />
                  <p className="mt-2 text-sm font-bold text-slate-900">Informe listo</p>
                  <button
                    type="button"
                    className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-violet-600 hover:text-violet-800"
                    onClick={() => window.open(reportHref, '_blank', 'noopener,noreferrer')}
                  >
                    Ver mi diagnóstico
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                </>
              )}

              {!reportReady ? (
                <Button
                  type="button"
                  disabled
                  className="mt-4 w-full opacity-50"
                  variant="secondary"
                >
                  Ver mi diagnóstico
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <OnboardingPreviewTrustFooter variant="row" />
    </div>
  );
}
