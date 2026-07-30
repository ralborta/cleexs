'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PLAN_CONQUISTAR_UNLOCK_LINKS } from '@cleexs/shared';
import { PlanConquistarCheckoutButton } from '@/components/planes/plan-conquistar-checkout-button';

function PlanConquistarPageCheckoutInner({
  className,
  variant = 'default',
}: {
  className?: string;
  variant?: 'default' | 'sidebar' | 'compact' | 'promo' | 'overlay';
}) {
  const searchParams = useSearchParams();
  const diagnosticId = searchParams.get('diagnosticId');

  return (
    <PlanConquistarCheckoutButton
      className={className}
      variant={variant}
      sourceChannel="plan_conquistar_landing"
      unlockKey={PLAN_CONQUISTAR_UNLOCK_LINKS[3].key}
      diagnosticId={diagnosticId}
    />
  );
}

export function PlanConquistarPageCheckout(props: {
  className?: string;
  variant?: 'default' | 'sidebar' | 'compact' | 'promo' | 'overlay';
}) {
  return (
    <Suspense fallback={<PlanConquistarCheckoutButton className={props.className} variant={props.variant} />}>
      <PlanConquistarPageCheckoutInner {...props} />
    </Suspense>
  );
}
