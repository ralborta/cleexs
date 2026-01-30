import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(1100px_circle_at_50%_-200px,hsl(var(--ring))_0%,transparent_55%)]" />
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-purple-600">
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
          <p className="text-muted-foreground">AI Recommendation Index Platform</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="group relative overflow-hidden border-border/60 bg-card/90 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,hsl(var(--primary))_0%,hsl(var(--ring))_55%,transparent_100%)] opacity-[0.08]" />
            <CardHeader>
              <CardTitle className="text-xl">Dashboard</CardTitle>
              <CardDescription>Visualiza rankings, tendencias y análisis de PRIA</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/dashboard">
                <Button className="w-full group shadow-sm">
                  Ir al Dashboard
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden border-border/60 bg-card/90 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,hsl(var(--ring))_0%,hsl(var(--primary))_55%,transparent_100%)] opacity-[0.06]" />
            <CardHeader>
              <CardTitle className="text-xl">Runs</CardTitle>
              <CardDescription>Gestiona tus corridas de análisis y resultados</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/runs">
                <Button className="w-full" variant="secondary" asChild>
                  <span className="group">
                    Ver Runs
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform inline-block" />
                  </span>
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
