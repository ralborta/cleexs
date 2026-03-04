'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Upload, Bell, Mail, User } from 'lucide-react';
import { Button } from '@/components/ui/button';

const LOGO_SRC = '/CleexsLogo.png';

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
        <div className="container mx-auto px-6 py-0.5">
          <div className="flex items-center justify-start">
            <Link href="/diagnostico/crear" className="flex items-center text-foreground no-underline hover:opacity-90" aria-label="Cleexs">
              <div className="relative h-12 w-12 shrink-0 sm:h-14 sm:w-14">
                <Image src={LOGO_SRC} alt="Cleexs" fill className="object-contain" priority />
              </div>
            </Link>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="border-b border-border bg-card">
      <div className="container mx-auto px-6 py-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Link href="/" className="flex items-center text-foreground no-underline hover:opacity-90" aria-label="Cleexs">
              <div className="relative h-12 w-12 shrink-0 sm:h-14 sm:w-14">
                <Image src={LOGO_SRC} alt="Cleexs" fill className="object-contain" priority />
              </div>
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
