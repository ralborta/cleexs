/**
 * Textos para compartir resultado (difusión pública) vs invitar al equipo (informe detallado).
 * Los enlaces los arma el caller (path con UTM); acá solo el cuerpo del mensaje.
 */

/** Línea tipo "Marca (dominio)" para reemplazar el ejemplo fijo del copy viral. */
export function formatShareExample(brandName: string, domain?: string | null): string {
  const name = (brandName || '').trim() || 'tu marca';
  const d = (domain || '').trim();
  if (!d || d.startsWith('brand-')) return name;
  return `${name} (${d})`;
}

function domainLineForTeam(brandName: string, domain?: string | null): string {
  const d = (domain || '').trim();
  if (!d || d.startsWith('brand-')) return '(dominio no informado o derivado del nombre)';
  return d;
}

/** Vista pública resumida: WhatsApp, LinkedIn, X y Email (misma idea, formatos distintos). */
export function buildPublicShareCopy(opts: { brandName: string; domain?: string | null; url: string }) {
  const example = formatShareExample(opts.brandName, opts.domain);
  const url = opts.url.trim();

  const socialBlock =
    `¿Tu empresa es la favorita de ChatGPT?\n` +
    `Yo pensé que sí… pero no 😅\n` +
    `Probé con ${example} y el Cleexs Score no fue el que esperaba.\n` +
    `Fijate el tuyo acá (gratis):\n` +
    `${url}`;

  const emailSubject = 'Tu empresa… ¿es la favorita de ChatGPT?';

  const emailBody =
    `Cada vez más clientes buscan en ChatGPT.\n` +
    `La pregunta es: ¿aparece tu empresa… o tu competencia?\n` +
    `Probé con ${example} y vi exactamente cómo la está evaluando la IA.\n` +
    `Se llama Cleexs Score. Y tiene un reporte completísimo, gratis.\n` +
    `Podés ver el tuyo acá:\n` +
    `${url}`;

  const twitterText = socialBlock
    .split('\n')
    .filter((line) => line.trim() !== url)
    .join('\n')
    .trim();

  return {
    whatsappText: socialBlock,
    /** Texto del tweet sin la URL final (X la agrega con el parámetro `url`). */
    twitterText,
    linkedinTitle: '¿Tu empresa es la favorita de ChatGPT?',
    linkedinSummary: socialBlock,
    emailSubject,
    emailBody,
  };
}

/** Informe detallado para marketing/agencia: solo WhatsApp y Email en la UI. */
export function buildTeamInviteCopy(opts: { brandName: string; domain?: string | null; url: string }) {
  const url = opts.url.trim();
  const brand = (opts.brandName || '').trim() || 'la marca';
  const dom = domainLineForTeam(opts.brandName, opts.domain);

  const whatsappText =
    `Te paso el informe completo del diagnóstico Cleexs (mismas métricas y comparativas que estamos viendo acá).\n` +
    `Marca: ${brand}\n` +
    `Dominio analizado: ${dom}\n` +
    `Abrí el informe detallado:\n` +
    `${url}\n` +
    `Si quieren seguir con más diagnósticos, pueden entrar a Cleexs desde la web.`;

  const emailSubject = `Cleexs · informe completo del diagnóstico (${brand})`;

  const emailBody =
    `Hola,\n\n` +
    `Te comparto el informe detallado del diagnóstico Cleexs (no es la página pública resumida para redes).\n\n` +
    `Marca: ${brand}\n` +
    `Dominio analizado: ${dom}\n\n` +
    `Abrir informe completo:\n` +
    `${url}\n\n` +
    `Si quieren seguir con más diagnósticos o planes, pueden entrar a Cleexs desde la web.\n\n` +
    `Saludos,`;

  return { whatsappText, emailSubject, emailBody };
}
