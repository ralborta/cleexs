import type { Metadata } from 'next';
import { SponsorLinkBuilder } from '@/components/tools/sponsor-link-builder';

export const metadata: Metadata = {
  title: 'Links de auspiciador · Cleexs',
  description: 'Generá enlaces y códigos QR con tracking ref y UTM para diagnósticos Cleexs.',
  robots: { index: false, follow: false },
};

export default function AuspiciadoresToolsPage() {
  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-slate-50 via-white to-primary-50/30 px-4 py-10 sm:py-14">
      <SponsorLinkBuilder />
    </div>
  );
}
