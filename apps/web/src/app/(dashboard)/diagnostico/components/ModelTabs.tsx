'use client';

import { LayoutDashboard, Sparkles } from 'lucide-react';
import type { ModelTab } from '../types';

interface ModelTabsProps {
  value: ModelTab;
  onChange: (v: ModelTab) => void;
  /** Si false, no mostrar tabs (ej. cuando no hay datos Gemini). */
  showGemini?: boolean;
}

export function ModelTabs({ value, onChange, showGemini = true }: ModelTabsProps) {
  const base =
    'inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]';
  const active =
    'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30 ring-offset-2';
  const inactive =
    'bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 hover:ring-slate-300';

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
      <span className="mr-1 text-sm font-medium text-slate-600">Ver datos por modelo:</span>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => onChange('consolidado')}
          className={`${base} ${value === 'consolidado' ? active : inactive}`}
        >
          <LayoutDashboard className="h-4 w-4 shrink-0" />
          Consolidado
        </button>
        <button
          type="button"
          onClick={() => onChange('chatgpt')}
          className={`${base} ${value === 'chatgpt' ? active : inactive}`}
        >
          <img
            src="https://chat.openai.com/favicon.ico"
            alt=""
            width={18}
            height={18}
            className="h-[18px] w-[18px] shrink-0 rounded-sm"
          />
          ChatGPT
        </button>
        {showGemini && (
          <button
            type="button"
            onClick={() => onChange('gemini')}
            className={`${base} ${value === 'gemini' ? active : inactive}`}
          >
            <Sparkles className="h-[18px] w-[18px] shrink-0 text-blue-600" aria-hidden />
            Gemini
          </button>
        )}
      </div>
    </div>
  );
}
