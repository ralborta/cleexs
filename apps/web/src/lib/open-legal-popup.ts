const LEGAL_POPUP_NAME = 'cleexs-legal';

export function openLegalPopup(path: string): void {
  const width = 720;
  const height = 640;
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));
  const features = [
    `width=${width}`,
    `height=${height}`,
    `left=${left}`,
    `top=${top}`,
    'scrollbars=yes',
    'resizable=yes',
  ].join(',');

  const popup = window.open(path, LEGAL_POPUP_NAME, features);
  if (popup) {
    popup.opener = null;
    return;
  }

  // Si el navegador bloquea popups, pestaña nueva: el onboarding sigue abierto.
  const tab = window.open(path, '_blank', 'noopener,noreferrer');
  if (tab) tab.opener = null;
}
