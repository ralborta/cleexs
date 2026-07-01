/**
 * Re-export del catálogo compartido (web + API).
 * @see packages/shared/src/countries.ts
 */
export {
  ALL_COUNTRIES,
  LATAM_COUNTRIES,
  COUNTRIES,
  REGION_ORDER,
  DEFAULT_COUNTRY_ISO,
  COUNTRY_OTHER_VALUE,
  COUNTRY_OTHER_LABEL,
  findCountryByIso,
  findCountryByName,
  isKnownCountryName,
  isOtherCountryValue,
  resolveCountryFormValue,
  countrySelectStateFromValue,
  geoMarketForCountryName,
  geoMarketForIso,
  regionForIso,
  normalizeCountryText,
  type CountryOption,
  type CountryRegion,
  type GeoMarket,
} from '@cleexs/shared';

/** Alias histórico usado en country-picker. */
export { normalizeCountryText as normalizeText } from '@cleexs/shared';
