'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, Sparkles } from 'lucide-react';
import { APP_PLANS, getAnnualPrice, type BillingMode } from '@/lib/plans';

export default function PlanesPage() {
  const [billingMode, setBillingMode] = useState<BillingMode>('monthly');
  const plansToRender = useMemo(() => APP_PLANS, []);

  const renderPrice = (monthlyPrice: number | null) => {
    if (monthlyPrice == null) return 'Contáctanos';
    const value = billingMode === 'annual' ? getAnnualPrice(monthlyPrice) : monthlyPrice;
    return `$${value}`;
  };

  return (
    <main className="min-h-[calc(100vh-72px)] bg-gradient-to-br from-background via-white to-primary-50/50 px-6 py-16">
      <div className="mx-auto max-w-5xl">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary-100 bg-white px-4 py-2 text-sm text-primary-700 shadow-sm mb-4">
            <Sparkles className="h-4 w-4" />
            Planes
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground mb-3">
            Elegí cómo medir tu marca
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Una estructura simple para empezar, escalar y operar con equipos más grandes.
          </p>
        </div>

        <div className="mb-8 flex justify-center">
          <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setBillingMode('monthly')}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                billingMode === 'monthly'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Mensual
            </button>
            <button
              type="button"
              onClick={() => setBillingMode('annual')}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                billingMode === 'annual'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Anual (20% off)
            </button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {plansToRender.map((plan) => (
            <Card
              key={plan.id}
              className={`relative overflow-hidden transition-all duration-300 hover:shadow-xl ${
                plan.highlighted
                  ? 'border-2 border-primary-300 shadow-lg ring-2 ring-primary-100 bg-white'
                  : 'border border-border shadow-md'
              }`}
            >
              {plan.badge && (
                <div className="absolute right-3 top-3">
                  <span className="inline-block rounded-full bg-primary-100 px-2.5 py-1 text-xs font-semibold text-primary-700">
                    {plan.badge}
                  </span>
                </div>
              )}
              <CardHeader className="pb-3">
                <div className="mt-2">
                  <CardTitle className="text-3xl font-bold text-foreground">{plan.name}</CardTitle>
                </div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-foreground">{renderPrice(plan.monthlyPrice)}</span>
                  <span className="text-muted-foreground">{plan.monthlyPrice == null ? '' : plan.periodLabel}</span>
                </div>
                <CardDescription className="mt-2 text-sm">{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{plan.enginesTitle}</p>
                  <div className="flex flex-wrap gap-2">
                    {plan.engines.map((engine) => (
                      <span key={engine} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700">
                        {engine}
                      </span>
                    ))}
                  </div>
                </div>

                <ul className="space-y-2.5">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link href={`/planes/pago?plan=${plan.id}&billing=${billingMode}`} className="block">
                  <Button
                    className={`w-full ${plan.highlighted ? 'bg-primary-600 text-white hover:bg-primary-700' : ''}`}
                    variant={plan.highlighted ? 'default' : 'outline'}
                    size="lg"
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-10">
          ¿Necesitás medir tu marca?{' '}
          <Link href="/diagnostico/crear" className="font-medium text-primary-600 hover:underline">
            Diagnóstico gratuito
          </Link>
        </p>
      </div>
    </main>
  );
}
