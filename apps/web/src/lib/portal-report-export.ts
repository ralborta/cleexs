export type PortalReportCsvRow = {
  section: string;
  field: string;
  value: string;
};

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function downloadPortalReportCsv(input: {
  filenameStem: string;
  rows: PortalReportCsvRow[];
}) {
  const lines = [['seccion', 'campo', 'valor'], ...input.rows.map((r) => [r.section, r.field, r.value])];
  const csv = `${lines.map((ln) => ln.map((c) => escapeCsv(String(c))).join(',')).join('\n')}\n`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${input.filenameStem}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const PORTAL_PRINT_BODY_CLASS = 'portal-report-print-mode';

export function printPortalReportPdf() {
  if (typeof window === 'undefined') return;
  document.body.classList.add(PORTAL_PRINT_BODY_CLASS);
  const cleanup = () => document.body.classList.remove(PORTAL_PRINT_BODY_CLASS);
  window.addEventListener('afterprint', cleanup, { once: true });
  window.print();
}

export function buildDiagnosticReportPath(diagnosticId: string, tier?: string | null) {
  const qs = new URLSearchParams({ diagnosticId });
  if (tier === 'gold') qs.set('tier', 'gold');
  return `/ver-resultado?${qs.toString()}`;
}
