'use client';

import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  BarChart3,
  DollarSign,
  Eye,
  Globe,
  Lock,
  Mail,
  Share2,
  Users,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

type LandingKey = 'all' | 'home' | 'meta-v1';

type FunnelMock = {
  visitors: number;
  views: number;
  url: number;
  email: number;
  shared: number;
  referred: number;
  unlock: number;
  purchased: number;
  hint: string;
};

const LANDINGS: Array<{ key: LandingKey; label: string; sub: string }> = [
  { key: 'all', label: 'Todas', sub: 'Home + landings' },
  { key: 'home', label: 'Home', sub: 'cleexs.net/' },
  { key: 'meta-v1', label: 'Meta', sub: '/meta · meta-v1' },
];

/** Datos ficticios solo para validar UI / concepto. */
const MOCK: Record<LandingKey, FunnelMock> = {
  all: {
    visitors: 1280,
    views: 1940,
    url: 410,
    email: 186,
    shared: 42,
    referred: 28,
    unlock: 61,
    purchased: 7,
    hint: 'Suma de todas las landings conocidas (ejemplo)',
  },
  home: {
    visitors: 1120,
    views: 1680,
    url: 360,
    email: 168,
    shared: 38,
    referred: 24,
    unlock: 54,
    purchased: 6,
    hint: 'path /, /home, /inicio',
  },
  'meta-v1': {
    visitors: 160,
    views: 260,
    url: 50,
    email: 18,
    shared: 4,
    referred: 4,
    unlock: 7,
    purchased: 1,
    hint: 'path /meta · utm_campaign=meta-v1',
  },
};

function pct(num: number, den: number): string {
  if (den <= 0) return '—';
  return `${Math.round((num / den) * 1000) / 10}%`;
}

function fmt(n: number): string {
  return n.toLocaleString('es-AR');
}

function Card({
  icon,
  label,
  value,
  pctLabel,
  pctHint,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  pctLabel?: string;
  pctHint?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-xs font-medium text-slate-500">
        {icon}
        {label}
      </div>
      <p className="text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      {pctLabel ? (
        <p className="mt-1 text-xs text-slate-500">
          <span className="font-semibold text-emerald-700">{pctLabel}</span>
          {pctHint ? ` ${pctHint}` : null}
        </p>
      ) : null}
      {hint ? <p className="mt-2 text-[11px] leading-snug text-slate-400">{hint}</p> : null}
    </div>
  );
}

export default function ConversionLandingsEjemploPage() {
  const [landing, setLanding] = useState<LandingKey>('meta-v1');
  const data = MOCK[landing];
  const active = useMemo(() => LANDINGS.find((l) => l.key === landing), [landing]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <strong className="font-semibold">Página de ejemplo</strong> — datos ficticios. Sirve para
        validar el filtro por landing antes de cablear la API real.
      </div>

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <BarChart3 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Conversión · por landing</h1>
            <p className="text-sm text-slate-600">
              Misma estructura que Métricas de Conversión, con selector de origen.
            </p>
          </div>
        </div>
        <Link
          href="/admin/conversion"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a métricas reales
        </Link>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">
          Landing
        </p>
        <div className="flex flex-wrap gap-2">
          {LANDINGS.map((l) => (
            <button
              key={l.key}
              type="button"
              onClick={() => setLanding(l.key)}
              className={`rounded-xl px-3.5 py-2 text-left transition ${
                landing === l.key
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span className="block text-sm font-semibold">{l.label}</span>
              <span
                className={`block text-[11px] ${
                  landing === l.key ? 'text-emerald-100' : 'text-slate-500'
                }`}
              >
                {l.sub}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Activo: <span className="font-medium text-slate-800">{active?.label}</span> — {data.hint}
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <Card
          icon={<Eye className="h-4 w-4 text-slate-600" />}
          label="Visitantes"
          value={fmt(data.visitors)}
          pctLabel="100%"
          hint={`${fmt(data.views)} vistas · ${data.hint}`}
        />
        <Card
          icon={<Globe className="h-4 w-4 text-sky-600" />}
          label="Pusieron URL"
          value={fmt(data.url)}
          pctLabel={pct(data.url, data.visitors)}
          pctHint="de visitantes"
        />
        <Card
          icon={<Mail className="h-4 w-4 text-violet-600" />}
          label="Dejaron email"
          value={fmt(data.email)}
          pctLabel={pct(data.email, data.url)}
          pctHint="de URL"
        />
        <Card
          icon={<Share2 className="h-4 w-4 text-amber-600" />}
          label="Compartieron"
          value={fmt(data.shared)}
          pctLabel={pct(data.shared, data.url)}
          pctHint="de URL"
        />
        <Card
          icon={<Users className="h-4 w-4 text-emerald-600" />}
          label="Referidos"
          value={fmt(data.referred)}
          pctLabel={pct(data.referred, data.visitors)}
          pctHint="del tráfico"
        />
        <Card
          icon={<Lock className="h-4 w-4 text-violet-600" />}
          label="Clics Plan Conquistar"
          value={fmt(data.unlock)}
          pctLabel={pct(data.unlock, data.email)}
          pctHint="de email"
        />
        <Card
          icon={<DollarSign className="h-4 w-4 text-rose-600" />}
          label="Compraron"
          value={fmt(data.purchased)}
          pctLabel={pct(data.purchased, data.url)}
          pctHint="de URL"
        />
      </section>

      <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
        <p className="font-medium text-slate-800">Próximo paso (cuando apruebes el ejemplo)</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Mismo selector en <code className="text-xs">/admin/conversion</code></li>
          <li>
            Visitantes filtrados por <code className="text-xs">PageView.path</code> de la landing
          </li>
          <li>
            Diagnósticos / compras por <code className="text-xs">utm_campaign</code> (ej.{' '}
            <code className="text-xs">meta-v1</code>)
          </li>
          <li>Nuevas landings = nueva fila en el catálogo</li>
        </ul>
      </section>
    </div>
  );
}
