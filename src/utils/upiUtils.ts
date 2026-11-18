import QRCode from 'qrcode';

export interface UpiPaymentParams {
  upiId: string;
  merchantName: string;
  amount?: number;
  note?: string;
  transactionRef?: string;
}

/**
 * Resolve effective UPI ID for a business:
 * 1. Explicit business.upiId if configured
 * 2. Fallback to 10-digit ownerPhone@upi if ownerPhone is present
 */
export function resolveBusinessUpiId(
  business?: { upiId?: string; ownerPhone?: string } | null
): string {
  if (!business) return '';
  if (business.upiId && business.upiId.trim().length > 0) {
    return business.upiId.trim();
  }
  const rawPhone = (business.ownerPhone || '').replace(/\D/g, '');
  if (rawPhone.length >= 10) {
    const tenDigits = rawPhone.slice(-10);
    return `${tenDigits}@upi`;
  }
  return '';
}

/**
 * Generate standard NPCI compliant UPI Intent URI string
 */
export function generateUpiUri({
  upiId,
  merchantName,
  amount,
  note = 'Water Supply Payment',
  transactionRef
}: UpiPaymentParams): string {
  const cleanUpi = (upiId || '').trim();
  if (!cleanUpi) return '';

  const cleanName = encodeURIComponent((merchantName || 'Water Distribution').trim());
  const cleanNote = encodeURIComponent((note || 'Water Supply').trim());

  let uri = `upi://pay?pa=${cleanUpi}&pn=${cleanName}&tn=${cleanNote}&cu=INR`;

  if (amount !== undefined && amount > 0) {
    uri += `&am=${amount.toFixed(2)}`;
  }
  if (transactionRef) {
    uri += `&tr=${encodeURIComponent(transactionRef)}`;
  }

  return uri;
}

/**
 * Generate public scannable QR image URL for WhatsApp messages
 */
export function getPublicQrImageUrl(upiUri: string, size = 320): string {
  if (!upiUri) return '';
  return `https://quickchart.io/qr?size=${size}&margin=2&ecLevel=M&text=${encodeURIComponent(upiUri)}`;
}

/**
 * Render high-resolution offline UPI QR Data URL
 */
export async function generateUpiQrDataUrl(
  upiUri: string,
  options: { width?: number; margin?: number; darkColor?: string } = {}
): Promise<string> {
  if (!upiUri) return '';
  try {
    return await QRCode.toDataURL(upiUri, {
      width: options.width || 300,
      margin: options.margin || 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: options.darkColor || '#0f172a',
        light: '#ffffff'
      }
    });
  } catch (err) {
    console.error('Failed to generate UPI QR code:', err);
    return getPublicQrImageUrl(upiUri, options.width || 300);
  }
}

/**
 * Render a complete commercial UPI Payment QR Card as a PNG Blob
 * for attaching or pasting directly into WhatsApp chats.
 */
export async function generateUpiQrCardBlob(params: {
  upiUri: string;
  upiId: string;
  merchantName: string;
  customerName?: string;
  amount?: number;
  dateStr?: string;
}): Promise<Blob | null> {
  const { upiUri, upiId, merchantName, customerName, amount, dateStr } = params;
  if (!upiUri) return null;

  try {
    const qrCanvas = document.createElement('canvas');
    await QRCode.toCanvas(qrCanvas, upiUri, {
      width: 280,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    });

    const cardWidth = 440;
    const cardHeight = 540;
    const canvas = document.createElement('canvas');
    canvas.width = cardWidth;
    canvas.height = cardHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // White card background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cardWidth, cardHeight);

    // Top dark header bar
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, cardWidth, 84);

    // Merchant Name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText((merchantName || 'WATER SUPPLY').toUpperCase().slice(0, 32), cardWidth / 2, 38);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 12px Inter, system-ui, sans-serif';
    ctx.fillText('OFFICIAL UPI PAYMENT QR', cardWidth / 2, 62);

    // Border around QR
    const qrSize = 260;
    const qrX = (cardWidth - qrSize) / 2;
    const qrY = 108;

    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.strokeRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20);

    ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

    // Amount & UPI details
    let textY = qrY + qrSize + 40;
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 22px Inter, system-ui, sans-serif';
    if (amount !== undefined && amount > 0) {
      ctx.fillText(`Payable Amount: Rs. ${amount.toLocaleString('en-IN')}`, cardWidth / 2, textY);
    } else {
      ctx.fillText('Scan & Pay via Any UPI App', cardWidth / 2, textY);
    }

    textY += 28;
    ctx.fillStyle = '#334155';
    ctx.font = '600 14px monospace';
    ctx.fillText(`UPI ID: ${upiId}`, cardWidth / 2, textY);

    if (customerName) {
      textY += 26;
      ctx.fillStyle = '#475569';
      ctx.font = '500 13px Inter, system-ui, sans-serif';
      ctx.fillText(
        `Customer: ${customerName.slice(0, 30)}${dateStr ? `  •  ${dateStr}` : ''}`,
        cardWidth / 2,
        textY
      );
    }

    // Outer frame border
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, cardWidth - 4, cardHeight - 4);

    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/png', 1.0);
    });
  } catch (err) {
    console.warn('Failed to generate QR card blob:', err);
    return null;
  }
}

/**
 * Convert numeric INR value to formal Indian Accounting Words
 * e.g., 1450 -> "Rupees One Thousand Four Hundred Fifty Only"
 */
export function numberToIndianWords(num: number): string {
  const n = Math.round(Math.abs(Number(num) || 0));
  if (n === 0) return 'Rupees Zero Only';

  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const tens = [
    '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
  ];

  const twoDigits = (val: number): string => {
    if (val < 20) return ones[val];
    const t = Math.floor(val / 10);
    const o = val % 10;
    return `${tens[t]}${o ? ' ' + ones[o] : ''}`;
  };

  const parts: string[] = [];
  let rem = n;

  const crore = Math.floor(rem / 10000000);
  if (crore > 0) {
    parts.push(`${twoDigits(crore)} Crore`);
    rem %= 10000000;
  }

  const lakh = Math.floor(rem / 100000);
  if (lakh > 0) {
    parts.push(`${twoDigits(lakh)} Lakh`);
    rem %= 100000;
  }

  const thousand = Math.floor(rem / 1000);
  if (thousand > 0) {
    parts.push(`${twoDigits(thousand)} Thousand`);
    rem %= 1000;
  }

  const hundred = Math.floor(rem / 100);
  if (hundred > 0) {
    parts.push(`${ones[hundred]} Hundred`);
    rem %= 100;
  }

  if (rem > 0) {
    parts.push(twoDigits(rem));
  }

  return `Rupees ${parts.join(' ')} Only`;
}

export interface ReminderParams {
  customerName: string;
  customerPhone: string;
  dueAmount: number;
  jarsHolding: number;
  businessName: string;
  businessPhone?: string;
  upiId?: string;
  includeQr?: boolean;
  transactionRef?: string;
}

/**
 * Generate formatted WhatsApp payment reminder message with dynamic transaction QR
 */
export function generateWhatsAppReminderText({
  customerName,
  dueAmount,
  jarsHolding,
  businessName,
  businessPhone,
  upiId,
  includeQr = true,
  transactionRef
}: ReminderParams): string {
  const cleanUpi = (upiId || '').trim();

  let upiSection = '';
  if (cleanUpi) {
    const upiUri = generateUpiUri({
      upiId: cleanUpi,
      merchantName: businessName,
      amount: dueAmount > 0 ? dueAmount : undefined,
      note: `Water Supply Payment - ${customerName}`,
      transactionRef
    });
    const qrImageUrl = getPublicQrImageUrl(upiUri, 320);

    if (includeQr) {
      upiSection = `\n----------------------------------------
*PAYMENT INFORMATION & QR*
• UPI ID: ${cleanUpi}${dueAmount > 0 ? `\n• Amount Payable: ₹${dueAmount.toLocaleString('en-IN')}` : ''}
• Pay via UPI App: ${upiUri}
• Scan QR Code: ${qrImageUrl}
----------------------------------------`;
    } else {
      upiSection = `\n----------------------------------------
*PAYMENT INFORMATION*
• UPI ID: ${cleanUpi}
• Pay via UPI App: ${upiUri}
----------------------------------------`;
    }
  }

  const contactSection = businessPhone?.trim()
    ? `\nContact: ${businessPhone.trim()}`
    : '';

  return `*${businessName.trim().toUpperCase()}*
*PAYMENT REMINDER & ACCOUNT SUMMARY*
========================================
Dear *${customerName.trim()}*,

Please find your current water supply account summary below:

• *Outstanding Balance:* ₹${dueAmount.toLocaleString('en-IN')}
• *Containers Held with You:* ${jarsHolding} Jar(s)${upiSection}

Kindly clear the pending balance at your earliest convenience.${contactSection}

Thank you,
*${businessName.trim()}*`;
}

/**
 * Open WhatsApp conversation with pre-filled encoded text
 */
export function openWhatsAppChat(phone: string, text: string) {
  let cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length === 10) {
    cleanPhone = '91' + cleanPhone;
  }
  const encoded = encodeURIComponent(text);
  const url = cleanPhone.length >= 10
    ? `https://wa.me/${cleanPhone}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;

  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
