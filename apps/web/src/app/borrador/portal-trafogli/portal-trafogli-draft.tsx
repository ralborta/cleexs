'use client';

import { useMemo, useState, type ReactNode } from 'react';
import {
  BarChart3,
  Filter,
  FileText,
  Globe2,
  Link2,
  Mail,
  MousePointerClick,
  ScanSearch,
  Search,
  Settings,
  Share2,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';

type SectionId =
  | 'dashboard'
  | 'funnel'
  | 'sov'
  | 'oportunidades'
  | 'contenido'
  | 'outreach'
  | 'email'
  | 'referidos'
  | 'clientes'
  | 'auditoria'
  | 'settings';

type NavLink = {
  id: SectionId;
  label: string;
  icon: typeof Mail;
};

type NavSection = {
  title: string;
  links: NavLink[];
};

const NAV: NavSection[] = [
  {
    title: 'Negocio',
    links: [
      { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
      { id: 'funnel', label: 'Funnel', icon: Filter },
      { id: 'clientes', label: 'Clientes', icon: Users },
      { id: 'referidos', label: 'Referidos', icon: MousePointerClick },
    ],
  },
  {
    title: 'Visibilidad IA',
    links: [
      { id: 'sov', label: 'AI Share of Voice', icon: Sparkles },
      { id: 'oportunidades', label: 'Oportunidades', icon: Search },
      { id: 'contenido', label: 'Contenido', icon: FileText },
      { id: 'outreach', label: 'Links & Outreach', icon: Link2 },
      { id: 'auditoria', label: 'Auditoría', icon: ScanSearch },
    ],
  },
  {
    title: 'Crecimiento',
    links: [
      { id: 'email', label: 'Email · secuencia', icon: Mail },
      { id: 'settings', label: 'Settings', icon: Settings },
    ],
  },
];

const SOV_PROMPTS = [
  { prompt: 'mejores sábanas de bambú Argentina', trafogli: true, rival: 'Bamboo Soft' },
  { prompt: 'sábanas antiácaros para alergias', trafogli: true, rival: 'Natural Bedding' },
  { prompt: 'pijamas de bambú verano', trafogli: false, rival: 'EcoSleep' },
  { prompt: 'sábanas frescas para calor', trafogli: true, rival: 'Bamboo Soft' },
  { prompt: 'ropa de cama sostenible Latam', trafogli: false, rival: 'Green Linen Co' },
  { prompt: 'sábanas bambú vs algodón', trafogli: true, rival: 'Cotton House' },
  { prompt: 'regalo sábanas premium', trafogli: false, rival: 'Linen Studio' },
  { prompt: 'fundas nórdicas hipoalergénicas', trafogli: true, rival: 'Natural Bedding' },
];

const PRODUCTS = [
  { name: 'Sábana Bambú Queen', skus: 8, page: 'Lista', sovHits: 12, status: 'Indexada' },
  { name: 'Juego Completo King', skus: 6, page: 'En progreso', sovHits: 4, status: 'Borrador' },
  { name: 'Pijama Bambú Unisex', skus: 10, page: 'Lista', sovHits: 7, status: 'Indexada' },
  { name: 'Fundas nórdicas', skus: 5, page: 'Pendiente', sovHits: 1, status: '—' },
  { name: 'Toallón Bambú', skus: 4, page: 'Lista', sovHits: 3, status: 'Indexada' },
];

const EMAIL_STEPS = [
  { day: 0, subject: 'Gracias por tu compra · tips de cuidado bambú', active: true },
  { day: 2, subject: '¿Cómo dormiste? + upgrade de fundas', active: true },
  { day: 5, subject: 'Tu link de referidos Trafogli', active: true },
  { day: 12, subject: 'Recompra: 15% en pijamas matching', active: false },
];

function fmt(n: number): string {
  return n.toLocaleString('es-AR');
}

function pct(n: number, d: number): string {
  if (d <= 0) return '—';
  return `${Math.round((n / d) * 1000) / 10}%`;
}

function Card({
  icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-xs font-medium text-slate-500">
        <span className={accent ?? 'text-slate-500'}>{icon}</span>
        {label}
      </div>
      <p className="text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      {hint ? <p className="mt-2 text-[11px] leading-snug text-slate-400">{hint}</p> : null}
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
      <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
    </header>
  );
}

function Panel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Badge({ children, tone = 'violet' }: { children: ReactNode; tone?: 'violet' | 'emerald' | 'amber' | 'slate' }) {
  const cls =
    tone === 'emerald'
      ? 'bg-emerald-50 text-emerald-800 ring-emerald-200/80'
      : tone === 'amber'
        ? 'bg-amber-50 text-amber-900 ring-amber-200/80'
        : tone === 'slate'
          ? 'bg-slate-100 text-slate-700 ring-slate-200'
          : 'bg-violet-50 text-violet-800 ring-violet-200/80';
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${cls}`}>
      {children}
    </span>
  );
}

function DashboardView() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Dashboard"
        subtitle="Vista ejecutiva Trafogli · ventas Shopify + visibilidad en IA."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card icon={<ShoppingBag className="h-4 w-4" />} label="Ventas 7d" value="$ 4.8M" hint="ARS · Shopify" accent="text-emerald-600" />
        <Card icon={<TrendingUp className="h-4 w-4" />} label="Pedidos 7d" value="186" hint="+12% vs semana ant." accent="text-sky-600" />
        <Card icon={<Sparkles className="h-4 w-4" />} label="AI Share of Voice" value="10%" hint="5 / 50 prompts · semanal" accent="text-violet-600" />
        <Card icon={<BarChart3 className="h-4 w-4" />} label="Cleexs Score" value="62" hint="Actualizado lunes" accent="text-indigo-600" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Tendencia SOV (8 semanas)">
          <div className="flex h-36 items-end gap-2">
            {[4, 5, 5, 6, 7, 8, 9, 10].map((v, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div className="w-full rounded-t-md bg-violet-500/90" style={{ height: `${v * 10}%` }} />
                <span className="text-[10px] text-slate-400">S{i + 1}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">De 4% → 10% en 8 semanas midiendo los mismos 50 prompts.</p>
        </Panel>
        <Panel title="Próximas acciones Cleexs">
          <ul className="space-y-3 text-sm text-slate-700">
            <li className="flex gap-3">
              <Badge>SOV</Badge>
              <span>Publicar página profunda · Pijama Bambú (7 prompts sin mención).</span>
            </li>
            <li className="flex gap-3">
              <Badge tone="emerald">Email</Badge>
              <span>Activar paso día 12 (recompra matching).</span>
            </li>
            <li className="flex gap-3">
              <Badge tone="amber">Outreach</Badge>
              <span>12 directorios donde aparece Bamboo Soft y Trafogli no.</span>
            </li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function FunnelView() {
  const steps = [
    { label: 'Visitas tienda', value: 12400, source: 'GA4' },
    { label: 'Vistas producto', value: 6100, source: 'GA4' },
    { label: 'Add to cart', value: 980, source: 'Shopify' },
    { label: 'Checkout', value: 420, source: 'Shopify' },
    { label: 'Compra', value: 186, source: 'Shopify' },
  ];
  return (
    <div className="space-y-6">
      <SectionHeader title="Funnel" subtitle="Conversión de tienda · GA4 + Shopify (mock)." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {steps.map((s, i) => (
          <Card
            key={s.label}
            icon={<Filter className="h-4 w-4" />}
            label={s.label}
            value={fmt(s.value)}
            hint={i === 0 ? s.source : `${pct(s.value, steps[0].value)} del top · ${s.source}`}
            accent="text-violet-600"
          />
        ))}
      </div>
      <Panel title="Canales de entrada (7d)">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="pb-2 pr-4 font-semibold">Fuente</th>
                <th className="pb-2 pr-4 font-semibold">Visitas</th>
                <th className="pb-2 pr-4 font-semibold">Compras</th>
                <th className="pb-2 font-semibold">Conv.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {[
                ['Google', 5200, 71],
                ['Instagram', 3100, 48],
                ['ChatGPT / LLM', 420, 19],
                ['Referidos', 380, 22],
                ['Facebook', 2100, 18],
              ].map(([src, v, c]) => (
                <tr key={String(src)}>
                  <td className="py-2.5 pr-4 font-medium">{src}</td>
                  <td className="py-2.5 pr-4 tabular-nums">{fmt(Number(v))}</td>
                  <td className="py-2.5 pr-4 tabular-nums">{fmt(Number(c))}</td>
                  <td className="py-2.5 tabular-nums">{pct(Number(c), Number(v))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function SovView() {
  const wins = SOV_PROMPTS.filter((p) => p.trafogli).length;
  return (
    <div className="space-y-6">
      <SectionHeader
        title="AI Share of Voice"
        subtitle="50 prompts objetivo · medición semanal en ChatGPT, Gemini, Perplexity y Claude."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card icon={<Sparkles className="h-4 w-4" />} label="SOV actual" value={`${Math.round((wins / 50) * 1000) / 10}%`} hint={`${wins} menciones / 50 prompts (muestra)`} accent="text-violet-600" />
        <Card icon={<Globe2 className="h-4 w-4" />} label="Motores" value="4" hint="ChatGPT · Gemini · Perplexity · Claude" accent="text-sky-600" />
        <Card icon={<TrendingUp className="h-4 w-4" />} label="Δ semanal" value="+1 pp" hint="4 → 5 menciones" accent="text-emerald-600" />
        <Card icon={<Users className="h-4 w-4" />} label="Rival #1" value="Bamboo Soft" hint="18 / 50 prompts" accent="text-amber-600" />
      </div>
      <Panel
        title="Muestra de prompts (8 / 50)"
        action={<Badge>Mock · Discovery</Badge>}
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="pb-2 pr-4 font-semibold">Prompt</th>
                <th className="pb-2 pr-4 font-semibold">Trafogli</th>
                <th className="pb-2 font-semibold">Quién gana hoy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {SOV_PROMPTS.map((row) => (
                <tr key={row.prompt}>
                  <td className="py-2.5 pr-4 text-slate-800">{row.prompt}</td>
                  <td className="py-2.5 pr-4">
                    {row.trafogli ? <Badge tone="emerald">Aparece</Badge> : <Badge tone="slate">No</Badge>}
                  </td>
                  <td className="py-2.5 text-slate-600">{row.trafogli ? 'Trafogli' : row.rival}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function OportunidadesView() {
  const items = [
    { q: 'sábanas bambú para sudoración nocturna', vol: 'Alto', gap: 'Sin página dedicada', action: 'Crear página profunda' },
    { q: 'pijama bambú postpartum', vol: 'Medio', gap: 'Rival responde, Trafogli no', action: 'FAQ + landing' },
    { q: 'sábanas hipoalergénicas niños', vol: 'Alto', gap: 'Mención débil en LLM', action: 'Reforzar FAQ IA' },
    { q: 'cuidado sábanas bambú lavarropa', vol: 'Medio', gap: 'Contenido en blog viejo', action: 'Actualizar + schema' },
  ];
  return (
    <div className="space-y-6">
      <SectionHeader title="Oportunidades" subtitle="Qué busca la gente · Discovery / Teo (mock)." />
      <Panel title="Oportunidades detectadas esta semana">
        <div className="space-y-3">
          {items.map((it) => (
            <div key={it.q} className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-slate-900">{it.q}</p>
                <Badge tone="amber">{it.vol}</Badge>
              </div>
              <p className="mt-1 text-xs text-slate-500">{it.gap}</p>
              <p className="mt-2 text-xs font-medium text-violet-700">{it.action}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function ContenidoView() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Contenido"
        subtitle="Páginas profundas por producto (~25) + FAQ orientadas a IA · ~150 SKU."
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Card icon={<FileText className="h-4 w-4" />} label="Páginas profundas" value="11 / 25" hint="Publicadas" accent="text-violet-600" />
        <Card icon={<Globe2 className="h-4 w-4" />} label="FAQ IA" value="3" hint="Hubs temáticos" accent="text-sky-600" />
        <Card icon={<ScanSearch className="h-4 w-4" />} label="Indexadas" value="9" hint="GSC + bots IA" accent="text-emerald-600" />
      </div>
      <Panel title="Productos principales">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="pb-2 pr-4 font-semibold">Producto</th>
                <th className="pb-2 pr-4 font-semibold">SKUs</th>
                <th className="pb-2 pr-4 font-semibold">Página</th>
                <th className="pb-2 pr-4 font-semibold">Hits SOV</th>
                <th className="pb-2 font-semibold">Index</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {PRODUCTS.map((p) => (
                <tr key={p.name}>
                  <td className="py-2.5 pr-4 font-medium">{p.name}</td>
                  <td className="py-2.5 pr-4 tabular-nums">{p.skus}</td>
                  <td className="py-2.5 pr-4">{p.page}</td>
                  <td className="py-2.5 pr-4 tabular-nums">{p.sovHits}</td>
                  <td className="py-2.5">
                    <Badge tone={p.status === 'Indexada' ? 'emerald' : p.status === 'Borrador' ? 'amber' : 'slate'}>
                      {p.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function OutreachView() {
  return (
    <div className="space-y-6">
      <SectionHeader title="Links & Outreach" subtitle="Backlinks + contacting automático (agente Outreach Cleexs)." />
      <div className="grid gap-3 sm:grid-cols-3">
        <Card icon={<Link2 className="h-4 w-4" />} label="Backlinks activos" value="47" hint="GSC + crawlers" accent="text-violet-600" />
        <Card icon={<Share2 className="h-4 w-4" />} label="Oportunidades" value="12" hint="Donde gana el rival" accent="text-amber-600" />
        <Card icon={<Mail className="h-4 w-4" />} label="Outreach enviados 7d" value="18" hint="Shadow / real" accent="text-sky-600" />
      </div>
      <Panel title="Fuentes donde el rival aparece y Trafogli no">
        <ul className="space-y-2 text-sm text-slate-700">
          {[
            'directoriobambu.com.ar — ficha Bamboo Soft',
            'alergiaslatam.org — guía de textiles',
            'revista-hogar.net — nota “verano fresco”',
            'marketplace-eco.io — categoría sábanas',
          ].map((line) => (
            <li key={line} className="flex items-start gap-2 rounded-lg border border-slate-100 px-3 py-2">
              <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function EmailView() {
  return (
    <div className="space-y-6">
      <SectionHeader title="Email · secuencia" subtitle="Post-compra Trafogli · misma lógica que secuencia free Cleexs." />
      <Panel title="Pasos configurados" action={<Badge tone="emerald">3 activos</Badge>}>
        <div className="space-y-2">
          {EMAIL_STEPS.map((s) => (
            <div
              key={s.day}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 px-4 py-3"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Día {s.day}</p>
                <p className="text-sm text-slate-800">{s.subject}</p>
              </div>
              <Badge tone={s.active ? 'emerald' : 'slate'}>{s.active ? 'Activo' : 'Pausado'}</Badge>
            </div>
          ))}
        </div>
      </Panel>
      <p className="text-xs text-slate-500">
        Enrichment (email + WA + producto) alimenta la personalización de cada paso — ver sección Clientes.
      </p>
    </div>
  );
}

function ReferidosView() {
  return (
    <div className="space-y-6">
      <SectionHeader title="Referidos" subtitle="Link propio por comprador · atribución y beneficio (ya existe en Cleexs)." />
      <div className="grid gap-3 sm:grid-cols-3">
        <Card icon={<MousePointerClick className="h-4 w-4" />} label="Referidores activos" value="64" hint="Con al menos 1 click" accent="text-violet-600" />
        <Card icon={<Users className="h-4 w-4" />} label="Compras atribuidas" value="22" hint="Últimos 30 días" accent="text-emerald-600" />
        <Card icon={<ShoppingBag className="h-4 w-4" />} label="Descuento medio" value="10%" hint="Cupón referido" accent="text-amber-600" />
      </div>
      <Panel title="Ejemplo de link">
        <code className="block rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700 ring-1 ring-slate-200">
          https://trafogli.com/?ref=maria-gomez-8f2a
        </code>
      </Panel>
    </div>
  );
}

function ClientesView() {
  const rows = [
    { email: 'ana@mail.com', wa: '+54 9 11 …', product: 'Sábana Queen', tags: 'alergia, verano' },
    { email: 'leo@mail.com', wa: '+54 9 351 …', product: 'Pijama M', tags: 'regalo, premium' },
    { email: 'sofia@mail.com', wa: '—', product: 'Juego King', tags: 'recompra' },
  ];
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Clientes"
        subtitle="Compra Shopify + enriquecimiento → segmentación para email personalizado."
      />
      <Panel title="Perfiles enriquecidos (mock)">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="pb-2 pr-4 font-semibold">Email</th>
                <th className="pb-2 pr-4 font-semibold">WhatsApp</th>
                <th className="pb-2 pr-4 font-semibold">Producto</th>
                <th className="pb-2 font-semibold">Atributos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {rows.map((r) => (
                <tr key={r.email}>
                  <td className="py-2.5 pr-4 font-medium">{r.email}</td>
                  <td className="py-2.5 pr-4">{r.wa}</td>
                  <td className="py-2.5 pr-4">{r.product}</td>
                  <td className="py-2.5 text-slate-500">{r.tags}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function AuditoriaView() {
  const checks = [
    { name: 'robots.txt · GPTBot', ok: true },
    { name: 'sitemap.xml productos', ok: true },
    { name: 'Schema Product en 11 páginas', ok: false },
    { name: 'FAQ indexables', ok: true },
    { name: 'Canonicals Shopify', ok: true },
    { name: 'Bloqueo de crawlers IA', ok: true },
  ];
  return (
    <div className="space-y-6">
      <SectionHeader title="Auditoría" subtitle="Técnica + agéntica Cleexs · indexación y acceso de bots." />
      <div className="grid gap-3 sm:grid-cols-2">
        {checks.map((c) => (
          <div key={c.name} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <span className="text-sm text-slate-800">{c.name}</span>
            <Badge tone={c.ok ? 'emerald' : 'amber'}>{c.ok ? 'OK' : 'Revisar'}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsView() {
  const items = [
    { name: 'Shopify API', status: 'Conectado' },
    { name: 'Google Analytics 4', status: 'Conectado' },
    { name: 'Google Search Console', status: 'Conectado' },
    { name: 'WordPress / CMS', status: 'Pendiente' },
    { name: 'Resend · email', status: 'Conectado' },
    { name: 'CTA A/B landings', status: 'Próximo' },
  ];
  return (
    <div className="space-y-6">
      <SectionHeader title="Settings" subtitle="Integraciones y configuración del portal de marca." />
      <Panel title="Integraciones">
        <div className="space-y-2">
          {items.map((it) => (
            <div key={it.name} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5 text-sm">
              <span className="font-medium text-slate-800">{it.name}</span>
              <Badge
                tone={
                  it.status === 'Conectado' ? 'emerald' : it.status === 'Próximo' ? 'slate' : 'amber'
                }
              >
                {it.status}
              </Badge>
            </div>
          ))}
        </div>
      </Panel>
      <p className="text-xs text-slate-500">
        Redes sociales y experimentación CTA quedan fuera del v1; aparecen como “Próximo”.
      </p>
    </div>
  );
}

function renderSection(id: SectionId) {
  switch (id) {
    case 'dashboard':
      return <DashboardView />;
    case 'funnel':
      return <FunnelView />;
    case 'sov':
      return <SovView />;
    case 'oportunidades':
      return <OportunidadesView />;
    case 'contenido':
      return <ContenidoView />;
    case 'outreach':
      return <OutreachView />;
    case 'email':
      return <EmailView />;
    case 'referidos':
      return <ReferidosView />;
    case 'clientes':
      return <ClientesView />;
    case 'auditoria':
      return <AuditoriaView />;
    case 'settings':
      return <SettingsView />;
    default:
      return null;
  }
}

export function PortalTrafogliDraft() {
  const [section, setSection] = useState<SectionId>('dashboard');
  const activeLabel = useMemo(() => {
    for (const s of NAV) {
      const hit = s.links.find((l) => l.id === section);
      if (hit) return hit.label;
    }
    return 'Dashboard';
  }, [section]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 text-xs font-bold text-white shadow-sm">
            C
          </span>
          <div className="leading-tight">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-600">Cleexs · borrador</p>
            <p className="text-sm font-semibold text-slate-900">Portal Trafogli</p>
          </div>
          <span className="ml-2 hidden rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-900 ring-1 ring-amber-200/80 sm:inline">
            Datos mock
          </span>
        </div>
        <div className="text-right leading-tight">
          <p className="text-xs font-medium text-slate-800">trafogli.com</p>
          <p className="text-[10px] text-slate-500">Sábanas de bambú · marca demo</p>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white py-6 md:block">
          <nav className="flex flex-col gap-5 px-3">
            {NAV.map((group) => (
              <div key={group.title} className="flex flex-col gap-0.5">
                <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {group.title}
                </p>
                {group.links.map(({ id, label, icon: Icon }) => {
                  const active = section === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSection(id)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                        active
                          ? 'bg-violet-50 text-violet-900 ring-1 ring-violet-200/60'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-violet-600' : 'text-slate-400'}`} />
                      {label}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 flex-1 overflow-x-hidden">
          <nav className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-white px-4 py-3 md:hidden">
            {NAV.flatMap((g) => g.links).map(({ id, label, icon: Icon }) => {
              const active = section === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSection(id)}
                  className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
                    active ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label.split('·')[0]?.trim()}
                </button>
              );
            })}
          </nav>

          <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
            <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <strong className="font-semibold">Borrador para Gonzalo / Trafogli</strong> — layout Cleexs,
              datos ficticios. Sección activa: <span className="font-semibold">{activeLabel}</span>.
            </div>
            {renderSection(section)}
          </div>
        </div>
      </div>

      <footer className="border-t border-slate-200 bg-white px-4 py-5 md:pl-[calc(15rem+2rem)] md:pr-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>Cleexs · borrador portal de marca Trafogli. No es producción.</p>
          <p className="font-medium text-violet-700">/borrador/portal-trafogli</p>
        </div>
      </footer>
    </div>
  );
}
