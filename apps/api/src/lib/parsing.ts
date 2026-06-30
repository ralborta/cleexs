import type { Top3Entry, PromptResultFlags } from '@cleexs/shared';

/**
 * Parsea el Top 3 de una respuesta de ChatGPT
 * Reglas de prioridad:
 * 1) Lista numerada (1., 2., 3.)
 * 2) Bullets (•, -, *)
 * 3) Secciones/párrafos por marca
 * 4) Texto corrido → ambiguous_ranking
 */
export function parseTop3(
  responseText: string,
  brandName: string,
  competitors: Array<{ name: string; aliases?: string[] }>
): {
  top3: Top3Entry[];
  flags: PromptResultFlags;
} {
  const flags: PromptResultFlags = {};
  const top3: Top3Entry[] = [];

  // Normalizar texto
  const normalized = responseText.toLowerCase();
  const allBrands = [
    { name: brandName, type: 'brand' as const, aliases: [] as string[] },
    ...competitors.map((c) => ({
      name: c.name,
      type: 'competitor' as const,
      aliases: c.aliases ?? [],
    })),
  ];

  // 1) Intentar lista numerada (1., 2., 3. o 1) 2) 3))
  const numberedListRegex = /(?:^|\n)\s*(?:\*\*|__)?\s*(\d+)\s*[\.\)]\s*(?:\*\*|__)?\s*([^\n]+)/gim;
  const numberedMatches = Array.from(responseText.matchAll(numberedListRegex));

  if (numberedMatches.length >= 3) {
    for (const match of numberedMatches) {
      const position = parseInt(match[1]);
      const text = match[2].trim();
      const foundBrand = findBrandInText(text, allBrands);

      if (foundBrand && !top3.find((e) => e.name === foundBrand.name)) {
        const reason = extractReasonFromLine(text, foundBrand.name);
        top3.push({
          position,
          name: foundBrand.name,
          type: foundBrand.type,
          ...(reason && { reason }),
        });
        if (top3.length >= 3) break;
      }
    }

    if (top3.length >= 2) {
      return { top3, flags };
    }
  }

  // 2) Intentar bullets (•, -, *, o -)
  const bulletRegex = /(?:^|\n)\s*[•\-\*]\s*([^\n]+)/gim;
  const bulletMatches = Array.from(responseText.matchAll(bulletRegex));

  if (bulletMatches.length >= 3) {
    let position = 1;
    for (const match of bulletMatches) {
      const text = match[1].trim();
      const foundBrand = findBrandInText(text, allBrands);

      if (foundBrand && !top3.find((e) => e.name === foundBrand.name)) {
        const reason = extractReasonFromLine(text, foundBrand.name);
        top3.push({
          position,
          name: foundBrand.name,
          type: foundBrand.type,
          ...(reason && { reason }),
        });
        position++;
        if (top3.length >= 3) break;
      }
    }

    if (top3.length >= 2) {
      return { top3, flags };
    }
  }

  // 3) Intentar secciones/párrafos separados
  const paragraphs = responseText.split(/\n\n+/);
  let position = 1;
  for (const para of paragraphs.slice(0, 3)) {
    const foundBrand = findBrandInText(para, allBrands);
    if (foundBrand && !top3.find((e) => e.name === foundBrand.name)) {
      const reason = extractReasonFromLine(para, foundBrand.name);
      top3.push({
        position,
        name: foundBrand.name,
        type: foundBrand.type,
        ...(reason && { reason }),
      });
      position++;
    }
  }

  if (top3.length >= 2) {
    return { top3, flags };
  }

  // 4) Fallback por aparición de marcas en texto corrido.
  // Evita resultados con una sola marca cuando la respuesta menciona competidores sin formato estricto.
  const seen = new Set<string>();
  let fallbackPosition = 1;
  for (const brand of allBrands) {
    const labels = [brand.name, ...brand.aliases].filter(Boolean);
    let hit = false;
    for (const label of labels) {
      const nt = normalizeText(label);
      if (nt.length < 2) continue;
      const idx = normalized.indexOf(nt);
      if (idx >= 0) {
        hit = true;
        break;
      }
    }
    if (!hit || seen.has(brand.name)) continue;
    const primary = brand.name;
    const line =
      responseText.split('\n').find((l) => {
        const lt = normalizeText(l);
        return labels.some((lab) => lt.includes(normalizeText(lab)));
      }) || responseText;
    const reason = extractReasonFromLine(line, primary);
    top3.push({
      position: fallbackPosition,
      name: primary,
      type: brand.type,
      ...(reason && { reason }),
    });
    seen.add(brand.name);
    fallbackPosition++;
    if (top3.length >= 3) break;
  }

  if (top3.length >= 2) {
    flags.ambiguous_ranking = true;
    return { top3, flags };
  }

  // 5) Texto corrido sin estructura clara
  flags.ambiguous_ranking = true;
  flags.no_ranking = true;

  return { top3, flags };
}

/**
 * Extrae el motivo/razón de la línea: lo que viene después del nombre de la marca.
 * Ej: "Timothea - mejor calidad" -> "mejor calidad"
 */
const MAX_REASON_LENGTH = 500;

function extractReasonFromLine(line: string, brandName: string): string | undefined {
  const idx = line.toLowerCase().indexOf(brandName.toLowerCase());
  if (idx === -1) return undefined;
  let after = line.slice(idx + brandName.length).replace(/^[\s\-:–—•]+/, '').trim();
  after = after.replace(/\*+/g, '').trim(); // quitar markdown **
  if (!after || after.length < 2) return undefined;
  return after.length > MAX_REASON_LENGTH ? after.slice(0, MAX_REASON_LENGTH).trim() : after;
}

/**
 * Encuentra una marca en un texto
 */
function findBrandInText(
  text: string,
  brands: Array<{ name: string; type: 'brand' | 'competitor'; aliases?: string[] }>
): { name: string; type: 'brand' | 'competitor' } | null {
  const normalizedText = normalizeText(text);

  for (const brand of brands) {
    const labels = [brand.name, ...(brand.aliases || [])].filter(Boolean);
    for (const label of labels) {
      const normalizedBrand = normalizeText(label);
      if (normalizedBrand.length < 2) continue;
      if (normalizedText.includes(normalizedBrand)) {
        return { name: brand.name, type: brand.type };
      }
    }
  }

  return null;
}

/**
 * Normaliza texto para comparación
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remover tildes
    .replace(/[^\w\s]/g, '') // Remover puntuación
    .trim();
}
