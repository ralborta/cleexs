import { prisma } from './prisma';

export const FINAL_OUTREACH_SUBJECT = 'ChatGPT elige a un competidor tuyo';

export const FINAL_OUTREACH_BODY_TEMPLATE =
  'Hola,\n\n' +
  'Preguntamos a ChatGPT: "¿quién me recomendás para {{industryQuery}}?" Aparece un competidor tuyo entre los primeros. Vos no estás.\n\n' +
  'Ya que le hicimos el reporte a ellos, también te armamos uno para vos de cómo te ve la IA. El Cleexs Score dio oportunidades de mejora — y se arregla con 3 cambios muy concretos.\n\n' +
  '¿Querés que te mande el diagnóstico completo? Es gratis. Respondeme este mail y te lo mando.\n\n' +
  'Gonzalo — Fundador, Cleexs';

function fallbackIndustryQuery(industry?: string | null, promptText?: string | null): string {
  const text = `${industry || ''} ${promptText || ''}`.toLowerCase();
  if (/abog|legal|jur[ií]dic|estudio/.test(text)) return 'resolver un tema legal';
  if (/odont|dent|dental/.test(text)) return 'un implante dental';
  if (/salud|m[eé]dic|cl[ií]nica|hospital/.test(text)) return 'atenderme con un especialista';
  if (/conta|impuest|monotribut|financ/.test(text)) return 'ordenar mis impuestos';
  if (/inmobili|propiedad|alquiler|real estate/.test(text)) return 'comprar o alquilar una propiedad';
  if (/software|tecnolog|saas|automatiz|digital/.test(text)) return 'implementar una solución tecnológica';
  if (/educ|coleg|univers|curso/.test(text)) return 'elegir una institución educativa';
  if (/hotel|turis|viaje|restaur/.test(text)) return 'organizar una experiencia en tu ciudad';
  if (/constru|arquitect|obra|ingenier/.test(text)) return 'hacer una obra o remodelación';
  const cleaned = (industry || '').trim();
  if (cleaned) return `contratar una empresa de ${cleaned}`;
  return 'resolver una necesidad de mi rubro';
}

async function buildIndustryQuery(args: {
  industry?: string | null;
  promptText?: string | null;
  competitorName: string;
}): Promise<string> {
  const fallback = fallbackIndustryQuery(args.industry, args.promptText);
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return fallback;
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        max_tokens: 30,
        messages: [
          {
            role: 'system',
            content:
              'Devolvé solo una frase corta en español, sin comillas ni punto final, que complete: "¿quién me recomendás para ___?". Debe ser una consulta concreta y de alto impacto para la industria.',
          },
          {
            role: 'user',
            content:
              `Industria: ${args.industry || 'desconocida'}\n` +
              `Competidor: ${args.competitorName}\n` +
              `Prompt original/evidencia: ${args.promptText || 'sin dato'}\n` +
              `Fallback si no alcanza: ${fallback}`,
          },
        ],
      }),
    });
    const json = (await response.json()) as any;
    const phrase = String(json?.choices?.[0]?.message?.content || '')
      .trim()
      .replace(/^["“”']+|["“”'.]+$/g, '');
    if (response.ok && phrase && phrase.length <= 120) return phrase;
  } catch {
    // El email no debe bloquearse si falla la generación de la consulta.
  }
  return fallback;
}

export async function createOutreachLeadEmailDraft(args: {
  leadSourceId: string;
  leadContactId: string;
  meta?: Record<string, unknown>;
}) {
  const lead = await prisma.leadSource.findUnique({
    where: { id: args.leadSourceId },
    include: {
      brand: true,
      run: true,
    },
  });

  const contact = await prisma.leadContact.findUnique({
    where: { id: args.leadContactId },
  });

  if (!lead || !contact || contact.leadSourceId !== lead.id) {
    throw Object.assign(new Error('Lead o contacto no encontrado'), { statusCode: 404 });
  }

  const evidence = lead.evidenceJson as any;
  const brandName = lead.brand?.name || 'una marca';
  const industry = lead.brand?.industry || null;
  const competitorName = lead.competitorName;
  const industryQuery = await buildIndustryQuery({
    industry,
    promptText: evidence?.promptText || null,
    competitorName,
  });
  const top3Lines = (evidence?.top3 || [])
    .map((entry: any) => `${entry.position}. ${entry.name}`)
    .join('\n');
  const top3Inline = (evidence?.top3 || [])
    .map((entry: any) => `${entry.position}. ${entry.name}`)
    .join(', ');

  const template = await prisma.outreachTemplate
    .findUnique({ where: { key: 'default' } })
    .catch(() => null);

  const subjectTemplate = template?.subject || FINAL_OUTREACH_SUBJECT;
  const bodyTemplate = template?.body || FINAL_OUTREACH_BODY_TEMPLATE;
  const renderVars = (input: string): string =>
    input
      .replace(/\{\{\s*brandName\s*\}\}/g, brandName)
      .replace(/\{\{\s*competitorName\s*\}\}/g, competitorName)
      .replace(/\{\{\s*industryQuery\s*\}\}/g, industryQuery)
      .replace(/\{\{\s*top3\s*\}\}/g, top3Lines)
      .replace(/\{\{\s*top3Inline\s*\}\}/g, top3Inline);

  const subject = renderVars(subjectTemplate);
  const body = renderVars(bodyTemplate);

  return prisma.leadEmail.create({
    data: {
      leadSourceId: lead.id,
      leadContactId: contact.id,
      subject,
      body,
      status: 'draft',
      metaJson: args.meta
        ? {
            ...args.meta,
            industryQuery,
          }
        : {
            industryQuery,
          },
    },
  });
}
