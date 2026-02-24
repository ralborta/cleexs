'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, Sparkles, Zap } from 'lucide-react';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: '/mes',
    description: 'Probá Cleexs sin registrarte',
    features: [
      '1ra corrida por dominio: reporte completo',
      'Cleexs Score en todas las corridas',
      'Link al resultado por correo',
      'Corridas adicionales: vista limitada (Cleexs Score)',
    ],
    cta: 'Empezar gratis',
    href: '/diagnostico',
    popular: false,
  },
  {
    id: 'gold',
    name: 'Gold',
    price: 'Próximamente',
    period: '',
    description: 'Reporte completo siempre',
    features: [
      'Reporte completo en cada corrida',
      'Análisis con IA en el correo',
      'Métricas detalladas por intención',
      'Tabla de comparaciones vs competidores',
      'Fortalezas, debilidades y próximos pasos',
      'Múltiples diagnósticos sin límite',
    ],
    cta: 'Crear cuenta',
    href: '/dashboard',
    popular: true,
  },
];

export default function PlanesPage() {
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
            Empezá gratis con una corrida completa. Para reportes ilimitados y análisis detallado, pasá a Gold.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:gap-10">
          {PLANS.map((plan) => (
            <Card
              key={plan.id}
              className={`relative overflow-hidden transition-all duration-300 hover:shadow-xl ${
                plan.popular
                  ? 'border-2 border-primary-300 shadow-lg ring-2 ring-primary-100'
                  : 'border border-border shadow-md'
              }`}
            >
              {plan.popular && (
                <div className="absolute top-0 right-0">
                  <span className="inline-block bg-primary-600 text-white text-xs font-semibold px-3 py-1 rounded-bl-lg">
                    Recomendado
                  </span>
                </div>
              )}
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2 mt-2">
                  {plan.id === 'gold' ? (
                    <Zap className="h-6 w-6 text-primary-600" />
                  ) : (
                    <Sparkles className="h-6 w-6 text-muted-foreground" />
                  )}
                  <CardTitle className="text-2xl font-bold text-foreground">{plan.name}</CardTitle>
                </div>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
                <CardDescription className="text-base mt-1">{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <ul className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                      <Check className="h-5 w-5 shrink-0 text-primary-600 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link href={plan.href} className="block">
                  <Button
                    className={`w-full ${plan.popular ? 'bg-primary-600 text-white hover:bg-primary-700' : ''}`}
                    variant={plan.popular ? 'default' : 'outline'}
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
          ¿Necesitás medir tu marca? <Link href="/diagnostico" className="text-primary-600 hover:underline font-medium">Diagnóstico gratuito</Link>
        </p>
      </div>
    </main>
  );
}
