import { cn } from '@/lib/utils';

/** Encabezado unificado para secciones del informe Cleexs (portal y vista pública). */
export function ReportSectionTitle({
  title,
  subtitle,
  className,
}: {
  title: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <span
        className="mt-1.5 h-9 w-1 shrink-0 rounded-full bg-gradient-to-b from-primary-600 to-primary-800"
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">{title}</h2>
        {subtitle ? (
          <p className="mt-1 text-sm leading-relaxed text-slate-600">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}
