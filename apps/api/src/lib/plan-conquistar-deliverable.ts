import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { getAppBaseUrlForPublicLinks } from './app-public-url';

export type PlanConquistarDeliverableSnapshot = {
  version: 1;
  generatedAt: string;
  diagnosticId: string;
  runId: string | null;
  brandName: string;
  domain: string;
  country: string | null;
  industry: string | null;
  cleexsScore: number | null;
  competitors: Array<{ name: string; domain?: string | null }>;
  topActions: string[];
  roadmap: Array<{ id: string; label: string; title: string; items: string[] }>;
  planAtaquePath: string;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function hostFromUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    const withProto = /^https?:\/\//i.test(t) ? t : `https://${t}`;
    return new URL(withProto).hostname.replace(/^www\./i, '') || null;
  } catch {
    return t.replace(/^www\./i, '').split('/')[0] || null;
  }
}

function brandFromHost(host: string): string {
  const base = host.split('.')[0] || host;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/**
 * Ensambla el Plan de Ataque (Fase 1) desde el diagnóstico ya corrido.
 * Sin IA nueva: usa onboarding + prompts del run.
 */
export async function buildPlanConquistarDeliverable(
  diagnosticId: string
): Promise<PlanConquistarDeliverableSnapshot | null> {
  const diagnostic = await prisma.publicDiagnostic.findUnique({
    where: { id: diagnosticId },
    select: {
      id: true,
      brandName: true,
      domain: true,
      industry: true,
      runId: true,
      setupDraftJson: true,
    },
  });
  if (!diagnostic) return null;

  const draft = asRecord(diagnostic.setupDraftJson);
  const country =
    (typeof draft?.confirmedCountry === 'string' && draft.confirmedCountry.trim()) ||
    (typeof draft?.suggestedCountry === 'string' && draft.suggestedCountry.trim()) ||
    null;
  const industry =
    (typeof draft?.confirmedIndustry === 'string' && draft.confirmedIndustry.trim()) ||
    (typeof draft?.suggestedIndustry === 'string' && draft.suggestedIndustry.trim()) ||
    diagnostic.industry ||
    null;

  const urlList: string[] = [];
  const confirmed = draft?.confirmedCompetitorUrls;
  const suggested = draft?.suggestedCompetitorUrls;
  if (Array.isArray(confirmed) && confirmed.length) {
    for (const u of confirmed) if (typeof u === 'string') urlList.push(u);
  } else if (Array.isArray(suggested)) {
    for (const u of suggested) if (typeof u === 'string') urlList.push(u);
  }

  const brandHost = hostFromUrl(diagnostic.domain) || diagnostic.domain;
  const competitors: Array<{ name: string; domain?: string | null }> = [];
  const seen = new Set<string>();
  for (const url of urlList) {
    const domain = hostFromUrl(url);
    if (!domain) continue;
    const key = domain.toLowerCase();
    if (key === brandHost.toLowerCase() || seen.has(key)) continue;
    seen.add(key);
    competitors.push({ name: brandFromHost(domain), domain });
    if (competitors.length >= 5) break;
  }

  let cleexsScore: number | null = null;
  const topActions: string[] = [];

  if (diagnostic.runId) {
    const run = await prisma.run.findUnique({
      where: { id: diagnostic.runId },
      select: {
        promptResults: {
          select: {
            score: true,
            prompt: { select: { name: true, promptText: true } },
          },
          orderBy: { score: 'asc' },
          take: 8,
        },
        priaReports: {
          select: { priaTotal: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        brand: {
          select: {
            competitors: { select: { name: true, domain: true }, take: 5 },
          },
        },
      },
    });

    if (run?.priaReports?.[0]?.priaTotal != null) {
      cleexsScore = Math.round(Number(run.priaReports[0].priaTotal));
    }

    if (!competitors.length && run?.brand?.competitors?.length) {
      for (const c of run.brand.competitors) {
        competitors.push({ name: c.name, domain: c.domain });
      }
    }

    for (const pr of run?.promptResults ?? []) {
      const label = pr.prompt?.name?.trim() || pr.prompt?.promptText?.trim()?.slice(0, 80);
      if (!label) continue;
      topActions.push(
        `Mejorá la respuesta a “${label}” (score actual ${Math.round(Number(pr.score) || 0)}).`
      );
      if (topActions.length >= 6) break;
    }
  }

  if (!topActions.length) {
    topActions.push(
      `Definí la intención #1 donde ${diagnostic.brandName} quiere ser recomendada.`,
      competitors[0]
        ? `Publicá una comparativa clara vs ${competitors[0].name}.`
        : `Publicá FAQs accionables en el sitio de ${diagnostic.brandName}.`,
      `Alineá señales de marca (descripción, rubro, prueba social) para los motores de IA.`
    );
  }

  const rival = competitors[0]?.name;
  const brand = diagnostic.brandName;
  const roadmap = [
    {
      id: 'hora',
      label: 'Primera hora',
      title: `Arranque inmediato para ${brand}`,
      items: [
        topActions[0],
        `Revisá cómo aparece ${brand} frente a ${rival || 'tus competidores'}.`,
        'Elegí 1 página del sitio para mejorar primero.',
      ],
    },
    {
      id: 'semana',
      label: 'Semana 1',
      title: 'Quick wins',
      items: [
        topActions[1] || `Publicá una pieza para la prioridad #1 de ${brand}.`,
        topActions[2] || `Sumá 3 FAQs verificables sobre ${brand}.`,
        rival
          ? `Borrador: ${brand} vs ${rival}.`
          : `Armá una comparativa base con tus competidores.`,
      ],
    },
    {
      id: 'd30',
      label: '30 días',
      title: 'Mes 1 — señales claras',
      items: [
        `Publicá 2–3 piezas que cubran intenciones débiles de ${brand}.`,
        'Unificá descripción, rubro y propuesta de valor.',
        rival
          ? `Cerrá brechas evidentes vs ${rival}.`
          : 'Sumá evidencia verificable (casos, datos, testimonios).',
      ],
    },
    {
      id: 'd60',
      label: '60 días',
      title: 'Mes 2 — autoridad',
      items: [
        `Ampliá cobertura a intenciones secundarias de ${brand}.`,
        industry ? `Aparecé en 1–2 fuentes del sector ${industry}.` : 'Aparecé en 1–2 fuentes externas del sector.',
        'Actualizá comparativas y FAQs con contenido citable.',
      ],
    },
    {
      id: 'd90',
      label: '90 días',
      title: 'Mes 3 — medir y reforzar',
      items: [
        `Re-análisis Cleexs a los ~75 días para ${brand}.`,
        'Duplicá lo que mejoró el score; descartá lo que no movió la aguja.',
        'Planificá el siguiente ciclo de 90 días.',
      ],
    },
  ];

  const domain = diagnostic.domain.replace(/^www\./, '');
  const planAtaquePath = `/portal-crecimiento/plan-ataque?diagnosticId=${encodeURIComponent(diagnostic.id)}`;

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    diagnosticId: diagnostic.id,
    runId: diagnostic.runId,
    brandName: diagnostic.brandName,
    domain,
    country,
    industry,
    cleexsScore,
    competitors,
    topActions,
    roadmap,
    planAtaquePath,
  };
}

export function planAtaqueAbsoluteUrl(path: string): string {
  const base = getAppBaseUrlForPublicLinks().replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Merge seguro del rawPayload del payment (no pisar diagnosticId / password). */
export function mergePaymentRawPayload(
  current: unknown,
  patch: Record<string, unknown>
): Prisma.InputJsonValue {
  const base = asRecord(current) ?? {};
  return { ...base, ...patch } as Prisma.InputJsonValue;
}
