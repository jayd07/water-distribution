import React, { useState, useEffect } from 'react';
import { Printer, Share2, X, Edit2, Building2, QrCode, Check, Download, MessageSquare } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DeliveryLog, Customer, OrderBooking, BusinessAccount, InventoryItem, TransactionRecord } from '../types';
import { getActiveBusiness, updateBusiness } from '../services/businessService';
import { getCustomerSkuHoldings, formatSkuHoldingsForWhatsApp, SkuHoldingItem } from '../utils/skuHoldingUtils';
import {
  calculateCustomerBillingLedger,
  resolveDeliveryPurchaseRate,
  calculateDeliveryBillAmount,
  getDeliveryPaidAmount,
  roundCurrency
} from '../utils/billingUtils';
import {
  generateUpiUri,
  resolveBusinessUpiId,
  getPublicQrImageUrl,
  generateUpiQrDataUrl,
  generateUpiQrCardBlob,
  numberToIndianWords
} from '../utils/upiUtils';

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
  transactions?: TransactionRecord[];
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
  transactions = [],
  customers = []
}) => {
  const fallbackBiz = getActiveBusiness();
  const currentBiz = business || fallbackBiz;

  const [isEditingBusiness, setIsEditingBusiness] = useState(false);
  const [bizNameInput, setBizNameInput] = useState(currentBiz?.name || '');
  const [bizAddressInput, setBizAddressInput] = useState(currentBiz?.address || '');
  const [bizCityInput, setBizCityInput] = useState(currentBiz?.city || '');
  const [bizPhoneInput, setBizPhoneInput] = useState(currentBiz?.ownerPhone || '');
  const [bizGstinInput, setBizGstinInput] = useState(currentBiz?.gstin || '');
  const [bizLogoInput, setBizLogoInput] = useState(currentBiz?.logoUrl || '');
  const [bizUpiInput, setBizUpiInput] = useState(
    resolveBusinessUpiId({ upiId: currentBiz?.upiId, ownerPhone: currentBiz?.ownerPhone })
  );
  const [isSavingBiz, setIsSavingBiz] = useState(false);
  const [logoLoadError, setLogoLoadError] = useState(false);

  // WhatsApp Message Payment & QR controls (strictly for message sending, never printed)
  const [includeDueQrInWhatsApp, setIncludeDueQrInWhatsApp] = useState<boolean>(true);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [whatsAppStatusMsg, setWhatsAppStatusMsg] = useState<string>('');

  // Print options: Paper size ('A4' | 'POS'), Financial Summary Mode ('FULL_LEDGER' | 'CURRENT_ONLY'),
  // and Configurable Clubbing of same particulars & rate (default ON for concise bills)
  const [printFormat, setPrintFormat] = useState<'A4' | 'POS'>('A4');
  const [summaryMode, setSummaryMode] = useState<'FULL_LEDGER' | 'CURRENT_ONLY'>('FULL_LEDGER');
  const [clubSameEntries, setClubSameEntries] = useState<boolean>(true);
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
      setBizLogoInput(currentBiz.logoUrl || '');
      setBizUpiInput(resolveBusinessUpiId({ upiId: currentBiz.upiId, ownerPhone: currentBiz.ownerPhone }));
      setIsEditingBusiness(false);
      setLogoLoadError(false);
      setWhatsAppStatusMsg('');
    }
  }, [isOpen, currentBiz]);

  const isOrder = !!order;
  const isCustomerAccount = !delivery && !order && !!customer;

  // Dynamic Business Information (no hardcoded specific business details)
  const displayedBizName = currentBiz?.name?.trim() || '';
  const displayedBizAddress = currentBiz?.address?.trim()
    ? `${currentBiz.address.trim()}${currentBiz.city?.trim() ? `, ${currentBiz.city.trim()}` : ''}`
    : currentBiz?.city?.trim() || '';
  const displayedBizPhone = currentBiz?.ownerPhone?.trim() || '';
  const displayedBizGstin = currentBiz?.gstin?.trim() || '';
  const displayedBizLogo = currentBiz?.logoUrl?.trim() || '';

  // Authoritative Customer Information
  const targetCustomer =
    customer ||
    (delivery?.customerId && customers.length > 0
      ? customers.find((c) => c.id === delivery.customerId)
      : null);

  const customerName = isOrder
    ? order!.customerName
    : delivery?.customerName || targetCustomer?.name || '';

  const rawCustomerPhone = (
    isOrder
      ? order!.customerMobile || ''
      : delivery?.customerPhone || targetCustomer?.phone || ''
  ).trim();
  const customerPhone = rawCustomerPhone.toLowerCase() === 'n/a' ? '' : rawCustomerPhone;

  const rawCustomerAddress = (
    isOrder
      ? order!.customerAddress || ''
      : delivery?.customerAddress || targetCustomer?.address || ''
  ).trim();
  const STALE_ADDRESS_PLACEHOLDERS = [
    'registered route address',
    'on-file route address',
    'direct pickup / event venue',
    'direct pickup',
    'delivery location',
    'registered location',
    'address not listed',
    'no route assigned',
    'route drop',
    'n/a',
    '-'
  ];
  const customerAddress = STALE_ADDRESS_PLACEHOLDERS.includes(rawCustomerAddress.toLowerCase())
    ? ''
    : rawCustomerAddress;

  const timestamp = isOrder
    ? order!.bookingDate
    : delivery
    ? delivery.timestamp
    : targetCustomer?.createdAt || Date.now();

  const dateOnlyFormatted = new Date(timestamp).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const timeOnlyFormatted = new Date(timestamp).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const dateFormatted = `${dateOnlyFormatted}, ${timeOnlyFormatted}`;

  // Authoritative SKU-wise jar holdings & financials
  const skuHoldings: SkuHoldingItem[] = getCustomerSkuHoldings(targetCustomer, deliveries, inventory);
  const totalHoldingCount =
    skuHoldings.reduce((sum, h) => sum + h.count, 0) || targetCustomer?.jarsHolding || 0;

  const securityDepositHeld = isOrder
    ? Number(order!.depositAmount) || 0
    : Number(targetCustomer?.depositPaid) || 0;

  // Authoritative chronological customer ledger computed strictly at purchase-date rates
  const customerLedger = calculateCustomerBillingLedger(targetCustomer, deliveries, transactions);
  const deliverySnapshot = delivery?.id ? customerLedger.snapshotsById.get(delivery.id) : undefined;

  // CRITICAL: Always use the purchase-date rate recorded on the delivery, never the current rate
  const deliveryUnitRate = delivery
    ? deliverySnapshot
      ? deliverySnapshot.purchaseRate
      : resolveDeliveryPurchaseRate(delivery)
    : 35;

  const deliveryGrossAmount = delivery
    ? deliverySnapshot
      ? deliverySnapshot.billAmount
      : delivery.jarsDelivered > 0
      ? calculateDeliveryBillAmount(delivery)
      : getDeliveryPaidAmount(delivery)
    : 0;

  const deliveryPaidAmount = delivery
    ? deliverySnapshot
      ? deliverySnapshot.paidAmount
      : getDeliveryPaidAmount(delivery)
    : 0;

  const deliveryBalanceDue = delivery
    ? deliverySnapshot
      ? deliverySnapshot.unpaidAmount
      : roundCurrency(Math.max(0, deliveryGrossAmount - deliveryPaidAmount))
    : 0;

  // Authoritative Customer Outstanding Balance from chronological purchase-date ledger
  const customerTotalOutstanding = targetCustomer
    ? customerLedger.netOutstandingBalance
    : roundCurrency(Math.max(0, Number((customer as Customer | null)?.dueAmount) || 0));

  // Previous outstanding balance immediately prior to this delivery
  const previousOutstandingBalance = delivery
    ? deliverySnapshot
      ? deliverySnapshot.balanceBefore
      : targetCustomer
      ? delivery.jarsDelivered === 0 && deliveryPaidAmount > 0
        ? roundCurrency(customerTotalOutstanding + deliveryPaidAmount)
        : roundCurrency(Math.max(0, customerTotalOutstanding - deliveryBalanceDue))
      : 0
    : customerTotalOutstanding;

  const totalOutstandingAfterDelivery = delivery
    ? deliverySnapshot
      ? deliverySnapshot.balanceAfter
      : targetCustomer
      ? roundCurrency(Math.max(0, previousOutstandingBalance + deliveryGrossAmount - deliveryPaidAmount))
      : deliveryBalanceDue
    : isOrder
    ? order!.paymentStatus === 'PAID'
      ? 0
      : order!.totalAmount
    : customerTotalOutstanding;

  // Primary amount for AMOUNT IN WORDS based on selected summary mode
  const primaryInvoiceAmount = isOrder
    ? order!.totalAmount
    : isCustomerAccount
    ? customerTotalOutstanding
    : summaryMode === 'FULL_LEDGER'
    ? totalOutstandingAfterDelivery
    : deliveryGrossAmount > 0
    ? deliveryGrossAmount
    : deliveryPaidAmount;

  const payableAmount = isOrder
    ? order!.paymentStatus !== 'PAID'
      ? order!.totalAmount
      : order!.totalAmount
    : isCustomerAccount
    ? customerTotalOutstanding
    : summaryMode === 'FULL_LEDGER' && totalOutstandingAfterDelivery > 0
    ? totalOutstandingAfterDelivery
    : deliveryBalanceDue > 0
    ? deliveryBalanceDue
    : deliveryGrossAmount > 0
    ? deliveryGrossAmount
    : deliveryPaidAmount;

  // Resolve UPI ID for WhatsApp sharing only
  const upiId = (
    bizUpiInput.trim() ||
    resolveBusinessUpiId({ upiId: currentBiz?.upiId, ownerPhone: displayedBizPhone })
  ).trim();

  const upiUrl = upiId
    ? generateUpiUri({
        upiId,
        merchantName: displayedBizName || 'Water Supply',
        amount: payableAmount > 0 ? payableAmount : undefined,
        note: customerName ? `Water Supply - ${customerName}` : 'Water Supply Payment'
      })
    : '';

  const publicQrUrl = upiUrl ? getPublicQrImageUrl(upiUrl, 320) : '';

  useEffect(() => {
    let active = true;
    if (upiUrl) {
      generateUpiQrDataUrl(upiUrl, { width: 220, margin: 2 }).then((url) => {
        if (active) setQrDataUrl(url);
      });
    } else {
      setQrDataUrl('');
    }
    return () => {
      active = false;
    };
  }, [upiUrl]);

  if (!isOpen || (!delivery && !order && !customer)) return null;

  const handleSaveBusinessInfo = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSavingBiz(true);
    try {
      const bizId = currentBiz?.id || fallbackBiz?.id || 'default_business';
      const updated = await updateBusiness(bizId, {
        name: bizNameInput.trim() || displayedBizName,
        address: bizAddressInput.trim(),
        city: bizCityInput.trim(),
        ownerPhone: bizPhoneInput.trim(),
        gstin: bizGstinInput.trim(),
        logoUrl: bizLogoInput.trim(),
        upiId: bizUpiInput.trim()
      });
      if (updated) {
        onUpdateBusiness?.(updated);
      }
      setLogoLoadError(false);
      setIsEditingBusiness(false);
    } catch (err) {
      console.error('Failed to update business on invoice:', err);
    } finally {
      setIsSavingBiz(false);
    }
  };

  const isPosMode = printFormat === 'POS';
  const docTitle = isOrder
    ? 'ORDER INVOICE'
    : isCustomerAccount
    ? 'ACCOUNT STATEMENT'
    : 'ACCOUNT STATEMENT';

  // Authoritative Database-Driven WATER DELIVERY DETAILS Rows (Never renames or modifies database descriptions)
  const billableDeliveries = customerLedger.deliveriesChronological.filter(
    (snap) => snap.jarsDelivered > 0 || snap.emptyJarsCollected > 0
  );

  // Whether the table displays the full customer delivery history (Account Statement or Full Balance mode)
  const showFullLedgerDeliveries =
    !isOrder &&
    (isCustomerAccount || (Boolean(delivery) && summaryMode === 'FULL_LEDGER' && billableDeliveries.length > 0));

  const itemizedRows: Array<{
    sno: string;
    particulars: string;
    quantity: string;
    rate: string;
    amount: string;
    pdfRate: string;
    pdfAmount: string;
  }> = [];

  if (isOrder) {
    const itemSubtotal = order!.quantity * order!.rentOrPricePerUnit;
    itemizedRows.push({
      sno: '01',
      particulars: order!.itemType,
      quantity: `${order!.quantity}`,
      rate: `₹${order!.rentOrPricePerUnit.toFixed(2)}`,
      amount: `₹${itemSubtotal.toLocaleString('en-IN')}.00`,
      pdfRate: `Rs. ${order!.rentOrPricePerUnit.toFixed(2)}`,
      pdfAmount: `Rs. ${itemSubtotal.toLocaleString('en-IN')}.00`
    });
    if (order!.depositAmount > 0) {
      itemizedRows.push({
        sno: '02',
        particulars: 'Security Deposit',
        quantity: '-',
        rate: '-',
        amount: `₹${order!.depositAmount.toLocaleString('en-IN')}.00`,
        pdfRate: '-',
        pdfAmount: `Rs. ${order!.depositAmount.toLocaleString('en-IN')}.00`
      });
    }
  } else if (showFullLedgerDeliveries) {
    if (billableDeliveries.length > 0) {
      if (clubSameEntries) {
        // Club entries that have the exact same particulars (itemType) and purchase-date rate
        const clubbedMap = new Map<
          string,
          {
            particulars: string;
            isEmptyReturnOnly: boolean;
            totalQuantity: number;
            purchaseRate: number;
            totalAmount: number;
            entryCount: number;
          }
        >();

        billableDeliveries.forEach((snap) => {
          const d = snap.delivery;
          const rawItemLabel = (d.itemType || '20L Water Jar').trim();

          if (snap.jarsDelivered > 0) {
            const key = `DELIV__${rawItemLabel.toLowerCase()}__RATE_${snap.purchaseRate.toFixed(2)}`;
            const existing = clubbedMap.get(key);
            if (existing) {
              existing.totalQuantity += snap.jarsDelivered;
              existing.totalAmount = roundCurrency(existing.totalAmount + snap.billAmount);
              existing.entryCount += 1;
            } else {
              clubbedMap.set(key, {
                particulars: rawItemLabel,
                isEmptyReturnOnly: false,
                totalQuantity: snap.jarsDelivered,
                purchaseRate: snap.purchaseRate,
                totalAmount: snap.billAmount,
                entryCount: 1
              });
            }
          } else if (snap.emptyJarsCollected > 0) {
            const returnParticulars = `${rawItemLabel} (Empty Returned)`;
            const key = `RETURN__${rawItemLabel.toLowerCase()}__RATE_0`;
            const existing = clubbedMap.get(key);
            if (existing) {
              existing.totalQuantity += snap.emptyJarsCollected;
              existing.entryCount += 1;
            } else {
              clubbedMap.set(key, {
                particulars: returnParticulars,
                isEmptyReturnOnly: true,
                totalQuantity: snap.emptyJarsCollected,
                purchaseRate: 0,
                totalAmount: 0,
                entryCount: 1
              });
            }
          }
        });

        let clubIndex = 1;
        clubbedMap.forEach((group) => {
          const qtyLabel = group.isEmptyReturnOnly
            ? `${group.totalQuantity} Returned`
            : `${group.totalQuantity} ${group.totalQuantity === 1 ? 'Jar' : 'Jars'}`;
          const rateLabel = group.isEmptyReturnOnly ? '-' : `₹${group.purchaseRate.toFixed(2)}`;
          const pdfRateLabel = group.isEmptyReturnOnly ? '-' : `Rs. ${group.purchaseRate.toFixed(2)}`;

          itemizedRows.push({
            sno: String(clubIndex++).padStart(2, '0'),
            particulars: group.particulars,
            quantity: qtyLabel,
            rate: rateLabel,
            amount: `₹${group.totalAmount.toLocaleString('en-IN')}.00`,
            pdfRate: pdfRateLabel,
            pdfAmount: `Rs. ${group.totalAmount.toLocaleString('en-IN')}.00`
          });
        });
      } else {
        // Show every entry separately in chronological purchase order
        billableDeliveries.forEach((snap, idx) => {
          const d = snap.delivery;
          const itemLabel = (d.itemType || '20L Water Jar').trim();
          const particularsLabel =
            snap.jarsDelivered > 0
              ? `${itemLabel} (${snap.purchaseDateFormatted})`
              : `${itemLabel} - Empty Returned (${snap.purchaseDateFormatted})`;
          const qtyLabel =
            snap.jarsDelivered > 0
              ? `${snap.jarsDelivered} ${snap.jarsDelivered === 1 ? 'Jar' : 'Jars'}`
              : `${snap.emptyJarsCollected} Returned`;
          const rateLabel = snap.jarsDelivered > 0 ? `₹${snap.purchaseRate.toFixed(2)}` : '-';
          const pdfRateLabel = snap.jarsDelivered > 0 ? `Rs. ${snap.purchaseRate.toFixed(2)}` : '-';

          itemizedRows.push({
            sno: String(idx + 1).padStart(2, '0'),
            particulars: particularsLabel,
            quantity: qtyLabel,
            rate: rateLabel,
            amount: `₹${snap.billAmount.toLocaleString('en-IN')}.00`,
            pdfRate: pdfRateLabel,
            pdfAmount: `Rs. ${snap.billAmount.toLocaleString('en-IN')}.00`
          });
        });
      }
    } else if (skuHoldings.length > 0) {
      skuHoldings.forEach((sku, idx) => {
        itemizedRows.push({
          sno: String(idx + 1).padStart(2, '0'),
          particulars: sku.displayName || sku.itemType,
          quantity: `${sku.count} Jars`,
          rate: `₹${sku.unitPrice.toFixed(2)}`,
          amount: `${sku.count} ${sku.count === 1 ? 'Jar' : 'Jars'}`,
          pdfRate: `Rs. ${sku.unitPrice.toFixed(2)}`,
          pdfAmount: `${sku.count} ${sku.count === 1 ? 'Jar' : 'Jars'}`
        });
      });
    } else {
      itemizedRows.push({
        sno: '01',
        particulars: 'Water Jars Held',
        quantity: `${totalHoldingCount} Jars`,
        rate: '-',
        amount: `₹${customerTotalOutstanding.toLocaleString('en-IN')}.00`,
        pdfRate: '-',
        pdfAmount: `Rs. ${customerTotalOutstanding.toLocaleString('en-IN')}.00`
      });
    }
  } else {
    let serial = 1;
    if (delivery!.jarsDelivered > 0) {
      itemizedRows.push({
        sno: String(serial++).padStart(2, '0'),
        particulars: delivery!.itemType || '20L Water Jar',
        quantity: `${delivery!.jarsDelivered} Jars`,
        rate: `₹${deliveryUnitRate.toFixed(2)}`,
        amount: `₹${deliveryGrossAmount.toLocaleString('en-IN')}.00`,
        pdfRate: `Rs. ${deliveryUnitRate.toFixed(2)}`,
        pdfAmount: `Rs. ${deliveryGrossAmount.toLocaleString('en-IN')}.00`
      });
    }
    if (delivery!.emptyJarsCollected > 0) {
      itemizedRows.push({
        sno: String(serial++).padStart(2, '0'),
        particulars: delivery!.itemType
          ? `${delivery!.itemType} (Empty Returned)`
          : 'Empty Jars Returned',
        quantity: `${delivery!.emptyJarsCollected} Jars`,
        rate: '-',
        amount: '₹0.00',
        pdfRate: '-',
        pdfAmount: 'Rs. 0.00'
      });
    }
    if (delivery!.jarsDelivered === 0 && deliveryPaidAmount > 0) {
      itemizedRows.push({
        sno: String(serial++).padStart(2, '0'),
        particulars: 'Payment Received',
        quantity: '1',
        rate: `₹${deliveryPaidAmount.toFixed(2)}`,
        amount: `₹${deliveryPaidAmount.toLocaleString('en-IN')}.00`,
        pdfRate: `Rs. ${deliveryPaidAmount.toFixed(2)}`,
        pdfAmount: `Rs. ${deliveryPaidAmount.toLocaleString('en-IN')}.00`
      });
    }
  }

  // Build Financial Summary Rows dynamically based on context & user-selected summaryMode
  const buildFinancialSummaryRows = (useRupeeSymbol: boolean) => {
    const curr = useRupeeSymbol ? '₹' : 'Rs. ';
    const rows: Array<{ label: string; value: string; isProminent?: boolean }> = [];

    if (isOrder) {
      const itemSubtotal = order!.quantity * order!.rentOrPricePerUnit;
      rows.push({
        label: 'Current Transaction Amount',
        value: `${curr}${itemSubtotal.toLocaleString('en-IN')}.00`
      });
      rows.push({
        label: 'Security Deposit',
        value: `${curr}${order!.depositAmount.toLocaleString('en-IN')}.00`
      });
      rows.push({
        label: 'TOTAL OUTSTANDING AMOUNT',
        value: `${curr}${order!.totalAmount.toLocaleString('en-IN')}.00`,
        isProminent: true
      });
    } else if (showFullLedgerDeliveries) {
      if (customerLedger.openingBalance > 0) {
        rows.push({
          label: 'Previous Outstanding Balance',
          value: `${curr}${customerLedger.openingBalance.toLocaleString('en-IN')}.00`
        });
      }
      rows.push({
        label: 'Current Transaction Amount',
        value: `${curr}${customerLedger.totalBilledAtPurchaseRates.toLocaleString('en-IN')}.00`
      });
      rows.push({
        label: 'Payments Received',
        value: `${curr}${customerLedger.totalPaymentsReceived.toLocaleString('en-IN')}.00`
      });
      rows.push({
        label: 'Security Deposit',
        value: `${curr}${securityDepositHeld.toLocaleString('en-IN')}.00`
      });
      rows.push({
        label: 'TOTAL OUTSTANDING AMOUNT',
        value: `${curr}${customerTotalOutstanding.toLocaleString('en-IN')}.00`,
        isProminent: true
      });
    } else {
      if (summaryMode === 'FULL_LEDGER') {
        rows.push({
          label: 'Current Transaction Amount',
          value: `${curr}${deliveryGrossAmount.toLocaleString('en-IN')}.00`
        });
        rows.push({
          label: 'Previous Outstanding Balance',
          value: `${curr}${previousOutstandingBalance.toLocaleString('en-IN')}.00`
        });
        rows.push({
          label: 'Payments Received',
          value: `${curr}${deliveryPaidAmount.toLocaleString('en-IN')}.00`
        });
        rows.push({
          label: 'Security Deposit',
          value: `${curr}${securityDepositHeld.toLocaleString('en-IN')}.00`
        });
        rows.push({
          label: 'TOTAL OUTSTANDING AMOUNT',
          value: `${curr}${totalOutstandingAfterDelivery.toLocaleString('en-IN')}.00`,
          isProminent: true
        });
      } else {
        rows.push({
          label: 'Current Transaction Amount',
          value: `${curr}${deliveryGrossAmount.toLocaleString('en-IN')}.00`
        });
        rows.push({
          label: 'Payments Received',
          value: `${curr}${deliveryPaidAmount.toLocaleString('en-IN')}.00`
        });
        rows.push({
          label: 'Security Deposit',
          value: `${curr}${securityDepositHeld.toLocaleString('en-IN')}.00`
        });
        rows.push({
          label: 'TOTAL OUTSTANDING AMOUNT',
          value: `${curr}${deliveryBalanceDue.toLocaleString('en-IN')}.00`,
          isProminent: true
        });
      }
    }
    return rows;
  };

  const domSummaryRows = buildFinancialSummaryRows(true);

  const generatePrintableInvoicePdf = (format: 'A4' | 'POS') => {
    const isPos = format === 'POS';
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: isPos ? [80, 220] : 'a4'
    });

    if (typeof (doc as any).autoPrint === 'function') {
      (doc as any).autoPrint();
    }

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = isPos ? 4 : 14;
    const contentWidth = pageWidth - margin * 2;
    const pdfSummaryRows = buildFinancialSummaryRows(false);

    let y = isPos ? 7 : 18;

    // Top Blue Brand Accent Bar on A4
    if (!isPos) {
      doc.setFillColor(2, 132, 199); // #0284C7
      doc.rect(0, 0, pageWidth, 4.5, 'F');
    }

    // 1. Business Header
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isPos ? 10.5 : 16);
    if (displayedBizName) {
      doc.text(displayedBizName.toUpperCase(), isPos ? pageWidth / 2 : margin, y, {
        align: isPos ? 'center' : 'left',
        maxWidth: isPos ? contentWidth : 115
      });
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(isPos ? 7.5 : 8.5);
    doc.setTextColor(71, 85, 105);

    if (displayedBizAddress) {
      y += isPos ? 4 : 5;
      doc.text(displayedBizAddress, isPos ? pageWidth / 2 : margin, y, {
        align: isPos ? 'center' : 'left',
        maxWidth: isPos ? contentWidth : 115
      });
    }

    const contactLine = [
      displayedBizPhone ? `Phone: ${displayedBizPhone}` : '',
      displayedBizGstin ? `GSTIN: ${displayedBizGstin}` : ''
    ]
      .filter(Boolean)
      .join('   |   ');

    if (contactLine) {
      y += isPos ? 3.8 : 4.5;
      doc.text(contactLine, isPos ? pageWidth / 2 : margin, y, {
        align: isPos ? 'center' : 'left'
      });
    }

    if (isPos) {
      y += 3.5;
      doc.setDrawColor(2, 132, 199);
      doc.setLineWidth(0.4);
      doc.line(margin, y, pageWidth - margin, y);
      y += 4;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(3, 105, 161);
      doc.text(docTitle, pageWidth / 2, y, { align: 'center' });
      y += 3.8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(`Date: ${dateFormatted}`, pageWidth / 2, y, { align: 'center' });
      y += 3;
      doc.setDrawColor(203, 213, 225);
      doc.line(margin, y, pageWidth - margin, y);
      y += 4;

      // CUSTOMER DETAILS on POS
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(3, 105, 161);
      doc.text('CUSTOMER DETAILS', margin, y);
      y += 3.8;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      if (customerName) {
        doc.text(customerName, margin, y, { maxWidth: contentWidth });
        y += 3.6;
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);
      if (customerPhone) {
        doc.text(`Phone: ${customerPhone}`, margin, y);
        y += 3.6;
      }
      if (customerAddress) {
        doc.text(`Address: ${customerAddress.substring(0, 44)}`, margin, y, { maxWidth: contentWidth });
        y += 3.6;
      }

      // ACCOUNT DETAILS on POS (single place for Jars Currently With Customer)
      y += 1;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(3, 105, 161);
      doc.text('ACCOUNT DETAILS', margin, y);
      y += 3.8;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(`Jars Currently With Customer: ${totalHoldingCount} Jars`, margin, y);
      y += 4.5;
    } else {
      // Right-aligned Document Title & Date on A4
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(3, 105, 161); // #0369A1
      doc.text(docTitle, pageWidth - margin, 18, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text(`Date: ${dateOnlyFormatted}`, pageWidth - margin, 23.5, { align: 'right' });
      doc.text(`Time: ${timeOnlyFormatted}`, pageWidth - margin, 28, { align: 'right' });

      y = Math.max(y + 6, 33);

      // Divider rule
      doc.setDrawColor(2, 132, 199);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);
      y += 5;

      // 2-Column CUSTOMER DETAILS & ACCOUNT DETAILS Box
      const gridHeight = 22;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, y, contentWidth, gridHeight, 1.5, 1.5, 'FD');
      doc.line(margin + contentWidth / 2, y, margin + contentWidth / 2, y + gridHeight);

      // Section Headers inside grid
      doc.setFillColor(240, 249, 255); // #F0F9FF
      doc.rect(margin + 0.2, y + 0.2, contentWidth - 0.4, 6.2, 'F');
      doc.line(margin, y + 6.4, pageWidth - margin, y + 6.4);
      doc.line(margin + contentWidth / 2, y, margin + contentWidth / 2, y + 6.4);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(3, 105, 161);
      doc.text('CUSTOMER DETAILS', margin + 3.5, y + 4.4);
      doc.text('ACCOUNT DETAILS', margin + contentWidth / 2 + 3.5, y + 4.4);

      // Left Column: Customer Details
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      if (customerName) {
        doc.text(customerName, margin + 3.5, y + 11.5);
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.2);
      doc.setTextColor(51, 65, 85);
      let leftTextY = y + 16;
      if (customerPhone) {
        doc.text(`Phone: ${customerPhone}`, margin + 3.5, leftTextY);
        leftTextY += 4.2;
      }
      if (customerAddress) {
        doc.text(`Address: ${customerAddress.substring(0, 54)}`, margin + 3.5, leftTextY);
      }

      // Right Column: Account Details (Jars Currently With Customer at one place only)
      const rightX = margin + contentWidth / 2 + 3.5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.2);
      doc.setTextColor(51, 65, 85);
      doc.text(`Jars Currently With Customer: ${totalHoldingCount} Jars`, rightX, y + 11.5);
      if (delivery && delivery.workerName) {
        doc.text(`Delivered By: ${delivery.workerName}`, rightX, y + 16);
      } else if (order && order.deliveryDate) {
        doc.text(`Scheduled Date: ${order.deliveryDate}`, rightX, y + 16);
      }

      y += gridHeight + 7;
    }

    // 3. WATER DELIVERY DETAILS Section Heading
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isPos ? 8 : 9);
    doc.setTextColor(3, 105, 161);
    doc.text('WATER DELIVERY DETAILS', margin, y);
    y += isPos ? 2 : 2.5;

    const pdfBodyRows = itemizedRows.map((row) =>
      isPos
        ? [row.particulars, row.quantity, row.pdfRate, row.pdfAmount]
        : [row.sno, row.particulars, row.quantity, row.pdfRate, row.pdfAmount]
    );

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      tableWidth: contentWidth,
      head: isPos
        ? [
            [
              { content: 'PARTICULARS', styles: { halign: 'left' } },
              { content: 'QUANTITY', styles: { halign: 'center' } },
              { content: 'RATE (Rs.)', styles: { halign: 'right' } },
              { content: 'AMOUNT (Rs.)', styles: { halign: 'right' } }
            ]
          ]
        : [
            [
              { content: 'S.NO', styles: { halign: 'center' } },
              { content: 'PARTICULARS', styles: { halign: 'left' } },
              { content: 'QUANTITY', styles: { halign: 'center' } },
              { content: 'RATE (Rs.)', styles: { halign: 'right' } },
              { content: 'AMOUNT (Rs.)', styles: { halign: 'right' } }
            ]
          ],
      body: pdfBodyRows,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: isPos ? 7.2 : 8.5,
        cellPadding: isPos ? 1.6 : 3,
        valign: 'middle',
        textColor: [15, 23, 42],
        lineColor: [203, 213, 225],
        lineWidth: 0.25
      },
      headStyles: {
        fillColor: [3, 105, 161], // #0369A1
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        lineColor: [3, 105, 161],
        lineWidth: 0.25
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      columnStyles: isPos
        ? {
            0: { cellWidth: 27, halign: 'left' },
            1: { cellWidth: 13, halign: 'center', fontStyle: 'bold' },
            2: { cellWidth: 15, halign: 'right' },
            3: { cellWidth: 17, halign: 'right', fontStyle: 'bold' }
          }
        : {
            0: { cellWidth: 14, halign: 'center' },
            1: { cellWidth: 82, halign: 'left' },
            2: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
            3: { cellWidth: 30, halign: 'right' },
            4: { cellWidth: 32, halign: 'right', fontStyle: 'bold' }
          }
    });

    // 4. Financial Summary & Signatory Block (Protected against awkward page splits)
    let summaryY = ((doc as any).lastAutoTable?.finalY || y + 25) + (isPos ? 4 : 6);
    const pageHeight = doc.internal.pageSize.getHeight();
    const requiredSummaryHeight = isPos ? 45 : 52;
    if (!isPos && summaryY + requiredSummaryHeight > pageHeight - 12) {
      doc.addPage();
      summaryY = 18;
    }

    if (isPos) {
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.35);
      doc.line(margin, summaryY, pageWidth - margin, summaryY);
      summaryY += 4;

      pdfSummaryRows.forEach((row) => {
        if (row.isProminent) {
          doc.setDrawColor(2, 132, 199);
          doc.setLineWidth(0.35);
          doc.line(margin, summaryY - 2.5, pageWidth - margin, summaryY - 2.5);
          summaryY += 1.5;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.2);
          doc.setTextColor(15, 23, 42);
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.4);
          doc.setTextColor(51, 65, 85);
        }
        doc.text(row.label, margin, summaryY);
        doc.text(row.value, pageWidth - margin, summaryY, { align: 'right' });
        summaryY += row.isProminent ? 4.5 : 3.8;
      });

      doc.setDrawColor(2, 132, 199);
      doc.setLineWidth(0.4);
      doc.line(margin, summaryY - 2, pageWidth - margin, summaryY - 2);
      summaryY += 3.5;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      doc.text('AMOUNT IN WORDS:', pageWidth / 2, summaryY, { align: 'center' });
      summaryY += 3.5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      doc.text(numberToIndianWords(primaryInvoiceAmount), pageWidth / 2, summaryY, {
        align: 'center',
        maxWidth: contentWidth
      });
      summaryY += 6;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      doc.text('CUSTOMER ACKNOWLEDGEMENT  |  AUTHORIZED SIGNATORY', pageWidth / 2, summaryY, {
        align: 'center'
      });
    } else {
      const boxHeight = Math.max(pdfSummaryRows.length * 6.8 + 8, 28);
      const leftWidth = 98;
      const rightWidth = contentWidth - leftWidth;
      const rightX = margin + leftWidth;

      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, summaryY, contentWidth, boxHeight, 1.5, 1.5, 'S');
      doc.line(rightX, summaryY, rightX, summaryY + boxHeight);

      // Left Box: AMOUNT IN WORDS only (no redundant jar or deposit lines)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.8);
      doc.setTextColor(3, 105, 161);
      doc.text('AMOUNT IN WORDS', margin + 3.5, summaryY + 6);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(numberToIndianWords(primaryInvoiceAmount), margin + 3.5, summaryY + 11.5, {
        maxWidth: leftWidth - 7
      });

      // Right Box: Financial Summary Rows
      let rowY = summaryY + 6;
      pdfSummaryRows.forEach((row) => {
        if (row.isProminent) {
          doc.setFillColor(240, 249, 255); // #F0F9FF
          doc.rect(rightX + 0.3, rowY - 4.4, rightWidth - 0.6, 8, 'F');
          doc.setDrawColor(2, 132, 199);
          doc.setLineWidth(0.4);
          doc.line(rightX, rowY - 4.4, rightX + rightWidth, rowY - 4.4);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.8);
          doc.setTextColor(3, 105, 161);
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.2);
          doc.setTextColor(51, 65, 85);
        }
        doc.text(row.label, rightX + 3.5, rowY);
        doc.setTextColor(15, 23, 42);
        doc.text(row.value, rightX + rightWidth - 3.5, rowY, { align: 'right' });
        rowY += 6.8;
      });

      summaryY += boxHeight + 14;

      // Signatory Row
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);
      doc.line(margin, summaryY + 6, margin + 55, summaryY + 6);
      doc.line(pageWidth - margin - 55, summaryY + 6, pageWidth - margin, summaryY + 6);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text('CUSTOMER ACKNOWLEDGEMENT', margin, summaryY + 10.5);

      if (displayedBizName) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(`For ${displayedBizName}`, pageWidth - margin, summaryY - 1, { align: 'right' });
      }
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text('AUTHORIZED SIGNATORY', pageWidth - margin, summaryY + 10.5, { align: 'right' });
    }

    const safeCustomer = (customerName || 'Customer').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 24);
    doc.save(`Invoice_${safeCustomer}_${format}.pdf`);
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
        generatePrintableInvoicePdf(printFormat);
      }
      setIsPrinting(false);
      setPrintDone(true);
      setTimeout(() => setPrintDone(false), 2500);
    }, 250);
  };

  const generateBillText = () => {
    const headerPrefix = `${displayedBizName ? `*${displayedBizName.toUpperCase()}*\n` : ''}${
      displayedBizAddress ? `${displayedBizAddress}\n` : ''
    }${displayedBizPhone ? `Tel: ${displayedBizPhone}\n` : ''}========================================\n`;

    let upiFooter = '';
    if (upiId) {
      if (includeDueQrInWhatsApp) {
        upiFooter = `\n----------------------------------------
*PAYMENT INFORMATION & QR*
• UPI ID: ${upiId}${payableAmount > 0 ? `\n• Amount Payable: ₹${payableAmount.toLocaleString('en-IN')}` : ''}
• Pay via UPI App: ${upiUrl}
• Scan QR Code: ${publicQrUrl}
----------------------------------------\n`;
      } else {
        upiFooter = `\n----------------------------------------
*PAYMENT INFORMATION*
• UPI ID: ${upiId}
• Pay via UPI App: ${upiUrl}
----------------------------------------\n`;
      }
    }

    if (isOrder) {
      return `${headerPrefix}*ORDER INVOICE*
----------------------------------------
*Date:* ${dateOnlyFormatted}
*Customer:* ${customerName}
${customerPhone ? `*Phone:* ${customerPhone}\n` : ''}${
        customerAddress ? `*Address:* ${customerAddress}\n` : ''
      }----------------------------------------
*Particulars:* ${order!.itemType}
*Quantity:* ${order!.quantity}
*Rate:* ₹${order!.rentOrPricePerUnit}
*Security Deposit:* ₹${order!.depositAmount}
*TOTAL OUTSTANDING AMOUNT:* ₹${order!.totalAmount.toLocaleString('en-IN')}
${order!.deliveryDate ? `*Scheduled Date:* ${order!.deliveryDate}\n` : ''}----------------------------------------${upiFooter}Thank you${
        displayedBizName ? `,\n*${displayedBizName}*` : '!'
      }`;
    } else if (showFullLedgerDeliveries) {
      const itemizedWhatsAppLines =
        itemizedRows.length > 0
          ? `*WATER DELIVERY DETAILS (${clubSameEntries ? 'Clubbed by Rate' : 'All Entries'}):*\n` +
            itemizedRows
              .map((r) => `• ${r.particulars}: ${r.quantity} @ ${r.rate} = ${r.amount}`)
              .join('\n') +
            '\n----------------------------------------\n'
          : '';
      return `${headerPrefix}*ACCOUNT STATEMENT*
----------------------------------------
*Date:* ${dateOnlyFormatted}
*Customer:* ${customerName}
${customerPhone ? `*Phone:* ${customerPhone}\n` : ''}${
        customerAddress ? `*Address:* ${customerAddress}\n` : ''
      }----------------------------------------
${itemizedWhatsAppLines}*Jars Currently With Customer:* ${totalHoldingCount} Jars
*Current Transaction Amount:* ₹${customerLedger.totalBilledAtPurchaseRates.toLocaleString('en-IN')}
*Payments Received:* ₹${customerLedger.totalPaymentsReceived.toLocaleString('en-IN')}
*Security Deposit:* ₹${securityDepositHeld.toLocaleString('en-IN')}
*TOTAL OUTSTANDING AMOUNT:* ₹${customerTotalOutstanding.toLocaleString('en-IN')}
----------------------------------------${upiFooter}Thank you${
        displayedBizName ? `,\n*${displayedBizName}*` : '!'
      }`;
    } else {
      const skuBreakdownText = skuHoldings.length > 0 ? formatSkuHoldingsForWhatsApp(skuHoldings) : '';
      return `${headerPrefix}*ACCOUNT STATEMENT*
----------------------------------------
*Date:* ${dateFormatted}
*Customer:* ${customerName}
${customerPhone ? `*Phone:* ${customerPhone}\n` : ''}${
        customerAddress ? `*Address:* ${customerAddress}\n` : ''
      }----------------------------------------
*Particulars:* ${delivery!.itemType || '20L Water Jar'}
*Quantity:* ${delivery!.jarsDelivered} Jars  |  *Returned:* ${delivery!.emptyJarsCollected} Jars
*Rate:* ₹${deliveryUnitRate}/Jar
*Current Transaction Amount:* ₹${deliveryGrossAmount.toLocaleString('en-IN')}
*Previous Outstanding Balance:* ₹${previousOutstandingBalance.toLocaleString('en-IN')}
*Payments Received:* ₹${deliveryPaidAmount.toLocaleString('en-IN')}
*Security Deposit:* ₹${securityDepositHeld.toLocaleString('en-IN')}
*TOTAL OUTSTANDING AMOUNT:* ₹${totalOutstandingAfterDelivery.toLocaleString('en-IN')}
${skuBreakdownText ? `\n----------------------------------------\n${skuBreakdownText}` : '\n'}----------------------------------------${upiFooter}Thank you${
        displayedBizName ? `,\n*${displayedBizName}*` : '!'
      }`;
    }
  };

  const handleSendBill = async () => {
    const billText = generateBillText();

    if (upiId && upiUrl && includeDueQrInWhatsApp) {
      const blob = await generateUpiQrCardBlob({
        upiUri: upiUrl,
        upiId,
        merchantName: displayedBizName || 'Water Supply',
        customerName,
        amount: payableAmount > 0 ? payableAmount : undefined,
        dateStr: dateOnlyFormatted
      });

      if (blob && typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          setWhatsAppStatusMsg('QR Code image copied! Paste (Ctrl+V) inside WhatsApp chat to attach QR image.');
        } catch {
          setWhatsAppStatusMsg('WhatsApp opened with Payment QR link included in message.');
        }
      } else {
        setWhatsAppStatusMsg('WhatsApp opened with Payment QR link included in message.');
      }
    }

    let cleanPhone = customerPhone.replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }

    const encodedText = encodeURIComponent(billText);
    const whatsappUrl =
      cleanPhone.length >= 10
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

  const handleShareOrDownloadQrImage = async () => {
    if (!upiUrl || !upiId) return;
    const blob = await generateUpiQrCardBlob({
      upiUri: upiUrl,
      upiId,
      merchantName: displayedBizName || 'Water Supply',
      customerName,
      amount: payableAmount > 0 ? payableAmount : undefined,
      dateStr: dateOnlyFormatted
    });
    if (!blob) return;

    const safeCustomer = (customerName || 'Customer').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20);
    const file = new File([blob], `UPI_QR_${safeCustomer}.png`, { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: `Payment QR - ${customerName}`,
          text: generateBillText(),
          files: [file]
        });
        return;
      } catch {
        // Fallback to download if user cancels native share
      }
    }

    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = `UPI_QR_${safeCustomer}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objUrl);
    setWhatsAppStatusMsg('Payment QR Card PNG downloaded — attach it directly in WhatsApp.');
  };

  const handleNativeShare = async () => {
    const text = generateBillText();
    try {
      await navigator.clipboard.writeText(text);
      setCopiedBillText(true);
      setTimeout(() => setCopiedBillText(false), 2000);
    } catch (err) {
      console.warn('Clipboard copy failed:', err);
    }
  };

  const businessInitials = (displayedBizName || 'WS')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');

  return (
    <div className="invoice-print-backdrop fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/75 backdrop-blur-xs">
      <div className="invoice-print-card relative w-full max-w-3xl bg-white rounded-xl shadow-2xl border border-slate-300 overflow-hidden my-auto max-h-[90dvh] flex flex-col">
        {/* Top Interactive Print Control Bar (Hidden in Print) */}
        <div className="no-print flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-slate-900 text-white border-b border-slate-800 shrink-0">
          <div>
            <h3 className="font-bold text-sm sm:text-base tracking-tight uppercase">{docTitle}</h3>
            <p className="text-[11px] text-slate-400">
              {customerName}
              {customerName ? ' • ' : ''}
              {dateOnlyFormatted}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Configurable Clubbing Toggle: Club Same Particulars & Rate (Default ON) vs Show Every Entry Separately */}
            {!isOrder && billableDeliveries.length > 0 && (
              <div
                className="inline-flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-[11px]"
                title="Club multiple entries with the same particulars and rate into a concise bill, or disable to show every entry separately"
              >
                <button
                  type="button"
                  onClick={() => {
                    setClubSameEntries(true);
                    if (delivery && summaryMode === 'CURRENT_ONLY') {
                      setSummaryMode('FULL_LEDGER');
                    }
                  }}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    clubSameEntries
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Club Same Rate
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setClubSameEntries(false);
                    if (delivery && summaryMode === 'CURRENT_ONLY') {
                      setSummaryMode('FULL_LEDGER');
                    }
                  }}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    !clubSameEntries
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Every Entry
                </button>
              </div>
            )}

            {/* Option to choose Financial Summary Mode while printing delivery invoices */}
            {delivery && (
              <div
                className="inline-flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-[11px]"
                title="Choose financial summary breakdown while printing"
              >
                <button
                  type="button"
                  onClick={() => setSummaryMode('FULL_LEDGER')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    summaryMode === 'FULL_LEDGER'
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Full Balance
                </button>
                <button
                  type="button"
                  onClick={() => setSummaryMode('CURRENT_ONLY')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    summaryMode === 'CURRENT_ONLY'
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Current Bill
                </button>
              </div>
            )}

            {/* Paper Size Selector */}
            <div className="inline-flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-[11px]">
              <button
                type="button"
                onClick={() => setPrintFormat('A4')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  printFormat === 'A4' ? 'bg-white text-slate-900' : 'text-slate-300 hover:text-white'
                }`}
                title="Standard A4 Portrait Layout"
              >
                A4 Sheet
              </button>
              <button
                type="button"
                onClick={() => setPrintFormat('POS')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  printFormat === 'POS' ? 'bg-white text-slate-900' : 'text-slate-300 hover:text-white'
                }`}
                title="Thermal POS Receipt Roll (80mm)"
              >
                POS 80mm
              </button>
            </div>

            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting}
              id="print-invoice-btn"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
              title="Print or Download PDF"
            >
              {printDone ? <Check className="w-3.5 h-3.5" /> : <Printer className="w-3.5 h-3.5" />}
              <span>{isPrinting ? 'Printing...' : printDone ? 'Ready' : 'Print'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              id="close-invoice-modal-btn"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Customer Invoice / Account Statement Sheet */}
        <div className="overflow-y-auto overscroll-contain modal-scroll-body flex-1 min-h-0 bg-slate-100/80 p-3 sm:p-6">
          <div
            className={`print-only-container bg-white text-slate-900 mx-auto ${
              isPosMode
                ? 'print-pos-thermal max-w-[310px] w-full p-3.5 border border-dashed border-slate-400 shadow-xs space-y-3 font-mono text-[11px]'
                : 'max-w-[210mm] w-full p-5 sm:p-7 border border-slate-200 border-t-4 border-t-sky-600 shadow-sm space-y-5 font-sans'
            }`}
          >
            {/* 1. Multi-Business Header (Dynamic Name, Optional Logo, Address, Phone) */}
            <div
              className={`invoice-header-block flex justify-between pb-4 border-b-2 border-sky-700 gap-4 ${
                isPosMode
                  ? 'flex-col items-center text-center border-dashed pb-2.5'
                  : 'flex-col sm:flex-row items-start'
              }`}
            >
              <div className={`flex items-start gap-3.5 flex-1 min-w-0 ${isPosMode ? 'flex-col items-center' : ''}`}>
                {/* Optional Business Logo or Clean Monogram Mark */}
                {displayedBizLogo && !logoLoadError ? (
                  <img
                    src={displayedBizLogo}
                    alt={displayedBizName || 'Business Logo'}
                    referrerPolicy="no-referrer"
                    onError={() => setLogoLoadError(true)}
                    className={`${
                      isPosMode ? 'w-10 h-10' : 'w-12 h-12'
                    } rounded-lg object-contain border border-slate-200 bg-white p-1 shrink-0`}
                  />
                ) : !isPosMode && displayedBizName ? (
                  <div className="invoice-brand-icon w-11 h-11 rounded-lg bg-sky-700 text-white font-extrabold text-sm flex items-center justify-center shrink-0 tracking-wider select-none">
                    {businessInitials}
                  </div>
                ) : null}

                <div className="flex-1 min-w-0">
                  <div className={`flex items-center gap-2.5 flex-wrap ${isPosMode ? 'justify-center' : ''}`}>
                    {displayedBizName && (
                      <h1
                        className={`${
                          isPosMode ? 'text-sm' : 'text-lg sm:text-xl'
                        } font-extrabold text-slate-900 uppercase tracking-tight break-words`}
                      >
                        {displayedBizName}
                      </h1>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsEditingBusiness(!isEditingBusiness)}
                      className="no-print text-[11px] text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 font-semibold px-2 py-0.5 rounded border border-sky-200 inline-flex items-center gap-1 transition-colors cursor-pointer font-sans"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>{isEditingBusiness ? 'Close Editor' : 'Edit Business Info'}</span>
                    </button>
                  </div>

                  {isEditingBusiness ? (
                    <form
                      onSubmit={handleSaveBusinessInfo}
                      className="no-print mt-3 p-3.5 bg-slate-50 rounded-lg border border-slate-300 space-y-2.5 max-w-lg text-left font-sans"
                    >
                      <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                        <Building2 className="w-3.5 h-3.5 text-sky-700" />
                        Business Profile & Logo Settings
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 uppercase block mb-0.5">
                            Business Name
                          </label>
                          <input
                            type="text"
                            value={bizNameInput}
                            onChange={(e) => setBizNameInput(e.target.value)}
                            placeholder="Enter business name"
                            className="w-full text-xs px-2.5 py-1.5 rounded border border-slate-300 bg-white focus:outline-none focus:border-sky-600"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 uppercase block mb-0.5">
                            Contact Number
                          </label>
                          <input
                            type="text"
                            value={bizPhoneInput}
                            onChange={(e) => setBizPhoneInput(e.target.value)}
                            placeholder="Enter phone number"
                            className="w-full text-xs px-2.5 py-1.5 rounded border border-slate-300 bg-white focus:outline-none focus:border-sky-600"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 uppercase block mb-0.5">
                            Business Address
                          </label>
                          <input
                            type="text"
                            value={bizAddressInput}
                            onChange={(e) => setBizAddressInput(e.target.value)}
                            placeholder="Street / Area"
                            className="w-full text-xs px-2.5 py-1.5 rounded border border-slate-300 bg-white focus:outline-none focus:border-sky-600"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 uppercase block mb-0.5">
                            City
                          </label>
                          <input
                            type="text"
                            value={bizCityInput}
                            onChange={(e) => setBizCityInput(e.target.value)}
                            placeholder="City"
                            className="w-full text-xs px-2.5 py-1.5 rounded border border-slate-300 bg-white focus:outline-none focus:border-sky-600"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 uppercase block mb-0.5">
                            Logo URL (Optional)
                          </label>
                          <input
                            type="url"
                            value={bizLogoInput}
                            onChange={(e) => setBizLogoInput(e.target.value)}
                            placeholder="https://..."
                            className="w-full text-xs px-2.5 py-1.5 rounded border border-slate-300 bg-white focus:outline-none focus:border-sky-600"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 uppercase block mb-0.5">
                            GSTIN (Optional)
                          </label>
                          <input
                            type="text"
                            value={bizGstinInput}
                            onChange={(e) => setBizGstinInput(e.target.value)}
                            placeholder="GSTIN"
                            className="w-full text-xs px-2.5 py-1.5 rounded border border-slate-300 bg-white focus:outline-none focus:border-sky-600 uppercase"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 uppercase block mb-0.5">
                            WhatsApp UPI ID
                          </label>
                          <input
                            type="text"
                            value={bizUpiInput}
                            onChange={(e) => setBizUpiInput(e.target.value)}
                            placeholder="merchant@upi"
                            className="w-full text-xs px-2.5 py-1.5 rounded border border-slate-300 bg-white font-mono focus:outline-none focus:border-sky-600"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsEditingBusiness(false)}
                          className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isSavingBiz}
                          className="px-3 py-1 text-xs bg-sky-700 hover:bg-sky-800 text-white font-semibold rounded transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {isSavingBiz ? 'Saving...' : 'Save Changes'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="mt-1 space-y-0.5 text-xs text-slate-600">
                      {displayedBizAddress && <p className="font-medium text-slate-700">{displayedBizAddress}</p>}
                      {(displayedBizPhone || displayedBizGstin) && (
                        <p className="text-[11px] text-slate-600">
                          {[
                            displayedBizPhone ? `Phone: ${displayedBizPhone}` : '',
                            displayedBizGstin ? `GSTIN: ${displayedBizGstin}` : ''
                          ]
                            .filter(Boolean)
                            .join('   |   ')}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div
                className={`${
                  isPosMode
                    ? 'w-full text-center border-t border-dashed border-slate-400 pt-2'
                    : 'text-left sm:text-right shrink-0'
                }`}
              >
                <div className="text-sm sm:text-base font-extrabold text-sky-700 uppercase tracking-wide">
                  {docTitle}
                </div>
                <div className="mt-1 text-xs text-slate-700 space-y-0.5 font-mono tabular-nums">
                  <p>
                    <span className="text-slate-500 font-sans">Date:</span>{' '}
                    <strong className="font-bold text-slate-900">{dateOnlyFormatted}</strong>
                  </p>
                  <p>
                    <span className="text-slate-500 font-sans">Time:</span>{' '}
                    <span className="text-slate-700">{timeOnlyFormatted}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* 2. Customer Details & Account/Deposit Details Grid */}
            <div
              className={`invoice-meta-grid text-xs ${
                isPosMode
                  ? 'grid grid-cols-1 gap-2 py-1 border-b border-dashed border-slate-400 pb-2.5'
                  : 'grid grid-cols-1 sm:grid-cols-2 rounded-lg border border-slate-300 overflow-hidden divide-y sm:divide-y-0 sm:divide-x divide-slate-300 bg-slate-50/40'
              }`}
            >
              <div className={isPosMode ? '' : 'p-3.5'}>
                <div
                  className={`text-[11px] font-bold uppercase tracking-wider ${
                    isPosMode
                      ? 'text-sky-800 mb-1'
                      : 'bg-sky-50/90 text-sky-900 -mx-3.5 -mt-3.5 px-3.5 py-2 mb-2.5 border-b border-slate-300'
                  }`}
                >
                  CUSTOMER DETAILS
                </div>
                {customerName && (
                  <p className="font-bold text-slate-900 text-xs sm:text-sm break-words">{customerName}</p>
                )}
                {customerPhone && (
                  <p className="text-slate-700 mt-1">
                    <span className="text-slate-500">Phone:</span>{' '}
                    <span className="font-mono font-medium text-slate-900">{customerPhone}</span>
                  </p>
                )}
                {customerAddress && (
                  <p className="text-slate-700 mt-1 break-words">
                    <span className="text-slate-500">Address:</span> {customerAddress}
                  </p>
                )}
              </div>

              <div className={isPosMode ? 'border-t border-dotted border-slate-400 pt-2' : 'p-3.5'}>
                <div
                  className={`text-[11px] font-bold uppercase tracking-wider ${
                    isPosMode
                      ? 'text-sky-800 mb-1'
                      : 'bg-sky-50/90 text-sky-900 -mx-3.5 -mt-3.5 px-3.5 py-2 mb-2.5 border-b border-slate-300'
                  }`}
                >
                  ACCOUNT DETAILS
                </div>
                <div className="space-y-1 text-slate-700">
                  <p>
                    <span className="text-slate-500">Jars Currently With Customer:</span>{' '}
                    <strong className="font-mono font-bold text-slate-900 tabular-nums">
                      {totalHoldingCount} Jars
                    </strong>
                  </p>
                  {delivery && delivery.workerName && (
                    <p>
                      <span className="text-slate-500">Delivered By:</span>{' '}
                      <strong className="text-slate-900">{delivery.workerName}</strong>
                    </p>
                  )}
                  {isOrder && order!.deliveryDate && (
                    <p>
                      <span className="text-slate-500">Scheduled Date:</span>{' '}
                      <strong className="text-slate-900">{order!.deliveryDate}</strong>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* 3. WATER DELIVERY DETAILS Section (Database-Driven Content Preserved Untouched) */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-sky-800">
                  WATER DELIVERY DETAILS
                </div>
                {showFullLedgerDeliveries && billableDeliveries.length > 1 && (
                  <label className="no-print inline-flex items-center gap-2 text-[11px] text-slate-600 bg-slate-100 hover:bg-slate-200/80 px-2.5 py-1 rounded-md border border-slate-300 cursor-pointer select-none font-sans transition-colors">
                    <input
                      type="checkbox"
                      checked={clubSameEntries}
                      onChange={(e) => setClubSameEntries(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-sky-600 focus:ring-sky-500 border-slate-300 cursor-pointer"
                    />
                    <span className="font-semibold text-slate-800">
                      Club same particulars &amp; rate
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      ({clubSameEntries ? `${billableDeliveries.length} entries → ${itemizedRows.length} concise` : `All ${billableDeliveries.length} entries separate`})
                    </span>
                  </label>
                )}
              </div>
              <div
                className={`invoice-table-wrapper overflow-x-auto ${
                  isPosMode
                    ? 'border-y border-dashed border-slate-900 rounded-none'
                    : 'rounded-lg border border-slate-300 overflow-hidden'
                }`}
              >
                <table className="invoice-table w-full text-left text-xs border-collapse">
                  <thead>
                    <tr
                      className={`${
                        isPosMode
                          ? 'border-b border-dashed border-slate-900 bg-transparent text-slate-900'
                          : 'bg-sky-700 text-white border-b border-sky-800'
                      } text-[11px] font-bold uppercase tracking-wider`}
                    >
                      {!isPosMode && (
                        <th className="py-2.5 px-2.5 text-center border-r border-sky-600/40 w-12">S.NO</th>
                      )}
                      <th className="py-2.5 px-3 border-r border-sky-600/40">PARTICULARS</th>
                      <th className="py-2.5 px-2.5 text-center border-r border-sky-600/40 w-24">QUANTITY</th>
                      <th className="py-2.5 px-2.5 text-right border-r border-sky-600/40 w-28">RATE (₹)</th>
                      <th className="py-2.5 px-3 text-right w-32">AMOUNT (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-800">
                    {itemizedRows.map((row) => (
                      <tr key={row.sno} className="even:bg-slate-50/60">
                        {!isPosMode && (
                          <td className="py-2.5 px-2.5 text-center font-mono text-slate-500 border-r border-slate-200">
                            {row.sno}
                          </td>
                        )}
                        <td className="py-2.5 px-3 border-r border-slate-200">
                          <span className="font-semibold text-slate-900 block break-words">
                            {row.particulars}
                          </span>
                        </td>
                        <td className="py-2.5 px-2.5 text-center font-mono font-bold text-slate-900 border-r border-slate-200 tabular-nums">
                          {row.quantity}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono text-slate-700 border-r border-slate-200 tabular-nums">
                          {row.rate}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                          {row.amount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 4. Structural Divider Between Itemized Table and Financial Summary */}
            <div className="invoice-section-divider border-t border-slate-300 my-1" />

            {/* 5. Financial Summary & Signatory Section */}
            <div
              className={`invoice-summary-section ${
                isPosMode
                  ? 'space-y-2.5'
                  : 'grid grid-cols-1 md:grid-cols-12 rounded-lg border border-slate-300 overflow-hidden divide-y md:divide-y-0 md:divide-x divide-slate-300'
              }`}
            >
              {/* Left Column: AMOUNT IN WORDS & Customer Acknowledgement (A4) */}
              {!isPosMode && (
                <div className="md:col-span-6 p-4 flex flex-col justify-between bg-slate-50/40 text-xs">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-800 block">
                      AMOUNT IN WORDS
                    </span>
                    <p className="font-bold text-slate-900 text-xs mt-1 border-b border-slate-200 pb-2">
                      {numberToIndianWords(primaryInvoiceAmount)}
                    </p>
                  </div>

                  <div className="pt-6 mt-4 border-t border-slate-200">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      CUSTOMER ACKNOWLEDGEMENT
                    </p>
                  </div>
                </div>
              )}

              {/* Right Column: Financial Summary Breakdown & Authorized Signatory */}
              <div className={`${isPosMode ? 'w-full' : 'md:col-span-6 flex flex-col justify-between bg-white'}`}>
                <div
                  className={`invoice-totals-box w-full text-xs ${
                    isPosMode ? 'space-y-1.5 py-1' : 'p-4 space-y-2'
                  }`}
                >
                  {domSummaryRows.map((row) =>
                    row.isProminent ? (
                      <div
                        key={row.label}
                        className="invoice-total-row border-y-2 border-sky-700 bg-sky-50/90 py-2.5 px-3 mt-2 rounded-md flex justify-between items-center font-extrabold text-sm text-slate-900 font-mono tabular-nums"
                      >
                        <span className="font-sans text-xs sm:text-sm text-sky-950">{row.label}</span>
                        <span className="text-base text-slate-950">{row.value}</span>
                      </div>
                    ) : (
                      <div key={row.label} className="flex justify-between items-center text-slate-700 py-0.5">
                        <span>{row.label}</span>
                        <span className="font-mono font-semibold text-slate-900 tabular-nums">
                          {row.value}
                        </span>
                      </div>
                    )
                  )}
                </div>

                {/* Authorized Signatory Block (A4) */}
                {!isPosMode && (
                  <div className="px-4 pb-4 pt-4 border-t border-slate-200 text-right">
                    {displayedBizName && (
                      <p className="text-[11px] font-bold text-slate-800 uppercase">
                        For {displayedBizName}
                      </p>
                    )}
                    <div className="h-5" />
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      AUTHORIZED SIGNATORY
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* POS Amount in Words & Signatory Footer */}
            {isPosMode && (
              <div className="pt-2 border-t border-dashed border-slate-400 text-center space-y-1.5 text-[10px] text-slate-700">
                <div>
                  <span className="font-bold text-slate-600 block">AMOUNT IN WORDS</span>
                  <p className="font-bold text-slate-900">{numberToIndianWords(primaryInvoiceAmount)}</p>
                </div>
                <div className="pt-2 flex justify-between text-[9px] font-bold text-slate-500 uppercase border-t border-dotted border-slate-300">
                  <span>CUSTOMER ACKNOWLEDGEMENT</span>
                  <span>AUTHORIZED SIGNATORY</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Dedicated WhatsApp Message & QR Dispatch Panel (Strictly Hidden in Print) */}
        <div className="no-print px-4 py-3 bg-slate-900 text-white border-t border-slate-800 shrink-0 space-y-2">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Payment Info Text exclusively for WhatsApp Message */}
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 block">
                WhatsApp Message Payment Info &amp; QR
              </span>

              {upiId ? (
                <label className="flex items-center gap-2 text-xs text-slate-200 mt-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeDueQrInWhatsApp}
                    onChange={(e) => setIncludeDueQrInWhatsApp(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-sky-500 focus:ring-sky-500 border-slate-600 cursor-pointer shrink-0"
                  />
                  <span className="truncate">
                    Send QR &amp; UPI (<strong className="font-mono text-white">{upiId}</strong>
                    {payableAmount > 0 ? ` • ₹${payableAmount.toLocaleString('en-IN')}` : ''}) with Message
                  </span>
                </label>
              ) : (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-amber-300">Set UPI ID to include QR in WhatsApp:</span>
                  <button
                    type="button"
                    onClick={() => setIsEditingBusiness(true)}
                    className="text-xs font-semibold text-white underline cursor-pointer"
                  >
                    Configure UPI ID
                  </button>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 shrink-0">
              {upiId && (
                <button
                  type="button"
                  onClick={handleShareOrDownloadQrImage}
                  className="px-3 py-2 text-xs font-semibold text-slate-100 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  title="Share or Download QR Image Card for WhatsApp"
                >
                  <Download className="w-3.5 h-3.5 text-sky-400" />
                  <span>QR Card</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleSendBill}
                id="send-bill-whatsapp-btn"
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Send on WhatsApp {upiId && includeDueQrInWhatsApp ? '(with QR)' : ''}</span>
              </button>
            </div>
          </div>

          {whatsAppStatusMsg && (
            <div className="text-[11px] text-emerald-300 bg-emerald-950/60 border border-emerald-800/60 rounded-lg px-3 py-1.5 flex items-center justify-between">
              <span>{whatsAppStatusMsg}</span>
              <button
                type="button"
                onClick={() => setWhatsAppStatusMsg('')}
                className="text-emerald-400 hover:text-white ml-2 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
