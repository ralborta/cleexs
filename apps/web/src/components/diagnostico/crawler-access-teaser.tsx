'use client';

import { Bot, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import type { PublicDiagnosticSatelliteModule } from '@/lib/api';
import { buildCrawlerAccessReport, crawlerHeadline } from '@/lib/crawler-access';
import { cn } from '@/lib/utils';

export function CrawlerAccessTeaser({
  module,
  siteUrl,
}: {
  module: PublicDiagnosticSatelliteModule | null | undefined;
  siteUrl?: string | null;
}) {
  const report = buildCrawlerAccessReport(module, siteUrl);
  if (!report) return null;

  const hasBlockedTeaser = report.teaserBots.some((b) => !b.allowed);

  return (
    <section className="rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-50/60 via-white to-white p-4 shadow-sm ring-1 ring-sky-100/60">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
          <Bot className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-700">Acceso de crawlers de IA</p>
          <h3 className="mt-0.5 text-sm font-bold text-slate-900">¿ChatGPT puede rastrear tu sitio?</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">{crawlerHeadline(report)}</p>
        </div>
      </div>

      <ul className="mt-4 grid gap-2 sm:grid-cols-3">
        {report.teaserBots.map((bot) => (
          <li
            key={bot.name}
            className={cn(
              'flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-xs',
              bot.allowed
                ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900'
                : 'border-rose-200 bg-rose-50/70 text-rose-900'
            )}
          >
            <div className="min-w-0">
              <p className="font-semibold">{bot.name}</p>
              <p className="truncate text-[10px] opacity-80">{bot.engine}</p>
            </div>
            {bot.allowed ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
            ) : (
              <XCircle className="h-4 w-4 shrink-0 text-rose-600" aria-hidden />
            )}
          </li>
        ))}
      </ul>

      {hasBlockedTeaser ? (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          Si un crawler está bloqueado, la IA no puede leer tu sitio para recomendarte. El Plan Conquistar incluye el
          diagnóstico completo y un robots.txt sugerido.
        </p>
      ) : (
        <p className="mt-3 text-[11px] text-slate-500">
          Esto revisa robots.txt (acceso permitido). Para ver visitas reales del bot en tu servidor, el Plan Conquistar
          trae el checklist de verificación.
        </p>
      )}
    </section>
  );
}
