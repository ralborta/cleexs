/**
 * Catálogo curado de países para la selección de mercado en las corridas premium.
 *
 * - `iso`: código ISO-3166-1 alfa-2 (se usa para la bandera SVG de country-flag-icons).
 * - `name`: nombre en español que se muestra y se envía al backend como `country`.
 * - `geoMarket`: bloque de mercado que ya consume el clasificador/prompts
 *   (`AR|BR|MX|US|LATAM|EU|global`).
 * - `region`: agrupación visual del grid.
 *
 * Cobertura: toda América (LATAM + Norteamérica), Europa, principales de Asia
 * y principales de África.
 */

export type CountryRegion = 'América Latina' | 'Norteamérica' | 'Europa' | 'Asia' | 'África';

export type GeoMarket = 'AR' | 'BR' | 'MX' | 'US' | 'LATAM' | 'EU' | 'global';

export interface CountryOption {
  iso: string;
  name: string;
  geoMarket: GeoMarket;
  region: CountryRegion;
}

export const COUNTRIES: CountryOption[] = [
  // América Latina
  { iso: 'AR', name: 'Argentina', geoMarket: 'AR', region: 'América Latina' },
  { iso: 'BR', name: 'Brasil', geoMarket: 'BR', region: 'América Latina' },
  { iso: 'MX', name: 'México', geoMarket: 'MX', region: 'América Latina' },
  { iso: 'CL', name: 'Chile', geoMarket: 'LATAM', region: 'América Latina' },
  { iso: 'CO', name: 'Colombia', geoMarket: 'LATAM', region: 'América Latina' },
  { iso: 'PE', name: 'Perú', geoMarket: 'LATAM', region: 'América Latina' },
  { iso: 'UY', name: 'Uruguay', geoMarket: 'LATAM', region: 'América Latina' },
  { iso: 'PY', name: 'Paraguay', geoMarket: 'LATAM', region: 'América Latina' },
  { iso: 'BO', name: 'Bolivia', geoMarket: 'LATAM', region: 'América Latina' },
  { iso: 'EC', name: 'Ecuador', geoMarket: 'LATAM', region: 'América Latina' },
  { iso: 'VE', name: 'Venezuela', geoMarket: 'LATAM', region: 'América Latina' },
  { iso: 'CR', name: 'Costa Rica', geoMarket: 'LATAM', region: 'América Latina' },
  { iso: 'PA', name: 'Panamá', geoMarket: 'LATAM', region: 'América Latina' },
  { iso: 'GT', name: 'Guatemala', geoMarket: 'LATAM', region: 'América Latina' },
  { iso: 'DO', name: 'República Dominicana', geoMarket: 'LATAM', region: 'América Latina' },

  // Norteamérica
  { iso: 'US', name: 'Estados Unidos', geoMarket: 'US', region: 'Norteamérica' },
  { iso: 'CA', name: 'Canadá', geoMarket: 'US', region: 'Norteamérica' },

  // Europa
  { iso: 'ES', name: 'España', geoMarket: 'EU', region: 'Europa' },
  { iso: 'PT', name: 'Portugal', geoMarket: 'EU', region: 'Europa' },
  { iso: 'GB', name: 'Reino Unido', geoMarket: 'EU', region: 'Europa' },
  { iso: 'FR', name: 'Francia', geoMarket: 'EU', region: 'Europa' },
  { iso: 'DE', name: 'Alemania', geoMarket: 'EU', region: 'Europa' },
  { iso: 'IT', name: 'Italia', geoMarket: 'EU', region: 'Europa' },
  { iso: 'NL', name: 'Países Bajos', geoMarket: 'EU', region: 'Europa' },

  // Asia
  { iso: 'CN', name: 'China', geoMarket: 'global', region: 'Asia' },
  { iso: 'JP', name: 'Japón', geoMarket: 'global', region: 'Asia' },
  { iso: 'IN', name: 'India', geoMarket: 'global', region: 'Asia' },
  { iso: 'KR', name: 'Corea del Sur', geoMarket: 'global', region: 'Asia' },
  { iso: 'SG', name: 'Singapur', geoMarket: 'global', region: 'Asia' },
  { iso: 'AE', name: 'Emiratos Árabes Unidos', geoMarket: 'global', region: 'Asia' },

  // África
  { iso: 'ZA', name: 'Sudáfrica', geoMarket: 'global', region: 'África' },
  { iso: 'NG', name: 'Nigeria', geoMarket: 'global', region: 'África' },
  { iso: 'EG', name: 'Egipto', geoMarket: 'global', region: 'África' },
  { iso: 'MA', name: 'Marruecos', geoMarket: 'global', region: 'África' },
];

export const REGION_ORDER: CountryRegion[] = [
  'América Latina',
  'Norteamérica',
  'Europa',
  'Asia',
  'África',
];

const BY_ISO = new Map(COUNTRIES.map((c) => [c.iso, c]));

export function findCountryByIso(iso: string | null | undefined): CountryOption | undefined {
  if (!iso) return undefined;
  return BY_ISO.get(iso.toUpperCase());
}

/** Busca un país por nombre aproximado (para preseleccionar desde el país de la marca). */
export function findCountryByName(name: string | null | undefined): CountryOption | undefined {
  if (!name) return undefined;
  const n = normalizeText(name.trim());
  if (!n) return undefined;
  return (
    COUNTRIES.find((c) => normalizeText(c.name) === n) ||
    COUNTRIES.find((c) => normalizeText(c.name).includes(n) || n.includes(normalizeText(c.name)))
  );
}

export const DEFAULT_COUNTRY_ISO = 'AR';

/** Normaliza para búsqueda sin tildes ni mayúsculas. */
export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
