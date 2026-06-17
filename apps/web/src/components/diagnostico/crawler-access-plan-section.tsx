'use client';

import { useState } from 'react';
import { Bot, CheckCircle2, ClipboardList, Copy, XCircle } from 'lucide-react';
import type { CrawlerAccessReport } from '@/lib/crawler-access';
import { cn } from '@/lib/utils';

export function CrawlerAccessPlanSection({ report, siteUrl }: { report: CrawlerAccessReport; siteUrl?: string | null }) {
  const [copied, setCopied] = useState(false);

  async function copyRobots() {
    if (!report.recommendedRobots) return;
    try {
      await navigator.clipboard.writeText(report.recommendedRobots);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-sky-200/80 bg-white p-4 shadow-sm ring-1 ring-sky-100/50 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
          <Bot className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-700">J9 · Crawler</p>
          <h3 className="text-base font-bold text-slate-900">¿Están entrando los crawlers de ChatGPT a tu sitio?</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            Revisamos si tu <code className="rounded bg-slate-100 px-1 text-[10px]">robots.txt</code> deja pasar a los
            bots que usan ChatGPT, Perplexity y Gemini para leer tu web. Sin acceso, es más difícil que te recomienden.
          </p>
          {report.robotsUrl ? (
            <p className="mt-1 text-[10px] text-slate-500">
              Archivo analizado: <span className="font-mono">{report.robotsUrl}</span>
            </p>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Bot</th>
              <th className="px-3 py-2">Motor</th>
              <th className="px-3 py-2 text-right">Acceso</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {report.bots.map((bot) => (
              <tr key={bot.name} className="bg-white">
                <td className="px-3 py-2 font-semibold text-slate-900">{bot.name}</td>
                <td className="px-3 py-2 text-slate-600">{bot.engine}</td>
                <td className="px-3 py-2 text-right">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                      bot.allowed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    )}
                  >
                    {bot.allowed ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                    {bot.allowed ? 'Permitido' : 'Bloqueado'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {report.recommendedRobots ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-slate-900">robots.txt recomendado</p>
            <button
              type="button"
              onClick={() => void copyRobots()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Copy className="h-3.5 w-3.5" />
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <pre className="max-h-48 overflow-auto rounded-lg border border-slate-200 bg-white p-3 text-[10px] leading-relaxed text-slate-700">
            {report.recommendedRobots}
          </pre>
          {siteUrl ? (
            <p className="mt-2 text-[10px] text-slate-500">Sitemap apunta a {siteUrl.replace(/\/$/, '')}/sitemap.xml</p>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-4">
        <div className="mb-2 flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-violet-600" aria-hidden />
          <p className="text-sm font-bold text-slate-900">Cómo verificar visitas reales (checklist)</p>
        </div>
        <ul className="space-y-2">
          {report.verificationChecklist.map((item) => (
            <li key={item} className="flex gap-2 text-xs leading-relaxed text-slate-700">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-600" aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[10px] text-slate-500">
          Nota: este informe valida acceso vía robots.txt. Confirmar visitas en logs del servidor es el siguiente paso
          para saber si OAI-SearchBot ya está rastreando tu sitio.
        </p>
      </div>
    </section>
  );
}
