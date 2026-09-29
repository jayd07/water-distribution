import React, { useEffect, useState } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  limit,
  deleteDoc,
  doc,
  getDocs
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  db, 
  auth, 
  DEFAULT_BUSINESS_ID, 
  handleFirestoreError, 
  OperationType,
  getStoredUserEmail,
  setStoredUserEmail,
  clearStoredUserEmail,
  signOutUser 
} from './config/firebase';
import { 
  InventoryItem, 
  Customer, 
  DeliveryLog, 
  TransactionRecord, 
  ActiveTab, 
  OrderBooking,
  BusinessAccount,
  BusinessWorker,
  UserSessionProfile
} from './types';
import { saveOrderBooking, modifyOrderBooking, removeOrderBooking, deleteCustomer } from './services/deliveryService';
import { 
  getLocalStore, 
  saveLocalStore, 
  isDummyCustomer, 
  isDummyDelivery, 
  isDummyTransaction, 
  isDummyInventory, 
  isDummyOrder 
} from './services/localStore';
import { 
  getActiveBusiness, 
  getUserSession, 
  getBusinessWorkers, 
  setActiveSession, 
  clearActiveSession,
  getBusinessById,
  findBusinessForUserAsync,
  getBusinessesForPhoneNumberAsync,
  getAllBusinesses,
  saveBusinesses,
  normalizePhone,
  isRegisteredBusiness,
  DEFAULT_BUSINESS
} from './services/businessService';
import { Header } from './components/Header';
import { DashboardPage } from './pages/DashboardPage';
import { CustomerManagement } from './components/CustomerManagement';
import { WarehouseView } from './components/WarehouseView';
import { AnalyticsPage } from './components/AnalyticsPage';
import { OrdersManagement } from './components/OrdersManagement';
import { TeamManagement } from './components/TeamManagement';
import { GPayBusinessModal } from './components/GPayBusinessModal';
import { NewDeliveryModal } from './components/NewDeliveryModal';
import { RestockModal } from './components/RestockModal';
import { AddCustomerModal } from './components/AddCustomerModal';
import { SettleDueModal } from './components/SettleDueModal';
import { FirebaseRulesModal } from './components/FirebaseRulesModal';
import { AuthModal } from './components/AuthModal';
import { OrderModal } from './components/OrderModal';
import { InvoiceModal } from './components/InvoiceModal';
import { ExportAccountingModal } from './components/ExportAccountingModal';
import { PaymentQRModal } from './components/PaymentQRModal';
import { MobileBottomNav } from './components/MobileBottomNav';
import { OfflineIndicator } from './components/OfflineIndicator';
import { useDeploymentCache } from './hooks/useDeploymentCache';
import { purgeAllAppCaches } from './services/cacheService';
import { CheckCircle2, AlertCircle, Building2, Plus } from 'lucide-react';

export default function App() {
  // Automatically check for new deployment, invalidate caches, and hard reload without requiring a manual update button
  useDeploymentCache();

  const initialSession = getUserSession();
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => initialSession?.role === 'WORKER' ? 'customers' : 'dashboard');
  
  // Business & Phone User Session State (GPay Style)
  const [currentBusiness, setCurrentBusiness] = useState<BusinessAccount>(() => getActiveBusiness());
  const [userSession, setUserSession] = useState<UserSessionProfile | null>(() => initialSession);
  const [workers, setWorkers] = useState<BusinessWorker[]>(() => getBusinessWorkers(getActiveBusiness().id));
  const [isGPayBusinessModalOpen, setIsGPayBusinessModalOpen] = useState(false);

  // Initialize from local store for current business
  const [inventory, setInventory] = useState<InventoryItem[]>(() => getLocalStore(getActiveBusiness().id).inventory);
  const [customers, setCustomers] = useState<Customer[]>(() => getLocalStore(getActiveBusiness().id).customers);
  const [deliveries, setDeliveries] = useState<DeliveryLog[]>(() => getLocalStore(getActiveBusiness().id).deliveries);
  const [transactions, setTransactions] = useState<TransactionRecord[]>(() => getLocalStore(getActiveBusiness().id).transactions);
  const [orders, setOrders] = useState<OrderBooking[]>(() => getLocalStore(getActiveBusiness().id).orders || []);
  
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isSeeding, setIsSeeding] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(() => getStoredUserEmail());

  // Modals
  const [isNewDeliveryOpen, setIsNewDeliveryOpen] = useState(false);
  const [isRestockOpen, setIsRestockOpen] = useState(false);
  const [restockItemType, setRestockItemType] = useState<string | undefined>(undefined);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [settleDueCustomer, setSettleDueCustomer] = useState<Customer | null>(null);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');
  const [deliveryCustomerId, setDeliveryCustomerId] = useState<string | undefined>(undefined);
  const [deliveryInitialMode, setDeliveryInitialMode] = useState<'STANDARD' | 'RETURN_ONLY' | 'DROP_ONLY'>('STANDARD');

  // Orders and Invoice Modals State
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<OrderBooking | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [invoiceDelivery, setInvoiceDelivery] = useState<DeliveryLog | null>(null);
  const [invoiceOrder, setInvoiceOrder] = useState<OrderBooking | null>(null);
  const [invoiceCustomer, setInvoiceCustomer] = useState<Customer | null>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isExportAccountingModalOpen, setIsExportAccountingModalOpen] = useState(false);
  const [isPaymentQROpen, setIsPaymentQROpen] = useState(false);
  const [qrInitialAmount, setQrInitialAmount] = useState<string | undefined>(undefined);
  const [qrInitialNote, setQrInitialNote] = useState<string | undefined>(undefined);

  const handleOpenPaymentQR = (amount?: number, note?: string) => {
    if (amount !== undefined && amount > 0) {
      setQrInitialAmount(amount.toString());
    } else {
      setQrInitialAmount(undefined);
    }
    setQrInitialNote(note);
    setIsPaymentQROpen(true);
  };

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const refreshFromLocalStore = (bizId = currentBusiness.id) => {
    const fresh = getLocalStore(bizId);
    setInventory([...fresh.inventory]);
    setCustomers([...fresh.customers]);
    setDeliveries([...fresh.deliveries]);
    setTransactions([...fresh.transactions]);
    setOrders([...(fresh.orders || [])]);
    setWorkers(getBusinessWorkers(bizId));
  };

  const handleSelectBusiness = (business: BusinessAccount, role: 'OWNER' | 'WORKER', workerRecord?: BusinessWorker) => {
    setCurrentBusiness(business);
    const session = setActiveSession(business, role, workerRecord);
    setUserSession(session);
    if (role === 'WORKER') {
      setActiveTab('customers');
    }
    refreshFromLocalStore(business.id);
    setIsGPayBusinessModalOpen(false);
    showToast(`Switched to ${business.name}`);
  };

  const handleSignOutBusiness = async () => {
    await handleSignOut();
  };

  useEffect(() => {
    // 1. Immediately hydrate local persistent state
    const storedEmail = getStoredUserEmail();
    const storedSession = getUserSession();
    if (storedEmail && !userEmail) {
      setUserEmail(storedEmail);
    }
    if (storedSession && !userSession) {
      setUserSession(storedSession);
    }

    // 2. Firebase Auth state listener
    const authUnsub = onAuthStateChanged(auth, async (user) => {
      if (user?.email || user?.phoneNumber) {
        const uEmail = user.email || '';
        const uPhone = user.phoneNumber ? normalizePhone(user.phoneNumber) : '';
        if (uEmail) {
          setUserEmail(uEmail);
          setStoredUserEmail(uEmail);
        }

        // Proactively search Firestore for this user's registered business or worker assignment across all businesses
        try {
          if (uPhone) {
            const { owned, assignedAsWorker } = await getBusinessesForPhoneNumberAsync(uPhone);

            if (owned.length === 0 && assignedAsWorker.length > 0) {
              // 1. Authenticated user is strictly an assigned WORKER across businesses
              const selectedAssignment = assignedAsWorker[0];
              setCurrentBusiness(selectedAssignment.business);
              const workerSession: UserSessionProfile = {
                phoneNumber: uPhone,
                displayName: selectedAssignment.workerRecord.workerName || user.displayName || 'Worker',
                activeBusinessId: selectedAssignment.business.id,
                role: 'WORKER',
                workerRecord: selectedAssignment.workerRecord
              };
              setActiveSession(workerSession);
              setUserSession(workerSession);
              setActiveTab('customers');
              refreshFromLocalStore(selectedAssignment.business.id);

              if (assignedAsWorker.length > 1) {
                // If assigned to multiple businesses, open business selection modal
                setIsGPayBusinessModalOpen(true);
              } else {
                setIsGPayBusinessModalOpen(false);
              }
              showToast(`Logged in as ${workerSession.displayName} (${selectedAssignment.business.name} - Worker Mode)`);
              return;
            } else if (owned.length > 0) {
              // 2. Authenticated user is an OWNER of one or more businesses
              const primaryBiz = owned[0];
              setCurrentBusiness(primaryBiz);
              const ownerSession: UserSessionProfile = {
                phoneNumber: uPhone,
                displayName: primaryBiz.ownerName || user.displayName || 'Business Owner',
                activeBusinessId: primaryBiz.id,
                role: 'OWNER'
              };
              setActiveSession(ownerSession);
              setUserSession(ownerSession);
              refreshFromLocalStore(primaryBiz.id);

              if (owned.length > 1 || assignedAsWorker.length > 0) {
                setIsGPayBusinessModalOpen(true);
              } else {
                setIsGPayBusinessModalOpen(false);
              }
              showToast(`Welcome back, ${ownerSession.displayName} (${primaryBiz.name})`);
              return;
            }
          }

          // Fallback discovery for Email or UID
          const discovered = await findBusinessForUserAsync(uEmail, uPhone, user.uid);
          if (discovered) {
            setCurrentBusiness(discovered.business);
            const newSess: UserSessionProfile = {
              phoneNumber: uPhone || (discovered.business.ownerPhone || ''),
              displayName: discovered.role === 'WORKER' 
                ? (discovered.workerRecord?.workerName || user.displayName || 'Worker') 
                : discovered.business.ownerName,
              activeBusinessId: discovered.business.id,
              role: discovered.role,
              workerRecord: discovered.workerRecord
            };
            setActiveSession(newSess);
            setUserSession(newSess);
            if (discovered.role === 'WORKER') {
              setActiveTab('customers');
            }
            refreshFromLocalStore(discovered.business.id);
            return;
          }
        } catch (e) {
          console.warn('Initial cloud business lookup note:', e);
        }

        // Check if existing stored session is already a valid worker session or registered business
        const storedSession = getUserSession();
        if (storedSession && storedSession.activeBusinessId) {
          const existingBiz = getBusinessById(storedSession.activeBusinessId);
          if (existingBiz && isRegisteredBusiness(existingBiz)) {
            setCurrentBusiness(existingBiz);
            setUserSession(storedSession);
            if (storedSession.role === 'WORKER') {
              setActiveTab('customers');
            }
            refreshFromLocalStore(existingBiz.id);
            return;
          }
        }

        // If no registered business and no worker assignments discovered for this user, set unassigned session
        setUserSession((prev) => {
          if (!prev) {
            const prefix = (uEmail || uPhone || 'User').split('@')[0];
            const words = prefix.replace(/[0-9]+/g, ' ').replace(/[._-]+/g, ' ').trim().split(/\s+/).filter(Boolean);
            const derivedName = user.displayName || (words.length > 0 ? words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') : prefix);
            const derivedPhone = uPhone;
            const newSess: UserSessionProfile = {
              phoneNumber: derivedPhone,
              displayName: derivedName,
              activeBusinessId: '',
              role: 'OWNER'
            };
            setActiveSession(newSess);
            return newSess;
          }
          return prev;
        });
      } else {
        // DO NOT LOG OUT ON REFRESH!
        // If not authenticated in Firebase, check local session
        const stored = getStoredUserEmail();
        const existingSession = getUserSession();
        if (stored && existingSession && existingSession.activeBusinessId) {
          setUserEmail(stored);
          setUserSession(existingSession);
          const existingBiz = getBusinessById(existingSession.activeBusinessId);
          if (existingBiz && isRegisteredBusiness(existingBiz)) {
            setCurrentBusiness(existingBiz);
            refreshFromLocalStore(existingBiz.id);
          } else {
            setCurrentBusiness(DEFAULT_BUSINESS);
          }
        } else if (!existingSession) {
          // No active session: ensure clean default registration state
          setUserEmail(null);
          setUserSession(null);
          setCurrentBusiness(DEFAULT_BUSINESS);
          setInventory([]);
          setCustomers([]);
          setDeliveries([]);
          setTransactions([]);
          setOrders([]);
          setWorkers([]);
        }
      }
    });

    const businessId = currentBusiness.id || DEFAULT_BUSINESS_ID;

    // 0. Live Business Document Subscription (real-time settings & profile sync across devices)
    const bizDocRef = doc(db, 'businesses', businessId);
    const bizUnsub = onSnapshot(bizDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data && data.name) {
          setCurrentBusiness(prev => {
            const updated: BusinessAccount = {
              ...prev,
              ...data,
              id: snap.id,
              defaultJarRate: Number(data.defaultJarRate) || prev.defaultJarRate || 35
            };
            const allBiz = getAllBusinesses();
            const idx = allBiz.findIndex(b => b.id === snap.id);
            if (idx >= 0) {
              allBiz[idx] = updated;
            } else {
              allBiz.push(updated);
            }
            saveBusinesses(allBiz);
            return updated;
          });
        }
      }
    }, () => {});

    // 0.1 Live Workers Subscription for this business
    const workersColRef = collection(db, `businesses/${businessId}/workers`);
    const workersUnsub = onSnapshot(workersColRef, (snap) => {
      const cloudWorkers = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as BusinessWorker[];
      setWorkers(cloudWorkers);
    }, () => {});

    // Asynchronously delete any legacy dummy documents stored in Firestore for this business
    const purgeCloudDummyDocs = async () => {
      try {
        // 1. Deliveries
        const delivSnap = await getDocs(collection(db, `businesses/${businessId}/deliveries`)).catch(() => null);
        if (delivSnap) {
          for (const d of delivSnap.docs) {
            const data = d.data();
            if (isDummyDelivery({ ...(data as any), id: d.id })) {
              deleteDoc(doc(db, `businesses/${businessId}/deliveries`, d.id)).catch(() => {});
            }
          }
        }
        // 2. Transactions
        const txSnap = await getDocs(collection(db, `businesses/${businessId}/transactions`)).catch(() => null);
        if (txSnap) {
          for (const t of txSnap.docs) {
            const data = t.data();
            if (isDummyTransaction({ ...(data as any), id: t.id })) {
              deleteDoc(doc(db, `businesses/${businessId}/transactions`, t.id)).catch(() => {});
            }
          }
        }
        // 3. Customers
        const custSnap = await getDocs(collection(db, `businesses/${businessId}/customers`)).catch(() => null);
        if (custSnap) {
          for (const c of custSnap.docs) {
            const data = c.data();
            if (isDummyCustomer({ ...(data as any), id: c.id })) {
              deleteDoc(doc(db, `businesses/${businessId}/customers`, c.id)).catch(() => {});
            }
          }
        }
        // 4. Inventory
        const invSnap = await getDocs(collection(db, `businesses/${businessId}/inventory`)).catch(() => null);
        if (invSnap) {
          for (const i of invSnap.docs) {
            const data = i.data();
            if (isDummyInventory({ ...(data as any), id: i.id })) {
              deleteDoc(doc(db, `businesses/${businessId}/inventory`, i.id)).catch(() => {});
            }
          }
        }
      } catch (err) {
        console.warn("Cloud cleanup note:", err);
      }
    };
    purgeCloudDummyDocs();

    // 1. Subscribe to Live Inventory
    const invPath = `businesses/${businessId}/inventory`;
    const invUnsub = onSnapshot(
      collection(db, invPath),
      (snapshot) => {
        const items = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...(doc.data() as Omit<InventoryItem, 'id'>)
          }))
          .filter(item => !isDummyInventory(item));

        setInventory(items);
        const store = getLocalStore(businessId);
        store.inventory = items;
        saveLocalStore(store, businessId);
        setIsOnline(true);
      },
      (err) => {
        setIsOnline(false);
        if (auth.currentUser) {
          try {
            handleFirestoreError(err, OperationType.GET, invPath);
          } catch {}
        }
      }
    );

    // 2. Subscribe to Customers
    const custPath = `businesses/${businessId}/customers`;
    const custUnsub = onSnapshot(
      collection(db, custPath),
      (snapshot) => {
        const list = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...(doc.data() as Omit<Customer, 'id'>)
          }))
          .filter(cust => !isDummyCustomer(cust));

        setCustomers(list);
        const store = getLocalStore(businessId);
        store.customers = list;
        saveLocalStore(store, businessId);
        setIsOnline(true);
      },
      (err) => {
        setIsOnline(false);
        if (auth.currentUser) {
          try {
            handleFirestoreError(err, OperationType.GET, custPath);
          } catch {}
        }
      }
    );

    // 3. Subscribe to Deliveries
    const delivPath = `businesses/${businessId}/deliveries`;
    const delivQuery = query(
      collection(db, delivPath),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const delivUnsub = onSnapshot(
      delivQuery,
      (snapshot) => {
        const list = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...(doc.data() as Omit<DeliveryLog, 'id'>)
          }))
          .filter(deliv => !isDummyDelivery(deliv));

        setDeliveries(list);
        const store = getLocalStore(businessId);
        store.deliveries = list;
        saveLocalStore(store, businessId);
      },
      (err) => {
        if (auth.currentUser) {
          try {
            handleFirestoreError(err, OperationType.GET, delivPath);
          } catch {}
        }
      }
    );

    // 4. Subscribe to Transactions
    const txPath = `businesses/${businessId}/transactions`;
    const txQuery = query(
      collection(db, txPath),
      orderBy('timestamp', 'desc'),
      limit(30)
    );

    const txUnsub = onSnapshot(
      txQuery,
      (snapshot) => {
        const list = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...(doc.data() as Omit<TransactionRecord, 'id'>)
          }))
          .filter(tx => !isDummyTransaction(tx));

        setTransactions(list);
        const store = getLocalStore(businessId);
        store.transactions = list;
        saveLocalStore(store, businessId);
      },
      (err) => {
        if (auth.currentUser) {
          try {
            handleFirestoreError(err, OperationType.GET, txPath);
          } catch {}
        }
      }
    );

    // 5. Subscribe to Cooler / Jar Orders
    const ordersPath = `businesses/${businessId}/orders`;
    const ordersUnsub = onSnapshot(
      collection(db, ordersPath),
      (snapshot) => {
        const list = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...(doc.data() as Omit<OrderBooking, 'id'>)
          }))
          .filter(ord => !isDummyOrder(ord));

        setOrders(list);
        const store = getLocalStore(businessId);
        store.orders = list;
        saveLocalStore(store, businessId);
      },
      (err) => {
        // Silently use local store fallback if permission or offline
      }
    );

    return () => {
      authUnsub();
      bizUnsub();
      workersUnsub();
      invUnsub();
      custUnsub();
      delivUnsub();
      txUnsub();
      ordersUnsub();
    };
  }, [currentBusiness.id]);

  const isBusinessRegistered = Boolean(currentBusiness && isRegisteredBusiness(currentBusiness));

  const handleOpenRestock = (itemType?: string) => {
    if (!isBusinessRegistered) {
      showToast("Please register or select your business first", "error");
      setIsGPayBusinessModalOpen(true);
      return;
    }
    setRestockItemType(itemType);
    setIsRestockOpen(true);
  };

  const handleQuickDeliveryToCustomer = (customer: Customer, mode: 'STANDARD' | 'RETURN_ONLY' | 'DROP_ONLY' = 'STANDARD') => {
    if (!isBusinessRegistered) {
      showToast("Please register or select your business first", "error");
      setIsGPayBusinessModalOpen(true);
      return;
    }
    setDeliveryCustomerId(customer.id);
    setDeliveryInitialMode(mode);
    setIsNewDeliveryOpen(true);
  };

  const handleOpenDeliveryModal = (customerId?: string, mode: 'STANDARD' | 'RETURN_ONLY' | 'DROP_ONLY' = 'STANDARD') => {
    if (!isBusinessRegistered) {
      showToast("Please register or select your business first", "error");
      setIsGPayBusinessModalOpen(true);
      return;
    }
    setDeliveryCustomerId(customerId);
    setDeliveryInitialMode(mode);
    setIsNewDeliveryOpen(true);
  };

  const handleUserChange = async (email: string | null) => {
    if (email) {
      setUserEmail(email);
      setStoredUserEmail(email);

      // 1. Staff / Worker local identifier handling
      if (email.endsWith('@staff.local')) {
        const staffName = email.replace('@staff.local', '').split('.').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        const activeBiz = getActiveBusiness();
        const bizWorkers = getBusinessWorkers(activeBiz.id);
        const matchedWorker = bizWorkers.find(w => w.workerName.toLowerCase() === staffName.toLowerCase());
        
        const workerRecord: BusinessWorker = matchedWorker || {
          id: `worker_${Date.now()}`,
          businessId: activeBiz.id,
          businessName: activeBiz.name,
          workerName: staffName,
          workerPhone: '',
          role: 'DRIVER',
          assignedRoute: 'General Delivery Route',
          status: 'ACTIVE',
          addedAt: Date.now(),
          addedByPhone: activeBiz.ownerPhone,
          ownerName: activeBiz.ownerName
        };

        const newSession: UserSessionProfile = {
          phoneNumber: workerRecord.workerPhone || '',
          displayName: staffName,
          activeBusinessId: activeBiz.id,
          role: 'WORKER',
          workerRecord
        };
        setActiveSession(newSession);
        setUserSession(newSession);
        setActiveTab('customers');
        showToast(`Signed in as ${staffName} (${activeBiz.name})`);
        return;
      }

      // 2. Discover business from cloud
      try {
        const discovered = await findBusinessForUserAsync(email, undefined, auth.currentUser?.uid);
        if (discovered) {
          setCurrentBusiness(discovered.business);
          const newSession: UserSessionProfile = {
            phoneNumber: discovered.business.ownerPhone || '',
            displayName: discovered.role === 'WORKER' 
              ? (discovered.workerRecord?.workerName || 'Worker') 
              : discovered.business.ownerName,
            activeBusinessId: discovered.business.id,
            role: discovered.role,
            workerRecord: discovered.workerRecord
          };
          setActiveSession(newSession);
          setUserSession(newSession);
          if (discovered.role === 'WORKER') {
            setActiveTab('customers');
          }
          refreshFromLocalStore(discovered.business.id);
          showToast(`Connected to ${discovered.business.name} (${discovered.role === 'WORKER' ? 'Worker Mode' : 'Owner Mode'})`);
          return;
        }
      } catch (err) {
        console.warn('User change cloud lookup note:', err);
      }

      // 3. Fallback: check if active session already has a registered business
      const storedSession = getUserSession();
      if (storedSession && storedSession.activeBusinessId) {
        const existingBiz = getBusinessById(storedSession.activeBusinessId);
        if (existingBiz && isRegisteredBusiness(existingBiz)) {
          setCurrentBusiness(existingBiz);
          setUserSession(storedSession);
          return;
        }
      }

      const derivedPhone = '';
      const prefix = email.split('@')[0];
      const words = prefix.replace(/[0-9]+/g, ' ').replace(/[._-]+/g, ' ').trim().split(/\s+/).filter(Boolean);
      const derivedName = words.length > 0 ? words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') : prefix;

      const newSession: UserSessionProfile = {
        phoneNumber: derivedPhone,
        displayName: derivedName,
        activeBusinessId: '',
        role: 'OWNER'
      };
      setActiveSession(newSession);
      setUserSession(newSession);
      showToast(`Signed in as ${derivedName}. Please register your business to begin.`);
    } else {
      // User explicitly requested logout
      handleSignOut();
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch {}
    try {
      await purgeAllAppCaches();
    } catch {}
    clearStoredUserEmail();
    setUserEmail(null);
    clearActiveSession();
    setUserSession(null);
    setActiveTab('dashboard');
    setCurrentBusiness(DEFAULT_BUSINESS);
    setInventory([]);
    setCustomers([]);
    setDeliveries([]);
    setTransactions([]);
    setOrders([]);
    setWorkers([]);
    setGlobalSearchTerm('');
    // Close all open modals to return cleanly to the home screen
    setIsGPayBusinessModalOpen(false);
    setIsAddCustomerOpen(false);
    setIsNewDeliveryOpen(false);
    setIsOrderModalOpen(false);
    setIsInvoiceModalOpen(false);
    setIsPaymentQROpen(false);
    setIsRestockOpen(false);
    setIsRulesModalOpen(false);
    setIsAuthModalOpen(false);
    setEditingCustomer(null);
    setEditingOrder(null);
    setSettleDueCustomer(null);
    showToast("Signed out successfully");
  };

  // Order Handlers
  const handleOpenNewOrder = () => {
    if (!isBusinessRegistered) {
      showToast("Please register or select your business first", "error");
      setIsGPayBusinessModalOpen(true);
      return;
    }
    setEditingOrder(null);
    setIsOrderModalOpen(true);
  };

  const handleEditOrder = (order: OrderBooking) => {
    setEditingOrder(order);
    setIsOrderModalOpen(true);
  };

  const handleSaveOrder = async (orderData: Omit<OrderBooking, 'id' | 'bookingDate'>, orderId?: string) => {
    if (orderId) {
      const updated = await modifyOrderBooking(currentBusiness.id, orderId, orderData);
      if (updated) {
        setOrders(prev => prev.map(o => o.id === orderId ? updated : o));
      }
      showToast("Order updated");
    } else {
      const created = await saveOrderBooking(currentBusiness.id, orderData);
      if (created) {
        setOrders(prev => [created, ...prev.filter(o => o.id !== created.id)]);
      }
      showToast("Order booked successfully");
    }
    refreshFromLocalStore(currentBusiness.id);
  };

  const handleDeleteOrder = async (orderId: string) => {
    await removeOrderBooking(currentBusiness.id, orderId);
    setOrders(prev => prev.filter(o => o.id !== orderId));
    refreshFromLocalStore(currentBusiness.id);
    showToast("Order removed");
  };

  const handleUpdateOrderStatus = async (orderId: string, status: OrderBooking['status']) => {
    const updated = await modifyOrderBooking(currentBusiness.id, orderId, { status });
    if (updated) {
      setOrders(prev => prev.map(o => o.id === orderId ? updated : o));
    }
    refreshFromLocalStore(currentBusiness.id);
    showToast(`Order status marked as ${status.toLowerCase()}`);
  };

  const handleOpenDeliveryInvoice = (delivery: DeliveryLog) => {
    setInvoiceDelivery(delivery);
    setInvoiceOrder(null);
    setInvoiceCustomer(null);
    setIsInvoiceModalOpen(true);
  };

  const handleOpenOrderInvoice = (order: OrderBooking) => {
    setInvoiceOrder(order);
    setInvoiceDelivery(null);
    setInvoiceCustomer(null);
    setIsInvoiceModalOpen(true);
  };

  const handleOpenCustomerInvoice = (customer: Customer) => {
    setInvoiceCustomer(customer);
    setInvoiceDelivery(null);
    setInvoiceOrder(null);
    setIsInvoiceModalOpen(true);
  };

  const handleDeleteCustomer = async (customerId: string, customerName: string) => {
    try {
      await deleteCustomer(currentBusiness.id || DEFAULT_BUSINESS_ID, customerId);
      refreshFromLocalStore(currentBusiness.id || DEFAULT_BUSINESS_ID);
      showToast(`Customer "${customerName}" deleted`);
    } catch {
      showToast(`Failed to delete customer`);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-50/70 text-slate-900 flex flex-col font-sans selection:bg-sky-500 selection:text-white overflow-x-hidden">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className={`px-4 py-3 rounded-xl shadow-lg flex items-center gap-2.5 border text-sm font-medium ${
            toastMessage.type === 'success'
              ? 'bg-slate-900 text-white border-slate-800'
              : 'bg-rose-600 text-white border-rose-700'
          }`}>
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-200 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Global Header with Universal Search & GPay Business Switcher */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenRestock={handleOpenRestock}
        onOpenNewDelivery={handleOpenDeliveryModal}
        onOpenRules={() => setIsRulesModalOpen(true)}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        isOnline={isOnline}
        businessId={currentBusiness.id}
        userEmail={userEmail}
        onSignOut={handleSignOut}
        searchQuery={globalSearchTerm}
        onSearchChange={setGlobalSearchTerm}
        customers={customers}
        inventory={inventory}
        onOpenSettleDue={(cust) => setSettleDueCustomer(cust)}
        onOpenExportAccounting={() => setIsExportAccountingModalOpen(true)}
        onOpenPaymentQR={() => setIsPaymentQROpen(true)}
        currentBusiness={currentBusiness}
        userSession={userSession}
        onOpenBusinessModal={() => setIsGPayBusinessModalOpen(true)}
      />

      {/* Main Content with Shared Page Container Width */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 md:pb-8">
        {!isBusinessRegistered ? (
          <div className="py-16 px-4 max-w-md mx-auto text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-sky-100 text-sky-600 rounded-3xl flex items-center justify-center mx-auto shadow-xs">
              <Building2 className="w-8 h-8" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                No Business Registered Yet
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                You must first register or connect your water supply business before you can add customers, manage jar stock, or log delivery dispatches.
              </p>
            </div>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => setIsGPayBusinessModalOpen(true)}
                className="w-full sm:w-auto px-6 py-3 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-bold rounded-xl text-xs sm:text-sm shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Register Business Now</span>
              </button>
              <button
                onClick={() => setIsGPayBusinessModalOpen(true)}
                className="w-full sm:w-auto px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Sign In to Existing</span>
              </button>
            </div>
          </div>
        ) : userSession?.role === 'WORKER' ? (
          <CustomerManagement
            customers={customers}
            onOpenAddCustomer={() => {
              if (!isBusinessRegistered) {
                showToast("Please register or select your business first", "error");
                setIsGPayBusinessModalOpen(true);
                return;
              }
              setIsAddCustomerOpen(true);
            }}
            onOpenEditCustomer={(cust) => {
              setEditingCustomer(cust);
              setIsAddCustomerOpen(true);
            }}
            onOpenSettleDue={(cust) => setSettleDueCustomer(cust)}
            onQuickDeliveryToCustomer={handleQuickDeliveryToCustomer}
            onOpenPaymentQR={handleOpenPaymentQR}
            searchQuery={globalSearchTerm}
            onSearchChange={setGlobalSearchTerm}
            onClearSearch={() => setGlobalSearchTerm('')}
            onRefresh={() => {
              refreshFromLocalStore(currentBusiness.id);
            }}
            onDeleteCustomer={handleDeleteCustomer}
            userRole="WORKER"
            businessName={currentBusiness.name}
            businessPhone={currentBusiness.ownerPhone}
          />
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <DashboardPage
                inventory={inventory}
                customers={customers}
                todayDeliveries={deliveries}
                orders={orders}
                onOpenRestock={handleOpenRestock}
                onOpenNewDelivery={() => handleOpenDeliveryModal()}
                onOpenNewOrder={handleOpenNewOrder}
                onOpenInvoice={handleOpenDeliveryInvoice}
                onOpenOrderInvoice={handleOpenOrderInvoice}
                onOpenExportAccounting={() => setIsExportAccountingModalOpen(true)}
                searchQuery={globalSearchTerm}
                onSearchChange={setGlobalSearchTerm}
                onClearSearch={() => setGlobalSearchTerm('')}
                onNavigateToTab={(tab: ActiveTab) => setActiveTab(tab)}
                userRole="OWNER"
              />
            )}

            {activeTab === 'orders' && (
              <OrdersManagement
                orders={orders}
                customers={customers}
                onOpenNewOrder={handleOpenNewOrder}
                onEditOrder={handleEditOrder}
                onOpenInvoice={handleOpenOrderInvoice}
                onDeleteOrder={handleDeleteOrder}
                onUpdateStatus={handleUpdateOrderStatus}
                searchQuery={globalSearchTerm}
                onSearchChange={setGlobalSearchTerm}
              />
            )}

            {activeTab === 'customers' && (
              <CustomerManagement
                customers={customers}
                onOpenAddCustomer={() => {
                  if (!isBusinessRegistered) {
                    showToast("Please register or select your business first", "error");
                    setIsGPayBusinessModalOpen(true);
                    return;
                  }
                  setEditingCustomer(null);
                  setIsAddCustomerOpen(true);
                }}
                onOpenEditCustomer={(cust) => {
                  setEditingCustomer(cust);
                  setIsAddCustomerOpen(true);
                }}
                onOpenSettleDue={(cust) => setSettleDueCustomer(cust)}
                onQuickDeliveryToCustomer={handleQuickDeliveryToCustomer}
                onOpenPaymentQR={handleOpenPaymentQR}
                searchQuery={globalSearchTerm}
                onSearchChange={setGlobalSearchTerm}
                onClearSearch={() => setGlobalSearchTerm('')}
                onRefresh={() => {
                  refreshFromLocalStore(currentBusiness.id);
                }}
                onDeleteCustomer={handleDeleteCustomer}
                onOpenCustomerInvoice={handleOpenCustomerInvoice}
                userRole="OWNER"
                businessName={currentBusiness.name}
                businessPhone={currentBusiness.ownerPhone}
              />
            )}

            {activeTab === 'inventory' && (
              <WarehouseView
                inventory={inventory}
                transactions={transactions}
                onOpenRestock={handleOpenRestock}
                searchQuery={globalSearchTerm}
                onSearchChange={setGlobalSearchTerm}
                onClearSearch={() => setGlobalSearchTerm('')}
                businessId={currentBusiness.id}
                onRefresh={() => refreshFromLocalStore(currentBusiness.id)}
                onToast={showToast}
                userRole="OWNER"
              />
            )}

            {activeTab === 'team' && (
              <TeamManagement
                business={currentBusiness}
                workers={workers}
                currentUserSession={userSession}
                onWorkersUpdated={() => setWorkers(getBusinessWorkers(currentBusiness.id))}
              />
            )}

            {activeTab === 'analytics' && (
              <AnalyticsPage
                deliveries={deliveries}
                transactions={transactions}
                customers={customers}
                inventory={inventory}
                orders={orders}
                currentBusiness={currentBusiness}
                onNavigateToTab={(tab: ActiveTab) => setActiveTab(tab)}
                onOpenExportAccounting={() => setIsExportAccountingModalOpen(true)}
              />
            )}
          </>
        )}
      </main>

      {/* Minimal Clean Footer */}
      <footer className="border-t border-slate-200/80 bg-white py-4 px-6 text-center text-xs text-slate-400">
        <p></p>
      </footer>

      {/* Modals */}
      <NewDeliveryModal
        isOpen={isNewDeliveryOpen}
        onClose={() => {
          setIsNewDeliveryOpen(false);
          setDeliveryCustomerId(undefined);
          setDeliveryInitialMode('STANDARD');
        }}
        defaultCustomerId={deliveryCustomerId}
        defaultWorkerName={userSession?.displayName || userSession?.workerRecord?.workerName || currentBusiness.ownerName}
        customers={customers}
        inventory={inventory}
        businessId={currentBusiness.id}
        initialMode={deliveryInitialMode}
        onDeliveryComplete={(msg) => {
          refreshFromLocalStore(currentBusiness.id);
          showToast(msg);
        }}
        onOpenAddCustomer={() => setIsAddCustomerOpen(true)}
      />

      <RestockModal
        isOpen={isRestockOpen}
        onClose={() => setIsRestockOpen(false)}
        inventory={inventory}
        businessId={currentBusiness.id}
        defaultItemType={restockItemType}
        onRestockComplete={(msg) => {
          refreshFromLocalStore(currentBusiness.id);
          showToast(msg);
        }}
      />

      <AddCustomerModal
        isOpen={isAddCustomerOpen}
        onClose={() => {
          setIsAddCustomerOpen(false);
          setEditingCustomer(null);
        }}
        businessId={currentBusiness.id}
        customerToEdit={editingCustomer}
        customers={customers}
        onCustomerCreated={(msg, createdCustomer) => {
          if (createdCustomer) {
            setCustomers(prev => [createdCustomer, ...prev.filter(c => c.id !== createdCustomer.id)]);
          }
          refreshFromLocalStore(currentBusiness.id);
          showToast(msg);
        }}
        onOpenRulesModal={() => setIsRulesModalOpen(true)}
      />

      <SettleDueModal
        isOpen={!!settleDueCustomer}
        onClose={() => setSettleDueCustomer(null)}
        customer={settleDueCustomer}
        businessId={currentBusiness.id}
        business={currentBusiness}
        onSettled={(msg) => {
          refreshFromLocalStore(currentBusiness.id);
          showToast(msg);
        }}
      />

      <FirebaseRulesModal
        isOpen={isRulesModalOpen}
        onClose={() => setIsRulesModalOpen(false)}
        userEmail={userEmail}
        onUserChange={handleUserChange}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUserEmail={userEmail}
        onUserChange={handleUserChange}
        onOpenGPayBusiness={() => {
          setIsAuthModalOpen(false);
          setIsGPayBusinessModalOpen(true);
        }}
      />

      {/* Cooler & Jar Order Booking / Modification Modal */}
      <OrderModal
        isOpen={isOrderModalOpen}
        onClose={() => {
          setIsOrderModalOpen(false);
          setEditingOrder(null);
        }}
        onSave={handleSaveOrder}
        editingOrder={editingOrder}
        customers={customers}
      />

      {/* Print-Friendly Receipt & WhatsApp Bill Modal */}
      <InvoiceModal
        isOpen={isInvoiceModalOpen}
        onClose={() => {
          setIsInvoiceModalOpen(false);
          setInvoiceDelivery(null);
          setInvoiceOrder(null);
          setInvoiceCustomer(null);
        }}
        delivery={invoiceDelivery}
        order={invoiceOrder}
        customer={invoiceCustomer}
        business={currentBusiness}
        inventory={inventory}
        deliveries={deliveries}
        customers={customers}
        onUpdateBusiness={(updated) => {
          setCurrentBusiness(updated);
          refreshFromLocalStore(updated.id);
        }}
      />

      {/* Formatted Daily Accounting & Day Book CSV Export Modal */}
      <ExportAccountingModal
        isOpen={isExportAccountingModalOpen}
        onClose={() => setIsExportAccountingModalOpen(false)}
        deliveries={deliveries}
        transactions={transactions}
        customers={customers}
        business={currentBusiness}
        onToast={showToast}
      />

      {/* Dynamic Instant UPI QR Code Modal */}
      <PaymentQRModal
        isOpen={isPaymentQROpen}
        onClose={() => {
          setIsPaymentQROpen(false);
          setQrInitialAmount(undefined);
          setQrInitialNote(undefined);
        }}
        business={currentBusiness}
        userSession={userSession}
        onToast={showToast}
        initialAmount={qrInitialAmount}
        initialNote={qrInitialNote}
      />

      {/* Google Pay Style Business Registration, Phone Login & Worker Assignment Modal */}
      <GPayBusinessModal
        isOpen={isGPayBusinessModalOpen}
        onClose={() => setIsGPayBusinessModalOpen(false)}
        activeSession={userSession}
        onSelectBusiness={handleSelectBusiness}
        onSignOutPhone={handleSignOutBusiness}
      />

      {/* Persistent Mobile Bottom Navigation Bar (< 768px) */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenNewDelivery={() => handleOpenDeliveryModal()}
        onOpenNewOrder={handleOpenNewOrder}
        onOpenPaymentQR={handleOpenPaymentQR}
        onOpenBusinessModal={() => setIsGPayBusinessModalOpen(true)}
        onOpenRules={() => setIsRulesModalOpen(true)}
        onSignOut={handleSignOut}
        ordersCount={orders.filter(o => o.status !== 'CANCELLED' && o.status !== 'DELIVERED').length}
        currentBusiness={currentBusiness}
        userSession={userSession}
      />

      {/* Offline Connectivity Status Badge */}
      <OfflineIndicator />
    </div>
  );
}
