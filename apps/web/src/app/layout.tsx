import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Header } from '@/components/layout/header';
import { CleexsPublicFooter } from '@/components/layout/cleexs-public-footer';
import { AppStringsProvider } from '@/lib/app-strings';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

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
  return (
    <html lang="es">
      <body className={inter.className}>
        <AppStringsProvider initialLocale="es">
          <Header />
          {children}
          <CleexsPublicFooter />
        </AppStringsProvider>
      </body>
    </html>
  );
}
