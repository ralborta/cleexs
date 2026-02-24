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

/**
 * Envía un correo con el link al resultado del diagnóstico (uno a uno, directo).
 */
export async function sendDiagnosticLink(
  to: string,
  diagnosticId: string,
  baseUrl: string
): Promise<void> {
  if (isEmailDisabled()) return;
  if (!isEmailConfigured()) return;
  const link = `${baseUrl.replace(/\/$/, '')}/ver-resultado?diagnosticId=${diagnosticId}`;
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@cleexs.com';
  const fromName = process.env.SMTP_FROM_NAME;
  const from = fromName ? `"${fromName}" <${fromEmail}>` : fromEmail;

  await transporter.sendMail({
    from,
    to,
    subject: 'Tu diagnóstico Cleexs está listo',
    text: `Tu diagnóstico está listo.\n\nVer resultados: ${link}\n\nCopiá el link en el navegador si no funciona el botón.`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <p>Tu diagnóstico Cleexs está listo.</p>
        <p style="margin: 24px 0;">
          <a href="${link}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Ver resultados</a>
        </p>
        <p style="color: #6b7280; font-size: 14px;">Si el botón no funciona, copiá este link en el navegador:</p>
        <p style="word-break: break-all; font-size: 14px;">${link}</p>
      </div>
    `,
  });
}
