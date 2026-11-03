import { 
  DeliveryTrip, 
  CustomerSchedule, 
  FieldExpense, 
  ExpenseCategory, 
  Customer, 
  DeliveryLog, 
  InventoryItem 
} from '../types';
import { db } from '../config/firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  updateDoc 
} from 'firebase/firestore';
import { processDeliveryAtomic } from './deliveryService';

const TRIPS_STORAGE_PREFIX = 'aquapure_trips_';
const SCHEDULES_STORAGE_PREFIX = 'aquapure_schedules_';
const EXPENSES_STORAGE_PREFIX = 'aquapure_expenses_';

// ==========================================
// 1. DELIVERY TRIPS & VEHICLE RECONCILIATION
// ==========================================

export async function fetchTripsFromCloud(businessId: string): Promise<DeliveryTrip[]> {
  if (!businessId) return [];
  try {
    const colRef = collection(db, `businesses/${businessId}/trips`);
    const snap = await getDocs(colRef);
    const cloudTrips: DeliveryTrip[] = [];
    snap.forEach(docSnap => {
      const data = docSnap.data();
      if (data && docSnap.id) {
        cloudTrips.push({
          id: docSnap.id,
          businessId,
          driverPhone: data.driverPhone || '',
          driverName: data.driverName || 'Driver',
          vehicleNumber: data.vehicleNumber || '',
          routeName: data.routeName || 'All Routes',
          loadedFullJars: Number(data.loadedFullJars) || 0,
          deliveredFullJars: Number(data.deliveredFullJars) || 0,
          collectedEmptyJars: Number(data.collectedEmptyJars) || 0,
          remainingFullJars: Number(data.remainingFullJars) || 0,
          cashCollected: Number(data.cashCollected) || 0,
          onlineCollected: Number(data.onlineCollected) || 0,
          totalCollected: Number(data.totalCollected) || 0,
          status: data.status || 'COMPLETED',
          startTime: Number(data.startTime) || Date.now(),
          endTime: data.endTime ? Number(data.endTime) : undefined,
          notes: data.notes || '',
          completedCustomerIds: Array.isArray(data.completedCustomerIds) ? data.completedCustomerIds : []
        });
      }
    });
    // Sort most recent first
    cloudTrips.sort((a, b) => b.startTime - a.startTime);
    localStorage.setItem(`${TRIPS_STORAGE_PREFIX}${businessId}`, JSON.stringify(cloudTrips));
    return cloudTrips;
  } catch (err) {
    console.warn('[OperationsService] Error fetching trips from Firestore:', err);
    return getLocalTrips(businessId);
  }
}

export function getLocalTrips(businessId: string): DeliveryTrip[] {
  try {
    const raw = localStorage.getItem(`${TRIPS_STORAGE_PREFIX}${businessId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalTrips(businessId: string, trips: DeliveryTrip[]): void {
  try {
    localStorage.setItem(`${TRIPS_STORAGE_PREFIX}${businessId}`, JSON.stringify(trips));
  } catch (err) {
    console.warn('Failed to save trips locally', err);
  }
}

export async function getActiveTrip(businessId: string, driverPhone?: string): Promise<DeliveryTrip | null> {
  const trips = await fetchTripsFromCloud(businessId);
  if (driverPhone) {
    const cleanPhone = driverPhone.replace(/\D/g, '').slice(-10);
    return trips.find(t => t.status === 'ACTIVE' && t.driverPhone.replace(/\D/g, '').slice(-10) === cleanPhone) || null;
  }
  return trips.find(t => t.status === 'ACTIVE') || null;
}

export async function startDeliveryTrip(
  businessId: string,
  data: {
    driverPhone: string;
    driverName: string;
    vehicleNumber?: string;
    routeName: string;
    loadedFullJars: number;
  }
): Promise<DeliveryTrip> {
  const tripId = `trip_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const newTrip: DeliveryTrip = {
    id: tripId,
    businessId,
    driverPhone: data.driverPhone.trim(),
    driverName: data.driverName.trim(),
    vehicleNumber: data.vehicleNumber?.trim() || '',
    routeName: data.routeName || 'All Routes',
    loadedFullJars: Number(data.loadedFullJars) || 0,
    deliveredFullJars: 0,
    collectedEmptyJars: 0,
    remainingFullJars: Number(data.loadedFullJars) || 0,
    cashCollected: 0,
    onlineCollected: 0,
    totalCollected: 0,
    status: 'ACTIVE',
    startTime: Date.now(),
    completedCustomerIds: []
  };

  const trips = getLocalTrips(businessId);
  const updatedTrips = [newTrip, ...trips.filter(t => t.id !== tripId)];
  saveLocalTrips(businessId, updatedTrips);

  try {
    const docRef = doc(db, `businesses/${businessId}/trips`, tripId);
    await setDoc(docRef, newTrip);
  } catch (err) {
    console.error('Failed to sync new trip to Firestore:', err);
  }

  return newTrip;
}

export async function recordTripDelivery(
  businessId: string,
  tripId: string,
  deliveryPayload: {
    customerId: string;
    customerName: string;
    jarsDelivered: number;
    emptyJarsCollected: number;
    amountCollected: number;
    paymentMode: 'CASH' | 'UPI' | 'CREDIT';
    itemType?: string;
    workerName?: string;
    notes?: string;
  }
): Promise<{ trip: DeliveryTrip; deliveryId: string }> {
  // 1. Record the official delivery atomically
  const deliveryId = await processDeliveryAtomic({
    businessId,
    customerId: deliveryPayload.customerId,
    customerName: deliveryPayload.customerName,
    workerName: deliveryPayload.workerName || 'Delivery Driver',
    jarsDelivered: deliveryPayload.jarsDelivered,
    emptyJarsCollected: deliveryPayload.emptyJarsCollected,
    amountCollected: deliveryPayload.amountCollected,
    paymentMode: deliveryPayload.paymentMode,
    itemType: deliveryPayload.itemType || 'Normal Jar'
  });

  // 2. Update trip telemetry and tallies
  const trips = getLocalTrips(businessId);
  const tripIdx = trips.findIndex(t => t.id === tripId);
  let updatedTrip: DeliveryTrip;

  if (tripIdx >= 0) {
    const current = trips[tripIdx];
    const isCash = deliveryPayload.paymentMode === 'CASH';
    const isOnline = deliveryPayload.paymentMode === 'UPI';
    const cashAmt = isCash ? deliveryPayload.amountCollected : 0;
    const onlineAmt = isOnline ? deliveryPayload.amountCollected : 0;

    const completedIds = Array.from(new Set([...current.completedCustomerIds, deliveryPayload.customerId]));
    const nextDelivered = current.deliveredFullJars + deliveryPayload.jarsDelivered;
    const nextEmpties = current.collectedEmptyJars + deliveryPayload.emptyJarsCollected;
    const nextRemaining = Math.max(0, current.loadedFullJars - nextDelivered);
    const nextCash = current.cashCollected + cashAmt;
    const nextOnline = current.onlineCollected + onlineAmt;

    updatedTrip = {
      ...current,
      deliveredFullJars: nextDelivered,
      collectedEmptyJars: nextEmpties,
      remainingFullJars: nextRemaining,
      cashCollected: nextCash,
      onlineCollected: nextOnline,
      totalCollected: nextCash + nextOnline,
      completedCustomerIds: completedIds
    };

    trips[tripIdx] = updatedTrip;
    saveLocalTrips(businessId, trips);

    try {
      const tripDocRef = doc(db, `businesses/${businessId}/trips`, tripId);
      await updateDoc(tripDocRef, {
        deliveredFullJars: nextDelivered,
        collectedEmptyJars: nextEmpties,
        remainingFullJars: nextRemaining,
        cashCollected: nextCash,
        onlineCollected: nextOnline,
        totalCollected: nextCash + nextOnline,
        completedCustomerIds: completedIds
      });
    } catch (err) {
      console.warn('Could not sync trip update to Firestore:', err);
    }
  } else {
    updatedTrip = {
      id: tripId,
      businessId,
      driverPhone: '',
      driverName: 'Driver',
      routeName: 'All Routes',
      loadedFullJars: deliveryPayload.jarsDelivered,
      deliveredFullJars: deliveryPayload.jarsDelivered,
      collectedEmptyJars: deliveryPayload.emptyJarsCollected,
      remainingFullJars: 0,
      cashCollected: deliveryPayload.paymentMode === 'CASH' ? deliveryPayload.amountCollected : 0,
      onlineCollected: deliveryPayload.paymentMode === 'UPI' ? deliveryPayload.amountCollected : 0,
      totalCollected: deliveryPayload.amountCollected,
      status: 'ACTIVE',
      startTime: Date.now(),
      completedCustomerIds: [deliveryPayload.customerId]
    };
  }

  return { trip: updatedTrip, deliveryId };
}

export async function completeDeliveryTrip(
  businessId: string,
  tripId: string,
  reconciliation: {
    returnedFullJars: number;
    notes?: string;
  }
): Promise<DeliveryTrip | null> {
  const trips = getLocalTrips(businessId);
  const tripIdx = trips.findIndex(t => t.id === tripId);
  if (tripIdx === -1) return null;

  const current = trips[tripIdx];
  const completedTrip: DeliveryTrip = {
    ...current,
    status: 'COMPLETED',
    remainingFullJars: reconciliation.returnedFullJars,
    endTime: Date.now(),
    notes: reconciliation.notes || current.notes || ''
  };

  trips[tripIdx] = completedTrip;
  saveLocalTrips(businessId, trips);

  try {
    const docRef = doc(db, `businesses/${businessId}/trips`, tripId);
    await updateDoc(docRef, {
      status: 'COMPLETED',
      remainingFullJars: reconciliation.returnedFullJars,
      endTime: Date.now(),
      notes: reconciliation.notes || ''
    });
  } catch (err) {
    console.error('Failed to sync trip completion to Firestore:', err);
  }

  return completedTrip;
}

export async function cancelDeliveryTrip(businessId: string, tripId: string): Promise<void> {
  const trips = getLocalTrips(businessId).filter(t => t.id !== tripId);
  saveLocalTrips(businessId, trips);

  try {
    await deleteDoc(doc(db, `businesses/${businessId}/trips`, tripId));
  } catch (err) {
    console.warn('Failed to delete trip from Firestore:', err);
  }
}

// ==========================================
// 2. RECURRING CUSTOMER SCHEDULES
// ==========================================

export async function fetchSchedulesFromCloud(businessId: string): Promise<CustomerSchedule[]> {
  if (!businessId) return [];
  try {
    const colRef = collection(db, `businesses/${businessId}/schedules`);
    const snap = await getDocs(colRef);
    const schedules: CustomerSchedule[] = [];
    snap.forEach(docSnap => {
      const d = docSnap.data();
      if (d && docSnap.id) {
        schedules.push({
          id: docSnap.id,
          customerId: d.customerId || '',
          customerName: d.customerName || 'Customer',
          customerPhone: d.customerPhone || '',
          customerAddress: d.customerAddress || '',
          frequency: d.frequency || 'DAILY',
          customDays: Array.isArray(d.customDays) ? d.customDays : undefined,
          defaultQuantity: Number(d.defaultQuantity) || 1,
          itemType: d.itemType || 'Normal Jar',
          preferredRoute: d.preferredRoute || 'General Route',
          active: d.active !== false,
          lastDeliveredDate: d.lastDeliveredDate
        });
      }
    });
    localStorage.setItem(`${SCHEDULES_STORAGE_PREFIX}${businessId}`, JSON.stringify(schedules));
    return schedules;
  } catch (err) {
    console.warn('[OperationsService] Error fetching schedules from Firestore:', err);
    return getLocalSchedules(businessId);
  }
}

export function getLocalSchedules(businessId: string): CustomerSchedule[] {
  try {
    const raw = localStorage.getItem(`${SCHEDULES_STORAGE_PREFIX}${businessId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalSchedules(businessId: string, schedules: CustomerSchedule[]): void {
  try {
    localStorage.setItem(`${SCHEDULES_STORAGE_PREFIX}${businessId}`, JSON.stringify(schedules));
  } catch (err) {
    console.warn('Failed to save schedules locally', err);
  }
}

export async function saveCustomerSchedule(
  businessId: string,
  scheduleData: Omit<CustomerSchedule, 'id'> & { id?: string }
): Promise<CustomerSchedule> {
  const scheduleId = scheduleData.id || `sched_${scheduleData.customerId}_${Date.now()}`;
  const completeSchedule: CustomerSchedule = {
    id: scheduleId,
    customerId: scheduleData.customerId,
    customerName: scheduleData.customerName,
    customerPhone: scheduleData.customerPhone,
    customerAddress: scheduleData.customerAddress,
    frequency: scheduleData.frequency,
    customDays: scheduleData.customDays,
    defaultQuantity: Number(scheduleData.defaultQuantity) || 1,
    itemType: scheduleData.itemType || 'Normal Jar',
    preferredRoute: scheduleData.preferredRoute || 'General Route',
    active: scheduleData.active !== false,
    lastDeliveredDate: scheduleData.lastDeliveredDate
  };

  const schedules = getLocalSchedules(businessId);
  const existingIdx = schedules.findIndex(s => s.id === scheduleId || s.customerId === scheduleData.customerId);
  if (existingIdx >= 0) {
    schedules[existingIdx] = completeSchedule;
  } else {
    schedules.push(completeSchedule);
  }
  saveLocalSchedules(businessId, schedules);

  try {
    const docRef = doc(db, `businesses/${businessId}/schedules`, scheduleId);
    await setDoc(docRef, completeSchedule, { merge: true });
  } catch (err) {
    console.error('Failed to sync schedule to Firestore:', err);
  }

  return completeSchedule;
}

export async function deleteCustomerSchedule(businessId: string, scheduleId: string): Promise<void> {
  const schedules = getLocalSchedules(businessId).filter(s => s.id !== scheduleId);
  saveLocalSchedules(businessId, schedules);

  try {
    await deleteDoc(doc(db, `businesses/${businessId}/schedules`, scheduleId));
  } catch (err) {
    console.warn('Failed to delete schedule from Firestore:', err);
  }
}

/**
 * Filter customers scheduled for delivery today based on schedule rules.
 */
export function filterCustomersDueToday(
  customers: Customer[],
  schedules: CustomerSchedule[],
  targetDate: Date = new Date()
): { customer: Customer; schedule?: CustomerSchedule }[] {
  const dayOfWeek = targetDate.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const dayOfMonth = targetDate.getDate();
  const scheduleMap = new Map<string, CustomerSchedule>();

  schedules.filter(s => s.active).forEach(s => {
    scheduleMap.set(s.customerId, s);
  });

  const dueList: { customer: Customer; schedule?: CustomerSchedule }[] = [];

  for (const c of customers) {
    const sched = scheduleMap.get(c.id);
    if (!sched) {
      // Default behavior if no custom schedule: include all customers holding jars or with routes
      dueList.push({ customer: c });
      continue;
    }

    let isDue = false;
    switch (sched.frequency) {
      case 'DAILY':
        isDue = true;
        break;
      case 'WEEKDAYS': // Mon to Sat
        isDue = dayOfWeek >= 1 && dayOfWeek <= 6;
        break;
      case 'ALTERNATE':
        isDue = dayOfMonth % 2 === 1; // odd days
        break;
      case 'WEEKLY':
        isDue = dayOfWeek === 1; // Monday
        break;
      case 'CUSTOM':
        isDue = Array.isArray(sched.customDays) && sched.customDays.includes(dayOfWeek);
        break;
      default:
        isDue = true;
    }

    if (isDue) {
      dueList.push({ customer: c, schedule: sched });
    }
  }

  return dueList;
}

// ==========================================
// 3. FIELD EXPENSES & DAILY COST TRACKING
// ==========================================

export async function fetchExpensesFromCloud(businessId: string): Promise<FieldExpense[]> {
  if (!businessId) return [];
  try {
    const colRef = collection(db, `businesses/${businessId}/expenses`);
    const snap = await getDocs(colRef);
    const expenses: FieldExpense[] = [];
    snap.forEach(docSnap => {
      const d = docSnap.data();
      if (d && docSnap.id) {
        expenses.push({
          id: docSnap.id,
          businessId,
          category: d.category || 'OTHER',
          amount: Number(d.amount) || 0,
          description: d.description || '',
          loggedBy: d.loggedBy || 'Staff',
          timestamp: Number(d.timestamp) || Date.now(),
          vehicleNumber: d.vehicleNumber,
          receiptUrl: d.receiptUrl
        });
      }
    });
    expenses.sort((a, b) => b.timestamp - a.timestamp);
    localStorage.setItem(`${EXPENSES_STORAGE_PREFIX}${businessId}`, JSON.stringify(expenses));
    return expenses;
  } catch (err) {
    console.warn('[OperationsService] Error fetching expenses from Firestore:', err);
    return getLocalExpenses(businessId);
  }
}

export function getLocalExpenses(businessId: string): FieldExpense[] {
  try {
    const raw = localStorage.getItem(`${EXPENSES_STORAGE_PREFIX}${businessId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalExpenses(businessId: string, expenses: FieldExpense[]): void {
  try {
    localStorage.setItem(`${EXPENSES_STORAGE_PREFIX}${businessId}`, JSON.stringify(expenses));
  } catch (err) {
    console.warn('Failed to save expenses locally', err);
  }
}

export async function addFieldExpense(
  businessId: string,
  expenseData: {
    category: ExpenseCategory;
    amount: number;
    description: string;
    loggedBy: string;
    vehicleNumber?: string;
  }
): Promise<FieldExpense> {
  const expenseId = `exp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const newExpense: FieldExpense = {
    id: expenseId,
    businessId,
    category: expenseData.category,
    amount: Number(expenseData.amount) || 0,
    description: expenseData.description.trim(),
    loggedBy: expenseData.loggedBy.trim(),
    timestamp: Date.now(),
    vehicleNumber: expenseData.vehicleNumber?.trim()
  };

  const expenses = getLocalExpenses(businessId);
  const updated = [newExpense, ...expenses];
  saveLocalExpenses(businessId, updated);

  try {
    const docRef = doc(db, `businesses/${businessId}/expenses`, expenseId);
    await setDoc(docRef, newExpense);
  } catch (err) {
    console.error('Failed to sync expense to Firestore:', err);
  }

  return newExpense;
}

export async function deleteFieldExpense(businessId: string, expenseId: string): Promise<void> {
  const expenses = getLocalExpenses(businessId).filter(e => e.id !== expenseId);
  saveLocalExpenses(businessId, expenses);

  try {
    await deleteDoc(doc(db, `businesses/${businessId}/expenses`, expenseId));
  } catch (err) {
    console.warn('Failed to delete expense from Firestore:', err);
  }
}
