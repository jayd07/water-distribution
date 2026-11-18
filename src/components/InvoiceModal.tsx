import React, { useState, useEffect } from 'react';
import { Printer, Share2, X, Droplets, Calendar, MapPin, Phone, User, Edit2, Building2, QrCode, Boxes, Check } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DeliveryLog, Customer, OrderBooking, BusinessAccount, InventoryItem } from '../types';
import { getActiveBusiness, updateBusiness } from '../services/businessService';
import { getCustomerSkuHoldings, formatSkuHoldingsForWhatsApp, SkuHoldingItem } from '../utils/skuHoldingUtils';
import { generateUpiUri } from '../utils/upiUtils';

export interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  delivery?: DeliveryLog | null;
  order?: OrderBooking | null;
  customer?: Customer | null;
  business?: BusinessAccount | null;
  onUpdateBusiness?: (business: BusinessAccount) => void;
  inventory?: InventoryItem[];
  deliveries?: DeliveryLog[];
  customers?: Customer[];
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  isOpen,
  onClose,
  delivery,
  order,
  customer,
  business,
  onUpdateBusiness,
  inventory = [],
  deliveries = [],
  customers = []
}) => {
  const fallbackBiz = getActiveBusiness();
  const currentBiz = business || fallbackBiz;

  // Local state for quick edit if user wants to change business name/address directly on invoice
  const [isEditingBusiness, setIsEditingBusiness] = useState(false);
  const [bizNameInput, setBizNameInput] = useState(currentBiz?.name || '');
  const [bizAddressInput, setBizAddressInput] = useState(currentBiz?.address || '');
  const [bizCityInput, setBizCityInput] = useState(currentBiz?.city || '');
  const [bizPhoneInput, setBizPhoneInput] = useState(currentBiz?.ownerPhone || '');
  const [bizGstinInput, setBizGstinInput] = useState(currentBiz?.gstin || '');
  const [isSavingBiz, setIsSavingBiz] = useState(false);
  
  // Option to include transactional due amount QR in WhatsApp text
  const [includeDueQrInWhatsApp, setIncludeDueQrInWhatsApp] = useState<boolean>(true);
  // Print paper format: standard A4 or 80mm/58mm Thermal POS receipt
  const [printFormat, setPrintFormat] = useState<'A4' | 'POS'>('A4');
  const [isPrinting, setIsPrinting] = useState(false);
  const [printDone, setPrintDone] = useState(false);
  const [copiedBillText, setCopiedBillText] = useState(false);

  useEffect(() => {
    if (isOpen && currentBiz) {
      setBizNameInput(currentBiz.name || '');
      setBizAddressInput(currentBiz.address || '');
      setBizCityInput(currentBiz.city || '');
      setBizPhoneInput(currentBiz.ownerPhone || '');
      setBizGstinInput(currentBiz.gstin || '');
      setIsEditingBusiness(false);
    }
  }, [isOpen, currentBiz]);

  // Ensure all hooks are declared unconditionally above before this early return
  if (!isOpen || (!delivery && !order && !customer)) return null;

  const displayedBizName = currentBiz?.name?.trim() || 'Water Supply Management';
  const displayedBizAddress = currentBiz?.address?.trim()
    ? `${currentBiz.address}${currentBiz.city?.trim() ? `, ${currentBiz.city.trim()}` : ''}`
    : (currentBiz?.city?.trim() || '');
  const displayedBizPhone = currentBiz?.ownerPhone?.trim() || '';
  const displayedBizGstin = currentBiz?.gstin?.trim() || '';
  const displayedBizCategory = currentBiz?.category?.trim() || '';

  const handleSaveBusinessInfo = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSavingBiz(true);
    try {
      const bizId = currentBiz?.id || fallbackBiz?.id || 'AquaPure_Springs';
      const updated = await updateBusiness(bizId, {
        name: bizNameInput.trim() || displayedBizName,
        address: bizAddressInput.trim(),
        city: bizCityInput.trim(),
        ownerPhone: bizPhoneInput.trim(),
        gstin: bizGstinInput.trim()
      });
      if (updated) {
        onUpdateBusiness?.(updated);
      }
      setIsEditingBusiness(false);
    } catch (err) {
      console.error('Failed to update business on invoice:', err);
    } finally {
      setIsSavingBiz(false);
    }
  };

  const isOrder = !!order;
  const isCustomerAccount = !delivery && !order && !!customer;
  const invoiceNumber = isOrder 
    ? `INV-ORD-${order.id.replace('ord_', '').toUpperCase()}` 
    : isCustomerAccount
    ? `BILL-CUST-${customer!.id.replace('cust_', '').toUpperCase()}`
    : `INV-DEL-${delivery!.id.replace('del_', '').toUpperCase()}`;
  
  // Resolve customer info
  const targetCustomer = customer || (delivery?.customerId && customers.length > 0 ? customers.find(c => c.id === delivery.customerId) : null);
  const customerName = isOrder ? order.customerName : (delivery?.customerName || targetCustomer?.name || 'Customer');
  const customerPhone = isOrder ? order.customerMobile : (delivery?.customerPhone || targetCustomer?.phone || 'N/A');
  const customerAddress = isOrder ? (order.customerAddress || 'Direct Pickup / Event Venue') : (delivery?.customerAddress || targetCustomer?.address || 'On-file Route Address');
  const timestamp = isOrder ? order.bookingDate : (delivery ? delivery.timestamp : (targetCustomer?.createdAt || Date.now()));
  const dateFormatted = new Date(timestamp).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Calculate SKU-wise held jars
  const skuHoldings: SkuHoldingItem[] = getCustomerSkuHoldings(targetCustomer, deliveries, inventory);
  const totalHoldingCount = skuHoldings.reduce((sum, h) => sum + h.count, 0) || (targetCustomer?.jarsHolding || 0);

  // Compute accurate delivery item rate & gross total even when paymentMode is CREDIT (Due)
  const deliveryUnitRate = delivery
    ? (Number(delivery.unitPrice) || ((delivery.amountCollected && delivery.jarsDelivered) ? Math.round(delivery.amountCollected / delivery.jarsDelivered) : (targetCustomer?.customJarRate || 35)))
    : 35;
  const deliveryGrossAmount = delivery
    ? (delivery.jarsDelivered > 0 ? delivery.jarsDelivered * deliveryUnitRate : (Number(delivery.amountCollected) || 0))
    : 0;
  const deliveryPaidAmount = delivery ? (Number(delivery.amountCollected) || 0) : 0;
  const deliveryBalanceDue = delivery
    ? (delivery.paymentMode === 'CREDIT' ? Math.max(0, deliveryGrossAmount - deliveryPaidAmount) : 0)
    : 0;

  const isPosMode = printFormat === 'POS';

  const generatePrintableInvoicePdf = (format: 'A4' | 'POS') => {
    const isPos = format === 'POS';
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: isPos ? [80, 210] : 'a4'
    });

    if (typeof (doc as any).autoPrint === 'function') {
      (doc as any).autoPrint();
    }

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = isPos ? 4 : 14;
    const contentWidth = pageWidth - margin * 2;
    let y = isPos ? 7 : 15;

    // 1. Header Section
    if (!isPos) {
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, 4, 'F');
    }

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isPos ? 11 : 16);
    doc.text(displayedBizName, isPos ? pageWidth / 2 : margin, y, {
      align: isPos ? 'center' : 'left'
    });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(isPos ? 7.5 : 8.5);
    doc.setTextColor(71, 85, 105);

    if (displayedBizAddress) {
      y += isPos ? 4 : 5;
      doc.text(displayedBizAddress, isPos ? pageWidth / 2 : margin, y, {
        align: isPos ? 'center' : 'left',
        maxWidth: contentWidth
      });
    }

    const contactLine = [
      displayedBizPhone ? `Tel: ${displayedBizPhone}` : '',
      displayedBizGstin ? `GST: ${displayedBizGstin}` : ''
    ].filter(Boolean).join(' | ');

    if (contactLine) {
      y += isPos ? 4 : 4.5;
      doc.text(contactLine, isPos ? pageWidth / 2 : margin, y, {
        align: isPos ? 'center' : 'left'
      });
    }

    const docTitle = isOrder
      ? 'ORDER INVOICE'
      : isCustomerAccount
      ? 'ACCOUNT STATEMENT'
      : 'DELIVERY RECEIPT';

    if (isPos) {
      y += 3.5;
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.3);
      doc.line(margin, y, pageWidth - margin, y);
      y += 4;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`${docTitle} • ${invoiceNumber}`, pageWidth / 2, y, { align: 'center' });
      y += 3.8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(`Date: ${dateFormatted}`, pageWidth / 2, y, { align: 'center' });
      y += 3.5;
      doc.line(margin, y, pageWidth - margin, y);
      y += 4;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`Customer: ${customerName}`, margin, y, { maxWidth: contentWidth });
      y += 3.8;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(`Phone: ${customerPhone}`, margin, y);
      y += 3.8;
      doc.text(`Address: ${customerAddress.substring(0, 42)}`, margin, y, { maxWidth: contentWidth });
      y += 3.8;
      if (delivery) {
        doc.text(`Staff: ${delivery.workerName || 'Staff'}  |  Mode: ${delivery.paymentMode}`, margin, y);
        y += 4;
      } else {
        y += 1.5;
      }
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(2, 132, 199);
      doc.text(docTitle, pageWidth - margin, 15, { align: 'right' });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(invoiceNumber, pageWidth - margin, 20, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(dateFormatted, pageWidth - margin, 24.5, { align: 'right' });

      y = Math.max(y + 6, 30);
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, y, pageWidth - margin, y);
      y += 5;

      // Customer & Delivery Details Box
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, y, contentWidth, 22, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text('CUSTOMER DETAILS', margin + 4, y + 5);
      doc.text(isCustomerAccount ? 'ACCOUNT DETAILS' : 'DELIVERY DETAILS', pageWidth / 2 + 4, y + 5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(customerName, margin + 4, y + 10);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.text(`Phone: ${customerPhone}`, margin + 4, y + 14.5);
      doc.text(`Address: ${customerAddress.substring(0, 48)}`, margin + 4, y + 19);

      if (isOrder) {
        doc.text(`Status: ${order.status} | Payment: ${order.paymentStatus}`, pageWidth / 2 + 4, y + 10);
        if (order.deliveryDate) doc.text(`Delivery Date: ${order.deliveryDate}`, pageWidth / 2 + 4, y + 14.5);
        if (order.assignedDriver) doc.text(`Staff: ${order.assignedDriver}`, pageWidth / 2 + 4, y + 19);
      } else if (isCustomerAccount) {
        doc.text(`Status: ${(targetCustomer?.dueAmount || 0) > 0 ? 'Payment Due' : 'All Settled'}`, pageWidth / 2 + 4, y + 10);
        doc.text(`Deposit Paid: Rs. ${(targetCustomer?.depositPaid || 0).toLocaleString('en-IN')}`, pageWidth / 2 + 4, y + 14.5);
        doc.text(`Containers Held: ${totalHoldingCount} jars`, pageWidth / 2 + 4, y + 19);
      } else {
        doc.text(`Staff: ${delivery!.workerName || 'Staff'}`, pageWidth / 2 + 4, y + 10);
        doc.text(`Payment Mode: ${delivery!.paymentMode}`, pageWidth / 2 + 4, y + 14.5);
        doc.text(`Containers Held: ${totalHoldingCount} jars`, pageWidth / 2 + 4, y + 19);
      }

      y += 27;
    }

    // 2. Itemized Table (Strictly Line Items)
    const bodyRows: any[][] = [];
    const summaryRows: Array<{ label: string; value: string; isBold?: boolean }> = [];

    if (isOrder) {
      const itemSubtotal = order.quantity * order.rentOrPricePerUnit;
      bodyRows.push([
        order.itemType,
        String(order.quantity),
        `Rs. ${order.rentOrPricePerUnit}`,
        `Rs. ${itemSubtotal.toLocaleString('en-IN')}`
      ]);
      if (order.depositAmount > 0) {
        bodyRows.push([
          'Security Deposit (Refundable)',
          '-',
          '-',
          `Rs. ${order.depositAmount.toLocaleString('en-IN')}`
        ]);
      }
      summaryRows.push({ label: 'Booking Subtotal', value: `Rs. ${itemSubtotal.toLocaleString('en-IN')}` });
      summaryRows.push({ label: 'Security Deposit', value: `Rs. ${order.depositAmount.toLocaleString('en-IN')}` });
      summaryRows.push({ label: 'Payment Status', value: order.paymentStatus });
      summaryRows.push({ label: 'TOTAL AMOUNT', value: `Rs. ${order.totalAmount.toLocaleString('en-IN')}`, isBold: true });
    } else if (isCustomerAccount) {
      if (skuHoldings.length > 0) {
        skuHoldings.forEach((sku) => {
          bodyRows.push([
            sku.displayName || sku.itemType,
            String(sku.count),
            `Rs. ${sku.unitPrice}`,
            `${sku.count} ${sku.count === 1 ? 'jar' : 'jars'}`
          ]);
        });
      } else {
        bodyRows.push(['Packaged Water Jars Held', '0', '-', '0 jars']);
      }
      summaryRows.push({ label: 'Total Jars Held', value: `${totalHoldingCount} jars` });
      summaryRows.push({ label: 'Deposit Paid', value: `Rs. ${(targetCustomer?.depositPaid || 0).toLocaleString('en-IN')}` });
      summaryRows.push({ label: 'TOTAL DUE BALANCE', value: `Rs. ${(targetCustomer?.dueAmount || 0).toLocaleString('en-IN')}`, isBold: true });
    } else {
      if (delivery!.jarsDelivered > 0) {
        bodyRows.push([
          delivery!.itemType || '20L Normal Jar',
          String(delivery!.jarsDelivered),
          `Rs. ${deliveryUnitRate}`,
          `Rs. ${deliveryGrossAmount.toLocaleString('en-IN')}`
        ]);
      }
      if (delivery!.emptyJarsCollected > 0) {
        bodyRows.push([
          `Empty Jars Returned (${delivery!.itemType || '20L Normal Jar'})`,
          String(delivery!.emptyJarsCollected),
          '-',
          'Rs. 0'
        ]);
      }
      if (delivery!.jarsDelivered === 0 && deliveryPaidAmount > 0) {
        bodyRows.push([
          'Pending Due Settlement Collected',
          '-',
          '-',
          `Rs. ${deliveryPaidAmount.toLocaleString('en-IN')}`
        ]);
      }
      summaryRows.push({ label: 'Itemized Total', value: `Rs. ${deliveryGrossAmount.toLocaleString('en-IN')}` });
      summaryRows.push({ label: 'Payment Mode', value: delivery!.paymentMode });
      summaryRows.push({ label: 'Containers Held', value: `${totalHoldingCount} jars` });
      if (deliveryBalanceDue > 0) {
        summaryRows.push({ label: 'Added to Due (Credit)', value: `Rs. ${deliveryBalanceDue.toLocaleString('en-IN')}` });
      }
      summaryRows.push({ label: 'AMOUNT PAID', value: `Rs. ${deliveryPaidAmount.toLocaleString('en-IN')}`, isBold: true });
    }

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      tableWidth: contentWidth,
      head: [[
        { content: isPos ? 'Item' : 'Item Description', styles: { halign: 'left' } },
        { content: 'Qty', styles: { halign: 'center' } },
        { content: 'Rate', styles: { halign: 'right' } },
        { content: 'Amount', styles: { halign: 'right' } }
      ]],
      body: bodyRows,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: isPos ? 7.5 : 8.5,
        cellPadding: isPos ? 1.6 : 2.8,
        valign: 'middle',
        textColor: [15, 23, 42],
        lineColor: [203, 213, 225],
        lineWidth: 0.2
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      columnStyles: isPos
        ? {
            0: { cellWidth: 31, halign: 'left' },
            1: { cellWidth: 10, halign: 'center', fontStyle: 'bold' },
            2: { cellWidth: 14, halign: 'right' },
            3: { cellWidth: 17, halign: 'right', fontStyle: 'bold' }
          }
        : {
            0: { cellWidth: 92, halign: 'left' },
            1: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
            2: { cellWidth: 31, halign: 'right' },
            3: { cellWidth: 35, halign: 'right', fontStyle: 'bold' }
          }
    });

    // 3. Cleanly Separated Total Summary Section Below Itemized Table
    let summaryY = ((doc as any).lastAutoTable?.finalY || y + 25) + (isPos ? 4 : 7);

    if (isPos) {
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.35);
      doc.line(margin, summaryY, pageWidth - margin, summaryY);
      summaryY += 4;

      summaryRows.forEach((row) => {
        if (row.isBold) {
          doc.setDrawColor(15, 23, 42);
          doc.setLineWidth(0.3);
          doc.line(margin, summaryY - 2.5, pageWidth - margin, summaryY - 2.5);
          summaryY += 1.5;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(0, 0, 0);
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(51, 65, 85);
        }
        doc.text(row.label, margin, summaryY);
        doc.text(row.value, pageWidth - margin, summaryY, { align: 'right' });
        summaryY += row.isBold ? 4.5 : 4;
      });

      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.4);
      doc.line(margin, summaryY - 2, pageWidth - margin, summaryY - 2);
      summaryY += 3;
    } else {
      // A4 separated summary layout: Left Payment Box + Right Total Summary Box
      const boxWidth = 86;
      const rightBoxX = pageWidth - margin - boxWidth;
      const boxHeight = summaryRows.length * 6 + 8;

      // Left Payment Info Box
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, summaryY, contentWidth - boxWidth - 6, boxHeight, 2, 2, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text('PAYMENT INFORMATION', margin + 4, summaryY + 6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(upiId ? `UPI ID: ${upiId}` : 'Accepted Modes: Cash / UPI', margin + 4, summaryY + 12);
      if (displayedBizPhone) {
        doc.text(`Contact: +91 ${displayedBizPhone}`, margin + 4, summaryY + 17);
      }

      // Right Total Summary Box
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(148, 163, 184);
      doc.roundedRect(rightBoxX, summaryY, boxWidth, boxHeight, 2, 2, 'FD');

      let rowY = summaryY + 6;
      summaryRows.forEach((row) => {
        if (row.isBold) {
          doc.setDrawColor(15, 23, 42);
          doc.setLineWidth(0.4);
          doc.line(rightBoxX + 3, rowY - 3.5, rightBoxX + boxWidth - 3, rowY - 3.5);
          rowY += 1.5;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9.5);
          doc.setTextColor(15, 23, 42);
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(51, 65, 85);
        }
        doc.text(row.label, rightBoxX + 4, rowY);
        doc.text(row.value, rightBoxX + boxWidth - 4, rowY, { align: 'right' });
        rowY += 6;
      });

      summaryY += boxHeight + 8;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(isPos ? 7 : 8);
    doc.setTextColor(100, 116, 139);
    if (isPos && upiId) {
      doc.text(`UPI ID: ${upiId}`, pageWidth / 2, summaryY, { align: 'center' });
      summaryY += 4;
    }
    doc.text('Thank you for your business!', pageWidth / 2, summaryY, { align: 'center' });

    const cleanFileName = `${invoiceNumber}_${format}.pdf`;
    doc.save(cleanFileName);
  };

  const handlePrint = () => {
    setIsPrinting(true);
    let nativePrintTriggered = false;
    const onBeforePrint = () => {
      nativePrintTriggered = true;
    };
    window.addEventListener('beforeprint', onBeforePrint, { once: true });

    try {
      window.print();
    } catch (e) {
      console.warn('window.print error:', e);
    }

    setTimeout(() => {
      window.removeEventListener('beforeprint', onBeforePrint);
      if (!nativePrintTriggered) {
        // Fallback when running inside a sandboxed preview iframe where window.print() is ignored
        generatePrintableInvoicePdf(printFormat);
      }
      setIsPrinting(false);
      setPrintDone(true);
      setTimeout(() => setPrintDone(false), 2500);
    }, 250);
  };

  const payableAmount = isOrder 
    ? (order.paymentStatus !== 'PAID' ? order.totalAmount : 0)
    : isCustomerAccount
    ? (targetCustomer?.dueAmount || 0)
    : (delivery ? (delivery.paymentMode === 'CREDIT' ? deliveryBalanceDue : deliveryPaidAmount) : 0);

  // STRICT: Only use genuine configured UPI ID. NO defaults, NO synthetic phone@upi.
  const upiId = (currentBiz?.upiId || '').trim();

  // Dynamic transaction URI and live QR code only when a genuine UPI ID is configured
  const upiUrl = (upiId && payableAmount > 0)
    ? generateUpiUri({
        upiId,
        merchantName: displayedBizName,
        amount: payableAmount,
        note: `${invoiceNumber} - ${customerName}`,
        transactionRef: invoiceNumber
      })
    : (upiId ? generateUpiUri({ upiId, merchantName: displayedBizName, note: invoiceNumber }) : '');

  const qrCodeUrl = upiUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=2&data=${encodeURIComponent(upiUrl)}` : '';

  const generateBillText = () => {
    const headerPrefix = `*${displayedBizName}*
${displayedBizAddress ? `📍 ${displayedBizAddress}\n` : ''}${displayedBizPhone ? `📞 Tel: ${displayedBizPhone}\n` : ''}========================================\n`;

    // Dynamic Due Amount QR and UPI section only when genuinely configured
    let upiFooter = '';
    if (upiId && payableAmount > 0) {
      if (includeDueQrInWhatsApp) {
        upiFooter = `
----------------------------------------
📲 *INSTANT UPI PAYMENT (₹${payableAmount.toLocaleString('en-IN')})*
• UPI ID: \`${upiId}\`
• Direct UPI Pay Link: ${upiUrl}
• Scan / View Due QR Code: ${qrCodeUrl}
----------------------------------------\n`;
      } else {
        upiFooter = `
----------------------------------------
📲 *UPI ID for Payment:* \`${upiId}\`
👉 Pay via any UPI App (PhonePe / Paytm / BHIM)
----------------------------------------\n`;
      }
    }

    if (isOrder) {
      return `${headerPrefix}*Invoice & Order Receipt*
----------------------------------------
*Invoice No:* ${invoiceNumber}
*Date:* ${dateFormatted}
*Customer:* ${customerName}
*Phone:* ${customerPhone}
*Address:* ${customerAddress}
----------------------------------------
*Item:* ${order.itemType}
*Quantity Booked:* ${order.quantity} units
*Rate/Unit:* ₹${order.rentOrPricePerUnit}
*Deposit Paid:* ₹${order.depositAmount}
*Grand Total:* ₹${order.totalAmount}
*Payment Status:* ${order.paymentStatus}
*Order Status:* ${order.status}
${order.deliveryDate ? `*Delivery Date:* ${order.deliveryDate}\n` : ''}${order.notes ? `*Notes:* ${order.notes}\n` : ''}----------------------------------------${upiFooter}
Thank you for your business!`;
    } else if (isCustomerAccount) {
      const skuBreakdownText = formatSkuHoldingsForWhatsApp(skuHoldings);
      return `${headerPrefix}*💧 Customer Account Bill & Ledger*
----------------------------------------
*Bill No:* ${invoiceNumber}
*Date:* ${dateFormatted}
*Customer:* ${customerName}
*Phone:* ${customerPhone}
*Address:* ${customerAddress}
----------------------------------------
${skuBreakdownText}*Pending Due Balance:* ₹${(targetCustomer?.dueAmount || 0).toLocaleString('en-IN')}
*Security Deposit Paid:* ₹${(targetCustomer?.depositPaid || 0).toLocaleString('en-IN')}
*Status:* ${(targetCustomer?.dueAmount || 0) > 0 ? 'PAYMENT PENDING' : 'ALL DUES SETTLED'}
----------------------------------------
${(targetCustomer?.dueAmount || 0) > 0 ? `Please clear the pending balance of ₹${(targetCustomer?.dueAmount || 0).toLocaleString('en-IN')} via UPI or Cash.\n` : ''}${upiFooter}
Thank you for your business!`;
    } else {
      const isReturnOnly = delivery!.jarsDelivered === 0 && delivery!.emptyJarsCollected > 0;
      const skuBreakdownText = skuHoldings.length > 0 ? formatSkuHoldingsForWhatsApp(skuHoldings) : '';
      return `${headerPrefix}*${isReturnOnly ? 'Jar Return Receipt' : 'Delivery Invoice & Receipt'}*
----------------------------------------
*Receipt No:* ${invoiceNumber}
*Date:* ${dateFormatted}
*Customer:* ${customerName}
*Phone:* ${customerPhone}
*Staff:* ${delivery!.workerName || 'Delivery Staff'}
----------------------------------------
${isReturnOnly ? `*Transaction:* Empty Jar Return
*Empty Jars Returned:* ${delivery!.emptyJarsCollected}
*Amount Collected:* ₹${deliveryPaidAmount}` : `*Item:* ${delivery!.itemType || '20L Normal Jar'}
*Jars Delivered:* ${delivery!.jarsDelivered}
*Empty Collected:* ${delivery!.emptyJarsCollected}
*Bill Amount:* ₹${deliveryGrossAmount}
*Amount Paid:* ₹${deliveryPaidAmount}`}
*Payment Mode:* ${delivery!.paymentMode}
${skuBreakdownText ? `----------------------------------------\n${skuBreakdownText}` : ''}----------------------------------------${upiFooter}
Thank you for choosing our service!`;
    }
  };

  const handleSendBill = () => {
    const billText = generateBillText();
    let cleanPhone = customerPhone.replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }

    const encodedText = encodeURIComponent(billText);
    const whatsappUrl = cleanPhone.length >= 10 
      ? `https://wa.me/${cleanPhone}?text=${encodedText}`
      : `https://wa.me/?text=${encodedText}`;

    const link = document.createElement('a');
    link.href = whatsappUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleNativeShare = async () => {
    const text = generateBillText();
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Invoice ${invoiceNumber}`,
          text: text
        });
        return;
      } catch (e) {
        console.log('Share dismissed or not supported', e);
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopiedBillText(true);
      setTimeout(() => setCopiedBillText(false), 2000);
    } catch (err) {
      console.warn('Clipboard copy failed:', err);
    }
  };

  return (
    <div className="invoice-print-backdrop fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-900/70 backdrop-blur-xs">
      <div className="invoice-print-card relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[85dvh] sm:max-h-[90vh] flex flex-col">
        
        {/* Header - Interactive & Actionable (Hidden in Print) */}
        <div className="no-print flex items-center justify-between px-4 py-3 sm:px-5 sm:py-4 bg-slate-900 text-white border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Droplets className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm sm:text-base leading-tight">Tax Invoice & Receipt</h3>
              <p className="text-[11px] sm:text-xs text-slate-400">{invoiceNumber}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="inline-flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-[11px]">
              <button
                type="button"
                onClick={() => setPrintFormat('A4')}
                className={`px-2 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                  printFormat === 'A4' ? 'bg-cyan-600 text-white' : 'text-slate-300 hover:text-white'
                }`}
                title="Standard A4 Paper Layout"
              >
                A4
              </button>
              <button
                type="button"
                onClick={() => setPrintFormat('POS')}
                className={`px-2 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                  printFormat === 'POS' ? 'bg-cyan-600 text-white' : 'text-slate-300 hover:text-white'
                }`}
                title="Thermal POS Receipt Roll (58mm / 80mm)"
              >
                POS 80mm
              </button>
            </div>
            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting}
              id="print-invoice-btn"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-60"
              title="Print Receipt"
            >
              {printDone ? <Check className="w-3.5 h-3.5" /> : <Printer className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">
                {isPrinting ? 'Printing...' : printDone ? 'Ready!' : 'Print'}
              </span>
            </button>
            <button
              onClick={handleSendBill}
              id="send-bill-whatsapp-btn"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg shadow-xs transition-colors cursor-pointer"
              title="Send bill to customer on WhatsApp"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Send Bill</span>
            </button>
            <button
              onClick={onClose}
              id="close-invoice-modal-btn"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Invoice Paper Area */}
        <div
          className={`overflow-y-auto overscroll-contain modal-scroll-body flex-1 min-h-0 print-only-container bg-white text-slate-900 ${
            isPosMode
              ? 'print-pos-thermal max-w-[310px] w-full mx-auto p-3.5 my-3 border border-dashed border-slate-300 shadow-xs space-y-3 font-mono text-[11px]'
              : 'p-4 sm:p-8 space-y-5 sm:space-y-6'
          }`}
        >
          
          {/* Company Brand Header */}
          <div
            className={`invoice-header-block flex justify-between pb-4 border-b gap-3 ${
              isPosMode
                ? 'flex-col items-center text-center border-dashed border-slate-400 pb-3'
                : 'flex-col sm:flex-row items-start border-slate-200 pb-5'
            }`}
          >
            <div className={`flex items-start gap-3.5 flex-1 min-w-0 ${isPosMode ? 'flex-col items-center text-center gap-1.5' : ''}`}>
              {!isPosMode && (
                <div className="invoice-brand-icon w-12 h-12 rounded-xl bg-cyan-600 text-white flex items-center justify-center shadow-md shrink-0 mt-0.5">
                  <Droplets className="w-7 h-7" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className={`flex items-center gap-2 flex-wrap ${isPosMode ? 'justify-center' : ''}`}>
                  <h1 className={`${isPosMode ? 'text-base' : 'text-xl sm:text-2xl'} font-bold text-slate-900 tracking-tight`}>
                    {displayedBizName}
                  </h1>
                  <button
                    type="button"
                    onClick={() => setIsEditingBusiness(!isEditingBusiness)}
                    className="no-print text-[11px] text-cyan-700 hover:text-cyan-800 bg-cyan-50 hover:bg-cyan-100 font-medium px-2 py-0.5 rounded-md inline-flex items-center gap-1 transition-colors cursor-pointer font-sans"
                    title="Click to edit business name and address"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>{isEditingBusiness ? 'Close' : 'Edit Info'}</span>
                  </button>
                </div>

                {isEditingBusiness ? (
                  <form onSubmit={handleSaveBusinessInfo} className="no-print mt-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5 max-w-lg text-left font-sans">
                    <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-cyan-600" />
                      Edit Business & Invoice Header Details
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-0.5">Business Name</label>
                        <input
                          type="text"
                          value={bizNameInput}
                          onChange={(e) => setBizNameInput(e.target.value)}
                          placeholder="e.g. Your Business Name"
                          className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-0.5">Contact Phone</label>
                        <input
                          type="text"
                          value={bizPhoneInput}
                          onChange={(e) => setBizPhoneInput(e.target.value)}
                          placeholder="e.g. 9876543210"
                          className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-0.5">Business Address</label>
                      <input
                        type="text"
                        value={bizAddressInput}
                        onChange={(e) => setBizAddressInput(e.target.value)}
                        placeholder="Enter business address"
                        className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-0.5">City / Location</label>
                        <input
                          type="text"
                          value={bizCityInput}
                          onChange={(e) => setBizCityInput(e.target.value)}
                          placeholder="Enter city"
                          className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-0.5">GSTIN / Tax ID (Optional)</label>
                        <input
                          type="text"
                          value={bizGstinInput}
                          onChange={(e) => setBizGstinInput(e.target.value)}
                          placeholder="e.g. 27AAAAA0000A1Z5"
                          className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-cyan-500 uppercase"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsEditingBusiness(false)}
                        className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingBiz}
                        className="px-3 py-1 text-xs bg-cyan-600 hover:bg-cyan-700 text-white font-medium rounded-md shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {isSavingBiz ? 'Saving...' : 'Save & Update'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    {displayedBizAddress && (
                      <p className={`text-xs text-slate-600 flex items-start gap-1.5 mt-1 font-medium ${isPosMode ? 'justify-center text-[11px]' : ''}`}>
                        {!isPosMode && <MapPin className="w-3.5 h-3.5 text-cyan-600 shrink-0 mt-0.5" />}
                        <span>{displayedBizAddress}</span>
                      </p>
                    )}
                    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1 ${isPosMode ? 'justify-center text-[10px]' : ''}`}>
                      {displayedBizPhone && (
                        <span className="flex items-center gap-1 font-medium text-slate-700">
                          {!isPosMode && <Phone className="w-3 h-3 text-slate-400" />}
                          <span>Tel: {displayedBizPhone}</span>
                        </span>
                      )}
                      {displayedBizGstin && (
                        <span className="font-mono text-[11px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                          GST: {displayedBizGstin}
                        </span>
                      )}
                      {displayedBizCategory && (
                        <span className="text-slate-400 text-[11px]">
                          {displayedBizCategory}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className={`${isPosMode ? 'w-full text-center border-t border-dashed border-slate-300 pt-2' : 'text-left sm:text-right shrink-0'}`}>
              <span className="inline-block px-2.5 py-0.5 bg-slate-100 text-slate-800 text-[10px] font-bold rounded border border-slate-200 mb-1">
                {isOrder ? 'ORDER INVOICE' : isCustomerAccount ? 'ACCOUNT STATEMENT' : 'DELIVERY RECEIPT'}
              </span>
              <p className={`${isPosMode ? 'text-xs' : 'text-sm'} font-bold text-slate-900`}>{invoiceNumber}</p>
              <p className={`text-[11px] text-slate-500 flex items-center gap-1 ${isPosMode ? 'justify-center' : 'sm:justify-end'} mt-0.5`}>
                {!isPosMode && <Calendar className="w-3 h-3" />}
                <span>{dateFormatted}</span>
              </p>
            </div>
          </div>

          {/* Customer & Bill-To Info */}
          <div
            className={`invoice-meta-grid grid gap-3 text-xs ${
              isPosMode
                ? 'grid-cols-1 py-1 border-b border-dashed border-slate-400 pb-3'
                : 'grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80'
            }`}
          >
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Customer Details</span>
              <p className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                {!isPosMode && <User className="w-3.5 h-3.5 text-cyan-600" />}
                <span>{customerName}</span>
              </p>
              <p className="text-slate-600 flex items-center gap-1.5 mt-0.5">
                {!isPosMode && <Phone className="w-3.5 h-3.5 text-slate-400" />}
                <span>Ph: {customerPhone}</span>
              </p>
              <p className="text-slate-600 flex items-start gap-1.5 mt-0.5">
                {!isPosMode && <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />}
                <span>{customerAddress}</span>
              </p>
            </div>

            <div className={`${isPosMode ? 'border-t border-dotted border-slate-300 pt-2' : 'sm:border-l sm:border-slate-200 sm:pl-4'} space-y-1`}>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                {isCustomerAccount ? 'Account Details' : 'Delivery Details'}
              </span>
              {isOrder ? (
                <>
                  <p className="text-slate-700"><strong className="text-slate-900">Booking Status:</strong> <span className="capitalize">{order.status}</span></p>
                  <p className="text-slate-700"><strong className="text-slate-900">Payment Status:</strong> {order.paymentStatus}</p>
                  {order.deliveryDate && <p className="text-slate-700"><strong className="text-slate-900">Scheduled Delivery:</strong> {order.deliveryDate}</p>}
                  {order.assignedDriver && <p className="text-slate-700"><strong className="text-slate-900">Assigned Staff:</strong> {order.assignedDriver}</p>}
                </>
              ) : isCustomerAccount ? (
                <>
                  <p className="text-slate-700"><strong className="text-slate-900">Account Type:</strong> Route Customer</p>
                  <p className="text-slate-700"><strong className="text-slate-900">Status:</strong> {(targetCustomer?.dueAmount || 0) > 0 ? 'Payment Due' : 'All Settled'}</p>
                  <p className="text-slate-700"><strong className="text-slate-900">Statement Date:</strong> {dateFormatted}</p>
                  <p className="text-slate-700"><strong className="text-slate-900">Containers Held:</strong> {totalHoldingCount} jars</p>
                </>
              ) : (
                <>
                  <p className="text-slate-700"><strong className="text-slate-900">Staff:</strong> {delivery!.workerName}</p>
                  <p className="text-slate-700"><strong className="text-slate-900">Payment Mode:</strong> {delivery!.paymentMode}</p>
                  <p className="text-slate-700"><strong className="text-slate-900">Dispatched:</strong> {dateFormatted}</p>
                  <p className="text-slate-700"><strong className="text-slate-900">Containers Held:</strong> {totalHoldingCount} jars</p>
                </>
              )}
            </div>
          </div>

          {/* Itemized Table (Strictly Line Items, Separated from Total Summary) */}
          <div className={`invoice-table-wrapper overflow-x-auto ${isPosMode ? 'border-y border-dashed border-slate-900 rounded-none' : 'rounded-xl border border-slate-200'}`}>
            <table className="invoice-table w-full text-left text-xs border-collapse">
              <thead>
                <tr className={`${isPosMode ? 'border-b border-dashed border-slate-900 bg-transparent' : 'bg-slate-900 text-white border-b border-slate-900'} font-bold`}>
                  <th className="py-2 px-2.5">{isPosMode ? 'Item' : 'Item Description'}</th>
                  <th className="py-2 px-2 text-center">Qty</th>
                  <th className="py-2 px-2 text-right">Rate</th>
                  <th className="py-2 px-2.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-700">
                {isOrder ? (
                  <>
                    <tr>
                      <td className="py-2.5 px-2.5 font-medium text-slate-900">
                        {order.itemType}
                        {!isPosMode && <span className="block text-[11px] text-slate-500 font-normal">Event / bulk booking</span>}
                      </td>
                      <td className="py-2.5 px-2 text-center font-bold text-slate-900">{order.quantity}</td>
                      <td className="py-2.5 px-2 text-right">₹{order.rentOrPricePerUnit}</td>
                      <td className="py-2.5 px-2.5 text-right font-semibold text-slate-900">₹{(order.quantity * order.rentOrPricePerUnit).toLocaleString('en-IN')}</td>
                    </tr>
                    {order.depositAmount > 0 && (
                      <tr className="bg-amber-50/40">
                        <td className="py-2.5 px-2.5 font-medium text-slate-800">
                          Security Deposit (Refundable)
                        </td>
                        <td className="py-2.5 px-2 text-center">-</td>
                        <td className="py-2.5 px-2 text-right">-</td>
                        <td className="py-2.5 px-2.5 text-right font-semibold text-amber-900">₹{order.depositAmount.toLocaleString('en-IN')}</td>
                      </tr>
                    )}
                  </>
                ) : isCustomerAccount ? (
                  <>
                    {skuHoldings.length > 0 ? (
                      skuHoldings.map((sku) => (
                        <tr key={sku.itemType} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-2.5 font-medium text-slate-800">
                            <span className="font-semibold text-slate-900">{sku.displayName || sku.itemType}</span>
                            {!isPosMode && (
                              <span className="block text-[11px] text-slate-500 font-normal">
                                Jars held • Refill Rate: ₹{sku.unitPrice}/jar
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-center font-extrabold text-slate-900">
                            {sku.count}
                          </td>
                          <td className="py-2.5 px-2 text-right font-medium text-slate-600">
                            ₹{sku.unitPrice}
                          </td>
                          <td className="py-2.5 px-2.5 text-right font-semibold text-slate-900">
                            {sku.count} {sku.count === 1 ? 'jar' : 'jars'}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="py-2.5 px-2.5 font-medium text-slate-800">
                          Packaged Water Jars Held
                        </td>
                        <td className="py-2.5 px-2 text-center font-semibold">0</td>
                        <td className="py-2.5 px-2 text-right">-</td>
                        <td className="py-2.5 px-2.5 text-right font-medium text-slate-500">0 jars</td>
                      </tr>
                    )}
                  </>
                ) : (
                  <>
                    {delivery!.jarsDelivered > 0 && (
                      <tr>
                        <td className="py-2.5 px-2.5 font-medium text-slate-800">
                          <span className="font-semibold text-slate-900">{delivery!.itemType || '20L Normal Jar'}</span>
                          {!isPosMode && <span className="block text-[11px] text-slate-500 font-normal">Refill containers delivered</span>}
                        </td>
                        <td className="py-2.5 px-2 text-center font-extrabold text-slate-900">{delivery!.jarsDelivered}</td>
                        <td className="py-2.5 px-2 text-right">
                          ₹{deliveryUnitRate}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-bold text-slate-900">₹{deliveryGrossAmount.toLocaleString('en-IN')}</td>
                      </tr>
                    )}
                    {delivery!.emptyJarsCollected > 0 && (
                      <tr className="bg-emerald-50/30">
                        <td className="py-2.5 px-2.5 font-medium text-slate-700">
                          Empty Jars Returned ({delivery!.itemType || '20L Normal Jar'})
                        </td>
                        <td className="py-2.5 px-2 text-center font-bold text-emerald-700">{delivery!.emptyJarsCollected}</td>
                        <td className="py-2.5 px-2 text-right text-slate-400">-</td>
                        <td className="py-2.5 px-2.5 text-right font-medium text-slate-500">₹0</td>
                      </tr>
                    )}
                    {delivery!.jarsDelivered === 0 && deliveryPaidAmount > 0 && (
                      <tr>
                        <td className="py-2.5 px-2.5 font-medium text-slate-800">
                          Pending Due Settlement Collected
                        </td>
                        <td className="py-2.5 px-2 text-center font-semibold">-</td>
                        <td className="py-2.5 px-2 text-right">-</td>
                        <td className="py-2.5 px-2.5 text-right font-medium text-emerald-700">₹{deliveryPaidAmount.toLocaleString('en-IN')}</td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>

          {/* Dedicated Structural Separator Between Itemized Table and Total Summary */}
          <div className="invoice-section-divider border-t-2 border-dashed border-slate-300 my-1" />

          {/* Separated Total Summary & UPI QR Payment Section */}
          <div className={`invoice-summary-section grid gap-4 ${isPosMode ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
            {/* UPI QR Payment Block for Customer */}
            {upiId && qrCodeUrl ? (
              <div className={`p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3.5 ${isPosMode ? 'flex-col text-center p-2.5 rounded-none border-dashed border-slate-400 bg-transparent' : ''}`}>
                <div className="bg-white p-1 rounded-lg border border-slate-200 shadow-2xs shrink-0">
                  <img 
                    src={qrCodeUrl} 
                    alt="UPI QR Code" 
                    className={`${isPosMode ? 'w-24 h-24' : 'w-24 h-24 sm:w-28 sm:h-28'} object-contain rounded`}
                    loading="lazy"
                  />
                </div>
                <div className="space-y-1 min-w-0">
                  <div className={`flex items-center gap-1.5 text-xs font-bold text-slate-900 ${isPosMode ? 'justify-center' : ''}`}>
                    <QrCode className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>Scan to Pay via UPI</span>
                  </div>
                  <div className="pt-0.5">
                    <span className="text-[10px] text-slate-400 block font-mono">UPI ID:</span>
                    <span className="text-xs font-semibold text-indigo-900 font-mono select-all bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 block truncate">
                      {upiId}
                    </span>
                  </div>
                  {payableAmount > 0 && (
                    <span className="text-[11px] font-bold text-slate-900 block pt-0.5">
                      Amount: <span className="text-emerald-700 font-extrabold">₹{payableAmount.toLocaleString('en-IN')}</span>
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className={`p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-center space-y-1 text-xs ${isPosMode ? 'p-2 rounded-none border-dashed border-slate-300 bg-transparent' : ''}`}>
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  {!isPosMode && <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                  <span>Payment Modes</span>
                </div>
                <p className="text-slate-600">
                  Cash / UPI
                </p>
                {displayedBizPhone && (
                  <p className="text-[11px] font-medium text-slate-500">
                    Contact: +91 {displayedBizPhone}
                  </p>
                )}
              </div>
            )}

            {/* Total Summary Box (Cleanly Separated from Itemized Table) */}
            <div className={`invoice-totals-box w-full bg-slate-50 rounded-xl p-4 border border-slate-300 space-y-2 text-xs flex flex-col justify-between ${isPosMode ? 'p-2.5 rounded-none border-x-0 border-y-2 border-slate-900 bg-transparent' : ''}`}>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-1">
                Total Summary
              </div>
              {isOrder ? (
                <>
                  <div className="flex justify-between text-slate-600">
                    <span>Itemized Subtotal ({order.quantity} units):</span>
                    <span className="font-medium text-slate-900">₹{(order.quantity * order.rentOrPricePerUnit).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Security Deposit:</span>
                    <span className="font-medium text-slate-900">₹{order.depositAmount.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-[11px] font-medium text-slate-600">
                    <span>Payment Status:</span>
                    <span className="font-bold text-slate-900">{order.paymentStatus}</span>
                  </div>
                  <div className="invoice-total-row border-t-2 border-slate-900 pt-2 mt-1 flex justify-between font-extrabold text-sm text-slate-900">
                    <span>TOTAL AMOUNT:</span>
                    <span>₹{order.totalAmount.toLocaleString('en-IN')}</span>
                  </div>
                </>
              ) : isCustomerAccount ? (
                <>
                  <div className="flex justify-between text-slate-600">
                    <span>Total Containers Held:</span>
                    <span className="font-bold text-slate-900">{totalHoldingCount} jars</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Security Deposit Paid:</span>
                    <span className="font-medium text-slate-900">₹{(targetCustomer?.depositPaid || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="invoice-total-row border-t-2 border-slate-900 pt-2 mt-1 flex justify-between font-extrabold text-sm text-slate-900">
                    <span>TOTAL DUE BALANCE:</span>
                    <span className={(targetCustomer?.dueAmount || 0) > 0 ? 'text-rose-600' : 'text-emerald-700'}>
                      ₹{(targetCustomer?.dueAmount || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between text-slate-600">
                    <span>Itemized Total ({delivery!.jarsDelivered} out / {delivery!.emptyJarsCollected} in):</span>
                    <span className="font-medium text-slate-900">₹{deliveryGrossAmount.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Payment Mode:</span>
                    <span className="font-bold text-slate-900">{delivery!.paymentMode}</span>
                  </div>
                  {deliveryBalanceDue > 0 && (
                    <div className="flex justify-between text-amber-800 font-semibold">
                      <span>Added to Due (Credit):</span>
                      <span>₹{deliveryBalanceDue.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  <div className="invoice-total-row border-t-2 border-slate-900 pt-2 mt-1 flex justify-between font-extrabold text-sm text-slate-900">
                    <span>AMOUNT PAID:</span>
                    <span className="text-emerald-700">₹{deliveryPaidAmount.toLocaleString('en-IN')}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Footer Note */}
          <div className={`pt-3 border-t border-slate-200 flex justify-between items-center text-[11px] text-slate-500 ${isPosMode ? 'flex-col gap-0.5 text-center border-dashed border-slate-400' : ''}`}>
            <p>Thank you for your business!</p>
            <p className="text-slate-400">{displayedBizName}</p>
          </div>
        </div>

        {/* Modal Bottom Actions (Hidden during print) */}
        <div className="no-print p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          {/* Due QR WhatsApp Inclusion Option */}
          {upiId && payableAmount > 0 ? (
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 bg-white px-3 py-2 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors select-none shadow-2xs">
              <input
                type="checkbox"
                checked={includeDueQrInWhatsApp}
                onChange={(e) => setIncludeDueQrInWhatsApp(e.target.checked)}
                className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300 cursor-pointer"
              />
              <span className="flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                <span>Include Due Amount QR Link (₹{payableAmount.toLocaleString('en-IN')})</span>
              </span>
            </label>
          ) : (
            <div className="text-[11px] text-slate-400 italic">
              {!upiId ? 'No UPI ID configured' : 'No balance pending'}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleNativeShare}
              className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              {copiedBillText ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden sm:inline text-emerald-700 font-semibold">Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden sm:inline">Copy Text</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleSendBill}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 rounded-xl shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Send WhatsApp Bill</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              {printDone ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Printer className="w-3.5 h-3.5" />}
              <span>{isPrinting ? 'Printing...' : printDone ? 'Print PDF Saved' : 'Print'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
