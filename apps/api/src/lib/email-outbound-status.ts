/** Estado de configuración de envío (solo lectura de env), sin secretos. */

export function isResendApiKeyConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export function isResendSmtpRelayConfigured(): boolean {
  const host = process.env.SMTP_HOST?.trim().toLowerCase() ?? '';
  return host.includes('resend') && Boolean(process.env.SMTP_USER?.trim() && process.env.SMTP_PASS?.trim());
}

export function isSmtpOutboundConfigured(): boolean {
  return !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_HOST !== 'localhost' &&
    process.env.SMTP_USER?.trim() &&
    process.env.SMTP_PASS?.trim()
  );
}
