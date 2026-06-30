import { ClienteRunReportView } from '@/components/portal/cliente-run-report-view';

/** Portal cliente Free: mismo contenido que /portal-crecimiento/reporte/[runId]/cliente, menú Free a la izquierda. */
export default function PortalClienteReportePage() {
  return <ClienteRunReportView shell="portal-cliente" />;
}
