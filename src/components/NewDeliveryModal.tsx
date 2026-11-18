import React, { useState, useEffect, useMemo } from 'react';
import { Customer, InventoryItem } from '../types';
import { processDeliveryAtomic, DeliveryRecordInput } from '../services/deliveryService';
import { getActiveSession, getActiveBusiness } from '../services/businessService';
import { generateUpiUri, generateUpiQrDataUrl } from '../utils/upiUtils';
import { triggerHaptic } from '../utils/haptics';
import {
  X,
  Truck,
  Check,
  AlertCircle,
  IndianRupee,
  RotateCcw,
  Plus,
  Minus,
  ArrowRight,
  QrCode,
  Users,
  User,
  Search,
  CheckSquare,
  Square
} from 'lucide-react';
import { Button } from './ui/Button';
import { useLanguage } from '../context/LanguageContext';

interface NewDeliveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  inventory: InventoryItem[];
  businessId: string;
  onDeliveryComplete: (message: string) => void;
  onOpenAddCustomer?: () => void;
  defaultCustomerId?: string | null;
  defaultWorkerName?: string;
  initialMode?: 'STANDARD' | 'RETURN_ONLY' | 'DROP_ONLY';
  initialEntryMode?: 'SINGLE' | 'BULK';
}

type RateMode = 'PRODUCT' | 'DEFAULT_BIZ' | 'CUSTOM';

export const NewDeliveryModal: React.FC<NewDeliveryModalProps> = ({
  isOpen,
  onClose,
  customers,
  inventory,
  businessId,
  onDeliveryComplete,
  onOpenAddCustomer,
  defaultCustomerId,
  defaultWorkerName,
  initialMode = 'STANDARD',
  initialEntryMode = 'SINGLE'
}) => {
  const { t, isGujarati } = useLanguage();

  // Entry Mode: Single Customer vs Bulk Multi-Customer Route Entry
  const [entryMode, setEntryMode] = useState<'SINGLE' | 'BULK'>(initialEntryMode);

  // Single Mode Customer Selection
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');

  // Bulk Mode Multi-Customer Selection & Filtering
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [bulkRouteFilter, setBulkRouteFilter] = useState<string>('ALL');
  const [bulkSearchQuery, setBulkSearchQuery] = useState<string>('');
  const [perCustomerRateOverrides, setPerCustomerRateOverrides] = useState<Record<string, number>>({});

  // Shared Delivery Parameters
  const [workerName, setWorkerName] = useState<string>('');
  const [selectedItemType, setSelectedItemType] = useState<string>('');
  const [jarsDelivered, setJarsDelivered] = useState<number>(1);
  const [emptyJarsCollected, setEmptyJarsCollected] = useState<number>(1);
  const [amountCollected, setAmountCollected] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI' | 'CREDIT'>('CREDIT');

  // Flexible Rate Selection (Selected Product Rate | Default Business Rate | Custom Rate)
  const [rateMode, setRateMode] = useState<RateMode>('PRODUCT');
  const [customUnitPrice, setCustomUnitPrice] = useState<number>(35);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const currentBiz = getActiveBusiness();
  const currentCustomer = customers.find(c => c.id === selectedCustomerId);
  const currentItem = inventory.find(i => i.itemType === selectedItemType) || inventory[0];
  const productUnitPrice = currentItem ? (Number(currentItem.unitPrice) || 35) : 35;
  const defaultBizRate = Number(currentBiz?.defaultJarRate) || 35;

  // Base unit price determined by rateMode
  const baseUnitPrice = useMemo(() => {
    if (rateMode === 'CUSTOM') return Math.max(0, Number(customUnitPrice) || 0);
    if (rateMode === 'DEFAULT_BIZ') return defaultBizRate;
    return productUnitPrice;
  }, [rateMode, customUnitPrice, defaultBizRate, productUnitPrice]);

  // Effective unit price for Single Mode (respects customer's saved customJarRate when in DEFAULT_BIZ mode)
  const unitPrice = useMemo(() => {
    if (rateMode === 'CUSTOM') return Math.max(0, Number(customUnitPrice) || 0);
    if (rateMode === 'DEFAULT_BIZ' && currentCustomer?.customJarRate && currentCustomer.customJarRate > 0) {
      return Number(currentCustomer.customJarRate);
    }
    return baseUnitPrice;
  }, [rateMode, customUnitPrice, currentCustomer, baseUnitPrice]);

  // Resolve unit rate for any specific customer in Bulk Mode
  const getCustomerUnitRate = (cust: Customer): number => {
    if (perCustomerRateOverrides[cust.id] !== undefined) {
      return Math.max(0, Number(perCustomerRateOverrides[cust.id]) || 0);
    }
    if (rateMode === 'CUSTOM') {
      return Math.max(0, Number(customUnitPrice) || 0);
    }
    if (rateMode === 'DEFAULT_BIZ') {
      if (cust.customJarRate && cust.customJarRate > 0) {
        return Number(cust.customJarRate);
      }
      return defaultBizRate;
    }
    return productUnitPrice;
  };

  // Distinct routes across customers for Bulk Route Filter
  const availableRoutes = useMemo(() => {
    const routesSet = new Set<string>();
    customers.forEach(c => {
      const r = (c.route || 'General').trim();
      if (r) routesSet.add(r);
    });
    return Array.from(routesSet).sort();
  }, [customers]);

  // Filtered customers visible in Bulk Mode checklist
  const filteredBulkCustomers = useMemo(() => {
    const q = bulkSearchQuery.toLowerCase().trim();
    return customers.filter(c => {
      const routeName = (c.route || 'General').trim();
      const matchesRoute = bulkRouteFilter === 'ALL' || routeName === bulkRouteFilter;
      const matchesSearch =
        !q ||
        (c.name || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q) ||
        (c.address || '').toLowerCase().includes(q) ||
        routeName.toLowerCase().includes(q);
      return matchesRoute && matchesSearch;
    });
  }, [customers, bulkRouteFilter, bulkSearchQuery]);

  // Selected customer objects in Bulk Mode
  const selectedBulkCustomerList = useMemo(
    () => customers.filter(c => selectedCustomerIds.includes(c.id)),
    [customers, selectedCustomerIds]
  );

  // Batch totals for Bulk Mode
  const bulkSummary = useMemo(() => {
    const count = selectedBulkCustomerList.length;
    const totalJarsOut = count * jarsDelivered;
    const totalEmptiesIn = count * emptyJarsCollected;
    let totalBillAmount = 0;
    selectedBulkCustomerList.forEach(c => {
      const rate = getCustomerUnitRate(c);
      totalBillAmount += jarsDelivered * rate;
    });
    const totalCollectedAmount = paymentMode === 'CREDIT' ? 0 : totalBillAmount;
    return {
      count,
      totalJarsOut,
      totalEmptiesIn,
      totalBillAmount,
      totalCollectedAmount
    };
  }, [selectedBulkCustomerList, jarsDelivered, emptyJarsCollected, paymentMode, rateMode, customUnitPrice, defaultBizRate, productUnitPrice, perCustomerRateOverrides]);

  // Initialize modal state on open
  useEffect(() => {
    if (!isOpen) return;

    setEntryMode(defaultCustomerId ? 'SINGLE' : initialEntryMode);
    setErrorMessage(null);
    setBulkSearchQuery('');
    setBulkRouteFilter('ALL');
    setPerCustomerRateOverrides({});

    let initialCust: Customer | undefined;
    if (defaultCustomerId && customers.some(c => c.id === defaultCustomerId)) {
      setSelectedCustomerId(defaultCustomerId);
      setSelectedCustomerIds([defaultCustomerId]);
      initialCust = customers.find(c => c.id === defaultCustomerId);
    } else if (customers.length > 0) {
      setSelectedCustomerId(customers[0].id);
      setSelectedCustomerIds([]);
      initialCust = customers[0];
    }

    const firstItem = inventory[0];
    if (firstItem) {
      setSelectedItemType(firstItem.itemType);
      setCustomUnitPrice(Number(firstItem.unitPrice) || 35);
    } else {
      setSelectedItemType('20L Normal Water Jar');
      setCustomUnitPrice(35);
    }
    setRateMode(initialCust?.customJarRate && initialCust.customJarRate > 0 ? 'DEFAULT_BIZ' : 'PRODUCT');

    const session = getActiveSession();
    const activeBiz = getActiveBusiness();
    const fallbackWorker = defaultWorkerName || session?.displayName || session?.workerRecord?.workerName || activeBiz?.ownerName || '';
    if (fallbackWorker) {
      setWorkerName(fallbackWorker);
    }

    // Set initial preset mode with CREDIT default
    setPaymentMode('CREDIT');
    if (initialMode === 'RETURN_ONLY') {
      setJarsDelivered(0);
      setEmptyJarsCollected(1);
      setAmountCollected(0);
    } else if (initialMode === 'DROP_ONLY') {
      setJarsDelivered(1);
      setEmptyJarsCollected(0);
      setAmountCollected(0);
    } else {
      setJarsDelivered(1);
      setEmptyJarsCollected(1);
      setAmountCollected(0);
    }
  }, [isOpen, defaultCustomerId, customers, inventory, initialMode, initialEntryMode, defaultWorkerName]);

  // Sync Single Mode amountCollected when unitPrice or jarsDelivered changes in CASH/UPI mode
  useEffect(() => {
    if (entryMode === 'SINGLE' && paymentMode !== 'CREDIT') {
      setAmountCollected(jarsDelivered * unitPrice);
    }
  }, [unitPrice, jarsDelivered, paymentMode, entryMode]);

  // Generate UPI QR Code whenever UPI is active and amount > 0
  const activeUpiAmount = entryMode === 'BULK' ? bulkSummary.totalCollectedAmount : amountCollected;
  useEffect(() => {
    if (isOpen && paymentMode === 'UPI' && currentBiz.upiId?.trim() && activeUpiAmount > 0) {
      const upiUri = generateUpiUri({
        upiId: currentBiz.upiId.trim(),
        merchantName: currentBiz.name || 'Water Distribution',
        amount: Number(activeUpiAmount),
        note:
          entryMode === 'BULK'
            ? `Bulk Water Delivery (${bulkSummary.count} drops)`
            : `Water Delivery - ${currentCustomer?.name || 'Customer'}`
      });
      generateUpiQrDataUrl(upiUri, { width: 220 }).then(setQrDataUrl);
    } else {
      setQrDataUrl('');
    }
  }, [isOpen, paymentMode, currentBiz, activeUpiAmount, currentCustomer, entryMode, bulkSummary.count]);

  const handleJarsDeliveredChange = (qty: number) => {
    const val = Math.max(0, qty);
    setJarsDelivered(val);

    if (paymentMode !== 'CREDIT') {
      setAmountCollected(val * unitPrice);
    }
  };

  const handleEmptyJarsCollectedChange = (qty: number) => {
    const val = Math.max(0, qty);
    setEmptyJarsCollected(val);
  };

  const handlePaymentModeChange = (mode: 'CASH' | 'UPI' | 'CREDIT') => {
    setPaymentMode(mode);
    if (mode === 'CREDIT') {
      setAmountCollected(0);
    } else if (jarsDelivered > 0) {
      setAmountCollected(jarsDelivered * unitPrice);
    }
  };

  // Toggle single customer in Bulk Mode
  const toggleBulkCustomer = (customerId: string) => {
    setSelectedCustomerIds(prev =>
      prev.includes(customerId)
        ? prev.filter(id => id !== customerId)
        : [...prev, customerId]
    );
  };

  // Select or deselect all currently visible filtered customers in Bulk Mode
  const allVisibleSelected =
    filteredBulkCustomers.length > 0 &&
    filteredBulkCustomers.every(c => selectedCustomerIds.includes(c.id));

  const handleToggleSelectAllVisible = () => {
    const visibleIds = filteredBulkCustomers.map(c => c.id);
    if (allVisibleSelected) {
      setSelectedCustomerIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedCustomerIds(prev => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  // Quick Preset Handlers
  const applyStandardRefill = () => {
    setJarsDelivered(1);
    setEmptyJarsCollected(1);
    if (paymentMode !== 'CREDIT') {
      setAmountCollected(unitPrice);
    }
  };

  const applyReturnOnly = () => {
    const custHolding = entryMode === 'SINGLE' ? (currentCustomer?.jarsHolding || 0) : 1;
    setJarsDelivered(0);
    setEmptyJarsCollected(custHolding > 0 ? custHolding : 1);
    setAmountCollected(0);
  };

  const applyDropOnly = () => {
    setJarsDelivered(1);
    setEmptyJarsCollected(0);
    if (paymentMode !== 'CREDIT') {
      setAmountCollected(unitPrice);
    }
  };

  const isReturnOnly = jarsDelivered === 0 && emptyJarsCollected > 0;
  const isDropOnly = jarsDelivered > 0 && emptyJarsCollected === 0;
  const isRefill = jarsDelivered > 0 && emptyJarsCollected > 0;

  // Single-mode real-time impact calculations
  const currentHolding = currentCustomer?.jarsHolding || 0;
  const calculatedNewHolding = Math.max(0, currentHolding + jarsDelivered - emptyJarsCollected);
  const currentDue = currentCustomer?.dueAmount || 0;
  const orderCost = jarsDelivered * unitPrice;
  const calculatedNewDue = Math.max(0, currentDue + orderCost - amountCollected);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (jarsDelivered <= 0 && emptyJarsCollected <= 0) {
      setErrorMessage('Please record at least 1 jar dropped or 1 empty jar returned.');
      return;
    }

    const activeSession = getActiveSession();
    const activeBiz = getActiveBusiness();
    const resolvedWorkerName =
      workerName.trim() ||
      defaultWorkerName ||
      activeSession?.displayName ||
      activeSession?.workerRecord?.workerName ||
      activeBiz?.ownerName ||
      'Staff Driver';
    const resolvedItemType = selectedItemType || currentItem?.itemType || '20L Normal Water Jar';

    if (entryMode === 'BULK') {
      if (selectedBulkCustomerList.length === 0) {
        setErrorMessage('Please select at least 1 customer for bulk delivery.');
        return;
      }

      setIsSubmitting(true);
      setErrorMessage(null);

      try {
        for (const cust of selectedBulkCustomerList) {
          const custRate = getCustomerUnitRate(cust);
          const custBill = jarsDelivered * custRate;
          const custCollected = paymentMode === 'CREDIT' ? 0 : custBill;

          const input: DeliveryRecordInput = {
            businessId,
            customerId: cust.id,
            customerName: cust.name,
            workerName: resolvedWorkerName,
            jarsDelivered: Number(jarsDelivered),
            emptyJarsCollected: Number(emptyJarsCollected),
            amountCollected: Number(custCollected),
            paymentMode,
            itemType: resolvedItemType,
            unitPrice: custRate
          };

          await processDeliveryAtomic(input);
        }

        triggerHaptic('delivery');
        onDeliveryComplete(
          `Bulk delivery completed: ${selectedBulkCustomerList.length} customer(s) · ${bulkSummary.totalJarsOut} jar(s) dropped, ${bulkSummary.totalEmptiesIn} returned`
        );
        onClose();
      } catch {
        setErrorMessage('Could not complete bulk delivery. Please verify your connection.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // SINGLE CUSTOMER MODE
    if (!selectedCustomerId || !currentCustomer) {
      setErrorMessage('Please choose an active customer.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const input: DeliveryRecordInput = {
        businessId,
        customerId: selectedCustomerId,
        customerName: currentCustomer.name,
        workerName: resolvedWorkerName,
        jarsDelivered: Number(jarsDelivered),
        emptyJarsCollected: Number(emptyJarsCollected),
        amountCollected: Number(amountCollected),
        paymentMode,
        itemType: resolvedItemType,
        unitPrice
      };

      await processDeliveryAtomic(input);
      triggerHaptic('delivery');

      if (jarsDelivered === 0 && emptyJarsCollected > 0) {
        onDeliveryComplete(`Return logged: ${emptyJarsCollected} empty jar(s) from ${currentCustomer.name}`);
      } else if (jarsDelivered > 0 && emptyJarsCollected > 0) {
        onDeliveryComplete(`Delivery logged: ${jarsDelivered} dropped, ${emptyJarsCollected} returned for ${currentCustomer.name}`);
      } else {
        onDeliveryComplete(`Delivery logged: ${jarsDelivered} jar(s) to ${currentCustomer.name}`);
      }
      onClose();
    } catch {
      setErrorMessage('Could not record delivery. Please verify your connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div id="new-delivery-modal" role="dialog" aria-modal="true" className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-2.5 sm:p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[85dvh] sm:max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              isReturnOnly ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'
            }`}>
              {isReturnOnly ? <RotateCcw className="w-4 h-4" /> : <Truck className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 truncate">
                {entryMode === 'BULK'
                  ? (isGujarati ? 'બલ્ક રૂટ ડિલિવરી' : 'Bulk Route Delivery')
                  : isReturnOnly
                  ? t.worker.recordJarReturnTitle
                  : t.worker.recordDeliveryTitle}
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 truncate">
                {entryMode === 'BULK'
                  ? 'Select multiple customers on a route and assign uniform jar drops'
                  : isReturnOnly 
                  ? 'Collect empty bottles & balance customer ledger' 
                  : 'Log water jars delivered, empties returned, and payments'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body & Sticky Footer Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-3.5 sm:p-5 space-y-3 sm:space-y-4 overflow-y-auto overscroll-contain modal-scroll-body flex-1 min-h-0">
          {errorMessage && (
            <div className="p-2.5 sm:p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Single vs Bulk Entry Mode Switcher */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80">
            <button
              type="button"
              id="delivery-mode-single-btn"
              onClick={() => {
                setEntryMode('SINGLE');
                setErrorMessage(null);
              }}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                entryMode === 'SINGLE'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/70'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-3.5 h-3.5 text-sky-600" />
              <span>{isGujarati ? 'સિંગલ ગ્રાહક' : 'Single Customer'}</span>
            </button>

            <button
              type="button"
              id="delivery-mode-bulk-btn"
              onClick={() => {
                setEntryMode('BULK');
                setErrorMessage(null);
              }}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                entryMode === 'BULK'
                  ? 'bg-white text-sky-700 shadow-2xs border border-sky-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-sky-600" />
              <span>{isGujarati ? 'બલ્ક ડિલિવરી (રૂટ)' : 'Bulk Route Entry'}</span>
              {selectedCustomerIds.length > 0 && (
                <span className="font-mono tabular-nums text-[11px] text-sky-700">
                  ({selectedCustomerIds.length})
                </span>
              )}
            </button>
          </div>

          {/* Quick Preset Mode Selector */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Transaction Mode
            </label>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100/80 rounded-xl border border-slate-200/80">
              <button
                type="button"
                onClick={applyStandardRefill}
                className={`py-2 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                  isRefill
                    ? 'bg-white text-sky-700 shadow-xs border border-sky-100'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <span>Refill / Exchange</span>
                <span className="text-[10px] font-normal text-slate-400">1 Drop · 1 Return</span>
              </button>

              <button
                type="button"
                onClick={applyReturnOnly}
                className={`py-2 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                  isReturnOnly
                    ? 'bg-white text-emerald-700 shadow-xs border border-emerald-100'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <span>Return Only</span>
                <span className="text-[10px] font-normal text-emerald-600">0 Drop · Empties</span>
              </button>

              <button
                type="button"
                onClick={applyDropOnly}
                className={`py-2 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                  isDropOnly
                    ? 'bg-white text-indigo-700 shadow-xs border border-indigo-100'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <span>Drop Only</span>
                <span className="text-[10px] font-normal text-slate-400">Jars · 0 Return</span>
              </button>
            </div>
          </div>

          {/* Customer Selection: SINGLE vs BULK */}
          {entryMode === 'SINGLE' ? (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  {t.worker.selectCustomer}
                </label>
                {onOpenAddCustomer && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAddCustomer();
                    }}
                    className="text-xs font-semibold text-sky-600 hover:text-sky-700 cursor-pointer"
                  >
                    + {t.customer.newCustomer}
                  </button>
                )}
              </div>
              <select
                id="delivery-customer-select"
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                required
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.route || 'General'} ({c.jarsHolding || 0} {isGujarati ? 'જાર' : 'jars'}, {isGujarati ? 'બાકી' : 'Due'}: ₹{c.dueAmount || 0})
                  </option>
                ))}
              </select>
              {currentCustomer && (
                <div className="mt-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200/70 flex items-center justify-between text-xs text-slate-600 font-mono tabular-nums">
                  <span>{t.worker.jarsHeld}: <strong className="text-slate-900 font-bold">{currentCustomer.jarsHolding || 0}</strong></span>
                  <span>{t.worker.pendingDue}: <strong className={currentCustomer.dueAmount > 0 ? 'text-amber-700 font-bold' : 'text-slate-900 font-bold'}>₹{currentCustomer.dueAmount || 0}</strong></span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2.5 p-3 bg-slate-50/90 rounded-2xl border border-slate-200/90">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Select Route Customers
                  </span>
                  <span className="text-xs font-mono tabular-nums text-sky-700 font-bold">
                    · {selectedCustomerIds.length} selected
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleToggleSelectAllVisible}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-sky-50 text-sky-700 border border-sky-200 rounded-lg text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {allVisibleSelected ? (
                      <>
                        <CheckSquare className="w-3.5 h-3.5 text-sky-600" />
                        <span>Deselect Visible ({filteredBulkCustomers.length})</span>
                      </>
                    ) : (
                      <>
                        <Square className="w-3.5 h-3.5 text-slate-400" />
                        <span>Select All Visible ({filteredBulkCustomers.length})</span>
                      </>
                    )}
                  </button>
                  {selectedCustomerIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedCustomerIds([])}
                      className="px-2 py-1 text-[11px] font-semibold text-slate-500 hover:text-rose-600 transition-colors cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Route Filter + Search Input Row */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="sm:col-span-5">
                  <select
                    aria-label="Filter customers by route"
                    value={bulkRouteFilter}
                    onChange={(e) => setBulkRouteFilter(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="ALL">All Routes ({customers.length})</option>
                    {availableRoutes.map(r => (
                      <option key={r} value={r}>
                        {r} ({customers.filter(c => (c.route || 'General').trim() === r).length})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-7 relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={bulkSearchQuery}
                    onChange={(e) => setBulkSearchQuery(e.target.value)}
                    placeholder="Search customer, phone, or address..."
                    className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  {bulkSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setBulkSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Multi-Customer Scrollable Checklist with Per-Customer Rate Override */}
              <div className="max-h-44 overflow-y-auto divide-y divide-slate-100 bg-white rounded-xl border border-slate-200/90">
                {filteredBulkCustomers.length === 0 ? (
                  <div className="py-6 px-3 text-center text-xs text-slate-400">
                    No customers match the selected route or search filter.
                  </div>
                ) : (
                  filteredBulkCustomers.map((c) => {
                    const isChecked = selectedCustomerIds.includes(c.id);
                    const resolvedRate = getCustomerUnitRate(c);
                    return (
                      <div
                        key={c.id}
                        onClick={() => toggleBulkCustomer(c.id)}
                        className={`px-3 py-2 flex items-center justify-between gap-2 text-xs cursor-pointer transition-colors ${
                          isChecked ? 'bg-sky-50/70 hover:bg-sky-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-slate-900 truncate">
                              {c.name}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate font-mono tabular-nums">
                              {c.route || 'General'} · {c.jarsHolding || 0} jars · Due ₹{c.dueAmount || 0}
                            </p>
                          </div>
                        </div>

                        {/* Per-customer rate input (allows custom/default/selected rate override per customer) */}
                        <div
                          className="flex items-center gap-1 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="text-[10px] font-semibold text-slate-400">₹</span>
                          <input
                            type="number"
                            min="0"
                            aria-label={`Rate per jar for ${c.name}`}
                            title="Unit price per jar for this customer"
                            value={resolvedRate}
                            onChange={(e) => {
                              const val = Math.max(0, Number(e.target.value) || 0);
                              setPerCustomerRateOverrides(prev => ({
                                ...prev,
                                [c.id]: val
                              }));
                            }}
                            className="w-14 px-1.5 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-mono tabular-nums font-bold text-slate-800 text-right focus:outline-none focus:ring-1 focus:ring-sky-500"
                          />
                          <span className="text-[10px] text-slate-400">/jar</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Product & Driver Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                {t.worker.itemProductType}
              </label>
              <select
                value={selectedItemType}
                onChange={(e) => {
                  setSelectedItemType(e.target.value);
                  const selected = inventory.find(i => i.itemType === e.target.value);
                  const price = selected ? (Number(selected.unitPrice) || 35) : 35;
                  if (rateMode === 'PRODUCT' && paymentMode !== 'CREDIT' && jarsDelivered > 0) {
                    setAmountCollected(jarsDelivered * price);
                  }
                }}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                {inventory.length > 0 ? (
                  inventory.map((item) => (
                    <option key={item.itemType} value={item.itemType}>
                      {item.displayName || item.itemType} (₹{item.unitPrice || 35}/jar)
                    </option>
                  ))
                ) : (
                  <option value="20L Normal Water Jar">20L Normal Water Jar (₹35/jar)</option>
                )}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  {t.worker.driverStaffName}
                </label>
                <span className="text-[11px] font-medium text-slate-400">Optional</span>
              </div>
              <input
                type="text"
                id="delivery-driver-name-input"
                value={workerName}
                onChange={(e) => setWorkerName(e.target.value)}
                placeholder="e.g. Driver Name"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          {/* Flexible Pricing Rate Selector (Selected Product Rate | Default Rate | Custom Rate) */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Rate per Jar Option
              </label>
              <span className="text-xs font-mono tabular-nums font-bold text-sky-700">
                Active Base Rate: ₹{baseUnitPrice}/jar
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setRateMode('PRODUCT');
                  setPerCustomerRateOverrides({});
                }}
                className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                  rateMode === 'PRODUCT'
                    ? 'bg-white text-sky-700 border-sky-200 shadow-2xs'
                    : 'bg-slate-100/70 text-slate-600 border-transparent hover:text-slate-900'
                }`}
              >
                Selected (₹{productUnitPrice})
              </button>

              <button
                type="button"
                onClick={() => {
                  setRateMode('DEFAULT_BIZ');
                  setPerCustomerRateOverrides({});
                }}
                className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                  rateMode === 'DEFAULT_BIZ'
                    ? 'bg-white text-sky-700 border-sky-200 shadow-2xs'
                    : 'bg-slate-100/70 text-slate-600 border-transparent hover:text-slate-900'
                }`}
              >
                Default (₹{defaultBizRate})
              </button>

              <button
                type="button"
                onClick={() => {
                  setRateMode('CUSTOM');
                  setPerCustomerRateOverrides({});
                }}
                className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                  rateMode === 'CUSTOM'
                    ? 'bg-white text-sky-700 border-sky-200 shadow-2xs'
                    : 'bg-slate-100/70 text-slate-600 border-transparent hover:text-slate-900'
                }`}
              >
                Custom Rate
              </button>
            </div>

            {rateMode === 'CUSTOM' && (
              <div className="flex items-center justify-between gap-3 pt-1">
                <span className="text-xs text-slate-600 font-medium">
                  Enter Custom Rate (₹ per jar):
                </span>
                <div className="relative w-28">
                  <IndianRupee className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    min="0"
                    value={customUnitPrice}
                    onChange={(e) => setCustomUnitPrice(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full pl-7 pr-2.5 py-1 bg-white border border-sky-300 rounded-lg text-xs font-mono tabular-nums font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Quantities: Delivered vs Collected Empties with Quick Steppers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
            {/* Jars Dropped (Full) */}
            <div className="p-3 bg-white rounded-xl border border-sky-100 shadow-2xs">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-sky-900">
                  {entryMode === 'BULK' ? 'Jars Dropped (Each)' : t.worker.jarsDroppedFull}
                </label>
                {jarsDelivered === 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                    {t.worker.returnOnlyBadge}
                  </span>
                )}
              </div>

              {/* Stepper Input */}
              <div className="flex items-center gap-2 mt-1.5">
                <button
                  type="button"
                  onClick={() => handleJarsDeliveredChange(jarsDelivered - 1)}
                  className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  type="number"
                  min="0"
                  max="500"
                  id="jars-delivered-input"
                  value={jarsDelivered}
                  onChange={(e) => handleJarsDeliveredChange(parseInt(e.target.value) || 0)}
                  className="w-full px-2 py-1.5 bg-slate-50 border border-sky-200 rounded-lg text-slate-900 font-extrabold text-lg font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-sky-500 text-center"
                />
                <button
                  type="button"
                  onClick={() => handleJarsDeliveredChange(jarsDelivered + 1)}
                  className="w-9 h-9 rounded-lg bg-sky-100 hover:bg-sky-200 active:bg-sky-300 text-sky-800 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Preset Buttons for Dropped */}
              <div className="flex items-center gap-1 mt-2">
                {[0, 1, 2, 3, 5].map(q => (
                  <button
                    key={`drop-${q}`}
                    type="button"
                    onClick={() => handleJarsDeliveredChange(q)}
                    className={`flex-1 py-1 text-[11px] font-bold font-mono tabular-nums rounded transition-colors cursor-pointer ${
                      jarsDelivered === q 
                        ? 'bg-sky-600 text-white' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
              <span className="text-[10px] text-slate-400 mt-1.5 block font-mono tabular-nums">
                {entryMode === 'BULK'
                  ? `Total out: ${bulkSummary.totalJarsOut} jars across ${bulkSummary.count} customers`
                  : jarsDelivered > 0
                  ? `Deducts ${jarsDelivered} full from warehouse`
                  : 'No full jars given'}
              </span>
            </div>

            {/* Empties Returned */}
            <div className="p-3 bg-white rounded-xl border border-emerald-100 shadow-2xs">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-emerald-900">
                  {entryMode === 'BULK' ? 'Empties Returned (Each)' : t.worker.emptyJarsCollected}
                </label>
                {entryMode === 'SINGLE' && currentHolding > 0 && (
                  <button
                    type="button"
                    onClick={() => handleEmptyJarsCollectedChange(currentHolding)}
                    className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded cursor-pointer border border-emerald-200/60"
                  >
                    All ({currentHolding})
                  </button>
                )}
              </div>

              {/* Stepper Input */}
              <div className="flex items-center gap-2 mt-1.5">
                <button
                  type="button"
                  onClick={() => handleEmptyJarsCollectedChange(emptyJarsCollected - 1)}
                  className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  type="number"
                  min="0"
                  max="500"
                  id="empty-jars-collected-input"
                  value={emptyJarsCollected}
                  onChange={(e) => handleEmptyJarsCollectedChange(parseInt(e.target.value) || 0)}
                  className="w-full px-2 py-1.5 bg-slate-50 border border-emerald-200 rounded-lg text-slate-900 font-extrabold text-lg font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500 text-center"
                />
                <button
                  type="button"
                  onClick={() => handleEmptyJarsCollectedChange(emptyJarsCollected + 1)}
                  className="w-9 h-9 rounded-lg bg-emerald-100 hover:bg-emerald-200 active:bg-emerald-300 text-emerald-800 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Preset Buttons for Returned */}
              <div className="flex items-center gap-1 mt-2">
                {[0, 1, 2, 3, 5].map(q => (
                  <button
                    key={`ret-${q}`}
                    type="button"
                    onClick={() => handleEmptyJarsCollectedChange(q)}
                    className={`flex-1 py-1 text-[11px] font-bold font-mono tabular-nums rounded transition-colors cursor-pointer ${
                      emptyJarsCollected === q 
                        ? 'bg-emerald-600 text-white' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
              <span className="text-[10px] text-slate-400 mt-1.5 block font-mono tabular-nums">
                {entryMode === 'BULK'
                  ? `Total in: ${bulkSummary.totalEmptiesIn} empties from ${bulkSummary.count} customers`
                  : emptyJarsCollected > 0
                  ? `Restores ${emptyJarsCollected} empty to warehouse`
                  : 'No empty returned'}
              </span>
            </div>
          </div>

          {/* Live Impact Preview Banner (Single vs Bulk) */}
          {entryMode === 'SINGLE' ? (
            <div className="p-2.5 bg-sky-50/60 rounded-xl border border-sky-100 text-xs flex items-center justify-between font-mono tabular-nums">
              <div className="flex items-center gap-1.5 text-slate-700">
                <span className="font-sans font-medium">Customer Jar Float:</span>
                <span className="font-bold text-slate-900">{currentHolding}</span>
                <ArrowRight className="w-3.5 h-3.5 text-sky-600" />
                <span className={`font-extrabold ${calculatedNewHolding < currentHolding ? 'text-emerald-700' : calculatedNewHolding > currentHolding ? 'text-amber-700' : 'text-slate-900'}`}>
                  {calculatedNewHolding} jars
                </span>
              </div>
              <span className="text-[11px] font-semibold text-sky-800">
                {calculatedNewHolding < currentHolding 
                  ? `(-${currentHolding - calculatedNewHolding} returned)` 
                  : calculatedNewHolding > currentHolding 
                  ? `(+${calculatedNewHolding - currentHolding} new held)` 
                  : ''}
              </span>
            </div>
          ) : (
            <div className="p-3 bg-sky-50/70 rounded-xl border border-sky-200/80 text-xs flex flex-wrap items-center justify-between gap-2 font-mono tabular-nums">
              <div className="flex items-center gap-2 text-slate-800">
                <span className="font-bold text-sky-900">{bulkSummary.count} customers</span>
                <span className="text-slate-300">·</span>
                <span>+{bulkSummary.totalJarsOut} jars out</span>
                <span className="text-slate-300">·</span>
                <span className="text-emerald-700 font-semibold">-{bulkSummary.totalEmptiesIn} empties in</span>
              </div>
              <div className="font-bold text-slate-900">
                Batch Total: ₹{bulkSummary.totalBillAmount.toLocaleString('en-IN')}
              </div>
            </div>
          )}

          {/* Payment Settlement Method */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
              {t.worker.paymentMode} {entryMode === 'BULK' && '(Applied to Batch)'}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['CREDIT', 'UPI', 'CASH'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => handlePaymentModeChange(mode)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    paymentMode === mode
                      ? mode === 'CREDIT'
                        ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                        : 'bg-sky-600 text-white border-sky-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {mode === 'CREDIT' ? t.worker.credit : mode === 'UPI' ? t.worker.upi : t.worker.cash}
                </button>
              ))}
            </div>

            {/* Live UPI QR Code for Driver & Customer Doorstep Scan */}
            {paymentMode === 'UPI' && (
              <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200/90 text-xs">
                {currentBiz.upiId?.trim() ? (
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    {qrDataUrl && (
                      <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-2xs shrink-0 text-center">
                        <img src={qrDataUrl} alt="UPI QR Code" className="w-20 h-20 object-contain mx-auto" />
                        <span className="block text-[8px] font-bold text-slate-500 mt-0.5 uppercase tracking-wider font-mono tabular-nums">
                          Scan & Pay ₹{activeUpiAmount}
                        </span>
                      </div>
                    )}
                    <div className="space-y-1 min-w-0 flex-1 text-center sm:text-left">
                      <div className="flex items-center justify-center sm:justify-start gap-1 font-bold text-slate-900">
                        <QrCode className="w-3.5 h-3.5 text-sky-600" />
                        <span>Instant UPI Payment</span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Scan with any UPI app.
                      </p>
                      <div className="font-mono text-[11px] font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 max-w-fit mx-auto sm:mx-0">
                        {currentBiz.upiId.trim()}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-slate-500 flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-slate-400" />
                    <span>UPI ID not set in business settings. You can enter UPI ID in Settings to enable QR codes.</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Amount Collected Input (Single Mode vs Bulk Summary) */}
          {entryMode === 'SINGLE' ? (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  {t.worker.totalAmountCollected}
                </label>
                <span className="text-xs text-slate-400 font-mono tabular-nums">
                  {jarsDelivered > 0 ? `Rate: ₹${unitPrice} × ${jarsDelivered} = ₹${jarsDelivered * unitPrice}` : 'Jar Return (No refill charge)'}
                </span>
              </div>
              <div className="relative">
                <IndianRupee className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  min="0"
                  id="delivery-amount-collected-input"
                  value={amountCollected}
                  onChange={(e) => setAmountCollected(Number(e.target.value) || 0)}
                  disabled={paymentMode === 'CREDIT'}
                  className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-base font-bold font-mono tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                    paymentMode === 'CREDIT' ? 'opacity-60 bg-slate-100 cursor-not-allowed' : ''
                  }`}
                />
              </div>
              {paymentMode === 'CREDIT' && jarsDelivered > 0 && (
                <p className="text-xs text-amber-600 font-medium mt-1 font-mono tabular-nums">
                  Will add ₹{jarsDelivered * unitPrice} to customer's outstanding dues (New Due: ₹{calculatedNewDue}).
                </p>
              )}
              {jarsDelivered === 0 && amountCollected > 0 && paymentMode !== 'CREDIT' && (
                <p className="text-xs text-emerald-700 font-medium mt-1 font-mono tabular-nums">
                  Collected ₹{amountCollected} towards customer's outstanding dues during jar return.
                </p>
              )}
            </div>
          ) : (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1">
              <div className="flex items-center justify-between font-semibold text-slate-800">
                <span>
                  {paymentMode === 'CREDIT'
                    ? 'Total Credit Added Across Selected Customers:'
                    : `Total ${paymentMode} Collected Across Selected Customers:`}
                </span>
                <span className={`text-sm font-extrabold font-mono tabular-nums ${paymentMode === 'CREDIT' ? 'text-amber-700' : 'text-emerald-700'}`}>
                  ₹{bulkSummary.totalBillAmount.toLocaleString('en-IN')}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                {paymentMode === 'CREDIT'
                  ? `Each selected customer will have ${jarsDelivered} jar(s) billed to their due ledger at their configured unit rate.`
                  : `Each selected customer's delivery will be marked PAID via ${paymentMode} at their configured unit rate.`}
              </p>
            </div>
          )}

          </div>

          {/* Sticky Pinned Action Buttons */}
          <div className="px-4 py-3 sm:px-5 sm:py-3.5 bg-white border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={onClose}
            >
              {t.common.cancel}
            </Button>
            <Button
              type="submit"
              id="submit-delivery-button"
              variant={isReturnOnly ? 'emerald' : 'primary'}
              size="md"
              glow
              isLoading={isSubmitting}
              leftIcon={<Check className="w-4 h-4 stroke-[2.5]" />}
            >
              {entryMode === 'BULK'
                ? `Record Bulk Delivery (${selectedCustomerIds.length})`
                : isReturnOnly
                ? t.worker.saveJarReturn
                : t.worker.saveDeliveryStock}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};


