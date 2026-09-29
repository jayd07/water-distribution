import React, { useState, useEffect } from 'react';
import { X, Calendar, Phone, User, Package, DollarSign, ShieldCheck, MapPin, Truck, AlertCircle } from 'lucide-react';
import { OrderBooking, Customer } from '../types';

export interface OrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (orderData: Omit<OrderBooking, 'id' | 'bookingDate'>, orderId?: string) => Promise<void>;
  editingOrder?: OrderBooking | null;
  customers: Customer[];
}

const EQUIPMENT_OPTIONS = [
  { name: 'Electric Water Cooler Dispenser', defaultRate: 850, defaultDeposit: 1000, category: 'Cooler' },
  { name: 'Tabletop Mini Jar Cooler', defaultRate: 400, defaultDeposit: 500, category: 'Cooler' },
  { name: 'Heavy Duty Steel Cooler Stand', defaultRate: 250, defaultDeposit: 300, category: 'Accessories' },
  { name: '20L Normal Water Jar', defaultRate: 35, defaultDeposit: 150, category: 'Bulk Jars' },
  { name: '20L Chilled Mineral Water Jar', defaultRate: 45, defaultDeposit: 150, category: 'Bulk Jars' },
  { name: '10L Easy-Pour Bottle', defaultRate: 25, defaultDeposit: 100, category: 'Bulk Jars' }
];

export const OrderModal: React.FC<OrderModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingOrder,
  customers
}) => {
  const [customerName, setCustomerName] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerId, setCustomerId] = useState<string | undefined>(undefined);
  const [itemType, setItemType] = useState(EQUIPMENT_OPTIONS[0].name);
  const [quantity, setQuantity] = useState<number>(1);
  const [depositAmount, setDepositAmount] = useState<number>(1000);
  const [rentOrPricePerUnit, setRentOrPricePerUnit] = useState<number>(850);
  const [paymentStatus, setPaymentStatus] = useState<'PAID' | 'PARTIAL' | 'PENDING'>('PAID');
  const [status, setStatus] = useState<'PENDING' | 'CONFIRMED' | 'DELIVERED' | 'CANCELLED'>('CONFIRMED');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [assignedDriver, setAssignedDriver] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Auto-fill or reset when modal opens or editingOrder changes
  useEffect(() => {
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
      setStatus(editingOrder.status);
      setDeliveryDate(editingOrder.deliveryDate || '');
      setAssignedDriver(editingOrder.assignedDriver || '');
      setNotes(editingOrder.notes || '');
    } else {
      setCustomerName('');
      setCustomerMobile('');
      setCustomerAddress('');
      setCustomerId(undefined);
      const defaultItem = EQUIPMENT_OPTIONS[0];
      setItemType(defaultItem.name);
      setQuantity(1);
      setDepositAmount(defaultItem.defaultDeposit);
      setRentOrPricePerUnit(defaultItem.defaultRate);
      setPaymentStatus('PAID');
      setStatus('CONFIRMED');
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setDeliveryDate(tomorrow.toISOString().split('T')[0]);
      setAssignedDriver('');
      setNotes('');
    }
    setErrorMsg('');
  }, [editingOrder, isOpen]);

  // Handle changing item type to update default rates if creating new
  const handleItemChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    setItemType(selected);
    if (!editingOrder) {
      const match = EQUIPMENT_OPTIONS.find(opt => opt.name === selected);
      if (match) {
        setRentOrPricePerUnit(match.defaultRate);
        setDepositAmount(match.defaultDeposit * quantity);
      }
    }
  };

  // Handle selecting an existing customer
  const handleCustomerSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    if (!selectedId) {
      setCustomerId(undefined);
      return;
    }
    const found = customers.find(c => c.id === selectedId);
    if (found) {
      setCustomerId(found.id);
      setCustomerName(found.name);
      setCustomerMobile(found.phone);
      setCustomerAddress(found.address);
    }
  };

  // Auto-adjust deposit when quantity changes for fresh order
  const handleQuantityChange = (newQty: number) => {
    const q = Math.max(1, newQty);
    setQuantity(q);
    if (!editingOrder) {
      const match = EQUIPMENT_OPTIONS.find(opt => opt.name === itemType);
      if (match) {
        setDepositAmount(match.defaultDeposit * q);
      }
    }
  };

  // Derived Total Amount
  const totalAmount = (quantity * rentOrPricePerUnit) + depositAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setErrorMsg('Please enter customer or event organizer name');
      return;
    }
    if (!customerMobile.trim()) {
      setErrorMsg('Please provide a customer mobile number for SMS/WhatsApp billing');
      return;
    }
    if (quantity < 1) {
      setErrorMsg('Quantity must be at least 1 item');
      return;
    }

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
        paymentStatus,
        status,
        deliveryDate,
        assignedDriver,
        notes: notes.trim()
      }, editingOrder?.id);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save booking order');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[95vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white border-b border-slate-800 shrink-0">
          <div>
            <h3 className="font-semibold text-base leading-tight">
              {editingOrder ? 'Modify Cooler / Jar Order' : 'Book Cooler & Jar Order (Function / Event)'}
            </h3>
            <p className="text-xs text-slate-400">
              {editingOrder ? `Updating Order #${editingOrder.id}` : 'Reserve coolers, dispensers, or event bulk water jars'}
            </p>
          </div>
          <button
            onClick={onClose}
            id="close-order-modal-btn"
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
          
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Quick select existing customer if any */}
          {customers && customers.length > 0 && (
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
              <label className="block text-slate-600 font-medium mb-1">
                Select from Existing Registered Customers (Optional):
              </label>
              <select
                onChange={handleCustomerSelect}
                value={customerId || ''}
                id="order-customer-select"
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="">-- Or enter new customer / event organizer details below --</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone}) - {c.address}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Customer Details Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Customer / Organizer Name *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  id="order-customer-name-input"
                  placeholder="e.g., Client / Event Organizer Name"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Customer Mobile Number *
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="tel"
                  required
                  id="order-customer-mobile-input"
                  placeholder="e.g., +91 98200 77112"
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
              Event Venue / Delivery Address
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                id="order-venue-address-input"
                placeholder="e.g., Building / Venue Address"
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
                Cooler / Jar Item To Book *
              </label>
              <div className="relative">
                <Package className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <select
                  value={itemType}
                  onChange={handleItemChange}
                  id="order-item-type-select"
                  className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  {EQUIPMENT_OPTIONS.map(opt => (
                    <option key={opt.name} value={opt.name}>
                      {opt.name} ({opt.category})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Items To Book (Qty) *
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
                  Rate / Price per Unit (₹)
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
                  Security Deposit If Any (₹)
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
                <span className="text-xs font-semibold block">Total Bill Amount:</span>
                <span className="text-[11px] text-cyan-700">
                  ({quantity} × ₹{rentOrPricePerUnit}) + ₹{depositAmount} deposit
                </span>
              </div>
              <div className="text-xl font-bold text-cyan-700">
                ₹{totalAmount.toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          {/* Operational Status & Assignment */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Order Status
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as any)}
                id="order-status-select"
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="PENDING">Pending Approval</option>
                <option value="CONFIRMED">Confirmed / Scheduled</option>
                <option value="DELIVERED">Delivered / Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Payment Status
              </label>
              <select
                value={paymentStatus}
                onChange={e => setPaymentStatus(e.target.value as any)}
                id="order-payment-status-select"
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="PAID">Paid in Full</option>
                <option value="PARTIAL">Partially Paid</option>
                <option value="PENDING">Pending / On Delivery</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Event / Delivery Date
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-2.5 top-2" />
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={e => setDeliveryDate(e.target.value)}
                  id="order-delivery-date-input"
                  className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-2 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>
          </div>

          {/* Assigned Van & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Assigned Delivery Driver / Van
              </label>
              <div className="relative">
                <Truck className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  id="order-assigned-driver-input"
                  placeholder="e.g., Assigned Driver / Staff Name"
                  value={assignedDriver}
                  onChange={e => setAssignedDriver(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Event Notes & Special Instructions
              </label>
              <input
                type="text"
                id="order-notes-input"
                placeholder="e.g., Wedding banquet, extra glasses required"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              id="save-order-submit-btn"
              className="px-5 py-2 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              {isSubmitting ? 'Saving...' : (editingOrder ? 'Update Order' : 'Confirm & Book Order')}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
