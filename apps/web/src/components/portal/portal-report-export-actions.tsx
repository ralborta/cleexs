'use client';

import Link from 'next/link';
import { Download, ExternalLink, FileText } from 'lucide-react';
import {
  buildDiagnosticReportPath,
  downloadPortalReportCsv,
  printPortalReportPdf,
  type PortalReportCsvRow,
} from '@/lib/portal-report-export';

export type PortalReportExportPayload = {
  runId: string;
  brandName: string;
  domain?: string | null;
  runStatus: string;
  reportDate?: string | null;
  cleexsScore: number;
  deltaVsPrevious: number | null;
  intentionScores: Array<{ label: string; score: number }>;
  compareRows: Array<{
    rank: number;
    name: string;
    tag: string;
    score: number | null;
    domainRating?: number | null;
  }>;
  linkedPublicDiagnostic?: {
    id: string;
    status: string;
    shareSlug?: string | null;
    tier?: string | null;
  } | null;
};

function buildCsvRows(payload: PortalReportExportPayload): PortalReportCsvRow[] {
  const rows: PortalReportCsvRow[] = [
    { section: 'resumen', field: 'marca', value: payload.brandName },
    { section: 'resumen', field: 'dominio', value: payload.domain?.trim() || '—' },
    { section: 'resumen', field: 'corrida_id', value: payload.runId },
    { section: 'resumen', field: 'estado', value: payload.runStatus },
    { section: 'resumen', field: 'fecha', value: payload.reportDate || '—' },
    { section: 'resumen', field: 'cleexs_score', value: String(payload.cleexsScore) },
    {
      section: 'resumen',
      field: 'variacion_vs_anterior_pts',
      value: payload.deltaVsPrevious == null ? '—' : String(payload.deltaVsPrevious),
    },
  ];

  payload.intentionScores.forEach((row) => {
    rows.push({
      section: 'intencion',
      field: row.label,
      value: `${Math.round(row.score)}%`,
    });
  });

  payload.compareRows.forEach((row) => {
    rows.push({
      section: 'comparacion',
      field: `#${row.rank} ${row.name}`,
      value: [
        row.tag === 'mi_empresa' ? 'tu_marca' : 'competidor',
        row.score != null ? `score ${Math.round(Number(row.score))}` : 'sin score',
        row.domainRating != null ? `DR ${row.domainRating}` : '',
      ]
        .filter(Boolean)
        .join(' · '),
    });
  });

  const diag = payload.linkedPublicDiagnostic;
  if (diag?.id) {
    rows.push({
      section: 'enlace',
      field: 'reporte_web',
      value: buildDiagnosticReportPath(diag.id, diag.tier),
    });
    if (diag.shareSlug) {
      rows.push({ section: 'enlace', field: 'compartir', value: `/score/${diag.shareSlug}` });
    }
  }

  return rows;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

export function PortalReportExportActions({ payload }: { payload: PortalReportExportPayload }) {
  const diag = payload.linkedPublicDiagnostic;
  const canOpenFullReport = diag?.status === 'completed';

  const btnClass =
    'inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-800 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-800 sm:px-3';

  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      <button
        type="button"
        className={btnClass}
        onClick={() =>
          downloadPortalReportCsv({
            filenameStem: `cleexs-reporte-${slugify(payload.brandName) || payload.runId.slice(0, 8)}`,
            rows: buildCsvRows(payload),
          })
        }
      >
        <Download className="h-3.5 w-3.5" aria-hidden />
        Descargar CSV
      </button>
      <button type="button" className={btnClass} onClick={() => printPortalReportPdf()}>
        <FileText className="h-3.5 w-3.5" aria-hidden />
        Guardar PDF
      </button>
      {canOpenFullReport && diag ? (
        <Link
          href={buildDiagnosticReportPath(diag.id, diag.tier)}
          target="_blank"
          rel="noopener noreferrer"
          className={btnClass}
          title="Misma vista que el diagnóstico público completo"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          Ver reporte completo
        </Link>
      ) : null}
    </div>
  );
}
