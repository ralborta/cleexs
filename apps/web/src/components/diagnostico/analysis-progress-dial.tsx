'use client';

import { Sparkles } from 'lucide-react';

interface AnalysisProgressDialProps {
  /** 0–100 */
  percent: number;
  /** Etiqueta del paso actual. */
  label: string;
  brandName?: string | null;
  /** Tiempo transcurrido ya formateado (ej. "1m 20s"). */
  elapsed?: string;
}

const SIZE = 240;
const STROKE = 14;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

/** Dial circular animado (tipo reloj/gauge) que marca el avance del análisis. */
export function AnalysisProgressDial({ percent, label, brandName, elapsed }: AnalysisProgressDialProps) {
  const pct = Math.max(0, Math.min(100, percent));
  const dash = (pct / 100) * C;
  // Ángulo de la manecilla (0% = arriba, sentido horario).
  const handAngle = (pct / 100) * 360 - 90;
  const handLen = R - STROKE;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const hx = cx + handLen * Math.cos((handAngle * Math.PI) / 180);
  const hy = cy + handLen * Math.sin((handAngle * Math.PI) / 180);

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200/90 bg-white/95 p-8 text-center shadow-lg backdrop-blur-sm">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        {/* Glow pulsante */}
        <div className="pointer-events-none absolute inset-6 animate-pulse rounded-full bg-violet-400/10 blur-2xl" />

        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="relative">
          <defs>
            <linearGradient id="dialGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#6366f1" />
            </linearGradient>
          </defs>

          {/* Track */}
          <circle cx={cx} cy={cy} r={R} fill="none" stroke="#ede9fe" strokeWidth={STROKE} />

          {/* Marcas tipo reloj */}
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i / 12) * 360 - 90;
            const r1 = R - STROKE / 2 - 6;
            const r2 = R - STROKE / 2 - 12;
            const x1 = cx + r1 * Math.cos((a * Math.PI) / 180);
            const y1 = cy + r1 * Math.sin((a * Math.PI) / 180);
            const x2 = cx + r2 * Math.cos((a * Math.PI) / 180);
            const y2 = cy + r2 * Math.sin((a * Math.PI) / 180);
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#c4b5fd"
                strokeWidth={2}
                strokeLinecap="round"
              />
            );
          })}

          {/* Arco de progreso */}
          <circle
            cx={cx}
            cy={cy}
            r={R}
            fill="none"
            stroke="url(#dialGrad)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${C - dash}`}
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{ transition: 'stroke-dasharray 0.7s ease-out' }}
          />

          {/* Manecilla */}
          <line
            x1={cx}
            y1={cy}
            x2={hx}
            y2={hy}
            stroke="#6d28d9"
            strokeWidth={3}
            strokeLinecap="round"
            style={{ transition: 'all 0.7s ease-out' }}
          />
          <circle cx={cx} cy={cy} r={6} fill="#6d28d9" />
        </svg>

        {/* Centro: porcentaje */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-5xl font-extrabold tabular-nums text-slate-900">{Math.round(pct)}%</span>
          <span className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-violet-600">
            Analizando
          </span>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-2 text-violet-700">
        <Sparkles className="h-4 w-4 animate-pulse" />
        <p className="text-sm font-bold">
          {brandName ? `Analizando ${brandName} con IA` : 'Analizando tu marca con IA'}
        </p>
      </div>
      <p className="mt-2 min-h-[2.5rem] max-w-xs text-sm leading-relaxed text-slate-600">{label}</p>
      {elapsed && <p className="mt-1 text-xs font-medium text-slate-400">{elapsed}</p>}
    </div>
  );
}
