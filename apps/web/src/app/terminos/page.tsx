import { permanentRedirect } from 'next/navigation';

/** Compatibilidad con enlaces antiguos: el contenido vive en `/legal/cleexs`. */
export default function TerminosLegacyRedirect() {
  permanentRedirect('/legal/cleexs');
}
