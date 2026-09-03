import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { headers } from 'next/headers';
import { Header } from '@/components/layout/header';
import { CleexsPublicFooter } from '@/components/layout/cleexs-public-footer';
import { AppStringsProvider } from '@/lib/app-strings';
import { GoogleTagManagerBody, GoogleTagManagerHead } from '@/components/analytics/google-tag-manager';
import { shouldIncludeGoogleTagManagerFromHeaders } from '@/lib/gtm';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

/** Necesario para leer x-cleexs-gtm del middleware y excluir /admin en runtime. */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Cleexs',
  description: 'AI Recommendation Index Platform',
  icons: {
    icon: [{ url: '/favicon.png', type: 'image/png', sizes: 'any' }],
    shortcut: '/favicon.png',
    apple: '/CleexsLogo.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = headers().get('x-pathname') ?? '';
  const includeGtm = shouldIncludeGoogleTagManagerFromHeaders(
    headers().get('x-cleexs-gtm'),
    pathname,
  );

  return (
    <html lang="es">
      <body className={inter.className}>
        {includeGtm ? <GoogleTagManagerHead /> : null}
        {includeGtm ? <GoogleTagManagerBody /> : null}
        <AppStringsProvider initialLocale="es">
          <Header />
          {children}
          <CleexsPublicFooter />
        </AppStringsProvider>
      </body>
    </html>
  );
}
