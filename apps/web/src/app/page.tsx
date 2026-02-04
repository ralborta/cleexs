import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, Sparkles, ShieldCheck, TrendingUp } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-[calc(100vh-72px)] bg-gradient-to-br from-background via-white to-primary-50 px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary-100 bg-white px-4 py-2 text-sm text-primary-700 shadow-sm">
            <Sparkles className="h-4 w-4" />
            Nuevo PRIA Platform
          </div>
          <div className="flex items-center justify-center gap-3 mt-6 mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600 to-primary-700 shadow-lg">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 2L2 7L12 12L22 7L12 2Z"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M2 17L12 22L22 17"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M2 12L12 17L22 12"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h1 className="text-5xl font-bold tracking-tight text-foreground">Cleexs</h1>
          </div>
          <p className="text-xl text-muted-foreground mb-2">PRIA Platform</p>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Medí qué tan recomendado aparece tu producto en ChatGPT, con evidencia auditable y
            comparaciones consistentes.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-transparent bg-white shadow-md transition-all hover:-translate-y-1 hover:shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl flex items-center gap-2 text-foreground">
                <TrendingUp className="h-5 w-5 text-primary-600" />
                Dashboard
              </CardTitle>
              <CardDescription>
                Visualizá rankings, tendencias y análisis de PRIA con estilo ejecutivo.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Link href="/dashboard">
                <Button className="w-full group bg-primary-600 text-white hover:bg-primary-700">
                  Ver Dashboard
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                <div className="rounded-lg border border-border bg-primary-50 px-3 py-2">
                  Ranking vs competidores
                </div>
                <div className="rounded-lg border border-border bg-primary-50 px-3 py-2">
                  Tendencia mensual
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-transparent bg-white shadow-md transition-all hover:-translate-y-1 hover:shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl flex items-center gap-2 text-foreground">
                <ShieldCheck className="h-5 w-5 text-primary-600" />
                Runs
              </CardTitle>
              <CardDescription>
                Gestioná corridas, evidencia y overrides con trazabilidad completa.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Link href="/runs">
                <Button className="w-full border-primary-200 text-primary-700 hover:bg-primary-50" variant="outline" asChild>
                  <span className="group inline-flex items-center justify-center">
                    Ver Runs
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </Button>
              </Link>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                <div className="rounded-lg border border-border bg-primary-50 px-3 py-2">
                  Evidencia completa
                </div>
                <div className="rounded-lg border border-border bg-primary-50 px-3 py-2">
                  Overrides manuales
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
