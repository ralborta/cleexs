'use client';

import Link from 'next/link';
import { ArrowRight, BarChart3, Mail, Rocket, Trophy } from 'lucide-react';

const REPORTS = [
  {
    href: '/admin/reportes/adquisicion',
    title: 'Adquisicion y funnel',
    description:
      'Quien entra al sistema, por que canal, cuantos completan el diagnostico y dejan email. Top referidores y UTMs.',
    metrics: ['Diagnosticos por dia', 'Conversion completion', 'Top ref= y UTM source', 'Detalle ultimos 25'],
    icon: BarChart3,
    tone: 'bg-sky-100 text-sky-700',
  },
  {
    href: '/admin/reportes/cleexs-score',
    title: 'Cleexs Score y posicionamiento',
    description:
      'Como performean las marcas analizadas. Distribucion del score, top y bottom, comparativa por industria.',
    metrics: ['Score promedio global', 'Top 10 / Bottom 10', 'Score por industria', 'Evolucion semanal'],
    icon: Trophy,
    tone: 'bg-amber-100 text-amber-700',
  },
  {
    href: '/admin/reportes/email-outreach',
    title: 'Email y outreach',
    description:
      'Performance de los dos canales: weekly emails internos y cold outreach a competidores. Open, click y bounce rate.',
    metrics: ['Enviados / abiertos / clicks', 'Eventos Resend', 'Top dominios outreach', 'Estado del webhook'],
    icon: Mail,
    tone: 'bg-violet-100 text-violet-700',
  },
  {
    href: '/admin/reportes/plan-conquistar',
    title: 'Plan Conquistar (AI Visibility Accelerator)',
    description:
      'Genera el entregable de 90 dias para un cliente. Elegi una corrida o pega un runId/URL para probar el reporte completo.',
    metrics: ['Score real por motor', 'Top oportunidades priorizadas', 'Roadmap 90 dias', 'Competitor gap analysis'],
    icon: Rocket,
    tone: 'bg-emerald-100 text-emerald-700',
  },
] as const;

export default function AdminReportesPage() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {REPORTS.map(({ href, title, description, metrics, icon: Icon, tone }) => (
        <Link
          key={href}
          href={href}
          className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md"
        >
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${tone}`}>
            <Icon className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-slate-900">{title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
          <ul className="mt-4 space-y-1 text-xs text-slate-500">
            {metrics.map((m) => (
              <li key={m} className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-violet-500" />
                {m}
              </li>
            ))}
          </ul>
          <div className="mt-5 flex items-center gap-2 text-sm font-medium text-violet-700 transition group-hover:text-violet-900">
            Abrir reporte
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
          </div>
        </Link>
      ))}
    </div>
  );
}
