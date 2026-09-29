import QRCode from 'qrcode';

export interface UpiPaymentParams {
  upiId: string;
  merchantName: string;
  amount?: number;
  note?: string;
  transactionRef?: string;
}

/**
 * Generate standard NPCI compliant UPI Intent URI string
 */
export function generateUpiUri({
  upiId,
  merchantName,
  amount,
  note = 'Water Supply Refill & Delivery',
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
    // Fallback QR service url if local canvas fails
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiUri)}`;
  }
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
 * Generate formatted WhatsApp payment reminder message with optional dynamic transaction QR
 */
export function generateWhatsAppReminderText({
  customerName,
  dueAmount,
  jarsHolding,
  businessName,
  businessPhone,
  upiId,
  includeQr = false,
  transactionRef
}: ReminderParams): string {
  const cleanUpi = (upiId || '').trim();

  let upiSection = '';
  if (cleanUpi) {
    if (includeQr && dueAmount > 0) {
      const upiUri = generateUpiUri({
        upiId: cleanUpi,
        merchantName: businessName,
        amount: dueAmount,
        note: `Due Payment - ${customerName}`,
        transactionRef
      });
      const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=2&data=${encodeURIComponent(upiUri)}`;
      upiSection = `\n----------------------------------------
📲 *INSTANT UPI PAYMENT (₹${dueAmount.toLocaleString('en-IN')})*
• UPI ID: \`${cleanUpi}\`
• Direct UPI Pay Link: ${upiUri}
• Scan / View QR Code: ${qrImageUrl}
----------------------------------------`;
    } else {
      upiSection = `\n📲 *UPI ID for Payment:* \`${cleanUpi}\`\n👉 Pay directly via GPay / PhonePe / Paytm / BHIM`;
    }
  }

  const contactSection = businessPhone?.trim()
    ? `\nFor queries or water refills, contact: ${businessPhone.trim()}`
    : '';

  return `*💧 Payment Reminder - ${businessName.trim()}*
========================================
Namaste *${customerName.trim()}*,

Tamara paani na supply nu niche mujab baki balance chhe:

💰 *Baki Rakam:* ₹${dueAmount.toLocaleString('en-IN')}
🚰 *Tamari pase haal ma Jar:* ${jarsHolding} bottle(s)${upiSection}

Krupa kari ne baki rakam jaldi thi jama kari aapsho, jethi tamari rojni paani ni delivery ni seva satat chalu rahi sake.${contactSection}

Tamara sahkar badal aabhar!
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
  
  window.open(url, '_blank', 'noopener,noreferrer');
}
