'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { CleexsMark } from '@/components/brand/cleexs-mark';
import { InterpretacionAmpliadaCorridasBlock } from '@/components/report/interpretacion-ampliada-corridas-block';
import {
  computeInterpretacionAmpliada,
  type CorridasPromptRow,
} from '@/lib/interpretacion-ampliada-corridas';

const TOKEN_KEY = 'cleexs_portal_token';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type PortalRunDetail = {
  id: string;
  status: string;
  brand: {
    name: string;
    aliases: Array<{ id: string; alias: string }>;
  };
  priaReports?: Array<{ priaTotal: number }>;
  promptResults: Array<{
    score: number;
    responseText: string;
    top3Json: unknown;
    prompt?: { promptText?: string; category?: { name?: string } | null };
  }>;
};

type UsageResponse = {
  planKey?: string;
  planDisplay?: string;
};

function isPremiumPlan(planKey?: string) {
  return planKey === 'crecimiento' || planKey === 'enterprise';
}

export default function PortalReportePremiumInterpretacionPage() {
  const params = useParams();
  const runId = params.runId as string;
  const [run, setRun] = useState<PortalRunDetail | null>(null);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        let token: string | null = null;
        try {
          token = sessionStorage.getItem(TOKEN_KEY);
        } catch {
          token = null;
        }
        if (!token) {
          setError('No hay sesión. Volvé al portal e iniciá sesión.');
          setLoading(false);
          return;
        }
        const headers = { Authorization: `Bearer ${token}` };
        const [runRes, usageRes] = await Promise.all([
          fetch(`${API_URL}/api/reports/app/reports/${encodeURIComponent(runId)}`, {
            cache: 'no-store',
            headers,
          }),
          fetch(`${API_URL}/api/me/usage`, { cache: 'no-store', headers }),
        ]);
        if (runRes.status === 401 || usageRes.status === 401) {
          sessionStorage.removeItem(TOKEN_KEY);
          setError('Sesión vencida. Volvé al portal e iniciá sesión.');
          setLoading(false);
          return;
        }
        if (!usageRes.ok) {
          const u = await usageRes.json().catch(() => ({}));
          throw new Error((u as { error?: string }).error || `Error usage ${usageRes.status}`);
        }
        if (!runRes.ok) {
          const b = await runRes.json().catch(() => ({}));
          throw new Error((b as { error?: string }).error || `Error ${runRes.status}`);
        }
        const usageData = (await usageRes.json()) as UsageResponse;
        const runData = (await runRes.json()) as PortalRunDetail;
        if (!cancelled) {
          setUsage(usageData);
          setRun(runData);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error al cargar');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runId]);

  const prompts: CorridasPromptRow[] = useMemo(() => {
    if (!run) return [];
    return run.promptResults.map((pr) => ({
      score: pr.score,
      responseText: pr.responseText,
      top3Json: (pr.top3Json as CorridasPromptRow['top3Json']) ?? null,
      promptText: pr.prompt?.promptText ?? null,
      category: pr.prompt?.category?.name ?? null,
    }));
  }, [run]);

  const brandAliases = run?.brand.aliases.map((a) => a.alias).filter(Boolean) ?? [];
  const cleexsScoreHint = run?.priaReports?.[0]?.priaTotal ?? null;

  const { parrafos, winnerLabels } = useMemo(() => {
    if (!run) return { parrafos: [] as string[], winnerLabels: [] as string[] };
    return computeInterpretacionAmpliada(prompts, run.brand.name, brandAliases, cleexsScoreHint);
  }, [run, prompts, brandAliases, cleexsScoreHint]);

  const premium = isPremiumPlan(usage?.planKey);

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 p-6">
        <p className="text-center text-sm text-slate-600">Cargando…</p>
      </main>
    );
  }

  if (error || !run) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-6">
        <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-red-200/80 bg-red-50/90 p-6 text-sm text-red-900">
          <p>{error || 'No encontrado.'}</p>
          <Link href="/portal-crecimiento" className="font-semibold text-primary-700 underline">
            ← Portal
          </Link>
        </div>
      </main>
    );
  }

  if (!premium) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50/80 p-4 pb-16 sm:p-6">
        <div className="mx-auto max-w-lg space-y-6">
          <Link
            href={`/portal-crecimiento/reporte/${runId}`}
            className="text-sm font-semibold text-primary-700 underline-offset-2 hover:underline"
          >
            ← Volver al informe
          </Link>
          <div className="rounded-2xl border border-amber-200/80 bg-amber-50/90 p-6 shadow-sm">
            <p className="text-base font-bold text-amber-950">Interpretación ampliada · Plan Premium</p>
            <p className="mt-2 text-sm leading-relaxed text-amber-900/90">
              Esta lectura detallada está incluida en el plan <strong>Premium</strong> (y superiores). Tu cuenta
              actualmente tiene el plan <strong>{usage?.planDisplay || usage?.planKey || 'Plan'}</strong>.
            </p>
            <Link
              href="/planes"
              className="mt-4 inline-flex rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
            >
              Ver Plan y Premium
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50/80 p-4 pb-16 sm:p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={`/portal-crecimiento/reporte/${runId}`}
            className="text-sm font-semibold text-primary-700 underline-offset-2 hover:underline"
          >
            ← Volver al informe
          </Link>
          <CleexsMark className="h-7 w-7 shrink-0" />
        </div>

        <header className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-100/60 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Premium · lectura extendida</p>
          <h1 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">{run.brand.name}</h1>
          <p className="mt-1 text-sm text-slate-600">
            Interpretación ampliada, glosario y guías de lectura para esta corrida (
            <span className="font-mono text-xs">{run.id.slice(0, 8)}…</span>
            ).
          </p>
        </header>

        <InterpretacionAmpliadaCorridasBlock parrafos={parrafos} winnerLabels={winnerLabels} />
      </div>
    </main>
  );
}
