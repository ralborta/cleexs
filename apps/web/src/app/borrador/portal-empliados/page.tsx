import { redirect } from 'next/navigation';

/** Redirect legacy borrador URL → /ecomm/portal-empliados */
export default function LegacyBorradorPortalEmpliadosRedirect() {
  redirect('/ecomm/portal-empliados');
}
