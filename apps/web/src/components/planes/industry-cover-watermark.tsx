import { resolveIndustryWatermark } from '@/lib/industry-watermark';
import type { BrandAccent } from '@/lib/brand-accent-from-logo';

/**
 * Marca de agua del rubro a la derecha de la portada
 * (misma posición que la pizza en el Plan de Ataque de referencia).
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
        'pointer-events-none absolute inset-y-0 right-0 z-0 w-[52%] overflow-hidden'
      }
      aria-hidden
    >
      <Icon
        className="absolute left-[18%] top-1/2 h-[92%] w-[92%] -translate-y-1/2"
        strokeWidth={0.65}
        style={{ color: accent.primary, opacity: 0.13 }}
      />
      {/* Degradé para que no compita con el texto de la izquierda */}
      <div className="absolute inset-y-0 left-0 w-2/5 bg-gradient-to-r from-white via-white/70 to-transparent" />
    </div>
  );
}
