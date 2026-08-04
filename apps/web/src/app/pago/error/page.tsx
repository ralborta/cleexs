import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { PaymentStatusScreen } from '@/components/pago/payment-status-screen';

export default function PagoErrorPage() {
  return (
    <PaymentStatusScreen
      tone="error"
      badge="No confirmado"
      icon={<AlertCircle className="h-8 w-8" />}
      title="No se pudo confirmar el pago"
      description="Podés volver a intentar desde la pantalla de suscripción. Si el problema sigue, escribinos desde Contacto y revisamos el caso."
      primaryHref="/portal-cliente"
      primaryLabel="Volver al portal"
      secondaryHref="/contacto"
      secondaryLabel="Ir a Contacto"
    >
      <p className="text-sm text-slate-500">
        O{' '}
        <Link href="/plan-conquistar" className="font-semibold text-violet-700 underline-offset-2 hover:underline">
          reintentar Plan Conquistar
        </Link>
      </p>
    </PaymentStatusScreen>
  );
}
