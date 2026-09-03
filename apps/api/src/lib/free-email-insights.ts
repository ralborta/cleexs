/**
 * Catálogo de insights editables para la secuencia free (plantilla carta).
 * Cada clave se resuelve desde analysisJson del diagnóstico o con ejemplo de preview.
 */
export const FREE_EMAIL_INSIGHT_KEYS = [
  'executive_summary',
  'best_vs_worst_intention',
  'worst_intention_comment',
  'ranking_gap',
  'share_of_voice',
  'top_rival_reason',
  'mention_funnel',
  'top_opportunity',
  'strength_weakness',
  'priority_action',
  'satellite_tip',
  'secondary_score_teaser',
] as const;

export type FreeEmailInsightKey = (typeof FREE_EMAIL_INSIGHT_KEYS)[number];

export type FreeEmailInsightMeta = {
  key: FreeEmailInsightKey;
  sortOrder: number;
  title: string;
  description: string;
  sampleLine: string;
};

export const FREE_EMAIL_INSIGHT_CATALOG: FreeEmailInsightMeta[] = [
  {
    key: 'executive_summary',
    sortOrder: 1,
    title: 'Resumen ejecutivo corto',
    description: '2–3 oraciones del análisis IA.',
    sampleLine:
      'Tu marca aparece en respuestas de IA, pero todavía no sos la primera opción cuando preguntan por tu rubro.',
  },
  {
    key: 'best_vs_worst_intention',
    sortOrder: 2,
    title: 'Mejor vs peor intención',
    description: 'Contraste de scores por intención (p. ej. Calidad vs Precio).',
    sampleLine: 'Mejor intención: Calidad 78 · Peor: Precio 22.',
  },
  {
    key: 'worst_intention_comment',
    sortOrder: 3,
    title: 'Comentario de la peor intención',
    description: 'Insight narrativo de la intención más débil.',
    sampleLine: 'ChatGPT casi nunca te asocia a buen valor o precio competitivo en tu rubro.',
  },
  {
    key: 'ranking_gap',
    sortOrder: 4,
    title: 'Ranking + brecha vs líder',
    description: 'Posición en el set competitivo y gap vs el #1.',
    sampleLine: '#3 de 5 · −24 pts vs tu principal rival.',
  },
  {
    key: 'share_of_voice',
    sortOrder: 5,
    title: 'Cuota de voz con %',
    description: 'Share vs competidores del reporte.',
    sampleLine: 'Vos 12% · Rival A 38% · Rival B 22% en menciones Top 3.',
  },
  {
    key: 'top_rival_reason',
    sortOrder: 6,
    title: 'Razón IA del rival #1',
    description: 'Por qué la IA favorece al líder.',
    sampleLine: 'La IA destaca del líder: precios claros y casos concretos en Latam.',
  },
  {
    key: 'mention_funnel',
    sortOrder: 7,
    title: 'Embudo Mención → Top 3 → #1',
    description: 'Dónde se pierde la recomendación.',
    sampleLine: 'Te mencionan, pero pocas veces quedás en el Top 3 o como favorito.',
  },
  {
    key: 'top_opportunity',
    sortOrder: 8,
    title: 'Oportunidad #1',
    description: 'Scenario + action con impacto/esfuerzo.',
    sampleLine: 'Oportunidad: comparativo de precio · impacto Alto · esfuerzo Bajo.',
  },
  {
    key: 'strength_weakness',
    sortOrder: 9,
    title: 'Fortaleza + debilidad',
    description: 'Equilibrio emocional en 2 bullets.',
    sampleLine: '+ Casos en Latam · − Poca señal clara de precio en tu sitio.',
  },
  {
    key: 'priority_action',
    sortOrder: 10,
    title: 'Acción prioritaria #1',
    description: 'Tip concreto del plan / sugerencias.',
    sampleLine: 'Creá una pieza que contraste tu oferta vs tu principal rival en el lenguaje de tus clientes.',
  },
  {
    key: 'satellite_tip',
    sortOrder: 11,
    title: 'Tip satélite técnico',
    description: 'AEO / crawlers / schema si está disponible.',
    sampleLine: 'Señal técnica a mirar: robots.txt / acceso de crawlers de IA o Schema incompleto.',
  },
  {
    key: 'secondary_score_teaser',
    sortOrder: 12,
    title: 'Segundo score / teaser Gold',
    description: 'Cleexs Score o teaser multi-motor.',
    sampleLine: 'Tu Cleexs Score es 62. En Plan Conquistar ves el desglose por motores de IA.',
  },
];

export function isFreeEmailInsightKey(value: unknown): value is FreeEmailInsightKey {
  return typeof value === 'string' && (FREE_EMAIL_INSIGHT_KEYS as readonly string[]).includes(value);
}

export function getInsightMeta(key: FreeEmailInsightKey): FreeEmailInsightMeta {
  return FREE_EMAIL_INSIGHT_CATALOG.find((i) => i.key === key)!;
}

type AnalysisLike = {
  resumenEjecutivo?: string;
  sugerencias?: string[];
  comentariosPorIntencion?: Array<{
    intencion?: string;
    comentario?: string;
    score?: number;
  }>;
  metrics?: {
    cleexsScore?: number;
    comparisonSummary?: Array<{
      name?: string;
      type?: string;
      share?: number;
      sampleReason?: string;
    }>;
  };
  cleexsScore?: number;
  score?: number;
  satelliteModule?: {
    findings?: Array<{ title?: string; summary?: string }>;
    robotsTxt?: { blocksGptBot?: boolean };
  };
  oportunidades?: Array<{ scenario?: string; action?: string; impact?: string; effort?: string }>;
  fortalezas?: string[];
  debilidades?: string[];
};

function asAnalysis(json: unknown): AnalysisLike | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  return json as AnalysisLike;
}

function scoreNum(a: AnalysisLike | null, fallback?: number | null): number | null {
  const raw = a?.metrics?.cleexsScore ?? a?.cleexsScore ?? a?.score ?? fallback;
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  return Number.isFinite(n) ? Math.round(n) : null;
}

function brandAndRivals(a: AnalysisLike | null) {
  const rows = a?.metrics?.comparisonSummary ?? [];
  const brand = rows.find((r) => r.type === 'brand');
  const rivals = rows
    .filter((r) => r && r.type !== 'brand' && typeof r.name === 'string')
    .sort((x, y) => (y.share ?? 0) - (x.share ?? 0));
  return { brand, rivals, topRival: rivals[0] };
}

function intentionScores(a: AnalysisLike | null) {
  const list = (a?.comentariosPorIntencion ?? []).filter((c) => c && typeof c.intencion === 'string');
  if (!list.length) return { best: null as (typeof list)[0] | null, worst: null as (typeof list)[0] | null };
  const sorted = [...list].sort((x, y) => (y.score ?? 0) - (x.score ?? 0));
  return { best: sorted[0] ?? null, worst: sorted[sorted.length - 1] ?? null };
}

export type ResolveInsightContext = {
  brandName?: string | null;
  domain?: string | null;
  score?: number | null;
  topCompetitor?: string | null;
};

/** Línea de dato del insight (sin el comentario humano). */
export function resolveFreeEmailInsightLine(
  key: FreeEmailInsightKey,
  analysisJson: unknown,
  ctx: ResolveInsightContext = {}
): string {
  const a = asAnalysis(analysisJson);
  const meta = getInsightMeta(key);
  const brandName = (ctx.brandName || 'tu marca').trim() || 'tu marca';
  const { brand, rivals, topRival } = brandAndRivals(a);
  const topCompetitor = (ctx.topCompetitor || topRival?.name || 'tu principal rival').trim();
  const score = scoreNum(a, ctx.score);
  const intentions = intentionScores(a);

  switch (key) {
    case 'executive_summary': {
      const summary = a?.resumenEjecutivo?.trim();
      if (summary) {
        const short = summary.length > 320 ? `${summary.slice(0, 317)}…` : summary;
        return short;
      }
      return meta.sampleLine;
    }
    case 'best_vs_worst_intention': {
      if (intentions.best && intentions.worst && intentions.best !== intentions.worst) {
        return `Mejor intención: ${intentions.best.intencion} ${intentions.best.score ?? '—'} · Peor: ${intentions.worst.intencion} ${intentions.worst.score ?? '—'}.`;
      }
      return meta.sampleLine;
    }
    case 'worst_intention_comment': {
      const comment = intentions.worst?.comentario?.trim();
      if (comment) return comment.length > 360 ? `${comment.slice(0, 357)}…` : comment;
      return meta.sampleLine;
    }
    case 'ranking_gap': {
      if (brand && rivals.length) {
        const all = [brand, ...rivals].sort((x, y) => (y.share ?? 0) - (x.share ?? 0));
        const rank = all.findIndex((r) => r.type === 'brand') + 1;
        const leader = all[0];
        const gap = Math.round((leader?.share ?? 0) - (brand.share ?? 0));
        if (rank > 0) {
          return `#${rank} de ${all.length} · ${gap > 0 ? `−${gap}` : gap} pts vs ${leader?.name || topCompetitor}.`;
        }
      }
      return meta.sampleLine.replace('tu principal rival', topCompetitor);
    }
    case 'share_of_voice': {
      if (brand || rivals.length) {
        const parts = [
          brand?.name ? `Vos ${Math.round(brand.share ?? 0)}%` : null,
          ...rivals.slice(0, 2).map((r) => `${r.name} ${Math.round(r.share ?? 0)}%`),
        ].filter(Boolean);
        if (parts.length) return `${parts.join(' · ')} en menciones Top 3.`;
      }
      return meta.sampleLine;
    }
    case 'top_rival_reason': {
      const reason = topRival?.sampleReason?.trim();
      if (reason) return `La IA destaca de ${topCompetitor}: ${reason}`;
      return meta.sampleLine.replace('del líder', `de ${topCompetitor}`);
    }
    case 'mention_funnel': {
      if (brand?.share != null) {
        const share = Math.round(brand.share);
        if (share < 15) return `Te mencionan poco (${share}% Top 3): todavía no quedás como opción habitual.`;
        if (share < 35) return `Aparecés (${share}% Top 3), pero pocas veces como favorito frente a ${topCompetitor}.`;
        return `Buena presencia (${share}% Top 3); el siguiente paso es pelear el #1 vs ${topCompetitor}.`;
      }
      return meta.sampleLine;
    }
    case 'top_opportunity': {
      const opp = a?.oportunidades?.[0];
      if (opp?.action || opp?.scenario) {
        const bits = [opp.scenario, opp.action, opp.impact ? `impacto ${opp.impact}` : null, opp.effort ? `esfuerzo ${opp.effort}` : null]
          .filter(Boolean)
          .join(' · ');
        return bits;
      }
      return meta.sampleLine;
    }
    case 'strength_weakness': {
      const strength = a?.fortalezas?.[0]?.trim();
      const weakness = a?.debilidades?.[0]?.trim();
      if (strength || weakness) {
        return [strength ? `+ ${strength}` : null, weakness ? `− ${weakness}` : null].filter(Boolean).join(' · ');
      }
      return meta.sampleLine;
    }
    case 'priority_action': {
      const tip = a?.sugerencias?.[0]?.trim();
      if (tip) return tip;
      return meta.sampleLine;
    }
    case 'satellite_tip': {
      const sat = a?.satelliteModule;
      if (sat?.robotsTxt?.blocksGptBot) {
        return 'Señal técnica: GPTBot (u otros crawlers de IA) parece bloqueado en robots.txt.';
      }
      const finding = sat?.findings?.[0];
      if (finding?.title || finding?.summary) {
        return [finding.title, finding.summary].filter(Boolean).join(': ');
      }
      return meta.sampleLine;
    }
    case 'secondary_score_teaser': {
      if (score != null) {
        return `Tu Cleexs Score es ${score}. En Plan Conquistar ves el desglose por motores de IA.`;
      }
      return meta.sampleLine;
    }
    default:
      return meta.sampleLine;
  }
}

/** Combina dato del insight + comentario humano para el cuerpo de la carta. */
export function composeFreeSequenceBodyWithInsight(input: {
  insightKey?: FreeEmailInsightKey | null;
  comment?: string | null;
  analysisJson?: unknown;
  brandName?: string | null;
  domain?: string | null;
  score?: number | null;
  topCompetitor?: string | null;
}): string {
  const comment = (input.comment || '').trim();
  if (!input.insightKey) return comment;

  const line = resolveFreeEmailInsightLine(input.insightKey, input.analysisJson, {
    brandName: input.brandName,
    domain: input.domain,
    score: input.score,
    topCompetitor: input.topCompetitor,
  }).trim();

  const labeled = line ? `Dato de tu reporte:\n${line}` : '';
  if (labeled && comment) return `${labeled}\n\n${comment}`;
  return labeled || comment;
}
