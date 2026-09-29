import React, { useState, useEffect } from 'react';
import { Customer, InventoryItem } from '../types';
import { processDeliveryAtomic, DeliveryRecordInput } from '../services/deliveryService';
import { getActiveSession, getActiveBusiness } from '../services/businessService';
import { generateUpiUri, generateUpiQrDataUrl } from '../utils/upiUtils';
import { X, Truck, Check, AlertCircle, IndianRupee, RotateCcw, Plus, Minus, ArrowRight, QrCode } from 'lucide-react';

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
}

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
  initialMode = 'STANDARD'
}) => {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [workerName, setWorkerName] = useState<string>('');
  const [selectedItemType, setSelectedItemType] = useState<string>('');
  // By default for normal transactions: add 1 jar, return 1 jar
  const [jarsDelivered, setJarsDelivered] = useState<number>(1);
  const [emptyJarsCollected, setEmptyJarsCollected] = useState<number>(1);
  const [amountCollected, setAmountCollected] = useState<number>(35);
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI' | 'CREDIT'>('UPI');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [showUpiQr, setShowUpiQr] = useState<boolean>(false);


  // Initialize selected customer, worker name, and item type
  useEffect(() => {
    if (!isOpen) return;

    if (defaultCustomerId && customers.some(c => c.id === defaultCustomerId)) {
      setSelectedCustomerId(defaultCustomerId);
    } else if (customers.length > 0 && (!selectedCustomerId || !customers.some(c => c.id === selectedCustomerId))) {
      setSelectedCustomerId(customers[0].id);
    }

    if (inventory.length > 0 && !selectedItemType) {
      setSelectedItemType(inventory[0].itemType);
    }

    const session = getActiveSession();
    const currentBiz = getActiveBusiness();
    const fallbackWorker = defaultWorkerName || session?.displayName || session?.workerRecord?.workerName || currentBiz?.ownerName || '';
    if (fallbackWorker) {
      setWorkerName(fallbackWorker);
    }

    // Set initial preset mode
    if (initialMode === 'RETURN_ONLY') {
      setJarsDelivered(0);
      setEmptyJarsCollected(1);
      setAmountCollected(0);
    } else if (initialMode === 'DROP_ONLY') {
      setJarsDelivered(1);
      setEmptyJarsCollected(0);
      const price = (inventory[0] && Number(inventory[0].unitPrice)) || 35;
      setAmountCollected(price);
    } else {
      // STANDARD: 1 delivered, 1 returned
      setJarsDelivered(1);
      setEmptyJarsCollected(1);
      const price = (inventory[0] && Number(inventory[0].unitPrice)) || 35;
      setAmountCollected(price);
    }
  }, [isOpen, defaultCustomerId, customers, inventory, initialMode, defaultWorkerName]);

  const currentCustomer = customers.find(c => c.id === selectedCustomerId);
  const currentItem = inventory.find(i => i.itemType === selectedItemType) || inventory[0];
  const unitPrice = currentItem ? (Number(currentItem.unitPrice) || 35) : 35;
  const currentBiz = getActiveBusiness();

  // Generate UPI QR Code whenever UPI is active and amount > 0
  useEffect(() => {
    if (isOpen && paymentMode === 'UPI' && currentBiz.upiId?.trim() && amountCollected > 0) {
      const upiUri = generateUpiUri({
        upiId: currentBiz.upiId.trim(),
        merchantName: currentBiz.name || 'Water Distribution',
        amount: Number(amountCollected),
        note: `Water Delivery - ${currentCustomer?.name || 'Customer'}`
      });
      generateUpiQrDataUrl(upiUri, { width: 220 }).then(setQrDataUrl);
    } else {
      setQrDataUrl('');
    }
  }, [isOpen, paymentMode, currentBiz, amountCollected, currentCustomer]);

  // Auto-calculate suggested amount when jarsDelivered changes
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
    } else if (jarsDelivered > 0 && amountCollected === 0) {
      setAmountCollected(jarsDelivered * unitPrice);
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
    const custHolding = currentCustomer?.jarsHolding || 0;
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

  // Real-time impact calculations
  const currentHolding = currentCustomer?.jarsHolding || 0;
  const calculatedNewHolding = Math.max(0, currentHolding + jarsDelivered - emptyJarsCollected);
  const currentDue = currentCustomer?.dueAmount || 0;
  const orderCost = jarsDelivered * unitPrice;
  const calculatedNewDue = Math.max(0, currentDue + orderCost - amountCollected);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !currentCustomer) {
      setErrorMessage('Please choose an active customer.');
      return;
    }

    if (jarsDelivered <= 0 && emptyJarsCollected <= 0) {
      setErrorMessage('Please record at least 1 jar dropped or 1 empty jar returned.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const activeSession = getActiveSession();
      const currentBiz = getActiveBusiness();
      const resolvedWorkerName = workerName.trim() || defaultWorkerName || activeSession?.displayName || activeSession?.workerRecord?.workerName || currentBiz?.ownerName || 'Staff Driver';

      const input: DeliveryRecordInput = {
        businessId,
        customerId: selectedCustomerId,
        customerName: currentCustomer.name,
        workerName: resolvedWorkerName,
        jarsDelivered: Number(jarsDelivered),
        emptyJarsCollected: Number(emptyJarsCollected),
        amountCollected: Number(amountCollected),
        paymentMode,
        itemType: selectedItemType || currentItem?.itemType || '20L Normal Water Jar'
      };

      await processDeliveryAtomic(input);

      // Clean succinct toast message
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
    <div id="new-delivery-modal" className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              isReturnOnly ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'
            }`}>
              {isReturnOnly ? <RotateCcw className="w-4 h-4" /> : <Truck className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {isReturnOnly ? 'Record Empty Jar Return' : 'Record Delivery & Refill'}
              </h3>
              <p className="text-xs text-slate-500">
                {isReturnOnly 
                  ? 'Collect empty bottles & balance customer ledger' 
                  : 'Log water jars delivered, empties returned, and payments'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 max-h-[82vh] overflow-y-auto">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

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
                <span className="text-[10px] font-normal text-slate-400">1 Drop • 1 Return</span>
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
                <span className="text-[10px] font-normal text-emerald-600">0 Drop • Empties</span>
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
                <span className="text-[10px] font-normal text-slate-400">Jars • 0 Return</span>
              </button>
            </div>
          </div>

          {/* Customer Selection */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Select Customer Account
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
                  + Add New Customer
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
                  {c.name} — {c.route || 'General'} ({c.jarsHolding || 0} jars holding, Due: ₹{c.dueAmount || 0})
                </option>
              ))}
            </select>
            {currentCustomer && (
              <div className="mt-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200/70 flex items-center justify-between text-xs text-slate-600">
                <span>Current Jars with Customer: <strong className="text-slate-900 font-bold">{currentCustomer.jarsHolding || 0} jars</strong></span>
                <span>Outstanding Dues: <strong className={currentCustomer.dueAmount > 0 ? 'text-amber-700 font-bold' : 'text-slate-900 font-bold'}>₹{currentCustomer.dueAmount || 0}</strong></span>
              </div>
            )}
          </div>

          {/* Product & Driver Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                Item / Product Type
              </label>
              <select
                value={selectedItemType}
                onChange={(e) => {
                  setSelectedItemType(e.target.value);
                  const selected = inventory.find(i => i.itemType === e.target.value);
                  const price = selected ? (Number(selected.unitPrice) || 35) : 35;
                  if (paymentMode !== 'CREDIT' && jarsDelivered > 0) {
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
                  Driver / Staff Name
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

          {/* Quantities: Delivered vs Collected Empties with Quick Steppers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
            {/* Jars Dropped (Full) */}
            <div className="p-3 bg-white rounded-xl border border-sky-100 shadow-2xs">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-sky-900">
                  Jars Dropped (Full)
                </label>
                {jarsDelivered === 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                    0 (Return Only)
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
                  className="w-full px-2 py-1.5 bg-slate-50 border border-sky-200 rounded-lg text-slate-900 font-extrabold text-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-center"
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
                    className={`flex-1 py-1 text-[11px] font-bold rounded transition-colors cursor-pointer ${
                      jarsDelivered === q 
                        ? 'bg-sky-600 text-white' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
              <span className="text-[10px] text-slate-400 mt-1.5 block">
                {jarsDelivered > 0 ? `Deducts ${jarsDelivered} full from warehouse` : 'No full jars given'}
              </span>
            </div>

            {/* Empties Returned */}
            <div className="p-3 bg-white rounded-xl border border-emerald-100 shadow-2xs">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-emerald-900">
                  Empties Returned
                </label>
                {currentHolding > 0 && (
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
                  className="w-full px-2 py-1.5 bg-slate-50 border border-emerald-200 rounded-lg text-slate-900 font-extrabold text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-center"
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
                    className={`flex-1 py-1 text-[11px] font-bold rounded transition-colors cursor-pointer ${
                      emptyJarsCollected === q 
                        ? 'bg-emerald-600 text-white' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
              <span className="text-[10px] text-slate-400 mt-1.5 block">
                {emptyJarsCollected > 0 ? `Restores ${emptyJarsCollected} empty to warehouse` : 'No empty returned'}
              </span>
            </div>
          </div>

          {/* Live Jar Holding Impact Preview Banner */}
          <div className="p-2.5 bg-sky-50/60 rounded-xl border border-sky-100 text-xs flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-700">
              <span className="font-medium">Customer Jar Float:</span>
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
                : 'Balanced (1:1 exchange)'}
            </span>
          </div>

          {/* Payment Settlement Method */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
              Payment Settlement Method
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['UPI', 'CASH', 'CREDIT'] as const).map((mode) => (
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
                  {mode === 'CREDIT' ? 'On Credit (Pay Later)' : mode}
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
                        <span className="block text-[8px] font-bold text-slate-500 mt-0.5 uppercase tracking-wider">Scan & Pay ₹{amountCollected}</span>
                      </div>
                    )}
                    <div className="space-y-1 min-w-0 flex-1 text-center sm:text-left">
                      <div className="flex items-center justify-center sm:justify-start gap-1 font-bold text-slate-900">
                        <QrCode className="w-3.5 h-3.5 text-sky-600" />
                        <span>Instant UPI Payment</span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Customer can scan via GPay, PhonePe, Paytm, BHIM.
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


          {/* Amount Collected Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Total Amount Collected (₹)
              </label>
              <span className="text-xs text-slate-400">
                {jarsDelivered > 0 ? `Unit Rate: ₹${unitPrice} × ${jarsDelivered} = ₹${jarsDelivered * unitPrice}` : 'Jar Return (No refill charge)'}
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
                className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                  paymentMode === 'CREDIT' ? 'opacity-60 bg-slate-100 cursor-not-allowed' : ''
                }`}
              />
            </div>
            {paymentMode === 'CREDIT' && jarsDelivered > 0 && (
              <p className="text-xs text-amber-600 font-medium mt-1">
                Will add ₹{jarsDelivered * unitPrice} to customer's outstanding dues.
              </p>
            )}
            {jarsDelivered === 0 && amountCollected > 0 && paymentMode !== 'CREDIT' && (
              <p className="text-xs text-emerald-700 font-medium mt-1">
                Collected ₹{amountCollected} towards customer's outstanding dues during jar return.
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              id="submit-delivery-button"
              className={`inline-flex items-center gap-1.5 px-5 py-2.5 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
                isReturnOnly 
                  ? 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800' 
                  : 'bg-sky-600 hover:bg-sky-700 active:bg-sky-800'
              } disabled:opacity-50`}
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  {isReturnOnly ? 'Save Jar Return' : 'Save Delivery & Stock'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

