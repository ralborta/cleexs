import { COUNTRY_NAMES_ES } from './countries-names';

export type CountryRegion = 'América Latina' | 'Norteamérica' | 'Europa' | 'Asia' | 'África';
export type GeoMarket = 'AR' | 'BR' | 'MX' | 'US' | 'LATAM' | 'EU' | 'global';

export interface CountryOption {
  iso: string;
  name: string;
  geoMarket: GeoMarket;
  region: CountryRegion;
}

export const COUNTRY_OTHER_VALUE = '__other__';
export const COUNTRY_OTHER_LABEL = 'Otro…';

/** ISO-3166 alfa-2 de América Latina y Caribe (incluye Nicaragua, Cuba, etc.). */
const LATAM_ISOS = new Set([
  'AG', 'AI', 'AR', 'AW', 'BB', 'BL', 'BO', 'BQ', 'BR', 'BS', 'BZ', 'CL', 'CO', 'CR', 'CU', 'CW', 'DM', 'DO',
  'EC', 'FK', 'GD', 'GF', 'GP', 'GT', 'GY', 'HN', 'HT', 'JM', 'KN', 'KY', 'LC', 'MF', 'MQ', 'MS', 'MX', 'NI',
  'PA', 'PE', 'PR', 'PY', 'SR', 'SV', 'SX', 'TC', 'TT', 'UY', 'VE', 'VG', 'VI',
]);

const NORTH_AMERICA_ISOS = new Set(['US', 'CA', 'GL', 'PM']);

const EUROPE_ISOS = new Set([
  'AD', 'AL', 'AT', 'AX', 'BA', 'BE', 'BG', 'BY', 'CH', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FO', 'FR',
  'GB', 'GG', 'GI', 'GR', 'HR', 'HU', 'IE', 'IM', 'IS', 'IT', 'JE', 'LI', 'LT', 'LU', 'LV', 'MC', 'MD', 'ME',
  'MK', 'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'RS', 'RU', 'SE', 'SI', 'SJ', 'SK', 'SM', 'UA', 'VA', 'XK',
]);

const AFRICA_ISOS = new Set([
  'AO', 'BF', 'BI', 'BJ', 'BW', 'CD', 'CF', 'CG', 'CI', 'CM', 'CV', 'DJ', 'DZ', 'EG', 'EH', 'ER', 'ET', 'GA',
  'GH', 'GM', 'GN', 'GQ', 'GW', 'KE', 'KM', 'LR', 'LS', 'LY', 'MA', 'MG', 'ML', 'MR', 'MU', 'MW', 'MZ', 'NA',
  'NE', 'NG', 'RE', 'RW', 'SC', 'SD', 'SH', 'SL', 'SN', 'SO', 'SS', 'ST', 'SZ', 'TD', 'TG', 'TN', 'TZ', 'UG',
  'YT', 'ZA', 'ZM', 'ZW',
]);

export function regionForIso(iso: string): CountryRegion {
  const code = iso.toUpperCase();
  if (LATAM_ISOS.has(code)) return 'América Latina';
  if (NORTH_AMERICA_ISOS.has(code)) return 'Norteamérica';
  if (EUROPE_ISOS.has(code)) return 'Europa';
  if (AFRICA_ISOS.has(code)) return 'África';
  return 'Asia';
}

export function geoMarketForIso(iso: string): GeoMarket {
  const code = iso.toUpperCase();
  if (code === 'AR') return 'AR';
  if (code === 'BR') return 'BR';
  if (code === 'MX') return 'MX';
  if (code === 'US' || code === 'CA') return 'US';
  if (LATAM_ISOS.has(code)) return 'LATAM';
  if (EUROPE_ISOS.has(code)) return 'EU';
  return 'global';
}

function buildAllCountries(): CountryOption[] {
  return COUNTRY_NAMES_ES.map(({ iso, name }) => ({
    iso,
    name,
    geoMarket: geoMarketForIso(iso),
    region: regionForIso(iso),
  }));
}

export const ALL_COUNTRIES: CountryOption[] = buildAllCountries();

export const LATAM_COUNTRIES: CountryOption[] = ALL_COUNTRIES.filter((c) => c.region === 'América Latina');

/** Alias histórico: catálogo completo. */
export const COUNTRIES = ALL_COUNTRIES;

export const REGION_ORDER: CountryRegion[] = [
  'América Latina',
  'Norteamérica',
  'Europa',
  'Asia',
  'África',
];

export const DEFAULT_COUNTRY_ISO = 'AR';

const BY_ISO = new Map(ALL_COUNTRIES.map((c) => [c.iso, c]));

export function normalizeCountryText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function findCountryByIso(iso: string | null | undefined): CountryOption | undefined {
  if (!iso) return undefined;
  return BY_ISO.get(iso.toUpperCase());
}

export function findCountryByName(name: string | null | undefined): CountryOption | undefined {
  if (!name) return undefined;
  const n = normalizeCountryText(name);
  if (!n) return undefined;
  return (
    ALL_COUNTRIES.find((c) => normalizeCountryText(c.name) === n) ||
    ALL_COUNTRIES.find(
      (c) => normalizeCountryText(c.name).includes(n) || n.includes(normalizeCountryText(c.name))
    )
  );
}

export function isKnownCountryName(name: string | null | undefined): boolean {
  return Boolean(findCountryByName(name));
}

export function countryNameFromIso(iso: string | null | undefined): string | null {
  const row = findCountryByIso(iso);
  return row?.name ?? null;
}

export function geoMarketForCountryName(name: string | null | undefined): GeoMarket {
  const row = findCountryByName(name);
  return row?.geoMarket ?? 'global';
}

export function isOtherCountryValue(value: string | null | undefined): boolean {
  return value === COUNTRY_OTHER_VALUE;
}

/** Valor guardado en formulario: nombre del catálogo o texto libre si eligió Otro. */
export function resolveCountryFormValue(selected: string, otherText: string): string {
  if (selected === COUNTRY_OTHER_VALUE) return otherText.trim();
  return selected.trim();
}

export function countrySelectStateFromValue(value: string | null | undefined): {
  selectValue: string;
  otherText: string;
} {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return { selectValue: '', otherText: '' };
  if (findCountryByName(trimmed)) return { selectValue: trimmed, otherText: '' };
  return { selectValue: COUNTRY_OTHER_VALUE, otherText: trimmed };
}
