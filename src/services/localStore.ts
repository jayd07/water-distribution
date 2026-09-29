import { Customer, InventoryItem, DeliveryLog, TransactionRecord, OrderBooking } from '../types';

const LOCAL_STORAGE_KEY = 'aquapure_springs_data_v1';

export interface AquaPureDataStore {
  inventory: InventoryItem[];
  customers: Customer[];
  deliveries: DeliveryLog[];
  transactions: TransactionRecord[];
  orders: OrderBooking[];
  lastUpdated: number;
}

export const DEFAULT_INITIAL_INVENTORY: InventoryItem[] = [
  {
    id: '20L Chilled Water Jar',
    itemType: '20L Chilled Water Jar',
    displayName: '20L Chilled Water Jar',
    availableStock: 100,
    borrowedStock: 0,
    totalCapacity: 100,
    unitPrice: 40.0,
    depositAmount: 150.0,
    lastUpdated: Date.now()
  },
  {
    id: '20L Normal Jar',
    itemType: '20L Normal Jar',
    displayName: '20L Normal Jar',
    availableStock: 100,
    borrowedStock: 0,
    totalCapacity: 100,
    unitPrice: 35.0,
    depositAmount: 150.0,
    lastUpdated: Date.now()
  }
];

export const DEFAULT_INITIAL_CUSTOMERS: Customer[] = [];

export const DEFAULT_INITIAL_DELIVERIES: DeliveryLog[] = [];

export const DEFAULT_INITIAL_TRANSACTIONS: TransactionRecord[] = [];

export const DEFAULT_INITIAL_ORDERS: OrderBooking[] = [];

export function getStorageKey(businessId?: string): string {
  if (businessId && businessId !== 'AquaPure_Springs') {
    return `aquapure_data_${businessId}`;
  }
  return LOCAL_STORAGE_KEY;
}

export const DUMMY_IDS = new Set([
  'cust_101', 'cust_102', 'cust_103', 'cust_104', 'cust_105', 
  'del_001', 'del_002', 'del_003', 
  'tx_001', 'tx_002', 'tx_003', 
  'ord_1001', 'ord_1002', 'ord_1003',
  'cust_AquaPure_Springs_01'
]);

export const DUMMY_NAME_KEYWORDS = [
  'sharma',
  'ramesh',
  'verma',
  'apex',
  'zenith',
  'pooja',
  'kulkarni',
  'alok',
  'aarav',
  'techvision',
  'sunita',
  'joshi'
];

export function isDummyCustomer(c: Customer): boolean {
  if (!c) return false;
  if (DUMMY_IDS.has(c.id)) return true;
  const lowerName = (c.name || '').toLowerCase();
  const lowerPhone = (c.phone || '').toLowerCase();
  return DUMMY_NAME_KEYWORDS.some(k => lowerName.includes(k)) || lowerPhone.includes('9820144512');
}

export function isDummyDelivery(d: DeliveryLog): boolean {
  if (!d) return false;
  if (DUMMY_IDS.has(d.id)) return true;
  if (d.id?.startsWith('del_hist_') || d.id === 'del_001' || d.id === 'del_002' || d.id === 'del_003') return true;
  const lowerCust = (d.customerName || '').toLowerCase();
  const lowerWorker = (d.workerName || '').toLowerCase();
  return DUMMY_NAME_KEYWORDS.some(k => lowerCust.includes(k) || lowerWorker.includes(k));
}

export function isDummyTransaction(t: TransactionRecord): boolean {
  if (!t) return false;
  if (DUMMY_IDS.has(t.id)) return true;
  if (t.id?.startsWith('tx_hist_') || t.id?.startsWith('tx_due_') || t.id === 'tx_001' || t.id === 'tx_002' || t.id === 'tx_003') return true;
  const lowerCust = (t.customerName || '').toLowerCase();
  return DUMMY_NAME_KEYWORDS.some(k => lowerCust.includes(k));
}

export function isDummyOrder(o: OrderBooking): boolean {
  if (!o) return false;
  if (DUMMY_IDS.has(o.id)) return true;
  const lowerCust = (o.customerName || '').toLowerCase();
  return DUMMY_NAME_KEYWORDS.some(k => lowerCust.includes(k));
}

export function isDummyInventory(inv: InventoryItem): boolean {
  if (!inv) return false;
  // Match the hardcoded legacy demo stocks: 120/380 (500), 60/140 (200), 40/60 (100)
  if (inv.availableStock === 120 && inv.borrowedStock === 380 && inv.totalCapacity === 500) return true;
  if (inv.availableStock === 60 && inv.borrowedStock === 140 && inv.totalCapacity === 200) return true;
  if (inv.availableStock === 40 && inv.borrowedStock === 60 && inv.totalCapacity === 100) return true;
  return false;
}

export function getLocalStore(businessId?: string): AquaPureDataStore {
  const key = getStorageKey(businessId);
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed) {
        // Strip out any legacy dummy records from previous versions
        parsed.customers = Array.isArray(parsed.customers)
          ? parsed.customers.filter((c: Customer) => !isDummyCustomer(c))
          : [];
        parsed.deliveries = Array.isArray(parsed.deliveries) 
          ? parsed.deliveries.filter((d: DeliveryLog) => !isDummyDelivery(d)) 
          : [];
        parsed.transactions = Array.isArray(parsed.transactions) 
          ? parsed.transactions.filter((t: TransactionRecord) => !isDummyTransaction(t)) 
          : [];
        parsed.orders = Array.isArray(parsed.orders) 
          ? parsed.orders.filter((o: OrderBooking) => !isDummyOrder(o)) 
          : [];
        parsed.inventory = Array.isArray(parsed.inventory)
          ? parsed.inventory.filter((inv: InventoryItem) => !isDummyInventory(inv))
          : [];
        
        // Ensure default 2 SKUs are present if inventory is empty
        if (parsed.inventory.length === 0) {
          parsed.inventory = [...DEFAULT_INITIAL_INVENTORY];
        } else {
          // If neither 20L Chilled nor 20L Normal is present, ensure default catalog items
          const hasChilled = parsed.inventory.some((i: InventoryItem) => i.itemType === '20L Chilled Water Jar' || i.displayName === '20L Chilled Water Jar');
          const hasNormal = parsed.inventory.some((i: InventoryItem) => i.itemType === '20L Normal Jar' || i.displayName === '20L Normal Jar' || i.itemType === '20L Normal Water Jar');
          if (!hasChilled) {
            parsed.inventory.push({ ...DEFAULT_INITIAL_INVENTORY[0] });
          }
          if (!hasNormal) {
            parsed.inventory.push({ ...DEFAULT_INITIAL_INVENTORY[1] });
          }
        }
        
        // Save cleaned state back
        localStorage.setItem(key, JSON.stringify(parsed));
        return parsed;
      }
    }
  } catch (e) {
    console.warn("Could not read from local storage, using clean initial store", e);
  }

  const initialStore: AquaPureDataStore = {
    inventory: [...DEFAULT_INITIAL_INVENTORY],
    customers: [],
    deliveries: [],
    transactions: [],
    orders: [],
    lastUpdated: Date.now()
  };

  try {
    localStorage.setItem(key, JSON.stringify(initialStore));
  } catch {}

  return initialStore;
}

export function saveLocalStore(store: AquaPureDataStore, businessId?: string): void {
  const key = getStorageKey(businessId);
  try {
    store.lastUpdated = Date.now();
    localStorage.setItem(key, JSON.stringify(store));
  } catch (e) {
    console.warn("Could not save to local storage", e);
  }
}

export function updateInventoryItemLocal(
  itemType: string,
  updates: Partial<Omit<InventoryItem, 'itemType'>>,
  businessId?: string
): InventoryItem | null {
  const store = getLocalStore(businessId);
  if (!Array.isArray(store.inventory)) {
    store.inventory = [...DEFAULT_INITIAL_INVENTORY];
  }
  const index = store.inventory.findIndex(i => i.itemType === itemType || i.displayName === itemType);
  if (index === -1) return null;

  const current = store.inventory[index];
  const updatedItem: InventoryItem = {
    ...current,
    ...updates,
    itemType: current.itemType, // keep key immutable
    lastUpdated: Date.now()
  };

  // If available stock or borrowed stock changed, adjust total capacity appropriately
  if (updates.availableStock !== undefined || updates.borrowedStock !== undefined) {
    const avail = updatedItem.availableStock ?? current.availableStock ?? 0;
    const borrow = updatedItem.borrowedStock ?? current.borrowedStock ?? 0;
    updatedItem.totalCapacity = Math.max(updatedItem.totalCapacity || (avail + borrow), avail + borrow);
  }

  store.inventory[index] = updatedItem;
  saveLocalStore(store, businessId);
  return updatedItem;
}

export function addInventoryItemLocal(
  itemData: Omit<InventoryItem, 'lastUpdated'>,
  businessId?: string
): InventoryItem {
  const store = getLocalStore(businessId);
  if (!Array.isArray(store.inventory)) {
    store.inventory = [];
  }
  const newItem: InventoryItem = {
    ...itemData,
    id: itemData.itemType,
    lastUpdated: Date.now()
  };
  const existingIdx = store.inventory.findIndex(i => i.itemType === newItem.itemType);
  if (existingIdx >= 0) {
    store.inventory[existingIdx] = newItem;
  } else {
    store.inventory.push(newItem);
  }
  saveLocalStore(store, businessId);
  return newItem;
}

export function deleteInventoryItemLocal(
  itemType: string,
  businessId?: string
): boolean {
  const store = getLocalStore(businessId);
  if (!Array.isArray(store.inventory)) return false;
  store.inventory = store.inventory.filter(i => i.itemType !== itemType && i.displayName !== itemType);
  saveLocalStore(store, businessId);
  return true;
}

export function addCustomerLocal(customerData: Omit<Customer, 'id' | 'createdAt'>, businessId?: string): Customer {
  const store = getLocalStore(businessId);
  const id = `cust_${Date.now().toString().slice(-6)}`;
  const newCustomer: Customer = {
    ...customerData,
    id,
    createdAt: Date.now()
  };
  store.customers.unshift(newCustomer);
  saveLocalStore(store, businessId);
  return newCustomer;
}

export function updateCustomerLocal(
  customerId: string, 
  updates: Partial<Omit<Customer, 'id' | 'createdAt'>>, 
  businessId?: string
): Customer | null {
  const store = getLocalStore(businessId);
  if (!Array.isArray(store.customers)) return null;
  const index = store.customers.findIndex(c => c.id === customerId);
  if (index === -1) return null;
  
  const updatedCustomer: Customer = {
    ...store.customers[index],
    ...updates,
    id: customerId,
    createdAt: store.customers[index].createdAt
  };
  
  store.customers[index] = updatedCustomer;
  saveLocalStore(store, businessId);
  return updatedCustomer;
}

export function deleteCustomerLocal(customerId: string, businessId?: string): boolean {
  const store = getLocalStore(businessId);
  if (!Array.isArray(store.customers)) return false;
  store.customers = store.customers.filter(c => c.id !== customerId);
  saveLocalStore(store, businessId);
  return true;
}

export interface LocalDeliveryInput {
  customerId: string;
  customerName: string;
  workerName: string;
  jarsDelivered: number;
  emptyJarsCollected: number;
  amountCollected: number;
  paymentMode: 'CASH' | 'UPI' | 'CREDIT';
  itemType?: string;
}

export function recordDeliveryLocal(input: LocalDeliveryInput, businessId?: string): { deliveryId: string; store: AquaPureDataStore } {
  const store = getLocalStore(businessId);
  const itemType = input.itemType || '20L Normal Water Jar';
  const deliveryId = `del_${Date.now().toString().slice(-6)}`;
  const txId = `tx_${Date.now().toString().slice(-6)}`;
  const now = Date.now();

  // Find customer
  const custIndex = store.customers.findIndex(c => c.id === input.customerId);
  let unitPrice = 35;

  // Find inventory
  const invIndex = store.inventory.findIndex(i => i.itemType === itemType);
  if (invIndex >= 0) {
    unitPrice = store.inventory[invIndex].unitPrice || 35;
    const curAvail = store.inventory[invIndex].availableStock || 0;
    const curBorrow = store.inventory[invIndex].borrowedStock || 0;
    store.inventory[invIndex].availableStock = Math.max(0, curAvail - input.jarsDelivered + input.emptyJarsCollected);
    store.inventory[invIndex].borrowedStock = Math.max(0, curBorrow + input.jarsDelivered - input.emptyJarsCollected);
    store.inventory[invIndex].lastUpdated = now;
  }

  const orderCost = input.jarsDelivered * unitPrice;

  if (custIndex >= 0) {
    const curJars = store.customers[custIndex].jarsHolding || 0;
    const curDue = store.customers[custIndex].dueAmount || 0;
    const curSkuMap = { ...(store.customers[custIndex].jarsHoldingBySku || {}) };
    const curSkuCount = curSkuMap[itemType] || 0;
    const newSkuCount = Math.max(0, curSkuCount + input.jarsDelivered - input.emptyJarsCollected);
    curSkuMap[itemType] = newSkuCount;

    const totalFromSku = Object.values(curSkuMap).reduce((sum, v) => sum + (v || 0), 0);
    const updatedTotalHolding = totalFromSku > 0 ? totalFromSku : Math.max(0, curJars + input.jarsDelivered - input.emptyJarsCollected);

    store.customers[custIndex].jarsHolding = updatedTotalHolding;
    store.customers[custIndex].jarsHoldingBySku = curSkuMap;
    store.customers[custIndex].dueAmount = Math.max(0, curDue + orderCost - input.amountCollected);
  }

  // Record delivery
  const deliveryRecord: DeliveryLog = {
    id: deliveryId,
    customerId: input.customerId,
    customerName: input.customerName,
    workerName: input.workerName,
    jarsDelivered: input.jarsDelivered,
    emptyJarsCollected: input.emptyJarsCollected,
    amountCollected: input.amountCollected,
    paymentMode: input.paymentMode,
    itemType,
    timestamp: now
  };
  store.deliveries.unshift(deliveryRecord);

  // Record transaction if payment collected
  if (input.amountCollected > 0 && input.paymentMode !== 'CREDIT') {
    const txRecord: TransactionRecord = {
      id: txId,
      customerId: input.customerId,
      customerName: input.customerName,
      type: 'REFILL_PAYMENT',
      amount: input.amountCollected,
      paymentMode: input.paymentMode,
      timestamp: now
    };
    store.transactions.unshift(txRecord);
  }

  saveLocalStore(store, businessId);
  return { deliveryId, store };
}

export function restockInventoryLocal(
  itemType: string, 
  quantity: number, 
  businessId?: string,
  unitPrice?: number
): AquaPureDataStore {
  const store = getLocalStore(businessId);
  const invIndex = store.inventory.findIndex(i => i.itemType === itemType);
  const now = Date.now();

  if (invIndex >= 0) {
    const curAvail = store.inventory[invIndex].availableStock || 0;
    const curCap = store.inventory[invIndex].totalCapacity || curAvail;
    store.inventory[invIndex].availableStock = curAvail + quantity;
    store.inventory[invIndex].totalCapacity = Math.max(curCap, curAvail + quantity + (store.inventory[invIndex].borrowedStock || 0));
    if (unitPrice !== undefined && unitPrice > 0) {
      store.inventory[invIndex].unitPrice = unitPrice;
    }
    store.inventory[invIndex].lastUpdated = now;
  } else {
    store.inventory.push({
      id: itemType,
      itemType,
      displayName: itemType,
      availableStock: quantity,
      borrowedStock: 0,
      totalCapacity: quantity,
      unitPrice: (unitPrice !== undefined && unitPrice > 0) ? unitPrice : 35.0,
      depositAmount: 150.0,
      lastUpdated: now
    });
  }

  saveLocalStore(store, businessId);
  return store;
}

export function recordDueSettlementLocal(
  customerId: string,
  customerName: string,
  amount: number,
  paymentMode: 'CASH' | 'UPI' | 'BANK_TRANSFER',
  businessId?: string
): AquaPureDataStore {
  const store = getLocalStore(businessId);
  const custIndex = store.customers.findIndex(c => c.id === customerId);
  const now = Date.now();

  if (custIndex >= 0) {
    const curDue = store.customers[custIndex].dueAmount || 0;
    store.customers[custIndex].dueAmount = Math.max(0, curDue - amount);
  }

  store.transactions.unshift({
    id: `tx_${Date.now().toString().slice(-6)}`,
    customerId,
    customerName,
    type: 'DUE_CLEARANCE',
    amount,
    paymentMode,
    timestamp: now
  });

  saveLocalStore(store, businessId);
  return store;
}

export function createOrderLocal(orderData: Omit<OrderBooking, 'id' | 'bookingDate'>, businessId?: string): OrderBooking {
  const store = getLocalStore(businessId);
  const id = `ord_${Date.now().toString().slice(-6)}`;
  const newOrder: OrderBooking = {
    ...orderData,
    id,
    bookingDate: Date.now()
  };
  if (!Array.isArray(store.orders)) {
    store.orders = [];
  }
  store.orders.unshift(newOrder);
  saveLocalStore(store, businessId);
  return newOrder;
}

export function updateOrderLocal(orderId: string, updates: Partial<OrderBooking>, businessId?: string): OrderBooking | null {
  const store = getLocalStore(businessId);
  if (!Array.isArray(store.orders)) {
    store.orders = [];
    return null;
  }
  const idx = store.orders.findIndex(o => o.id === orderId);
  if (idx === -1) return null;

  store.orders[idx] = {
    ...store.orders[idx],
    ...updates
  };
  saveLocalStore(store, businessId);
  return store.orders[idx];
}

export function deleteOrderLocal(orderId: string, businessId?: string): boolean {
  const store = getLocalStore(businessId);
  if (!Array.isArray(store.orders)) return false;
  store.orders = store.orders.filter(o => o.id !== orderId);
  saveLocalStore(store, businessId);
  return true;
}

export function seed30DayHistoryLocal(businessId?: string): AquaPureDataStore {
  return getLocalStore(businessId);
}

