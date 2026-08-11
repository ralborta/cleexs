import type { Metadata } from 'next';
import { Building2, MapPin, Users, Briefcase, ExternalLink, Calendar } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Borrador · enrichment-contact | Cleexs',
  robots: { index: false, follow: false },
};

type Org = {
  name: string;
  industry: string | null;
  employees: number;
  founded: number | null;
  location: string | null;
  linkedin: string | null;
  website: string | null;
};

type Person = {
  name: string;
  title: string | null;
  seniority: string | null;
  linkedin: string | null;
  found: boolean;
};

type Row = {
  email: string;
  domain: string;
  /** Rubro declarado en el diagnóstico. */
  diagnosticIndustry: string | null;
  person: Person;
  org: Org;
};

function li(url: string | null) {
  if (!url) return null;
  return url.startsWith('http') ? url : `https://${url}`;
}

/** 10 contactos con diagnóstico completed + email corporativo (prod). Persona vía PDL. */
const ROWS: Row[] = [
  {
    email: 'gbergese@coppel.com.ar',
    domain: 'coppel.com.ar',
    diagnosticIndustry: 'Retail de electrodomésticos y moda',
    person: {
      name: 'Gustavo Bergese',
      title: 'Commercial Director',
      seniority: 'director',
      linkedin: li('linkedin.com/in/gustavo-lara-bergese-4867b73'),
      found: true,
    },
    org: {
      name: 'Coppel Arg',
      industry: 'retail',
      employees: 2000,
      founded: 2010,
      location: 'Buenos Aires, Autonomous City of Buenos Aires, Argentina',
      linkedin: 'http://www.linkedin.com/company/coppel-arg',
      website: 'http://www.coppel.com.ar',
    },
  },
  {
    email: 'paolo.mendez@producteca.com',
    domain: 'producteca.com',
    diagnosticIndustry: 'Tecnología para e-commerce',
    person: {
      name: 'Paolo Méndez',
      title: null,
      seniority: null,
      linkedin: null,
      found: false,
    },
    org: {
      name: 'Producteca',
      industry: 'information technology & services',
      employees: 87,
      founded: 2016,
      location: 'Buenos Aires, Autonomous City of Buenos Aires, Argentina',
      linkedin: 'http://www.linkedin.com/company/producteca',
      website: 'http://www.producteca.com',
    },
  },
  {
    email: 'santiago@leadaki.com',
    domain: 'leadaki.com',
    diagnosticIndustry: 'Marketing digital',
    person: {
      name: 'Santiago Verardi',
      title: 'Responsable de ventas (Cliengo & Leadaki)',
      seniority: null,
      linkedin: li('linkedin.com/in/santiago-verardi-64b39713'),
      found: true,
    },
    org: {
      name: 'Leadaki',
      industry: 'marketing & advertising',
      employees: 35,
      founded: 2012,
      location: 'Buenos Aires, Buenos Aires, Argentina',
      linkedin: 'http://www.linkedin.com/company/leadaki-com',
      website: 'http://www.leadaki.com',
    },
  },
  {
    email: 'maria@rumazapatos.com.ar',
    domain: 'rumazapatos.com.ar',
    diagnosticIndustry: 'Calzado y accesorios de moda B2C',
    person: {
      name: 'María Giannone',
      title: 'Propietario',
      seniority: 'owner',
      linkedin: li('linkedin.com/in/maría-giannone-9b4b2032'),
      found: true,
    },
    org: {
      name: 'RUMA Zapatos & Carteras',
      industry: 'apparel & fashion',
      employees: 23,
      founded: 2000,
      location: 'Buenos Aires, Autonomous City of Buenos Aires, Argentina',
      linkedin: 'http://www.linkedin.com/company/ruma-zapatos',
      website: 'http://www.rumazapatos.com.ar',
    },
  },
  {
    email: 'pberttoni@pigal.com',
    domain: 'pigal.com',
    diagnosticIndustry: 'Moda y confección de ropa',
    person: {
      name: 'P. Berttoni',
      title: null,
      seniority: null,
      linkedin: null,
      found: false,
    },
    org: {
      name: 'Pigal Boutique',
      industry: 'apparel & fashion',
      employees: 3,
      founded: null,
      location: null,
      linkedin: 'http://www.linkedin.com/company/pigal-boutique',
      website: 'http://www.pigal.com',
    },
  },
  {
    email: 'czegada@hormipret.com',
    domain: 'hormipret.com',
    diagnosticIndustry: 'Prefabricados para la construcción',
    person: {
      name: 'Carlos Zegada',
      title: null,
      seniority: null,
      linkedin: null,
      found: false,
    },
    org: {
      name: 'HORMIPRET Chile',
      industry: 'construction',
      employees: 13,
      founded: null,
      location: 'Providencia, Santiago Metropolitan Region, Chile',
      linkedin: 'http://www.linkedin.com/company/hormipretchile',
      website: 'http://www.hormipret.cl',
    },
  },
  {
    email: 'pablo@nowmarketingdigital.com',
    domain: 'nowmarketingdigital.com',
    diagnosticIndustry: 'Marketing digital en Argentina',
    person: {
      name: 'Pablo Calderón',
      title: 'Co-founder',
      seniority: 'owner',
      linkedin: li('linkedin.com/in/pablo-santiago-calderon'),
      found: true,
    },
    org: {
      name: 'NOW! Marketing Digital',
      industry: 'marketing & advertising',
      employees: 12,
      founded: 2007,
      location: 'Palma, Balearic Islands, Spain',
      linkedin: 'http://www.linkedin.com/company/now-marketing-digital',
      website: 'http://www.nowmarketingdigital.com',
    },
  },
  {
    email: 'mateo.debardeci@deeppsy.io',
    domain: 'deeppsy.io',
    diagnosticIndustry: 'Tecnología de salud mental',
    person: {
      name: 'Mateo de Bardeci',
      title: 'Chief Executive Officer & Co-founder',
      seniority: 'cxo',
      linkedin: li('linkedin.com/in/mateo-de-bardeci'),
      found: true,
    },
    org: {
      name: 'DeepPsy AG',
      industry: 'medical practice',
      employees: 5,
      founded: 2021,
      location: 'Zuerich, Zurich, Switzerland',
      linkedin: 'http://www.linkedin.com/company/deeppsy',
      website: 'http://www.deeppsy.io',
    },
  },
  {
    email: 'maxi@lideraconia.com',
    domain: 'lideraconia.com',
    diagnosticIndustry: 'Consultoría en inteligencia artificial para PYMEs',
    person: {
      name: 'Maxi',
      title: null,
      seniority: null,
      linkedin: null,
      found: false,
    },
    org: {
      name: 'Lidera con IA',
      industry: 'management consulting',
      employees: 4,
      founded: null,
      location: 'Buenos Aires, Argentina',
      linkedin: 'http://www.linkedin.com/company/lideraconia',
      website: 'http://www.lideraconia.com',
    },
  },
  {
    email: 'Rodrigo.baluk@nitropay.ar',
    domain: 'nitropay.ar',
    diagnosticIndustry: 'Servicios financieros para pequeños comercios',
    person: {
      name: 'Rodrigo Baluk',
      title: 'Socio fundador',
      seniority: null,
      linkedin: li('linkedin.com/in/rodrigobaluk'),
      found: true,
    },
    org: {
      name: 'NITRO+',
      industry: 'financial services',
      employees: 3,
      founded: 2021,
      location: 'Buenos Aires, Autonomous City of Buenos Aires, Argentina',
      linkedin: 'http://www.linkedin.com/company/nitro-pay',
      website: 'http://www.nitropay.ar',
    },
  },
];

function formatEmployees(n: number) {
  if (!n || n <= 0) return 'Sin dato';
  return n.toLocaleString('es-AR');
}

function sizeBand(n: number) {
  if (!n || n <= 0) return '—';
  if (n < 50) return 'Micro / PyME';
  if (n < 200) return 'PyME';
  if (n < 1000) return 'Media';
  if (n < 5000) return 'Grande';
  return 'Enterprise';
}

function industryLabel(raw: string | null) {
  if (!raw) return 'Sin industria';
  return raw
    .split(' ')
    .map((w) => (w.length <= 3 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

export default function EnrichmentContactPage() {
  const withSize = ROWS.filter((r) => r.org.employees > 0).length;
  const withTitle = ROWS.filter((r) => r.person.title).length;
  const sorted = [...ROWS].sort((a, b) => b.org.employees - a.org.employees);

  return (
    <main className="min-h-screen bg-[#F4F6F8] text-slate-900">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Cleexs · borrador interno
          </p>
          <h1 className="mt-2 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
            enrichment-contact
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-600">
            10 contactos que completaron un diagnóstico (email corporativo). Empresa + persona
            (nombre, cargo, LinkedIn).
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-[#E9EDF2] px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Empresas</p>
              <p className="mt-1 text-3xl font-bold tabular-nums">10</p>
              <p className="mt-1 text-sm text-slate-600">diagnósticos completed</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-[#E9EDF2] px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Con tamaño
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums">{withSize}</p>
              <p className="mt-1 text-sm text-slate-600">empleados estimados</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-[#E9EDF2] px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Con cargo</p>
              <p className="mt-1 text-3xl font-bold tabular-nums">
                {withTitle}
                <span className="text-lg font-semibold text-slate-500">/10</span>
              </p>
              <p className="mt-1 text-sm text-slate-600">persona enriquecida</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Fichas enriquecidas</h2>
            <p className="text-sm text-slate-500">Ordenadas por tamaño (mayor → menor)</p>
          </div>
          <p className="text-xs text-slate-400">Muestra · 10 empresas</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {sorted.map((row) => (
            <article
              key={row.domain}
              className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
                      <Building2 className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-bold text-slate-900">{row.org.name}</h3>
                      <p className="truncate text-sm text-slate-500">{row.domain}</p>
                    </div>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
                  {sizeBand(row.org.employees)}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    <Users className="h-3 w-3" /> Empleados
                  </p>
                  <p className="mt-0.5 text-xl font-bold tabular-nums text-slate-900">
                    {formatEmployees(row.org.employees)}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    <Calendar className="h-3 w-3" /> Fundada
                  </p>
                  <p className="mt-0.5 text-xl font-bold tabular-nums text-slate-900">
                    {row.org.founded ?? '—'}
                  </p>
                </div>
              </div>

              <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
                <li className="flex gap-2">
                  <Briefcase className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <span>{industryLabel(row.org.industry)}</span>
                </li>
                <li className="flex gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <span>{row.org.location || 'Sin ubicación'}</span>
                </li>
              </ul>

              <div className="mt-4 border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Contacto
                  </p>
                  <span
                    className={
                      row.person.found
                        ? 'rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800'
                        : 'rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500'
                    }
                  >
                    {row.person.found ? 'Perfil OK' : 'Sin perfil'}
                  </span>
                </div>
                <p className="mt-0.5 text-sm font-semibold text-slate-800">{row.person.name}</p>
                <p className="text-sm text-slate-700">
                  {row.person.title || 'Cargo no encontrado'}
                </p>
                {row.person.seniority && (
                  <p className="text-xs capitalize text-slate-500">Seniority: {row.person.seniority}</p>
                )}
                {row.diagnosticIndustry && (
                  <p className="mt-1 text-xs text-slate-400">Diag: {row.diagnosticIndustry}</p>
                )}
                <p className="mt-0.5 truncate text-xs text-slate-400">{row.email}</p>
              </div>

              <div className="mt-auto flex flex-wrap gap-3 pt-4 text-sm font-medium">
                {row.org.website && (
                  <a
                    href={row.org.website}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-slate-700 underline-offset-2 hover:underline"
                  >
                    Sitio <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                {row.org.linkedin && (
                  <a
                    href={row.org.linkedin}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-slate-700 underline-offset-2 hover:underline"
                  >
                    LinkedIn empresa <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                {row.person.linkedin && (
                  <a
                    href={row.person.linkedin}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-slate-700 underline-offset-2 hover:underline"
                  >
                    LinkedIn persona <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
