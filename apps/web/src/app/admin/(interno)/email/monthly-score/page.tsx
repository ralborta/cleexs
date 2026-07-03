import { redirect } from 'next/navigation';

export default function MonthlyScoreEmailRedirectPage() {
  redirect('/admin/email/templates?tab=diseno&variant=editorial');
}
