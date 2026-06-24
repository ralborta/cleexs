export function isTransientDiagnosticFetchError(message: string): boolean {
  const m = message.trim().toLowerCase();
  return (
    m === 'failed to fetch' ||
    m === 'load failed' ||
    m.includes('fetch failed') ||
    m.includes('networkerror') ||
    m.includes('network request failed') ||
    m.includes('timeout') ||
    m.includes('timed out') ||
    m.includes('aborted')
  );
}

/** Detalle secundario bajo el titular fijo del panel de error. */
export function diagnosticReportErrorDetail(raw: string | null | undefined): string | null {
  const msg = (raw ?? '').trim();
  if (!msg) return 'Ocurrió un error temporal. Podés reintentar sin empezar de cero.';
  if (isTransientDiagnosticFetchError(msg)) {
    return 'La conexión se interrumpió o tardó demasiado. Reintentá en unos segundos.';
  }
  return msg;
}
