import { DeliveryLog, TransactionRecord, BusinessAccount, Customer } from '../types';

/**
 * Sanitizes and neutralizes spreadsheet formula injection characters (=, +, -, @, \t, \r)
 */
export function sanitizeCSVField(val: unknown): string {
  if (val === null || val === undefined) return '';
  let str = String(val).trim();
  // Neutralize formula injection characters in Excel / Google Sheets
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return str;
}

/**
 * Escapes values for standard RFC 4180 CSV compliance with formula injection guard
 */
export function escapeCSV(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = sanitizeCSVField(val);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}


export type AccountingExportType = 'COMBINED' | 'DELIVERIES' | 'TRANSACTIONS';

export interface DayAccountingSummary {
  dateStr: string;
  totalDeliveriesCount: number;
  totalJarsDelivered: number;
  totalEmptiesCollected: number;
  totalTransactionsCount: number;
  totalGrossBilled: number;
  totalSettledAmount: number;
  totalCashCollected: number;
  totalUpiCollected: number;
  totalBankTransferCollected: number;
  totalCreditPending: number;
  totalDueClearances: number;
}

/**
 * Checks if a timestamp matches a target date string (YYYY-MM-DD in local time)
 */
export function isTimestampOnDate(timestamp: number, targetDateStr: string): boolean {
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const formatted = `${year}-${month}-${day}`;
  return formatted === targetDateStr;
}

/**
 * Formats a Date object to YYYY-MM-DD
 */
export function formatDateToYYYYMMDD(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Computes accounting summary statistics for a given calendar day
 */
export function computeDayAccountingSummary(
  targetDateStr: string,
  deliveries: DeliveryLog[],
  transactions: TransactionRecord[]
): DayAccountingSummary {
  const dayDeliveries = deliveries.filter(d => isTimestampOnDate(d.timestamp, targetDateStr));
  const dayTransactions = transactions.filter(t => isTimestampOnDate(t.timestamp, targetDateStr));

  let totalJarsDelivered = 0;
  let totalEmptiesCollected = 0;
  let totalGrossBilled = 0;
  let totalCashFromDeliveries = 0;
  let totalUpiFromDeliveries = 0;
  let totalCreditPending = 0;

  dayDeliveries.forEach(d => {
    const jars = Number(d.jarsDelivered) || 0;
    const empties = Number(d.emptyJarsCollected) || 0;
    const collected = Number(d.amountCollected) || 0;
    const unitPrice = Number(d.unitPrice) || 35;
    const gross = jars * unitPrice;

    totalJarsDelivered += jars;
    totalEmptiesCollected += empties;
    totalGrossBilled += gross;

    if (d.paymentMode === 'CASH') {
      totalCashFromDeliveries += collected;
    } else if (d.paymentMode === 'UPI') {
      totalUpiFromDeliveries += collected;
    } else if (d.paymentMode === 'CREDIT') {
      totalCreditPending += (gross - collected > 0 ? gross - collected : gross);
    }
  });

  let totalCashFromTx = 0;
  let totalUpiFromTx = 0;
  let totalBankTx = 0;
  let totalDueClearances = 0;

  dayTransactions.forEach(t => {
    const amt = Number(t.amount) || 0;
    if (t.paymentMode === 'CASH') totalCashFromTx += amt;
    else if (t.paymentMode === 'UPI') totalUpiFromTx += amt;
    else if (t.paymentMode === 'BANK_TRANSFER') totalBankTx += amt;

    if (t.type === 'DUE_CLEARANCE') {
      totalDueClearances += amt;
    }
  });

  // Calculate distinct settled funds:
  // If a delivery collected cash or UPI, it represents revenue on delivery.
  // Separate transactions might represent due clearances or bank transfers.
  const totalCashCollected = Math.max(totalCashFromDeliveries, totalCashFromTx);
  const totalUpiCollected = Math.max(totalUpiFromDeliveries, totalUpiFromTx);
  const totalBankTransferCollected = totalBankTx;
  const totalSettledAmount = totalCashCollected + totalUpiCollected + totalBankTransferCollected;

  return {
    dateStr: targetDateStr,
    totalDeliveriesCount: dayDeliveries.length,
    totalJarsDelivered,
    totalEmptiesCollected,
    totalTransactionsCount: dayTransactions.length,
    totalGrossBilled,
    totalSettledAmount,
    totalCashCollected,
    totalUpiCollected,
    totalBankTransferCollected,
    totalCreditPending,
    totalDueClearances
  };
}

/**
 * Builds the Unified Accounting Day Book CSV
 * Formatted with Debit/Credit columns and ledger accounts for Tally, QuickBooks, Excel & CA auditing
 */
export function generateUnifiedDayBookCSV(
  targetDateStr: string,
  deliveries: DeliveryLog[],
  transactions: TransactionRecord[],
  business?: BusinessAccount,
  customersMap?: Map<string, Customer>,
  includeHeaderSummary: boolean = true
): string {
  const dayDeliveries = deliveries.filter(d => isTimestampOnDate(d.timestamp, targetDateStr));
  const dayTransactions = transactions.filter(t => isTimestampOnDate(t.timestamp, targetDateStr));
  const summary = computeDayAccountingSummary(targetDateStr, deliveries, transactions);

  const lines: string[] = [];

  // 1. Accounting Header Block (Optional but highly recommended for bookkeepers)
  if (includeHeaderSummary) {
    lines.push(`# =========================================================================`);
    lines.push(`# DAILY ACCOUNTING DAY BOOK & AUDIT LOG - ${escapeCSV(business?.name)}`);
    lines.push(`# Account Date: ${targetDateStr} | Exported: ${new Date().toLocaleString('en-IN')}`);
    lines.push(`# Business GSTIN: ${business?.gstin ? business.gstin : 'UNREGISTERED / COMPOSITION'} | Phone: ${business?.ownerPhone || 'N/A'}`);
    lines.push(`# Total Dispatches: ${summary.totalDeliveriesCount} trips | Jars Delivered: ${summary.totalJarsDelivered} | Empties Collected: ${summary.totalEmptiesCollected}`);
    lines.push(`# Total Revenue Settled: INR ${summary.totalSettledAmount.toFixed(2)} (Cash: INR ${summary.totalCashCollected.toFixed(2)} | UPI: INR ${summary.totalUpiCollected.toFixed(2)} | Bank: INR ${summary.totalBankTransferCollected.toFixed(2)})`);
    lines.push(`# Outstanding Credit Added: INR ${summary.totalCreditPending.toFixed(2)} | Due Recoveries: INR ${summary.totalDueClearances.toFixed(2)}`);
    lines.push(`# =========================================================================`);
  }

  // 2. CSV Column Headers
  const headers = [
    'Voucher_No',
    'Voucher_Date',
    'Voucher_Time',
    'Voucher_Type',
    'Party_Customer_Name',
    'Customer_Phone',
    'Customer_Address',
    'Route',
    'Staff_Driver',
    'Particulars_Item_Description',
    'Qty_Delivered',
    'Empties_Returned',
    'Net_Bottle_Variance',
    'Unit_Rate_INR',
    'Gross_Bill_INR',
    'Debit_Amount_INR',
    'Credit_Amount_INR',
    'Debit_Ledger_Account',
    'Credit_Ledger_Account',
    'Payment_Mode',
    'Accounting_Status',
    'Audit_Narration'
  ];
  lines.push(headers.map(escapeCSV).join(','));

  // 3. Row data: Deliveries entries
  dayDeliveries.forEach((d, idx) => {
    const dateObj = new Date(d.timestamp);
    const timeStr = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const cust = customersMap?.get(d.customerId);
    const phone = d.customerPhone || cust?.phone || '';
    const address = d.customerAddress || cust?.address || '';
    const route = cust?.route || 'Main Route';
    const jars = Number(d.jarsDelivered) || 0;
    const empties = Number(d.emptyJarsCollected) || 0;
    const netBottleVariance = jars - empties;
    const unitRate = Number(d.unitPrice) || 35;
    const grossBill = jars * unitRate;
    const amountCollected = Number(d.amountCollected) || 0;
    const pendingCredit = Math.max(0, grossBill - amountCollected);

    const voucherNo = d.id.startsWith('DEL-') ? d.id : `DEL-${targetDateStr.replace(/-/g, '')}-${String(idx + 1).padStart(3, '0')}`;
    const voucherType = d.paymentMode === 'CREDIT' 
      ? 'CREDIT_SALES_VOUCHER' 
      : (d.paymentMode === 'UPI' ? 'UPI_DELIVERY_RECEIPT' : 'CASH_DELIVERY_RECEIPT');

    const debitLedger = d.paymentMode === 'CASH'
      ? 'Cash-in-Hand A/c'
      : d.paymentMode === 'UPI'
      ? 'Bank / UPI Clearing A/c'
      : `Sundry Debtors (${d.customerName})`;

    const creditLedger = 'Water Refill Sales Revenue A/c';

    const narration = `Delivery of ${jars} jars (${d.itemType || '20L Normal Water Jar'}) by driver ${d.workerName || 'Staff'}. Empties returned: ${empties}. ${
      d.paymentMode === 'CREDIT' 
        ? `Added to pending customer account balance (INR ${grossBill.toFixed(2)})`
        : `Collected INR ${amountCollected.toFixed(2)} via ${d.paymentMode}`
    }`;

    const row = [
      voucherNo,
      targetDateStr,
      timeStr,
      voucherType,
      d.customerName || 'Walk-in Customer',
      phone,
      address,
      route,
      d.workerName || 'Staff Driver',
      d.itemType || '20L Normal Water Jar',
      jars,
      empties,
      netBottleVariance,
      unitRate.toFixed(2),
      grossBill.toFixed(2),
      (amountCollected > 0 ? amountCollected : grossBill).toFixed(2), // Debit to Asset or Debtor
      grossBill.toFixed(2), // Credit to Sales
      debitLedger,
      creditLedger,
      d.paymentMode,
      d.paymentMode === 'CREDIT' ? 'RECEIVABLE_OPEN' : 'SETTLED_PAID',
      narration
    ];

    lines.push(row.map(escapeCSV).join(','));
  });

  // 4. Row data: Standalone Transactions / Due Clearances / Non-delivery Settlements
  dayTransactions.forEach((t, idx) => {
    // Only add if not already redundant with a delivery payment (e.g. Due Clearances or direct payments)
    const dateObj = new Date(t.timestamp);
    const timeStr = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const cust = customersMap?.get(t.customerId);
    const custName = t.customerName || cust?.name || 'Direct Client';
    const amount = Number(t.amount) || 0;

    const voucherNo = t.id.startsWith('TX-') ? t.id : `TX-${targetDateStr.replace(/-/g, '')}-${String(idx + 1).padStart(3, '0')}`;
    const voucherType = t.type === 'DUE_CLEARANCE' 
      ? 'DUE_CLEARANCE_RECEIPT' 
      : (t.type === 'SECURITY_DEPOSIT' ? 'DEPOSIT_RECEIPT' : 'GENERAL_RECEIPT');

    const debitLedger = t.paymentMode === 'CASH'
      ? 'Cash-in-Hand A/c'
      : t.paymentMode === 'BANK_TRANSFER'
      ? 'Bank Current Account (NEFT/RTGS)'
      : 'Bank / UPI Clearing A/c';

    const creditLedger = t.type === 'SECURITY_DEPOSIT'
      ? `Customer Security Deposit Liability A/c (${custName})`
      : `Sundry Debtors Outstanding A/c (${custName})`;

    const narration = t.notes || (
      t.type === 'DUE_CLEARANCE'
        ? `Settlement of outstanding customer balance via ${t.paymentMode}`
        : `Refill / deposit collection from ${custName}`
    );

    const row = [
      voucherNo,
      targetDateStr,
      timeStr,
      voucherType,
      custName,
      cust?.phone || '',
      cust?.address || '',
      cust?.route || 'Direct',
      'Finance / Admin Desk',
      t.type.replace(/_/g, ' '),
      0, // Qty
      0, // Empties
      0, // Variance
      '0.00',
      amount.toFixed(2),
      amount.toFixed(2),
      amount.toFixed(2),
      debitLedger,
      creditLedger,
      t.paymentMode,
      'SETTLED_PAID',
      narration
    ];

    lines.push(row.map(escapeCSV).join(','));
  });

  return lines.join('\r\n');
}

/**
 * Builds the Deliveries Dispatch Log CSV
 */
export function generateDeliveriesCSV(
  targetDateStr: string,
  deliveries: DeliveryLog[],
  business?: BusinessAccount,
  customersMap?: Map<string, Customer>,
  includeHeaderSummary: boolean = true
): string {
  const dayDeliveries = deliveries.filter(d => isTimestampOnDate(d.timestamp, targetDateStr));
  const summary = computeDayAccountingSummary(targetDateStr, deliveries, []);

  const lines: string[] = [];

  if (includeHeaderSummary) {
    lines.push(`# =========================================================================`);
    lines.push(`# DAILY DISPATCH & DELIVERY REGISTER - ${escapeCSV(business?.name)}`);
    lines.push(`# Log Date: ${targetDateStr} | Total Drops: ${dayDeliveries.length} | Jars: ${summary.totalJarsDelivered} | Empties: ${summary.totalEmptiesCollected}`);
    lines.push(`# =========================================================================`);
  }

  const headers = [
    'Delivery_ID',
    'Date',
    'Time',
    'Customer_Name',
    'Phone_Number',
    'Delivery_Address',
    'Assigned_Driver',
    'Product_Item',
    'Jars_Delivered',
    'Empty_Jars_Collected',
    'Net_Bottle_Balance',
    'Unit_Price_INR',
    'Total_Amount_INR',
    'Amount_Collected_INR',
    'Pending_Due_INR',
    'Payment_Mode',
    'Receipt_Status'
  ];
  lines.push(headers.map(escapeCSV).join(','));

  dayDeliveries.forEach(d => {
    const dateObj = new Date(d.timestamp);
    const timeStr = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const cust = customersMap?.get(d.customerId);
    const jars = Number(d.jarsDelivered) || 0;
    const empties = Number(d.emptyJarsCollected) || 0;
    const unitPrice = Number(d.unitPrice) || 35;
    const totalAmount = jars * unitPrice;
    const amountCollected = Number(d.amountCollected) || 0;
    const pendingDue = Math.max(0, totalAmount - amountCollected);

    const row = [
      d.id,
      targetDateStr,
      timeStr,
      d.customerName || 'Walk-in',
      d.customerPhone || cust?.phone || '',
      d.customerAddress || cust?.address || '',
      d.workerName || 'Staff',
      d.itemType || '20L Normal Water Jar',
      jars,
      empties,
      jars - empties,
      unitPrice.toFixed(2),
      totalAmount.toFixed(2),
      amountCollected.toFixed(2),
      pendingDue.toFixed(2),
      d.paymentMode,
      d.paymentMode === 'CREDIT' ? 'UNPAID_CREDIT' : 'PAID_IN_FULL'
    ];

    lines.push(row.map(escapeCSV).join(','));
  });

  return lines.join('\r\n');
}

/**
 * Builds the Transactions Cash & Bank Receipts CSV
 */
export function generateTransactionsCSV(
  targetDateStr: string,
  transactions: TransactionRecord[],
  business?: BusinessAccount,
  customersMap?: Map<string, Customer>,
  includeHeaderSummary: boolean = true
): string {
  const dayTransactions = transactions.filter(t => isTimestampOnDate(t.timestamp, targetDateStr));
  const totalAmount = dayTransactions.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

  const lines: string[] = [];

  if (includeHeaderSummary) {
    lines.push(`# =========================================================================`);
    lines.push(`# CASH & BANK RECEIPTS REGISTER - ${escapeCSV(business?.name)}`);
    lines.push(`# Log Date: ${targetDateStr} | Total Transactions: ${dayTransactions.length} | Gross Amount: INR ${totalAmount.toFixed(2)}`);
    lines.push(`# =========================================================================`);
  }

  const headers = [
    'Transaction_ID',
    'Date',
    'Time',
    'Customer_Name',
    'Phone_Number',
    'Transaction_Type',
    'Amount_Settled_INR',
    'Payment_Mode',
    'Deposit_Ledger',
    'Notes_Narration'
  ];
  lines.push(headers.map(escapeCSV).join(','));

  dayTransactions.forEach(t => {
    const dateObj = new Date(t.timestamp);
    const timeStr = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const cust = customersMap?.get(t.customerId);
    const amount = Number(t.amount) || 0;

    const row = [
      t.id,
      targetDateStr,
      timeStr,
      t.customerName || cust?.name || 'Client',
      cust?.phone || '',
      t.type.replace(/_/g, ' '),
      amount.toFixed(2),
      t.paymentMode,
      t.paymentMode === 'CASH' ? 'Cash Box' : (t.paymentMode === 'UPI' ? 'UPI Bank' : 'Bank NEFT/RTGS'),
      t.notes || `Settlement of ${t.type.toLowerCase().replace(/_/g, ' ')}`
    ];

    lines.push(row.map(escapeCSV).join(','));
  });

  return lines.join('\r\n');
}

/**
 * Initiates browser download of a CSV file with BOM for UTF-8 Excel support
 */
export function downloadCSV(content: string, filename: string): void {
  // Prepend UTF-8 BOM so Excel opens it with proper encoding and symbols (₹ etc.)
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Copies the CSV text content to the user's clipboard
 */
export async function copyCSVToClipboard(content: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(content);
      return true;
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = content;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    }
  } catch (err) {
    console.error('Failed to copy CSV:', err);
    return false;
  }
}

/**
 * Builds clean Tab-Separated Values (TSV) specifically formatted for 1-click paste into Google Sheets
 */
export function generateGoogleSheetsTSV(
  targetDateStr: string,
  deliveries: DeliveryLog[],
  transactions: TransactionRecord[],
  business?: BusinessAccount,
  customersMap?: Map<string, Customer>
): string {
  const dayDeliveries = deliveries.filter(d => isTimestampOnDate(d.timestamp, targetDateStr));
  const dayTransactions = transactions.filter(t => isTimestampOnDate(t.timestamp, targetDateStr));

  const lines: string[] = [];

  const headers = [
    'Voucher No',
    'Date',
    'Time',
    'Voucher Type',
    'Customer / Party',
    'Phone',
    'Address',
    'Route',
    'Staff / Driver',
    'Description',
    'Qty Delivered',
    'Empties Returned',
    'Net Bottle Variance',
    'Unit Rate (INR)',
    'Gross Bill (INR)',
    'Amount Settled (INR)',
    'Payment Mode',
    'Debit Ledger Account',
    'Credit Ledger Account',
    'Status',
    'Audit Narration'
  ];

  lines.push(headers.join('\t'));

  // Add delivery rows
  dayDeliveries.forEach((d, idx) => {
    const dateObj = new Date(d.timestamp);
    const timeStr = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const cust = customersMap?.get(d.customerId);
    const phone = d.customerPhone || cust?.phone || '';
    const address = d.customerAddress || cust?.address || '';
    const route = cust?.route || 'Main Route';
    const jars = Number(d.jarsDelivered) || 0;
    const empties = Number(d.emptyJarsCollected) || 0;
    const netBottleVariance = jars - empties;
    const unitRate = Number(d.unitPrice) || 35;
    const grossBill = jars * unitRate;
    const amountCollected = Number(d.amountCollected) || 0;

    const voucherNo = d.id.startsWith('DEL-') ? d.id : `DEL-${targetDateStr.replace(/-/g, '')}-${String(idx + 1).padStart(3, '0')}`;
    const voucherType = d.paymentMode === 'CREDIT' ? 'Credit Dispatch' : `${d.paymentMode} Receipt`;
    const debitLedger = d.paymentMode === 'CASH' ? 'Cash Box' : d.paymentMode === 'UPI' ? 'UPI Bank' : `Debtor (${d.customerName})`;
    const creditLedger = 'Water Sales Revenue';

    const row = [
      voucherNo,
      targetDateStr,
      timeStr,
      voucherType,
      d.customerName || 'Walk-in Customer',
      phone,
      address,
      route,
      d.workerName || 'Staff Driver',
      d.itemType || '20L Normal Water Jar',
      jars,
      empties,
      netBottleVariance,
      unitRate,
      grossBill,
      amountCollected,
      d.paymentMode,
      debitLedger,
      creditLedger,
      d.paymentMode === 'CREDIT' ? 'RECEIVABLE_OPEN' : 'SETTLED_PAID',
      `Delivery of ${jars} jars to ${d.customerName}. Empties: ${empties}`
    ];

    lines.push(row.map(val => String(val ?? '').replace(/\t/g, ' ').replace(/\r?\n/g, ' ')).join('\t'));
  });

  // Add transaction rows
  dayTransactions.forEach((t, idx) => {
    const dateObj = new Date(t.timestamp);
    const timeStr = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const cust = customersMap?.get(t.customerId);
    const phone = cust?.phone || '';
    const address = cust?.address || '';
    const route = cust?.route || 'Main Route';
    const amount = Number(t.amount) || 0;

    const voucherNo = t.id.startsWith('TX-') ? t.id : `TX-${targetDateStr.replace(/-/g, '')}-${String(idx + 1).padStart(3, '0')}`;
    const voucherType = t.type === 'DUE_CLEARANCE' ? 'Due Recovery Receipt' : 'Deposit Receipt';
    const debitLedger = t.paymentMode === 'CASH' ? 'Cash Box' : t.paymentMode === 'UPI' ? 'UPI Bank' : 'Bank Account';
    const creditLedger = t.type === 'SECURITY_DEPOSIT' ? 'Customer Security Deposit A/c' : `Sundry Debtors (${t.customerName})`;

    const row = [
      voucherNo,
      targetDateStr,
      timeStr,
      voucherType,
      t.customerName || cust?.name || 'Customer Settlement',
      phone,
      address,
      route,
      'Cashier / Office',
      t.type.replace(/_/g, ' '),
      0,
      0,
      0,
      0,
      amount,
      amount,
      t.paymentMode,
      debitLedger,
      creditLedger,
      'SETTLED_PAID',
      t.notes || `Settlement of ${t.type.toLowerCase().replace(/_/g, ' ')}`
    ];

    lines.push(row.map(val => String(val ?? '').replace(/\t/g, ' ').replace(/\r?\n/g, ' ')).join('\t'));
  });

  return lines.join('\r\n');
}

