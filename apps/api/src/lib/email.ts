import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth:
    process.env.SMTP_USER && process.env.SMTP_PASS
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
});

/**
 * Envía un correo con el link al resultado del diagnóstico (uno a uno, directo).
 */
export async function sendDiagnosticLink(
  to: string,
  diagnosticId: string,
  baseUrl: string
): Promise<void> {
  const link = `${baseUrl.replace(/\/$/, '')}/ver-resultado?diagnosticId=${diagnosticId}`;
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@cleexs.com';

  await transporter.sendMail({
    from,
    to,
    subject: 'Tu diagnóstico Cleexs está listo',
    text: `Tu diagnóstico está listo. Abrí este link para ver los resultados y registrarte:\n\n${link}`,
    html: `
      <p>Tu diagnóstico está listo.</p>
      <p><a href="${link}">Ver resultados y registrarme</a></p>
      <p>Si el enlace no funciona, copiá esta URL en el navegador:</p>
      <p>${link}</p>
    `,
  });
}
