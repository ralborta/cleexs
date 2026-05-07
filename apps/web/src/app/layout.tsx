import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Header } from '@/components/layout/header';
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
        <Header />
        {children}
      </body>
    </html>
  );
}
