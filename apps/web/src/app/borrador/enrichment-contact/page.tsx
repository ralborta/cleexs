import type { Metadata } from 'next';
import { Building2, MapPin, Users, Briefcase, ExternalLink, Calendar } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Borrador · Enrichment contact (10 empresas) | Cleexs',
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

type Row = {
  email: string;
  domain: string;
  knownName: string;
  knownRole: string;
  org: Org;
};

const ROWS: Row[] = [
  {
    email: 'aaron.chandler@bairesdev.com',
    domain: 'bairesdev.com',
    knownName: 'Aaron Chandler',
    knownRole: 'Vice President of Client Solutions',
    org: {
      name: 'BairesDev',
      industry: 'information technology & services',
      employees: 4000,
      founded: 2009,
      location: 'San Francisco, California, United States',
      linkedin: 'http://www.linkedin.com/company/bairesdev',
      website: 'http://www.bairesdev.com',
    },
  },
  {
    email: 'aayush.panikkar@engati.com',
    domain: 'engati.com',
    knownName: 'Aayush Panikkar',
    knownRole: 'Director of Partnerships',
    org: {
      name: 'Engati',
      industry: 'information technology & services',
      employees: 130,
      founded: 2021,
      location: 'Wilmington, Delaware, United States',
      linkedin: 'http://www.linkedin.com/company/engati',
      website: 'http://www.engati.ai',
    },
  },
  {
    email: 'abongioanni@diarco.com.ar',
    domain: 'diarco.com.ar',
    knownName: 'Andrea Bongioanni',
    knownRole: 'HR Manager',
    org: {
      name: 'Diarco',
      industry: 'wholesale',
      employees: 3000,
      founded: 1980,
      location: 'Tapiales, Buenos Aires Province, Argentina',
      linkedin: 'http://www.linkedin.com/company/diarcomayorista',
      website: 'http://www.diarco.com.ar',
    },
  },
  {
    email: 'a.borda@icmarkets.com',
    domain: 'icmarkets.com',
    knownName: 'Adrian Borda',
    knownRole: 'Customer Support Specialist',
    org: {
      name: 'International Capital Markets Pty. Ltd.',
      industry: null,
      employees: 0,
      founded: 2007,
      location: 'Sydney, New South Wales, Australia',
      linkedin: null,
      website: 'http://www.icmarkets.com',
    },
  },
  {
    email: 'acasabona@inti.gob.ar',
    domain: 'inti.gob.ar',
    knownName: 'Ángel Casabona',
    knownRole: 'Technical Director',
    org: {
      name: 'INTI',
      industry: 'government administration',
      employees: 2400,
      founded: 1957,
      location: 'Villa Libertad, Buenos Aires, Argentina',
      linkedin: 'http://www.linkedin.com/company/inti',
      website: 'http://www.inti.gob.ar',
    },
  },
  {
    email: 'accel@kambista.com',
    domain: 'kambista.com',
    knownName: 'Accel Maeshiro',
    knownRole: 'Backend Developer',
    org: {
      name: 'Kambista',
      industry: 'financial services',
      employees: 45,
      founded: 2016,
      location: 'Miraflores, Lima, Peru',
      linkedin: 'http://www.linkedin.com/company/kambista',
      website: 'http://www.kambista.com',
    },
  },
  {
    email: 'achakraborty@duckduckgo.com',
    domain: 'duckduckgo.com',
    knownName: 'Anirvan Chakraborty',
    knownRole: 'Vice President of Engineering',
    org: {
      name: 'DuckDuckGo',
      industry: 'information technology & services',
      employees: 490,
      founded: 2008,
      location: 'Paoli, Pennsylvania, United States',
      linkedin: 'http://www.linkedin.com/company/duck-duck-go',
      website: 'http://www.duckduckgo.com',
    },
  },
  {
    email: 'acostantino@baufest.com',
    domain: 'baufest.com',
    knownName: 'Alejandro Costantino',
    knownRole: 'Head of Software Development',
    org: {
      name: 'Baufest',
      industry: 'information technology & services',
      employees: 950,
      founded: 1991,
      location: 'Buenos Aires, Argentina',
      linkedin: 'http://www.linkedin.com/company/baufest',
      website: 'http://www.baufest.com',
    },
  },
  {
    email: 'adam.byrnes@freelancer.com',
    domain: 'freelancer.com',
    knownName: 'Adam Byrnes',
    knownRole: 'Vice President of Product and Growth',
    org: {
      name: 'Freelancer.com',
      industry: 'information technology & services',
      employees: 1200,
      founded: 2009,
      location: 'Sydney, New South Wales, Australia',
      linkedin: 'http://www.linkedin.com/company/freelancer-com',
      website: 'http://www.freelancer.com',
    },
  },
  {
    email: 'aacuna@mimo.com.ar',
    domain: 'mimo.com.ar',
    knownName: 'Ariel Acuña',
    knownRole: 'Electromechanical Technician',
    org: {
      name: 'Mimo & Co',
      industry: 'apparel & fashion',
      employees: 1000,
      founded: 1965,
      location: 'Munro, Buenos Aires Province, Argentina',
      linkedin: 'http://www.linkedin.com/company/mimoandco',
      website: 'http://www.mimo.com.ar',
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
  const totalEmp = ROWS.reduce((a, r) => a + (r.org.employees > 0 ? r.org.employees : 0), 0);
  const sorted = [...ROWS].sort((a, b) => b.org.employees - a.org.employees);

  return (
    <main className="min-h-screen bg-[#F4F6F8] text-slate-900">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Cleexs · borrador interno
          </p>
          <h1 className="mt-2 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
            Enrichment contact
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-600">
            Prueba con 10 dominios corporativos: tamaño de empresa, industria, sede y cargo del
            contacto a partir del email.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-[#E9EDF2] px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Empresas</p>
              <p className="mt-1 text-3xl font-bold tabular-nums">10</p>
              <p className="mt-1 text-sm text-slate-600">match org 10/10</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-[#E9EDF2] px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Con tamaño
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums">{withSize}</p>
              <p className="mt-1 text-sm text-slate-600">empleados estimados</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-[#E9EDF2] px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Suma empleados
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums">{totalEmp.toLocaleString('es-AR')}</p>
              <p className="mt-1 text-sm text-slate-600">aprox. del set</p>
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
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Contacto
                </p>
                <p className="mt-0.5 text-sm font-semibold text-slate-800">{row.knownName}</p>
                <p className="text-sm text-slate-600">{row.knownRole}</p>
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
                    LinkedIn <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Qué muestra esta prueba</p>
          <p className="mt-1 leading-relaxed">
            A partir del email corporativo enriquecemos la empresa (empleados, industria, sede,
            LinkedIn) y el perfil del contacto (nombre y cargo). Pensado para leads B2B donde ya
            conocés la compañía y necesitás contexto para outreach.
          </p>
        </div>
      </div>
    </main>
  );
}
