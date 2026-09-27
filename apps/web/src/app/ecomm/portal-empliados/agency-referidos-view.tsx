'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, MousePointerClick, QrCode, Users } from 'lucide-react';
import { ReferidoresDashboard, type ReferralDashboard } from '@/components/referidores/referidores-dashboard';
import { SponsorLinkBuilder } from '@/components/tools/sponsor-link-builder';

function fmt(n: number) {
  return n.toLocaleString('es-AR');
}

/**
 * Campañas + Referidos Agency (Stitch) con APIs en vivo:
 * - Campañas: SponsorLinkBuilder (QR / links / sync)
 * - Referidos: ReferidoresDashboard → /api/borrador/portal-referrals
 */
export function AgencyReferidosView() {
  const [tab, setTab] = useState<'campanas' | 'referidos'>('campanas');
  const [summary, setSummary] = useState<ReferralDashboard | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  const fetcher = useCallback((path: string, init?: RequestInit) => fetch(path, { ...init, cache: 'no-store' }), []);

  useEffect(() => {
    let cancelled = false;
    setLoadingSummary(true);
    void (async () => {
      try {
        const res = await fetcher('/api/borrador/portal-referrals');
        const json = await res.json().catch(() => null);
        if (!cancelled && res.ok && json) setSummary(json as ReferralDashboard);
      } finally {
        if (!cancelled) setLoadingSummary(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetcher, tab]);

  const rows = summary?.rows ?? [];
  const activeCampaigns = rows.filter((r) => r.registered && r.active).length;
  const totalEmails = summary?.summary?.totalUniqueEmails ?? 0;
  const attributed = summary?.summary?.attributedUniqueEmails ?? 0;
  const clicks = rows.reduce((s, r) => s + (r.clicks30d || 0), 0);

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">
            Crecimiento & Adquisición
          </p>
          <h1 className="mt-1 text-[28px] font-bold tracking-tight text-[#0f172a]">
            Campañas y Tracking de Referidos
          </h1>
          <p className="mt-1 max-w-2xl text-[14px] text-[#64748b]">
            Generá links/QR de auspiciadores y medí emails únicos por código ref · datos en vivo.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-[12px] font-semibold text-[#334155] shadow-sm ring-1 ring-[#e2e8f0]">
          {loadingSummary ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#4648d4]" />
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-[#10b981]" />
          )}
          Live Tracker
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          {
            label: 'Campañas activas',
            value: fmt(activeCampaigns),
            hint: 'Registradas y activas',
            icon: <QrCode className="h-4 w-4 text-[#4648d4]" />,
          },
          {
            label: 'Emails únicos',
            value: fmt(totalEmails),
            hint: `${fmt(attributed)} con ref`,
            icon: <Users className="h-4 w-4 text-[#047857]" />,
          },
          {
            label: 'Clics del mes',
            value: fmt(clicks),
            hint: 'Últimos 30 días · /r/ref',
            icon: <MousePointerClick className="h-4 w-4 text-[#4648d4]" />,
          },
          {
            label: 'Refs en ranking',
            value: fmt(rows.filter((r) => !r.isUnattributed).length),
            hint: 'Incluye orgánicos',
            icon: <Users className="h-4 w-4 text-[#7c3aed]" />,
          },
        ].map((k) => (
          <div key={k.label} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-[#e2e8f0]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">{k.label}</span>
              {k.icon}
            </div>
            <p className="mt-2 text-[26px] font-bold tabular-nums tracking-tight text-[#0f172a]">{k.value}</p>
            <p className="text-[12px] text-[#64748b]">{k.hint}</p>
          </div>
        ))}
      </div>

      <div className="inline-flex rounded-lg bg-[#f1f5f9] p-1 shadow-sm">
        {(
          [
            ['campanas', 'Nueva campaña / Auspiciador'],
            ['referidos', 'Campañas activas & rendimiento'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-md px-3.5 py-1.5 text-[12px] font-semibold transition ${
              tab === id
                ? 'bg-white text-[#4648d4] shadow-[0_1px_3px_rgba(0,0,0,0.06)]'
                : 'text-[#64748b] hover:text-[#0f172a]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'campanas' ? (
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-[#e2e8f0] sm:p-6">
          <SponsorLinkBuilder
            brand={{
              title: 'Nueva campaña / Auspiciador',
              subtitle:
                'Generá link web, QR WhatsApp con mensaje de campaña y seguí conversiones por ref (web y WhatsApp) para Empliados.',
              rankingHint: 'Las campañas se sincronizan al ranking de Referidos (emails por código ref).',
              marketingHomeLabel: 'home de empliados.net',
              marketingBaseUrl: 'https://empliados.net',
              hideMark: true,
              defaultSponsorName: 'Revista Logística',
              defaultRef: 'revista_logistica',
              defaultUtmCampaign: 'empliados_demo',
            }}
          />
        </div>
      ) : (
        <ReferidoresDashboard
          apiBase="/api/borrador/portal-referrals"
          fetcher={fetcher}
          variant="agency"
          title="Campañas activas & rendimiento"
          subtitle="Ranking en vivo por emails únicos · crear/editar campañas · export CSV."
        />
      )}
    </div>
  );
}
