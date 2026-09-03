#!/usr/bin/env node
/**
 * Prueba A/B enrichment: People Data Labs vs Apollo (y nota sobre Clay).
 *
 * Uso:
 *   export PDL_API_KEY=...
 *   export APOLLO_API_KEY=...
 *   node scripts/enrichment-bakeoff.mjs
 *
 * Opcional: CLAY_API_KEY — Clay no tiene Person Enrichment API pública
 * comparable; si hay key se documenta el skip.
 *
 * Free tiers: PDL ~100/mes; Apollo credits del plan.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const EMAILS = [
  { email: 'aaron.chandler@bairesdev.com', domain: 'bairesdev.com', knownName: 'Aaron Chandler', knownRole: 'Vice President of Client Solutions' },
  { email: 'aayush.panikkar@engati.com', domain: 'engati.com', knownName: 'Aayush Panikkar', knownRole: 'Director of Partnerships' },
  { email: 'abongioanni@diarco.com.ar', domain: 'diarco.com.ar', knownName: 'Andrea Bongioanni', knownRole: 'HR Manager' },
  { email: 'a.borda@icmarkets.com', domain: 'icmarkets.com', knownName: 'Adrian Borda', knownRole: 'Customer Support Specialist' },
  { email: 'acasabona@inti.gob.ar', domain: 'inti.gob.ar', knownName: 'Ángel Casabona', knownRole: 'Technical Director' },
  { email: 'accel@kambista.com', domain: 'kambista.com', knownName: 'Accel Maeshiro', knownRole: 'Backend Developer' },
  { email: 'achakraborty@duckduckgo.com', domain: 'duckduckgo.com', knownName: 'Anirvan Chakraborty', knownRole: 'Vice President of Engineering' },
  { email: 'acostantino@baufest.com', domain: 'baufest.com', knownName: 'Alejandro Costantino', knownRole: 'Head of Software Development' },
  { email: 'adam.byrnes@freelancer.com', domain: 'freelancer.com', knownName: 'Adam Byrnes', knownRole: 'Vice President of Product and Growth' },
  { email: 'aacuna@mimo.com.ar', domain: 'mimo.com.ar', knownName: 'Ariel Acuña', knownRole: 'Electromechanical Technician' },
];

const PDL_KEY = process.env.PDL_API_KEY || process.env.PEOPLEDATALABS_API_KEY || '';
const APOLLO_KEY = process.env.APOLLO_API_KEY || '';
const CLAY_KEY = process.env.CLAY_API_KEY || '';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function enrichPdlPerson(email) {
  const url = new URL('https://api.peopledatalabs.com/v5/person/enrich');
  url.searchParams.set('email', email);
  url.searchParams.set('pretty', 'true');
  const res = await fetch(url, { headers: { 'X-Api-Key': PDL_KEY } });
  const body = await res.json().catch(() => ({}));
  if (res.status === 200 && body.data) {
    const d = body.data;
    const company = d.job_company_name || d.job_company_website || null;
    return {
      ok: true,
      provider: 'pdl',
      name: d.full_name || [d.first_name, d.last_name].filter(Boolean).join(' ') || null,
      title: d.job_title || null,
      seniority: d.job_title_levels?.[0] || d.job_title_role || null,
      company,
      companySize: d.job_company_size || d.job_company_employee_count || null,
      location: d.location_name || d.job_company_location_name || null,
      linkedin: d.linkedin_url || null,
      rawStatus: res.status,
    };
  }
  return {
    ok: false,
    provider: 'pdl',
    error: body.error?.message || body.message || `HTTP ${res.status}`,
    rawStatus: res.status,
  };
}

async function enrichPdlCompany(domain) {
  const url = new URL('https://api.peopledatalabs.com/v5/company/enrich');
  url.searchParams.set('website', domain);
  url.searchParams.set('pretty', 'true');
  const res = await fetch(url, { headers: { 'X-Api-Key': PDL_KEY } });
  const body = await res.json().catch(() => ({}));
  if (res.status === 200 && body.data) {
    const d = body.data;
    return {
      ok: true,
      name: d.name || null,
      size: d.size || d.employee_count || null,
      industry: d.industry || d.industry_v2?.primary || null,
      location: [d.location?.locality, d.location?.region, d.location?.country]
        .filter(Boolean)
        .join(', ') || d.location?.name || null,
      linkedin: d.linkedin_url || null,
    };
  }
  return { ok: false, error: body.error?.message || `HTTP ${res.status}` };
}

async function enrichApolloPerson(email, domain) {
  const res = await fetch('https://api.apollo.io/api/v1/people/match', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'X-Api-Key': APOLLO_KEY,
    },
    body: JSON.stringify({
      email,
      organization_name: domain,
      reveal_personal_emails: false,
      reveal_phone_number: false,
    }),
  });
  const body = await res.json().catch(() => ({}));
  const person = body.person;
  if (res.ok && person) {
    const org = person.organization || {};
    return {
      ok: true,
      provider: 'apollo',
      name: person.name || [person.first_name, person.last_name].filter(Boolean).join(' ') || null,
      title: person.title || null,
      seniority: person.seniority || null,
      company: org.name || person.organization_name || null,
      companySize: org.estimated_num_employees || org.employee_count || null,
      location: [person.city, person.state, person.country].filter(Boolean).join(', ') || null,
      companyLocation: [org.city, org.state, org.country].filter(Boolean).join(', ') || null,
      linkedin: person.linkedin_url || null,
      industry: org.industry || null,
      rawStatus: res.status,
    };
  }
  return {
    ok: false,
    provider: 'apollo',
    error: body.error || body.message || `HTTP ${res.status}`,
    rawStatus: res.status,
  };
}

function csvEscape(v) {
  const s = v == null ? '' : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function main() {
  console.log('=== Enrichment bakeoff (10 correos corporativos) ===\n');
  console.log(`PDL key:    ${PDL_KEY ? 'OK' : 'FALTA (export PDL_API_KEY=...)'}`);
  console.log(`Apollo key: ${APOLLO_KEY ? 'OK' : 'FALTA (export APOLLO_API_KEY=...)'}`);
  console.log(
    `Clay key:   ${CLAY_KEY ? 'SET (Clay no tiene Person Enrich API pública comparable → skip)' : 'no seteada'}`
  );
  console.log('');

  if (!PDL_KEY && !APOLLO_KEY) {
    console.error('Necesitás al menos PDL_API_KEY y/o APOLLO_API_KEY para correr la prueba.');
    process.exit(1);
  }

  const rows = [];
  for (const item of EMAILS) {
    console.log(`→ ${item.email}`);
    const row = {
      email: item.email,
      domain: item.domain,
      knownName: item.knownName,
      knownRole: item.knownRole,
      pdl: null,
      apollo: null,
      pdlCompany: null,
    };

    if (PDL_KEY) {
      row.pdl = await enrichPdlPerson(item.email);
      await sleep(350);
      row.pdlCompany = await enrichPdlCompany(item.domain);
      await sleep(350);
    }
    if (APOLLO_KEY) {
      row.apollo = await enrichApolloPerson(item.email, item.domain);
      await sleep(350);
    }
    rows.push(row);
    const pdlTitle = row.pdl?.ok ? row.pdl.title : row.pdl?.error;
    const apoTitle = row.apollo?.ok ? row.apollo.title : row.apollo?.error;
    console.log(`   PDL:    ${pdlTitle ?? '—'}`);
    console.log(`   Apollo: ${apoTitle ?? '—'}`);
  }

  const outJson = path.join(ROOT, 'docs', 'enrichment-bakeoff-results.json');
  const outCsv = path.join(ROOT, 'docs', 'enrichment-bakeoff-results.csv');
  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.writeFileSync(outJson, JSON.stringify({ ranAt: new Date().toISOString(), rows }, null, 2));

  const header = [
    'email',
    'known_name',
    'known_role_hunter',
    'pdl_ok',
    'pdl_name',
    'pdl_title',
    'pdl_company',
    'pdl_company_size',
    'pdl_location',
    'apollo_ok',
    'apollo_name',
    'apollo_title',
    'apollo_company',
    'apollo_company_size',
    'apollo_location',
    'apollo_industry',
  ];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.email,
        r.knownName,
        r.knownRole,
        r.pdl?.ok ?? '',
        r.pdl?.name ?? '',
        r.pdl?.title ?? r.pdl?.error ?? '',
        r.pdl?.company ?? r.pdlCompany?.name ?? '',
        r.pdlCompany?.size ?? r.pdl?.companySize ?? '',
        r.pdl?.location ?? r.pdlCompany?.location ?? '',
        r.apollo?.ok ?? '',
        r.apollo?.name ?? '',
        r.apollo?.title ?? r.apollo?.error ?? '',
        r.apollo?.company ?? '',
        r.apollo?.companySize ?? '',
        r.apollo?.location ?? r.apollo?.companyLocation ?? '',
        r.apollo?.industry ?? '',
      ]
        .map(csvEscape)
        .join(',')
    );
  }
  fs.writeFileSync(outCsv, lines.join('\n') + '\n');

  const pdlHits = rows.filter((r) => r.pdl?.ok).length;
  const apoHits = rows.filter((r) => r.apollo?.ok).length;
  console.log('\n=== Resumen ===');
  console.log(`PDL person match:    ${pdlHits}/${rows.length}`);
  console.log(`Apollo person match: ${apoHits}/${rows.length}`);
  console.log(`Clay: skip (no Person Enrich API pública 1:1; orquesta otros providers en UI)`);
  console.log(`\nJSON: ${outJson}`);
  console.log(`CSV:  ${outCsv}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
