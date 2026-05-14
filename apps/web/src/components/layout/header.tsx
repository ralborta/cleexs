'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Upload, Bell, Mail, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CleexsMark } from '@/components/brand/cleexs-mark';

/** Rutas con header mínimo: solo logo, sin menú completo */
const MINIMAL_HEADER_PATHS = ['/diagnostico/crear', '/ver-resultado', '/prueba-gratuita', '/planes'];
const VERIFYING_PATH_PREFIX = '/diagnostico/verificando';

function isPublicDiagnosticPath(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname.startsWith('/planes')) return true;
  if (pathname.startsWith('/score')) return true;
  if (MINIMAL_HEADER_PATHS.some((p) => pathname === p || pathname.startsWith(p + '?'))) return true;
  if (pathname.startsWith(VERIFYING_PATH_PREFIX)) return true;
  return false;
}

/** Portales usuario final: mismo header mínimo que diagnóstico (solo logo), sin menú interno Cleexs */
function isStandalonePortalPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname.startsWith('/portal-crecimiento') || pathname.startsWith('/portal-cliente');
}

/** Páginas legales públicas: el cliente no debe ver el menú interno (Diagnóstico, Planes, etc.). */
function isPublicLegalPath(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname.startsWith('/legal/')) return true;
  if (pathname === '/terminos' || pathname === '/privacidad') return true;
  return false;
}

function isAdminPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname.startsWith('/admin');
}

/** Logo lleva al inicio coherente con la zona (portales ≠ app interna). */
function logoHrefForPath(pathname: string | null): string {
  if (!pathname) return '/';
  if (pathname.startsWith('/portal-cliente')) return '/portal-cliente';
  if (pathname.startsWith('/portal-crecimiento')) return '/portal-crecimiento';
  return '/';
}

export function Header() {
  const pathname = usePathname();
  if (isAdminPath(pathname)) return null;
  const minimal =
    isPublicDiagnosticPath(pathname) || isStandalonePortalPath(pathname) || isPublicLegalPath(pathname);
  const logoHref = logoHrefForPath(pathname);

  if (minimal) {
    return (
      <header className="flex h-14 shrink-0 items-center border-b border-border bg-card">
        <div className="container mx-auto flex h-full items-center px-6">
          <Link
            href={logoHref}
            className="flex items-center text-foreground no-underline hover:opacity-90"
            aria-label="Cleexs"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center sm:h-12 sm:w-12">
              <CleexsMark className="h-9 w-9 sm:h-10 sm:w-10" />
            </div>
          </Link>
        </div>
      </header>
    );
  }

  return (
    <header className="flex h-14 shrink-0 items-center border-b border-border bg-card">
      <div className="container mx-auto flex h-full items-center justify-between px-6">
        <div className="flex items-center">
          <Link href="/" className="flex items-center text-foreground no-underline hover:opacity-90" aria-label="Cleexs">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center sm:h-12 sm:w-12">
              <CleexsMark className="h-9 w-9 sm:h-10 sm:w-10" />
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
              href="/outreach"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Outreach
            </Link>
            <Link
              href="/settings"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Configuración
            </Link>
            <Link
              href="/facturas"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Facturas
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
    </header>
  );
}
