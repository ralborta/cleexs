'use client';

import { BookOpen, HelpCircle, Medal, Sparkles, Target, TrendingUp } from 'lucide-react';
import { GLOSARIO_INTERPRETACION_BLOQUES } from '@/lib/interpretacion-ampliada-corridas';

const iconMap = {
  sparkle: Sparkles,
  medal: Medal,
  target: Target,
  trending: TrendingUp,
} as const;

/** Bloque de interpretación ampliada + glosario + tips (solo portal Premium / fuera de ver-resultado). */
export function InterpretacionAmpliadaCorridasBlock({
  parrafos,
  winnerLabels,
}: {
  parrafos: string[];
  winnerLabels: string[];
}) {
  return (
    <div className="space-y-8">
      <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm shadow-slate-200/30 ring-1 ring-slate-100">
        <div className="bg-gradient-to-br from-slate-50/90 via-white to-violet-50/25 px-4 py-4 sm:px-5 sm:py-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 ring-1 ring-violet-200">
              <BookOpen className="h-3.5 w-3.5 text-violet-700" aria-hidden />
            </span>
            <div>
              <p className="text-xs font-bold text-slate-900">Interpretación ampliada</p>
              <p className="text-[10px] text-slate-500">Lectura automática según los datos de esta corrida</p>
            </div>
          </div>
          <div className="space-y-3">
            {parrafos
              .filter((p) => p.trim().length > 0)
              .map((p, i) => (
                <p key={i} className="text-xs leading-relaxed text-slate-700 sm:text-[13px] sm:leading-relaxed">
                  {p}
                </p>
              ))}
          </div>
          {winnerLabels.length > 0 ? (
            <div className="mt-4 rounded-lg border border-violet-100 bg-white/80 p-3 ring-1 ring-violet-50">
              <p className="text-[10px] font-bold uppercase tracking-wide text-violet-800">
                Ejemplos de consultas donde tu marca tuvo más fuerza
              </p>
              <p className="mt-1 text-[10px] text-slate-500">
                Vista resumida del texto del prompt (el detalle completo sigue en el anexo técnico del informe
                principal).
              </p>
              <ul className="mt-2 space-y-1.5">
                {winnerLabels.map((label, i) => (
                  <li key={`winner-${i}`} className="flex gap-2 text-[11px] leading-snug text-slate-700">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[9px] font-bold text-violet-700">
                      {i + 1}
                    </span>
                    <span className="min-w-0">{label}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="border-t border-slate-100 bg-white px-4 py-4 sm:px-5 sm:py-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 ring-1 ring-indigo-100">
              <HelpCircle className="h-3.5 w-3.5 text-indigo-700" aria-hidden />
            </span>
            <div>
              <p className="text-xs font-bold text-slate-900">Qué significa cada bloque</p>
              <p className="text-[10px] text-slate-500">
                Glosario rápido; las cifras concretas están en el informe principal del portal.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {GLOSARIO_INTERPRETACION_BLOQUES.map(({ title, body, icon }) => {
              const Icon = iconMap[icon];
              return (
                <div
                  key={title}
                  className="rounded-xl border border-slate-200/90 bg-gradient-to-br from-white to-slate-50/80 p-3 shadow-sm ring-1 ring-slate-100/60"
                >
                  <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-700 ring-1 ring-violet-100">
                    <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
                  </div>
                  <p className="text-[11px] font-bold text-slate-900">{title}</p>
                  <p className="mt-1.5 text-[10.5px] leading-relaxed text-slate-600">{body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-sm ring-1 ring-slate-100/60 sm:p-4">
        <p className="text-xs font-bold text-slate-900">Desempeño por intención (lectura)</p>
        <p className="mt-2 text-xs leading-relaxed text-slate-600">
          Cada barra violeta en el informe principal es tu cuota de aparición en el Top 3 para prompts etiquetados con
          esa intención. La marca vertical gris indica al líder en el mismo universo de respuestas: sirve para ver si
          te faltan “puntos de conversión” en urgencia, calidad o precio.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200/90 bg-gradient-to-r from-violet-50/50 via-white to-indigo-50/40 p-3.5 shadow-sm ring-1 ring-slate-100/60 sm:p-4">
        <p className="text-xs font-bold text-slate-900">Cómo leer los KPI en conjunto</p>
        <p className="mt-2 text-xs leading-relaxed text-slate-600">
          El Cleexs Score sintetiza la corrida; el ranking y la brecha vs. líder te dicen si ganás “cuota de
          recomendación” frente a otras marcas. La mejor intención muestra dónde ya tenés mensaje alineado con lo que la
          IA prioriza. Si el score es medio pero la brecha es chica, estás a un buen empujón de contenido de superar al
          referente; si la brecha es grande, conviene atacar de a una o dos intenciones antes de dispersarte.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-sm ring-1 ring-slate-100/60 sm:p-4">
        <p className="text-xs font-bold text-slate-900">Métricas del análisis (lectura)</p>
        <p className="mt-2 max-w-3xl text-xs leading-relaxed text-slate-600">
          La confianza de formato indica qué tan seguros podemos estar al leer el Top 3 automáticamente. Las menciones
          miden reconocimiento nominal; el Top 3 y el #1 miden priorización. Cuando formato es bajo pero menciones
          son altas, muchas veces el modelo habla de vos pero sin listas ordenadas: conviene ajustar el estilo del
          prompt del diagnóstico para forzar estructura comparable entre corridas.
        </p>
      </div>
    </div>
  );
}
