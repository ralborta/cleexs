'use client';

import { useMemo, useState } from 'react';
import { AuditoriaAgenticaDashboard } from '@/components/auditoria/auditoria-agentica-dashboard';
import { createPortalAuditoriaFetch } from '@/lib/admin-ui-client-fetch';
import './agency-stitch-scope.css';

const IMPROVEMENTS = [
  {
    title: 'Falta schema de BreadcrumbList',
    impact: 'Alto',
    detail: 'Los agentes pierden contexto de jerarquía de páginas en empliados.net.',
    action: 'Agregar JSON-LD BreadcrumbList en plantillas clave',
  },
  {
    title: 'Considerá agregar FAQPage',
    impact: 'Alto',
    detail: 'Las FAQs del hub LLM citan mejor cuando llevan schema FAQPage completo.',
    action: 'Publicar FAQPage en /faq/* del hub',
  },
  {
    title: 'Organization tiene propiedades faltantes',
    impact: 'Medio',
    detail: 'Faltan sameAs / logo / contactPoint para desambiguar la marca.',
    action: 'Completar Organization en el home',
  },
  {
    title: 'Página lenta: TTFB promedio alto',
    impact: 'Medio',
    detail: 'TTFB elevado reduce la probabilidad de crawl completo por agentes.',
    action: 'Cache edge + priorizar HTML crítico',
  },
];

const AGENTS_COMPAT = [
  { name: 'ChatGPT (GPT-4o)', pct: 88, tone: 'text-secondary', bar: 'bg-secondary' },
  { name: 'Claude 3.5 Sonnet', pct: 79, tone: 'text-secondary', bar: 'bg-secondary' },
  { name: 'Perplexity AI', pct: 61, tone: 'text-primary', bar: 'bg-primary' },
  { name: 'Gemini Live', pct: 48, tone: 'text-error', bar: 'bg-error' },
];

/**
 * Auditoría = HTML Stitch (auditor-a-ia.html) + motor vivo AuditoriaAgenticaDashboard
 * (API /api/borrador/portal-auditoria · empliados.net).
 */
export function AgencyAuditoriaView() {
  const apiFetch = useMemo(() => createPortalAuditoriaFetch(), []);
  const [periodNote] = useState('Auditoría Finalizada');

  return (
    <div className="agency-stitch flex w-full flex-col gap-space-lg pb-10">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
        <div className="flex flex-col gap-space-xs">
          <div className="flex items-center gap-space-sm flex-wrap">
            <span className="font-label-micro text-label-micro uppercase tracking-wider text-primary font-semibold">
              Diagnóstico LLM &amp; Crawlers
            </span>
            <span className="flex items-center gap-1 px-space-xs py-0.5 rounded-full bg-secondary-container/40 text-on-secondary-container text-label-micro font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
              {periodNote}
            </span>
          </div>
          <h1 className="font-headline-title text-headline-title text-on-surface font-bold tracking-tight">
            Auditoría de Legibilidad para Agentes IA
          </h1>
          <p className="font-body-default text-body-sm text-on-surface-variant max-w-3xl">
            Evalúa y optimiza la capacidad de tu ecosistema web para ser rastreado, interpretado y citado con precisión
            por modelos conversacionales. El análisis vivo corre sobre <strong>empliados.net</strong>.
          </p>
        </div>
        <div className="flex items-center gap-space-xs self-start lg:self-center">
          <a
            href="https://empliados.net"
            target="_blank"
            rel="noreferrer"
            className="px-space-md py-space-sm rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-body-medium text-body-sm inline-flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[18px]">open_in_new</span>
            <span>Ver sitio</span>
          </a>
        </div>
      </div>

      {/* Stitch score band (contexto) + compat */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg">
        <div className="xl:col-span-7 rounded-xl bg-surface-container-lowest p-space-lg shadow-sm flex flex-col gap-space-md">
          <div className="flex items-start gap-space-sm">
            <span className="material-symbols-outlined text-primary text-[22px]">info</span>
            <div>
              <h2 className="font-headline-title text-headline-title text-on-surface font-semibold leading-tight">
                ¿Qué tan legible es tu sitio para los agentes de IA?
              </h2>
              <p className="font-body-default text-body-sm text-on-surface-variant">
                Determina si los agentes pueden <span className="font-semibold text-on-surface">leer, procesar e interpretar</span>{' '}
                tu inventario y contenido de negocio sin alucinaciones.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-sm">
            {(
              [
                ['Acceso de agentes', 'robots.txt & directivas', '100', 'ok'],
                ['Guía para LLMs', 'llms.txt & endpoints', '40', 'warn'],
                ['Structured Data', 'JSON-LD Schema org', '69', 'mid'],
              ] as const
            ).map(([title, sub, score, tone]) => (
              <div key={title} className="bg-surface-container-low p-space-sm rounded-lg flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="font-body-medium text-body-sm text-on-surface font-medium">{title}</span>
                  <span className="font-label-micro text-label-micro text-outline">{sub}</span>
                </div>
                <div
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full font-metric-tabular text-body-sm font-semibold ${
                    tone === 'ok'
                      ? 'bg-secondary-container/40 text-on-secondary-container'
                      : tone === 'warn'
                        ? 'bg-error-container text-on-error-container'
                        : 'bg-surface-container-high text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {tone === 'ok' ? 'check' : tone === 'warn' ? 'warning' : 'horizontal_rule'}
                  </span>
                  <span>{score}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="xl:col-span-5 rounded-xl bg-surface-container-lowest p-space-lg shadow-sm flex flex-col gap-space-md">
          <h3 className="font-headline-title text-body-medium font-bold text-on-surface">Compatibilidad por Agente</h3>
          <div className="flex flex-col gap-space-sm">
            {AGENTS_COMPAT.map((a) => (
              <div key={a.name} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-body-sm">
                  <span className="font-body-medium text-on-surface">{a.name}</span>
                  <span className={`font-metric-tabular font-semibold ${a.tone}`}>{a.pct}%</span>
                </div>
                <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden">
                  <div className={`h-full ${a.bar} rounded-full`} style={{ width: `${a.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm flex flex-col gap-space-md">
        <h2 className="font-headline-title text-headline-title text-on-surface">Qué mejorar (Priorizado por impacto)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
          {IMPROVEMENTS.map((item) => (
            <div key={item.title} className="p-space-md rounded-xl bg-surface-container-low flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-body-medium text-body-sm font-bold text-on-surface">{item.title}</span>
                <span
                  className={
                    item.impact === 'Alto'
                      ? 'font-label-micro text-[11px] px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-semibold'
                      : 'font-label-micro text-[11px] px-2 py-0.5 rounded-full bg-tertiary-fixed/50 text-tertiary font-semibold'
                  }
                >
                  {item.impact}
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">{item.detail}</p>
              <p className="font-label-micro text-label-micro text-primary font-semibold">{item.action}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Motor vivo */}
      <div className="rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
        <div className="flex items-center gap-2 px-space-sm pb-space-md">
          <span className="material-symbols-outlined text-primary text-[20px]">radar</span>
          <div>
            <h2 className="font-headline-title text-body-medium font-bold text-on-surface">Análisis en vivo · Empliados</h2>
            <p className="font-body-sm text-body-sm text-outline">
              Corré, refreschá y abrí el reporte real (API portal-auditoria).
            </p>
          </div>
        </div>
        <AuditoriaAgenticaDashboard
          apiFetch={apiFetch}
          portalCreatedBy="portal-empliados"
          ensureTarget={{ url: 'https://empliados.net', siteLabel: 'Empliados' }}
        />
      </div>
    </div>
  );
}
