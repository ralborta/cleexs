/**
 * Catálogo de países para el backend (detección de mercado en diagnósticos/corridas).
 *
 * - `iso`: ISO-3166-1 alfa-2 (lo que entrega `x-vercel-ip-country`).
 * - `name`: nombre en español, consistente con `marketCountry` del pipeline.
 * - `geoMarket`: bloque que consumen prompts/competidores (`AR|BR|MX|US|LATAM|EU|global`).
 *
 * Mantener alineado con apps/web/src/lib/countries.ts.
 */

export type GeoMarket = 'AR' | 'BR' | 'MX' | 'US' | 'LATAM' | 'EU' | 'global';

interface CountryRow {
  iso: string;
  name: string;
  geoMarket: GeoMarket;
}

const COUNTRIES: CountryRow[] = [
  { iso: 'AR', name: 'Argentina', geoMarket: 'AR' },
  { iso: 'BR', name: 'Brasil', geoMarket: 'BR' },
  { iso: 'MX', name: 'México', geoMarket: 'MX' },
  { iso: 'CL', name: 'Chile', geoMarket: 'LATAM' },
  { iso: 'CO', name: 'Colombia', geoMarket: 'LATAM' },
  { iso: 'PE', name: 'Perú', geoMarket: 'LATAM' },
  { iso: 'UY', name: 'Uruguay', geoMarket: 'LATAM' },
  { iso: 'PY', name: 'Paraguay', geoMarket: 'LATAM' },
  { iso: 'BO', name: 'Bolivia', geoMarket: 'LATAM' },
  { iso: 'EC', name: 'Ecuador', geoMarket: 'LATAM' },
  { iso: 'VE', name: 'Venezuela', geoMarket: 'LATAM' },
  { iso: 'CR', name: 'Costa Rica', geoMarket: 'LATAM' },
  { iso: 'PA', name: 'Panamá', geoMarket: 'LATAM' },
  { iso: 'GT', name: 'Guatemala', geoMarket: 'LATAM' },
  { iso: 'DO', name: 'República Dominicana', geoMarket: 'LATAM' },
  { iso: 'US', name: 'Estados Unidos', geoMarket: 'US' },
  { iso: 'CA', name: 'Canadá', geoMarket: 'US' },
  { iso: 'ES', name: 'España', geoMarket: 'EU' },
  { iso: 'PT', name: 'Portugal', geoMarket: 'EU' },
  { iso: 'GB', name: 'Reino Unido', geoMarket: 'EU' },
  { iso: 'FR', name: 'Francia', geoMarket: 'EU' },
  { iso: 'DE', name: 'Alemania', geoMarket: 'EU' },
  { iso: 'IT', name: 'Italia', geoMarket: 'EU' },
  { iso: 'NL', name: 'Países Bajos', geoMarket: 'EU' },
  { iso: 'CN', name: 'China', geoMarket: 'global' },
  { iso: 'JP', name: 'Japón', geoMarket: 'global' },
  { iso: 'IN', name: 'India', geoMarket: 'global' },
  { iso: 'KR', name: 'Corea del Sur', geoMarket: 'global' },
  { iso: 'SG', name: 'Singapur', geoMarket: 'global' },
  { iso: 'AE', name: 'Emiratos Árabes Unidos', geoMarket: 'global' },
  { iso: 'ZA', name: 'Sudáfrica', geoMarket: 'global' },
  { iso: 'NG', name: 'Nigeria', geoMarket: 'global' },
  { iso: 'EG', name: 'Egipto', geoMarket: 'global' },
  { iso: 'MA', name: 'Marruecos', geoMarket: 'global' },
];

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const BY_ISO = new Map(COUNTRIES.map((c) => [c.iso, c]));
const BY_NAME = new Map(COUNTRIES.map((c) => [normalize(c.name), c]));

/**
 * Nombre de país (en español) a partir del código ISO del header `x-vercel-ip-country`.
 * Devuelve null si el código no está en el catálogo curado.
 */
export function countryNameFromIso(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const row = BY_ISO.get(iso.trim().toUpperCase());
  return row ? row.name : null;
}

/**
 * Deriva el geoMarket (bloque de mercado) a partir del nombre del país.
 * Fallback 'global' si no se reconoce, para no romper el pipeline.
 */
export function geoMarketForCountryName(name: string | null | undefined): GeoMarket {
  if (!name) return 'global';
  const row = BY_NAME.get(normalize(name));
  return row ? row.geoMarket : 'global';
}
