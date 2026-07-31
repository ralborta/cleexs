'use client';

import Image from 'next/image';
import { Gauge, LineChart, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EngineCardKey } from '@/components/diagnostico/cleexs-engine-scores-panel';
import { CleexsScoreRing } from '@/components/ui/cleexs-score-ring';
import {
  getScoreTrafficBand,
  normalizeScorePct,
} from '@/lib/score-traffic-colors';

const ENGINE_META: Record<EngineCardKey, { label: string; logo: string }> = {
  chatgpt: { label: 'ChatGPT', logo: '/engines/chatgpt.png' },
  gemini: { label: 'Gemini', logo: '/engines/gemini.png' },
  claude: { label: 'Claude', logo: '/engines/claude.png' },
  perplexity: { label: 'Perplexity', logo: '/engines/perplexity.png' },
};

const ENGINE_ORDER: EngineCardKey[] = ['chatgpt', 'gemini', 'claude', 'perplexity'];

function visibilityDiagnosis(score: number) {
  const band = getScoreTrafficBand(score);
  if (band === 'green') {
    return {
      label: 'Buena visibilidad',
      pillClass: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    };
  }
  if (band === 'yellow') {
    return {
      label: 'Visibilidad media',
      pillClass: 'bg-amber-50 text-amber-800 ring-amber-100',
    };
  }
  return {
    label: 'Visibilidad baja',
    pillClass: 'bg-red-50 text-red-700 ring-red-100',
  };
}

function LockedEngineRing() {
  return (
    <div className="relative mx-auto h-[5.25rem] w-[5.25rem] shrink-0 sm:h-[5.75rem] sm:w-[5.75rem]">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 88 88" aria-hidden>
        <circle cx="44" cy="44" r="34" fill="none" stroke="#e8ecf4" strokeWidth="7" />
        <circle
          cx="44"
          cy="44"
          r="34"
          fill="none"
          stroke="#cbd5e1"
          strokeWidth="7"
          strokeDasharray="42 172"
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-400">
          <Lock className="h-3.5 w-3.5" aria-hidden />
        </span>
      </div>
    </div>
  );
}

function EnginePresenceCard({
  engineKey,
  score,
  locked,
  onLockedClick,
}: {
  engineKey: EngineCardKey;
  score: number;
  locked: boolean;
  onLockedClick?: (key: EngineCardKey) => void;
}) {
  const meta = ENGINE_META[engineKey];
  const pct = normalizeScorePct(score);
  const diagnosis = visibilityDiagnosis(pct);
  const clickable = locked && onLockedClick;

  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? () => onLockedClick(engineKey) : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onLockedClick(engineKey);
              }
            }
          : undefined
      }
      className={cn(
        'flex min-h-[9.5rem] flex-col rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-sm ring-1 ring-slate-100/80 sm:min-h-[10rem] sm:p-4',
        clickable && 'cursor-pointer transition hover:border-violet-200 hover:shadow-md',
        locked && 'bg-slate-50/40',
      )}
    >
      <div className="flex items-center gap-2">
        <span className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-slate-100">
          <Image src={meta.logo} alt="" width={20} height={20} className="object-contain" />
        </span>
        <p className="text-sm font-bold text-slate-900 sm:text-base">{meta.label}</p>
      </div>

      <div className="mt-3 flex flex-1 items-center gap-2.5 sm:gap-3">
        {locked ? (
          <LockedEngineRing />
        ) : (
          <CleexsScoreRing score={pct} size="card" className="mx-0 shrink-0" />
        )}

        <div className="min-w-0 flex-1">
          {locked ? (
            <p className="text-[11px] font-medium leading-snug text-slate-500 sm:text-xs">
              Disponible en Plan Conquistar
            </p>
          ) : (
            <div className="space-y-2">
              <span
                className={cn(
                  'inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 sm:text-[11px]',
                  diagnosis.pillClass,
                )}
              >
                {diagnosis.label}
              </span>
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-700 sm:text-xs">
                <LineChart className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} aria-hidden />
                Motor analizado
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function EnginePresenceCards({
  score,
  engines,
  onLockedClick,
  unlockAll = false,
  className,
}: {
  score: number;
  engines: Record<
    EngineCardKey,
    { score: number | null; status: 'completed' | 'pending' | 'running' | 'failed' | 'locked' | 'not_started' }
  >;
  onLockedClick?: (key: EngineCardKey) => void;
  unlockAll?: boolean;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm shadow-slate-200/30 ring-1 ring-slate-100',
        className,
      )}
    >
      <div className="border-b border-slate-100 px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
            <Gauge className="h-5 w-5" strokeWidth={2.2} aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-bold leading-snug text-[#1e2a5a] sm:text-lg">
              Presencia en motores de IA
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500 sm:text-sm">
              Mide la presencia y visibilidad de tu marca en las respuestas generadas por cada motor.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 p-3.5 sm:gap-3 sm:p-4 lg:grid-cols-4">
        {ENGINE_ORDER.map((key) => {
          const locked = !unlockAll && key !== 'chatgpt' && engines[key].status === 'locked';
          const engineScore =
            key === 'chatgpt'
              ? score
              : engines[key].score != null
                ? normalizeScorePct(engines[key].score)
                : score;

          return (
            <EnginePresenceCard
              key={key}
              engineKey={key}
              score={engineScore}
              locked={locked}
              onLockedClick={onLockedClick}
            />
          );
        })}
      </div>

      {!unlockAll ? (
        <p className="flex items-center justify-center gap-2 border-t border-slate-100 px-4 py-3 text-center text-[11px] leading-snug text-slate-500 sm:text-xs">
          <Lock className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
          Desbloquea el análisis completo en los 4 motores con el Plan Conquistar
        </p>
      ) : null}
    </section>
  );
}
