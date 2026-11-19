import React, { useState, useEffect, useMemo } from 'react';
import { X, Calendar, Phone, User, Package, ShieldCheck, MapPin, Truck, AlertCircle, Check, Banknote, Smartphone, Landmark } from 'lucide-react';
import { OrderBooking, Customer, InventoryItem } from '../types';
import { Button } from './ui/Button';
import { triggerHaptic } from '../utils/haptics';
import { useLanguage } from '../context/LanguageContext';

export interface OrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (orderData: Omit<OrderBooking, 'id' | 'bookingDate'>, orderId?: string) => Promise<void>;
  editingOrder?: OrderBooking | null;
  customers: Customer[];
  inventory?: InventoryItem[];
  preselectedCustomer?: Customer | null;
  defaultStaffName?: string;
}

const EMPTY_INVENTORY: InventoryItem[] = [];

const DEFAULT_EQUIPMENT_OPTIONS = [
  { name: '20L Normal Water Jar', defaultRate: 35, defaultDeposit: 0, category: 'Bulk Jars' },
  { name: '20L Chilled Mineral Water Jar', defaultRate: 45, defaultDeposit: 0, category: 'Bulk Jars' },
  { name: '10L Easy-Pour Bottle', defaultRate: 25, defaultDeposit: 0, category: 'Bulk Jars' },
  { name: 'Electric Water Cooler Dispenser', defaultRate: 850, defaultDeposit: 1000, category: 'Cooler' },
  { name: 'Tabletop Mini Jar Cooler', defaultRate: 400, defaultDeposit: 500, category: 'Cooler' },
  { name: 'Heavy Duty Steel Cooler Stand', defaultRate: 250, defaultDeposit: 300, category: 'Accessories' },
];

export const OrderModal: React.FC<OrderModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingOrder,
  customers,
  inventory = EMPTY_INVENTORY,
  preselectedCustomer,
  defaultStaffName = '',
}) => {
  const { t, isGujarati } = useLanguage();
  const equipmentOptions = useMemo(() => {
    const merged = DEFAULT_EQUIPMENT_OPTIONS.map((opt) => ({ ...opt }));
    inventory.forEach((inv) => {
      const label = inv.displayName || inv.itemType;
      const existing = merged.find(
        (m) => m.name.toLowerCase() === label.toLowerCase() || m.name.toLowerCase() === inv.itemType.toLowerCase()
      );
      if (existing) {
        if (inv.unitPrice > 0) existing.defaultRate = inv.unitPrice;
      } else {
        merged.unshift({
          name: label,
          defaultRate: inv.unitPrice || 35,
          defaultDeposit: 0,
          category: 'Inventory SKU',
        });
      }
    });
    return merged;
  }, [inventory]);

  const [customerName, setCustomerName] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerId, setCustomerId] = useState<string | undefined>(undefined);
  const [itemType, setItemType] = useState(DEFAULT_EQUIPMENT_OPTIONS[0].name);
  const [quantity, setQuantity] = useState<number>(10);
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [rentOrPricePerUnit, setRentOrPricePerUnit] = useState<number>(35);
  const [paymentStatus, setPaymentStatus] = useState<'PAID' | 'PARTIAL' | 'PENDING'>('PAID');
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI' | 'BANK_TRANSFER'>('CASH');
  const [partialPaidInput, setPartialPaidInput] = useState<number>(0);
  const [status, setStatus] = useState<'PENDING' | 'CONFIRMED' | 'DELIVERED' | 'CANCELLED'>('CONFIRMED');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [assignedDriver, setAssignedDriver] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const getTodayStr = () => new Date().toISOString().split('T')[0];

  // Auto-fill or reset when modal opens or editingOrder changes
  useEffect(() => {
    if (!isOpen) return;
    if (editingOrder) {
      setCustomerName(editingOrder.customerName);
      setCustomerMobile(editingOrder.customerMobile);
      setCustomerAddress(editingOrder.customerAddress || '');
      setCustomerId(editingOrder.customerId);
      setItemType(editingOrder.itemType);
      setQuantity(editingOrder.quantity);
      setDepositAmount(editingOrder.depositAmount);
      setRentOrPricePerUnit(editingOrder.rentOrPricePerUnit);
      setPaymentStatus(editingOrder.paymentStatus);
      setPaymentMode(editingOrder.paymentMode || 'CASH');
      const existingPaid =
        editingOrder.amountPaid !== undefined
          ? editingOrder.amountPaid
          : editingOrder.paymentStatus === 'PAID'
          ? editingOrder.totalAmount
          : 0;
      setPartialPaidInput(existingPaid);
      setStatus(editingOrder.status);
      setDeliveryDate(editingOrder.deliveryDate || '');
      setAssignedDriver(editingOrder.assignedDriver || defaultStaffName || '');
      setNotes(editingOrder.notes || '');
    } else {
      if (preselectedCustomer) {
        setCustomerId(preselectedCustomer.id);
        setCustomerName(preselectedCustomer.name);
        setCustomerMobile(preselectedCustomer.phone || '');
        setCustomerAddress(preselectedCustomer.address || '');
      } else {
        setCustomerId(undefined);
        setCustomerName('');
        setCustomerMobile('');
        setCustomerAddress('');
      }
      const defaultBulk = equipmentOptions[0];
      setItemType(defaultBulk.name);
      setQuantity(10);
      setDepositAmount(defaultBulk.defaultDeposit);
      setRentOrPricePerUnit(defaultBulk.defaultRate);
      setPaymentStatus('PAID');
      setPaymentMode('CASH');
      setPartialPaidInput(10 * defaultBulk.defaultRate + defaultBulk.defaultDeposit);
      setStatus('CONFIRMED');
      setDeliveryDate(getTodayStr());
      setAssignedDriver(defaultStaffName || '');
      setNotes('');
    }
    setErrorMsg('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingOrder?.id, preselectedCustomer?.id]);

  // Handle changing item type to update default rates if creating new
  const handleItemChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    setItemType(selected);
    if (!editingOrder) {
      const match = equipmentOptions.find(opt => opt.name === selected);
      if (match) {
        setRentOrPricePerUnit(match.defaultRate);
        setDepositAmount(match.defaultDeposit * quantity);
      }
    }
  };

  // Handle typing or picking an existing customer from datalist suggestions
  const handleCustomerNameChange = (val: string) => {
    setCustomerName(val);
    const normalizedVal = val.trim().toLowerCase();
    if (!normalizedVal) {
      if (customerId) {
        const prevCustomer = customers.find((c) => c.id === customerId);
        setCustomerId(undefined);
        if (!editingOrder && prevCustomer) {
          if (customerMobile === (prevCustomer.phone || '')) setCustomerMobile('');
          if (customerAddress === (prevCustomer.address || '')) setCustomerAddress('');
        }
      }
      return;
    }

    const matchedCustomer = customers.find(
      (c) => c.name.trim().toLowerCase() === normalizedVal
    );

    if (matchedCustomer) {
      setCustomerId(matchedCustomer.id);
      setCustomerName(matchedCustomer.name);
      setCustomerMobile(matchedCustomer.phone || '');
      setCustomerAddress(matchedCustomer.address || '');
    } else if (customerId) {
      const prevCustomer = customers.find((c) => c.id === customerId);
      setCustomerId(undefined);
      if (!editingOrder && prevCustomer) {
        if (customerMobile === (prevCustomer.phone || '')) setCustomerMobile('');
        if (customerAddress === (prevCustomer.address || '')) setCustomerAddress('');
      }
    }
  };

  // Auto-adjust deposit when quantity changes for fresh order
  const handleQuantityChange = (newQty: number) => {
    const q = Math.max(1, newQty);
    setQuantity(q);
    if (!editingOrder) {
      const match = equipmentOptions.find(opt => opt.name === itemType);
      if (match) {
        setDepositAmount(match.defaultDeposit * q);
      }
    }
  };

  // Derived Total Amount & Paid Amount
  const totalAmount = Math.max(0, Math.round(((quantity * rentOrPricePerUnit) + depositAmount + Number.EPSILON) * 100) / 100);
  const effectiveAmountPaid =
    paymentStatus === 'PAID'
      ? totalAmount
      : paymentStatus === 'PENDING'
      ? 0
      : Math.min(totalAmount, Math.max(0, Number(partialPaidInput) || 0));
  const balanceDue = Math.max(0, Math.round((totalAmount - effectiveAmountPaid + Number.EPSILON) * 100) / 100);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setErrorMsg(isGujarati ? 'કૃપા કરીને ગ્રાહક અથવા આયોજકનું નામ લખો' : 'Please enter customer or event organizer name');
      return;
    }
    if (!customerMobile.trim()) {
      setErrorMsg(isGujarati ? 'કૃપા કરીને બિલિંગ માટે ગ્રાહકનો મોબાઇલ નંબર દાખલ કરો' : 'Please provide a customer mobile number for SMS/WhatsApp billing');
      return;
    }
    if (quantity < 1) {
      setErrorMsg(isGujarati ? 'જથ્થો ઓછામાં ઓછો ૧ હોવો જરૂરી છે' : 'Quantity must be at least 1 item');
      return;
    }

    const normalizedPaymentStatus: OrderBooking['paymentStatus'] =
      effectiveAmountPaid >= totalAmount
        ? 'PAID'
        : effectiveAmountPaid > 0
        ? 'PARTIAL'
        : 'PENDING';

    try {
      setIsSubmitting(true);
      setErrorMsg('');
      await onSave({
        customerName: customerName.trim(),
        customerMobile: customerMobile.trim(),
        customerAddress: customerAddress.trim(),
        customerId,
        itemType,
        quantity,
        depositAmount,
        rentOrPricePerUnit,
        totalAmount,
        amountPaid: effectiveAmountPaid,
        paymentMode: effectiveAmountPaid > 0 ? paymentMode : undefined,
        paymentStatus: normalizedPaymentStatus,
        status,
        deliveryDate,
        assignedDriver: assignedDriver.trim(),
        createdBy: editingOrder?.createdBy || defaultStaffName || undefined,
        collectedBy: effectiveAmountPaid > 0 ? (defaultStaffName || assignedDriver.trim() || undefined) : editingOrder?.collectedBy,
        notes: notes.trim()
      }, editingOrder?.id);
      triggerHaptic('order');
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || (isGujarati ? 'બુકિંગ ઓર્ડર સાચવવામાં નિષ્ફળ' : 'Failed to save booking order'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[88dvh] sm:max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-5 sm:py-3.5 bg-slate-900 text-white border-b border-slate-800 shrink-0">
          <div className="min-w-0 pr-2">
            <h3 className="font-semibold text-sm sm:text-base leading-tight truncate">
              {editingOrder
                ? (isGujarati ? 'બલ્ક / ફંક્શન ઓર્ડરમાં ફેરફાર કરો' : 'Modify Bulk / Function Order')
                : (isGujarati ? 'નવો બલ્ક / ફંક્શન ઓર્ડર' : 'New Bulk / Function Order')}
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-400 truncate">
              {editingOrder
                ? (isGujarati ? `ઓર્ડર #${editingOrder.id} અપડેટ કરી રહ્યા છીએ` : `Updating Order #${editingOrder.id}`)
                : (isGujarati ? 'બલ્ક પાણી જાર અથવા કુલર બુક કરો, ડિલિવરી નોંધો અને પેમેન્ટ લો' : 'Book bulk water jars or event coolers, mark delivered & collect payment')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            id="close-order-modal-btn"
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Form Body & Pinned Sticky Footer */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden text-xs">
          <div className="p-3.5 sm:p-5 overflow-y-auto overscroll-contain modal-scroll-body space-y-3 sm:space-y-4 flex-1 min-h-0">
          
          {errorMsg && (
            <div className="p-2.5 sm:p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Customer Details Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                {isGujarati ? 'ગ્રાહક / આયોજકનું નામ *' : 'Customer / Organizer Name *'}
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  id="order-customer-name-input"
                  autoComplete="name"
                  list="customer-suggestions"
                  placeholder={isGujarati ? 'દા.ત., જૂના ગ્રાહક શોધો અથવા નવું નામ લખો' : 'e.g., Search existing or type new name'}
                  value={customerName}
                  onChange={e => handleCustomerNameChange(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <datalist id="customer-suggestions">
                  {customers.map((c) => (
                    <option key={c.id} value={c.name}>
                      {[c.phone, c.address].filter(Boolean).join(' • ')}
                    </option>
                  ))}
                </datalist>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                {isGujarati ? 'ગ્રાહકનો મોબાઇલ નંબર *' : 'Customer Mobile Number *'}
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="tel"
                  required
                  id="order-customer-mobile-input"
                  placeholder={isGujarati ? 'દા.ત., +91 98200 77112' : 'e.g., +91 98200 77112'}
                  value={customerMobile}
                  onChange={e => setCustomerMobile(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>
          </div>

          {/* Delivery Address / Venue */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              {isGujarati ? 'પ્રસંગનું સ્થળ / ડિલિવરી સરનામું' : 'Function Venue / Delivery Address'}
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                id="order-venue-address-input"
                placeholder={isGujarati ? 'દા.ત., કોમ્યુનિટી હોલ, સોસાયટી ગેટ અથવા ઘરનું સરનામું' : 'e.g., Community Hall, Society Gate, or Home Address'}
                value={customerAddress}
                onChange={e => setCustomerAddress(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          {/* Item / Equipment Selection & Quantity */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-slate-700 font-semibold mb-1">
                {isGujarati ? 'પાણી જાર / કુલર વસ્તુ *' : 'Water Jar / Cooler Item *'}
              </label>
              <div className="relative">
                <Package className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <select
                  value={itemType}
                  onChange={handleItemChange}
                  id="order-item-type-select"
                  className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  {equipmentOptions.map(opt => (
                    <option key={opt.name} value={opt.name}>
                      {opt.name} ({opt.category})
                    </option>
                  ))}
                  {!equipmentOptions.some(o => o.name === itemType) && (
                    <option value={itemType}>{itemType}</option>
                  )}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                {isGujarati ? 'જથ્થો (નંગ) *' : 'Quantity *'}
              </label>
              <input
                type="number"
                min="1"
                required
                id="order-quantity-input"
                value={quantity}
                onChange={e => handleQuantityChange(parseInt(e.target.value) || 1)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 text-center font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          {/* Financial Breakdown: Rate, Deposit, Total */}
          <div className="p-3.5 bg-cyan-50/60 border border-cyan-200/80 rounded-xl space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-cyan-900 font-semibold mb-1">
                  {isGujarati ? 'નંગ દીઠ ભાવ / ભાડું (₹)' : 'Rate / Price per Unit (₹)'}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 font-bold">₹</span>
                  <input
                    type="number"
                    min="0"
                    id="order-rate-input"
                    value={rentOrPricePerUnit}
                    onChange={e => setRentOrPricePerUnit(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-cyan-300 rounded-lg pl-8 pr-3 py-1.5 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-cyan-900 font-semibold mb-1">
                  {isGujarati ? 'સિક્યોરિટી ડિપોઝિટ જો હોય તો (₹)' : 'Security Deposit If Any (₹)'}
                </label>
                <div className="relative">
                  <ShieldCheck className="w-4 h-4 text-cyan-600 absolute left-3 top-2.5" />
                  <input
                    type="number"
                    min="0"
                    id="order-deposit-input"
                    value={depositAmount}
                    onChange={e => setDepositAmount(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-cyan-300 rounded-lg pl-9 pr-3 py-1.5 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>
            </div>

            {/* Total Calculation Display */}
            <div className="flex items-center justify-between pt-2 border-t border-cyan-200 text-cyan-950">
              <div>
                <span className="text-xs font-semibold block">{isGujarati ? 'કુલ બિલ રકમ:' : 'Total Bill Amount:'}</span>
                <span className="text-[11px] text-cyan-700">
                  ({quantity} × ₹{rentOrPricePerUnit}) + ₹{depositAmount} {isGujarati ? 'ડિપોઝિટ' : 'deposit'}
                </span>
              </div>
              <div className="text-xl font-bold text-cyan-700 font-mono tabular-nums">
                ₹{totalAmount.toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          {/* Payment Collection Section */}
          <div className="p-3.5 bg-emerald-50/50 border border-emerald-200/80 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-950">{isGujarati ? 'પેમેન્ટ વસૂલાત' : 'Payment Collection'}</span>
              {balanceDue > 0 ? (
                <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                  {isGujarati ? 'બાકી રકમ' : 'Balance Due'}: ₹{balanceDue.toLocaleString('en-IN')}
                </span>
              ) : (
                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                  {isGujarati ? 'પૂરેપૂરું ચૂકવેલ' : 'Settled in Full'}
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {(['PAID', 'PARTIAL', 'PENDING'] as const).map((ps) => (
                <button
                  key={ps}
                  type="button"
                  onClick={() => {
                    setPaymentStatus(ps);
                    if (ps === 'PAID') setPartialPaidInput(totalAmount);
                    else if (ps === 'PENDING') setPartialPaidInput(0);
                    else if (partialPaidInput <= 0 || partialPaidInput >= totalAmount) {
                      setPartialPaidInput(Math.round(totalAmount / 2));
                    }
                  }}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                    paymentStatus === ps
                      ? ps === 'PAID'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                        : ps === 'PARTIAL'
                        ? 'bg-amber-500 text-white border-amber-500 shadow-2xs'
                        : 'bg-slate-800 text-white border-slate-800 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {ps === 'PAID'
                    ? (isGujarati ? 'પૂરું ચૂકવેલ' : 'Paid Full')
                    : ps === 'PARTIAL'
                    ? (isGujarati ? 'અંશતઃ / એડવાન્સ' : 'Partial / Advance')
                    : (isGujarati ? 'બાકી રાખો' : 'Pay Later')}
                </button>
              ))}
            </div>

            {paymentStatus !== 'PENDING' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <div>
                  <label className="block text-emerald-950 font-semibold mb-1">
                    {isGujarati ? 'મળેલ રકમ (₹)' : 'Amount Collected (₹)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={totalAmount}
                    readOnly={paymentStatus === 'PAID'}
                    id="order-amount-paid-input"
                    value={effectiveAmountPaid}
                    onChange={e => setPartialPaidInput(parseFloat(e.target.value) || 0)}
                    className={`w-full border rounded-lg px-3 py-1.5 font-bold font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                      paymentStatus === 'PAID'
                        ? 'bg-emerald-100/60 border-emerald-300 text-emerald-900'
                        : 'bg-white border-emerald-300 text-slate-900'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-emerald-950 font-semibold mb-1">
                    {t.worker.paymentMode}
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      type="button"
                      onClick={() => setPaymentMode('CASH')}
                      className={`py-1.5 px-1.5 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                        paymentMode === 'CASH'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <Banknote className="w-3.5 h-3.5 shrink-0" />
                      <span>{isGujarati ? 'રોકડ' : 'Cash'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMode('UPI')}
                      className={`py-1.5 px-1.5 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                        paymentMode === 'UPI'
                          ? 'bg-sky-600 text-white border-sky-600'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <Smartphone className="w-3.5 h-3.5 shrink-0" />
                      <span>UPI</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMode('BANK_TRANSFER')}
                      className={`py-1.5 px-1.5 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                        paymentMode === 'BANK_TRANSFER'
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <Landmark className="w-3.5 h-3.5 shrink-0" />
                      <span>{isGujarati ? 'બેંક' : 'Bank'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Operational Status & Delivery Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                {isGujarati ? 'ઓર્ડર ડિલિવરી સ્થિતિ' : 'Order Delivery Status'}
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as any)}
                id="order-status-select"
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="DELIVERED">{isGujarati ? 'અત્યારે ડિલિવર (પૂર્ણ)' : 'Delivered Now (Completed)'}</option>
                <option value="CONFIRMED">{isGujarati ? 'કન્ફર્મ / શેડ્યૂલ' : 'Confirmed / Scheduled'}</option>
                <option value="PENDING">{isGujarati ? 'પેન્ડિંગ / મંજૂરી બાકી' : 'Pending Approval'}</option>
                <option value="CANCELLED">{isGujarati ? 'રદ થયેલ' : 'Cancelled'}</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                {isGujarati ? 'પ્રસંગ / ડિલિવરી તારીખ' : 'Function / Delivery Date'}
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={e => setDeliveryDate(e.target.value)}
                  id="order-delivery-date-input"
                  className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-2 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>
          </div>

          {/* Assigned Van & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                {isGujarati ? 'સંભાળનાર સ્ટાફ / વાહન' : 'Handled By / Staff or Vehicle'}
              </label>
              <div className="relative">
                <Truck className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  id="order-assigned-driver-input"
                  placeholder={isGujarati ? 'સ્ટાફ અથવા ગાડી નંબર લખો' : 'Enter staff or vehicle'}
                  value={assignedDriver}
                  onChange={e => setAssignedDriver(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                {isGujarati ? 'પ્રસંગની નોંધ અને સૂચનાઓ' : 'Function Notes & Instructions'}
              </label>
              <input
                type="text"
                id="order-notes-input"
                placeholder={isGujarati ? 'દા.ત., લગ્ન પ્રસંગ, ઘરનો કાર્યક્રમ, વધારાના ગ્લાસ' : 'e.g., Wedding banquet, house function, extra glasses'}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          </div>

          {/* Sticky Pinned Action buttons */}
          <div className="px-4 py-3 sm:px-5 sm:py-3.5 bg-white border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
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
              variant="primary"
              size="md"
              glow
              id="save-order-submit-btn"
              isLoading={isSubmitting}
              leftIcon={<Check className="w-4 h-4 stroke-[2.5]" />}
            >
              {editingOrder
                ? (isGujarati ? 'ઓર્ડર અપડેટ કરો' : 'Update Order')
                : status === 'DELIVERED'
                ? (isGujarati ? 'સાચવો અને ડિલિવર નોંધો' : 'Save & Mark Delivered')
                : (isGujarati ? 'ઓર્ડર કન્ફર્મ અને બુક કરો' : 'Confirm & Book Order')}
            </Button>
          </div>

        </form>
      </div>
    </div>
  );
};
