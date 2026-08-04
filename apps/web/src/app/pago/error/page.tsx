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
      description={
        <>
          Podés volver a intentar desde la pantalla de suscripción. Si el problema sigue,{' '}
          <Link href="/contacto" className="font-semibold text-violet-700 underline-offset-2 hover:underline">
            contactanos
          </Link>{' '}
          y revisamos el caso.
        </>
      }
      primaryHref="/portal-cliente"
      primaryLabel="Volver al portal"
      secondaryHref="/plan-conquistar"
      secondaryLabel="Reintentar Plan Conquistar"
    />
  );
}
