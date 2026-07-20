'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  Download,
  Eye,
  Globe2,
  Loader2,
  Mail,
  MessageCircle,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { internalReportsApi, type OnboardingProfileReport, type ReportWindowDays } from '@/lib/api';
import {
  DiagnosticReportLink,
  ReportErrorBanner,
  ReportLoading,
  ReportMetric,
  ReportRefreshButton,
  ReportSection,
  WindowDaysToggle,
  formatDate,
  formatPercent,
} from '@/components/admin/report-ui';
import { adminUiFetch } from '@/lib/admin-ui-client-fetch';

const STATUS_BADGES: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
  detecting_competitors: 'bg-amber-100 text-amber-800 ring-1 ring-amber-200',
  awaiting_user: 'bg-amber-100 text-amber-800 ring-1 ring-amber-200',
  running: 'bg-sky-100 text-sky-800 ring-1 ring-sky-200',
  completed: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200',
  failed: 'bg-red-100 text-red-800 ring-1 ring-red-200',
};

const ONBOARDING_PAGE_SIZE = 25;

type SendLogRow = {
  id: string;
  recipientEmail: string;
  campaignSlug: string;
  scoreBucket: string | null;
  cleexsScore: number | null;
  status: string;
  externalId: string | null;
  errorMessage: string | null;
  createdAt: string;
};

type ResendContentPayload = {
  ok: boolean;
  retentionNote?: string;
  log: {
    id: string;
    recipientEmail: string;
    campaignSlug: string;
    status: string;
    createdAt: string;
  };
  email: {
    id: string;
    from: string;
    to: string[] | string;
    subject: string;
    html: string | null;
    text: string | null;
    createdAt: string;
    lastEvent: string | null;
  };
};

function downloadCsv(rows: OnboardingProfileReport['rows']) {
  const header = ['fecha', 'marca', 'dominio', 'email', 'pais', 'nombre', 'como_llego', 'estado'];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    header.join(','),
    ...rows.map((row) =>
      [
        row.createdAt,
        row.brandName,
        row.domain,
        row.email || '',
        row.country || '',
        row.displayName || '',
        row.howFoundLabel || row.howFoundUs || '',
        row.status,
      ]
        .map((v) => escape(String(v)))
        .join(',')
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `onboarding-perfil-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function looksLikeResendId(id: string | null | undefined): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id.trim());
}

export default function OnboardingProfileReportPage() {
  const [data, setData] = useState<OnboardingProfileReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [windowDays, setWindowDays] = useState<ReportWindowDays>(30);
  const [countryFilter, setCountryFilter] = useState('');
  const [page, setPage] = useState(1);

  const [mailsOpen, setMailsOpen] = useState(false);
  const [mailsEmail, setMailsEmail] = useState<string | null>(null);
  const [mailsBrand, setMailsBrand] = useState<string | null>(null);
  const [mailsLoading, setMailsLoading] = useState(false);
  const [mailsError, setMailsError] = useState<string | null>(null);
  const [mails, setMails] = useState<SendLogRow[]>([]);

  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ResendContentPayload | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await internalReportsApi.onboardingProfile(
        windowDays,
        countryFilter.trim() || undefined
      );
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el reporte de onboarding.');
    } finally {
      setLoading(false);
    }
  }, [windowDays, countryFilter]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [windowDays, countryFilter]);

  const tablePagination = useMemo(() => {
    if (!data) return null;
    const totalRows = data.rows.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / ONBOARDING_PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const pagedRows = data.rows.slice(
      (safePage - 1) * ONBOARDING_PAGE_SIZE,
      safePage * ONBOARDING_PAGE_SIZE
    );
    return { totalRows, totalPages, safePage, pagedRows };
  }, [data, page]);

  async function openMails(email: string, brandName: string) {
    const normalized = email.trim().toLowerCase();
    if (!normalized) return;
    setMailsOpen(true);
    setMailsEmail(normalized);
    setMailsBrand(brandName);
    setMailsLoading(true);
    setMailsError(null);
    setMails([]);
    setPreview(null);
    setPreviewError(null);
    try {
      const qs = new URLSearchParams({
        recipientEmail: normalized,
        limit: '50',
      });
      const res = await adminUiFetch(`/api/admin-ui/email/logs?${qs.toString()}`);
      const json = await res.json().catch(() => ([]));
      if (!res.ok) {
        throw new Error((json as { error?: string }).error || `Error ${res.status}`);
      }
      setMails(Array.isArray(json) ? (json as SendLogRow[]) : []);
    } catch (e) {
      setMailsError(e instanceof Error ? e.message : 'No se pudieron cargar los envíos');
    } finally {
      setMailsLoading(false);
    }
  }

  function closeMails() {
    setMailsOpen(false);
    setMailsEmail(null);
    setMailsBrand(null);
    setMails([]);
    setPreview(null);
    setPreviewError(null);
  }

  async function viewMailContent(logId: string) {
    setPreviewLoadingId(logId);
    setPreviewError(null);
    setPreview(null);
    try {
      const res = await adminUiFetch(`/api/admin-ui/email/logs/${encodeURIComponent(logId)}/content`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((json as { error?: string }).error || `Error ${res.status}`);
      }
      setPreview(json as ResendContentPayload);
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : 'No se pudo cargar el correo');
    } finally {
      setPreviewLoadingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Onboarding · perfil de leads</h2>
          <p className="text-xs text-slate-500">
            Un lead por dominio (sin duplicar el mismo sitio). Un email con varias empresas sí puede
            aparecer más de una vez. Ventana: últimos {windowDays} días
            {countryFilter.trim() ? (
              <>
                {' '}
                · filtro: <span className="font-medium text-slate-700">{countryFilter}</span>
              </>
            ) : null}
            .
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Globe2 className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              disabled={loading}
              aria-label="Filtrar por país"
              className="appearance-none rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-8 text-xs font-medium text-slate-700 shadow-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 disabled:opacity-60"
            >
              <option value="">Todos los países</option>
              {(data?.availableCountries ?? []).map((row) => (
                <option key={row.country} value={row.country}>
                  {row.country} ({row.count})
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          </div>
          <WindowDaysToggle value={windowDays} onChange={setWindowDays} disabled={loading} />
          {data && data.rows.length > 0 ? (
            <button
              type="button"
              onClick={() => downloadCsv(data.rows)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
          ) : null}
          <ReportRefreshButton loading={loading} onClick={load} />
        </div>
      </div>

      {error ? <ReportErrorBanner message={error} /> : null}
      {loading && !data ? <ReportLoading /> : null}

      {data && tablePagination ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <ReportMetric
              label="Dominios únicos"
              value={data.totals.withProfileData}
              Icon={Users}
              tone="violet"
              hint={
                data.totals.duplicateDomainsSkipped > 0
                  ? `${data.totals.duplicateDomainsSkipped} duplicado${data.totals.duplicateDomainsSkipped === 1 ? '' : 's'} omitido${data.totals.duplicateDomainsSkipped === 1 ? '' : 's'} · ${formatPercent(data.totals.profileRate)} del período`
                  : `${formatPercent(data.totals.profileRate)} de ${data.totals.diagnosticsInWindow} diagnósticos`
              }
            />
            <ReportMetric
              label="Con país"
              value={data.totals.withCountry}
              Icon={Globe2}
              tone="sky"
              hint={`${formatPercent(data.totals.countryRate)} del período`}
            />
            <ReportMetric
              label="Con nombre"
              value={data.totals.withName}
              Icon={UserRound}
              tone="emerald"
              hint={`${formatPercent(data.totals.nameRate)} del período`}
            />
            <ReportMetric
              label="Con cómo llegó"
              value={data.totals.withHowFound}
              Icon={MessageCircle}
              tone="amber"
              hint={`${formatPercent(data.totals.howFoundRate)} del período`}
            />
          </div>

          {data.howFoundBreakdown.length > 0 ? (
            <ReportSection
              title="Cómo nos encontraron"
              description="Solo entre quienes eligieron una opción en el wizard."
            >
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {data.howFoundBreakdown.map((row) => (
                  <div
                    key={row.code}
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5"
                  >
                    <span className="text-sm font-medium text-slate-800">{row.label}</span>
                    <span className="text-sm tabular-nums text-slate-600">
                      {row.count}{' '}
                      <span className="text-xs text-slate-400">({formatPercent(row.share)})</span>
                    </span>
                  </div>
                ))}
              </div>
            </ReportSection>
          ) : null}

          <ReportSection
            title="Leads con datos de onboarding"
            description={
              countryFilter.trim()
                ? `${tablePagination.totalRows} dominio${tablePagination.totalRows === 1 ? '' : 's'} único${tablePagination.totalRows === 1 ? '' : 's'} en ${countryFilter} (ventana ${windowDays}d). ${ONBOARDING_PAGE_SIZE} por página.`
                : `${tablePagination.totalRows} dominio${tablePagination.totalRows === 1 ? '' : 's'} único${tablePagination.totalRows === 1 ? '' : 's'} en la ventana. ${ONBOARDING_PAGE_SIZE} por página.`
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-slate-500">
                  <tr>
                    <th className="py-2">Fecha</th>
                    <th className="py-2">Marca / dominio</th>
                    <th className="py-2">Email</th>
                    <th className="py-2">País</th>
                    <th className="py-2">Nombre</th>
                    <th className="py-2">Cómo llegó</th>
                    <th className="py-2">Estado</th>
                    <th className="py-2">Reporte</th>
                    <th className="py-2">Mails</th>
                  </tr>
                </thead>
                <tbody>
                  {tablePagination.totalRows === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-6 text-center text-sm text-slate-500">
                        {countryFilter.trim()
                          ? `Sin leads con datos de onboarding para ${countryFilter} en este período.`
                          : 'Nadie dejó datos del onboarding en este período.'}
                      </td>
                    </tr>
                  ) : (
                    tablePagination.pagedRows.map((row) => (
                      <tr key={row.id} className="border-t border-slate-100 align-top">
                        <td className="py-2 text-xs text-slate-500">{formatDate(row.createdAt)}</td>
                        <td className="py-2">
                          <div className="font-medium text-slate-900">{row.brandName}</div>
                          <div className="text-xs text-slate-500">{row.domain}</div>
                        </td>
                        <td className="py-2 text-xs text-slate-700">{row.email || '—'}</td>
                        <td className="py-2 text-xs text-slate-700">{row.country || '—'}</td>
                        <td className="py-2 text-xs text-slate-700">{row.displayName || '—'}</td>
                        <td className="py-2 text-xs text-slate-700">
                          {row.howFoundLabel || row.howFoundUs || '—'}
                        </td>
                        <td className="py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              STATUS_BADGES[row.status] || STATUS_BADGES.pending
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="py-2">
                          <DiagnosticReportLink diagnosticId={row.id} status={row.status} />
                        </td>
                        <td className="py-2">
                          {row.email ? (
                            <button
                              type="button"
                              onClick={() => void openMails(row.email!, row.brandName)}
                              className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-[11px] font-semibold text-violet-700 shadow-sm transition hover:bg-violet-100"
                              title="Ver correos enviados a este lead"
                            >
                              <Mail className="h-3 w-3" aria-hidden />
                              Ver mails
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {tablePagination.totalRows > 0 ? (
              <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs">
                  Mostrando {(tablePagination.safePage - 1) * ONBOARDING_PAGE_SIZE + 1}–
                  {Math.min(tablePagination.safePage * ONBOARDING_PAGE_SIZE, tablePagination.totalRows)} de{' '}
                  {tablePagination.totalRows}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={tablePagination.safePage <= 1 || loading}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40"
                  >
                    Anterior
                  </button>
                  <span className="text-xs text-slate-500">
                    Página {tablePagination.safePage} / {tablePagination.totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(tablePagination.totalPages, p + 1))}
                    disabled={tablePagination.safePage >= tablePagination.totalPages || loading}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            ) : null}
          </ReportSection>
        </>
      ) : null}

      {mailsOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Mail className="h-4 w-4 text-violet-600" />
                  Mails enviados
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {mailsBrand ? `${mailsBrand} · ` : ''}
                  {mailsEmail}
                </p>
                <p className="mt-1 text-[10px] text-slate-400">
                  El HTML se pide a Resend al verlo (no se guarda en Cleexs). Retención típica ~30 días.
                </p>
              </div>
              <button
                type="button"
                onClick={closeMails}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-2">
              <div className="overflow-y-auto border-b border-slate-100 p-4 lg:border-b-0 lg:border-r">
                {mailsLoading ? (
                  <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando envíos…
                  </div>
                ) : mailsError ? (
                  <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {mailsError}
                  </p>
                ) : mails.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500">
                    No hay envíos registrados para este email.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {mails.map((m) => (
                      <li
                        key={m.id}
                        className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-slate-800">{m.campaignSlug}</p>
                            <p className="mt-0.5 text-[11px] text-slate-500">{formatDate(m.createdAt)}</p>
                            <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">
                              {m.status}
                              {m.cleexsScore != null ? ` · score ${m.cleexsScore}` : ''}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={!looksLikeResendId(m.externalId) || previewLoadingId === m.id}
                            onClick={() => void viewMailContent(m.id)}
                            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-violet-500 disabled:opacity-40"
                            title={
                              looksLikeResendId(m.externalId)
                                ? 'Ver HTML en Resend'
                                : 'Sin ID de Resend'
                            }
                          >
                            {previewLoadingId === m.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Eye className="h-3 w-3" />
                            )}
                            Ver
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex min-h-[280px] flex-col overflow-hidden bg-slate-50">
                {previewError ? (
                  <p className="m-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {previewError}
                  </p>
                ) : preview ? (
                  <>
                    <div className="border-b border-slate-200 bg-white px-4 py-2 text-xs text-slate-600">
                      <p>
                        <span className="font-semibold text-slate-800">Asunto:</span> {preview.email.subject}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {preview.email.from} →{' '}
                        {Array.isArray(preview.email.to) ? preview.email.to.join(', ') : preview.email.to}
                        {preview.email.lastEvent ? ` · ${preview.email.lastEvent}` : ''}
                      </p>
                      {preview.retentionNote ? (
                        <p className="mt-1 text-[10px] text-slate-400">{preview.retentionNote}</p>
                      ) : null}
                    </div>
                    {preview.email.html ? (
                      <iframe
                        title="Preview correo Resend"
                        srcDoc={preview.email.html}
                        className="min-h-0 w-full flex-1 border-0 bg-white"
                        sandbox="allow-same-origin"
                      />
                    ) : (
                      <pre className="overflow-auto p-4 text-xs text-slate-700 whitespace-pre-wrap">
                        {preview.email.text || '(Sin HTML ni texto)'}
                      </pre>
                    )}
                  </>
                ) : (
                  <p className="m-auto px-6 text-center text-sm text-slate-500">
                    Elegí un envío y tocá <strong>Ver mail</strong> para cargar el correo desde Resend.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
