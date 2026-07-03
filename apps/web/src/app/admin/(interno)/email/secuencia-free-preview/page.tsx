import { redirect } from 'next/navigation';

export default function FreeSequencePreviewRedirectPage() {
  redirect('/admin/email/templates?tab=secuencia-free');
}
