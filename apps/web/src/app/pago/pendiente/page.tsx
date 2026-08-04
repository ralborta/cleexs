import { Clock3 } from 'lucide-react';
import { PaymentStatusScreen } from '@/components/pago/payment-status-screen';

export default function PagoPendientePage() {
  return (
    <PaymentStatusScreen
      tone="pending"
      badge="Mercado Pago"
      icon={<Clock3 className="h-8 w-8" />}
      title="Pago pendiente"
      description="La suscripción quedó pendiente de confirmación. Te avisamos cuando Mercado Pago confirme el cobro y se active tu acceso."
      primaryHref="/portal-cliente"
      primaryLabel="Volver al portal"
      secondaryHref="/contacto"
      secondaryLabel="¿Necesitás ayuda? Contactanos"
    />
  );
}
