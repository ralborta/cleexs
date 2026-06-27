'use client';

import {
  Check,
  Coffee,
  ExternalLink,
  FileText,
  Globe,
  MessageCircle,
  Play,
  Sparkles,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { youtubeEmbedUrl } from '@/lib/youtube';

function CircularProgress({
  value,
  ready,
}: {
  value: number;
  ready?: boolean;
}) {
  const size = 72;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, value)) / 100) * c;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        className="-rotate-90"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-slate-200"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className={cn(
            'transition-all duration-500 ease-out',
            ready ? 'text-emerald-500' : 'text-blue-600'
          )}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-slate-800">
        {value}%
      </span>
    </div>
  );
}

function DiagnosisStat({
  icon: Icon,
  label,
  value,
  muted,
}: {
  icon: typeof Globe;
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200/90 bg-white px-2.5 py-2.5 text-center shadow-sm">
      <Icon
        className={cn('mx-auto h-4 w-4', muted ? 'text-slate-400' : 'text-violet-600')}
        strokeWidth={1.75}
      />
      <p className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={cn(
          'mt-0.5 truncate text-[11px] font-bold',
          muted ? 'text-slate-400' : 'text-slate-900'
        )}
      >
        {value}
      </p>
    </div>
  );
}

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
  competitorsCount = 3,
  onReportClick,
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
  competitorsCount?: number;
  onReportClick?: () => void;
}) {
  const embedId = youtubeVideoId?.trim();
  const showEmbed = embedId && embedId !== 'off';
  const waMessage = `Hola Gonzalo, soy ${userName} de ${domain}. Te escribo porque quiero contarte por qué hice el análisis de Cleexs…`;
  const progress = reportReady ? 100 : reportProgress;

  return (
    <div className="mx-auto w-full">
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

        <div className="grid grid-cols-1 gap-5 p-5 sm:p-6">
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
                src={youtubeEmbedUrl(embedId, { autoplay: true })}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            )}
          </div>

          {/* Tarjeta diagnóstico */}
          <div
            className={cn(
              'flex flex-col rounded-xl border p-4 transition-all duration-500 sm:p-5',
              reportReady
                ? 'border-emerald-200 bg-gradient-to-br from-emerald-50/40 via-white to-violet-50/30 shadow-md shadow-emerald-100/50'
                : 'border-slate-200 bg-slate-50/50'
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <Sparkles
                className={cn(
                  'h-5 w-5 shrink-0',
                  reportReady ? 'text-violet-600' : 'text-slate-400'
                )}
                aria-hidden
              />
              {reportReady ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-800 ring-1 ring-emerald-200/80">
                  <Check className="h-3 w-3" strokeWidth={3} />
                  Informe listo
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700 ring-1 ring-blue-100">
                  Analizando…
                </span>
              )}
            </div>

            <h2 className="mt-2 text-base font-bold text-slate-900">Tu diagnóstico</h2>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-600 sm:text-sm">
              {reportReady
                ? '¡Listo! Ya podés ver tu informe completo.'
                : 'Estamos analizando tu sitio. El botón se activa al terminar.'}
            </p>

            <div
              className={cn(
                'mt-4 flex items-center gap-3 rounded-xl border p-3',
                reportReady
                  ? 'border-emerald-200/80 bg-emerald-50/60'
                  : 'border-slate-200 bg-white'
              )}
            >
              <CircularProgress value={progress} ready={reportReady} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900">
                  {reportReady ? (
                    <span className="text-emerald-800">Análisis completado ✓</span>
                  ) : (
                    <>Progreso del análisis</>
                  )}
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-slate-600">
                  {reportReady
                    ? 'Procesamos tu sitio y analizamos el mercado para generar tu informe.'
                    : 'Estamos revisando tu dominio, competidores y visibilidad en motores de IA.'}
                </p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <DiagnosisStat icon={Globe} label="Dominio analizado" value={domain} />
              <DiagnosisStat
                icon={Users}
                label="Competidores"
                value={reportReady ? String(competitorsCount) : 'Detectando…'}
                muted={!reportReady}
              />
              <DiagnosisStat
                icon={FileText}
                label="Informe"
                value={reportReady ? 'Listo para ver' : 'En proceso'}
                muted={!reportReady}
              />
            </div>

            {reportReady ? (
              <Button
                type="button"
                className="mt-4 h-11 w-full gap-2 bg-violet-600 text-sm font-bold shadow-lg shadow-violet-600/30 ring-2 ring-violet-400/30 hover:bg-violet-700"
                onClick={() =>
                  onReportClick
                    ? onReportClick()
                    : window.open(reportHref, '_blank', 'noopener,noreferrer')
                }
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
          </div>
        </div>

        <div className="border-t border-emerald-100/80 bg-gradient-to-b from-emerald-50/40 to-white px-4 py-4 sm:px-5 sm:py-5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800/70">
            Mensaje para Gonzalo
          </p>
          <div className="relative mt-2 rounded-2xl rounded-tl-md border border-emerald-200/90 bg-white px-4 py-3 shadow-sm ring-1 ring-white">
            <p className="text-xs leading-relaxed text-slate-700 sm:text-[13px]">{waMessage}</p>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex min-w-0 items-center gap-2.5">
              {founderPhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={founderPhotoUrl}
                  alt="Gonzalo"
                  className="h-10 w-10 shrink-0 rounded-full border-2 border-white object-cover object-top shadow-sm ring-1 ring-emerald-100"
                />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700 ring-1 ring-emerald-100">
                  GA
                </div>
              )}
              <div className="min-w-0">
                <p className="text-[13px] font-bold leading-tight text-slate-900">Seguimos por WhatsApp</p>
                <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                  Contame qué te motivó a hacer el análisis
                </p>
              </div>
            </div>

            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 text-xs font-bold text-white shadow-sm transition hover:bg-[#20bd5a] sm:h-11 sm:w-auto sm:whitespace-nowrap sm:px-5 sm:text-sm"
            >
              <MessageCircle className="h-4 w-4 shrink-0" />
              Escribime por WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
