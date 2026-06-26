/** Extrae el ID de un enlace de YouTube o devuelve el valor si ya es un ID. */
export function parseYoutubeVideoId(input: string | undefined | null): string | null {
  const raw = input?.trim();
  if (!raw || raw === 'off') return null;

  if (/^[\w-]{11}$/.test(raw)) return raw;

  try {
    const url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    const host = url.hostname.replace(/^www\./, '');

    if (host === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0];
      return id ?? null;
    }

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const fromQuery = url.searchParams.get('v');
      if (fromQuery) return fromQuery;

      const parts = url.pathname.split('/').filter(Boolean);
      if (parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live') {
        return parts[1] ?? null;
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function youtubeEmbedUrl(
  videoId: string,
  options?: { autoplay?: boolean }
): string {
  const params = new URLSearchParams({ rel: '0' });
  if (options?.autoplay) {
    // mute=1 es obligatorio para autoplay en Chrome, Safari, Firefox, etc.
    params.set('autoplay', '1');
    params.set('mute', '1');
    params.set('playsinline', '1');
  }
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}
