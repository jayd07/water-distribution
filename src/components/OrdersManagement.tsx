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
  X, 
  Truck, 
  ShieldCheck, 
  Check,
  Banknote,
  Smartphone,
  Landmark,
  IndianRupee
} from 'lucide-react';
import { OrderBooking, Customer, UserSessionProfile } from '../types';
import { CardSpotlight } from './ui/CardSpotlight';
import { AnimatedTabs, TabItem } from './ui/AnimatedTabs';
import { ModalWrapper } from './ui/ModalWrapper';
import { useLanguage } from '../context/LanguageContext';

export interface OrdersManagementProps {
  orders: OrderBooking[];
  customers: Customer[];
  onOpenNewOrder: () => void;
  onEditOrder?: (order: OrderBooking) => void;
  onOpenInvoice?: (order: OrderBooking) => void;
  onDeleteOrder?: (orderId: string) => Promise<void>;
  onUpdateStatus: (orderId: string, status: OrderBooking['status']) => Promise<void>;
  onCollectPayment?: (
    order: OrderBooking,
    payload: {
      amountPaidNow: number;
      paymentMode: 'CASH' | 'UPI' | 'BANK_TRANSFER';
      markDelivered: boolean;
    }
  ) => Promise<void>;
  userRole?: 'OWNER' | 'WORKER';
  userSession?: UserSessionProfile | null;
  searchQuery?: string;
  onSearchChange?: (val: string) => void;
}

type OrderStatusFilter = 'ALL' | 'CONFIRMED' | 'PENDING' | 'DELIVERED' | 'CANCELLED';

export const OrdersManagement: React.FC<OrdersManagementProps> = ({
  orders,
  customers: _customers,
  onOpenNewOrder,
  onEditOrder,
  onOpenInvoice,
  onDeleteOrder,
  onUpdateStatus,
  onCollectPayment,
  userRole = 'OWNER',
  userSession,
  searchQuery = '',
  onSearchChange
}) => {
  const { t, isGujarati } = useLanguage();
  const isWorker = (userSession?.role ?? userRole) === 'WORKER';
  const [localSearch, setLocalSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatusFilter>('ALL');
  const [itemFilter, setItemFilter] = useState<string>('ALL');
  const [paymentOrder, setPaymentOrder] = useState<OrderBooking | null>(null);
  const [collectAmount, setCollectAmount] = useState<number>(0);
  const [collectMode, setCollectMode] = useState<'CASH' | 'UPI' | 'BANK_TRANSFER'>('CASH');
  const [alsoMarkDelivered, setAlsoMarkDelivered] = useState<boolean>(true);
  const [isCollecting, setIsCollecting] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  const handleStatusChange = async (orderId: string, nextStatus: OrderBooking['status']) => {
    setUpdatingStatusId(orderId);
    try {
      await onUpdateStatus(orderId, nextStatus);
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const getOrderPaidAmount = (order: OrderBooking) => {
    if (order.amountPaid !== undefined) return Math.max(0, Number(order.amountPaid) || 0);
    return order.paymentStatus === 'PAID' ? order.totalAmount : 0;
  };

  const openTakePaymentModal = (order: OrderBooking) => {
    const paid = getOrderPaidAmount(order);
    const remaining = Math.max(0, Math.round((order.totalAmount - paid + Number.EPSILON) * 100) / 100);
    setPaymentOrder(order);
    setCollectAmount(remaining);
    setCollectMode(order.paymentMode || 'CASH');
    setAlsoMarkDelivered(order.status !== 'DELIVERED');
  };

  const handleConfirmCollectPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentOrder || !onCollectPayment) return;
    setIsCollecting(true);
    try {
      await onCollectPayment(paymentOrder, {
        amountPaidNow: Math.max(0, Number(collectAmount) || 0),
        paymentMode: collectMode,
        markDelivered: alsoMarkDelivered,
      });
      setPaymentOrder(null);
    } finally {
      setIsCollecting(false);
    }
  };

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
    if (isWorker) return;
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

  const statusCounts = {
    ALL: orders.length,
    CONFIRMED: orders.filter(o => o.status === 'CONFIRMED').length,
    PENDING: orders.filter(o => o.status === 'PENDING').length,
    DELIVERED: orders.filter(o => o.status === 'DELIVERED').length,
    CANCELLED: orders.filter(o => o.status === 'CANCELLED').length,
  };

  const getOrderStatusMeta = (status: OrderBooking['status']) => {
    switch (status) {
      case 'CONFIRMED':
        return {
          label: isGujarati ? 'કન્ફર્મ' : 'Confirmed',
          badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
          icon: <ShieldCheck className="w-3.5 h-3.5 text-blue-700 shrink-0" />,
          cardClass: 'border-blue-200/80',
          spotlight: 'rgba(59, 130, 246, 0.1)',
        };
      case 'DELIVERED':
        return {
          label: isGujarati ? 'ડિલિવર' : 'Delivered',
          badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />,
          cardClass: 'border-emerald-200/80',
          spotlight: 'rgba(16, 185, 129, 0.1)',
        };
      case 'CANCELLED':
        return {
          label: isGujarati ? 'રદ' : 'Cancelled',
          badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
          icon: <X className="w-3.5 h-3.5 text-rose-700 shrink-0" />,
          cardClass: 'border-rose-200/80 opacity-80',
          spotlight: 'rgba(244, 63, 94, 0.08)',
        };
      case 'PENDING':
      default:
        return {
          label: isGujarati ? 'પેન્ડિંગ' : 'Pending',
          badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
          icon: <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0" />,
          cardClass: 'border-amber-200/80',
          spotlight: 'rgba(245, 158, 11, 0.1)',
        };
    }
  };

  const statusTabs: TabItem<OrderStatusFilter>[] = [
    { id: 'ALL', label: isGujarati ? 'બધા ઓર્ડર્સ' : 'All Orders', badge: statusCounts.ALL },
    {
      id: 'PENDING',
      label: isGujarati ? 'પેન્ડિંગ' : 'Pending',
      icon: <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />,
      badge: statusCounts.PENDING,
      badgeColor: 'bg-amber-100 text-amber-800',
    },
    {
      id: 'CONFIRMED',
      label: isGujarati ? 'કન્ફર્મ' : 'Confirmed',
      icon: <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />,
      badge: statusCounts.CONFIRMED,
      badgeColor: 'bg-blue-100 text-blue-800',
    },
    {
      id: 'DELIVERED',
      label: isGujarati ? 'ડિલિવર' : 'Delivered',
      icon: <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />,
      badge: statusCounts.DELIVERED,
      badgeColor: 'bg-emerald-100 text-emerald-800',
    },
    {
      id: 'CANCELLED',
      label: isGujarati ? 'રદ' : 'Cancelled',
      icon: <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />,
      badge: statusCounts.CANCELLED,
      badgeColor: 'bg-rose-100 text-rose-800',
    },
  ];

  return (
    <div className="space-y-5">
      
      {/* Top Banner & Quick Metrics with CardSpotlight */}
      <div className={`grid grid-cols-2 ${!isWorker ? 'sm:grid-cols-4' : ''} gap-3`}>
        <CardSpotlight spotlightColor="rgba(6, 182, 212, 0.12)" className="p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">{isGujarati ? 'સક્રિય બુકિંગ' : 'Active Bookings'}</span>
            <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1 font-mono tabular-nums">{totalActiveBookings}</p>
          <span className="text-[11px] text-cyan-600 font-medium mt-0.5">{isGujarati ? 'શેડ્યૂલ થયેલ ઓર્ડર્સ' : 'Functions scheduled'}</span>
        </CardSpotlight>

        <CardSpotlight spotlightColor="rgba(16, 185, 129, 0.12)" className="p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">{isGujarati ? 'પૂર્ણ થયેલ ઓર્ડર્સ' : 'Completed Orders'}</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1 font-mono tabular-nums">{totalCompletedBookings}</p>
          <span className="text-[11px] text-emerald-600 font-medium mt-0.5">{isGujarati ? 'ડિલિવર અને બિલ થયેલ' : 'Delivered & billed'}</span>
        </CardSpotlight>

        {!isWorker && (
          <>
            <CardSpotlight spotlightColor="rgba(245, 158, 11, 0.12)" className="p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold">{isGujarati ? 'જમા સિક્યોરિટી ડિપોઝિટ' : 'Deposits In Custody'}</span>
                <ShieldCheck className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-2xl font-bold text-amber-700 mt-1 font-mono tabular-nums">₹{totalDepositHeld.toLocaleString('en-IN')}</p>
              <span className="text-[11px] text-slate-400 font-medium mt-0.5">{isGujarati ? 'પરત કરવાપાત્ર ડિપોઝિટ' : 'Refundable security'}</span>
            </CardSpotlight>

            <CardSpotlight spotlightColor="rgba(99, 102, 241, 0.12)" className="p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold">{isGujarati ? 'કુલ ઓર્ડર આવક' : 'Total Order Revenue'}</span>
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-1 font-mono tabular-nums">₹{totalRevenue.toLocaleString('en-IN')}</p>
              <span className="text-[11px] text-indigo-600 font-medium mt-0.5">{isGujarati ? 'ભાડા અને ફંક્શન સપ્લાય' : 'Rentals & function supply'}</span>
            </CardSpotlight>
          </>
        )}
      </div>

      {/* Main Action Bar & Search Filters */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-cyan-600" />
              <span>{isGujarati ? 'બલ્ક અને ફંક્શન પાણીના ઓર્ડર્સ' : 'Bulk & Function Water Orders'}</span>
            </h2>
            <p className="text-xs text-slate-500">
              {isGujarati
                ? 'પ્રસંગો અને ફંક્શન માટે બલ્ક પાણી અને કુલર ઓર્ડર નોંધો, ડિલિવરી કરો અને પેમેન્ટ લો'
                : 'Create bulk water & cooler orders for functions, mark delivered, and collect payment on site'}
            </p>
          </div>

          <button
            onClick={onOpenNewOrder}
            id="book-new-order-btn"
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isGujarati ? 'નવો બલ્ક / ફંક્શન ઓર્ડર' : 'New Bulk / Function Order'}</span>
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
              placeholder={isGujarati ? 'ગ્રાહકનું નામ, મોબાઈલ, સરનામું અથવા વસ્તુથી શોધો...' : 'Search by customer name, mobile, address, or item...'}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            {effectiveSearch && (
              <button
                onClick={handleClear}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Animated Status Filter */}
          <AnimatedTabs
            tabs={statusTabs}
            activeTab={statusFilter}
            onChange={(st) => setStatusFilter(st)}
            layoutId="orders-status-filter"
            size="sm"
            className="overflow-x-auto max-w-full"
            tabClassName="whitespace-nowrap shrink-0"
          />

          {/* Item Type Filter */}
          {itemTypes.length > 0 && (
            <select
              value={itemFilter}
              onChange={e => setItemFilter(e.target.value)}
              id="orders-item-filter"
              className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
            >
              <option value="ALL">{isGujarati ? 'બધી વસ્તુઓ / સાધનો' : 'All Equipment Types'}</option>
              {itemTypes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Orders List / Cards with CardSpotlight */}
      <div className="space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
            <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">{isGujarati ? 'કોઈ ઓર્ડર મળ્યા નથી' : 'No function orders found'}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {effectiveSearch
                ? (isGujarati ? 'શોધ સાફ કરીને ફરી પ્રયાસ કરો' : 'Try clearing your search query')
                : (isGujarati ? 'નવો ઓર્ડર બનાવવા "નવો બલ્ક / ફંક્શન ઓર્ડર" પર ક્લિક કરો' : 'Click "New Bulk / Function Order" to create one')}
            </p>
          </div>
        ) : (
          filteredOrders.map(order => {
            const statusMeta = getOrderStatusMeta(order.status);
            const paidSoFar = getOrderPaidAmount(order);
            const balanceRemaining = Math.max(0, Math.round((order.totalAmount - paidSoFar + Number.EPSILON) * 100) / 100);

            return (
              <CardSpotlight
                key={order.id}
                id={`order-card-${order.id}`}
                spotlightColor={statusMeta.spotlight}
                className={`p-3.5 sm:p-4 transition-all ${statusMeta.cardClass}`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  
                  {/* Left Column: Customer & Item Information */}
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2.5 sm:justify-start sm:items-center sm:flex-wrap">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 font-mono shrink-0">
                          {order.id.toUpperCase()}
                        </span>
                        <h3 className="text-sm sm:text-[15px] font-bold text-slate-900 leading-snug break-words">
                          {order.customerName}
                        </h3>
                      </div>

                      {/* Primary Order Status Badge (Color-coded & mobile-legible) */}
                      <span
                        data-order-status={order.status}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 sm:py-0.5 rounded-lg border text-[11px] sm:text-xs font-bold uppercase tracking-wide whitespace-nowrap shadow-2xs shrink-0 ${statusMeta.badgeClass}`}
                      >
                        {statusMeta.icon}
                        <span>{statusMeta.label}</span>
                      </span>

                      {/* Payment Status Badge */}
                      <span className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-semibold whitespace-nowrap shrink-0 ${
                        order.paymentStatus === 'PAID'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : order.paymentStatus === 'PARTIAL'
                          ? 'bg-orange-50 text-orange-800 border-orange-200'
                          : 'bg-slate-100 text-slate-700 border-slate-300'
                      }`}>
                        {order.paymentStatus === 'PAID'
                          ? `${isGujarati ? 'ચૂકવેલ' : 'Paid'}${
                              order.paymentMode
                                ? ` (${
                                    isGujarati
                                      ? order.paymentMode === 'CASH'
                                        ? 'રોકડ'
                                        : order.paymentMode === 'BANK_TRANSFER'
                                        ? 'બેંક'
                                        : order.paymentMode
                                      : order.paymentMode
                                  })`
                                : ''
                            }`
                          : order.paymentStatus === 'PARTIAL'
                          ? `${isGujarati ? 'અંશતઃ' : 'Partial'}: ₹${paidSoFar} / ₹${order.totalAmount}`
                          : `${isGujarati ? 'પેમેન્ટ બાકી' : 'Payment: Pending'} (₹${order.totalAmount})`}
                      </span>
                    </div>

                    {/* Mobile-only Payment Status Pill for clean separation */}
                    <div className="flex sm:hidden items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-semibold whitespace-nowrap ${
                        order.paymentStatus === 'PAID'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : order.paymentStatus === 'PARTIAL'
                          ? 'bg-orange-50 text-orange-800 border-orange-200'
                          : 'bg-slate-100 text-slate-700 border-slate-300'
                      }`}>
                        {order.paymentStatus === 'PAID'
                          ? `${isGujarati ? 'ચૂકવેલ' : 'Paid'}${
                              order.paymentMode
                                ? ` (${
                                    isGujarati
                                      ? order.paymentMode === 'CASH'
                                        ? 'રોકડ'
                                        : order.paymentMode === 'BANK_TRANSFER'
                                        ? 'બેંક'
                                        : order.paymentMode
                                      : order.paymentMode
                                  })`
                                : ''
                            }`
                          : order.paymentStatus === 'PARTIAL'
                          ? `${isGujarati ? 'ચૂકવેલ' : 'Paid'} ₹${paidSoFar} • ${isGujarati ? 'બાકી' : 'Due'} ₹${balanceRemaining}`
                          : `${isGujarati ? 'પેમેન્ટ બાકી' : 'Payment Pending'}: ₹${order.totalAmount}`}
                      </span>
                    </div>

                    {/* Booking Specifics */}
                    <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-slate-600">
                      <span className="font-semibold text-cyan-900 bg-cyan-50 px-2 py-0.5 rounded-md border border-cyan-100 font-mono tabular-nums">
                        {order.quantity} × {order.itemType}
                      </span>
                      <span className="flex items-center gap-1 text-slate-700">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <a href={`tel:${order.customerMobile}`} className="hover:underline font-mono">
                          {order.customerMobile}
                        </a>
                      </span>
                      {order.deliveryDate && (
                        <span className="flex items-center gap-1 text-slate-700">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{isGujarati ? 'ડિલિવરી તારીખ:' : 'Event Date:'} <strong>{order.deliveryDate}</strong></span>
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
                        {isGujarati ? 'નોંધ:' : 'Note:'} {order.notes}
                      </p>
                    )}
                  </div>

                  {/* Center Column: Financial Breakdown */}
                  <div className="flex items-center gap-4 py-2 lg:py-0 border-y lg:border-y-0 lg:border-x border-slate-100 lg:px-4 shrink-0 text-xs">
                    <div>
                      <span className="text-[11px] text-slate-400 block font-medium">{isGujarati ? 'ભાવ' : 'Rate'}</span>
                      <span className="font-semibold text-slate-800 font-mono tabular-nums">₹{order.rentOrPricePerUnit}{isGujarati ? '/નંગ' : '/unit'}</span>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-400 block font-medium">{isGujarati ? 'ડિપોઝિટ' : 'Deposit'}</span>
                      <span className="font-semibold text-amber-700 font-mono tabular-nums">₹{order.depositAmount}</span>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-400 block font-medium">
                        {balanceRemaining > 0
                          ? (isGujarati ? 'બાકી રકમ' : 'Balance Due')
                          : (isGujarati ? 'કુલ ચૂકવેલ' : 'Total Paid')}
                      </span>
                      <span className={`text-sm font-bold font-mono tabular-nums ${balanceRemaining > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                        ₹{balanceRemaining > 0 ? balanceRemaining : order.totalAmount}
                      </span>
                    </div>
                  </div>

                  {/* Right Column: Order Actions */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0 justify-end">
                    
                    {/* Take Payment quick action */}
                    {onCollectPayment && order.paymentStatus !== 'PAID' && order.status !== 'CANCELLED' && (
                      <button
                        onClick={() => openTakePaymentModal(order)}
                        id={`take-payment-btn-${order.id}`}
                        className="flex items-center gap-1 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
                        title={isGujarati ? 'આ બલ્ક ઓર્ડરનું પેમેન્ટ લો' : 'Collect payment for this bulk order'}
                      >
                        <IndianRupee className="w-3.5 h-3.5" />
                        <span>{isGujarati ? 'પેમેન્ટ લો' : 'Take Payment'}</span>
                      </button>
                    )}

                    {/* Order Status Selector (Available to both Workers & Owners) */}
                    <select
                      id={`order-status-select-${order.id}`}
                      aria-label={`Change status for order ${order.id}`}
                      value={order.status}
                      disabled={updatingStatusId === order.id}
                      onChange={(e) => handleStatusChange(order.id, e.target.value as OrderBooking['status'])}
                      className={`h-8 px-2.5 rounded-lg border text-xs font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-colors disabled:opacity-60 ${statusMeta.badgeClass}`}
                    >
                      <option value="PENDING">{isGujarati ? 'સ્થિતિ: પેન્ડિંગ' : 'Status: Pending'}</option>
                      <option value="CONFIRMED">{isGujarati ? 'સ્થિતિ: કન્ફર્મ' : 'Status: Confirmed'}</option>
                      <option value="DELIVERED">{isGujarati ? 'સ્થિતિ: ડિલિવર' : 'Status: Delivered'}</option>
                      <option value="CANCELLED">{isGujarati ? 'સ્થિતિ: રદ' : 'Status: Cancelled'}</option>
                    </select>

                    {/* Mark Delivered/Completed quick action */}
                    {order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (
                      <button
                        onClick={() => handleStatusChange(order.id, 'DELIVERED')}
                        disabled={updatingStatusId === order.id}
                        id={`mark-delivered-btn-${order.id}`}
                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-60 text-emerald-700 border border-emerald-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                        title={isGujarati ? 'ઓર્ડર ડિલિવર અને પૂર્ણ થયેલ નોંધો' : 'Mark order as delivered & completed'}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{isGujarati ? 'ડિલિવર કરો' : 'Mark Delivered'}</span>
                      </button>
                    )}

                    {/* Send Bill to Customer (Disabled for WORKER) */}
                    <button
                      type="button"
                      onClick={() => {
                        if (isWorker) return;
                        handleSendBillDirect(order);
                      }}
                      disabled={isWorker}
                      aria-disabled={isWorker}
                      id={`send-bill-btn-${order.id}`}
                      className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg shadow-2xs transition-colors ${
                        isWorker
                          ? 'bg-emerald-600/40 text-white/80 cursor-not-allowed opacity-60'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
                      }`}
                      title={
                        isWorker
                          ? (isGujarati ? 'માત્ર માલિક / મેનેજર બિલ મોકલી શકે છે' : 'Owner / Manager permission required to send bill')
                          : (isGujarati ? 'ગ્રાહકને WhatsApp બિલ મોકલો' : 'Send WhatsApp bill directly to customer')
                      }
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>{isGujarati ? 'બિલ મોકલો' : 'Send Bill'}</span>
                    </button>

                    {/* View / Print Full Tax Invoice (Owner / Manager Only) */}
                    {!isWorker && onOpenInvoice && (
                      <button
                        onClick={() => onOpenInvoice(order)}
                        id={`invoice-btn-${order.id}`}
                        className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
                        title={isGujarati ? 'સત્તાવાર રસીદ / બિલ જુઓ' : 'View & Print Official Receipt'}
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>{isGujarati ? 'રસીદ / બિલ' : 'Invoice'}</span>
                      </button>
                    )}

                    {/* Modify Order (Owner / Manager Only) */}
                    {!isWorker && onEditOrder && (
                      <button
                        onClick={() => onEditOrder(order)}
                        id={`edit-order-btn-${order.id}`}
                        className="p-1.5 text-slate-600 hover:text-cyan-700 hover:bg-cyan-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                        title={isGujarati ? 'ઓર્ડરમાં ફેરફાર કરો' : 'Modify Order'}
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    )}

                    {/* Delete/Cancel order (Disabled for WORKER) */}
                    {(onDeleteOrder || isWorker) && (
                      <button
                        type="button"
                        onClick={() => {
                          if (isWorker || !onDeleteOrder) return;
                          const confirmMsg = isGujarati
                            ? `શું તમે ખરેખર આ બુકિંગ #${order.id} દૂર કરવા માંગો છો?`
                            : `Are you sure you want to remove booking #${order.id}?`;
                          if (confirm(confirmMsg)) {
                            onDeleteOrder(order.id);
                          }
                        }}
                        disabled={isWorker}
                        aria-disabled={isWorker}
                        id={`delete-order-btn-${order.id}`}
                        className={`p-1.5 border border-slate-200 rounded-lg transition-colors ${
                          isWorker
                            ? 'text-slate-300 bg-slate-50 cursor-not-allowed opacity-60'
                            : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer'
                        }`}
                        title={
                          isWorker
                            ? (isGujarati ? 'માત્ર માલિક / મેનેજર ઓર્ડર કાઢી શકે છે' : 'Owner / Manager permission required to delete order')
                            : (isGujarati ? 'ઓર્ડર કાઢી નાખો' : 'Delete Order')
                        }
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}

                  </div>

                </div>
              </CardSpotlight>
            );
          })
        )}
      </div>

      {/* Collect Order Payment Modal */}
      <ModalWrapper
        isOpen={Boolean(paymentOrder)}
        onClose={() => setPaymentOrder(null)}
        maxWidth="sm"
        icon={
          <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
            <IndianRupee className="w-4 h-4" />
          </div>
        }
        title={isGujarati ? 'બલ્ક ઓર્ડર પેમેન્ટ મેળવો' : 'Take Bulk Order Payment'}
        subtitle={paymentOrder ? `${paymentOrder.customerName} • #${paymentOrder.id.toUpperCase()}` : ''}
      >
        {paymentOrder && (() => {
          const paidSoFar = getOrderPaidAmount(paymentOrder);
          const remaining = Math.max(0, Math.round((paymentOrder.totalAmount - paidSoFar + Number.EPSILON) * 100) / 100);
          return (
            <form onSubmit={handleConfirmCollectPayment} className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <div className="flex justify-between text-slate-600">
                  <span>{isGujarati ? 'કુલ ઓર્ડર રકમ' : 'Order Total'} ({paymentOrder.quantity}× {paymentOrder.itemType})</span>
                  <strong className="font-mono text-slate-900">₹{paymentOrder.totalAmount.toLocaleString('en-IN')}</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>{isGujarati ? 'અગાઉ ચૂકવેલ' : 'Already Paid'}</span>
                  <span className="font-mono text-emerald-700 font-semibold">₹{paidSoFar.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200 font-bold text-slate-900">
                  <span>{isGujarati ? 'બાકી રકમ' : 'Remaining Balance'}</span>
                  <span className="font-mono text-amber-700">₹{remaining.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {isGujarati ? 'અત્યારે મળેલ રકમ (₹)' : 'Amount Collected Now (₹)'}
                </label>
                <input
                  type="number"
                  min="1"
                  max={remaining > 0 ? remaining : paymentOrder.totalAmount}
                  required
                  value={collectAmount}
                  onChange={e => setCollectAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold font-mono text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  {t.worker.paymentMode}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setCollectMode('CASH')}
                    className={`py-2 px-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                      collectMode === 'CASH'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Banknote className="w-4 h-4 shrink-0" />
                    <span>{t.worker.cash}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCollectMode('UPI')}
                    className={`py-2 px-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                      collectMode === 'UPI'
                        ? 'bg-sky-600 text-white border-sky-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Smartphone className="w-4 h-4 shrink-0" />
                    <span>UPI</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCollectMode('BANK_TRANSFER')}
                    className={`py-2 px-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                      collectMode === 'BANK_TRANSFER'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Landmark className="w-4 h-4 shrink-0" />
                    <span>{isGujarati ? 'બેંક' : 'Bank'}</span>
                  </button>
                </div>
              </div>

              {paymentOrder.status !== 'DELIVERED' && (
                <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={alsoMarkDelivered}
                    onChange={e => setAlsoMarkDelivered(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                  />
                  <span className="font-semibold text-emerald-950">
                    {isGujarati ? 'ઓર્ડરને ડિલિવર થયેલ તરીકે પણ નોંધો' : 'Also mark order as Delivered'}
                  </span>
                </label>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPaymentOrder(null)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl cursor-pointer"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isCollecting || collectAmount <= 0}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{isCollecting ? (isGujarati ? 'સાચવી રહ્યું છે...' : 'Saving...') : (isGujarati ? 'પેમેન્ટ કન્ફર્મ કરો' : 'Confirm Payment')}</span>
                </button>
              </div>
            </form>
          );
        })()}
      </ModalWrapper>

    </div>
  );
};
