'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Mail,
  TrendingUp,
  Users,
} from 'lucide-react';
import { AcquisitionReportDashboard } from '@/components/reportes/acquisition-report-dashboard';
import { EmailOutreachReportDashboard } from '@/components/reportes/email-outreach-report-dashboard';
import { OnboardingReportDashboard } from '@/components/reportes/onboarding-report-dashboard';
import { setAdminUiFetchOverride } from '@/lib/admin-ui-client-fetch';
import { createPortalEmailDemoFetch } from '@/lib/portal-email-demo-data';
import { createPortalReportesLoaders } from '@/lib/portal-reportes-demo-data';
import type { AcquisitionReport, EmailOutreachReport, OnboardingProfileReport } from '@/lib/api';

type SubView = 'hub' | 'adquisicion' | 'onboarding' | 'email-outreach';

function fmt(n: number) {
  return n.toLocaleString('es-AR');
}

function pct(n: number) {
  return `${Math.round(n * 1000) / 10}%`;
}

/**
 * Hub Reportes Agency (layout Stitch) + sub-reportes con loaders en vivo.
 */
export function AgencyReportesView() {
  const [sub, setSub] = useState<SubView>('hub');
  const loaders = useMemo(() => createPortalReportesLoaders(), []);
  const [acq, setAcq] = useState<AcquisitionReport | null>(null);
  const [onb, setOnb] = useState<OnboardingProfileReport | null>(null);
  const [email, setEmail] = useState<EmailOutreachReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);

  useEffect(() => {
    setAdminUiFetchOverride(createPortalEmailDemoFetch());
    return () => setAdminUiFetchOverride(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const [a, o, e] = await Promise.all([
          loaders.acquisition(30),
          loaders.onboardingProfile(30),
          loaders.emailOutreach(30),
        ]);
        if (cancelled) return;
        setAcq(a);
        setOnb(o);
        setEmail(e);
        // Heurística: los demos Empliados usan asOf fijo 2026-09-17.
        setLive(!String(a.asOf || '').startsWith('2026-09-17'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loaders]);

  if (sub !== 'hub') {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setSub('hub')}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#4648d4] hover:text-[#3730a3]"
        >
          ← Volver a Reportes
        </button>
        {sub === 'adquisicion' ? (
          <AcquisitionReportDashboard
            mode="portal"
            loadAcquisition={loaders.acquisition}
            searchDiagnostics={loaders.searchDiagnostics}
          />
        ) : null}
        {sub === 'onboarding' ? (
          <OnboardingReportDashboard mode="portal" loadOnboarding={loaders.onboardingProfile} />
        ) : null}
        {sub === 'email-outreach' ? (
          <EmailOutreachReportDashboard mode="portal" loadEmailOutreach={loaders.emailOutreach} />
        ) : null}
      </div>
    );
  }

  const leads = acq?.totals.diagnosticsInWindow ?? 0;
  const completed = acq?.totals.completedInWindow ?? 0;
  const openRate = email?.outreach.rates.openRate ?? 0;
  const bounceRate = email?.outreach.rates.bounceRate ?? 0;
  const perDay =
    acq && acq.windowDays > 0 ? Math.round((acq.totals.diagnosticsInWindow / acq.windowDays) * 10) / 10 : 0;

  const countries = onb?.availableCountries ?? [];
  const countryTotal = countries.reduce((s, c) => s + c.count, 0) || 1;
  const topCountries = [...countries].sort((a, b) => b.count - a.count).slice(0, 3);
  const countryBars = topCountries.map((c) => ({
    label: c.country || 'Otros',
    pct: Math.round((c.count / countryTotal) * 100),
  }));

  const cards = [
    {
      id: 'adquisicion' as const,
      title: 'Adquisición y Embudo Comercial',
      description:
        'Quién entra al sistema, canales de procedencia, cuántos completan el diagnóstico y dejan email. Top referidores y UTMs.',
      icon: <BarChart3 className="h-5 w-5" />,
      tone: 'bg-[#eef2ff] text-[#4648d4]',
      metrics: [
        `Diagnósticos: ${fmt(leads)} (30d)`,
        `Completion: ${acq ? pct(acq.totals.completionRate) : '—'}`,
        `Email capture: ${acq ? pct(acq.totals.emailCaptureRate) : '—'}`,
        `Ritmo ~${perDay}/día`,
      ],
      footerLabel: 'Tendencia de ingreso (30D)',
      footerValue: `${perDay}/día prom.`,
    },
    {
      id: 'onboarding' as const,
      title: 'Onboarding & Perfil de Leads',
      description:
        'Diagnósticos con país, nombre o canal de discovery en el wizard. Solo quienes completaron algún dato de perfil.',
      icon: <ClipboardList className="h-5 w-5" />,
      tone: 'bg-[#ede9fe] text-[#7c3aed]',
      metrics: [
        `Con perfil: ${fmt(onb?.totals.withProfileData ?? 0)}`,
        `Con país: ${fmt(onb?.totals.withCountry ?? 0)}`,
        `Con nombre: ${fmt(onb?.totals.withName ?? 0)}`,
        countryBars.length
          ? countryBars.map((c) => `${c.label} ${c.pct}%`).join(' · ')
          : 'Sin desglose regional',
      ],
      footerLabel: 'Distribución regional',
      footerValue: countryBars.map((c) => c.label).join(' / ') || '—',
    },
    {
      id: 'email-outreach' as const,
      title: 'Email & Outreach Competitivo',
      description:
        'Performance de secuencias y cold outreach: enviados, open, click y bounce. Estado Resend / webhook.',
      icon: <Mail className="h-5 w-5" />,
      tone: 'bg-[#ecfdf5] text-[#047857]',
      metrics: [
        `Enviados: ${fmt(email?.outreach.totals.sent ?? 0)}`,
        `Open rate: ${pct(openRate)}`,
        `Bounce: ${pct(bounceRate)}`,
        `Weekly sent: ${fmt(email?.weekly.totals.sent ?? 0)}`,
      ],
      footerLabel: 'Tasa de apertura verificada',
      footerValue: pct(openRate),
    },
  ];

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">
            Módulo de Negocio · BI & Analytics
          </p>
          <h1 className="mt-1 text-[28px] font-bold tracking-tight text-[#0f172a]">
            Centro de Reportes & Inteligencia
          </h1>
          <p className="mt-1 max-w-2xl text-[14px] text-[#64748b]">
            Adquisición, onboarding y email ·{' '}
            {live ? 'datos en vivo del sistema Cleexs' : 'demo Empliados (fallback)'}.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-[12px] font-semibold text-[#334155] shadow-sm ring-1 ring-[#e2e8f0]">
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#4648d4]" />
          ) : live ? (
            <span className="h-1.5 w-1.5 rounded-full bg-[#10b981]" />
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          )}
          {loading ? 'Cargando…' : live ? 'En vivo' : 'Demo fallback'}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          {
            label: 'Leads totales',
            value: fmt(leads),
            hint: 'Diagnósticos 30d',
            icon: <Users className="h-4 w-4 text-[#4648d4]" />,
          },
          {
            label: 'Diagnósticos completados',
            value: fmt(completed),
            hint: acq ? pct(acq.totals.completionRate) : '—',
            icon: <CheckCircle2 className="h-4 w-4 text-[#047857]" />,
          },
          {
            label: 'Open rate outreach',
            value: pct(openRate),
            hint: 'Verificado',
            icon: <Mail className="h-4 w-4 text-[#059669]" />,
          },
          {
            label: 'Bounce rate',
            value: pct(bounceRate),
            hint: 'Outreach',
            icon: <TrendingUp className="h-4 w-4 text-[#4648d4]" />,
          },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-[#e2e8f0]"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">
                {k.label}
              </span>
              {k.icon}
            </div>
            <p className="mt-2 text-[26px] font-bold tabular-nums tracking-tight text-[#0f172a]">{k.value}</p>
            <p className="text-[12px] text-[#64748b]">{k.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {cards.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setSub(c.id)}
            className="group flex flex-col justify-between rounded-xl bg-white p-5 text-left shadow-sm ring-1 ring-[#e2e8f0] transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div>
              <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${c.tone}`}>
                {c.icon}
              </div>
              <h2 className="text-[18px] font-bold tracking-tight text-[#0f172a]">{c.title}</h2>
              <p className="mt-2 text-[13px] leading-relaxed text-[#64748b]">{c.description}</p>
              <ul className="mt-4 space-y-1.5 text-[12px] text-[#475569]">
                {c.metrics.map((m) => (
                  <li key={m} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#4648d4]" />
                    <span>{m}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-5 border-t border-[#f1f5f9] pt-4">
              <div className="mb-3 flex items-center justify-between text-[11px]">
                <span className="font-semibold uppercase tracking-wider text-[#94a3b8]">{c.footerLabel}</span>
                <span className="font-bold tabular-nums text-[#4648d4]">{c.footerValue}</span>
              </div>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#4648d4] group-hover:gap-2.5 transition-all">
                Abrir reporte
                <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </button>
        ))}
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-[#e2e8f0]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f1f5f9] text-[#4648d4]">
              <CalendarClock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-[#0f172a]">Reportes programados & automatizaciones</h3>
              <p className="text-[13px] text-[#64748b]">
                Distribución automatizada por correo hacia directores y equipos de Revenue Ops.
              </p>
            </div>
          </div>
          <span className="rounded-full bg-[#f1f5f9] px-3 py-1 text-[11px] font-semibold text-[#64748b]">
            Próximamente
          </span>
        </div>
      </div>
    </div>
  );
}
