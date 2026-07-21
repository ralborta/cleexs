'use client';

import { CheckCircle2, Gauge, Loader2, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getScoreTrafficColors,
  normalizeScorePct,
  SCORE_NUMBER_CLASS,
} from '@/lib/score-traffic-colors';

export type EngineCardKey = 'chatgpt' | 'gemini' | 'claude' | 'perplexity';

export type EngineCardState = {
  score: number | null;
  status: 'completed' | 'pending' | 'running' | 'failed' | 'locked' | 'not_started';
};

const ENGINE_LABEL: Record<EngineCardKey, string> = {
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
  claude: 'Claude',
  perplexity: 'Perplexity',
};

function statusLabel(key: EngineCardKey, state: EngineCardState) {
  if (key === 'chatgpt') return 'Disponible';
  if (state.status === 'locked') return 'Bloqueado';
  if (state.status === 'pending' || state.status === 'running') return 'Generando...';
  if (state.status === 'failed') return 'Falló, reintentá';
  if (state.status === 'completed' && state.score != null) return 'Disponible';
  return 'Sin generar';
}

function fmtScore(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  return normalizeScorePct(value).toString();
}

export function CleexsEngineScoresPanel({
  engines,
  subtitle = 'ChatGPT sale de tu corrida. Gemini, Claude y Perplexity se desbloquean con Plan Conquistar.',
  onLockedClick,
  className,
}: {
  engines: Record<EngineCardKey, EngineCardState>;
  subtitle?: string;
  onLockedClick?: (engine: EngineCardKey) => void;
  className?: string;
}) {
  const cards: EngineCardKey[] = ['chatgpt', 'gemini', 'claude', 'perplexity'];

  return (
    <section className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700 ring-1 ring-violet-200">
            <Gauge className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-slate-900 sm:text-base">Cleexs Score por los 4 motores</h3>
            <p className="text-[11px] text-slate-500">{subtitle}</p>
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((key) => {
          const state = engines[key];
          const inProgress = state.status === 'pending' || state.status === 'running';
          const done = state.status === 'completed' && state.score != null;
          const locked = state.status === 'locked';
          const isClickable = locked && onLockedClick;
          const scorePct = state.score != null ? normalizeScorePct(state.score) : null;
          const traffic = scorePct != null ? getScoreTrafficColors(scorePct) : null;

          return (
            <div
              key={key}
              className={cn(
                'flex flex-col rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-100/60',
                isClickable && 'cursor-pointer transition hover:border-violet-200 hover:shadow-md'
              )}
              role={isClickable ? 'button' : undefined}
              tabIndex={isClickable ? 0 : undefined}
              onClick={isClickable ? () => onLockedClick(key) : undefined}
              onKeyDown={
                isClickable
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onLockedClick(key);
                      }
                    }
                  : undefined
              }
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-slate-900">{ENGINE_LABEL[key]}</p>
                {inProgress ? (
                  <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
                ) : done || key === 'chatgpt' ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Lock className="h-4 w-4 text-slate-400" />
                )}
              </div>
              <p
                className={cn(
                  'mt-3 text-3xl tabular-nums',
                  SCORE_NUMBER_CLASS,
                  locked || (!done && key !== 'chatgpt')
                    ? 'text-slate-300'
                    : traffic?.textClass ?? 'text-slate-900',
                )}
              >
                {locked ? '—' : fmtScore(state.score)}
              </p>
              <p className="mt-1 text-xs text-slate-500">{statusLabel(key, state)}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function buildEngineScoresFromDiagnostic(input: {
  chatgptScore: number;
  runResultGemini?: { cleexsScore?: number } | null;
  runResultPerplexity?: { cleexsScore?: number } | null;
  runResultClaude?: { cleexsScore?: number } | null;
  geminiRunStatus?: string | null;
  perplexityRunStatus?: string | null;
  claudeRunStatus?: string | null;
  runGeminiId?: string | null;
  runPerplexityId?: string | null;
  runClaudeId?: string | null;
  /** En free/upsell los motores extra sin corrida se muestran bloqueados. */
  lockUnavailableEngines?: boolean;
}): Record<EngineCardKey, EngineCardState> {
  const extra = (
    result: { cleexsScore?: number } | null | undefined,
    runId: string | null | undefined,
    status: string | null | undefined,
  ): EngineCardState => {
    if (result?.cleexsScore != null) {
      return { score: result.cleexsScore, status: 'completed' };
    }
    if (status === 'pending' || status === 'running') {
      return { score: null, status: status as 'pending' | 'running' };
    }
    if (status === 'failed') {
      return { score: null, status: 'failed' };
    }
    if (runId && !input.lockUnavailableEngines) {
      return { score: null, status: 'not_started' };
    }
    return { score: null, status: 'locked' };
  };

  return {
    chatgpt: { score: input.chatgptScore, status: 'completed' },
    gemini: extra(input.runResultGemini, input.runGeminiId, input.geminiRunStatus),
    claude: extra(input.runResultClaude, input.runClaudeId, input.claudeRunStatus),
    perplexity: extra(input.runResultPerplexity, input.runPerplexityId, input.perplexityRunStatus),
  };
}
