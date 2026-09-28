'use client';

import { useCallback, useEffect, useState } from 'react';
import './agency-stitch-scope.css';

type Item = {
  id: string;
  title: string;
  detail: string;
  impact: 'Alto' | 'Medio';
  done: boolean;
};

const STORAGE_KEY = 'portal_empliados_convertir_v1';

const SEED: Item[] = [
  { id: '1', title: 'Hero CTA único', detail: 'Un solo botón primario · “Pedir demo” por encima del fold.', impact: 'Alto', done: false },
  { id: '2', title: 'Prueba social arriba', detail: 'Logos / “X operadores activos” antes del scroll.', impact: 'Alto', done: false },
  { id: '3', title: 'Form corto', detail: 'Email + WhatsApp · sin fricción; enrichment después.', impact: 'Alto', done: true },
  { id: '4', title: 'Objeciones en FAQ', detail: 'Precio, onboarding, TMS · visibles cerca del CTA.', impact: 'Medio', done: false },
  { id: '5', title: 'Landing por producto', detail: '1 página / agente con fotos reales del flujo.', impact: 'Medio', done: false },
  { id: '6', title: 'A/B copy Claude', detail: 'Probar variantes de headline sugeridas en la call.', impact: 'Medio', done: false },
];

function load(): Item[] {
  if (typeof window === 'undefined') return SEED;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED;
    const parsed = JSON.parse(raw) as Item[];
    return Array.isArray(parsed) && parsed.length ? parsed : SEED;
  } catch {
    return SEED;
  }
}

/** Convertir = HTML Stitch (convertir-prioridades-landing-cro.html) + checklist persistente. */
export function AgencyConvertirView() {
  const [items, setItems] = useState<Item[]>(SEED);

  useEffect(() => {
    setItems(load());
  }, []);

  const persist = useCallback((next: Item[]) => {
    setItems(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const done = items.filter((i) => i.done).length;
  const pct = Math.round((done / Math.max(1, items.length)) * 100);

  return (
    <div className="agency-stitch flex w-full flex-col gap-space-lg pb-16">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
        <div>
          <span className="font-label-micro text-label-micro text-primary uppercase font-bold tracking-wider">
            Crecimiento · CRO
          </span>
          <h1 className="font-headline-title text-headline-title text-on-surface font-bold tracking-tight">
            Optimización de Conversión (CRO) &amp; Prioridades de Landing
          </h1>
          <p className="font-body-default text-body-sm text-on-surface-variant max-w-3xl">
            Backlog accionable de la sesión Agency · marcá avance y priorizá impacto en la landing de Empliados.
          </p>
        </div>
        <div className="bg-surface-container-lowest rounded-xl px-space-md py-3 shadow-sm flex items-center gap-space-sm">
          <div className="w-10 h-10 rounded-lg bg-primary-fixed flex items-center justify-center text-primary">
            <span className="material-symbols-outlined">target</span>
          </div>
          <div>
            <div className="font-label-micro text-label-micro text-outline">Progreso backlog</div>
            <div className="font-headline-title text-body-medium font-bold text-on-surface">
              {done}/{items.length} · {pct}%
            </div>
          </div>
        </div>
      </div>

      <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>

      <div className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm flex flex-col gap-space-md">
        <h2 className="font-headline-title text-headline-title text-on-surface">Prioridades de Landing (Backlog CRO)</h2>
        <ul className="flex flex-col gap-space-sm">
          {items.map((it, i) => (
            <li
              key={it.id}
              className={`flex gap-space-md items-start p-space-md rounded-xl transition-colors ${
                it.done ? 'bg-secondary-container/20' : 'bg-surface-container-low'
              }`}
            >
              <button
                type="button"
                onClick={() => persist(items.map((x) => (x.id === it.id ? { ...x, done: !x.done } : x)))}
                className={`mt-0.5 w-7 h-7 shrink-0 rounded-full flex items-center justify-center font-label-micro text-label-micro font-bold ${
                  it.done ? 'bg-secondary text-on-secondary' : 'bg-primary-fixed text-primary'
                }`}
                title={it.done ? 'Marcar pendiente' : 'Marcar hecho'}
              >
                {it.done ? <span className="material-symbols-outlined text-[16px]">check</span> : i + 1}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className={`font-body-medium text-body-sm font-semibold ${it.done ? 'text-on-surface-variant line-through' : 'text-on-surface'}`}>
                    {it.title}
                  </p>
                  <span
                    className={
                      it.impact === 'Alto'
                        ? 'font-label-micro text-[11px] px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-semibold'
                        : 'font-label-micro text-[11px] px-2 py-0.5 rounded-full bg-tertiary-fixed/50 text-tertiary font-semibold'
                    }
                  >
                    {it.impact}
                  </span>
                </div>
                <p className="mt-0.5 font-body-sm text-body-sm text-outline">{it.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
