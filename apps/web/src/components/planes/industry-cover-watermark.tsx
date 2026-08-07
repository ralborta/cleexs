import { resolveIndustryWatermark } from '@/lib/industry-watermark';
import type { BrandAccent } from '@/lib/brand-accent-from-logo';

/**
 * Marca de agua del rubro: grande, atrás (z-0), logo/texto se sobreponen sin problema.
 * Posición derecha, tipo la pizza de la referencia.
 */
export function IndustryCoverWatermark({
  industry,
  domain,
  brandName,
  accent,
  className,
}: {
  industry: string | null | undefined;
  domain: string;
  brandName: string;
  accent: BrandAccent;
  className?: string;
}) {
  const { Icon } = resolveIndustryWatermark(industry, domain, brandName);

  return (
    <div
      className={
        className ??
        'pointer-events-none absolute inset-0 z-0 overflow-hidden'
      }
      aria-hidden
    >
      <Icon
        className="absolute -right-[18%] top-1/2 h-[135%] w-[135%] max-w-none -translate-y-1/2"
        strokeWidth={0.55}
        style={{ color: accent.primary, opacity: 0.11 }}
      />
    </div>
  );
}
