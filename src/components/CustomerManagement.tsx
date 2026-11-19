import React, { useState, useMemo } from 'react';
import { Customer, DeliveryLog, OrderBooking, TransactionRecord, BusinessAccount } from '../types';
import { getActiveBusiness } from '../services/businessService';
import {
  generateWhatsAppReminderText,
  openWhatsAppChat,
  resolveBusinessUpiId,
  generateUpiUri,
  getPublicQrImageUrl,
  generateUpiQrCardBlob
} from '../utils/upiUtils';
import {
  calculateCustomerBillingLedger,
  CustomerBillingLedger,
  resolveDeliveryPurchaseRate,
  calculateDeliveryBillAmount,
  getDeliveryPaidAmount
} from '../utils/billingUtils';
import { 
  Users, 
  Search, 
  MapPin, 
  Phone, 
  Plus, 
  Building2, 
  Home, 
  Truck, 
  X, 
  RotateCw, 
  RotateCcw, 
  CreditCard, 
  Share2, 
  Trash2, 
  Receipt, 
  QrCode, 
  BellRing, 
  Edit2,
  ClipboardList,
  Calendar,
  Package,
  UserCheck,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  Clock,
  FileSpreadsheet
} from 'lucide-react';
import { CardSpotlight } from './ui/CardSpotlight';
import { AnimatedTabs, TabItem } from './ui/AnimatedTabs';
import { ModalWrapper } from './ui/ModalWrapper';
import { Button } from './ui/Button';
import { PullToRefresh } from './ui/PullToRefresh';
import { triggerHaptic } from '../utils/haptics';
import { useLanguage } from '../context/LanguageContext';

interface CustomerManagementProps {
  customers: Customer[];
  deliveries?: DeliveryLog[];
  orders?: OrderBooking[];
  transactions?: TransactionRecord[];
  onOpenAddCustomer: () => void;
  onOpenImportCustomers?: () => void;
  onOpenEditCustomer?: (customer: Customer) => void;
  onOpenSettleDue: (customer: Customer) => void;
  onQuickDeliveryToCustomer: (customer: Customer, mode?: 'STANDARD' | 'RETURN_ONLY' | 'DROP_ONLY') => void;
  onOpenPaymentQR?: (amount?: number, note?: string) => void;
  onOpenNewDelivery?: () => void;
  onOpenNewOrder?: (customer?: Customer) => void;
  onOpenOrdersTab?: () => void;
  onOpenRestock?: () => void;
  searchQuery?: string;
  onSearchChange?: (term: string) => void;
  onClearSearch?: () => void;
  onRefresh?: () => Promise<void> | void;
  onDeleteCustomer?: (customerId: string, customerName: string) => Promise<void> | void;
  onOpenCustomerInvoice?: (customer: Customer) => void;
  onOpenDeliveryInvoice?: (delivery: DeliveryLog) => void;
  onOpenOrderInvoice?: (order: OrderBooking) => void;
  userRole?: 'OWNER' | 'WORKER';
  business?: BusinessAccount;
  businessName?: string;
  businessPhone?: string;
}

type TypeFilter = 'ALL' | 'RESIDENTIAL' | 'COMMERCIAL';
type DueFilter = 'ALL' | 'OVERDUE';
type HistoryTab = 'DELIVERIES' | 'ORDERS' | 'PAYMENTS';
type HistoryDateFilter = 'ALL' | 'TODAY' | 'THIS_MONTH' | 'CUSTOM';

export const CustomerManagement: React.FC<CustomerManagementProps> = ({
  customers,
  deliveries = [],
  orders = [],
  transactions = [],
  onOpenAddCustomer,
  onOpenImportCustomers,
  onOpenEditCustomer,
  onOpenSettleDue,
  onQuickDeliveryToCustomer,
  onOpenNewOrder,
  onOpenOrdersTab,
  searchQuery = '',
  onSearchChange,
  onClearSearch,
  onRefresh,
  onDeleteCustomer,
  onOpenCustomerInvoice,
  onOpenDeliveryInvoice,
  onOpenOrderInvoice,
  userRole = 'OWNER',
  business,
  businessName,
  businessPhone
}) => {
  const { t, isGujarati } = useLanguage();
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [isDeletingCustomer, setIsDeletingCustomer] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [localSearch, setLocalSearch] = useState('');
  const [routeFilter, setRouteFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [dueFilter, setDueFilter] = useState<DueFilter>('ALL');
  const [isReminderAssistantOpen, setIsReminderAssistantOpen] = useState(false);
  const [includeDueQrInReminders, setIncludeDueQrInReminders] = useState(true);
  const [sentReminders, setSentReminders] = useState<Record<string, boolean>>({});

  // Customer Order & Delivery Cross-Check Modal state
  const [selectedCustomerForHistory, setSelectedCustomerForHistory] = useState<Customer | null>(null);
  const [historyTab, setHistoryTab] = useState<HistoryTab>('DELIVERIES');
  const [historyDateFilter, setHistoryDateFilter] = useState<HistoryDateFilter>('ALL');
  const [historyCustomDate, setHistoryCustomDate] = useState<string>('');
  const [historySearch, setHistorySearch] = useState<string>('');

  const activeBiz = business || getActiveBusiness();
  const effectiveBizName = businessName || activeBiz?.name || 'Water Supply Management';
  const effectiveBizPhone = businessPhone || activeBiz?.ownerPhone || '';
  const effectiveUpiId = resolveBusinessUpiId({
    upiId: activeBiz?.upiId,
    ownerPhone: effectiveBizPhone
  });

  // Pre-index deliveries, orders, transactions, and chronological purchase-date billing ledger per customer
  const customerActivityMap = useMemo(() => {
    const map = new Map<
      string,
      {
        ledger: CustomerBillingLedger;
        deliveries: DeliveryLog[];
        orders: OrderBooking[];
        transactions: TransactionRecord[];
        totalJarsDelivered: number;
        totalEmptyCollected: number;
        totalBilledAtPurchaseRates: number;
        totalPaidAtDelivery: number;
        totalDueClearances: number;
        totalPaymentsReceived: number;
        netOutstandingBalance: number;
        lastDeliveryTimestamp: number | null;
      }
    >();

    const normalizeName = (s?: string) => (s || '').trim().toLowerCase();
    const normalizePhone = (s?: string) => (s || '').replace(/\D/g, '').slice(-10);

    customers.forEach((c) => {
      const ledger = calculateCustomerBillingLedger(c, deliveries, transactions);
      map.set(c.id, {
        ledger,
        deliveries: ledger.deliveriesNewestFirst.map((s) => s.delivery),
        orders: [],
        transactions: ledger.allTransactions,
        totalJarsDelivered: ledger.totalJarsDelivered,
        totalEmptyCollected: ledger.totalEmptyCollected,
        totalBilledAtPurchaseRates: ledger.totalBilledAtPurchaseRates,
        totalPaidAtDelivery: ledger.totalPaidAtDelivery,
        totalDueClearances: ledger.totalDueClearances,
        totalPaymentsReceived: ledger.totalPaymentsReceived,
        netOutstandingBalance: ledger.netOutstandingBalance,
        lastDeliveryTimestamp: ledger.lastDeliveryTimestamp
      });
    });

    orders.forEach((o) => {
      let targetId = o.customerId && map.has(o.customerId) ? o.customerId : undefined;
      if (!targetId) {
        const oPhone = normalizePhone(o.customerMobile);
        const oName = normalizeName(o.customerName);
        const matched = customers.find(
          (c) =>
            (oPhone && oPhone.length >= 10 && normalizePhone(c.phone) === oPhone) ||
            (oName && normalizeName(c.name) === oName)
        );
        if (matched) targetId = matched.id;
      }
      if (targetId) {
        const entry = map.get(targetId);
        if (entry) {
          entry.orders.push(o);
        }
      }
    });

    map.forEach((entry) => {
      entry.orders.sort((a, b) => (b.bookingDate || 0) - (a.bookingDate || 0));
    });

    return map;
  }, [customers, deliveries, orders, transactions]);

  const handleOpenCustomerHistory = (cust: Customer) => {
    // Keep live customer reference
    setSelectedCustomerForHistory(cust);
    setHistoryTab('DELIVERIES');
    setHistoryDateFilter('ALL');
    setHistoryCustomDate('');
    setHistorySearch('');
  };

  // Resolve current live customer object for the modal in case customer balances updated while open
  const activeHistoryCustomer = useMemo(() => {
    if (!selectedCustomerForHistory) return null;
    return customers.find((c) => c.id === selectedCustomerForHistory.id) || selectedCustomerForHistory;
  }, [customers, selectedCustomerForHistory]);

  const activeCustomerActivity = useMemo(() => {
    if (!activeHistoryCustomer) return null;
    const found = customerActivityMap.get(activeHistoryCustomer.id);
    if (found) return found;
    const fallbackLedger = calculateCustomerBillingLedger(activeHistoryCustomer, deliveries, transactions);
    return {
      ledger: fallbackLedger,
      deliveries: fallbackLedger.deliveriesNewestFirst.map((s) => s.delivery),
      orders: [],
      transactions: fallbackLedger.allTransactions,
      totalJarsDelivered: fallbackLedger.totalJarsDelivered,
      totalEmptyCollected: fallbackLedger.totalEmptyCollected,
      totalBilledAtPurchaseRates: fallbackLedger.totalBilledAtPurchaseRates,
      totalPaidAtDelivery: fallbackLedger.totalPaidAtDelivery,
      totalDueClearances: fallbackLedger.totalDueClearances,
      totalPaymentsReceived: fallbackLedger.totalPaymentsReceived,
      netOutstandingBalance: fallbackLedger.netOutstandingBalance,
      lastDeliveryTimestamp: fallbackLedger.lastDeliveryTimestamp
    };
  }, [activeHistoryCustomer, customerActivityMap, deliveries, transactions]);

  // Date & search filtering helper inside the Customer History Modal
  const matchesHistoryDate = (timestamp: number) => {
    if (!timestamp) return historyDateFilter === 'ALL';
    const d = new Date(timestamp);
    const now = new Date();

    if (historyDateFilter === 'TODAY') {
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      );
    }
    if (historyDateFilter === 'THIS_MONTH') {
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }
    if (historyDateFilter === 'CUSTOM' && historyCustomDate) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}` === historyCustomDate;
    }
    return true;
  };

  const filteredHistoryDeliveries = useMemo(() => {
    if (!activeCustomerActivity) return [];
    const q = historySearch.trim().toLowerCase();
    return activeCustomerActivity.deliveries.filter((d) => {
      if (!matchesHistoryDate(d.timestamp)) return false;
      if (!q) return true;
      const dateStr = new Date(d.timestamp)
        .toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        .toLowerCase();
      return (
        (d.itemType || '20L Water Jar').toLowerCase().includes(q) ||
        (d.workerName || '').toLowerCase().includes(q) ||
        (d.paymentMode || '').toLowerCase().includes(q) ||
        (d.notes || '').toLowerCase().includes(q) ||
        dateStr.includes(q)
      );
    });
  }, [activeCustomerActivity, historyDateFilter, historyCustomDate, historySearch]);

  const filteredHistoryOrders = useMemo(() => {
    if (!activeCustomerActivity) return [];
    const q = historySearch.trim().toLowerCase();
    return activeCustomerActivity.orders.filter((o) => {
      if (!matchesHistoryDate(o.bookingDate)) return false;
      if (!q) return true;
      return (
        (o.itemType || '').toLowerCase().includes(q) ||
        (o.status || '').toLowerCase().includes(q) ||
        (o.paymentStatus || '').toLowerCase().includes(q) ||
        (o.notes || '').toLowerCase().includes(q) ||
        (o.deliveryDate || '').toLowerCase().includes(q)
      );
    });
  }, [activeCustomerActivity, historyDateFilter, historyCustomDate, historySearch]);

  const filteredHistoryTransactions = useMemo(() => {
    if (!activeCustomerActivity) return [];
    const q = historySearch.trim().toLowerCase();
    return activeCustomerActivity.transactions.filter((tx) => {
      if (!matchesHistoryDate(tx.timestamp)) return false;
      if (!q) return true;
      return (
        (tx.type || '').toLowerCase().includes(q) ||
        (tx.paymentMode || '').toLowerCase().includes(q) ||
        (tx.notes || '').toLowerCase().includes(q)
      );
    });
  }, [activeCustomerActivity, historyDateFilter, historyCustomDate, historySearch]);

  // Filtered totals for deliveries currently shown in the table (calculated at each delivery's purchase-date rate)
  const filteredDeliveryTotals = useMemo(() => {
    return filteredHistoryDeliveries.reduce(
      (acc, d) => {
        acc.jarsDelivered += Number(d.jarsDelivered) || 0;
        acc.emptyCollected += Number(d.emptyJarsCollected) || 0;
        acc.totalBill += calculateDeliveryBillAmount(d);
        acc.amountCollected += getDeliveryPaidAmount(d);
        return acc;
      },
      { jarsDelivered: 0, emptyCollected: 0, totalBill: 0, amountCollected: 0 }
    );
  }, [filteredHistoryDeliveries]);

  // Use searchQuery if provided, else localSearch
  const effectiveSearch = searchQuery !== undefined && searchQuery !== '' ? searchQuery : localSearch;

  const handleSearchInput = (val: string) => {
    setLocalSearch(val);
    onSearchChange?.(val);
  };

  const handleClear = () => {
    setLocalSearch('');
    onSearchChange?.('');
    onClearSearch?.();
  };

  const routes = Array.from(new Set(customers.map(c => c.route?.trim()).filter(Boolean))) as string[];
  const overdueCustomersList = customers.filter(c => (Number(c.dueAmount) || 0) > 0);

  const filteredCustomers = customers.filter((c) => {
    const q = effectiveSearch.toLowerCase().trim();
    const matchesSearch = 
      !q ||
      (c.name || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      (c.address || '').toLowerCase().includes(q) ||
      (c.route || '').toLowerCase().includes(q);
    
    const matchesRoute = routeFilter === 'ALL' || (c.route?.trim() || '') === routeFilter;
    const matchesType = typeFilter === 'ALL' || c.customerType === typeFilter;
    const matchesDue = dueFilter === 'ALL' || (Number(c.dueAmount) || 0) > 0;

    return matchesSearch && matchesRoute && matchesType && matchesDue;
  });

  const totalOutstanding = customers.reduce((sum, c) => sum + (Number(c.dueAmount) || 0), 0);
  const totalCirculation = customers.reduce((sum, c) => sum + (Number(c.jarsHolding) || 0), 0);

  // Send WhatsApp reminder for overdue balance with dynamic transactional QR option
  const handleSendPaymentReminder = async (cust: Customer) => {
    const dueAmt = Number(cust.dueAmount) || 0;
    if (effectiveUpiId && includeDueQrInReminders) {
      const upiUri = generateUpiUri({
        upiId: effectiveUpiId,
        merchantName: effectiveBizName,
        amount: dueAmt > 0 ? dueAmt : undefined,
        note: `Water Supply Payment - ${cust.name}`
      });
      const blob = await generateUpiQrCardBlob({
        upiUri,
        upiId: effectiveUpiId,
        merchantName: effectiveBizName,
        customerName: cust.name,
        amount: dueAmt > 0 ? dueAmt : undefined
      });
      if (blob && typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        } catch {
          // Ignore clipboard write rejection
        }
      }
    }

    const text = generateWhatsAppReminderText({
      customerName: cust.name,
      customerPhone: cust.phone || '',
      dueAmount: dueAmt,
      jarsHolding: Number(cust.jarsHolding) || 0,
      businessName: effectiveBizName,
      businessPhone: effectiveBizPhone,
      upiId: effectiveUpiId,
      includeQr: includeDueQrInReminders
    });

    openWhatsAppChat(cust.phone || '', text);
    setSentReminders(prev => ({ ...prev, [cust.id]: true }));
  };

  // Send WhatsApp bill / balance statement directly to the customer
  const handleSendCustomerBill = async (cust: Customer) => {
    if ((Number(cust.dueAmount) || 0) > 0) {
      await handleSendPaymentReminder(cust);
      return;
    }

    const todayStr = new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    const jarsCount = cust.jarsHolding || 0;
    const dueAmt = cust.dueAmount || 0;
    const deposit = cust.depositPaid || 0;

    let upiSection = '';
    if (effectiveUpiId) {
      const upiUri = generateUpiUri({
        upiId: effectiveUpiId,
        merchantName: effectiveBizName,
        amount: dueAmt > 0 ? dueAmt : undefined,
        note: `Water Supply - ${cust.name}`
      });
      const qrImg = getPublicQrImageUrl(upiUri, 320);
      upiSection = `\n----------------------------------------
*PAYMENT INFORMATION & QR*
• UPI ID: ${effectiveUpiId}
• Pay via UPI App: ${upiUri}
• Scan QR Code: ${qrImg}
----------------------------------------`;

      const blob = await generateUpiQrCardBlob({
        upiUri,
        upiId: effectiveUpiId,
        merchantName: effectiveBizName,
        customerName: cust.name,
        amount: dueAmt > 0 ? dueAmt : undefined,
        dateStr: todayStr
      });
      if (blob && typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        } catch {
          // Ignore clipboard rejection
        }
      }
    }

    const cleanAddr = (cust.address || '').trim();
    const cleanPhone = (cust.phone || '').trim();

    const billMessage = `*${effectiveBizName.toUpperCase()}*
*ACCOUNT STATEMENT*
========================================
*Date:* ${todayStr}
*Customer:* ${cust.name}
${cleanPhone ? `*Phone:* ${cleanPhone}\n` : ''}${cleanAddr ? `*Address:* ${cleanAddr}\n` : ''}----------------------------------------
*Jars Currently With Customer:* ${jarsCount} Jar(s)
*Total Outstanding Amount:* ₹${dueAmt.toLocaleString('en-IN')}
*Security Deposit Held:* ₹${deposit.toLocaleString('en-IN')}${upiSection}

Thank you,
*${effectiveBizName}*${effectiveBizPhone ? `\nTel: ${effectiveBizPhone}` : ''}`;

    openWhatsAppChat(cust.phone || '', billMessage);
  };

  // Handle customer deletion
  const handleConfirmDeleteCustomer = async () => {
    if (!customerToDelete || !onDeleteCustomer) return;
    setIsDeletingCustomer(true);
    triggerHaptic('delete');
    try {
      await onDeleteCustomer(customerToDelete.id, customerToDelete.name);
      setCustomerToDelete(null);
    } finally {
      setIsDeletingCustomer(false);
    }
  };

  const dueTabs: TabItem<DueFilter>[] = [
    { id: 'ALL', label: 'All Dues' },
    { 
      id: 'OVERDUE', 
      label: 'Overdue', 
      badge: overdueCustomersList.length > 0 ? overdueCustomersList.length : undefined,
      badgeColor: dueFilter === 'OVERDUE' ? 'bg-rose-500 text-white' : 'bg-rose-100 text-rose-700'
    }
  ];

  const typeTabs: TabItem<TypeFilter>[] = [
    { id: 'ALL', label: 'All' },
    { id: 'RESIDENTIAL', label: 'Residential' },
    { id: 'COMMERCIAL', label: 'Commercial' },
  ];

  const historyTabs: TabItem<HistoryTab>[] = [
    {
      id: 'DELIVERIES',
      label: 'Deliveries',
      badge: activeCustomerActivity ? activeCustomerActivity.deliveries.length : 0,
      badgeColor:
        historyTab === 'DELIVERIES' ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-700'
    },
    {
      id: 'ORDERS',
      label: 'Booked Orders',
      badge: activeCustomerActivity ? activeCustomerActivity.orders.length : 0,
      badgeColor:
        historyTab === 'ORDERS' ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-700'
    },
    {
      id: 'PAYMENTS',
      label: 'Payments',
      badge: activeCustomerActivity ? activeCustomerActivity.transactions.length : 0,
      badgeColor:
        historyTab === 'PAYMENTS' ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-700'
    }
  ];

  return (
    <PullToRefresh onRefresh={onRefresh || (() => {})}>
      <div className="space-y-5">
      {/* Unified Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Customers
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono tabular-nums">
              {filteredCustomers.length} of {customers.length}
            </span>
            {overdueCustomersList.length > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-mono tabular-nums">
                {overdueCustomersList.length} Overdue
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            <span className="font-mono tabular-nums">{totalCirculation}</span> {t.worker.jarsInCirculation} • <span className="font-mono tabular-nums">₹{totalOutstanding.toLocaleString('en-IN')}</span> {t.worker.pendingDuesTotal}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {userRole !== 'WORKER' && overdueCustomersList.length > 0 && (
            <Button
              variant="amber"
              size="md"
              glow
              leftIcon={<BellRing className="w-3.5 h-3.5" />}
              onClick={() => setIsReminderAssistantOpen(true)}
              title="Open WhatsApp reminder assistant to notify overdue customers"
            >
              <span>Send Due Reminders ({overdueCustomersList.length})</span>
            </Button>
          )}

          {onRefresh && (
            <Button
              variant="secondary"
              size="md"
              disabled={isRefreshing}
              leftIcon={<RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />}
              onClick={async () => {
                if (isRefreshing) return;
                setIsRefreshing(true);
                try {
                  await onRefresh();
                } finally {
                  setIsRefreshing(false);
                }
              }}
              title="Refresh customer list"
            >
              <span>{isRefreshing ? t.common.refreshing : t.common.refresh}</span>
            </Button>
          )}

          {onOpenOrdersTab && (
            <Button
              variant="secondary"
              size="md"
              leftIcon={<ClipboardList className="w-3.5 h-3.5 text-cyan-600" />}
              onClick={onOpenOrdersTab}
              title="View bulk & function orders"
            >
              <span>Bulk Orders ({orders.length})</span>
            </Button>
          )}

          {onOpenNewOrder && (
            <Button
              variant="secondary"
              size="md"
              leftIcon={<Plus className="w-3.5 h-3.5 text-amber-600 stroke-[2.5]" />}
              onClick={() => onOpenNewOrder()}
              title="Create new bulk water or function order"
            >
              <span>+ Bulk Order</span>
            </Button>
          )}

          {onOpenImportCustomers && (
            <Button
              id="import-customers-csv-btn"
              variant="secondary"
              size="md"
              leftIcon={<FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />}
              onClick={() => {
                setRouteFilter('ALL');
                setTypeFilter('ALL');
                setDueFilter('ALL');
                onOpenImportCustomers();
              }}
              title={isGujarati ? 'CSV અથવા Excel શીટમાંથી ગ્રાહકો ઉમેરો' : 'Upload CSV / Excel sheet to add customers'}
            >
              <span>{isGujarati ? 'CSV / Excel અપલોડ' : 'Import CSV / Excel'}</span>
            </Button>
          )}

          <Button
            variant="primary"
            size="md"
            glow
            leftIcon={<Plus className="w-3.5 h-3.5 stroke-[2.5]" />}
            onClick={() => {
              // Reset filters so newly added customer will be immediately visible
              setRouteFilter('ALL');
              setTypeFilter('ALL');
              setDueFilter('ALL');
              onOpenAddCustomer();
            }}
          >
            <span>{t.customer.newCustomer}</span>
          </Button>
        </div>
      </div>

      {/* Global Filter Indicator if search active */}
      {effectiveSearch.trim() && (
        <div className="bg-sky-50/80 border border-sky-200/90 rounded-2xl px-4 py-2.5 flex items-center justify-between text-xs text-sky-900 shadow-2xs">
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-sky-600 shrink-0" />
            <span>
              Showing results filtered by: <strong>"{effectiveSearch}"</strong> ({filteredCustomers.length} customer{filteredCustomers.length !== 1 ? 's' : ''} found)
            </span>
          </div>
          <button
            onClick={handleClear}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-white hover:bg-sky-100 text-sky-700 font-semibold rounded-md border border-sky-200 text-[11px] transition-colors cursor-pointer"
          >
            <X className="w-3 h-3" />
            <span>Clear search</span>
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder={t.common.searchPlaceholder}
            value={effectiveSearch}
            onChange={(e) => handleSearchInput(e.target.value)}
            className="w-full pl-8 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 text-slate-900"
          />
          {effectiveSearch && (
            <button
              onClick={handleClear}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Animated Due filter */}
          <AnimatedTabs
            tabs={dueTabs}
            activeTab={dueFilter}
            onChange={(mode) => setDueFilter(mode)}
            layoutId="customers-due-filter"
            size="sm"
          />

          {/* Route filter */}
          {routes.length > 0 && (
            <select
              value={routeFilter}
              onChange={(e) => setRouteFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
            >
              <option value="ALL">All Routes</option>
              {routes.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          )}

          {/* Animated Type filter */}
          <AnimatedTabs
            tabs={typeTabs}
            activeTab={typeFilter}
            onChange={(mode) => setTypeFilter(mode)}
            layoutId="customers-type-filter"
            size="sm"
          />
        </div>
      </div>

      {/* Customer Cards Grid with CardSpotlight */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCustomers.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-slate-200">
            <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700">No customers found</p>
            <p className="text-xs text-slate-400 mt-0.5">Try adjusting search or filters.</p>
          </div>
        ) : (
          filteredCustomers.map((cust) => {
            const hasDue = (cust.dueAmount || 0) > 0;
            const activity = customerActivityMap.get(cust.id);
            const deliveryCount = activity?.deliveries.length || 0;
            const orderCount = activity?.orders.length || 0;
            const totalDeliveredJars = activity?.totalJarsDelivered || 0;
            const lastDeliveryStr = activity?.lastDeliveryTimestamp
              ? new Date(activity.lastDeliveryTimestamp).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short'
                })
              : null;

            return (
              <CardSpotlight
                key={cust.id}
                spotlightColor={hasDue ? 'rgba(245, 158, 11, 0.12)' : 'rgba(14, 165, 233, 0.1)'}
                className="p-4 flex flex-col justify-between space-y-3"
              >
                <div>
                  {/* Top: Name, Type Badge & Route */}
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenCustomerHistory(cust)}
                      className="flex items-center gap-2.5 min-w-0 text-left group cursor-pointer"
                      title={`View order and delivery history for ${cust.name}`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 transition-transform group-hover:scale-105 ${
                        cust.customerType === 'COMMERCIAL'
                          ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                      }`}>
                        {cust.customerType === 'COMMERCIAL' ? (
                          <Building2 className="w-4 h-4" />
                        ) : (
                          <Home className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-900 group-hover:text-sky-700 transition-colors truncate">
                          {cust.name}
                        </h4>
                        <span className="text-[11px] text-slate-500 block truncate">
                          {cust.route?.trim() ? cust.route.trim() : (cust.address || 'No Route Assigned')}
                        </span>
                      </div>
                    </button>

                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 shrink-0">
                      {cust.customerType}
                    </span>
                  </div>

                  {/* Contact Info */}
                  <div className="mt-2.5 space-y-1 text-xs text-slate-500">
                    <p className="flex items-center gap-1.5 truncate">
                      <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="font-mono">{cust.phone || 'No phone'}</span>
                    </p>
                    <p className="flex items-center gap-1.5 truncate">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{cust.address || 'Address not listed'}</span>
                    </p>
                  </div>

                  {/* Jars & Due Summary */}
                  <div className="mt-3 p-2.5 bg-slate-50/80 rounded-xl border border-slate-100 grid grid-cols-3 gap-1 text-center">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">{t.worker.jarsHeld}</span>
                      <strong className="text-xs font-bold text-sky-700 font-mono tabular-nums">
                        {cust.jarsHolding || 0}
                      </strong>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">{t.worker.dueBalance}</span>
                      <strong className={`text-xs font-bold font-mono tabular-nums ${
                        hasDue ? 'text-rose-600' : 'text-emerald-600'
                      }`}>
                        ₹{cust.dueAmount || 0}
                      </strong>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">{t.worker.deposit}</span>
                      <strong className="text-xs font-semibold text-slate-700 font-mono tabular-nums">
                        ₹{cust.depositPaid || 0}
                      </strong>
                    </div>
                  </div>

                  {/* Cross-Check Order & Delivery Summary Bar */}
                  <button
                    type="button"
                    onClick={() => handleOpenCustomerHistory(cust)}
                    className="mt-2.5 w-full px-3 py-2 rounded-xl bg-slate-50 hover:bg-sky-50/80 border border-slate-200/80 hover:border-sky-200 transition-all flex items-center justify-between gap-2 text-left cursor-pointer group"
                    title={`Cross-check ${cust.name}'s deliveries, orders, and payment history`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <ClipboardList className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[11px] font-bold text-slate-800 group-hover:text-sky-800 block truncate">
                          {isGujarati ? 'ઓર્ડર અને ડિલિવરી વિગત' : 'Order & Delivery Details'}
                        </span>
                        <span className="text-[10px] text-slate-500 block truncate font-mono tabular-nums">
                          {deliveryCount} {deliveryCount === 1 ? 'delivery' : 'deliveries'} ({totalDeliveredJars} jars)
                          {orderCount > 0 ? ` • ${orderCount} order${orderCount === 1 ? '' : 's'}` : ''}
                          {lastDeliveryStr ? ` • Last: ${lastDeliveryStr}` : ''}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white group-hover:bg-sky-600 text-sky-700 group-hover:text-white border border-slate-200 group-hover:border-sky-600 transition-colors shrink-0">
                      {isGujarati ? 'તપાસો' : 'View'}
                    </span>
                  </button>
                </div>

                {/* Quick Actions */}
                <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => onQuickDeliveryToCustomer(cust, 'STANDARD')}
                    className="flex-1 min-w-[65px] inline-flex items-center justify-center gap-1 py-1.5 px-2 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer border border-sky-100"
                    title="Record a water jar delivery dispatch (Refill / Drop)"
                  >
                    <Truck className="w-3 h-3" />
                    <span>{t.worker.deliverAction}</span>
                  </button>

                  <button
                    onClick={() => onQuickDeliveryToCustomer(cust, 'RETURN_ONLY')}
                    className="flex-1 min-w-[65px] inline-flex items-center justify-center gap-1 py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer border border-emerald-100"
                    title={`Record empty jars returned from ${cust.name} (${cust.jarsHolding || 0} currently held)`}
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>{t.worker.returnAction}</span>
                  </button>

                  <button
                    onClick={() => onOpenSettleDue(cust)}
                    className={`flex-1 min-w-[55px] inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${
                      hasDue
                        ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                    }`}
                    title={hasDue ? 'Settle pending due balance' : 'Record payment or advance collection'}
                  >
                    <CreditCard className="w-3 h-3" />
                    <span>{isGujarati ? (hasDue ? 'બાકી' : 'હિસાબ') : (hasDue ? 'Due' : 'Txn')}</span>
                  </button>

                  {/* Send Reminder or Bill to Customer (WhatsApp) - Owner / Manager Only */}
                  {userRole !== 'WORKER' && (
                    hasDue ? (
                      <button
                        onClick={() => handleSendPaymentReminder(cust)}
                        className={`flex-1 min-w-[95px] inline-flex items-center justify-center gap-1 py-1.5 px-2 text-white rounded-lg text-xs font-bold shadow-2xs transition-all cursor-pointer ${
                          sentReminders[cust.id]
                            ? 'bg-emerald-700 hover:bg-emerald-800'
                            : 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800'
                        }`}
                        title={`Send WhatsApp payment reminder to ${cust.name} for ₹${cust.dueAmount}`}
                      >
                        <BellRing className="w-3 h-3" />
                        <span>{sentReminders[cust.id] ? 'Reminded ✓' : 'Reminder'}</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSendCustomerBill(cust)}
                        className="flex-1 min-w-[85px] inline-flex items-center justify-center gap-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                        title={`Send WhatsApp bill and ledger statement to ${cust.name}`}
                      >
                        <Share2 className="w-3 h-3" />
                        <span>Send Bill</span>
                      </button>
                    )
                  )}

                  {/* View/Print Formal Tax Invoice & Ledger - Owner / Manager Only */}
                  {userRole !== 'WORKER' && onOpenCustomerInvoice && (
                    <button
                      onClick={() => onOpenCustomerInvoice(cust)}
                      className="p-1.5 text-slate-500 hover:text-sky-700 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer border border-slate-200"
                      title={`View and print formal bill/invoice for ${cust.name}`}
                    >
                      <Receipt className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Edit Customer Profile & Balances */}
                  {onOpenEditCustomer && (
                    <button
                      onClick={() => onOpenEditCustomer(cust)}
                      className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer border border-slate-200"
                      title={`Edit details for customer ${cust.name}`}
                      aria-label={`Edit customer ${cust.name}`}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Delete Customer (Available to Worker & Owner) */}
                  {onDeleteCustomer && (
                    <button
                      onClick={() => setCustomerToDelete(cust)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title={`Delete customer ${cust.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </CardSpotlight>
            );
          })
        )}
      </div>

      {/* Customer Order & Delivery Cross-Check Modal */}
      <ModalWrapper
        isOpen={Boolean(activeHistoryCustomer)}
        onClose={() => setSelectedCustomerForHistory(null)}
        maxWidth="2xl"
        icon={
          <div className="w-8 h-8 rounded-xl bg-sky-600 text-white flex items-center justify-center">
            <ClipboardList className="w-4 h-4" />
          </div>
        }
        title={activeHistoryCustomer ? `${activeHistoryCustomer.name} — Order & Delivery History` : 'Order & Delivery History'}
        subtitle={
          activeHistoryCustomer
            ? `${activeHistoryCustomer.phone || 'No phone'}${activeHistoryCustomer.route ? ` • ${activeHistoryCustomer.route}` : ''}${activeHistoryCustomer.address ? ` • ${activeHistoryCustomer.address}` : ''}`
            : ''
        }
        footer={
          activeHistoryCustomer && (
            <div className="w-full flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    const cust = activeHistoryCustomer;
                    setSelectedCustomerForHistory(null);
                    onQuickDeliveryToCustomer(cust, 'STANDARD');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl transition-colors cursor-pointer shadow-2xs"
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>Record Delivery</span>
                </button>

                {onOpenNewOrder && (
                  <button
                    type="button"
                    onClick={() => {
                      const cust = activeHistoryCustomer;
                      setSelectedCustomerForHistory(null);
                      onOpenNewOrder(cust);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-colors cursor-pointer shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Bulk / Function Order</span>
                  </button>
                )}

                {userRole !== 'WORKER' && onOpenCustomerInvoice && (
                  <button
                    type="button"
                    onClick={() => {
                      const cust = activeHistoryCustomer;
                      setSelectedCustomerForHistory(null);
                      onOpenCustomerInvoice(cust);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-xl border border-slate-200 transition-colors cursor-pointer"
                  >
                    <Receipt className="w-3.5 h-3.5 text-sky-700" />
                    <span>Print Statement</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSelectedCustomerForHistory(null)}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          )
        }
      >
        {activeHistoryCustomer && activeCustomerActivity && (
          <div className="space-y-4">
            {/* 4-Card Summary Strip for Instant Purchase-Date Rate Reconciliation */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl bg-sky-50/70 border border-sky-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700 block">
                  Jars Delivered / Held
                </span>
                <div className="mt-1 flex items-baseline justify-between gap-1">
                  <strong className="text-base font-extrabold text-slate-900 font-mono tabular-nums">
                    {activeCustomerActivity.totalJarsDelivered}
                  </strong>
                  <span className="text-[11px] font-semibold text-sky-800 font-mono tabular-nums">
                    Held: {activeHistoryCustomer.jarsHolding || 0}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 block">
                  Total Bill (Purchase Rate)
                </span>
                <div className="mt-1 flex items-baseline justify-between gap-1">
                  <strong className="text-base font-extrabold text-slate-900 font-mono tabular-nums">
                    ₹{activeCustomerActivity.totalBilledAtPurchaseRates.toLocaleString('en-IN')}
                  </strong>
                  <span className="text-[10px] text-indigo-700 font-semibold">
                    {activeCustomerActivity.deliveries.length} {activeCustomerActivity.deliveries.length === 1 ? 'trip' : 'trips'}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                  Total Paid (All Modes)
                </span>
                <div className="mt-1 flex items-baseline justify-between gap-1">
                  <strong className="text-base font-extrabold text-emerald-700 font-mono tabular-nums">
                    ₹{activeCustomerActivity.totalPaymentsReceived.toLocaleString('en-IN')}
                  </strong>
                  <span className="text-[10px] text-slate-500 font-mono tabular-nums">
                    {activeCustomerActivity.totalDueClearances > 0
                      ? `+₹${activeCustomerActivity.totalDueClearances} settled`
                      : 'On delivery'}
                  </span>
                </div>
              </div>

              <div className={`p-3 rounded-xl border ${
                activeCustomerActivity.netOutstandingBalance > 0
                  ? 'bg-rose-50/70 border-rose-200'
                  : 'bg-slate-50 border-slate-200'
              }`}>
                <span className={`text-[10px] font-bold uppercase tracking-wider block ${
                  activeCustomerActivity.netOutstandingBalance > 0 ? 'text-rose-700' : 'text-slate-600'
                }`}>
                  Net Pending Due
                </span>
                <div className="mt-1 flex items-baseline justify-between gap-1">
                  <strong className={`text-base font-extrabold font-mono tabular-nums ${
                    activeCustomerActivity.netOutstandingBalance > 0 ? 'text-rose-600' : 'text-emerald-600'
                  }`}>
                    ₹{activeCustomerActivity.netOutstandingBalance.toLocaleString('en-IN')}
                  </strong>
                  <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                    Dep: ₹{activeHistoryCustomer.depositPaid || 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Tabs & Date/Search Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
              <AnimatedTabs
                tabs={historyTabs}
                activeTab={historyTab}
                onChange={(tMode) => setHistoryTab(tMode)}
                layoutId="customer-history-modal-tabs"
                size="sm"
              />

              <div className="flex items-center gap-1.5 flex-wrap">
                {(['ALL', 'TODAY', 'THIS_MONTH', 'CUSTOM'] as HistoryDateFilter[]).map((df) => (
                  <button
                    key={df}
                    type="button"
                    onClick={() => setHistoryDateFilter(df)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                      historyDateFilter === df
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {df === 'ALL'
                      ? 'All Dates'
                      : df === 'TODAY'
                      ? 'Today'
                      : df === 'THIS_MONTH'
                      ? 'This Month'
                      : 'Pick Date'}
                  </button>
                ))}

                {historyDateFilter === 'CUSTOM' && (
                  <input
                    type="date"
                    value={historyCustomDate}
                    onChange={(e) => setHistoryCustomDate(e.target.value)}
                    className="px-2 py-1 text-[11px] bg-white border border-slate-300 rounded-lg text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                )}
              </div>
            </div>

            {/* Search Input inside Modal */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search deliveries or orders by date (e.g. 18 Nov), item, driver name, payment mode (CASH/UPI/CREDIT), or notes..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full pl-8 pr-8 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-sky-500 text-slate-900"
              />
              {historySearch && (
                <button
                  type="button"
                  onClick={() => setHistorySearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Tab 1: DELIVERIES Cross-Check View */}
            {historyTab === 'DELIVERIES' && (
              <div className="space-y-2.5">
                {filteredHistoryDeliveries.length > 0 && (
                  <div className="px-3 py-2 bg-slate-100/80 rounded-xl flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 font-medium">
                    <span>
                      Showing <strong className="text-slate-900 font-mono">{filteredHistoryDeliveries.length}</strong> delivery record{filteredHistoryDeliveries.length === 1 ? '' : 's'}
                    </span>
                    <div className="flex items-center gap-3 font-mono tabular-nums flex-wrap">
                      <span>Delivered: <strong className="text-sky-700">+{filteredDeliveryTotals.jarsDelivered}</strong></span>
                      <span>Returned: <strong className="text-emerald-700">-{filteredDeliveryTotals.emptyCollected}</strong></span>
                      <span>Bill (Purchase Rate): <strong className="text-indigo-700">₹{filteredDeliveryTotals.totalBill.toLocaleString('en-IN')}</strong></span>
                      <span>Paid on Delivery: <strong className="text-slate-900">₹{filteredDeliveryTotals.amountCollected.toLocaleString('en-IN')}</strong></span>
                    </div>
                  </div>
                )}

                {filteredHistoryDeliveries.length === 0 ? (
                  <div className="py-10 text-center bg-slate-50 rounded-2xl border border-slate-200/80">
                    <Truck className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-700">No delivery records found</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {historyDateFilter !== 'ALL' || historySearch
                        ? 'Try clearing the date filter or search query.'
                        : `No water jar deliveries have been logged for ${activeHistoryCustomer.name} yet.`}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                    {filteredHistoryDeliveries.map((deliv, index) => {
                      const snapshot = activeCustomerActivity.ledger.snapshotsById.get(deliv.id);
                      const dDate = new Date(deliv.timestamp);
                      const dateFormatted = snapshot
                        ? snapshot.purchaseDateFormatted
                        : dDate.toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          });
                      const timeFormatted = snapshot
                        ? snapshot.purchaseTimeFormatted
                        : dDate.toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                          });
                      const isReturnOnly = (deliv.jarsDelivered || 0) === 0 && (deliv.emptyJarsCollected || 0) > 0;
                      const unitRate = snapshot ? snapshot.purchaseRate : resolveDeliveryPurchaseRate(deliv);
                      const billAmount = snapshot ? snapshot.billAmount : calculateDeliveryBillAmount(deliv);
                      const paidAmount = snapshot ? snapshot.paidAmount : getDeliveryPaidAmount(deliv);

                      return (
                        <div
                          key={deliv.id || `deliv-${index}`}
                          className="p-3 bg-white rounded-xl border border-slate-200/90 hover:border-sky-300 transition-colors shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-900 font-mono">
                                <Calendar className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                                {dateFormatted}
                              </span>
                              <span className="text-[11px] text-slate-500 font-mono">
                                {timeFormatted}
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase ${
                                isReturnOnly
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-sky-50 text-sky-700 border border-sky-200'
                              }`}>
                                {isReturnOnly ? 'Empty Return' : (deliv.itemType || '20L Water Jar')}
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md font-mono ${
                                deliv.paymentMode === 'CASH'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : deliv.paymentMode === 'UPI'
                                  ? 'bg-indigo-100 text-indigo-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}>
                                {deliv.paymentMode}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                              <span className="inline-flex items-center gap-1">
                                <UserCheck className="w-3 h-3 text-slate-400" />
                                <span>By: <strong className="text-slate-700">{deliv.workerName || 'Staff'}</strong></span>
                              </span>
                              {!isReturnOnly && (
                                <span className="font-mono">
                                  Purchase Rate: <strong className="text-slate-800">₹{unitRate}/jar</strong> • Bill: <strong className="text-indigo-700">₹{billAmount}</strong> ({deliv.jarsDelivered} × ₹{unitRate})
                                </span>
                              )}
                              {snapshot && (
                                <span className="font-mono text-slate-500">
                                  Running Due: <strong className={snapshot.balanceAfter > 0 ? 'text-rose-600' : 'text-emerald-700'}>₹{snapshot.balanceAfter}</strong>
                                </span>
                              )}
                              {deliv.notes && (
                                <span className="text-slate-600 italic truncate max-w-xs">
                                  "{deliv.notes}"
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Right Side Metrics + Receipt Action */}
                          <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
                            <div className="grid grid-cols-4 gap-2 text-center bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200/70 font-mono tabular-nums">
                              <div>
                                <span className="text-[9px] uppercase text-slate-400 block font-sans font-semibold">Delivered</span>
                                <strong className="text-xs font-extrabold text-sky-700 flex items-center justify-center gap-0.5">
                                  <ArrowUpRight className="w-3 h-3" />
                                  {deliv.jarsDelivered || 0}
                                </strong>
                              </div>
                              <div>
                                <span className="text-[9px] uppercase text-slate-400 block font-sans font-semibold">Returned</span>
                                <strong className="text-xs font-extrabold text-emerald-700 flex items-center justify-center gap-0.5">
                                  <ArrowDownLeft className="w-3 h-3" />
                                  {deliv.emptyJarsCollected || 0}
                                </strong>
                              </div>
                              <div>
                                <span className="text-[9px] uppercase text-slate-400 block font-sans font-semibold">Bill</span>
                                <strong className="text-xs font-extrabold text-indigo-700">
                                  ₹{billAmount}
                                </strong>
                              </div>
                              <div>
                                <span className="text-[9px] uppercase text-slate-400 block font-sans font-semibold">Paid</span>
                                <strong className="text-xs font-extrabold text-slate-900">
                                  ₹{paidAmount}
                                </strong>
                              </div>
                            </div>

                            {userRole !== 'WORKER' && onOpenDeliveryInvoice && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedCustomerForHistory(null);
                                  onOpenDeliveryInvoice(deliv);
                                }}
                                className="p-2 text-slate-600 hover:text-sky-700 hover:bg-sky-50 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                                title="View or print receipt for this delivery"
                              >
                                <Receipt className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: BOOKED ORDERS Cross-Check View */}
            {historyTab === 'ORDERS' && (
              <div className="space-y-2">
                {filteredHistoryOrders.length === 0 ? (
                  <div className="py-10 text-center bg-slate-50 rounded-2xl border border-slate-200/80">
                    <Package className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-700">No booked orders found</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      No advance or event orders found for {activeHistoryCustomer.name}.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                    {filteredHistoryOrders.map((ord) => {
                      const bookingDateStr = new Date(ord.bookingDate).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      });

                      return (
                        <div
                          key={ord.id}
                          className="p-3 bg-white rounded-xl border border-slate-200/90 hover:border-sky-300 transition-colors shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-slate-900">
                                {ord.itemType}
                              </span>
                              <span className="text-xs font-extrabold text-sky-700 font-mono">
                                × {ord.quantity}
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                ord.status === 'DELIVERED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : ord.status === 'CONFIRMED'
                                  ? 'bg-sky-100 text-sky-800'
                                  : ord.status === 'CANCELLED'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}>
                                {ord.status}
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                ord.paymentStatus === 'PAID'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}>
                                {ord.paymentStatus}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap font-mono">
                              <span>Booked: {bookingDateStr}</span>
                              {ord.deliveryDate && <span>Delivery Date: {ord.deliveryDate}</span>}
                              {ord.returnDate && <span>Return Date: {ord.returnDate}</span>}
                              {ord.assignedDriver && <span className="font-sans">Driver: {ord.assignedDriver}</span>}
                            </div>
                            {ord.notes && (
                              <p className="text-[11px] text-slate-600 italic">"{ord.notes}"</p>
                            )}
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
                            <div className="text-right font-mono tabular-nums">
                              <span className="text-[10px] text-slate-400 block font-sans">Order Total</span>
                              <strong className="text-sm font-extrabold text-slate-900">
                                ₹{(ord.totalAmount || 0).toLocaleString('en-IN')}
                              </strong>
                              {(ord.depositAmount || 0) > 0 && (
                                <span className="text-[10px] text-slate-500 block">
                                  +₹{ord.depositAmount} deposit
                                </span>
                              )}
                            </div>

                            {userRole !== 'WORKER' && onOpenOrderInvoice && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedCustomerForHistory(null);
                                  onOpenOrderInvoice(ord);
                                }}
                                className="p-2 text-slate-600 hover:text-sky-700 hover:bg-sky-50 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                                title="View or print order invoice"
                              >
                                <Receipt className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: PAYMENTS & SETTLEMENTS Cross-Check View */}
            {historyTab === 'PAYMENTS' && (
              <div className="space-y-2">
                {filteredHistoryTransactions.length === 0 ? (
                  <div className="py-10 text-center bg-slate-50 rounded-2xl border border-slate-200/80">
                    <CreditCard className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-700">No separate payment settlements found</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Payments collected at the time of delivery are shown in the Deliveries tab.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                    {filteredHistoryTransactions.map((tx) => {
                      const txDate = new Date(tx.timestamp);
                      const dateStr = txDate.toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      });
                      const timeStr = txDate.toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                      });

                      return (
                        <div
                          key={tx.id}
                          className="p-3 bg-white rounded-xl border border-slate-200/90 flex items-center justify-between gap-3"
                        >
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span className="text-xs font-bold text-slate-900">
                                {tx.type === 'DUE_CLEARANCE'
                                  ? 'Due Balance Settlement'
                                  : tx.type === 'SECURITY_DEPOSIT'
                                  ? 'Security Deposit'
                                  : 'Refill Payment'}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono">
                                {tx.paymentMode}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>{dateStr} • {timeStr}</span>
                              {tx.notes && <span className="font-sans italic text-slate-600">— "{tx.notes}"</span>}
                            </div>
                          </div>

                          <div className="text-right font-mono tabular-nums shrink-0">
                            <strong className="text-sm font-extrabold text-emerald-700">
                              +₹{(tx.amount || 0).toLocaleString('en-IN')}
                            </strong>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </ModalWrapper>

      {/* Bulk Overdue Payment Reminder Assistant Modal with ModalWrapper */}
      <ModalWrapper
        isOpen={isReminderAssistantOpen}
        onClose={() => setIsReminderAssistantOpen(false)}
        maxWidth="xl"
        icon={
          <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center">
            <BellRing className="w-4 h-4" />
          </div>
        }
        title="Overdue Payment Reminder Assistant"
        subtitle={`${overdueCustomersList.length} customer(s) with ₹${totalOutstanding.toLocaleString('en-IN')} pending balance`}
        footer={
          <div className="w-full flex items-center justify-between text-xs">
            <span className="text-slate-500 font-mono tabular-nums">
              {Object.keys(sentReminders).length} of {overdueCustomersList.length} reminders sent
            </span>
            <button
              type="button"
              onClick={() => setIsReminderAssistantOpen(false)}
              className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-colors cursor-pointer shadow-2xs"
            >
              Done
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          {effectiveUpiId ? (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 font-semibold select-none">
                <input
                  type="checkbox"
                  checked={includeDueQrInReminders}
                  onChange={(e) => setIncludeDueQrInReminders(e.target.checked)}
                  className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300 cursor-pointer"
                />
                <span className="flex items-center gap-1.5">
                  <QrCode className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                  <span>Include Dynamic Due Amount QR & Pay Link</span>
                </span>
              </label>
              <span className="text-[11px] font-mono text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200 shrink-0 self-start sm:self-auto">
                UPI: {effectiveUpiId}
              </span>
            </div>
          ) : (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 flex items-center justify-between">
              <span>No UPI ID configured for this business. Reminders will be sent without QR links.</span>
            </div>
          )}

          {overdueCustomersList.length === 0 ? (
            <div className="py-10 text-center text-slate-500">
              <p className="font-bold text-sm text-emerald-700">All customer accounts are clear!</p>
              <p className="text-xs mt-1">No pending due balances at this time.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {overdueCustomersList.map((cust) => (
                <div
                  key={`overdue-${cust.id}`}
                  className="p-3 bg-white rounded-xl border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 truncate">{cust.name}</h4>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-medium">
                        {cust.route || 'General'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                      <span>Phone: <span className="font-mono">{cust.phone || 'N/A'}</span></span>
                      <span>Holding: <span className="font-mono tabular-nums">{cust.jarsHolding || 0}</span> jars</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-semibold text-rose-500 block uppercase">Due Balance</span>
                    <strong className="text-sm font-extrabold text-rose-600 font-mono tabular-nums">
                      ₹{cust.dueAmount.toLocaleString('en-IN')}
                    </strong>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSendPaymentReminder(cust)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer shrink-0 flex items-center gap-1.5 text-white ${
                      sentReminders[cust.id]
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800'
                    }`}
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>{sentReminders[cust.id] ? 'Sent ✓' : 'Send WhatsApp'}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </ModalWrapper>

      {/* Delete Customer Confirmation Modal with ModalWrapper */}
      <ModalWrapper
        isOpen={Boolean(customerToDelete)}
        onClose={() => setCustomerToDelete(null)}
        maxWidth="sm"
        showCloseButton={false}
      >
        {customerToDelete && (
          <div className="space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">{t.customer.deleteConfirmTitle}</h3>
              <p className="text-xs text-slate-600">
                {t.customer.deleteConfirmText} <strong>"{customerToDelete.name}"</strong>?
              </p>
              {(customerToDelete.dueAmount || 0) > 0 && (
                <p className="text-[11px] text-amber-800 bg-amber-50 rounded-lg p-2 font-medium mt-1">
                  {t.customer.dueWarning} (₹{customerToDelete.dueAmount}, {customerToDelete.jarsHolding || 0} jars)
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCustomerToDelete(null)}
                disabled={isDeletingCustomer}
                className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                {t.common.cancel}
              </button>

              <button
                type="button"
                onClick={handleConfirmDeleteCustomer}
                disabled={isDeletingCustomer}
                className="flex-1 py-2.5 px-3 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-semibold rounded-xl shadow-2xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isDeletingCustomer ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>{t.common.deleting}</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t.common.delete}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </ModalWrapper>
    </div>
    </PullToRefresh>
  );
};
