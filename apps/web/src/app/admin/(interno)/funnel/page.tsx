'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminAuthExpiredCard, looksLikeAdminAuthError } from '@/components/admin/admin-callout';
import {
  FunnelDashboard,
  type FunnelMetrics,
} from '@/components/funnel/funnel-dashboard';
import { adminUiFetch } from '@/lib/admin-ui-client-fetch';
import { addDaysToDayString, formatDayInArgentina } from '@cleexs/shared';

export const dynamic = 'force-dynamic';

function rangeForPreset(preset: 'hoy' | 'ayer' | '7' | '15' | '30'): { from: string; to: string } {
  const today = formatDayInArgentina();
  if (preset === 'hoy') return { from: today, to: today };
  if (preset === 'ayer') {
    const yesterday = addDaysToDayString(today, -1);
    return { from: yesterday, to: yesterday };
  }
  const span = preset === '7' ? 6 : preset === '15' ? 14 : 29;
  return { from: addDaysToDayString(today, -span), to: today };
}

export default function AdminFunnelPage() {
  const initial = useMemo(() => rangeForPreset('30'), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [activePreset, setActivePreset] = useState<string | null>('30');
  const [adSpendInput, setAdSpendInput] = useState('');
  const [data, setData] = useState<FunnelMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from, to });
      const spend = Number(adSpendInput.replace(',', '.'));
      if (Number.isFinite(spend) && spend >= 0 && adSpendInput.trim() !== '') {
        params.set('adSpendUsd', String(spend));
      }
      const res = await adminUiFetch(`/api/admin-ui/funnel?${params.toString()}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error || 'Error al cargar el funnel');
      setData(json as FunnelMetrics);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [from, to, adSpendInput]);

  useEffect(() => {
    void load();
  }, [from, to]); // eslint-disable-line react-hooks/exhaustive-deps -- ad spend se aplica con "Actualizar"

  function applyPreset(preset: 'hoy' | 'ayer' | '7' | '15' | '30') {
    const r = rangeForPreset(preset);
    setFrom(r.from);
    setTo(r.to);
    setActivePreset(preset);
  }

  const periodLabel =
    activePreset === 'hoy'
      ? 'Hoy'
      : activePreset === 'ayer'
        ? 'Ayer'
        : activePreset === '7'
          ? 'Últimos 7 días'
          : activePreset === '15'
            ? 'Últimos 15 días'
            : activePreset === '30'
              ? 'Últimos 30 días'
              : `${from} → ${to}`;

  if (error && looksLikeAdminAuthError(error)) {
    return <AdminAuthExpiredCard />;
  }

  return (
    <FunnelDashboard
      data={data}
      loading={loading}
      error={error}
      periodLabel={periodLabel}
      from={from}
      to={to}
      activePreset={activePreset}
      onPreset={applyPreset}
      onFromChange={(v) => {
        setFrom(v);
        setActivePreset(null);
      }}
      onToChange={(v) => {
        setTo(v);
        setActivePreset(null);
      }}
      maxTo={formatDayInArgentina()}
      adSpendInput={adSpendInput}
      setAdSpendInput={setAdSpendInput}
      onRefresh={() => void load()}
      onApplySpend={() => void load()}
    />
  );
}
