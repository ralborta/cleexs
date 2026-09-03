import Link from 'next/link';
import { CLEEXS_MARKETING_URL } from '@/lib/site';
import { cn } from '@/lib/utils';

export type PaymentStatusTone = 'success' | 'pending' | 'error' | 'processing';

const TONE_STYLES: Record<
  PaymentStatusTone,
  {
    glow: string;
    iconWrap: string;
    badge: string;
    cta: string;
  }
> = {
  success: {
    glow: 'from-emerald-400/25 via-violet-400/15 to-transparent',
    iconWrap: 'bg-emerald-50 text-emerald-600 ring-emerald-200/80',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    cta: 'bg-violet-600 text-white shadow-violet-600/25 hover:bg-violet-700',
  },
  processing: {
    glow: 'from-violet-400/30 via-blue-400/15 to-transparent',
    iconWrap: 'bg-violet-50 text-violet-600 ring-violet-200/80',
    badge: 'border-violet-200 bg-violet-50 text-violet-800',
    cta: 'bg-violet-600 text-white shadow-violet-600/25 hover:bg-violet-700',
  },
  pending: {
    glow: 'from-amber-400/25 via-violet-400/10 to-transparent',
    iconWrap: 'bg-amber-50 text-amber-600 ring-amber-200/80',
    badge: 'border-amber-200 bg-amber-50 text-amber-900',
    cta: 'bg-slate-900 text-white shadow-slate-900/20 hover:bg-slate-800',
  },
  error: {
    glow: 'from-rose-400/25 via-violet-400/10 to-transparent',
    iconWrap: 'bg-rose-50 text-rose-600 ring-rose-200/80',
    badge: 'border-rose-200 bg-rose-50 text-rose-900',
    cta: 'bg-violet-600 text-white shadow-violet-600/25 hover:bg-violet-700',
  },
};

export function PaymentStatusScreen({
  tone,
  badge,
  icon,
  title,
  description,
  children,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: {
  tone: PaymentStatusTone;
  badge?: string;
  icon: React.ReactNode;
  title: string;
  description: React.ReactNode;
  children?: React.ReactNode;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  const styles = TONE_STYLES[tone];

  return (
    <main className="relative flex min-h-[calc(100vh-72px)] items-center justify-center overflow-hidden bg-[#f6f7fb] px-4 py-12 sm:px-6 sm:py-16">
      <div
        className={cn(
          'pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))]',
          styles.glow,
        )}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgb(148 163 184 / 0.28) 1px, transparent 0)',
          backgroundSize: '22px 22px',
        }}
        aria-hidden
      />

      <section className="relative w-full max-w-lg">
        <div className="mb-6 flex justify-center">
          <a
            href={CLEEXS_MARKETING_URL}
            className="inline-flex items-center gap-2 rounded-xl px-2 py-1 transition hover:opacity-90"
            aria-label="Cleexs"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/CleexsMark.svg" alt="" className="h-9 w-9" />
            <span className="text-sm font-bold tracking-tight text-slate-800">Cleexs</span>
          </a>
        </div>

        <div className="overflow-hidden rounded-3xl border border-white/80 bg-white/90 shadow-[0_20px_60px_-28px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/70 backdrop-blur-sm">
          <div className="h-1.5 w-full bg-gradient-to-r from-violet-600 via-blue-500 to-violet-500" />

          <div className="px-6 py-8 text-center sm:px-8 sm:py-10">
            {badge ? (
              <p
                className={cn(
                  'mx-auto inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider',
                  styles.badge,
                )}
              >
                {badge}
              </p>
            ) : null}

            <div
              className={cn(
                'mx-auto mt-5 flex h-16 w-16 items-center justify-center rounded-2xl ring-1',
                styles.iconWrap,
              )}
            >
              {icon}
            </div>

            <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.75rem]">
              {title}
            </h1>
            <div className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-600 sm:text-[15px]">
              {description}
            </div>

            {children ? <div className="mt-6">{children}</div> : null}

            <div className="mt-8 flex flex-col items-center gap-3">
              <Link
                href={primaryHref}
                className={cn(
                  'inline-flex h-11 w-full items-center justify-center rounded-xl px-5 text-sm font-bold shadow-lg transition sm:w-auto sm:min-w-[220px]',
                  styles.cta,
                )}
              >
                {primaryLabel}
              </Link>
              {secondaryHref && secondaryLabel ? (
                <Link
                  href={secondaryHref}
                  className="text-sm font-semibold text-violet-700 transition hover:text-violet-900"
                >
                  {secondaryLabel}
                </Link>
              ) : null}
            </div>
          </div>
        </div>

        <p className="mt-5 text-center text-[11px] text-slate-400">
          Pago procesado de forma segura · Cleexs
        </p>
      </section>
    </main>
  );
}
