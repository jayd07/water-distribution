import { jsPDF } from 'jspdf';
import autoTable, { UserOptions } from 'jspdf-autotable';
import { DeliveryLog, TransactionRecord, BusinessAccount, Customer } from '../types';
import { isTimestampOnDate, computeDayAccountingSummary, DayAccountingSummary } from './csvExport';

export interface PdfReportOptions {
  includeFinancials?: boolean;
  includeDriverBreakdown?: boolean;
  includeCustomerContact?: boolean;
  notes?: string;
}

export interface DriverSummaryRow {
  driverName: string;
  dropsCount: number;
  jarsDelivered: number;
  emptiesCollected: number;
  cashCollected: number;
  upiCollected: number;
  totalCollected: number;
}

/**
 * Computes driver/worker level breakdown for the selected day
 */
export function computeDriverBreakdown(dayDeliveries: DeliveryLog[]): DriverSummaryRow[] {
  const driverMap = new Map<string, DriverSummaryRow>();

  dayDeliveries.forEach(d => {
    const driver = (d.workerName || 'Default Staff').trim();
    if (!driverMap.has(driver)) {
      driverMap.set(driver, {
        driverName: driver,
        dropsCount: 0,
        jarsDelivered: 0,
        emptiesCollected: 0,
        cashCollected: 0,
        upiCollected: 0,
        totalCollected: 0
      });
    }

    const row = driverMap.get(driver)!;
    row.dropsCount += 1;
    row.jarsDelivered += Number(d.jarsDelivered) || 0;
    row.emptiesCollected += Number(d.emptyJarsCollected) || 0;

    const amt = Number(d.amountCollected) || 0;
    if (d.paymentMode === 'CASH') {
      row.cashCollected += amt;
    } else if (d.paymentMode === 'UPI') {
      row.upiCollected += amt;
    }
    row.totalCollected += amt;
  });

  return Array.from(driverMap.values()).sort((a, b) => b.dropsCount - a.dropsCount);
}

/**
 * Generates formatted text message designed for WhatsApp sharing
 */
export function generateDailyWhatsAppSummary(
  targetDateStr: string,
  deliveries: DeliveryLog[],
  transactions: TransactionRecord[],
  business?: BusinessAccount | null
): string {
  const [y, m, d] = targetDateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const formattedDate = dateObj.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  const dayDeliveries = deliveries.filter(d => isTimestampOnDate(d.timestamp, targetDateStr));
  const summary: DayAccountingSummary = computeDayAccountingSummary(targetDateStr, deliveries, transactions);
  const driverStats = computeDriverBreakdown(dayDeliveries);

  const bizName = business?.name || 'Water Supply Management';
  const bizPhone = business?.ownerPhone ? ` | 📞 ${business.ownerPhone}` : '';

  const netJarVariance = summary.totalJarsDelivered - summary.totalEmptiesCollected;
  const varianceSign = netJarVariance > 0 ? `+${netJarVariance}` : `${netJarVariance}`;

  let text = `💧 *${bizName}*${bizPhone}\n`;
  text += `📋 *DAILY DISPATCH & DELIVERY SUMMARY*\n`;
  text += `📅 *Date:* ${formattedDate} (${targetDateStr})\n`;
  text += `───────────────────────\n\n`;

  text += `📦 *LOGISTICS & JARS OVERVIEW*\n`;
  text += `• Total Deliveries: *${summary.totalDeliveriesCount}* drops\n`;
  text += `• Jars Delivered: *${summary.totalJarsDelivered}* units\n`;
  text += `• Empties Collected: *${summary.totalEmptiesCollected}* units\n`;
  text += `• Net Jar Circulation: *${varianceSign}* (delivered vs returned)\n\n`;

  text += `💰 *COLLECTION & REVENUE*\n`;
  text += `• Cash in Hand: *₹${summary.totalCashCollected.toLocaleString('en-IN')}*\n`;
  text += `• UPI / Digital: *₹${summary.totalUpiCollected.toLocaleString('en-IN')}*\n`;
  text += `• Total Day Revenue: *₹${summary.totalSettledAmount.toLocaleString('en-IN')}*\n`;
  if (summary.totalCreditPending > 0) {
    text += `• Dues/Credit Added: *₹${summary.totalCreditPending.toLocaleString('en-IN')}*\n`;
  }
  text += `\n`;

  if (driverStats.length > 0) {
    text += `🚚 *STAFF SUMMARY (${driverStats.length})*\n`;
    driverStats.forEach(ds => {
      text += `• *${ds.driverName}*: ${ds.dropsCount} drops | Out: ${ds.jarsDelivered} | In: ${ds.emptiesCollected} | ₹${ds.totalCollected}\n`;
    });
    text += `\n`;
  }

  return text;
}

/**
 * Builds a publication-ready PDF document of the day's delivery logs using jsPDF & autotable
 */
export function buildDailyDeliveryPdf(
  targetDateStr: string,
  deliveries: DeliveryLog[],
  transactions: TransactionRecord[],
  customersMap: Map<string, Customer>,
  business?: BusinessAccount | null,
  options: PdfReportOptions = {}
): jsPDF {
  const {
    includeFinancials = true,
    includeDriverBreakdown = true,
    includeCustomerContact = true,
    notes = ''
  } = options;

  const [y, m, d] = targetDateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const formattedDate = dateObj.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const dayDeliveries = deliveries
    .filter(d => isTimestampOnDate(d.timestamp, targetDateStr))
    .sort((a, b) => a.timestamp - b.timestamp);

  const summary = computeDayAccountingSummary(targetDateStr, deliveries, transactions);
  const driverStats = computeDriverBreakdown(dayDeliveries);

  const bizName = (business?.name || 'Water Supply Management').trim();
  const bizAddress = business?.address?.trim() 
    ? `${business.address}${business.city ? `, ${business.city}` : ''}`
    : (business?.city?.trim() || '');
  const bizPhone = business?.ownerPhone || '';
  const bizGstin = business?.gstin || '';

  // Initialize jsPDF A4 portrait
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // Header Background Accent Bar
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 5, 'F');

  // Business Header Section
  doc.setTextColor(15, 23, 42); // slate-900
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(bizName, margin, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // slate-500
  let headerY = 15.5;
  if (bizAddress) {
    headerY += 4.5;
    doc.text(bizAddress, margin, headerY);
  }

  const contactPieces: string[] = [];
  if (bizPhone) contactPieces.push(`Phone: +91 ${bizPhone}`);
  if (bizGstin) contactPieces.push(`GSTIN: ${bizGstin}`);
  if (contactPieces.length > 0) {
    headerY += 4.5;
    doc.text(contactPieces.join('  |  '), margin, headerY);
  }

  // Right-aligned Document Metadata Box
  const reportId = `DEL-LOG-${targetDateStr.replace(/-/g, '')}`;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(2, 132, 199); // sky-600
  doc.text('DAILY DELIVERY LOG SUMMARY', pageWidth - margin, 15, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Log Date: ${targetDateStr} (${formattedDate})`, pageWidth - margin, 20, { align: 'right' });
  doc.text(`Report ID: ${reportId}`, pageWidth - margin, 24.5, { align: 'right' });
  doc.text(`Generated: ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`, pageWidth - margin, 29, { align: 'right' });

  // Divider Line
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.4);
  doc.line(margin, 32, pageWidth - margin, 32);

  // Summary Metrics Banner / KPI Cards
  const kpiBoxY = 35;
  const kpiBoxHeight = 18;
  const kpiCols = 4;
  const colWidth = (pageWidth - margin * 2) / kpiCols;

  const kpis = [
    { label: 'TOTAL DELIVERIES', val: `${summary.totalDeliveriesCount} Drops`, sub: `${dayDeliveries.length} orders fulfilled` },
    { label: 'JARS DELIVERED', val: `${summary.totalJarsDelivered} Units`, sub: `${summary.totalEmptiesCollected} empties returned` },
    { label: 'CASH COLLECTED', val: `Rs. ${summary.totalCashCollected.toLocaleString('en-IN')}`, sub: 'Cash in hand' },
    { label: 'DIGITAL / UPI', val: `Rs. ${summary.totalUpiCollected.toLocaleString('en-IN')}`, sub: `Total: Rs. ${summary.totalSettledAmount.toLocaleString('en-IN')}` }
  ];

  kpis.forEach((kpi, idx) => {
    const x = margin + idx * colWidth;
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.roundedRect(x, kpiBoxY, colWidth - 2, kpiBoxHeight, 2, 2, 'FD');

    // Label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(kpi.label, x + 3, kpiBoxY + 5);

    // Value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text(kpi.val, x + 3, kpiBoxY + 11);

    // Subtitle
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    doc.text(kpi.sub, x + 3, kpiBoxY + 15.5);
  });

  // Table Data Preparation
  const tableHead = [
    [
      { content: '#', styles: { halign: 'center' as const, valign: 'middle' as const } },
      { content: 'Time', styles: { halign: 'center' as const, valign: 'middle' as const } },
      { content: 'Customer Name & Contact', styles: { halign: 'left' as const, valign: 'middle' as const } },
      { content: 'Route / Address', styles: { halign: 'left' as const, valign: 'middle' as const } },
      { content: 'Out', styles: { halign: 'center' as const, valign: 'middle' as const } },
      { content: 'In', styles: { halign: 'center' as const, valign: 'middle' as const } },
      ...(includeFinancials
        ? [
            { content: 'Amt Paid', styles: { halign: 'right' as const, valign: 'middle' as const } },
            { content: 'Mode', styles: { halign: 'center' as const, valign: 'middle' as const } },
            { content: 'Status', styles: { halign: 'center' as const, valign: 'middle' as const } }
          ]
        : []),
      { content: 'Staff', styles: { halign: 'left' as const, valign: 'middle' as const } }
    ]
  ];

  const tableBody = dayDeliveries.map((del, idx) => {
    const cust = customersMap.get(del.customerId);
    const dTime = new Date(del.timestamp).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const custName = del.customerName || cust?.name || 'Customer';
    const custContact = includeCustomerContact && (del.customerPhone || cust?.phone) 
      ? `\nPh: ${del.customerPhone || cust?.phone}`
      : '';

    const address = del.customerAddress || cust?.address || cust?.route || 'Route drop';
    const jarsOut = String(del.jarsDelivered || 0);
    const jarsIn = String(del.emptyJarsCollected || 0);

    const row: any[] = [
      String(idx + 1),
      dTime,
      `${custName}${custContact}`,
      address.length > 28 ? `${address.substring(0, 26)}...` : address,
      jarsOut,
      jarsIn
    ];

    if (includeFinancials) {
      const amt = del.paymentMode === 'CREDIT' ? 0 : (Number(del.amountCollected) || 0);
      row.push(`Rs. ${amt.toLocaleString('en-IN')}`);
      row.push(del.paymentMode || 'CASH');
      row.push(del.paymentMode === 'CREDIT' ? 'Due' : 'Paid');
    }

    row.push(del.workerName || 'Staff');
    return row;
  });

  // Compute exact column totals for the Delivery Log table footer
  const totalJarsOut = dayDeliveries.reduce((acc, d) => acc + (Number(d.jarsDelivered) || 0), 0);
  const totalEmptiesIn = dayDeliveries.reduce((acc, d) => acc + (Number(d.emptyJarsCollected) || 0), 0);
  const totalDeliveryPaid = dayDeliveries.reduce(
    (acc, d) => acc + (d.paymentMode !== 'CREDIT' ? (Number(d.amountCollected) || 0) : 0),
    0
  );

  // Footer Totals Row: only TOTAL, Out, In, and Amount
  const totalRow: any[] = [
    {
      content: 'TOTAL',
      colSpan: 4,
      styles: { halign: 'right' as const, valign: 'middle' as const, fontStyle: 'bold' as const }
    },
    {
      content: String(totalJarsOut),
      styles: { halign: 'center' as const, valign: 'middle' as const, fontStyle: 'bold' as const }
    },
    {
      content: String(totalEmptiesIn),
      styles: { halign: 'center' as const, valign: 'middle' as const, fontStyle: 'bold' as const }
    },
    ...(includeFinancials
      ? [
          {
            content: `Rs. ${totalDeliveryPaid.toLocaleString('en-IN')}`,
            styles: { halign: 'right' as const, valign: 'middle' as const, fontStyle: 'bold' as const }
          },
          {
            content: '',
            colSpan: 3
          }
        ]
      : [
          {
            content: ''
          }
        ])
  ];

  // Render Table
  autoTable(doc, {
    startY: kpiBoxY + kpiBoxHeight + 5,
    margin: { left: margin, right: margin, bottom: 25 },
    head: tableHead,
    body: tableBody,
    foot: [totalRow],
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: 2.2,
      valign: 'middle',
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2
    },
    headStyles: {
      fillColor: [15, 23, 42], // slate-900
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      valign: 'middle'
    },
    footStyles: {
      fillColor: [241, 245, 249], // slate-100
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 7.5,
      valign: 'middle'
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    tableWidth: 182,
    columnStyles: {
      0: { cellWidth: 9, halign: 'center' },
      1: { cellWidth: 17, halign: 'center' },
      2: { cellWidth: 36, halign: 'left' },
      3: { cellWidth: 32, halign: 'left' },
      4: { cellWidth: 11, halign: 'center', fontStyle: 'bold' },
      5: { cellWidth: 11, halign: 'center', fontStyle: 'bold' },
      ...(includeFinancials ? {
        6: { cellWidth: 20, halign: 'right', fontStyle: 'bold' },
        7: { cellWidth: 14, halign: 'center' },
        8: { cellWidth: 13, halign: 'center' },
        9: { cellWidth: 19, halign: 'left' }
      } : {
        6: { cellWidth: 66, halign: 'left' }
      })
    }
  });

  // Check cursor position for Driver Breakdown & Signatures
  let currentY = (doc as any).lastAutoTable?.finalY || 180;

  // Driver breakdown table if space permits or autoTable handles pagination
  if (includeDriverBreakdown && driverStats.length > 0) {
    if (currentY > pageHeight - 55) {
      doc.addPage();
      currentY = 18;
    } else {
      currentY += 6;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text('STAFF SUMMARY', margin, currentY);

    const driverHead = [[
      { content: 'Staff', styles: { halign: 'left' as const, valign: 'middle' as const } },
      { content: 'Deliveries', styles: { halign: 'center' as const, valign: 'middle' as const } },
      { content: 'Jars Delivered', styles: { halign: 'center' as const, valign: 'middle' as const } },
      { content: 'Empties Returned', styles: { halign: 'center' as const, valign: 'middle' as const } },
      { content: 'Cash Collected', styles: { halign: 'right' as const, valign: 'middle' as const } },
      { content: 'UPI Collected', styles: { halign: 'right' as const, valign: 'middle' as const } },
      { content: 'Total', styles: { halign: 'right' as const, valign: 'middle' as const } }
    ]];

    const driverBody = driverStats.map(ds => [
      ds.driverName,
      `${ds.dropsCount} ${ds.dropsCount === 1 ? 'drop' : 'drops'}`,
      `${ds.jarsDelivered} ${ds.jarsDelivered === 1 ? 'jar' : 'jars'}`,
      `${ds.emptiesCollected} ${ds.emptiesCollected === 1 ? 'empty' : 'empties'}`,
      `Rs. ${ds.cashCollected.toLocaleString('en-IN')}`,
      `Rs. ${ds.upiCollected.toLocaleString('en-IN')}`,
      `Rs. ${ds.totalCollected.toLocaleString('en-IN')}`
    ]);

    autoTable(doc, {
      startY: currentY + 2.5,
      margin: { left: margin, right: margin, bottom: 25 },
      head: driverHead,
      body: driverBody,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 7.5,
        cellPadding: 2,
        valign: 'middle',
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.2
      },
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        valign: 'middle'
      },
      tableWidth: 182,
      columnStyles: {
        0: { cellWidth: 41, halign: 'left' },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 22, halign: 'center' },
        3: { cellWidth: 24, halign: 'center' },
        4: { cellWidth: 25, halign: 'right' },
        5: { cellWidth: 25, halign: 'right' },
        6: { cellWidth: 25, halign: 'right', fontStyle: 'bold' }
      }
    });

    currentY = (doc as any).lastAutoTable?.finalY || currentY + 30;
  }

  if (notes) {
    if (currentY > pageHeight - 25) {
      doc.addPage();
      currentY = 20;
    } else {
      currentY += 8;
    }
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Note: ${notes}`, margin, currentY);
  }

  // Page numbers on all pages
  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(
      `${bizName} • Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 6,
      { align: 'center' }
    );
  }

  return doc;
}

/**
 * Downloads the generated PDF directly to the user's device
 */
export function downloadDailyDeliveryPdf(
  targetDateStr: string,
  deliveries: DeliveryLog[],
  transactions: TransactionRecord[],
  customersMap: Map<string, Customer>,
  business?: BusinessAccount | null,
  options?: PdfReportOptions
): string {
  const doc = buildDailyDeliveryPdf(targetDateStr, deliveries, transactions, customersMap, business, options);
  const cleanBizName = (business?.name || 'Water_Supply').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `${cleanBizName}_Daily_Delivery_Summary_${targetDateStr}.pdf`;
  doc.save(filename);
  return filename;
}

/**
 * Prints the generated PDF document, falling back to auto-print PDF download when sandboxed
 */
export function printDailyDeliveryPdf(
  targetDateStr: string,
  deliveries: DeliveryLog[],
  transactions: TransactionRecord[],
  customersMap: Map<string, Customer>,
  business?: BusinessAccount | null,
  options?: PdfReportOptions
): string {
  const doc = buildDailyDeliveryPdf(targetDateStr, deliveries, transactions, customersMap, business, options);
  if (typeof (doc as any).autoPrint === 'function') {
    (doc as any).autoPrint();
  }
  const cleanBizName = (business?.name || 'Water_Supply').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `${cleanBizName}_Daily_Delivery_Summary_${targetDateStr}.pdf`;

  let printDialogOpened = false;
  const onBeforePrint = () => {
    printDialogOpened = true;
  };
  window.addEventListener('beforeprint', onBeforePrint, { once: true });

  const blob = doc.output('blob');
  const blobUrl = URL.createObjectURL(blob);

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '1px';
  iframe.style.height = '1px';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  iframe.style.border = '0';
  iframe.src = blobUrl;

  document.body.appendChild(iframe);

  // If browser or sandboxed iframe blocks print(), automatically save the print-ready PDF within 350ms
  const fallbackTimer = setTimeout(() => {
    window.removeEventListener('beforeprint', onBeforePrint);
    if (!printDialogOpened) {
      doc.save(filename);
    }
  }, 350);

  iframe.onload = () => {
    try {
      iframe.contentWindow?.addEventListener('beforeprint', onBeforePrint, { once: true });
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      clearTimeout(fallbackTimer);
      window.removeEventListener('beforeprint', onBeforePrint);
      doc.save(filename);
    }
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
      URL.revokeObjectURL(blobUrl);
    }, 5000);
  };

  return filename;
}

/**
 * Triggers native Web Share API with the PDF file if supported, or falls back to WhatsApp Web/App link
 */
export async function shareDailyDeliveryPdfOrWhatsApp(
  targetDateStr: string,
  deliveries: DeliveryLog[],
  transactions: TransactionRecord[],
  customersMap: Map<string, Customer>,
  business?: BusinessAccount | null,
  options?: PdfReportOptions
): Promise<{ method: 'WEB_SHARE' | 'WHATSAPP_LINK' | 'CLIPBOARD'; message: string }> {
  const summaryText = generateDailyWhatsAppSummary(targetDateStr, deliveries, transactions, business);
  const cleanBizName = (business?.name || 'Water_Supply').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `${cleanBizName}_Daily_Delivery_Summary_${targetDateStr}.pdf`;

  // 1. Try Web Share API with actual PDF file attachment (supported on Chrome Android, Safari iOS, etc.)
  try {
    const doc = buildDailyDeliveryPdf(targetDateStr, deliveries, transactions, customersMap, business, options);
    const pdfBlob = doc.output('blob');
    const pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' });

    if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
      await navigator.share({
        title: `${business?.name || 'Water Supply'} Daily Delivery Log (${targetDateStr})`,
        text: summaryText,
        files: [pdfFile]
      });
      return {
        method: 'WEB_SHARE',
        message: 'Shared PDF report directly via native share!'
      };
    } else if (typeof navigator.share === 'function') {
      // Browser supports Web Share API for text summary
      await navigator.share({
        title: `${business?.name || 'Water Supply'} Daily Delivery Log (${targetDateStr})`,
        text: summaryText
      });
      return {
        method: 'WEB_SHARE',
        message: 'Shared delivery summary directly via native share!'
      };
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return { method: 'WEB_SHARE', message: 'Share action was cancelled.' };
    }
    console.warn('Web Share API not available or errored:', err);
  }

  // 2. Open WhatsApp directly with formatted text summary
  try {
    const encoded = encodeURIComponent(summaryText);
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encoded}`;
    
    // Create an anchor tag to trigger navigation without popup blocker
    const link = document.createElement('a');
    link.href = whatsappUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    return {
      method: 'WHATSAPP_LINK',
      message: 'Opening WhatsApp with formatted summary report...'
    };
  } catch (err) {
    // 3. Fallback: Copy text to clipboard
    try {
      await navigator.clipboard.writeText(summaryText);
      return {
        method: 'CLIPBOARD',
        message: 'Summary text copied! Paste directly into WhatsApp.'
      };
    } catch {
      return {
        method: 'CLIPBOARD',
        message: 'Could not launch WhatsApp. Please copy summary text manually.'
      };
    }
  }
}
