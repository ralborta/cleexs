import type { CleexsInternalEmailCampaign } from '@prisma/client';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Texto plano para fallback SMTP / registros. */
export function buildWeeklySequencePlainText(campaign: Pick<CleexsInternalEmailCampaign, 'weekIndex' | 'title' | 'description'>): string {
  const desc = (campaign.description || '').trim();
  return [
    `Semana ${campaign.weekIndex} · ${campaign.title}`,
    '',
    desc || 'Este mensaje forma parte de la secuencia semanal de Cleexs.',
    '',
    '— Cleexs',
  ].join('\n');
}

/**
 * Plantilla HTML incluida cuando no hay `esp_template_id` en Resend.
 * Si más adelante definís plantillas en el dashboard de Resend, usá variables {{{WEEK}}}, {{{TITLE}}}, {{{PREHEADER}}}, {{{SLUG}}}.
 */
export function buildWeeklySequenceHtmlEmail(campaign: Pick<CleexsInternalEmailCampaign, 'weekIndex' | 'title' | 'description' | 'slug'>): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Cleexs · Semana ${campaign.weekIndex}`;
  const title = escapeHtml(campaign.title);
  const descRaw = (campaign.description || '').trim();
  const descHtml = descRaw ? `<p style="margin:16px 0 0;line-height:1.55;color:#334155;">${escapeHtml(descRaw)}</p>` : '';
  const slug = escapeHtml(campaign.slug);
  const text = buildWeeklySequencePlainText(campaign);

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;background:#f8fafc;font-family:system-ui,-apple-system,Segoe UI,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
        <tr><td style="padding:20px 24px;background:linear-gradient(135deg,#4f46e5,#6366f1);color:#fff;">
          <p style="margin:0;font-size:11px;letter-spacing:.12em;text-transform:uppercase;opacity:.9;">Secuencia semanal</p>
          <h1 style="margin:8px 0 0;font-size:20px;font-weight:700;">Semana ${campaign.weekIndex}</h1>
        </td></tr>
        <tr><td style="padding:24px;">
          <p style="margin:0;font-size:17px;font-weight:600;color:#0f172a;">${title}</p>
          ${descHtml}
          <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;">Ref. interna: <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;">${slug}</code></p>
        </td></tr>
        <tr><td style="padding:16px 24px;border-top:1px solid #f1f5f9;font-size:12px;color:#64748b;">
          Cleexs · visibilidad en IA y buscadores
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}
