/**
 * Extrae un color de acento usable desde una URL de logo (cliente).
 * Omite blancos / negros / grises; si falla (CORS, etc.) usa un fallback
 * determinístico por dominio para que cada marca tenga identidad estable.
 */

export type BrandAccent = {
  /** Hex primario (#RRGGBB) */
  primary: string;
  /** Hex más oscuro para texto */
  ink: string;
  /** Hex suave para fondos / líneas tenues */
  soft: string;
  source: 'logo' | 'fallback';
};

const CLEEXS_FALLBACK: BrandAccent = {
  primary: '#6D28D9',
  ink: '#4C1D95',
  soft: '#EDE9FE',
  source: 'fallback',
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0'))
    .join('')}`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

function mix(hex: string, toward: 'black' | 'white', amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const t = toward === 'black' ? 0 : 255;
  return rgbToHex(
    rgb.r + (t - rgb.r) * amount,
    rgb.g + (t - rgb.g) * amount,
    rgb.b + (t - rgb.b) * amount
  );
}

/** Hash estable dominio → hue (evita mismo violeta para todas si el logo no se puede leer). */
export function accentFromDomain(domain: string): BrandAccent {
  let h = 0;
  const d = domain.toLowerCase();
  for (let i = 0; i < d.length; i++) h = (h * 31 + d.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  // Evitar tonos muy apagados: saturación/luminosidad fijas en HSL → RGB simple
  const s = 0.62;
  const l = 0.42;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hue < 60) [r, g, b] = [c, x, 0];
  else if (hue < 120) [r, g, b] = [x, c, 0];
  else if (hue < 180) [r, g, b] = [0, c, x];
  else if (hue < 240) [r, g, b] = [0, x, c];
  else if (hue < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const primary = rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
  return {
    primary,
    ink: mix(primary, 'black', 0.35),
    soft: mix(primary, 'white', 0.88),
    source: 'fallback',
  };
}

function scorePixel(r: number, g: number, b: number, a: number): number {
  if (a < 128) return -1;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max === 0 ? 0 : (max - min) / max;
  const lum = (r + g + b) / (3 * 255);
  // Descartar casi blanco / casi negro / grises
  if (lum > 0.92 || lum < 0.08) return -1;
  if (sat < 0.12) return -1;
  return sat * 2 + (1 - Math.abs(lum - 0.45));
}

/**
 * Lee el logo y elige el color más “de marca”.
 * Requiere CORS en la imagen (`crossOrigin=anonymous`).
 */
export async function extractAccentFromLogoUrl(
  logoUrl: string,
  domainFallback?: string | null
): Promise<BrandAccent> {
  const fallback = domainFallback ? accentFromDomain(domainFallback) : CLEEXS_FALLBACK;

  if (typeof window === 'undefined') return fallback;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const done = (accent: BrandAccent) => resolve(accent);

    img.onerror = () => done(fallback);
    img.onload = () => {
      try {
        const w = Math.min(img.naturalWidth || 64, 128);
        const h = Math.min(img.naturalHeight || 64, 128);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return done(fallback);
        ctx.drawImage(img, 0, 0, w, h);
        const { data } = ctx.getImageData(0, 0, w, h);

        const buckets = new Map<string, { r: number; g: number; b: number; w: number }>();
        const step = 4 * 3; // muestreo
        for (let i = 0; i < data.length; i += step) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          const sc = scorePixel(r, g, b, a);
          if (sc < 0) continue;
          // quantize
          const qr = r >> 4;
          const qg = g >> 4;
          const qb = b >> 4;
          const key = `${qr},${qg},${qb}`;
          const prev = buckets.get(key);
          if (prev) {
            prev.r += r * sc;
            prev.g += g * sc;
            prev.b += b * sc;
            prev.w += sc;
          } else {
            buckets.set(key, { r: r * sc, g: g * sc, b: b * sc, w: sc });
          }
        }

        let best: { r: number; g: number; b: number; w: number } | null = null;
        for (const v of buckets.values()) {
          if (!best || v.w > best.w) best = v;
        }
        if (!best || best.w < 0.5) return done(fallback);

        const primary = rgbToHex(best.r / best.w, best.g / best.w, best.b / best.w);
        done({
          primary,
          ink: mix(primary, 'black', 0.32),
          soft: mix(primary, 'white', 0.88),
          source: 'logo',
        });
      } catch {
        done(fallback);
      }
    };

    img.src = logoUrl;
  });
}

export { CLEEXS_FALLBACK };
