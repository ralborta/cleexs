/**
 * Enrichment on-demand (click en admin): People Data Labs person + company.
 * No correr en batch; solo cuando el admin abre la ficha.
 */

export type EnrichedPerson = {
  name: string | null;
  title: string | null;
  seniority: string | null;
  linkedin: string | null;
  found: boolean;
};

export type EnrichedOrg = {
  name: string | null;
  industry: string | null;
  employees: number | null;
  founded: number | null;
  location: string | null;
  linkedin: string | null;
  website: string | null;
};

export type ContactEnrichmentResult = {
  ok: boolean;
  email: string;
  domain: string;
  diagnosticIndustry: string | null;
  person: EnrichedPerson;
  org: EnrichedOrg;
  provider: 'pdl' | 'none';
  error?: string;
  cached?: boolean;
};

const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'msn.com',
  'yahoo.com',
  'yahoo.com.ar',
  'ymail.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'gmx.com',
  'mail.com',
  'zoho.com',
]);

const enrichCache = new Map<string, ContactEnrichmentResult>();

function pdlKey() {
  return (process.env.PDL_API_KEY || process.env.PEOPLEDATALABS_API_KEY || '').trim();
}

export function emailDomainOf(email: string): string | null {
  const at = email.trim().toLowerCase().split('@')[1];
  return at?.includes('.') ? at : null;
}

export function isCorporateEmail(email: string, diagnosticDomain?: string | null): boolean {
  const mailDomain = emailDomainOf(email);
  if (!mailDomain) return false;
  if (FREE_EMAIL_DOMAINS.has(mailDomain)) return false;
  if (diagnosticDomain) {
    const diag = diagnosticDomain
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0];
    if (diag && (mailDomain === diag || mailDomain.endsWith(`.${diag}`) || diag.endsWith(`.${mailDomain}`))) {
      return true;
    }
  }
  return true;
}

function normalizeLinkedIn(url: string | null | undefined): string | null {
  if (!url) return null;
  const t = url.trim();
  if (!t) return null;
  return t.startsWith('http') ? t : `https://${t}`;
}

async function enrichPdlPerson(email: string): Promise<{
  person: EnrichedPerson;
  companyHint: { name: string | null; website: string | null; size: string | number | null };
  error?: string;
}> {
  const key = pdlKey();
  if (!key) {
    return {
      person: { name: null, title: null, seniority: null, linkedin: null, found: false },
      companyHint: { name: null, website: null, size: null },
      error: 'PDL_API_KEY no configurada',
    };
  }

  const url = new URL('https://api.peopledatalabs.com/v5/person/enrich');
  url.searchParams.set('email', email);
  url.searchParams.set('pretty', 'true');
  const res = await fetch(url, { headers: { 'X-Api-Key': key } });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (res.status === 200 && body.data && typeof body.data === 'object') {
    const d = body.data as Record<string, unknown>;
    const levels = Array.isArray(d.job_title_levels) ? d.job_title_levels : [];
    const seniority =
      (typeof levels[0] === 'string' && levels[0]) ||
      (typeof d.job_title_role === 'string' ? d.job_title_role : null);
    const fullName =
      (typeof d.full_name === 'string' && d.full_name) ||
      [d.first_name, d.last_name].filter((x) => typeof x === 'string').join(' ') ||
      null;
    return {
      person: {
        name: fullName,
        title: typeof d.job_title === 'string' ? d.job_title : null,
        seniority,
        linkedin: normalizeLinkedIn(typeof d.linkedin_url === 'string' ? d.linkedin_url : null),
        found: Boolean(fullName || d.job_title || d.linkedin_url),
      },
      companyHint: {
        name: typeof d.job_company_name === 'string' ? d.job_company_name : null,
        website: typeof d.job_company_website === 'string' ? d.job_company_website : null,
        size:
          typeof d.job_company_size === 'string' || typeof d.job_company_size === 'number'
            ? d.job_company_size
            : typeof d.job_company_employee_count === 'string' ||
                typeof d.job_company_employee_count === 'number'
              ? d.job_company_employee_count
              : null,
      },
    };
  }

  const errObj = body.error as { message?: string } | undefined;
  return {
    person: { name: null, title: null, seniority: null, linkedin: null, found: false },
    companyHint: { name: null, website: null, size: null },
    error: errObj?.message || (typeof body.message === 'string' ? body.message : `HTTP ${res.status}`),
  };
}

async function enrichPdlCompany(domain: string): Promise<EnrichedOrg> {
  const key = pdlKey();
  if (!key) {
    return {
      name: null,
      industry: null,
      employees: null,
      founded: null,
      location: null,
      linkedin: null,
      website: null,
    };
  }

  const url = new URL('https://api.peopledatalabs.com/v5/company/enrich');
  url.searchParams.set('website', domain);
  url.searchParams.set('pretty', 'true');
  const res = await fetch(url, { headers: { 'X-Api-Key': key } });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (res.status === 200 && body.data && typeof body.data === 'object') {
    const d = body.data as Record<string, unknown>;
    const loc = d.location as Record<string, unknown> | undefined;
    const location =
      [loc?.locality, loc?.region, loc?.country].filter((x) => typeof x === 'string').join(', ') ||
      (typeof loc?.name === 'string' ? loc.name : null);
    const industryV2 = d.industry_v2 as { primary?: string } | undefined;
    const employeesRaw = d.employee_count ?? d.size;
    let employees: number | null = null;
    if (typeof employeesRaw === 'number') employees = employeesRaw;
    else if (typeof employeesRaw === 'string') {
      const n = Number(employeesRaw.replace(/[^\d]/g, ''));
      employees = Number.isFinite(n) && n > 0 ? n : null;
    }
    return {
      name: typeof d.name === 'string' ? d.name : null,
      industry:
        (typeof d.industry === 'string' && d.industry) || industryV2?.primary || null,
      employees,
      founded: typeof d.founded === 'number' ? d.founded : null,
      location,
      linkedin: normalizeLinkedIn(typeof d.linkedin_url === 'string' ? d.linkedin_url : null),
      website:
        (typeof d.website === 'string' && d.website) ||
        (domain.startsWith('http') ? domain : `https://${domain}`),
    };
  }

  return {
    name: null,
    industry: null,
    employees: null,
    founded: null,
    location: null,
    linkedin: null,
    website: domain ? `https://${domain}` : null,
  };
}

function parseSizeHint(size: string | number | null): number | null {
  if (typeof size === 'number' && Number.isFinite(size)) return size;
  if (typeof size === 'string') {
    // Rangos PDL tipo "51-200" / "1001-5000": usar el techo, no concatenar dígitos.
    const range = size.match(/(\d+)\s*[-–]\s*(\d+)/);
    if (range) {
      const hi = Number(range[2]);
      return Number.isFinite(hi) && hi > 0 ? hi : null;
    }
    const n = Number(size.replace(/[^\d]/g, ''));
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

export async function enrichContactOnDemand(input: {
  email: string;
  domain?: string | null;
  diagnosticIndustry?: string | null;
  brandName?: string | null;
}): Promise<ContactEnrichmentResult> {
  const email = input.email.trim().toLowerCase();
  const cacheKey = email;
  const cached = enrichCache.get(cacheKey);
  if (cached) {
    const brandName = input.brandName?.trim() || null;
    return {
      ...cached,
      cached: true,
      org: {
        ...cached.org,
        name: cached.org.name || brandName,
      },
    };
  }

  const mailDomain = emailDomainOf(email);
  const domain =
    (input.domain || '')
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0] ||
    mailDomain ||
    '';

  if (!mailDomain) {
    return {
      ok: false,
      email,
      domain,
      diagnosticIndustry: input.diagnosticIndustry ?? null,
      person: { name: null, title: null, seniority: null, linkedin: null, found: false },
      org: {
        name: input.brandName ?? null,
        industry: null,
        employees: null,
        founded: null,
        location: null,
        linkedin: null,
        website: domain ? `https://${domain}` : null,
      },
      provider: 'none',
      error: 'Email inválido',
    };
  }

  if (!pdlKey()) {
    return {
      ok: false,
      email,
      domain,
      diagnosticIndustry: input.diagnosticIndustry ?? null,
      person: { name: null, title: null, seniority: null, linkedin: null, found: false },
      org: {
        name: input.brandName ?? null,
        industry: null,
        employees: null,
        founded: null,
        location: null,
        linkedin: null,
        website: domain ? `https://${domain}` : null,
      },
      provider: 'none',
      error: 'PDL_API_KEY no configurada en el API',
    };
  }

  const [personRes, org] = await Promise.all([
    enrichPdlPerson(email),
    domain ? enrichPdlCompany(domain) : Promise.resolve(null),
  ]);

  const mergedOrg: EnrichedOrg = {
    name: org?.name || personRes.companyHint.name || input.brandName || null,
    industry: org?.industry || null,
    employees: org?.employees ?? parseSizeHint(personRes.companyHint.size),
    founded: org?.founded ?? null,
    location: org?.location ?? null,
    linkedin: org?.linkedin ?? null,
    website:
      org?.website ||
      (personRes.companyHint.website
        ? normalizeLinkedIn(personRes.companyHint.website)
        : domain
          ? `https://${domain}`
          : null),
  };

  const result: ContactEnrichmentResult = {
    ok: true,
    email,
    domain,
    diagnosticIndustry: input.diagnosticIndustry ?? null,
    person: personRes.person,
    org: mergedOrg,
    provider: 'pdl',
    // PDL sin match de persona no es fallo de la ficha (empresa/brand igual se muestra).
    error:
      personRes.error &&
      !personRes.person.found &&
      !/not\s*found|no records were found|not found matching/i.test(personRes.error)
        ? personRes.error
        : undefined,
  };

  enrichCache.set(cacheKey, result);
  return result;
}
