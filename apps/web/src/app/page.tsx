import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-[calc(100vh-72px)] bg-gradient-to-b from-gray-50 to-white px-6 py-16">
      <div className="mx-auto max-w-5xl">
        <div className="text-center mb-10">
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
            <h1 className="text-5xl font-bold tracking-tight text-gray-900">Cleexs</h1>
          </div>
          <p className="text-xl text-gray-600 mb-2">PRIA Platform</p>
          <p className="text-gray-500">AI Recommendation Index Platform</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl">Dashboard</CardTitle>
              <CardDescription>
                Visualiza rankings, tendencias y análisis de PRIA
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Link href="/dashboard">
                <Button className="w-full group">
                  Ir al Dashboard
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl">Runs</CardTitle>
              <CardDescription>
                Gestiona tus corridas de análisis y resultados
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Link href="/runs">
                <Button className="w-full" variant="outline" asChild>
                  <span className="group inline-flex items-center justify-center">
                    Ver Runs
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
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
