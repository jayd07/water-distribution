import React, { useState } from 'react';
import { 
  Package, 
  Plus, 
  Search, 
  Calendar, 
  Phone, 
  MapPin, 
  Edit, 
  Share2, 
  Printer, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  X,
  Truck,
  ShieldCheck,
  Check
} from 'lucide-react';
import { OrderBooking, Customer } from '../types';

export interface OrdersManagementProps {
  orders: OrderBooking[];
  customers: Customer[];
  onOpenNewOrder: () => void;
  onEditOrder: (order: OrderBooking) => void;
  onOpenInvoice: (order: OrderBooking) => void;
  onDeleteOrder: (orderId: string) => Promise<void>;
  onUpdateStatus: (orderId: string, status: OrderBooking['status']) => Promise<void>;
  searchQuery?: string;
  onSearchChange?: (val: string) => void;
}

export const OrdersManagement: React.FC<OrdersManagementProps> = ({
  orders,
  customers,
  onOpenNewOrder,
  onEditOrder,
  onOpenInvoice,
  onDeleteOrder,
  onUpdateStatus,
  searchQuery = '',
  onSearchChange
}) => {
  const [localSearch, setLocalSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'CONFIRMED' | 'PENDING' | 'DELIVERED' | 'CANCELLED'>('ALL');
  const [itemFilter, setItemFilter] = useState<string>('ALL');

  const effectiveSearch = searchQuery !== undefined && searchQuery !== '' ? searchQuery : localSearch;

  const handleSearchInput = (val: string) => {
    setLocalSearch(val);
    onSearchChange?.(val);
  };

  const handleClear = () => {
    setLocalSearch('');
    onSearchChange?.('');
  };

  // Filter orders
  const filteredOrders = orders.filter(order => {
    const q = effectiveSearch.toLowerCase().trim();
    const matchesSearch = 
      !q ||
      order.customerName.toLowerCase().includes(q) ||
      order.customerMobile.toLowerCase().includes(q) ||
      (order.customerAddress || '').toLowerCase().includes(q) ||
      order.itemType.toLowerCase().includes(q) ||
      order.id.toLowerCase().includes(q);

    const matchesStatus = statusFilter === 'ALL' || order.status === statusFilter;
    const matchesItem = itemFilter === 'ALL' || order.itemType === itemFilter;

    return matchesSearch && matchesStatus && matchesItem;
  });

  // Unique item types for filter
  const itemTypes = Array.from(new Set(orders.map(o => o.itemType))).filter(Boolean);

  // Quick stats
  const totalActiveBookings = orders.filter(o => o.status === 'CONFIRMED' || o.status === 'PENDING').length;
  const totalCompletedBookings = orders.filter(o => o.status === 'DELIVERED').length;
  const totalDepositHeld = orders
    .filter(o => o.status !== 'CANCELLED')
    .reduce((sum, o) => sum + (o.depositAmount || 0), 0);
  const totalRevenue = orders
    .filter(o => o.status !== 'CANCELLED')
    .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

  const handleSendBillDirect = (order: OrderBooking) => {
    let cleanPhone = order.customerMobile.replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }

    const billText = `*Cooler & Jar Function Booking Bill*
----------------------------------------
*Order No:* ${order.id.toUpperCase()}
*Customer:* ${order.customerName}
*Phone:* ${order.customerMobile}
*Delivery Venue:* ${order.customerAddress || 'Direct Pickup'}
----------------------------------------
*Item Booked:* ${order.itemType}
*Quantity:* ${order.quantity} units
*Rental Rate:* ₹${order.rentOrPricePerUnit}/unit
*Security Deposit:* ₹${order.depositAmount}
*Total Amount:* ₹${order.totalAmount}
*Payment Status:* ${order.paymentStatus}
*Order Status:* ${order.status}
${order.deliveryDate ? `*Scheduled Date:* ${order.deliveryDate}\n` : ''}
${order.assignedDriver ? `*Assigned Van:* ${order.assignedDriver}\n` : ''}
----------------------------------------
Thank you for booking!`;

    const encodedText = encodeURIComponent(billText);
    const whatsappUrl = cleanPhone.length >= 10 
      ? `https://wa.me/${cleanPhone}?text=${encodedText}`
      : `https://wa.me/?text=${encodedText}`;

    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="space-y-5">
      
      {/* Top Banner & Quick Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Active Bookings</span>
            <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
          </div>
          <p className="text-xl font-bold text-slate-900 mt-1">{totalActiveBookings}</p>
          <span className="text-[11px] text-cyan-600 font-medium mt-0.5">Functions scheduled</span>
        </div>

        <div className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Completed Orders</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          </div>
          <p className="text-xl font-bold text-slate-900 mt-1">{totalCompletedBookings}</p>
          <span className="text-[11px] text-emerald-600 font-medium mt-0.5">Delivered & billed</span>
        </div>

        <div className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Deposits In Custody</span>
            <ShieldCheck className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-xl font-bold text-amber-700 mt-1">₹{totalDepositHeld.toLocaleString('en-IN')}</p>
          <span className="text-[11px] text-slate-400 font-medium mt-0.5">Refundable security</span>
        </div>

        <div className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Total Order Revenue</span>
            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
          </div>
          <p className="text-xl font-bold text-slate-900 mt-1">₹{totalRevenue.toLocaleString('en-IN')}</p>
          <span className="text-[11px] text-indigo-600 font-medium mt-0.5">Rentals & function supply</span>
        </div>
      </div>

      {/* Main Action Bar & Search Filters */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-cyan-600" />
              <span>Event Cooler & Jar Bookings</span>
            </h2>
            <p className="text-xs text-slate-500">
              Manage equipment rentals for marriages, banquets, parties, and bulk gatherings
            </p>
          </div>

          <button
            onClick={onOpenNewOrder}
            id="book-new-order-btn"
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Book New Cooler / Jar</span>
          </button>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5 pt-2 border-t border-slate-100">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              id="orders-search-input"
              value={effectiveSearch}
              onChange={e => handleSearchInput(e.target.value)}
              placeholder="Search by customer name, mobile, address, or item..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            {effectiveSearch && (
              <button
                onClick={handleClear}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {(['ALL', 'CONFIRMED', 'PENDING', 'DELIVERED', 'CANCELLED'] as const).map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  statusFilter === st
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {st === 'ALL' ? 'All Orders' : st}
              </button>
            ))}
          </div>

          {/* Item Type Filter */}
          {itemTypes.length > 0 && (
            <select
              value={itemFilter}
              onChange={e => setItemFilter(e.target.value)}
              id="orders-item-filter"
              className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="ALL">All Equipment Types</option>
              {itemTypes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Orders List / Cards (Responsive Desktop Table + Mobile Cards) */}
      <div className="space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200/80">
            <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No function orders found</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {effectiveSearch ? 'Try clearing your search query' : 'Click "Book New Cooler / Jar" to create one'}
            </p>
          </div>
        ) : (
          filteredOrders.map(order => {
            const isCompleted = order.status === 'DELIVERED';
            const isCancelled = order.status === 'CANCELLED';

            return (
              <div
                key={order.id}
                id={`order-card-${order.id}`}
                className={`p-4 rounded-2xl border transition-all bg-white shadow-xs ${
                  isCompleted 
                    ? 'border-emerald-200/80 hover:border-emerald-300' 
                    : isCancelled
                    ? 'border-slate-200 opacity-70'
                    : 'border-slate-200/80 hover:border-cyan-300'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  
                  {/* Left Column: Customer & Item Information */}
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700">
                        {order.id.toUpperCase()}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900">{order.customerName}</h3>
                      
                      {/* Status Badges */}
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        order.status === 'DELIVERED' 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : order.status === 'CONFIRMED'
                          ? 'bg-cyan-100 text-cyan-800'
                          : order.status === 'CANCELLED'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {order.status}
                      </span>

                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        order.paymentStatus === 'PAID'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {order.paymentStatus === 'PAID' ? 'Paid' : 'Payment: ' + order.paymentStatus}
                      </span>
                    </div>

                    {/* Booking Specifics */}
                    <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-slate-600">
                      <span className="font-semibold text-cyan-900 bg-cyan-50 px-2 py-0.5 rounded-md border border-cyan-100">
                        {order.quantity} × {order.itemType}
                      </span>
                      <span className="flex items-center gap-1 text-slate-700">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <a href={`tel:${order.customerMobile}`} className="hover:underline">
                          {order.customerMobile}
                        </a>
                      </span>
                      {order.deliveryDate && (
                        <span className="flex items-center gap-1 text-slate-700">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>Event Date: <strong>{order.deliveryDate}</strong></span>
                        </span>
                      )}
                      {order.assignedDriver && (
                        <span className="flex items-center gap-1 text-slate-500">
                          <Truck className="w-3.5 h-3.5 text-slate-400" />
                          <span>{order.assignedDriver}</span>
                        </span>
                      )}
                    </div>

                    {/* Address / Venue */}
                    {order.customerAddress && (
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{order.customerAddress}</span>
                      </p>
                    )}

                    {/* Order Notes */}
                    {order.notes && (
                      <p className="text-[11px] text-slate-500 italic bg-slate-50 px-2 py-1 rounded-md">
                        Note: {order.notes}
                      </p>
                    )}
                  </div>

                  {/* Center Column: Financial Breakdown */}
                  <div className="flex items-center gap-4 py-2 lg:py-0 border-y lg:border-y-0 lg:border-x border-slate-100 lg:px-4 shrink-0 text-xs">
                    <div>
                      <span className="text-[11px] text-slate-400 block font-medium">Rental / Rate</span>
                      <span className="font-semibold text-slate-800">₹{order.rentOrPricePerUnit}/unit</span>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-400 block font-medium">Deposit</span>
                      <span className="font-semibold text-amber-700">₹{order.depositAmount}</span>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-400 block font-medium">Total Bill</span>
                      <span className="text-sm font-bold text-cyan-700">₹{order.totalAmount}</span>
                    </div>
                  </div>

                  {/* Right Column: Order Actions */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0 justify-end">
                    
                    {/* Mark Delivered/Completed quick action */}
                    {order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (
                      <button
                        onClick={() => onUpdateStatus(order.id, 'DELIVERED')}
                        id={`mark-delivered-btn-${order.id}`}
                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                        title="Mark order as delivered & completed"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Complete</span>
                      </button>
                    )}

                    {/* Send Bill to Customer (Requested Feature) */}
                    <button
                      onClick={() => handleSendBillDirect(order)}
                      id={`send-bill-btn-${order.id}`}
                      className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                      title="Send WhatsApp bill directly to customer"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Send Bill</span>
                    </button>

                    {/* View / Print Full Tax Invoice */}
                    <button
                      onClick={() => onOpenInvoice(order)}
                      id={`invoice-btn-${order.id}`}
                      className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                      title="View & Print Official Receipt"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Invoice</span>
                    </button>

                    {/* Modify in middle (Requested Feature) */}
                    <button
                      onClick={() => onEditOrder(order)}
                      id={`edit-order-btn-${order.id}`}
                      className="p-1.5 text-slate-600 hover:text-cyan-700 hover:bg-cyan-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                      title="Modify Order In-Progress"
                    >
                      <Edit className="w-4 h-4" />
                    </button>

                    {/* Delete/Cancel order */}
                    <button
                      onClick={() => {
                        if (confirm(`Are you sure you want to remove booking #${order.id}?`)) {
                          onDeleteOrder(order.id);
                        }
                      }}
                      id={`delete-order-btn-${order.id}`}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                      title="Delete / Cancel Order"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                  </div>

                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
};
