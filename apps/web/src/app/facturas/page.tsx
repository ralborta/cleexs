'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';

export default function FacturasPage() {
  return (
    <main className="min-h-[calc(100vh-72px)] bg-gradient-to-br from-background via-white to-primary-50/50 px-6 py-16">
      <div className="mx-auto max-w-2xl">
        <Card className="border-transparent bg-white shadow-md">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-50">
                <FileText className="h-6 w-6 text-primary-600" />
              </div>
              <div>
                <CardTitle className="text-xl text-foreground">Facturas</CardTitle>
                <CardDescription>Historial de facturación y comprobantes</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Esta sección mostrará tus facturas cuando tengas un plan activo. Por ahora no hay facturas disponibles.
            </p>
            <Link href="/planes">
              <Button variant="outline" className="border-border text-foreground hover:bg-primary-50">
                Ver planes
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
