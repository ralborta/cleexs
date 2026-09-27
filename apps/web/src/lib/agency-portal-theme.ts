/** Design tokens Cleexs Agency (Stitch) · shell + superficies funcionales. */

export const agency = {
  canvas: '#faf8ff',
  primary: '#4648d4',
  primaryHover: '#4f46e5',
  primarySoft: '#eef2ff',
  secondary: '#10b981',
  secondarySoft: '#ecfdf5',
  ink: '#0f172a',
  body: '#334155',
  muted: '#64748b',
  micro: '#94a3b8',
  border: '#e2e8f0',
  borderSoft: '#f1f5f9',
  white: '#ffffff',
} as const;

export const agencyCls = {
  card: 'rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-[0_1px_2px_0_rgba(15,23,42,0.04),0_1px_3px_0_rgba(15,23,42,0.02)]',
  cardSm: 'rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-[0_1px_2px_0_rgba(15,23,42,0.04)]',
  panel: 'rounded-xl border border-[#e2e8f0] bg-white shadow-[0_1px_2px_0_rgba(15,23,42,0.04)]',
  h1: 'text-[20px] font-semibold tracking-tight text-[#0f172a]',
  h2: 'text-sm font-semibold text-[#0f172a]',
  sub: 'text-[13px] text-[#64748b]',
  labelMicro: 'text-[11px] font-semibold uppercase tracking-[0.06em] text-[#94a3b8]',
  metric: 'text-[26px] font-bold tabular-nums tracking-tight text-[#0f172a]',
  iconBox:
    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eef2ff] text-[#4648d4] shadow-sm',
  iconBoxSm:
    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#eef2ff] text-[#4648d4]',
  iconBoxOk:
    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#ecfdf5] text-[#047857]',
  btnPrimary:
    'inline-flex items-center gap-2 rounded-lg bg-[#4648d4] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#4f46e5] disabled:opacity-50',
  btnSecondary:
    'inline-flex items-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-4 py-2 text-sm font-medium text-[#334155] shadow-sm hover:bg-[#f8fafc] disabled:opacity-50',
  chipActive: 'rounded-md bg-white px-3 py-1.5 text-[11px] font-semibold text-[#0f172a] shadow-sm',
  chipIdle:
    'rounded-md px-3 py-1.5 text-[11px] font-semibold text-[#64748b] hover:text-[#0f172a]',
  chipBar: 'inline-flex rounded-lg bg-[#f1f5f9] p-1 shadow-sm',
  pillActive: 'rounded-lg bg-[#4648d4] px-3.5 py-2 text-white shadow-sm',
  pillIdle: 'rounded-lg bg-[#f1f5f9] px-3.5 py-2 text-[#334155] hover:bg-[#e2e8f0]',
  input:
    'rounded-lg border border-[#e2e8f0] bg-white px-2.5 py-1.5 text-sm text-[#0f172a] shadow-sm outline-none focus:border-[#c7d2fe] focus:ring-2 focus:ring-[#eef2ff]',
  trendUp: 'inline-flex items-center gap-1 rounded-full bg-[#ecfdf5] px-2 py-0.5 text-[11px] font-semibold text-[#059669]',
  trendDown: 'inline-flex items-center gap-1 rounded-full bg-[#fef2f2] px-2 py-0.5 text-[11px] font-semibold text-[#dc2626]',
} as const;
