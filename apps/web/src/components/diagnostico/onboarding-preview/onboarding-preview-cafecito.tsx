'use client';

import { ExternalLink, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function OnboardingPreviewCafecito({
  userName,
  domain,
  youtubeVideoId,
  whatsappHref,
  reportReady,
  reportHref,
}: {
  userName: string;
  domain: string;
  youtubeVideoId?: string;
  whatsappHref: string;
  reportReady: boolean;
  reportHref: string;
}) {
  const embedId = youtubeVideoId?.trim();
  const showEmbed = embedId && embedId !== 'off';

  return (
    <div className="m-auto w-full max-w-2xl space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-900">
          Un cafecito mientras terminamos ☕
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-slate-600">
          Terminá: te hice un videíto para contarte por qué armé Cleexs y qué cosas me gustaría que
          sepas antes de ver tu diagnóstico.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-black shadow-lg aspect-video">
        {!showEmbed ? (
          <div className="flex h-full min-h-[200px] items-center justify-center bg-slate-900 p-8 text-center text-sm text-slate-400">
            Placeholder — acá va el embed de YouTube cuando Gonzalo grabe el video
          </div>
        ) : (
          <iframe
            title="Video fundador Cleexs"
            className="h-full w-full"
            src={`https://www.youtube.com/embed/${embedId}?rel=0`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-sm leading-relaxed text-slate-700">
          Tomamos un cafecito mientras armamos tu diagnóstico. Si querés, seguimos la charla por
          WhatsApp — me encantaría escuchar qué te motiva a hacer el análisis de Cleexs.
        </p>

        <label className="mt-4 block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Mensaje (preview)
          </span>
          <textarea
            readOnly
            rows={3}
            className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800"
            value={`Hola Gonzalo, soy ${userName} de ${domain}. Te escribo porque quiero contarte por qué hice el análisis de Cleexs…`}
          />
        </label>

        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#20bd5a] sm:w-auto"
        >
          <MessageCircle className="h-4 w-4" />
          Enviar por WhatsApp
        </a>
      </div>

      <div className="flex flex-col items-center gap-3 pb-4">
        <Button
          type="button"
          size="lg"
          disabled={!reportReady}
          className={cn('min-w-[220px]', !reportReady && 'opacity-50')}
          onClick={() => {
            if (reportReady) window.open(reportHref, '_blank', 'noopener,noreferrer');
          }}
        >
          Ver mi diagnóstico
          {reportReady ? <ExternalLink className="ml-2 h-4 w-4" /> : null}
        </Button>
        {!reportReady ? (
          <p className="text-xs text-slate-500">El botón se activa cuando el informe esté listo (simulado)</p>
        ) : (
          <p className="text-xs text-emerald-700">Informe listo — se abre en una pestaña nueva</p>
        )}
      </div>
    </div>
  );
}
