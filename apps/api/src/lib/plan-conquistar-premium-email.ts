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
  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export async function sendPlanConquistarPremiumWelcomeEmail(input: {
  to: string;
  loginEmail: string;
  portalUrl: string;
  premiumUntil: Date;
  temporaryPassword?: string;
}): Promise<{ sent: boolean; reason?: string }> {
  if (isEmailDisabled()) return { sent: false, reason: 'emails_disabled' };
  if (!isEmailConfigured() && !process.env.RESEND_API_KEY?.trim()) {
    return { sent: false, reason: 'email_not_configured' };
  }

  const portalUrl = input.portalUrl.replace(/\/$/, '');
  const loginEmail = escapeHtml(input.loginEmail);
  const until = escapeHtml(formatDateEs(input.premiumUntil));
  const passwordBlock = input.temporaryPassword
    ? `<p style="margin:0 0 12px 0;padding:14px 16px;background:#f5f3ff;border-radius:10px;border:1px solid #ddd6fe;">
        <strong style="color:#5b21b6;">Contraseña temporal:</strong>
        <span style="font-family:ui-monospace,monospace;font-size:15px;color:#1e1b4b;"> ${escapeHtml(input.temporaryPassword)}</span><br/>
        <span style="font-size:13px;color:#6b7280;">Podés cambiarla después desde el portal.</span>
      </p>`
    : `<p style="margin:0 0 12px 0;color:#475569;font-size:15px;line-height:1.6;">
        Iniciá sesión con la <strong>misma contraseña</strong> que ya usás en Cleexs.
      </p>`;

  const subject = 'Plan Conquistar activo · Tu Plan de Ataque está listo';
  const text =
    `¡Tu pago fue confirmado!\n\n` +
    `Ya tenés Cleexs Premium (Plan Conquistar) activo hasta ${formatDateEs(input.premiumUntil)}.\n\n` +
    `Tu Plan de Ataque: ${portalUrl}\n` +
    `Email de acceso: ${input.loginEmail}\n` +
    (input.temporaryPassword ? `Contraseña temporal: ${input.temporaryPassword}\n` : '') +
    `\nEntrá para ver tu plan de acción de 90 días, score por motores e informe completo.`;

  const html = `
    <div style="margin:0;padding:0;background:#f8fafc;">
      <div style="font-family:Inter,Arial,sans-serif;max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#6d28d9 0%,#4f46e5 100%);padding:28px 32px;color:#fff;">
          <p style="margin:0 0 8px 0;font-size:12px;letter-spacing:2px;font-weight:700;opacity:0.9;">CLEEXS PREMIUM</p>
          <h1 style="margin:0;font-size:26px;line-height:1.2;font-weight:800;">Plan Conquistar activado</h1>
          <p style="margin:12px 0 0 0;font-size:15px;line-height:1.5;opacity:0.95;">Tu pago fue confirmado. Ya está listo tu Plan de Ataque personalizado.</p>
        </div>
        <div style="padding:28px 32px;color:#334155;font-size:15px;line-height:1.6;">
          <p style="margin:0 0 16px 0;">Premium activo hasta <strong>${until}</strong> (90 días).</p>
          <p style="margin:0 0 8px 0;"><strong>Email de acceso:</strong> ${loginEmail}</p>
          ${passwordBlock}
          <p style="margin:20px 0 8px 0;">
            <a href="${portalUrl}" style="display:inline-block;padding:14px 22px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:12px;font-weight:700;">Ver mi Plan de Ataque</a>
          </p>
          <p style="margin:16px 0 0 0;font-size:13px;color:#64748b;">Si el botón no funciona, copiá este link:<br/><span style="word-break:break-all;">${escapeHtml(portalUrl)}</span></p>
        </div>
      </div>
    </div>
  `;

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (apiKey) {
    const resend = new Resend(apiKey);
    const from = buildCleexsFromAddress();
    const { error } = await resend.emails.send({
      from,
      to: input.to,
      subject,
      text,
      html,
    });
    if (error) return { sent: false, reason: error.message };
    return { sent: true };
  }

  await sendSmtpMail({ to: input.to, subject, text, html });
  return { sent: true };
}
