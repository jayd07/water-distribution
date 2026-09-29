export interface InventoryItem {
  id?: string;
  itemType: string;
  displayName: string;
  availableStock: number;
  borrowedStock: number;
  totalCapacity: number;
  unitPrice: number;
  depositAmount: number;
  lastUpdated: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  customerType: 'RESIDENTIAL' | 'COMMERCIAL';
  jarsHolding: number;
  jarsHoldingBySku?: Record<string, number>;
  dueAmount: number;
  depositPaid: number;
  route: string;
  createdAt: number;
}

export interface DeliveryLog {
  id: string;
  customerId: string;
  customerName: string;
  workerName: string;
  jarsDelivered: number;
  emptyJarsCollected: number;
  amountCollected: number;
  paymentMode: 'CASH' | 'UPI' | 'CREDIT';
  itemType?: string;
  timestamp: number;
  // Receipt metadata optional
  orderId?: string;
  unitPrice?: number;
  customerPhone?: string;
  customerAddress?: string;
  notes?: string;
}

export interface OrderBooking {
  id: string;
  customerName: string;
  customerMobile: string;
  customerAddress?: string;
  customerId?: string;
  itemType: string; // Cooler / Jar type (e.g., 'Electric Water Cooler Dispenser', '20L Normal Water Jar', etc.)
  quantity: number; // How many items to book
  depositAmount: number; // Amount deposit if any
  rentOrPricePerUnit: number; // Price or rental rate per unit
  totalAmount: number; // Total billing amount
  paymentStatus: 'PAID' | 'PARTIAL' | 'PENDING';
  status: 'PENDING' | 'CONFIRMED' | 'DELIVERED' | 'CANCELLED';
  bookingDate: number;
  deliveryDate?: string;
  returnDate?: string;
  notes?: string;
  assignedDriver?: string;
}

export interface TransactionRecord {
  id: string;
  customerId: string;
  customerName?: string;
  type: 'REFILL_PAYMENT' | 'DUE_CLEARANCE' | 'SECURITY_DEPOSIT';
  amount: number;
  paymentMode: 'CASH' | 'UPI' | 'BANK_TRANSFER';
  timestamp: number;
  notes?: string;
}

export type WorkerRole = 'DRIVER' | 'DISPATCH_STAFF' | 'MANAGER';

export interface BusinessAccount {
  id: string;
  name: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail?: string;
  ownerUid?: string;
  associatedPhones?: string[];
  associatedEmails?: string[];
  phoneVerified?: boolean;
  emailVerified?: boolean;
  category?: string;
  address?: string;
  city?: string;
  gstin?: string;
  upiId?: string;
  googleSheetsWebhookUrl?: string;
  googleSheetsUrl?: string;
  googleSheetId?: string;
  defaultJarRate?: number;
  createdAt: number;
  updatedAt?: number;
  workerPhones?: string[];
  workers?: BusinessWorker[];
}

export interface BusinessWorker {
  id: string;
  businessId: string;
  businessName: string;
  workerName: string;
  workerPhone: string;
  role: WorkerRole;
  assignedRoute?: string;
  status: 'ACTIVE' | 'INVITED';
  addedAt: number;
  addedByPhone: string;
  ownerName?: string;
}

export interface WorkerAssignment {
  id: string;
  workerPhone: string;
  businessId: string;
  businessName: string;
  workerName: string;
  role: WorkerRole;
  assignedRoute?: string;
  status: 'ACTIVE' | 'INVITED';
  addedAt: number;
  addedByPhone: string;
  ownerName?: string;
}

export interface UserSessionProfile {
  phoneNumber: string;
  displayName?: string;
  activeBusinessId: string;
  role: 'OWNER' | 'WORKER';
  workerRecord?: BusinessWorker;
}

export type ActiveTab = 'dashboard' | 'orders' | 'customers' | 'inventory' | 'team' | 'analytics';
