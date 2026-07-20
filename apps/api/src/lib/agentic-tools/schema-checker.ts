/**
 * Port de cleexs-aeo-tools/tool3_schema.py → TypeScript nativo.
 * Analiza JSON-LD, microdata y propiedades recomendadas de Schema.org.
 */

import { fetchPageContent } from './page-fetch';

const RECOMMENDED_PROPERTIES: Record<string, string[]> = {
  Organization: ['name', 'url', 'logo', 'description', 'sameAs', 'contactPoint', 'address'],
  LocalBusiness: ['name', 'address', 'telephone', 'openingHours', 'geo', 'priceRange', 'image'],
  Product: ['name', 'description', 'image', 'offers', 'brand', 'review', 'aggregateRating', 'sku'],
  Service: ['name', 'description', 'provider', 'areaServed', 'offers'],
  WebSite: ['name', 'url', 'potentialAction'],
  WebPage: ['name', 'description', 'url', 'breadcrumb'],
  FAQPage: ['mainEntity'],
  Article: ['headline', 'author', 'datePublished', 'dateModified', 'image', 'publisher'],
  BlogPosting: ['headline', 'author', 'datePublished', 'dateModified', 'image', 'publisher'],
  BreadcrumbList: ['itemListElement'],
  Review: ['reviewRating', 'author', 'itemReviewed'],
  AggregateRating: ['ratingValue', 'reviewCount', 'bestRating'],
  Event: ['name', 'startDate', 'location', 'description', 'offers'],
  Person: ['name', 'url', 'jobTitle', 'worksFor'],
};

export type SchemaItemFound = {
  schema_type: string;
  source: string;
  properties: Record<string, string>;
  missing_recommended: string[];
  property_count: number;
};

export type SchemaSuggestion = {
  priority: string;
  message: string;
  detail: string;
  action: string;
};

export type SchemaCheckResult = {
  url: string;
  has_schema: boolean;
  schemas_found: SchemaItemFound[];
  missing_types: string[];
  suggestions: SchemaSuggestion[];
  score: number;
  total_schemas: number;
  page_info: { title: string | null; has_h1: boolean };
};

function extractJsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const data = JSON.parse(m[1].trim());
      if (Array.isArray(data)) blocks.push(...data);
      else blocks.push(data);
    } catch {
      /* skip invalid JSON-LD */
    }
  }
  return blocks;
}

function parseSchemaNode(data: unknown, source: string): SchemaItemFound[] {
  const items: SchemaItemFound[] = [];
  if (!data || typeof data !== 'object') return items;
  if (Array.isArray(data)) {
    for (const item of data) items.push(...parseSchemaNode(item, source));
    return items;
  }
  const obj = data as Record<string, unknown>;
  if (Array.isArray(obj['@graph'])) {
    for (const node of obj['@graph']) items.push(...parseSchemaNode(node, source));
    return items;
  }
  let schemaType = obj['@type'];
  const typeList: string[] = Array.isArray(schemaType)
    ? schemaType.filter((t): t is string => typeof t === 'string')
    : typeof schemaType === 'string'
      ? [schemaType]
      : [];
  if (typeList.length === 0) return items;

  for (const schemaType of typeList) {
    const properties: Record<string, string> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (!key.startsWith('@') && value != null && value !== '' && !(Array.isArray(value) && value.length === 0)) {
        properties[key] = typeof value;
      }
    }
    const missing: string[] = [];
    const rec = RECOMMENDED_PROPERTIES[schemaType];
    if (rec) {
      for (const prop of rec) {
        if (obj[prop] == null || obj[prop] === '') missing.push(prop);
      }
    }
    items.push({
      schema_type: schemaType,
      source,
      properties,
      missing_recommended: missing,
      property_count: Object.keys(properties).length,
    });
  }
  return items;
}

function organizationTypesFound(foundTypes: Set<string>): boolean {
  return ['Organization', 'LocalBusiness', 'OnlineBusiness'].some((t) => foundTypes.has(t));
}

function extractMicrodata(html: string): SchemaItemFound[] {
  const items: SchemaItemFound[] = [];
  const itemtypeRe = /itemtype=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  const types = new Set<string>();
  while ((m = itemtypeRe.exec(html)) !== null) {
    const itemtype = m[1];
    const schemaType = itemtype.includes('/') ? itemtype.split('/').pop()! : itemtype;
    if (!schemaType || types.has(schemaType)) continue;
    types.add(schemaType);
    const props: Record<string, string> = {};
    const propRe = new RegExp(`itemtype=["']${itemtype.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][\\s\\S]*?itemprop=["']([^"']+)["']`, 'gi');
    let pm: RegExpExecArray | null;
    while ((pm = propRe.exec(html)) !== null) props[pm[1]] = 'string';
    const missing: string[] = [];
    const rec = RECOMMENDED_PROPERTIES[schemaType];
    if (rec) for (const prop of rec) if (!(prop in props)) missing.push(prop);
    items.push({
      schema_type: schemaType,
      source: 'microdata',
      properties: props,
      missing_recommended: missing,
      property_count: Object.keys(props).length,
    });
  }
  return items;
}

function generateSuggestions(
  hasSchema: boolean,
  schemasFound: SchemaItemFound[],
  foundTypes: Set<string>,
): SchemaSuggestion[] {
  const suggestions: SchemaSuggestion[] = [];
  if (!hasSchema) {
    suggestions.push({
      priority: 'critica',
      message: 'No se encontró ningún schema en la página',
      detail:
        'Agregar datos estructurados mejora drásticamente la visibilidad en motores de IA y búsqueda.',
      action: 'Agregá al menos Organization, WebSite y BreadcrumbList como JSON-LD.',
    });
    return suggestions;
  }
  if (!foundTypes.has('Organization') && !foundTypes.has('LocalBusiness')) {
    suggestions.push({
      priority: 'alta',
      message: 'Falta schema de Organization o LocalBusiness',
      detail: 'Los motores de IA necesitan saber quién sos. Agregá Organization con nombre, URL, logo y redes.',
      action: 'Agregá un bloque JSON-LD de tipo Organization.',
    });
  }
  if (!foundTypes.has('WebSite')) {
    suggestions.push({
      priority: 'alta',
      message: 'Falta schema de WebSite',
      detail: 'WebSite con SearchAction permite que tu sitio aparezca con barra de búsqueda en resultados.',
      action: 'Agregá un bloque JSON-LD de tipo WebSite con potentialAction.',
    });
  }
  if (!foundTypes.has('BreadcrumbList')) {
    suggestions.push({
      priority: 'media',
      message: 'Falta schema de BreadcrumbList',
      detail: 'Las migas de pan estructuradas ayudan a entender la jerarquía del sitio.',
      action: 'Agregá BreadcrumbList en páginas internas.',
    });
  }
  if (!foundTypes.has('FAQPage')) {
    suggestions.push({
      priority: 'media',
      message: 'Considerá agregar FAQPage',
      detail: 'Las FAQ estructuradas son altamente citadas por ChatGPT y Perplexity.',
      action: 'Creá una sección de FAQ con schema FAQPage.',
    });
  }
  for (const schema of schemasFound) {
    if (schema.missing_recommended.length > 2) {
      suggestions.push({
        priority: 'media',
        message: `${schema.schema_type} tiene propiedades faltantes: ${schema.missing_recommended.slice(0, 5).join(', ')}`,
        detail: 'Completar estas propiedades mejora la comprensión del contenido por parte de las IAs.',
        action: `Agregá las propiedades faltantes al schema ${schema.schema_type}.`,
      });
    }
  }
  if (suggestions.length === 0) {
    suggestions.push({
      priority: 'info',
      message: 'Tu schema se ve bien configurado',
      detail: 'Tenés los tipos principales. Revisá propiedades faltantes para optimizar más.',
      action: 'Considerá Review y AggregateRating si aplica.',
    });
  }
  return suggestions;
}

function calculateScore(hasSchema: boolean, schemasFound: SchemaItemFound[]): number {
  if (!hasSchema) return 0;
  const foundTypes = new Set(schemasFound.map((s) => s.schema_type));
  let score = 30;
  if (foundTypes.has('Organization') || foundTypes.has('LocalBusiness') || foundTypes.has('OnlineBusiness'))
    score += 15;
  if (foundTypes.has('WebSite')) score += 10;
  if (foundTypes.has('BreadcrumbList')) score += 10;
  if (foundTypes.has('FAQPage')) score += 10;
  if (foundTypes.has('Product') || foundTypes.has('Service')) score += 10;
  if (foundTypes.has('Article') || foundTypes.has('BlogPosting')) score += 5;
  if (foundTypes.has('Review') || foundTypes.has('AggregateRating')) score += 10;
  const totalMissing = schemasFound.reduce((a, s) => a + s.missing_recommended.length, 0);
  score -= Math.min(20, totalMissing * 2);
  return Math.max(0, Math.min(100, score));
}

const FETCH_TIMEOUT = 12_000;

export async function checkSchema(url: string): Promise<SchemaCheckResult> {
  let target = url.trim();
  if (!/^https?:\/\//i.test(target)) target = `https://${target}`;

  const fetched = await fetchPageContent(target, { timeoutMs: FETCH_TIMEOUT });
  if (!fetched || !fetched.ok || !fetched.text.trim()) {
    const msg =
      fetched?.status === 403
        ? `HTTP ${fetched.status} — El sitio puede bloquear peticiones automáticas.`
        : fetched
          ? `HTTP ${fetched.status}`
          : 'Error de red';
    return errorResult(target, msg);
  }

  const html = fetched.text;
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : null;
  const has_h1 = /<h1[\s>]/i.test(html);

  const schemasFound: SchemaItemFound[] = [];
  for (const block of extractJsonLdBlocks(html)) {
    schemasFound.push(...parseSchemaNode(block, 'json-ld'));
  }
  schemasFound.push(...extractMicrodata(html));

  const has_schema = schemasFound.length > 0;
  const foundTypes = new Set(schemasFound.map((s) => s.schema_type));
  const missing_types: string[] = [];
  if (!organizationTypesFound(foundTypes)) missing_types.push('Organization');
  if (!foundTypes.has('WebSite')) missing_types.push('WebSite');
  if (!foundTypes.has('BreadcrumbList')) missing_types.push('BreadcrumbList');
  const suggestions = generateSuggestions(has_schema, schemasFound, foundTypes);
  const score = calculateScore(has_schema, schemasFound);

  return {
    url: fetched.finalUrl || target,
    has_schema,
    schemas_found: schemasFound,
    missing_types,
    suggestions,
    score,
    total_schemas: schemasFound.length,
    page_info: { title, has_h1 },
  };
}

function errorResult(url: string, error: string): SchemaCheckResult {
  return {
    url,
    has_schema: false,
    schemas_found: [],
    missing_types: [],
    suggestions: [
      { priority: 'critica', message: `Error al acceder: ${error}`, detail: '', action: '' },
    ],
    score: 0,
    total_schemas: 0,
    page_info: { title: null, has_h1: false },
  };
}
