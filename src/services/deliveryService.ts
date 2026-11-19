import { db, handleFirestoreError, OperationType, auth } from '../config/firebase';
import { 
  doc, 
  runTransaction, 
  setDoc, 
  getDocs, 
  collection,
  deleteDoc
} from 'firebase/firestore';
import { Customer, OrderBooking, InventoryItem, TransactionRecord } from '../types';
import { 
  addCustomerLocal, 
  updateCustomerLocal,
  deleteCustomerLocal,
  recordDeliveryLocal, 
  restockInventoryLocal, 
  updateInventoryItemLocal,
  addInventoryItemLocal,
  deleteInventoryItemLocal,
  recordDueSettlementLocal,
  createOrderLocal,
  updateOrderLocal,
  recordOrderTransactionLocal,
  deleteOrderLocal,
  getLocalStore,
  saveLocalStore,
  DEFAULT_INITIAL_CUSTOMERS,
  DEFAULT_INITIAL_INVENTORY,
  DEFAULT_INITIAL_DELIVERIES,
  DEFAULT_INITIAL_TRANSACTIONS,
  DEFAULT_INITIAL_ORDERS
} from './localStore';
import { triggerBackgroundBackup } from './googleSheetsService';

export interface DeliveryRecordInput {
  businessId: string;
  customerId: string;
  customerName: string;
  workerName: string;
  jarsDelivered: number;
  emptyJarsCollected: number;
  amountCollected: number;
  paymentMode: 'CASH' | 'UPI' | 'CREDIT';
  itemType?: string;
  unitPrice?: number;
}

/**
 * Atomic Delivery & Stock Synchronization Service
 * Concurrently updates Customer Jar Ledger, Warehouse Inventory,
 * creates Delivery Log, and records financial Transaction.
 * Updates local store immediately for zero-lag UI responsiveness,
 * and synchronizes with Firestore cloud database.
 */
export async function processDeliveryAtomic(input: DeliveryRecordInput): Promise<string> {
  // 1. Immediately apply to local store with businessId
  const { deliveryId } = recordDeliveryLocal({
    customerId: input.customerId,
    customerName: input.customerName,
    workerName: input.workerName || 'Staff Driver',
    jarsDelivered: input.jarsDelivered,
    emptyJarsCollected: input.emptyJarsCollected,
    amountCollected: input.amountCollected,
    paymentMode: input.paymentMode,
    itemType: input.itemType || '20L Normal Water Jar',
    unitPrice: input.unitPrice
  }, input.businessId);

  // 2. Optimistically sync to Firestore
  const itemType = input.itemType || '20L Normal Water Jar';
  const txId = crypto.randomUUID();
  const timestamp = Date.now();

  const customerRef = doc(db, `businesses/${input.businessId}/customers`, input.customerId);
  const inventoryRef = doc(db, `businesses/${input.businessId}/inventory`, itemType);
  const deliveryRef = doc(db, `businesses/${input.businessId}/deliveries`, deliveryId);
  const transactionRef = doc(db, `businesses/${input.businessId}/transactions`, txId);

  try {
    await runTransaction(db, async (txn) => {
      const custSnap = await txn.get(customerRef);
      const invSnap = await txn.get(inventoryRef);

      const custData = custSnap.exists() ? custSnap.data() : null;
      const invData = invSnap.exists() 
        ? invSnap.data() 
        : { availableStock: 120, borrowedStock: 380, unitPrice: 35.0, displayName: itemType };

      const custCustomRate = custData ? Number(custData.customJarRate) || 0 : 0;
      const unitPrice = input.unitPrice && input.unitPrice > 0
        ? Number(input.unitPrice)
        : custCustomRate > 0
        ? custCustomRate
        : (Number(invData.unitPrice) || 35.0);
      const orderCost = Math.round((input.jarsDelivered * unitPrice + Number.EPSILON) * 100) / 100;
      const effectivePaid = input.paymentMode === 'CREDIT' ? 0 : Math.max(0, Number(input.amountCollected) || 0);

      if (custData) {
        const currentJarsHolding = Number(custData.jarsHolding) || 0;
        const currentDue = Number(custData.dueAmount) || 0;
        const curSkuMap = { ...(custData.jarsHoldingBySku || {}) };
        const curItemCount = Number(curSkuMap[itemType]) || 0;
        const newItemCount = Math.max(0, curItemCount + input.jarsDelivered - input.emptyJarsCollected);
        curSkuMap[itemType] = newItemCount;

        const totalSkuSum = Object.values(curSkuMap).reduce((sum: number, val: any) => sum + (Number(val) || 0), 0);
        const newJarsHolding = totalSkuSum > 0 ? totalSkuSum : Math.max(0, currentJarsHolding + input.jarsDelivered - input.emptyJarsCollected);
        const newDueAmount = Math.round((Math.max(0, currentDue + orderCost - effectivePaid) + Number.EPSILON) * 100) / 100;

        txn.update(customerRef, {
          jarsHolding: newJarsHolding,
          jarsHoldingBySku: curSkuMap,
          dueAmount: newDueAmount
        });
      }

      const currentAvailable = Number(invData.availableStock) || 0;
      const currentBorrowed = Number(invData.borrowedStock) || 0;
      const newAvailable = currentAvailable - input.jarsDelivered + input.emptyJarsCollected;
      const newBorrowed = currentBorrowed + input.jarsDelivered - input.emptyJarsCollected;

      if (invSnap.exists()) {
        txn.update(inventoryRef, {
          availableStock: Math.max(0, newAvailable),
          borrowedStock: Math.max(0, newBorrowed),
          lastUpdated: timestamp
        });
      } else {
        txn.set(inventoryRef, {
          itemType,
          displayName: itemType,
          availableStock: Math.max(0, newAvailable),
          borrowedStock: Math.max(0, newBorrowed),
          totalCapacity: Math.max(0, newAvailable) + Math.max(0, newBorrowed),
          unitPrice: 35.0,
          depositAmount: 150.0,
          lastUpdated: timestamp
        });
      }

      txn.set(deliveryRef, {
        id: deliveryId,
        customerId: input.customerId,
        customerName: input.customerName,
        workerName: input.workerName || 'Staff Driver',
        jarsDelivered: input.jarsDelivered,
        emptyJarsCollected: input.emptyJarsCollected,
        amountCollected: effectivePaid,
        paymentMode: input.paymentMode,
        itemType,
        unitPrice,
        timestamp
      });

      if (effectivePaid > 0 && input.paymentMode !== 'CREDIT') {
        txn.set(transactionRef, {
          id: txId,
          customerId: input.customerId,
          customerName: input.customerName,
          type: 'REFILL_PAYMENT',
          amount: effectivePaid,
          paymentMode: input.paymentMode,
          timestamp
        });
      }
    });
  } catch (error) {
    console.warn("Firestore cloud sync note (saved locally):", error);
    if (auth.currentUser) {
      try {
        handleFirestoreError(error, OperationType.WRITE, `businesses/${input.businessId}/deliveries/${deliveryId}`);
      } catch {}
    }
  }

  // Non-blocking trigger for Google Sheets live cloud backup
  triggerBackgroundBackup(input.businessId, 'DELIVERY', {
    id: deliveryId,
    customerName: input.customerName,
    jarsDelivered: input.jarsDelivered,
    emptyJarsCollected: input.emptyJarsCollected,
    paymentMode: input.paymentMode,
    amount: input.amountCollected,
    workerName: input.workerName,
    timestamp
  });

  return deliveryId;
}

/**
 * Restock warehouse with fresh filled bottles from factory
 */
export async function restockInventory(
  businessId: string, 
  itemType: string, 
  quantity: number,
  unitPrice?: number
): Promise<void> {
  // 1. Immediately apply locally with businessId and optional unitPrice
  restockInventoryLocal(itemType, quantity, businessId, unitPrice);

  // 2. Sync with Firestore
  const inventoryRef = doc(db, `businesses/${businessId}/inventory`, itemType);
  try {
    await runTransaction(db, async (txn) => {
      const invSnap = await txn.get(inventoryRef);
      const now = Date.now();

      if (invSnap.exists()) {
        const data = invSnap.data();
        const currentAvailable = Number(data.availableStock) || 0;
        const totalCapacity = Number(data.totalCapacity) || (currentAvailable + (Number(data.borrowedStock) || 0));
        const updates: Record<string, any> = {
          availableStock: currentAvailable + quantity,
          totalCapacity: Math.max(totalCapacity, currentAvailable + quantity + (Number(data.borrowedStock) || 0)),
          lastUpdated: now
        };
        if (unitPrice !== undefined && unitPrice > 0) {
          updates.unitPrice = Number(unitPrice);
        }
        txn.update(inventoryRef, updates);
      } else {
        txn.set(inventoryRef, {
          itemType,
          displayName: itemType,
          availableStock: quantity,
          borrowedStock: 0,
          totalCapacity: quantity,
          unitPrice: (unitPrice !== undefined && unitPrice > 0) ? Number(unitPrice) : 35.0,
          depositAmount: 150.0,
          lastUpdated: now
        });
      }
    });
  } catch (error) {
    console.warn("Firestore cloud restock note (saved locally):", error);
    if (auth.currentUser) {
      try {
        handleFirestoreError(error, OperationType.WRITE, `businesses/${businessId}/inventory/${itemType}`);
      } catch {}
    }
  }
}

/**
 * Create a new customer in local storage and Firestore
 */
export async function createCustomer(
  businessId: string, 
  customerData: Omit<Customer, 'id' | 'createdAt'>
): Promise<Customer> {
  // 1. Save immediately to local store under the active businessId
  const localCust = addCustomerLocal(customerData, businessId);
  const customerId = localCust.id;

  // 2. Sync to Firestore with a fast timeout so preview mode is never delayed
  const path = `businesses/${businessId}/customers/${customerId}`;
  const customerRef = doc(db, `businesses/${businessId}/customers`, customerId);
  const payload: Customer = {
    ...customerData,
    id: customerId,
    createdAt: localCust.createdAt
  };

  try {
    await Promise.race([
      setDoc(customerRef, payload),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore sync timeout')), 2500))
    ]);
  } catch (error) {
    console.warn("Firestore cloud customer note (saved locally):", error);
  }

  return localCust;
}

/**
 * Update an existing customer in local storage and Firestore
 */
export async function updateCustomer(
  businessId: string,
  customerId: string,
  updates: Partial<Omit<Customer, 'id' | 'createdAt'>>
): Promise<Customer | null> {
  // 1. Update immediately in local store for instantaneous UI feedback
  const updated = updateCustomerLocal(customerId, updates, businessId);
  if (!updated) return null;

  // 2. Sync updated record to Firestore
  const customerRef = doc(db, `businesses/${businessId}/customers`, customerId);
  try {
    await Promise.race([
      setDoc(customerRef, updated, { merge: true }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore customer update timeout')), 2500))
    ]);
  } catch (error) {
    console.warn("Firestore cloud customer update note (updated locally):", error);
  }

  return updated;
}

/**
 * Delete a customer record from local store and Firestore
 * Allowed for both Owner and Worker roles
 */
export async function deleteCustomer(
  businessId: string,
  customerId: string
): Promise<void> {
  // 1. Delete locally immediately for instant UI update
  deleteCustomerLocal(customerId, businessId);

  // 2. Sync deletion to Firestore
  const customerRef = doc(db, `businesses/${businessId}/customers`, customerId);
  try {
    await Promise.race([
      deleteDoc(customerRef),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore customer delete timeout')), 2500))
    ]);
  } catch (error) {
    console.warn("Firestore cloud customer delete note (deleted locally):", error);
  }
}

/**
 * Settle outstanding dues
 */
export async function recordDueSettlement(
  businessId: string,
  customerId: string,
  customerName: string,
  amount: number,
  paymentMode: 'CASH' | 'UPI' | 'BANK_TRANSFER'
): Promise<void> {
  // 1. Immediately settle locally
  recordDueSettlementLocal(customerId, customerName, amount, paymentMode, businessId);

  // 2. Sync to Firestore
  const customerRef = doc(db, `businesses/${businessId}/customers`, customerId);
  const txId = crypto.randomUUID();
  const transactionRef = doc(db, `businesses/${businessId}/transactions`, txId);

  try {
    await runTransaction(db, async (txn) => {
      const snap = await txn.get(customerRef);
      if (snap.exists()) {
        const curDue = Number(snap.data().dueAmount) || 0;
        const newDue = Math.max(0, curDue - amount);

        txn.update(customerRef, {
          dueAmount: newDue
        });
      }

      txn.set(transactionRef, {
        id: txId,
        customerId,
        customerName,
        type: 'DUE_CLEARANCE',
        amount,
        paymentMode,
        timestamp: Date.now()
      });
    });
  } catch (error) {
    console.warn("Firestore cloud settlement note (saved locally):", error);
    if (auth.currentUser) {
      try {
        handleFirestoreError(error, OperationType.WRITE, `businesses/${businessId}/transactions/${txId}`);
      } catch {}
    }
  }

  // Non-blocking trigger for Google Sheets live cloud backup
  triggerBackgroundBackup(businessId, 'TRANSACTION', {
    id: txId,
    customerName,
    paymentMode,
    amount,
    timestamp: Date.now()
  });
}

/**
 * Helper to seed initial sample data if the business collections are completely fresh
 */
export async function seedInitialDataIfEmpty(businessId: string): Promise<boolean> {
  // Ensure local storage has basic inventory items
  const store = getLocalStore(businessId);
  if (!store.inventory || store.inventory.length === 0) {
    store.inventory = DEFAULT_INITIAL_INVENTORY;
    saveLocalStore(store, businessId);
  }

  try {
    const invCol = collection(db, `businesses/${businessId}/inventory`);
    const invSnap = await getDocs(invCol);
    if (!invSnap.empty) {
      return false; // Already populated in cloud
    }

    // Initialize Inventory Catalog with 0 stock
    for (const item of DEFAULT_INITIAL_INVENTORY) {
      await setDoc(doc(db, `businesses/${businessId}/inventory`, item.itemType), {
        itemType: item.itemType,
        displayName: item.displayName,
        availableStock: item.availableStock,
        borrowedStock: item.borrowedStock,
        totalCapacity: item.totalCapacity || 0,
        unitPrice: item.unitPrice,
        depositAmount: item.depositAmount || 150,
        lastUpdated: Date.now()
      });
    }

    return true;
  } catch (error) {
    console.warn("Initializing cloud store notice: operating with local data store.", error);
    return true;
  }
}

/**
 * Create or save an event/function cooler or bulk jar order booking
 * Supports both Owner and Worker roles and records initial payment transactions if paid on creation.
 */
export async function saveOrderBooking(
  businessId: string,
  orderData: Omit<OrderBooking, 'id' | 'bookingDate'>
): Promise<OrderBooking> {
  const normalizedData: Omit<OrderBooking, 'id' | 'bookingDate'> = {
    ...orderData,
    amountPaid:
      orderData.amountPaid !== undefined
        ? orderData.amountPaid
        : orderData.paymentStatus === 'PAID'
        ? orderData.totalAmount
        : 0,
    ...(orderData.status === 'DELIVERED' && !orderData.deliveredAt
      ? { deliveredAt: Date.now() }
      : {}),
  };

  const newOrder = createOrderLocal(normalizedData, businessId);
  try {
    await Promise.race([
      setDoc(doc(db, `businesses/${businessId}/orders`, newOrder.id), newOrder),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore order sync timeout')), 2500))
    ]);
  } catch (err) {
    console.warn("Could not sync order to cloud (saved locally):", err);
  }

  const paidAmount = Number(newOrder.amountPaid) || 0;
  if (paidAmount > 0) {
    const mode = newOrder.paymentMode || 'CASH';
    const txId = recordOrderTransactionLocal(
      newOrder,
      paidAmount,
      mode,
      businessId,
      newOrder.collectedBy || newOrder.createdBy || newOrder.assignedDriver
    );
    const txRecord: TransactionRecord = {
      id: txId,
      customerId: newOrder.customerId || newOrder.id,
      customerName: newOrder.customerName,
      type: 'REFILL_PAYMENT',
      amount: paidAmount,
      paymentMode: mode,
      timestamp: Date.now(),
      notes: `Bulk/Event Order #${newOrder.id.toUpperCase()} (${newOrder.quantity}× ${newOrder.itemType})`
    };
    try {
      await Promise.race([
        setDoc(doc(db, `businesses/${businessId}/transactions`, txId), txRecord),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore transaction sync timeout')), 2500))
      ]);
    } catch (err) {
      console.warn("Could not sync order payment transaction to cloud (saved locally):", err);
    }

    triggerBackgroundBackup(businessId, 'TRANSACTION', {
      id: txId,
      customerName: newOrder.customerName,
      paymentMode: mode,
      amount: paidAmount,
      timestamp: txRecord.timestamp
    });
  }

  return newOrder;
}

/**
 * Modify an in-progress or existing cooler/jar order
 */
export async function modifyOrderBooking(
  businessId: string,
  orderId: string,
  updates: Partial<OrderBooking>
): Promise<OrderBooking | null> {
  const existing = (getLocalStore(businessId).orders || []).find(o => o.id === orderId);
  const patchedUpdates: Partial<OrderBooking> = {
    ...updates,
    ...(updates.status === 'DELIVERED' && !existing?.deliveredAt && !updates.deliveredAt
      ? { deliveredAt: Date.now() }
      : {}),
  };

  const updated = updateOrderLocal(orderId, patchedUpdates, businessId);
  if (!updated) return null;

  try {
    await Promise.race([
      setDoc(doc(db, `businesses/${businessId}/orders`, orderId), updated, { merge: true }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore order update timeout')), 2500))
    ]);
  } catch (err) {
    console.warn("Could not sync order update to cloud (updated locally):", err);
  }

  // If editing increased amountPaid directly, record the delta transaction
  const prevPaid = Number(existing?.amountPaid) || 0;
  const nextPaid = Number(updated.amountPaid) || 0;
  const deltaPaid = Math.round(((nextPaid - prevPaid) + Number.EPSILON) * 100) / 100;
  if (deltaPaid > 0) {
    const mode = updated.paymentMode || 'CASH';
    const txId = recordOrderTransactionLocal(
      updated,
      deltaPaid,
      mode,
      businessId,
      updated.collectedBy || updated.assignedDriver
    );
    const txRecord: TransactionRecord = {
      id: txId,
      customerId: updated.customerId || updated.id,
      customerName: updated.customerName,
      type: 'REFILL_PAYMENT',
      amount: deltaPaid,
      paymentMode: mode,
      timestamp: Date.now(),
      notes: `Bulk/Event Order #${updated.id.toUpperCase()} (${updated.quantity}× ${updated.itemType})`
    };
    try {
      await Promise.race([
        setDoc(doc(db, `businesses/${businessId}/transactions`, txId), txRecord),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore transaction sync timeout')), 2500))
      ]);
    } catch (err) {
      console.warn("Could not sync order payment delta to cloud (saved locally):", err);
    }
  }

  return updated;
}

/**
 * Collect payment on an existing bulk/function order (and optionally mark it Delivered)
 */
export async function collectOrderPayment(
  businessId: string,
  order: OrderBooking,
  paymentInput: {
    amountPaidNow: number;
    paymentMode: 'CASH' | 'UPI' | 'BANK_TRANSFER';
    markDelivered?: boolean;
    collectedBy?: string;
  }
): Promise<OrderBooking | null> {
  const safeNow = Math.max(0, Math.round((paymentInput.amountPaidNow + Number.EPSILON) * 100) / 100);
  const existingPaid = Number(order.amountPaid) || (order.paymentStatus === 'PAID' ? order.totalAmount : 0);
  const newTotalPaid = Math.min(
    order.totalAmount,
    Math.round(((existingPaid + safeNow) + Number.EPSILON) * 100) / 100
  );

  const nextPaymentStatus: OrderBooking['paymentStatus'] =
    newTotalPaid >= order.totalAmount
      ? 'PAID'
      : newTotalPaid > 0
      ? 'PARTIAL'
      : 'PENDING';

  const updates: Partial<OrderBooking> = {
    amountPaid: newTotalPaid,
    paymentStatus: nextPaymentStatus,
    paymentMode: paymentInput.paymentMode,
    ...(paymentInput.collectedBy ? { collectedBy: paymentInput.collectedBy } : {}),
    ...(paymentInput.markDelivered
      ? { status: 'DELIVERED', deliveredAt: order.deliveredAt || Date.now() }
      : {}),
  };

  const updated = updateOrderLocal(order.id, updates, businessId);
  if (!updated) return null;

  try {
    await Promise.race([
      setDoc(doc(db, `businesses/${businessId}/orders`, order.id), updated, { merge: true }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore order payment update timeout')), 2500))
    ]);
  } catch (err) {
    console.warn("Could not sync order payment update to cloud (saved locally):", err);
  }

  if (safeNow > 0) {
    const txId = recordOrderTransactionLocal(
      updated,
      safeNow,
      paymentInput.paymentMode,
      businessId,
      paymentInput.collectedBy
    );
    const txRecord: TransactionRecord = {
      id: txId,
      customerId: updated.customerId || updated.id,
      customerName: updated.customerName,
      type: 'REFILL_PAYMENT',
      amount: safeNow,
      paymentMode: paymentInput.paymentMode,
      timestamp: Date.now(),
      notes: `Bulk/Event Order #${updated.id.toUpperCase()} (${updated.quantity}× ${updated.itemType})${paymentInput.collectedBy ? ` • By ${paymentInput.collectedBy}` : ''}`
    };

    try {
      await Promise.race([
        setDoc(doc(db, `businesses/${businessId}/transactions`, txId), txRecord),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore order tx sync timeout')), 2500))
      ]);
    } catch (err) {
      console.warn("Could not sync order payment transaction to cloud (saved locally):", err);
    }

    triggerBackgroundBackup(businessId, 'TRANSACTION', {
      id: txId,
      customerName: updated.customerName,
      paymentMode: paymentInput.paymentMode,
      amount: safeNow,
      timestamp: txRecord.timestamp
    });
  }

  return updated;
}

/**
 * Cancel or remove an order booking
 */
export async function removeOrderBooking(
  businessId: string,
  orderId: string
): Promise<boolean> {
  const ok = deleteOrderLocal(orderId, businessId);
  try {
    await Promise.race([
      deleteDoc(doc(db, `businesses/${businessId}/orders`, orderId)),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore order delete timeout')), 2500))
    ]);
  } catch (err) {
    console.warn("Could not sync order deletion to cloud (removed locally):", err);
  }
  return ok;
}

/**
 * Update an existing SKU / Inventory Item (unit price, stock, deposit, name)
 * Supports decreasing or increasing available stock directly
 */
export async function updateInventoryItem(
  businessId: string,
  itemType: string,
  updates: Partial<Omit<InventoryItem, 'itemType'>>
): Promise<InventoryItem | null> {
  const updated = updateInventoryItemLocal(itemType, updates, businessId);
  if (!updated) return null;

  try {
    const inventoryRef = doc(db, `businesses/${businessId}/inventory`, itemType);
    await Promise.race([
      setDoc(inventoryRef, updated, { merge: true }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore inventory update timeout')), 2500))
    ]);
  } catch (err) {
    console.warn("Could not sync inventory update to cloud (updated locally):", err);
  }

  return updated;
}

/**
 * Create a new Inventory SKU
 */
export async function createInventoryItem(
  businessId: string,
  itemData: Omit<InventoryItem, 'lastUpdated'>
): Promise<InventoryItem> {
  const created = addInventoryItemLocal(itemData, businessId);
  try {
    const inventoryRef = doc(db, `businesses/${businessId}/inventory`, created.itemType);
    await Promise.race([
      setDoc(inventoryRef, created, { merge: true }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore inventory create timeout')), 2500))
    ]);
  } catch (err) {
    console.warn("Could not sync new inventory item to cloud (saved locally):", err);
  }
  return created;
}

/**
 * Delete an inventory SKU
 */
export async function deleteInventoryItem(
  businessId: string,
  itemType: string
): Promise<boolean> {
  deleteInventoryItemLocal(itemType, businessId);
  try {
    const inventoryRef = doc(db, `businesses/${businessId}/inventory`, itemType);
    await deleteDoc(inventoryRef);
  } catch (err) {
    console.warn("Could not sync inventory deletion to cloud (deleted locally):", err);
  }
  return true;
}
