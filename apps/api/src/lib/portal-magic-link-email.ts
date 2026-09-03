import { Resend } from 'resend';
import { buildCleexsFromAddress, isEmailConfigured, isEmailDisabled, sendSmtpMail } from './email';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDateEs(date: Date): string {
  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export async function sendPortalMagicLinkEmail(input: {
  to: string;
  magicLinkUrl: string;
  expiresAt: Date;
  brandOrName: string;
  subject?: string;
  intro?: string;
  redirectHint?: string;
}): Promise<{ sent: boolean; reason?: string }> {
  if (isEmailDisabled()) return { sent: false, reason: 'emails_disabled' };
  if (!isEmailConfigured() && !process.env.RESEND_API_KEY?.trim()) {
    return { sent: false, reason: 'email_not_configured' };
  }

  const brand = escapeHtml(input.brandOrName);
  const until = escapeHtml(formatDateEs(input.expiresAt));
  const portalHint = escapeHtml(input.redirectHint || 'portal Cleexs');
  const subject = input.subject || `Acceso a tu ${portalHint} · Cleexs`;
  const intro =
    input.intro ||
    `Te enviamos un acceso directo a tu ${portalHint}. Hacé click en el botón: no necesitás recordar contraseña en este primer ingreso.`;

  const text =
    `${intro}\n\n` +
    `Entrar: ${input.magicLinkUrl}\n\n` +
    `Este link es personal, de un solo uso y vence el ${formatDateEs(input.expiresAt)}.\n\n` +
    `Cleexs · ${brand}`;

  const html = `
    <div style="margin:0;padding:0;background:#f8fafc;">
      <div style="font-family:Inter,Arial,sans-serif;max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#6d28d9 0%,#4f46e5 100%);padding:28px 32px;color:#fff;">
          <p style="margin:0 0 8px 0;font-size:12px;letter-spacing:2px;font-weight:700;opacity:0.9;">CLEEXS</p>
          <h1 style="margin:0;font-size:24px;line-height:1.2;font-weight:800;">Acceso directo al portal</h1>
          <p style="margin:12px 0 0 0;font-size:15px;line-height:1.5;opacity:0.95;">${escapeHtml(intro)}</p>
        </div>
        <div style="padding:28px 32px;color:#334155;font-size:15px;line-height:1.6;">
          <p style="margin:0 0 16px 0;">Cuenta: <strong>${brand}</strong></p>
          <p style="margin:0 0 20px 0;">
            <a href="${input.magicLinkUrl}" style="display:inline-block;padding:14px 22px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:12px;font-weight:700;">Entrar al portal</a>
          </p>
          <p style="margin:0 0 8px 0;font-size:13px;color:#64748b;">Link de un solo uso · vence el ${until}</p>
          <p style="margin:16px 0 0 0;font-size:13px;color:#64748b;">Si el botón no funciona, copiá este enlace:<br/><span style="word-break:break-all;">${escapeHtml(input.magicLinkUrl)}</span></p>
        </div>
      </div>
    </div>
  `;

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (apiKey) {
    const resend = new Resend(apiKey);
    const from = buildCleexsFromAddress();
    const { error } = await resend.emails.send({ from, to: input.to, subject, text, html });
    if (error) return { sent: false, reason: error.message };
    return { sent: true };
  }

  await sendSmtpMail({ to: input.to, subject, text, html });
  return { sent: true };
}
