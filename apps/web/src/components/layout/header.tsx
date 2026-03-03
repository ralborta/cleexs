'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Upload, Bell, Mail, User } from 'lucide-react';
import { Button } from '@/components/ui/button';

const LOGO_SVG = (
  <svg
    width="24"
    height="24"
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
);

/** Rutas del flujo público de diagnóstico: solo marca, sin menú completo */
const PUBLIC_DIAGNOSTIC_PATHS = ['/diagnostico/crear', '/ver-resultado', '/prueba-gratuita'];
const VERIFYING_PATH_PREFIX = '/diagnostico/verificando';

function isPublicDiagnosticPath(pathname: string | null): boolean {
  if (!pathname) return false;
  if (PUBLIC_DIAGNOSTIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '?'))) return true;
  if (pathname.startsWith(VERIFYING_PATH_PREFIX)) return true;
  return false;
}

export function Header() {
  const pathname = usePathname();
  const minimal = isPublicDiagnosticPath(pathname);

  if (minimal) {
    return (
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-3">
          <div className="flex items-center">
            <Link href="/diagnostico/crear" className="flex items-center gap-3 text-foreground no-underline hover:opacity-90">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary-600 to-primary-700 shrink-0">
                {LOGO_SVG}
              </div>
              <span className="text-xl font-semibold">Cleexs</span>
            </Link>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="border-b border-border bg-card">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3 text-foreground no-underline hover:opacity-90">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary-600 to-primary-700">
                {LOGO_SVG}
              </div>
              <h1 className="text-2xl font-semibold text-foreground">Cleexs</h1>
            </Link>
          </div>

          <nav className="flex items-center gap-8">
            <Link
              href="/diagnostico"
              className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
            >
              Diagnóstico
            </Link>
            <Link
              href="/planes"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Planes
            </Link>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Proyectos
            </Link>
            <Link
              href="/runs"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Reportes
            </Link>
            <Link
              href="/settings"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Configuración
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            <button className="p-2 text-muted-foreground hover:text-foreground transition-colors">
              <Upload className="h-5 w-5" />
            </button>
            <button className="p-2 text-muted-foreground hover:text-foreground transition-colors relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-accent-600"></span>
            </button>
            <button className="p-2 text-muted-foreground hover:text-foreground transition-colors relative">
              <Mail className="h-5 w-5" />
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-accent-600"></span>
            </button>
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary-600 to-primary-700 flex items-center justify-center">
              <User className="h-5 w-5 text-white" />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="ml-2 bg-accent-50 text-accent-700 border-accent-100 hover:bg-accent-50"
            >
              Versión inicial
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
