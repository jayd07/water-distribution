import { BusinessAccount, BusinessWorker, UserSessionProfile, WorkerRole } from '../types';
import { db, getStoredUserEmail, LOCAL_USER_STORAGE_KEY } from '../config/firebase';
import { doc, getDoc, setDoc, collection, collectionGroup, getDocs, deleteDoc } from 'firebase/firestore';

const BUSINESSES_STORAGE_KEY = 'aquapure_businesses_v1';
const WORKERS_STORAGE_KEY = 'aquapure_workers_v1';
const ACTIVE_SESSION_KEY = 'aquapure_active_session_v1';

export const DEFAULT_BUSINESS_ID = 'AquaPure_Springs';

// Default initial business placeholder (unregistered)
export const DEFAULT_BUSINESS: BusinessAccount = {
  id: DEFAULT_BUSINESS_ID,
  name: '',
  ownerName: '',
  ownerPhone: '',
  ownerEmail: '',
  ownerUid: '',
  category: 'Packaged Water & Dispenser Supply',
  address: '',
  city: '',
  gstin: '',
  defaultJarRate: 35,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  workerPhones: [],
  workers: []
};

/**
 * Check whether a business is genuinely registered by a user or staff member.
 * Returns false for unconfigured placeholders or empty states.
 */
export function isRegisteredBusiness(business?: BusinessAccount | null): boolean {
  if (!business || !business.id) return false;
  if (business.id === DEFAULT_BUSINESS_ID || business.id === 'AquaPure_Springs') {
    return Boolean(
      business.name && 
      business.name.trim() !== '' && 
      business.name !== 'AquaPure Springs' && 
      (business.ownerEmail || business.ownerPhone || business.ownerUid)
    );
  }
  return Boolean(business.name && business.name.trim() !== '');
}

// Default initial workers (empty)
export const DEFAULT_WORKERS: BusinessWorker[] = [];

// Clean / normalize phone numbers (e.g. "+91 98765-43210" -> "9876543210")
export function normalizePhone(rawPhone: string): string {
  if (!rawPhone) return '';
  let cleaned = rawPhone.replace(/\D/g, '');
  if (cleaned.length > 10) {
    cleaned = cleaned.slice(-10);
  }
  return cleaned;
}

// Format 10-digit phone for clean UI display
export function formatPhone(phone: string): string {
  const norm = normalizePhone(phone);
  if (norm.length === 10) {
    return `+91 ${norm.slice(0, 5)} ${norm.slice(5)}`;
  }
  return phone;
}

// Retrieve all registered businesses from local store
export function getAllBusinesses(): BusinessAccount[] {
  try {
    const raw = localStorage.getItem(BUSINESSES_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const list: BusinessAccount[] = JSON.parse(raw);
    return list.filter(b => isRegisteredBusiness(b));
  } catch {
    return [];
  }
}

// Save businesses to local store
export function saveBusinesses(businesses: BusinessAccount[]): void {
  try {
    localStorage.setItem(BUSINESSES_STORAGE_KEY, JSON.stringify(businesses));
  } catch (err) {
    console.warn('Failed to persist businesses to localStorage', err);
  }
}

// Retrieve all workers from local store
export function getAllWorkers(): BusinessWorker[] {
  try {
    const raw = localStorage.getItem(WORKERS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(WORKERS_STORAGE_KEY, JSON.stringify(DEFAULT_WORKERS));
      return DEFAULT_WORKERS;
    }
    const list: BusinessWorker[] = JSON.parse(raw);
    // Filter dummy legacy worker ids
    return list.filter(w => w.id !== 'worker_001' && w.id !== 'worker_002');
  } catch {
    return DEFAULT_WORKERS;
  }
}

// Save workers to local store
export function saveWorkers(workers: BusinessWorker[]): void {
  try {
    localStorage.setItem(WORKERS_STORAGE_KEY, JSON.stringify(workers));
  } catch (err) {
    console.warn('Failed to persist workers to localStorage', err);
  }
}

// Get business by ID
export function getBusinessById(businessId: string): BusinessAccount | null {
  const businesses = getAllBusinesses();
  return businesses.find(b => b.id === businessId) || null;
}

/**
 * Robust mapping of Firestore document data to a full BusinessAccount object.
 * Guarantees upiId, Google Sheets details, contact info and defaults are preserved.
 */
export function mapDocToBusinessAccount(id: string, data: any): BusinessAccount {
  const normOwnerPhone = normalizePhone(data.ownerPhone || data.phone || '');
  const upi = (data.upiId || data.upi || data.vpa || data.upi_id || '').trim() || 
              (normOwnerPhone.length >= 10 ? `${normOwnerPhone.slice(-10)}@upi` : '');
  return {
    id,
    name: data.name || 'Water Business',
    ownerName: data.ownerName || 'Business Owner',
    ownerPhone: normOwnerPhone,
    ownerEmail: (data.ownerEmail || '').trim().toLowerCase(),
    ownerUid: data.ownerUid || '',
    category: data.category || 'Packaged Water & Dispenser Supply',
    address: data.address || '',
    city: data.city || '',
    gstin: data.gstin || '',
    upiId: upi,
    googleSheetsWebhookUrl: data.googleSheetsWebhookUrl || '',
    googleSheetsUrl: data.googleSheetsUrl || '',
    googleSheetId: data.googleSheetId || '',
    defaultJarRate: Number(data.defaultJarRate) || 35,
    createdAt: Number(data.createdAt) || Date.now(),
    updatedAt: Number(data.updatedAt) || Date.now(),
    workerPhones: Array.isArray(data.workerPhones) ? data.workerPhones.map((p: string) => normalizePhone(p)) : [],
    workers: Array.isArray(data.workers) ? data.workers : []
  };
}

/**
 * Synchronize all businesses from Firestore Cloud into local memory and localStorage.
 * Ensures that businesses registered or updated on mobile immediately populate on web.
 */
export async function syncBusinessesFromCloud(): Promise<BusinessAccount[]> {
  try {
    const colRef = collection(db, 'businesses');
    const snapshot = await getDocs(colRef);
    if (!snapshot.empty) {
      const cloudBusinesses: BusinessAccount[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data && docSnap.id) {
          cloudBusinesses.push(mapDocToBusinessAccount(docSnap.id, data));
        }
      });

      // Merge with existing local businesses
      const localBusinesses = getAllBusinesses();
      const mergedMap = new Map<string, BusinessAccount>();

      // Keep default business
      mergedMap.set(DEFAULT_BUSINESS.id, DEFAULT_BUSINESS);

      // Local entries first
      for (const lb of localBusinesses) {
        if (lb.id) mergedMap.set(lb.id, lb);
      }

      // Cloud entries take precedence
      for (const cb of cloudBusinesses) {
        if (cb.id) {
          const existing = mergedMap.get(cb.id);
          mergedMap.set(cb.id, {
            ...existing,
            ...cb
          });
        }
      }

      const mergedList = Array.from(mergedMap.values());
      saveBusinesses(mergedList);
      return mergedList;
    }
  } catch (err) {
    console.warn('[Cloud Sync] Failed to fetch businesses from Firestore:', err);
  }
  return getAllBusinesses();
}

/**
 * Synchronize worker assignments from Firestore.
 * Queries worker_assignments collection and subcollections so workers assigned on any device
 * immediately discover their employer business upon logging in.
 */
export async function syncWorkerAssignmentsFromCloud(): Promise<BusinessWorker[]> {
  try {
    const cloudWorkers: BusinessWorker[] = [];

    // 1. Fetch directly from collectionGroup('workers') across all business subcollections
    try {
      const groupSnap = await getDocs(collectionGroup(db, 'workers'));
      if (!groupSnap.empty) {
        groupSnap.forEach(docSnap => {
          const wd = docSnap.data();
          if (wd && wd.workerPhone) {
            const bId = wd.businessId || docSnap.ref.parent.parent?.id || '';
            const normP = normalizePhone(wd.workerPhone);
            if (bId && !cloudWorkers.some(cw => cw.businessId === bId && normalizePhone(cw.workerPhone) === normP)) {
              cloudWorkers.push({
                id: docSnap.id,
                businessId: bId,
                businessName: wd.businessName || 'Water Distribution',
                workerName: wd.workerName || 'Worker',
                workerPhone: normP,
                role: wd.role || 'DRIVER',
                assignedRoute: wd.assignedRoute || 'General Delivery Route',
                status: wd.status || 'ACTIVE',
                addedAt: Number(wd.addedAt) || Date.now(),
                addedByPhone: normalizePhone(wd.addedByPhone || ''),
                ownerName: wd.ownerName || 'Admin'
              });
            }
          }
        });
      }
    } catch (e) {
      console.warn('[Cloud Sync] collectionGroup workers query notice:', e);
    }

    // 2. Fetch from top-level worker_assignments
    try {
      const colRef = collection(db, 'worker_assignments');
      const snap = await getDocs(colRef);
      if (!snap.empty) {
        snap.forEach(docSnap => {
          const d = docSnap.data();
          if (d && d.workerPhone && d.businessId) {
            const normP = normalizePhone(d.workerPhone);
            if (!cloudWorkers.some(cw => cw.businessId === d.businessId && normalizePhone(cw.workerPhone) === normP)) {
              cloudWorkers.push({
                id: d.id || docSnap.id,
                businessId: d.businessId,
                businessName: d.businessName || 'Water Distribution',
                workerName: d.workerName || 'Worker',
                workerPhone: normP,
                role: d.role || 'DRIVER',
                assignedRoute: d.assignedRoute || 'General Delivery Route',
                status: d.status || 'ACTIVE',
                addedAt: Number(d.addedAt) || Date.now(),
                addedByPhone: normalizePhone(d.addedByPhone || ''),
                ownerName: d.ownerName || 'Admin'
              });
            }
          }
        });
      }
    } catch (e) {
      console.warn('[Cloud Sync] Worker assignments query notice:', e);
    }

    // 2.1 Directly query workers subcollection for every registered business
    const allBusinesses = getAllBusinesses();
    for (const b of allBusinesses) {
      if (!b.id || b.id === DEFAULT_BUSINESS.id) continue;
      try {
        const subSnap = await getDocs(collection(db, `businesses/${b.id}/workers`)).catch(() => null);
        if (subSnap && !subSnap.empty) {
          subSnap.forEach(docSnap => {
            const wd = docSnap.data();
            if (wd && wd.workerPhone) {
              const normP = normalizePhone(wd.workerPhone);
              if (!cloudWorkers.some(cw => cw.businessId === b.id && normalizePhone(cw.workerPhone) === normP)) {
                cloudWorkers.push({
                  id: docSnap.id,
                  businessId: b.id,
                  businessName: b.name,
                  workerName: wd.workerName || 'Worker',
                  workerPhone: normP,
                  role: wd.role || 'DRIVER',
                  assignedRoute: wd.assignedRoute || 'General Delivery Route',
                  status: wd.status || 'ACTIVE',
                  addedAt: Number(wd.addedAt) || Date.now(),
                  addedByPhone: normalizePhone(wd.addedByPhone || b.ownerPhone || ''),
                  ownerName: b.ownerName || 'Admin'
                });
              }
            }
          });
        }
      } catch {}

      // Check embedded workers array on business document
      if (Array.isArray(b.workers)) {
        for (const w of b.workers) {
          if (w && w.workerPhone) {
            const normP = normalizePhone(w.workerPhone);
            if (normP && !cloudWorkers.some(cw => cw.businessId === b.id && normalizePhone(cw.workerPhone) === normP)) {
              cloudWorkers.push({
                id: w.id || `worker_${b.id}_${normP}`,
                businessId: b.id,
                businessName: b.name,
                workerName: w.workerName || 'Worker',
                workerPhone: normP,
                role: w.role || 'DRIVER',
                assignedRoute: w.assignedRoute || 'General Delivery Route',
                status: w.status || 'ACTIVE',
                addedAt: Number(w.addedAt) || Date.now(),
                addedByPhone: normalizePhone(w.addedByPhone || b.ownerPhone || ''),
                ownerName: b.ownerName || 'Admin'
              });
            }
          }
        }
      }

      // Check embedded workerPhones on business document
      if (Array.isArray(b.workerPhones)) {
        for (const wp of b.workerPhones) {
          const normP = normalizePhone(wp);
          if (normP && !cloudWorkers.some(cw => cw.businessId === b.id && normalizePhone(cw.workerPhone) === normP)) {
            cloudWorkers.push({
              id: `worker_${b.id}_${normP}`,
              businessId: b.id,
              businessName: b.name,
              workerName: 'Staff Member',
              workerPhone: normP,
              role: 'DRIVER',
              assignedRoute: 'General Delivery Route',
              status: 'ACTIVE',
              addedAt: b.updatedAt || Date.now(),
              addedByPhone: b.ownerPhone,
              ownerName: b.ownerName
            });
          }
        }
      }
    }

    // 3. Enrich workers with proper business names & owner names, and ensure top-level index is maintained
    for (const w of cloudWorkers) {
      const matchBiz = allBusinesses.find(b => b.id === w.businessId);
      if (matchBiz) {
        if (!w.businessName || w.businessName === 'Water Distribution') {
          w.businessName = matchBiz.name;
        }
        if (!w.ownerName || w.ownerName === 'Admin') {
          w.ownerName = matchBiz.ownerName;
        }
      }
      // Backfill top-level worker_assignments for indexed cross-device lookup
      try {
        const assignDocRef = doc(db, 'worker_assignments', `${w.workerPhone}_${w.businessId}`);
        setDoc(assignDocRef, { ...w, syncTimestamp: Date.now() }, { merge: true }).catch(() => {});
      } catch {}
    }

    if (cloudWorkers.length > 0) {
      const localWorkers = getAllWorkers();
      const map = new Map<string, BusinessWorker>();
      for (const lw of localWorkers) {
        map.set(`${lw.businessId}_${normalizePhone(lw.workerPhone)}`, lw);
      }
      for (const cw of cloudWorkers) {
        map.set(`${cw.businessId}_${normalizePhone(cw.workerPhone)}`, cw);
      }
      const merged = Array.from(map.values());
      saveWorkers(merged);
      return merged;
    }
  } catch (err) {
    console.warn('[Cloud Sync] Failed to sync worker assignments:', err);
  }
  return getAllWorkers();
}

/**
 * Update existing business details (settings, jar rates, contact info).
 * Persists locally and writes to Firestore.
 */
export async function updateBusiness(
  businessId: string, 
  updates: Partial<BusinessAccount>
): Promise<BusinessAccount | null> {
  const businesses = getAllBusinesses();
  const index = businesses.findIndex(b => b.id === businessId);
  if (index === -1) return null;

  const updated: BusinessAccount = {
    ...businesses[index],
    ...updates,
    updatedAt: Date.now()
  };
  businesses[index] = updated;
  saveBusinesses(businesses);

  // Sync to Firestore
  try {
    const bizRef = doc(db, 'businesses', businessId);
    await setDoc(bizRef, updated, { merge: true });
  } catch (err) {
    console.error('Failed to sync updated business settings to Firestore:', err);
  }

  return updated;
}

/**
 * Register a brand new business.
 * Persists locally, creates initial collections, and writes directly to Firestore.
 */
export async function registerNewBusiness(data: {
  name: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail?: string;
  ownerUid?: string;
  category?: string;
  address?: string;
  city?: string;
  gstin?: string;
  upiId?: string;
  googleSheetsWebhookUrl?: string;
  googleSheetsUrl?: string;
  googleSheetId?: string;
  defaultJarRate?: number;
}): Promise<BusinessAccount> {
  const normPhone = normalizePhone(data.ownerPhone);
  const slug = data.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .slice(0, 32);
  const id = `biz_${slug}_${Date.now().toString().slice(-4)}`;

  const newBiz: BusinessAccount = {
    id,
    name: data.name.trim(),
    ownerName: data.ownerName.trim(),
    ownerPhone: normPhone,
    ownerEmail: (data.ownerEmail || '').trim().toLowerCase(),
    ownerUid: data.ownerUid || '',
    category: data.category || 'Water Distribution & Bottle Supply',
    address: data.address?.trim() || '',
    city: data.city?.trim() || '',
    gstin: data.gstin?.trim() || '',
    upiId: data.upiId?.trim() || '',
    googleSheetsWebhookUrl: data.googleSheetsWebhookUrl?.trim() || '',
    googleSheetsUrl: data.googleSheetsUrl?.trim() || '',
    googleSheetId: data.googleSheetId?.trim() || '',
    defaultJarRate: Number(data.defaultJarRate) || 35,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    workerPhones: [],
    workers: []
  };

  const businesses = getAllBusinesses();
  // Filter out any default placeholder with empty name
  const updatedBusinesses = businesses.filter(b => b.id !== DEFAULT_BUSINESS.id || (b.name && b.name.trim() !== ''));
  updatedBusinesses.push(newBiz);
  saveBusinesses(updatedBusinesses);

  // Initialize fresh business storage in localStore for this new business
  try {
    const bizKey = `aquapure_data_${id}`;
    const initialData = {
      inventory: [],
      customers: [],
      deliveries: [],
      transactions: [],
      orders: [],
      lastUpdated: Date.now()
    };
    localStorage.setItem(bizKey, JSON.stringify(initialData));
  } catch (e) {
    console.warn('Could not initialize local store for business', e);
  }

  // Persist directly to Firestore
  try {
    const bizDocRef = doc(db, 'businesses', id);
    await setDoc(bizDocRef, {
      ...newBiz,
      syncTimestamp: Date.now()
    }, { merge: true });
  } catch (err) {
    console.error('Failed to sync new business to Firestore:', err);
  }

  // Set as active session
  setActiveSession(newBiz, 'OWNER');

  return newBiz;
}

// Get workers for a specific business
export function getWorkersForBusiness(businessId: string): BusinessWorker[] {
  const workers = getAllWorkers();
  return workers.filter(w => w.businessId === businessId);
}

// Save workers for a specific business into local storage
export function saveWorkersForBusiness(businessId: string, bizWorkers: BusinessWorker[]): void {
  const all = getAllWorkers();
  const others = all.filter(w => w.businessId !== businessId);
  const combined = [...others, ...bizWorkers];
  saveWorkers(combined);
}

/**
 * Owner assigns a worker to their business by entering phone number.
 * Syncs locally and to Firestore (subcollection, top-level assignment, and business doc).
 */
export async function assignWorkerToBusiness(
  businessId: string,
  workerData: {
    workerName: string;
    workerPhone: string;
    role: WorkerRole;
    assignedRoute?: string;
  },
  ownerPhone: string
): Promise<BusinessWorker> {
  const biz = getBusinessById(businessId);
  const bizName = biz?.name || 'Water Distribution';
  const ownerName = biz?.ownerName || 'Business Owner';
  const normPhone = normalizePhone(workerData.workerPhone);

  const workers = getAllWorkers();

  // Check if worker with this phone is already assigned to this business
  const existingIdx = workers.findIndex(
    w => w.businessId === businessId && normalizePhone(w.workerPhone) === normPhone
  );

  const workerRecord: BusinessWorker = {
    id: existingIdx >= 0 ? workers[existingIdx].id : `worker_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    businessId,
    businessName: bizName,
    workerName: workerData.workerName.trim(),
    workerPhone: normPhone,
    role: workerData.role,
    assignedRoute: workerData.assignedRoute?.trim() || 'General Delivery Route',
    status: 'ACTIVE',
    addedAt: Date.now(),
    addedByPhone: normalizePhone(ownerPhone),
    ownerName
  };

  if (existingIdx >= 0) {
    workers[existingIdx] = workerRecord;
  } else {
    workers.push(workerRecord);
  }

  saveWorkers(workers);

  // Sync to Firestore in multiple places for multi-device discovery:
  // 1. Subcollection: businesses/{businessId}/workers/{workerId}
  // 2. Top-level assignment: worker_assignments/{normPhone}_{businessId}
  // 3. Directly on business doc: update workerPhones array and workers array
  const workerDocRef = doc(db, `businesses/${businessId}/workers`, workerRecord.id);
  const assignDocRef = doc(db, 'worker_assignments', `${normPhone}_${businessId}`);
  const bizDocRef = doc(db, 'businesses', businessId);

  const updatedBizWorkers = workers.filter(w => w.businessId === businessId);
  const updatedWorkerPhones = Array.from(new Set(updatedBizWorkers.map(w => normalizePhone(w.workerPhone))));

  try {
    await setDoc(workerDocRef, { ...workerRecord, syncTimestamp: Date.now() }, { merge: true });
  } catch (err) {
    console.error('Failed to write worker to businesses subcollection:', err);
  }

  try {
    await setDoc(assignDocRef, {
      id: `${normPhone}_${businessId}`,
      workerPhone: normPhone,
      businessId,
      businessName: bizName,
      workerName: workerData.workerName.trim(),
      role: workerData.role,
      assignedRoute: workerData.assignedRoute || 'General Delivery Route',
      status: 'ACTIVE',
      addedAt: Date.now(),
      addedByPhone: normalizePhone(ownerPhone),
      ownerName
    }, { merge: true });
  } catch (err) {
    console.error('Failed to write worker assignment:', err);
  }

  try {
    await setDoc(bizDocRef, {
      workerPhones: updatedWorkerPhones,
      workers: updatedBizWorkers,
      updatedAt: Date.now()
    }, { merge: true });
  } catch (err) {
    console.error('Failed to update business document with workers:', err);
  }

  return workerRecord;
}

/**
 * Remove worker from business locally and from Firestore
 */
export async function removeWorkerFromBusiness(
  workerId: string, 
  businessId?: string,
  callerRole?: 'OWNER' | 'WORKER'
): Promise<void> {
  if (callerRole === 'WORKER') {
    throw new Error('Unauthorized: Only the business owner can remove staff members.');
  }

  const workers = getAllWorkers();
  const workerToRemove = workers.find(w => w.id === workerId);
  const updated = workers.filter(w => w.id !== workerId);
  saveWorkers(updated);

  const bId = businessId || workerToRemove?.businessId;
  const normPhone = workerToRemove ? normalizePhone(workerToRemove.workerPhone) : '';

  if (bId) {
    try {
      const workerDocRef = doc(db, `businesses/${bId}/workers`, workerId);
      const bizDocRef = doc(db, 'businesses', bId);
      
      const promises: Promise<any>[] = [deleteDoc(workerDocRef)];
      if (normPhone) {
        promises.push(deleteDoc(doc(db, 'worker_assignments', `${normPhone}_${bId}`)));
      }

      // Also clean worker assignment from business doc workers/workerPhones arrays
      const bizSnap = await getDoc(bizDocRef);
      if (bizSnap.exists()) {
        const bizData = bizSnap.data() as BusinessAccount;
        const updatedPhones = (bizData.workerPhones || []).filter(p => normalizePhone(p) !== normPhone);
        const updatedWorkers = (bizData.workers || []).filter(w => w.id !== workerId && normalizePhone(w.workerPhone) !== normPhone);
        promises.push(setDoc(bizDocRef, {
          workerPhones: updatedPhones,
          workers: updatedWorkers,
          updatedAt: Date.now()
        }, { merge: true }));
      }

      await Promise.allSettled(promises);
    } catch (err) {
      console.warn('Error removing worker from cloud:', err);
    }
  }
}

/**
 * Permanently delete a business and all its corresponding data (Owner only)
 * - Deletes all subcollections (customers, inventory, deliveries, transactions, orders, workers)
 * - Deletes top-level worker_assignments
 * - Deletes the businesses/{businessId} document
 * - Cleans localStorage records and caches
 */
export async function deleteBusinessCompletely(
  businessId: string,
  callerRole?: 'OWNER' | 'WORKER'
): Promise<void> {
  if (callerRole === 'WORKER') {
    throw new Error('Unauthorized: Only the registered business owner can delete this business.');
  }
  if (!businessId) return;

  // 1. Delete from Firestore
  try {
    const subcols = ['customers', 'inventory', 'deliveries', 'transactions', 'orders', 'workers'];
    for (const sc of subcols) {
      try {
        const subSnap = await getDocs(collection(db, `businesses/${businessId}/${sc}`));
        const deletePromises = subSnap.docs.map(d => deleteDoc(doc(db, `businesses/${businessId}/${sc}`, d.id)));
        await Promise.allSettled(deletePromises);
      } catch (err) {
        console.warn(`Could not clear subcollection ${sc} for ${businessId}:`, err);
      }
    }

    // Delete matching worker assignments
    try {
      const assignSnap = await getDocs(collection(db, 'worker_assignments'));
      const toDeleteAssigns = assignSnap.docs.filter(d => {
        const data = d.data();
        return data.businessId === businessId || d.id.endsWith(`_${businessId}`);
      });
      await Promise.allSettled(toDeleteAssigns.map(d => deleteDoc(doc(db, 'worker_assignments', d.id))));
    } catch (err) {
      console.warn('Could not clear worker assignments:', err);
    }

    // Delete the business document itself
    await deleteDoc(doc(db, 'businesses', businessId));
  } catch (err) {
    console.warn('Error deleting business document from Firestore:', err);
  }

  // 2. Clean Local Storage
  try {
    const allBusinesses = getAllBusinesses().filter(b => b.id !== businessId);
    saveBusinesses(allBusinesses);

    const allWorkers = getAllWorkers().filter(w => w.businessId !== businessId);
    saveWorkers(allWorkers);

    localStorage.removeItem(`water_distribution_data_${businessId}`);
    localStorage.removeItem(`water_distribution_metrics_${businessId}`);

    const active = getActiveSession();
    if (active?.activeBusinessId === businessId) {
      clearActiveSession();
    }
  } catch (err) {
    console.warn('Error cleaning local storage for deleted business:', err);
  }
}

/**
 * Reset / purge deliveries, transactions, and test data for a business while preserving core inventory and settings
 */
export async function clearBusinessStaleData(businessId: string): Promise<void> {
  if (!businessId) return;

  try {
    const subcols = ['deliveries', 'transactions', 'orders'];
    for (const sc of subcols) {
      const subSnap = await getDocs(collection(db, `businesses/${businessId}/${sc}`));
      const deletePromises = subSnap.docs.map(d => deleteDoc(doc(db, `businesses/${businessId}/${sc}`, d.id)));
      await Promise.allSettled(deletePromises);
    }
  } catch (err) {
    console.warn('Error clearing stale subcollections from Firestore:', err);
  }

  // Reset local store deliveries and transactions
  try {
    const storeRaw = localStorage.getItem(`water_distribution_data_${businessId}`);
    if (storeRaw) {
      const parsed = JSON.parse(storeRaw);
      parsed.deliveries = [];
      parsed.transactions = [];
      parsed.orders = [];
      localStorage.setItem(`water_distribution_data_${businessId}`, JSON.stringify(parsed));
    }
  } catch {}
}

export interface DiscoveredUserBusiness {
  business: BusinessAccount;
  role: 'OWNER' | 'WORKER';
  workerRecord?: BusinessWorker;
}

/**
 * Synchronous lookup of businesses for a phone number from local memory.
 */
export function getBusinessesForPhoneNumber(rawPhone: string): {
  owned: BusinessAccount[];
  assignedAsWorker: { business: BusinessAccount; workerRecord: BusinessWorker }[];
} {
  const norm = normalizePhone(rawPhone);
  if (!norm) {
    return { owned: [], assignedAsWorker: [] };
  }

  const allBusinesses = getAllBusinesses();
  const allWorkers = getAllWorkers();

  // 1. Owned businesses
  const owned = allBusinesses.filter(b => normalizePhone(b.ownerPhone) === norm);

  // 2. Assigned businesses
  const assignedAsWorker: { business: BusinessAccount; workerRecord: BusinessWorker }[] = [];
  const workerEntries = allWorkers.filter(w => normalizePhone(w.workerPhone) === norm);

  for (const entry of workerEntries) {
    let foundBiz = allBusinesses.find(b => b.id === entry.businessId);
    if (!foundBiz && entry.businessId) {
      // Build robust fallback business account from worker entry if not locally synced yet
      foundBiz = {
        id: entry.businessId,
        name: entry.businessName || 'Water Business',
        ownerName: entry.ownerName || 'Business Owner',
        ownerPhone: entry.addedByPhone || '',
        ownerEmail: '',
        ownerUid: '',
        category: 'Packaged Water & Dispenser Supply',
        address: '',
        city: '',
        gstin: '',
        defaultJarRate: 35,
        createdAt: entry.addedAt || Date.now(),
        updatedAt: Date.now(),
        workerPhones: [norm],
        workers: [entry]
      };
    }
    if (foundBiz) {
      if (!assignedAsWorker.some(a => a.business.id === foundBiz.id)) {
        assignedAsWorker.push({
          business: foundBiz,
          workerRecord: entry
        });
      }
    }
  }

  // Also check businesses array directly for embedded workers or workerPhones
  for (const b of allBusinesses) {
    if (b.id === DEFAULT_BUSINESS.id) continue;
    if (Array.isArray(b.workers)) {
      for (const w of b.workers) {
        if (normalizePhone(w.workerPhone) === norm) {
          if (!assignedAsWorker.some(a => a.business.id === b.id)) {
            assignedAsWorker.push({
              business: b,
              workerRecord: w
            });
          }
        }
      }
    }
    if (Array.isArray(b.workerPhones) && b.workerPhones.map(p => normalizePhone(p)).includes(norm)) {
      if (!assignedAsWorker.some(a => a.business.id === b.id)) {
        assignedAsWorker.push({
          business: b,
          workerRecord: {
            id: `worker_${b.id}_${norm}`,
            businessId: b.id,
            businessName: b.name,
            workerName: 'Staff Member',
            workerPhone: norm,
            role: 'DRIVER',
            assignedRoute: 'General Delivery Route',
            status: 'ACTIVE',
            addedAt: b.updatedAt || Date.now(),
            addedByPhone: b.ownerPhone,
            ownerName: b.ownerName
          }
        });
      }
    }
  }

  // Ensure any business where the user is an assigned worker is excluded from owned
  const filteredOwned = owned.filter(b => 
    normalizePhone(b.ownerPhone) === norm && 
    !assignedAsWorker.some(a => a.business.id === b.id)
  );

  return { owned: filteredOwned, assignedAsWorker };
}

/**
 * Asynchronous cross-device lookup:
 * Performs collection group queries and direct collection queries on 'worker_assignments'
 * and 'workers' using the authenticated user's normalized phone number.
 * Upon finding matches, returns all associated parent 'businessId' values so the UI
 * can populate the business selection screen correctly for workers without relying on cache.
 */
export async function getBusinessesForPhoneNumberAsync(rawPhone: string): Promise<{
  owned: BusinessAccount[];
  assignedAsWorker: { business: BusinessAccount; workerRecord: BusinessWorker }[];
}> {
  const norm = normalizePhone(rawPhone);
  if (!norm) {
    return { owned: [], assignedAsWorker: [] };
  }

  const phoneRegex = new RegExp(`(^|\\D)${norm}($|\\D)`);
  const idPrefixRegex = new RegExp(`^${norm}_|_${norm}$`);

  const owned: BusinessAccount[] = [];
  const assignedAsWorker: { business: BusinessAccount; workerRecord: BusinessWorker }[] = [];
  const businessMap = new Map<string, BusinessAccount>();
  const discoveredWorkerRecords: BusinessWorker[] = [];

  // 1. Direct fetch of all businesses from Firestore to index business details
  try {
    const bizSnap = await getDocs(collection(db, 'businesses'));
    bizSnap.forEach(docSnap => {
      const data = docSnap.data();
      if (data && docSnap.id) {
        const biz: BusinessAccount = mapDocToBusinessAccount(docSnap.id, data);
        businessMap.set(docSnap.id, biz);

        // Check if this user genuinely owns the business
        const normOwnerPhone = normalizePhone(biz.ownerPhone);
        if (normOwnerPhone === norm || phoneRegex.test(data.ownerPhone || '')) {
          if (!owned.some(o => o.id === biz.id)) {
            owned.push(biz);
          }
        }

        // Check embedded worker arrays on business document
        if (Array.isArray(biz.workers)) {
          for (const w of biz.workers) {
            const normWPhone = normalizePhone(w.workerPhone);
            if (normWPhone === norm || phoneRegex.test(w.workerPhone || '')) {
              discoveredWorkerRecords.push({
                id: w.id || `worker_${biz.id}_${norm}`,
                businessId: biz.id,
                businessName: biz.name,
                workerName: w.workerName || 'Worker',
                workerPhone: norm,
                role: w.role || 'DRIVER',
                assignedRoute: w.assignedRoute || 'General Delivery Route',
                status: w.status || 'ACTIVE',
                addedAt: Number(w.addedAt) || Date.now(),
                addedByPhone: biz.ownerPhone,
                ownerName: biz.ownerName
              });
            }
          }
        }

        // Check embedded workerPhones on business document
        if (Array.isArray(biz.workerPhones)) {
          for (const wp of biz.workerPhones) {
            const normWp = normalizePhone(wp);
            if (normWp === norm || phoneRegex.test(wp || '')) {
              discoveredWorkerRecords.push({
                id: `worker_${biz.id}_${norm}`,
                businessId: biz.id,
                businessName: biz.name,
                workerName: 'Staff Member',
                workerPhone: norm,
                role: 'DRIVER',
                assignedRoute: 'General Delivery Route',
                status: 'ACTIVE',
                addedAt: biz.updatedAt || Date.now(),
                addedByPhone: biz.ownerPhone,
                ownerName: biz.ownerName
              });
            }
          }
        }
      }
    });
  } catch (err) {
    console.warn('[Cloud Sync] Businesses collection fetch warning:', err);
  }

  // 2. Perform queries on 'worker_assignments' collection directly & via collectionGroup
  try {
    const [assignSnap, groupAssignSnap] = await Promise.allSettled([
      getDocs(collection(db, 'worker_assignments')),
      getDocs(collectionGroup(db, 'worker_assignments'))
    ]);

    const processAssignDoc = (docSnap: any) => {
      const data = docSnap.data();
      if (data) {
        const rawWPhone = data.workerPhone || '';
        const normWPhone = normalizePhone(rawWPhone);
        const docIdMatches = idPrefixRegex.test(docSnap.id) || docSnap.id.includes(norm);
        const phoneMatches = normWPhone === norm || phoneRegex.test(rawWPhone);

        if (phoneMatches || docIdMatches) {
          const targetBizId = data.businessId || docSnap.ref.parent.parent?.id || docSnap.id.split('_').pop() || '';
          discoveredWorkerRecords.push({
            id: data.id || docSnap.id,
            businessId: targetBizId,
            businessName: data.businessName || 'Water Business',
            workerName: data.workerName || 'Worker',
            workerPhone: norm,
            role: data.role || 'DRIVER',
            assignedRoute: data.assignedRoute || 'General Delivery Route',
            status: data.status || 'ACTIVE',
            addedAt: Number(data.addedAt) || Date.now(),
            addedByPhone: normalizePhone(data.addedByPhone || ''),
            ownerName: data.ownerName || 'Admin'
          });
        }
      }
    };

    if (assignSnap.status === 'fulfilled') {
      assignSnap.value.forEach(processAssignDoc);
    }
    if (groupAssignSnap.status === 'fulfilled') {
      groupAssignSnap.value.forEach(processAssignDoc);
    }
  } catch (err) {
    console.warn('[Cloud Sync] worker_assignments query warning:', err);
  }

  // 3. Collection group query on 'workers' across all businesses
  try {
    const groupSnap = await getDocs(collectionGroup(db, 'workers'));
    groupSnap.forEach(docSnap => {
      const data = docSnap.data();
      if (data && data.workerPhone) {
        const normWPhone = normalizePhone(data.workerPhone);
        const phoneMatches = normWPhone === norm || phoneRegex.test(data.workerPhone);
        if (phoneMatches) {
          const parentBizId = data.businessId || docSnap.ref.parent.parent?.id || '';
          discoveredWorkerRecords.push({
            id: docSnap.id,
            businessId: parentBizId,
            businessName: data.businessName || 'Water Business',
            workerName: data.workerName || 'Worker',
            workerPhone: norm,
            role: data.role || 'DRIVER',
            assignedRoute: data.assignedRoute || 'General Delivery Route',
            status: data.status || 'ACTIVE',
            addedAt: Number(data.addedAt) || Date.now(),
            addedByPhone: normalizePhone(data.addedByPhone || ''),
            ownerName: data.ownerName || 'Admin'
          });
        }
      }
    });
  } catch (err) {
    console.warn('[Cloud Sync] CollectionGroup workers query warning:', err);
  }

  // 4. Resolve parent businessId values for all discovered worker records
  for (const wRecord of discoveredWorkerRecords) {
    if (!wRecord.businessId) continue;
    let targetBiz = businessMap.get(wRecord.businessId);

    if (!targetBiz) {
      // Fetch missing business document by ID from Firestore
      try {
        const bDoc = await getDoc(doc(db, 'businesses', wRecord.businessId));
        if (bDoc.exists()) {
          targetBiz = mapDocToBusinessAccount(bDoc.id, bDoc.data());
          businessMap.set(wRecord.businessId, targetBiz);
        }
      } catch {}
    }

    if (!targetBiz) {
      const fallbackPhone = normalizePhone(wRecord.addedByPhone || '');
      targetBiz = {
        id: wRecord.businessId,
        name: wRecord.businessName || 'Water Business',
        ownerName: wRecord.ownerName || 'Business Owner',
        ownerPhone: fallbackPhone,
        ownerEmail: '',
        ownerUid: '',
        category: 'Packaged Water & Dispenser Supply',
        address: '',
        city: '',
        gstin: '',
        upiId: fallbackPhone.length >= 10 ? `${fallbackPhone.slice(-10)}@upi` : '',
        defaultJarRate: 35,
        createdAt: Number(wRecord.addedAt) || Date.now(),
        updatedAt: Date.now(),
        workerPhones: [norm],
        workers: [wRecord]
      };
      businessMap.set(wRecord.businessId, targetBiz);
    }

    if (!assignedAsWorker.some(a => a.business.id === targetBiz!.id)) {
      assignedAsWorker.push({
        business: targetBiz,
        workerRecord: wRecord
      });
    }
  }

  // Save discovered businesses & workers to memory and local storage
  if (businessMap.size > 0) {
    saveBusinesses(Array.from(businessMap.values()));
  }
  if (discoveredWorkerRecords.length > 0) {
    const existingWorkers = getAllWorkers();
    const map = new Map<string, BusinessWorker>();
    for (const ew of existingWorkers) {
      map.set(`${ew.businessId}_${normalizePhone(ew.workerPhone)}`, ew);
    }
    for (const dw of discoveredWorkerRecords) {
      map.set(`${dw.businessId}_${normalizePhone(dw.workerPhone)}`, dw);
    }
    saveWorkers(Array.from(map.values()));
  }

  // 5. Strict filtering: A business cannot be in 'owned' if the user is assigned as a worker,
  // unless the user's phone strictly matches the registered owner phone.
  const filteredOwned = owned.filter(b => {
    const isStrictOwner = normalizePhone(b.ownerPhone) === norm;
    const isAssignedWorker = assignedAsWorker.some(a => a.business.id === b.id);
    return isStrictOwner && !isAssignedWorker;
  });

  return { owned: filteredOwned, assignedAsWorker };
}

/**
 * Find registered business associated with user's email, phone, or UID.
 * Checks both Business Owner status and Worker/Driver assignments.
 * Ensures cross-device sign-in matches the cloud-stored business.
 */
export async function findBusinessForUserAsync(
  userEmail?: string | null,
  userPhone?: string | null,
  userUid?: string | null
): Promise<DiscoveredUserBusiness | null> {
  const normPhone = userPhone ? normalizePhone(userPhone) : '';
  const cleanEmail = (userEmail || '').trim().toLowerCase();

  // Sync latest from cloud
  const businesses = await syncBusinessesFromCloud();
  const allWorkers = await syncWorkerAssignmentsFromCloud();

  // 1. Match by Email as Owner (primary for Google Login on mobile & web)
  if (cleanEmail) {
    const byEmail = businesses.find(b => 
      b.id !== DEFAULT_BUSINESS.id && 
      b.ownerEmail && 
      b.ownerEmail.trim().toLowerCase() === cleanEmail
    );
    if (byEmail) {
      return { business: byEmail, role: 'OWNER' };
    }
  }

  // 2. Match by Phone as Owner (primary for Mobile OTP & Phone login)
  if (normPhone) {
    const byPhone = businesses.find(b => 
      b.id !== DEFAULT_BUSINESS.id && 
      normalizePhone(b.ownerPhone) === normPhone
    );
    if (byPhone) {
      return { business: byPhone, role: 'OWNER' };
    }
  }

  // 3. Match by Firebase UID as Owner
  if (userUid) {
    const byUid = businesses.find(b => 
      b.id !== DEFAULT_BUSINESS.id && 
      b.ownerUid === userUid
    );
    if (byUid) {
      return { business: byUid, role: 'OWNER' };
    }
  }

  // Helper to resolve or fetch business by ID
  const resolveBizById = async (bizId: string, fallbackWorker?: BusinessWorker): Promise<BusinessAccount | null> => {
    let biz = businesses.find(b => b.id === bizId) || getBusinessById(bizId);
    if (!biz && bizId && bizId !== DEFAULT_BUSINESS.id) {
      try {
        const snap = await getDoc(doc(db, 'businesses', bizId));
        if (snap.exists()) {
          biz = mapDocToBusinessAccount(snap.id, snap.data());
          const allB = getAllBusinesses();
          if (!allB.some(b => b.id === snap.id)) {
            allB.push(biz);
            saveBusinesses(allB);
          }
        }
      } catch {}
    }
    if (!biz && fallbackWorker && bizId) {
      const fallbackPhone = normalizePhone(fallbackWorker.addedByPhone || '');
      biz = {
        id: bizId,
        name: fallbackWorker.businessName || 'Water Business',
        ownerName: fallbackWorker.ownerName || 'Business Owner',
        ownerPhone: fallbackPhone,
        ownerEmail: '',
        ownerUid: '',
        category: 'Packaged Water & Dispenser Supply',
        address: '',
        city: '',
        gstin: '',
        upiId: fallbackPhone.length >= 10 ? `${fallbackPhone.slice(-10)}@upi` : '',
        defaultJarRate: 35,
        createdAt: fallbackWorker.addedAt || Date.now(),
        updatedAt: Date.now(),
        workerPhones: [fallbackWorker.workerPhone],
        workers: [fallbackWorker]
      };
    }
    return biz || null;
  };

  // 4. Match by Phone as Assigned Worker / Driver
  if (normPhone) {
    // Check in allWorkers
    const workerEntry = allWorkers.find(w => normalizePhone(w.workerPhone) === normPhone);
    if (workerEntry && workerEntry.businessId) {
      const biz = await resolveBizById(workerEntry.businessId, workerEntry);
      if (biz) {
        return { business: biz, role: 'WORKER', workerRecord: workerEntry };
      }
    }

    // Check directly in business documents
    for (const b of businesses) {
      if (b.id === DEFAULT_BUSINESS.id) continue;
      if (Array.isArray(b.workers)) {
        const found = b.workers.find(w => normalizePhone(w.workerPhone) === normPhone);
        if (found) {
          return { business: b, role: 'WORKER', workerRecord: found };
        }
      }
      if (Array.isArray(b.workerPhones) && b.workerPhones.map(p => normalizePhone(p)).includes(normPhone)) {
        const workerRec: BusinessWorker = {
          id: `worker_${b.id}_${normPhone}`,
          businessId: b.id,
          businessName: b.name,
          workerName: 'Staff Member',
          workerPhone: normPhone,
          role: 'DRIVER',
          assignedRoute: 'General Delivery Route',
          status: 'ACTIVE',
          addedAt: b.updatedAt || Date.now(),
          addedByPhone: b.ownerPhone,
          ownerName: b.ownerName
        };
        return {
          business: b,
          role: 'WORKER',
          workerRecord: workerRec
        };
      }
    }
  }

  // 5. Match by Email or Staff identifier as Worker
  if (cleanEmail) {
    const workerByEmail = allWorkers.find(w => {
      const wName = (w.workerName || '').trim().toLowerCase();
      const normWPhone = normalizePhone(w.workerPhone);
      return (
        (normWPhone.length >= 10 && cleanEmail.includes(normWPhone)) ||
        (wName.length >= 2 && cleanEmail.startsWith(wName.replace(/\s+/g, '.'))) ||
        (wName.length >= 2 && cleanEmail.startsWith(wName.replace(/\s+/g, ''))) ||
        (w.id && cleanEmail.includes(w.id.toLowerCase()))
      );
    });
    if (workerByEmail && workerByEmail.businessId) {
      const biz = await resolveBizById(workerByEmail.businessId, workerByEmail);
      if (biz) {
        return { business: biz, role: 'WORKER', workerRecord: workerByEmail };
      }
    }
  }

  // 6. Check existing active session to retain worker role if already selected
  const activeSess = getActiveSession();
  if (activeSess && activeSess.role === 'WORKER' && activeSess.activeBusinessId) {
    const biz = await resolveBizById(activeSess.activeBusinessId, activeSess.workerRecord);
    if (biz) {
      return { business: biz, role: 'WORKER', workerRecord: activeSess.workerRecord };
    }
  }

  return null;
}

// Active session helpers
export function getActiveSession(): UserSessionProfile | null {
  try {
    const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Alias for getActiveSession
export function getUserSession(): UserSessionProfile | null {
  return getActiveSession();
}

// Retrieve currently active business from session or fall back to default
export function getActiveBusiness(): BusinessAccount {
  const session = getActiveSession();
  if (session?.activeBusinessId) {
    const biz = getBusinessById(session.activeBusinessId);
    if (biz && isRegisteredBusiness(biz)) return biz;
  }
  return DEFAULT_BUSINESS;
}

// Retrieve workers for a specific business
export function getBusinessWorkers(businessId: string): BusinessWorker[] {
  return getAllWorkers().filter(w => w.businessId === businessId);
}

// Set active session either with an object or with parameters
export function setActiveSession(
  sessionOrBiz: UserSessionProfile | BusinessAccount,
  role?: 'OWNER' | 'WORKER',
  workerRecord?: BusinessWorker
): UserSessionProfile {
  let finalSession: UserSessionProfile;

  if ('activeBusinessId' in sessionOrBiz) {
    finalSession = { ...(sessionOrBiz as UserSessionProfile) };
  } else {
    const biz = sessionOrBiz as BusinessAccount;
    const isOwner = role === 'OWNER';
    finalSession = {
      phoneNumber: isOwner ? biz.ownerPhone : workerRecord?.workerPhone || '',
      displayName: isOwner ? biz.ownerName : workerRecord?.workerName || 'Worker',
      activeBusinessId: biz.id,
      role: role || 'OWNER',
      workerRecord: workerRecord
    };
  }

  // Enforce security rule: Workers cannot log in or operate as OWNER for businesses they do not own
  if (finalSession.activeBusinessId) {
    const targetBiz = getBusinessById(finalSession.activeBusinessId);
    if (targetBiz) {
      const normUserPhone = normalizePhone(finalSession.phoneNumber);
      const normOwnerPhone = normalizePhone(targetBiz.ownerPhone);
      const isOwner = Boolean(normOwnerPhone && normUserPhone && normOwnerPhone === normUserPhone);

      if (!isOwner) {
        // If not the registered owner, enforce WORKER role
        if (finalSession.role === 'OWNER' && (finalSession.workerRecord || targetBiz.workerPhones?.includes(normUserPhone))) {
          finalSession.role = 'WORKER';
        }
      }
    }
  }

  try {
    localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(finalSession));
  } catch {}

  return finalSession;
}

export function clearActiveSession(): void {
  try {
    localStorage.removeItem(ACTIVE_SESSION_KEY);
    localStorage.removeItem(LOCAL_USER_STORAGE_KEY);
    sessionStorage.clear();
  } catch {}
}
