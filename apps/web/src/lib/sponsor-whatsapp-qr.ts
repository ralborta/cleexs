import QRCode from 'qrcode';

const CLEEXS_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><defs><linearGradient id="g" x1="3" y1="3" x2="21" y2="21"><stop stop-color="#2563EB"/><stop offset="1" stop-color="#1D4ED8"/></linearGradient></defs><rect x="1.5" y="1.5" width="21" height="21" rx="5" fill="url(#g)"/><path d="M12 5L5 8.5L12 12L19 8.5L12 5Z" stroke="white" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 12.5L12 16L19 12.5" stroke="white" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 16L12 19.5L19 16" stroke="white" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * QR estilo Cleexs: borde azul redondeado + logo centrado (ECC alto para logo).
 */
export async function renderBrandedWhatsAppQrDataUrl(waMeUrl: string): Promise<string> {
  const size = 360;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas no disponible');

  const radius = 20;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, radius);
  ctx.fill();

  ctx.strokeStyle = '#2563EB';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(3, 3, size - 6, size - 6, radius - 2);
  ctx.stroke();

  const qrSize = 280;
  const qrOffset = (size - qrSize) / 2;
  const qrCanvas = document.createElement('canvas');
  await QRCode.toCanvas(qrCanvas, waMeUrl, {
    width: qrSize,
    margin: 1,
    errorCorrectionLevel: 'H',
    color: { dark: '#0f172a', light: '#ffffff' },
  });
  ctx.drawImage(qrCanvas, qrOffset, qrOffset, qrSize, qrSize);

  const logoSize = 64;
  const logoPad = 8;
  const box = logoSize + logoPad * 2;
  const boxX = (size - box) / 2;
  const boxY = (size - box) / 2;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, box, box, 12);
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.stroke();

  const logoImg = await loadImage(`data:image/svg+xml,${encodeURIComponent(CLEEXS_LOGO_SVG)}`);
  ctx.drawImage(logoImg, boxX + logoPad, boxY + logoPad, logoSize, logoSize);

  ctx.fillStyle = '#1e3a8a';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Cleexs', size / 2, boxY + box + 2);

  return canvas.toDataURL('image/png');
}
