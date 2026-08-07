import type { LucideIcon } from 'lucide-react';
import {
  BedDouble,
  Car,
  Gamepad2,
  GraduationCap,
  HeartPulse,
  Hotel,
  Landmark,
  Megaphone,
  Pizza,
  Scale,
  ShoppingBag,
  Sparkles,
  Wine,
} from 'lucide-react';

export type IndustryWatermarkKey =
  | 'gaming'
  | 'food'
  | 'legal'
  | 'hotel'
  | 'health'
  | 'finance'
  | 'education'
  | 'retail'
  | 'marketing'
  | 'auto'
  | 'wine'
  | 'realestate'
  | 'generic';

const ICON_BY_KEY: Record<IndustryWatermarkKey, LucideIcon> = {
  gaming: Gamepad2,
  food: Pizza,
  legal: Scale,
  hotel: Hotel,
  health: HeartPulse,
  finance: Landmark,
  education: GraduationCap,
  retail: ShoppingBag,
  marketing: Megaphone,
  auto: Car,
  wine: Wine,
  realestate: BedDouble,
  generic: Sparkles,
};

type Rule = { key: IndustryWatermarkKey; patterns: RegExp[] };

const RULES: Rule[] = [
  {
    key: 'gaming',
    patterns: [
      /videojuego|video\s*juego|gaming|gamer|consola|nintendo|playstation|xbox|steam|esport/i,
    ],
  },
  {
    key: 'food',
    patterns: [
      /pizza|pizzer|restaurante|comida|food|gastronom|burger|hamburg|cafeteria|café|cafe|bar\b|cocina|delivery\s*comida|panader/i,
    ],
  },
  {
    key: 'legal',
    patterns: [/abogad|legal|jur[ií]dic|estudio\s*jur|notari|justicia|derecho/i],
  },
  {
    key: 'hotel',
    patterns: [/hotel|hospedaje|turismo|travel|viaje|resort|alojamiento/i],
  },
  {
    key: 'health',
    patterns: [/salud|medic|cl[ií]nic|hospital|odont|psicolog|farmac|wellness|fitness|gym/i],
  },
  {
    key: 'finance',
    patterns: [/fintech|banco|financ|seguros|inversi[oó]n|contab|cripto/i],
  },
  {
    key: 'education',
    patterns: [/educaci[oó]n|universidad|colegio|curso|academia|e-?learning|capacitaci[oó]n/i],
  },
  {
    key: 'retail',
    patterns: [/ecommerce|e-?commerce|retail|tienda|comercio|marketplace|modas?/i],
  },
  {
    key: 'marketing',
    patterns: [/marketing|publicidad|agencia|seo|aeo|growth|digital\s*marketing|lead/i],
  },
  {
    key: 'auto',
    patterns: [/auto|automot|concesion|veh[ií]culo|cars?|motos?/i],
  },
  {
    key: 'wine',
    patterns: [/vino|bodega|winery|vitivin|enolog/i],
  },
  {
    key: 'realestate',
    patterns: [/inmueble|inmobili|real\s*estate|propied|alquiler/i],
  },
];

/**
 * Resuelve marca de agua visual según rubro / dominio / marca.
 * Ej.: nintendo → gaming (control), pizzería → pizza, abogado → balanza.
 */
export function resolveIndustryWatermark(
  industry: string | null | undefined,
  domain: string,
  brandName: string
): { key: IndustryWatermarkKey; Icon: LucideIcon } {
  const haystack = [industry, domain, brandName].filter(Boolean).join(' ');
  for (const rule of RULES) {
    if (rule.patterns.some((re) => re.test(haystack))) {
      return { key: rule.key, Icon: ICON_BY_KEY[rule.key] };
    }
  }
  return { key: 'generic', Icon: ICON_BY_KEY.generic };
}
