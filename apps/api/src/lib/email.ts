import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth:
    process.env.SMTP_USER && process.env.SMTP_PASS
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  connectionTimeout: 10000,
  greetingTimeout: 5000,
});

export function isEmailDisabled(): boolean {
  return process.env.DISABLE_EMAILS === 'true';
}

export function isEmailConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_HOST !== 'localhost' && process.env.SMTP_USER && process.env.SMTP_PASS);
}

/** Análisis con IA para incluir en el email del diagnóstico */
export interface DiagnosticAnalysisForEmail {
  resumenEjecutivo?: string;
  contextoCompetitivo?: string;
  comentariosPorIntencion?: Array<{
    intencion: string;
    comentario: string;
    score: number;
    interpretacion?: string;
  }>;
  aspectosAdicionales?: string;
  fortalezas?: string[];
  debilidades?: string[];
  sugerencias?: string[];
  proximosPasos?: string[];
}

function buildAnalysisText(analysis: DiagnosticAnalysisForEmail): string {
  const parts: string[] = [];
  if (analysis.resumenEjecutivo) {
    parts.push('RESUMEN EJECUTIVO\n' + analysis.resumenEjecutivo);
  }
  if (analysis.contextoCompetitivo) {
    parts.push('CONTEXTO COMPETITIVO\n' + analysis.contextoCompetitivo);
  }
  if (analysis.comentariosPorIntencion?.length) {
    parts.push(
      'ANÁLISIS POR INTENCIÓN (Urgencia, Calidad, Precio, Consideración)\n' +
        analysis.comentariosPorIntencion
          .map((c) => {
            let block = `${c.intencion} (Score: ${c.score})\n${c.comentario}`;
            if (c.interpretacion) block += `\n${c.interpretacion}`;
            return block;
          })
          .join('\n\n')
    );
  }
  if (analysis.aspectosAdicionales) {
    parts.push('OTROS ASPECTOS RELEVANTES\n' + analysis.aspectosAdicionales);
  }
  if (analysis.fortalezas?.length) {
    parts.push('FORTALEZAS\n' + analysis.fortalezas.map((f) => `• ${f}`).join('\n'));
  }
  if (analysis.debilidades?.length) {
    parts.push('DEBILIDADES\n' + analysis.debilidades.map((d) => `• ${d}`).join('\n'));
  }
  if (analysis.sugerencias?.length) {
    parts.push('SUGERENCIAS\n' + analysis.sugerencias.map((s) => `• ${s}`).join('\n'));
  }
  if (analysis.proximosPasos?.length) {
    parts.push('PRÓXIMOS PASOS\n' + analysis.proximosPasos.map((p) => `• ${p}`).join('\n'));
  }
  return parts.join('\n\n');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildAnalysisHtml(analysis: DiagnosticAnalysisForEmail): string {
  const sections: string[] = [];
  if (analysis.resumenEjecutivo) {
    sections.push(
      `<div style="margin-bottom: 24px;"><p style="font-weight: 600; color: #1e40af; margin-bottom: 10px;">Resumen ejecutivo</p><p style="line-height: 1.7; color: #374151;">${escapeHtml(analysis.resumenEjecutivo).replace(/\n/g, '<br>')}</p></div>`
    );
  }
  if (analysis.contextoCompetitivo) {
    sections.push(
      `<div style="margin-bottom: 24px;"><p style="font-weight: 600; color: #1e40af; margin-bottom: 10px;">Contexto competitivo</p><p style="line-height: 1.7; color: #374151;">${escapeHtml(analysis.contextoCompetitivo).replace(/\n/g, '<br>')}</p></div>`
    );
  }
  if (analysis.comentariosPorIntencion?.length) {
    sections.push(
      `<div style="margin-bottom: 24px;"><p style="font-weight: 600; color: #1e40af; margin-bottom: 10px;">Análisis por intención (Urgencia, Calidad, Precio, Consideración)</p><div style="line-height: 1.7; color: #374151;">` +
        analysis.comentariosPorIntencion
          .map(
            (c) =>
              `<div style="margin-bottom: 16px; padding: 12px; background: #f8fafc; border-radius: 6px; border-left: 3px solid #3b82f6;"><p style="margin: 0 0 8px 0;"><strong>${escapeHtml(c.intencion)}</strong> — Score: ${c.score}</p><p style="margin: 0 0 6px 0;">${escapeHtml(c.comentario).replace(/\n/g, '<br>')}</p>${c.interpretacion ? `<p style="margin: 0; font-size: 14px; color: #4b5563;">${escapeHtml(c.interpretacion).replace(/\n/g, '<br>')}</p>` : ''}</div>`
          )
          .join('') +
        '</div></div>'
    );
  }
  if (analysis.aspectosAdicionales) {
    sections.push(
      `<div style="margin-bottom: 24px;"><p style="font-weight: 600; color: #1e40af; margin-bottom: 10px;">Otros aspectos relevantes</p><p style="line-height: 1.7; color: #374151;">${escapeHtml(analysis.aspectosAdicionales).replace(/\n/g, '<br>')}</p></div>`
    );
  }
  if (analysis.fortalezas?.length) {
    sections.push(
      `<div style="margin-bottom: 20px;"><p style="font-weight: 600; color: #15803d; margin-bottom: 8px;">Fortalezas</p><ul style="margin: 0; padding-left: 20px; line-height: 1.6; color: #374151;">` +
        analysis.fortalezas.map((f) => `<li>${escapeHtml(f)}</li>`).join('') +
        '</ul></div>'
    );
  }
  if (analysis.debilidades?.length) {
    sections.push(
      `<div style="margin-bottom: 20px;"><p style="font-weight: 600; color: #b45309; margin-bottom: 8px;">Debilidades</p><ul style="margin: 0; padding-left: 20px; line-height: 1.6; color: #374151;">` +
        analysis.debilidades.map((d) => `<li>${escapeHtml(d)}</li>`).join('') +
        '</ul></div>'
    );
  }
  if (analysis.sugerencias?.length) {
    sections.push(
      `<div style="margin-bottom: 20px;"><p style="font-weight: 600; color: #1e40af; margin-bottom: 8px;">Sugerencias</p><ul style="margin: 0; padding-left: 20px; line-height: 1.6; color: #374151;">` +
        analysis.sugerencias.map((s) => `<li>${escapeHtml(s)}</li>`).join('') +
        '</ul></div>'
    );
  }
  if (analysis.proximosPasos?.length) {
    sections.push(
      `<div style="margin-bottom: 20px; padding: 12px; background: #eff6ff; border-radius: 8px;"><p style="font-weight: 600; color: #1e40af; margin-bottom: 8px;">Próximos pasos</p><ol style="margin: 0; padding-left: 20px; line-height: 1.6; color: #374151;">` +
        analysis.proximosPasos.map((p) => `<li>${escapeHtml(p)}</li>`).join('') +
        '</ol></div>'
    );
  }
  return sections.join('');
}

/**
 * Envía un correo con el link al resultado del diagnóstico.
 * Si analysis está presente, incluye el informe de IA en el cuerpo (no se muestra en pantalla).
 */
export async function sendDiagnosticLink(
  to: string,
  diagnosticId: string,
  baseUrl: string,
  analysis?: DiagnosticAnalysisForEmail | null
): Promise<void> {
  if (isEmailDisabled()) return;
  if (!isEmailConfigured()) return;
  const link = `${baseUrl.replace(/\/$/, '')}/ver-resultado?diagnosticId=${diagnosticId}`;
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@cleexs.com';
  const fromName = process.env.SMTP_FROM_NAME;
  const from = fromName ? `"${fromName}" <${fromEmail}>` : fromEmail;

  const hasAnalysis = analysis && typeof analysis === 'object';
  const analysisText = hasAnalysis ? '\n\n---\n\n' + buildAnalysisText(analysis) + '\n\n---\n\n' : '';
  const analysisHtml = hasAnalysis
    ? `<div style="margin: 24px 0; padding: 20px; background: #f9fafb; border-radius: 8px; border-left: 4px solid #2563eb;">${buildAnalysisHtml(analysis)}</div>`
    : '';

  await transporter.sendMail({
    from,
    to,
    subject: 'Tu diagnóstico Cleexs está listo',
    text:
      `Tu diagnóstico está listo.${analysisText}` +
      `\n\nVer resultados: ${link}\n\n` +
      `Copiá el link en el navegador si no funciona el botón.`,
    html: `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
        <p>Tu diagnóstico Cleexs está listo.</p>
        ${analysisHtml}
        <p style="margin: 24px 0;">
          <a href="${link}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Ver resultados</a>
        </p>
        <p style="color: #6b7280; font-size: 14px;">Si el botón no funciona, copiá este link en el navegador:</p>
        <p style="word-break: break-all; font-size: 14px;">${link}</p>
      </div>
    `,
  });
}
