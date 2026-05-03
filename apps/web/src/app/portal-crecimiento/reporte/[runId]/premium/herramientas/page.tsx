'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  Bot,
  Check,
  CheckCircle2,
  Lightbulb,
  Lock,
  MessageSquare,
  Settings2,
  Sparkles,
  Users,
  Wrench,
  Zap,
} from 'lucide-react';
import { CleexsMark } from '@/components/brand/cleexs-mark';
import { PlanPaymentModal } from '@/components/planes/plan-payment-modal';

const TOKEN_KEY = 'cleexs_portal_token';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const AEO_TOOLKIT_URL = 'https://cleexs-api-ef97.vercel.app/';

type UsageResponse = { planKey?: string; planDisplay?: string };
type RunBrand = { name: string; domain?: string | null };
type RunData = { id: string; brand: RunBrand; priaReports?: Array<{ priaTotal: number }>; promptResults: Array<{ score: number }> };

function toPct(score: number | null | undefined) {
  const n = Number(score);
  if (!Number.isFinite(n)) return 0;
  return n <= 1 ? n * 100 : n;
}

// ── Fake sparkline SVG ───────────────────────────────────────────────────────
function Sparkline({ color = '#7c3aed', height = 40 }: { color?: string; height?: number }) {
  const points = [10, 28, 18, 35, 22, 38, 30, 40, 35, 40];
  const w = 90;
  const maxP = Math.max(...points);
  const xs = points.map((_, i) => (i / (points.length - 1)) * w);
  const ys = points.map((p) => height - (p / maxP) * (height - 4) - 2);
  const d = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x} ${ys[i]}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L ${xs[xs.length - 1]} ${height} L 0 ${height} Z`} fill="url(#sg)" />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Score circle mini ────────────────────────────────────────────────────────
function ScoreBadge({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, Math.round(score)));
  const r = 18;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div className="flex flex-col items-center">
      <svg width="52" height="52" viewBox="0 0 52 52">
        <circle cx="26" cy="26" r={r} fill="none" stroke="#e2e8f0" strokeWidth="4" />
        <circle
          cx="26" cy="26" r={r} fill="none"
          stroke="#7c3aed"
          strokeWidth="4"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          transform="rotate(-90 26 26)"
        />
        <text x="26" y="30" textAnchor="middle" fontSize="12" fontWeight="700" fill="#1e293b">{pct}</text>
      </svg>
      <p className="mt-0.5 text-[10px] text-slate-500">Score</p>
    </div>
  );
}

// ── Tool card — incluido ─────────────────────────────────────────────────────
function IncludedCard({
  icon: Icon,
  name,
  description,
  features,
  score,
  onOpen,
}: {
  icon: React.ComponentType<{ className?: string }>;
  name: string;
  description: string;
  features: string[];
  score: number;
  onOpen: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border-2 border-violet-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600">
            <Icon className="h-5 w-5 text-white" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-bold text-slate-900">{name}</p>
              <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-[10px] font-semibold text-violet-700">
                Incluido
              </span>
            </div>
            <p className="text-xs font-semibold text-emerald-600">Gratis con tu plan</p>
          </div>
        </div>

        {/* Score + sparkline a la derecha */}
        <div className="flex shrink-0 flex-col items-center gap-1 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
          <ScoreBadge score={score} />
          <div className="h-8 w-20">
            <Sparkline color="#7c3aed" height={32} />
          </div>
        </div>
      </div>

      {/* Descripción */}
      <p className="mt-4 text-sm text-slate-600">{description}</p>

      {/* Features */}
      <ul className="mt-3 space-y-1.5">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-xs text-slate-600">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-violet-500" />
            {f}
          </li>
        ))}
      </ul>

      {/* CTA */}
      <button
        type="button"
        onClick={onOpen}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700"
      >
        Abrir herramienta
        <ArrowUpRight className="h-4 w-4" />
      </button>
    </div>
  );
}

// ── Tool card — costo adicional ──────────────────────────────────────────────
function AddonCard({
  icon: Icon,
  iconBg,
  name,
  price,
  description,
  features,
  visual,
  onAdd,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  name: string;
  price: string;
  description: string;
  features: string[];
  visual: React.ReactNode;
  onAdd: () => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
            <Icon className="h-5 w-5 text-white" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-bold text-slate-900">{name}</p>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                Costo adicional
              </span>
            </div>
            <p className="mt-0.5 text-sm font-semibold text-slate-700">{price} <span className="text-xs font-normal text-slate-500">USD / mes</span></p>
          </div>
        </div>
        <div className="shrink-0">{visual}</div>
      </div>

      <p className="mt-3 text-sm text-slate-600">{description}</p>

      <ul className="mt-3 space-y-1.5">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-xs text-slate-500">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-violet-400" />
            {f}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onAdd}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
      >
        <Lock className="h-3.5 w-3.5 text-slate-400" />
        Agregar por {price} USD / mes
      </button>
    </div>
  );
}

// ── SimulateVisual ───────────────────────────────────────────────────────────
function SimulateVisual({ score }: { score: number }) {
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <ScoreBadge score={score} />
        <div className="h-14 w-16 opacity-70">
          <Sparkline color="#7c3aed" height={56} />
        </div>
      </div>
      <p className="text-[9px] text-slate-400">Simulación</p>
    </div>
  );
}

// ── ChatVisual ───────────────────────────────────────────────────────────────
function ChatVisual() {
  return (
    <div className="flex flex-col gap-1.5 opacity-60">
      {['…', '…', '…'].map((_, i) => (
        <div
          key={i}
          className={`h-2 rounded-full bg-slate-200 ${i === 0 ? 'w-16' : i === 1 ? 'w-12' : 'w-10'}`}
        />
      ))}
      <div className="mt-0.5 flex items-center gap-1">
        <div className="h-5 w-5 rounded-full bg-violet-200" />
        <div className="h-2 w-8 rounded-full bg-slate-200" />
      </div>
    </div>
  );
}

// ── AgentesVisual ─────────────────────────────────────────────────────────────
function AgentesVisual() {
  return (
    <div className="flex flex-col gap-1 opacity-60">
      {[true, true, false].map((ok, i) => (
        <div key={i} className="flex items-center gap-1.5">
          {ok ? (
            <Check className="h-3.5 w-3.5 text-violet-500" />
          ) : (
            <div className="h-3.5 w-3.5 rounded-full border-2 border-slate-200" />
          )}
          <div className={`h-2 rounded-full bg-slate-200 ${i === 0 ? 'w-14' : i === 1 ? 'w-10' : 'w-12'}`} />
        </div>
      ))}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function HerramientasPage() {
  const params = useParams();
  const runId = params.runId as string;
  const basePath = `/portal-crecimiento/reporte/${runId}/premium`;

  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [run, setRun] = useState<RunData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pagoOpen, setPagoOpen] = useState(false);
  const [pagoLabel, setPagoLabel] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let token: string | null = null;
        try { token = sessionStorage.getItem(TOKEN_KEY); } catch { token = null; }
        if (!token) { setLoading(false); return; }
        const headers = { Authorization: `Bearer ${token}` };
        const [runRes, usageRes] = await Promise.all([
          fetch(`${API_URL}/api/reports/app/reports/${encodeURIComponent(runId)}`, { cache: 'no-store', headers }),
          fetch(`${API_URL}/api/me/usage`, { cache: 'no-store', headers }),
        ]);
        const runData = runRes.ok ? (await runRes.json() as RunData) : null;
        const usageData = usageRes.ok ? (await usageRes.json() as UsageResponse) : {};
        if (!cancelled) { setRun(runData); setUsage(usageData); setLoading(false); }
      } catch { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [runId]);

  const brandDomain = run?.brand?.domain?.replace(/^https?:\/\//, '').replace(/\/$/, '') ?? '';
  const brandUrl = brandDomain ? `https://${brandDomain}` : '';
  const aeoUrl = brandUrl
    ? `${AEO_TOOLKIT_URL}?url=${encodeURIComponent(brandUrl)}`
    : AEO_TOOLKIT_URL;

  const rawScore =
    run?.priaReports?.[0]?.priaTotal ??
    (run?.promptResults?.length
      ? run.promptResults.reduce((a, b) => a + toPct(b.score), 0) / run.promptResults.length
      : 72);
  const score = Math.round(toPct(rawScore));

  function openAddon(label: string) {
    setPagoLabel(label);
    setPagoOpen(true);
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50/30 p-3 sm:p-5">
      <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[220px_1fr]">

        {/* ── Sidebar ──────────────────────────────────────────────── */}
        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <CleexsMark className="h-6 w-6" />
            <p className="font-bold text-slate-900">Cleexs</p>
          </div>
          <nav className="space-y-1 text-sm">
            <Link href={`${basePath}#portal-cliente`} className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50">Portal cliente</Link>
            <Link href={`${basePath}#comparacion`} className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50">Comparación</Link>
            <Link href={`${basePath}#prompts`} className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50">Prompts</Link>
            <Link href={`${basePath}#competidores`} className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50">Competidores</Link>
            <Link href={`${basePath}#historial`} className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50">Historial</Link>
            <Link href={`${basePath}#reportes`} className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50">Reportes</Link>
            <Link href={`${basePath}/suscripcion`} className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50">Suscripción</Link>
            <Link href={`${basePath}/equipo`} className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50">Equipo</Link>
            <Link href={`${basePath}/herramientas`} className="block rounded-lg bg-violet-50 px-3 py-2 font-semibold text-violet-900">Herramientas</Link>
          </nav>
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Plan actual</p>
            <p className="font-semibold text-slate-900">
              {loading ? '…' : (usage?.planDisplay || usage?.planKey || 'Premium')}
            </p>
          </div>
        </aside>

        {/* ── Contenido ────────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* Header */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-100 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
              <Settings2 className="h-3.5 w-3.5" />
              Herramientas
            </div>
            <h1 className="text-3xl font-bold text-slate-900">Herramientas</h1>
            <p className="mt-2 text-sm text-slate-600">
              Potenciá tu estrategia con herramientas diseñadas para<br />
              medir, entender y mejorar tu presencia en IA.
            </p>
          </div>

          {/* Stats bar */}
          <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            {/* Plan */}
            <div className="flex items-center gap-3 border-r border-slate-100 pr-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100">
                <Wrench className="h-5 w-5 text-violet-700" />
              </span>
              <div>
                <p className="text-[11px] text-slate-500">Tu plan actual</p>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-slate-900">
                    {loading ? '…' : (usage?.planDisplay || usage?.planKey || 'Premium Mensual')}
                  </p>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Activo</span>
                </div>
                <p className="text-[10px] text-slate-500">Accedé a las herramientas incluidas en tu plan y potenciá tus resultados.</p>
              </div>
            </div>

            {/* Herramientas incluidas */}
            <div className="flex items-center gap-2 border-r border-slate-100 pr-4">
              <CheckCircle2 className="h-5 w-5 text-violet-500" />
              <div>
                <p className="text-[10px] text-slate-500">Herramientas incluidas</p>
                <p className="font-bold text-slate-900">
                  <span className="text-violet-700">1</span> de 4
                </p>
              </div>
            </div>

            {/* Usuarios del equipo */}
            <div className="flex items-center gap-2 border-r border-slate-100 pr-4">
              <Users className="h-5 w-5 text-slate-400" />
              <div>
                <p className="text-[10px] text-slate-500">Usuarios del equipo</p>
                <div className="flex items-center gap-1.5">
                  <p className="font-bold text-slate-900">7/10</p>
                  <Link href={`${basePath}/equipo`} className="text-[10px] font-semibold text-violet-700 hover:underline">
                    Gestionar
                  </Link>
                </div>
              </div>
            </div>

            {/* Siguiente facturación */}
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-slate-400" />
              <div>
                <p className="text-[10px] text-slate-500">Siguiente facturación</p>
                <div className="flex items-center gap-1.5">
                  <p className="font-bold text-slate-900">12/05/2025</p>
                  <Link href={`${basePath}/suscripcion`} className="text-[10px] font-semibold text-violet-700 hover:underline">
                    Ver suscripción
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Tool cards grid */}
          <div className="grid gap-5 sm:grid-cols-2">
            {/* AEO ToolKit — incluido */}
            <IncludedCard
              icon={Zap}
              name="AEO ToolKit"
              description="Conjunto de herramientas para analizar, optimizar y monitorear tu visibilidad en motores de IA."
              features={[
                'Auditoría de presencia en IA',
                'Análisis de prompts y respuestas',
                'Recomendaciones accionables',
              ]}
              score={score}
              onOpen={() => window.open(brandUrl ? aeoUrl : AEO_TOOLKIT_URL, '_blank', 'noopener,noreferrer')}
            />

            {/* Chat Funcional */}
            <AddonCard
              icon={MessageSquare}
              iconBg="bg-blue-500"
              name="Chat Funcional"
              price="$15"
              description="Chat con tus datos y contexto de marca. Respuestas personalizadas y accionables."
              features={[
                'Entrenado con tus documentos',
                'Respuestas basadas en tu contexto',
                'Exportación de conversaciones',
              ]}
              visual={<ChatVisual />}
              onAdd={() => openAddon('Chat Funcional — $15 USD/mes')}
            />

            {/* Agentes IAv 256 */}
            <AddonCard
              icon={Bot}
              iconBg="bg-violet-600"
              name="Agentes IAv 256"
              price="$29"
              description="Agentes de IA para automatizar análisis, monitoreo y generación de insights."
              features={[
                'Monitoreo automático 24/7',
                'Alertas inteligentes',
                'Reportes automáticos',
              ]}
              visual={<AgentesVisual />}
              onAdd={() => openAddon('Agentes IAv 256 — $29 USD/mes')}
            />

            {/* Cleexs Simulate */}
            <AddonCard
              icon={Lightbulb}
              iconBg="bg-indigo-500"
              name="Cleexs Simulate"
              price="$19"
              description="Simulá cómo te ve la IA ante diferentes consultas y escenarios competitivos."
              features={[
                'Simulación de prompts',
                'Escenarios competitivos',
                'Comparativas de visibilidad',
              ]}
              visual={<SimulateVisual score={score} />}
              onAdd={() => openAddon('Cleexs Simulate — $19 USD/mes')}
            />
          </div>

          {/* Bottom banner */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100">
                <Lightbulb className="h-5 w-5 text-violet-700" />
              </span>
              <div>
                <p className="font-semibold text-slate-900">¿Necesitás una herramienta personalizada?</p>
                <p className="text-xs text-slate-500">Desarrollamos soluciones a medida para tus necesidades específicas.</p>
              </div>
            </div>
            <a
              href="mailto:hola@cleexs.com"
              className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-white px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50"
            >
              Hablar con un experto
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>

      {/* Mensaje de qué herramienta se está agregando */}
      {pagoOpen && pagoLabel && (
        <div className="fixed left-1/2 top-5 z-[60] -translate-x-1/2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-xs font-semibold text-violet-800 shadow-lg">
          Activando: {pagoLabel}
        </div>
      )}

      <PlanPaymentModal
        open={pagoOpen}
        onOpenChange={setPagoOpen}
        planId="crecimiento"
        billingMode="monthly"
        onConfirm={() => setPagoOpen(false)}
      />
    </main>
  );
}
