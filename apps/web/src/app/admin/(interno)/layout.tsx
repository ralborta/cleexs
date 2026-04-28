import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { COOKIE_NAME, verifyAdminSessionToken } from '@/lib/admin-session';

export default function AdminInternoLayout({ children }: { children: React.ReactNode }) {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!verifyAdminSessionToken(token)) {
    redirect('/admin/login');
  }
  return <>{children}</>;
}
