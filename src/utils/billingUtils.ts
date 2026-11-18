import { Customer, DeliveryLog, TransactionRecord } from '../types';

export interface DeliveryLedgerSnapshot {
  delivery: DeliveryLog;
  purchaseDateFormatted: string;
  purchaseTimeFormatted: string;
  jarsDelivered: number;
  emptyJarsCollected: number;
  /** Authoritative per-jar rate locked on the purchase date of this delivery */
  purchaseRate: number;
  /** Exact bill amount for this delivery: jarsDelivered * purchaseRate */
  billAmount: number;
  /** Amount collected at the time of this delivery */
  paidAmount: number;
  /** Unpaid portion of this single delivery: max(0, billAmount - paidAmount) */
  unpaidAmount: number;
  /** Customer's running due balance immediately prior to this delivery */
  balanceBefore: number;
  /** Customer's running due balance immediately after this delivery */
  balanceAfter: number;
}

export interface CustomerBillingLedger {
  customerId: string;
  customerName: string;
  /** Deliveries sorted newest-first for UI lists */
  deliveriesNewestFirst: DeliveryLedgerSnapshot[];
  /** Deliveries sorted oldest-first (chronological purchase order) for statements */
  deliveriesChronological: DeliveryLedgerSnapshot[];
  /** Lookup map by delivery.id */
  snapshotsById: Map<string, DeliveryLedgerSnapshot>;
  /** Standalone due-clearance transactions sorted newest-first */
  dueClearances: TransactionRecord[];
  /** All transactions for this customer sorted newest-first */
  allTransactions: TransactionRecord[];
  /** Total full jars delivered across all deliveries */
  totalJarsDelivered: number;
  /** Total empty jars returned across all deliveries */
  totalEmptyCollected: number;
  /** Sum of (jarsDelivered * purchaseRate) across all deliveries */
  totalBilledAtPurchaseRates: number;
  /** Sum of payments collected at the time of delivery */
  totalPaidAtDelivery: number;
  /** Sum of standalone DUE_CLEARANCE payments */
  totalDueClearances: number;
  /** Total of all payments received (totalPaidAtDelivery + totalDueClearances) */
  totalPaymentsReceived: number;
  /** Any opening due balance prior to recorded delivery logs */
  openingBalance: number;
  /** Authoritative net outstanding amount: max(0, openingBalance + totalBilledAtPurchaseRates - totalPaymentsReceived) */
  netOutstandingBalance: number;
  lastDeliveryTimestamp: number | null;
}

/**
 * Rounds currency values to 2 decimal places to prevent floating-point drift.
 */
export function roundCurrency(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Resolves the authoritative unit rate for a delivery as of its purchase date.
 * CRITICAL RULE: Always uses `delivery.unitPrice` saved on the delivery record at the time of purchase.
 * Never overrides a recorded purchase-date `unitPrice` with the current inventory or current customer rate.
 */
export function resolveDeliveryPurchaseRate(delivery: DeliveryLog): number {
  const recordedRate = Number(delivery.unitPrice);
  if (Number.isFinite(recordedRate) && recordedRate > 0) {
    return roundCurrency(recordedRate);
  }

  // Fallback only for legacy records where unitPrice was not persisted at creation time:
  // If money was collected for the jars delivered on that date, derive the exact rate charged on that date.
  const jars = Number(delivery.jarsDelivered) || 0;
  const collected = Number(delivery.amountCollected) || 0;
  if (jars > 0 && collected > 0) {
    return roundCurrency(collected / jars);
  }

  return 35;
}

/**
 * Calculates the gross bill amount for a single delivery using its purchase-date rate.
 */
export function calculateDeliveryBillAmount(delivery: DeliveryLog): number {
  const jars = Math.max(0, Number(delivery.jarsDelivered) || 0);
  if (jars === 0) return 0;
  const purchaseRate = resolveDeliveryPurchaseRate(delivery);
  return roundCurrency(jars * purchaseRate);
}

/**
 * Returns the actual payment collected at the time of a delivery.
 */
export function getDeliveryPaidAmount(delivery: DeliveryLog): number {
  if (delivery.paymentMode === 'CREDIT') {
    return 0;
  }
  return roundCurrency(Math.max(0, Number(delivery.amountCollected) || 0));
}

const normalizeName = (s?: string) => (s || '').trim().toLowerCase();

/**
 * Checks whether a delivery record belongs to the given customer.
 */
export function isDeliveryForCustomer(delivery: DeliveryLog, customer: Customer): boolean {
  if (delivery.customerId && delivery.customerId === customer.id) {
    return true;
  }
  if (!delivery.customerId && delivery.customerName && customer.name) {
    return normalizeName(delivery.customerName) === normalizeName(customer.name);
  }
  return false;
}

/**
 * Checks whether a transaction record belongs to the given customer.
 */
export function isTransactionForCustomer(tx: TransactionRecord, customer: Customer): boolean {
  if (tx.customerId && tx.customerId === customer.id) {
    return true;
  }
  if (!tx.customerId && tx.customerName && customer.name) {
    return normalizeName(tx.customerName) === normalizeName(customer.name);
  }
  return false;
}

/**
 * Reconstructs the complete, chronological billing ledger for a customer using the exact
 * purchase-date rate (`delivery.unitPrice`) of each delivery and all recorded payments.
 */
export function calculateCustomerBillingLedger(
  customer: Customer | null | undefined,
  deliveries: DeliveryLog[] = [],
  transactions: TransactionRecord[] = []
): CustomerBillingLedger {
  if (!customer) {
    return {
      customerId: '',
      customerName: '',
      deliveriesNewestFirst: [],
      deliveriesChronological: [],
      snapshotsById: new Map(),
      dueClearances: [],
      allTransactions: [],
      totalJarsDelivered: 0,
      totalEmptyCollected: 0,
      totalBilledAtPurchaseRates: 0,
      totalPaidAtDelivery: 0,
      totalDueClearances: 0,
      totalPaymentsReceived: 0,
      openingBalance: 0,
      netOutstandingBalance: 0,
      lastDeliveryTimestamp: null
    };
  }

  const custDeliveries = deliveries.filter((d) => isDeliveryForCustomer(d, customer));
  const custTransactions = transactions.filter((tx) => isTransactionForCustomer(tx, customer));

  // Separate standalone DUE_CLEARANCE settlements from REFILL_PAYMENT / SECURITY_DEPOSIT
  const dueClearances = custTransactions.filter((tx) => tx.type === 'DUE_CLEARANCE');

  // Sort deliveries oldest-first for accurate chronological running balance calculation
  const sortedDeliveriesAsc = [...custDeliveries].sort(
    (a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0)
  );
  const sortedClearancesAsc = [...dueClearances].sort(
    (a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0)
  );

  let totalJarsDelivered = 0;
  let totalEmptyCollected = 0;
  let totalBilledAtPurchaseRates = 0;
  let totalPaidAtDelivery = 0;
  let lastDeliveryTimestamp: number | null = null;

  for (const d of sortedDeliveriesAsc) {
    const jars = Math.max(0, Number(d.jarsDelivered) || 0);
    const empties = Math.max(0, Number(d.emptyJarsCollected) || 0);
    const bill = calculateDeliveryBillAmount(d);
    const paid = getDeliveryPaidAmount(d);

    totalJarsDelivered += jars;
    totalEmptyCollected += empties;
    totalBilledAtPurchaseRates = roundCurrency(totalBilledAtPurchaseRates + bill);
    totalPaidAtDelivery = roundCurrency(totalPaidAtDelivery + paid);

    if (!lastDeliveryTimestamp || (d.timestamp || 0) > lastDeliveryTimestamp) {
      lastDeliveryTimestamp = d.timestamp || null;
    }
  }

  const totalDueClearances = roundCurrency(
    sortedClearancesAsc.reduce((sum, tx) => sum + (Math.max(0, Number(tx.amount) || 0)), 0)
  );

  const totalPaymentsReceived = roundCurrency(totalPaidAtDelivery + totalDueClearances);

  // If the customer has delivery records, the bill is strictly derived from the sum of
  // each delivery at its purchase-date rate minus all payments received.
  // If the customer has no delivery logs loaded yet, preserve any stored dueAmount as opening balance.
  const storedDue = roundCurrency(Math.max(0, Number(customer.dueAmount) || 0));
  const openingBalance =
    sortedDeliveriesAsc.length === 0 && storedDue > 0
      ? roundCurrency(storedDue + totalDueClearances)
      : 0;

  const netOutstandingBalance = roundCurrency(
    Math.max(0, openingBalance + totalBilledAtPurchaseRates - totalPaymentsReceived)
  );

  // Replay timeline chronologically (merging deliveries and due clearances by timestamp)
  // so every delivery snapshot knows its exact `balanceBefore` and `balanceAfter`.
  type TimelineEvent =
    | { kind: 'DELIVERY'; timestamp: number; delivery: DeliveryLog }
    | { kind: 'CLEARANCE'; timestamp: number; tx: TransactionRecord };

  const events: TimelineEvent[] = [
    ...sortedDeliveriesAsc.map((d) => ({
      kind: 'DELIVERY' as const,
      timestamp: Number(d.timestamp) || 0,
      delivery: d
    })),
    ...sortedClearancesAsc.map((tx) => ({
      kind: 'CLEARANCE' as const,
      timestamp: Number(tx.timestamp) || 0,
      tx
    }))
  ].sort((a, b) => a.timestamp - b.timestamp);

  let runningBalance = openingBalance;
  const deliveriesChronological: DeliveryLedgerSnapshot[] = [];
  const snapshotsById = new Map<string, DeliveryLedgerSnapshot>();

  for (const ev of events) {
    if (ev.kind === 'CLEARANCE') {
      const amt = roundCurrency(Math.max(0, Number(ev.tx.amount) || 0));
      runningBalance = roundCurrency(Math.max(0, runningBalance - amt));
    } else {
      const d = ev.delivery;
      const jars = Math.max(0, Number(d.jarsDelivered) || 0);
      const empties = Math.max(0, Number(d.emptyJarsCollected) || 0);
      const purchaseRate = resolveDeliveryPurchaseRate(d);
      const billAmount = calculateDeliveryBillAmount(d);
      const paidAmount = getDeliveryPaidAmount(d);
      const unpaidAmount = roundCurrency(Math.max(0, billAmount - paidAmount));
      const balanceBefore = runningBalance;
      const balanceAfter = roundCurrency(Math.max(0, balanceBefore + billAmount - paidAmount));
      runningBalance = balanceAfter;

      const dt = new Date(d.timestamp || Date.now());
      const purchaseDateFormatted = dt.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
      const purchaseTimeFormatted = dt.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      const snapshot: DeliveryLedgerSnapshot = {
        delivery: d,
        purchaseDateFormatted,
        purchaseTimeFormatted,
        jarsDelivered: jars,
        emptyJarsCollected: empties,
        purchaseRate,
        billAmount,
        paidAmount,
        unpaidAmount,
        balanceBefore,
        balanceAfter
      };

      deliveriesChronological.push(snapshot);
      if (d.id) {
        snapshotsById.set(d.id, snapshot);
      }
    }
  }

  const deliveriesNewestFirst = [...deliveriesChronological].reverse();
  const sortedDueClearancesDesc = [...dueClearances].sort(
    (a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0)
  );
  const sortedAllTransactionsDesc = [...custTransactions].sort(
    (a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0)
  );

  return {
    customerId: customer.id,
    customerName: customer.name,
    deliveriesNewestFirst,
    deliveriesChronological,
    snapshotsById,
    dueClearances: sortedDueClearancesDesc,
    allTransactions: sortedAllTransactionsDesc,
    totalJarsDelivered,
    totalEmptyCollected,
    totalBilledAtPurchaseRates,
    totalPaidAtDelivery,
    totalDueClearances,
    totalPaymentsReceived,
    openingBalance,
    netOutstandingBalance,
    lastDeliveryTimestamp
  };
}
