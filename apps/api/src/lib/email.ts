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

/** Análisis simple (Freemium o parte de Gold) */
export interface SingleAnalysisForEmail {
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

/** Análisis Gold: OpenAI + Gemini + perspectiva combinada */
export interface DiagnosticAnalysisGoldForEmail {
  tier: 'gold';
  metrics: {
    cleexsScore: number;
    intentionScores: Array<{ label: string; score: number; weight: number }>;
    comparisonSummary: Array<{ name: string; type: string; appearances: number; share: number }>;
  };
  analisisOpenAI: SingleAnalysisForEmail;
  analisisGemini: SingleAnalysisForEmail;
  perspectivaAmbos: string;
}

/** Análisis con IA para incluir en el email del diagnóstico */
export type DiagnosticAnalysisForEmail = SingleAnalysisForEmail | DiagnosticAnalysisGoldForEmail;

function isGoldFormat(a: DiagnosticAnalysisForEmail): a is DiagnosticAnalysisGoldForEmail {
  return typeof a === 'object' && a !== null && (a as { tier?: string }).tier === 'gold';
}

function buildSingleAnalysisText(a: SingleAnalysisForEmail): string {
  const parts: string[] = [];
  if (a.resumenEjecutivo) parts.push('RESUMEN EJECUTIVO\n' + a.resumenEjecutivo);
  if (a.contextoCompetitivo) parts.push('CONTEXTO COMPETITIVO\n' + a.contextoCompetitivo);
  if (a.comentariosPorIntencion?.length) {
    parts.push(
      'ANÁLISIS POR INTENCIÓN\n' +
        a.comentariosPorIntencion
          .map((c) => {
            let block = `${c.intencion} (Score: ${c.score})\n${c.comentario}`;
            if (c.interpretacion) block += `\n${c.interpretacion}`;
            return block;
          })
          .join('\n\n')
    );
  }
  if (a.aspectosAdicionales) parts.push('OTROS ASPECTOS RELEVANTES\n' + a.aspectosAdicionales);
  if (a.fortalezas?.length) parts.push('FORTALEZAS\n' + a.fortalezas.map((f) => `• ${f}`).join('\n'));
  if (a.debilidades?.length) parts.push('DEBILIDADES\n' + a.debilidades.map((d) => `• ${d}`).join('\n'));
  if (a.sugerencias?.length) parts.push('SUGERENCIAS\n' + a.sugerencias.map((s) => `• ${s}`).join('\n'));
  if (a.proximosPasos?.length) parts.push('PRÓXIMOS PASOS\n' + a.proximosPasos.map((p) => `• ${p}`).join('\n'));
  return parts.join('\n\n');
}

function buildMetricsText(m: DiagnosticAnalysisGoldForEmail['metrics']): string {
  const parts: string[] = [
    `Cleexs Score: ${m.cleexsScore.toFixed(0)}`,
    m.intentionScores.map((i) => `${i.label}: ${i.score.toFixed(0)} (peso ${i.weight}%)`).join('\n'),
    m.comparisonSummary.map((c) => `${c.name} (${c.type}): ${c.appearances} apariciones, ${c.share.toFixed(1)}% Top 3`).join('\n'),
  ];
  return parts.filter(Boolean).join('\n');
}

function buildAnalysisText(analysis: DiagnosticAnalysisForEmail): string {
  if (isGoldFormat(analysis)) {
    const metrics = 'MÉTRICAS DEL DIAGNÓSTICO\n' + buildMetricsText(analysis.metrics);
    const openai = 'ASÍ TE VEN EN OPENAI (ChatGPT)\n' + buildSingleAnalysisText(analysis.analisisOpenAI);
    const gemini = 'ASÍ TE VEN EN GEMINI\n' + buildSingleAnalysisText(analysis.analisisGemini);
    const ambos = 'ASÍ TE VEN EN AMBOS\n' + analysis.perspectivaAmbos;
    return [metrics, openai, gemini, ambos].join('\n\n---\n\n');
  }
  return buildSingleAnalysisText(analysis);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildSingleAnalysisHtml(a: SingleAnalysisForEmail): string {
  const sections: string[] = [];
  if (a.resumenEjecutivo) {
    sections.push(
      `<div style="margin-bottom: 24px;"><p style="font-weight: 600; color: #1e40af; margin-bottom: 10px;">Resumen ejecutivo</p><p style="line-height: 1.7; color: #374151;">${escapeHtml(a.resumenEjecutivo).replace(/\n/g, '<br>')}</p></div>`
    );
  }
  if (a.contextoCompetitivo) {
    sections.push(
      `<div style="margin-bottom: 24px;"><p style="font-weight: 600; color: #1e40af; margin-bottom: 10px;">Contexto competitivo</p><p style="line-height: 1.7; color: #374151;">${escapeHtml(a.contextoCompetitivo).replace(/\n/g, '<br>')}</p></div>`
    );
  }
  if (a.comentariosPorIntencion?.length) {
    sections.push(
      `<div style="margin-bottom: 24px;"><p style="font-weight: 600; color: #1e40af; margin-bottom: 10px;">Análisis por intención</p><div style="line-height: 1.7; color: #374151;">` +
        a.comentariosPorIntencion
          .map(
            (c) =>
              `<div style="margin-bottom: 16px; padding: 12px; background: #f8fafc; border-radius: 6px; border-left: 3px solid #3b82f6;"><p style="margin: 0 0 8px 0;"><strong>${escapeHtml(c.intencion)}</strong> — Score: ${c.score}</p><p style="margin: 0 0 6px 0;">${escapeHtml(c.comentario).replace(/\n/g, '<br>')}</p>${c.interpretacion ? `<p style="margin: 0; font-size: 14px; color: #4b5563;">${escapeHtml(c.interpretacion).replace(/\n/g, '<br>')}</p>` : ''}</div>`
          )
          .join('') +
        '</div></div>'
    );
  }
  if (a.aspectosAdicionales) {
    sections.push(
      `<div style="margin-bottom: 24px;"><p style="font-weight: 600; color: #1e40af; margin-bottom: 10px;">Otros aspectos relevantes</p><p style="line-height: 1.7; color: #374151;">${escapeHtml(a.aspectosAdicionales).replace(/\n/g, '<br>')}</p></div>`
    );
  }
  if (a.fortalezas?.length) {
    sections.push(
      `<div style="margin-bottom: 20px;"><p style="font-weight: 600; color: #15803d; margin-bottom: 8px;">Fortalezas</p><ul style="margin: 0; padding-left: 20px; line-height: 1.6; color: #374151;">` +
        a.fortalezas.map((f) => `<li>${escapeHtml(f)}</li>`).join('') +
        '</ul></div>'
    );
  }
  if (a.debilidades?.length) {
    sections.push(
      `<div style="margin-bottom: 20px;"><p style="font-weight: 600; color: #b45309; margin-bottom: 8px;">Debilidades</p><ul style="margin: 0; padding-left: 20px; line-height: 1.6; color: #374151;">` +
        a.debilidades.map((d) => `<li>${escapeHtml(d)}</li>`).join('') +
        '</ul></div>'
    );
  }
  if (a.sugerencias?.length) {
    sections.push(
      `<div style="margin-bottom: 20px;"><p style="font-weight: 600; color: #1e40af; margin-bottom: 8px;">Sugerencias</p><ul style="margin: 0; padding-left: 20px; line-height: 1.6; color: #374151;">` +
        a.sugerencias.map((s) => `<li>${escapeHtml(s)}</li>`).join('') +
        '</ul></div>'
    );
  }
  if (a.proximosPasos?.length) {
    sections.push(
      `<div style="margin-bottom: 20px; padding: 12px; background: #eff6ff; border-radius: 8px;"><p style="font-weight: 600; color: #1e40af; margin-bottom: 8px;">Próximos pasos</p><ol style="margin: 0; padding-left: 20px; line-height: 1.6; color: #374151;">` +
        a.proximosPasos.map((p) => `<li>${escapeHtml(p)}</li>`).join('') +
        '</ol></div>'
    );
  }
  return sections.join('');
}

function buildMetricsHtml(m: DiagnosticAnalysisGoldForEmail['metrics']): string {
  const intentionRows = m.intentionScores.map((i) => `${escapeHtml(i.label)}: ${i.score.toFixed(0)} (peso ${i.weight}%)`).join('<br>');
  const comparisonRows = m.comparisonSummary.map((c) => `${escapeHtml(c.name)} (${escapeHtml(c.type)}): ${c.appearances} apariciones, ${c.share.toFixed(1)}% Top 3`).join('<br>');
  return `<div style="margin-bottom: 24px; padding: 16px; background: #f0f9ff; border-radius: 8px; border-left: 4px solid #0ea5e9;"><p style="font-weight: 600; color: #0369a1; margin-bottom: 10px;">Métricas del diagnóstico</p><p style="margin: 0 0 8px 0;"><strong>Cleexs Score:</strong> ${m.cleexsScore.toFixed(0)}</p><p style="margin: 0 0 8px 0;"><strong>Por intención:</strong><br>${intentionRows}</p><p style="margin: 0;"><strong>Top competidores:</strong><br>${comparisonRows}</p></div>`;
}

function buildAnalysisHtml(analysis: DiagnosticAnalysisForEmail): string {
  if (isGoldFormat(analysis)) {
    const metrics = buildMetricsHtml(analysis.metrics);
    const openai =
      '<div style="margin-bottom: 28px;"><p style="font-weight: 700; font-size: 16px; color: #0f172a; margin-bottom: 12px;">Así te ven en OpenAI (ChatGPT)</p>' +
      buildSingleAnalysisHtml(analysis.analisisOpenAI) +
      '</div>';
    const gemini =
      '<div style="margin-bottom: 28px;"><p style="font-weight: 700; font-size: 16px; color: #0f172a; margin-bottom: 12px;">Así te ven en Gemini</p>' +
      buildSingleAnalysisHtml(analysis.analisisGemini) +
      '</div>';
    const ambos =
      '<div style="margin-bottom: 20px; padding: 16px; background: #ecfdf5; border-radius: 8px; border-left: 4px solid #10b981;"><p style="font-weight: 700; font-size: 16px; color: #065f46; margin-bottom: 10px;">Así te ven en ambos</p><p style="line-height: 1.7; color: #374151;">' +
      escapeHtml(analysis.perspectivaAmbos).replace(/\n/g, '<br>') +
      '</p></div>';
    return metrics + openai + gemini + ambos;
  }
  return buildSingleAnalysisHtml(analysis);
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
