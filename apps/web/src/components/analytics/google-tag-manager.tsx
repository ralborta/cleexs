import Script from 'next/script';
import { GTM_CONTAINER_ID } from '@/lib/gtm';

/** Snippet GTM — GA4 va configurado dentro del contenedor, sin gtag.js directo. */
const GTM_SCRIPT = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_CONTAINER_ID}');`;

/** Inyectado lo más arriba posible en head (beforeInteractive). */
export function GoogleTagManagerHead() {
  return (
    <Script id="gtm-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: GTM_SCRIPT }} />
  );
}

/** Noscript — inmediatamente después de abrir body. */
export function GoogleTagManagerBody() {
  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${GTM_CONTAINER_ID}`}
        height="0"
        width="0"
        style={{ display: 'none', visibility: 'hidden' }}
        title="Google Tag Manager"
      />
    </noscript>
  );
}
