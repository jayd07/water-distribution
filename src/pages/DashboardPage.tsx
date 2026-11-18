import React, { useState, useMemo } from 'react';
import { InventoryItem, Customer, DeliveryLog, TransactionRecord, ActiveTab, OrderBooking } from '../types';
import { KpiMetrics } from '../components/KpiMetrics';
import { InventoryGauge } from '../components/InventoryGauge';
import { DispatchStream } from '../components/DispatchStream';
import { CardSpotlight } from '../components/ui/CardSpotlight';
import { PullToRefresh } from '../components/ui/PullToRefresh';
import { useLanguage } from '../context/LanguageContext';
import {
  computeDayAccountingSummary,
  formatDateToYYYYMMDD,
  getYesterdayYYYYMMDD,
  formatReadableDate,
  isTimestampOnDate
} from '../utils/csvExport';
import { 
  Search, 
  X, 
  Users, 
  Boxes, 
  ArrowRight, 
  Package, 
  Plus, 
  Download, 
  Truck, 
  Activity, 
  IndianRupee,
  Calendar
} from 'lucide-react';

interface DashboardPageProps {
  inventory: InventoryItem[];
  customers: Customer[];
  todayDeliveries: DeliveryLog[];
  allDeliveries?: DeliveryLog[];
  transactions?: TransactionRecord[];
  orders?: OrderBooking[];
  onOpenRestock: (itemType?: string) => void;
  onOpenNewDelivery: () => void;
  onOpenNewOrder?: () => void;
  onOpenInvoice?: (delivery: DeliveryLog) => void;
  onOpenOrderInvoice?: (order: OrderBooking) => void;
  onOpenExportAccounting?: () => void;
  searchQuery?: string;
  onClearSearch?: () => void;
  onSearchChange?: (term: string) => void;
  onNavigateToTab?: (tab: ActiveTab) => void;
  onRefresh?: () => Promise<void> | void;
  userRole?: 'OWNER' | 'WORKER';
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  inventory,
  customers,
  todayDeliveries,
  allDeliveries,
  transactions = [],
  orders = [],
  onOpenRestock,
  onOpenNewDelivery,
  onOpenNewOrder,
  onOpenInvoice,
  onOpenOrderInvoice,
  onOpenExportAccounting,
  searchQuery = '',
  onClearSearch,
  onSearchChange,
  onNavigateToTab,
  onRefresh,
  userRole = 'OWNER'
}) => {
  const { isGujarati } = useLanguage();
  const q = searchQuery.toLowerCase().trim();

  const todayStr = formatDateToYYYYMMDD(new Date());
  const yesterdayStr = getYesterdayYYYYMMDD();

  const [selectedDate, setSelectedDate] = useState<string>(() => formatDateToYYYYMMDD(new Date()));

  const isToday = selectedDate === todayStr;
  const isYesterday = selectedDate === yesterdayStr;
  const readableSelectedDate = useMemo(() => formatReadableDate(selectedDate), [selectedDate]);

  const selectedDateLabel = isToday
    ? (isGujarati ? 'આજે' : 'Today')
    : isYesterday
    ? (isGujarati ? 'ગઈકાલે' : 'Yesterday')
    : readableSelectedDate;

  // Source of all available deliveries so user can switch between Today, Yesterday, and Custom Date
  const sourceDeliveries = allDeliveries || todayDeliveries;

  // Strictly filter deliveries and transactions to the selected calendar day (midnight-to-midnight local time)
  const dateFilteredDeliveries = useMemo(
    () => sourceDeliveries.filter((d) => isTimestampOnDate(d.timestamp, selectedDate)),
    [sourceDeliveries, selectedDate]
  );

  const dateFilteredTransactions = useMemo(
    () => transactions.filter((t) => isTimestampOnDate(t.timestamp, selectedDate)),
    [transactions, selectedDate]
  );

  // Unified daily accounting summary (Delivery collections + Due Settlements)
  const daySummary = useMemo(
    () => computeDayAccountingSummary(selectedDate, sourceDeliveries, transactions),
    [selectedDate, sourceDeliveries, transactions]
  );

  const totalDeliveriesCount = daySummary.totalDeliveriesCount;
  const totalJarsDelivered = daySummary.totalJarsDelivered;
  const totalEmptiesReturned = daySummary.totalEmptiesCollected;
  const cashRevenue = daySummary.totalCashCollected;
  const upiRevenue = daySummary.totalUpiCollected + daySummary.totalBankTransferCollected;
  const currentDayRevenue = daySummary.totalSettledAmount;

  const matchedCustomersCount = q
    ? customers.filter(
        (c) =>
          (c.name || '').toLowerCase().includes(q) ||
          (c.phone || '').toLowerCase().includes(q) ||
          (c.address || '').toLowerCase().includes(q) ||
          (c.route || '').toLowerCase().includes(q)
      ).length
    : 0;

  const matchedInventoryCount = q
    ? inventory.filter(
        (i) =>
          (i.displayName || '').toLowerCase().includes(q) ||
          (i.itemType || '').toLowerCase().includes(q)
      ).length
    : 0;

  const reportHeading = isToday
    ? (isGujarati ? "આજનું પર્ફોર્મન્સ" : "Today's Performance")
    : isYesterday
    ? (isGujarati ? "ગઈકાલનું પર્ફોર્મન્સ" : "Yesterday's Performance")
    : (isGujarati ? `દૈનિક રિપોર્ટ · ${readableSelectedDate}` : `Daily Report · ${readableSelectedDate}`);

  return (
    <PullToRefresh onRefresh={onRefresh || (() => {})}>
      <div className="space-y-6">
      {/* Global Filter Banner if Search Term is set */}
      {searchQuery.trim() && (
        <div className="bg-sky-50/90 border border-sky-200/90 rounded-xl p-3.5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-sky-950">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-sky-600 text-white shrink-0">
              <Search className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="font-semibold text-sky-950">
                Global Search Active: <span className="underline decoration-sky-400 font-bold">"{searchQuery}"</span>
              </p>
              <p className="text-sky-700 text-[11px] mt-0.5">
                Found {matchedCustomersCount} customer{matchedCustomersCount !== 1 ? 's' : ''} and {matchedInventoryCount} inventory SKU{matchedInventoryCount !== 1 ? 's' : ''}.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onNavigateToTab && (
              <>
                <button
                  onClick={() => onNavigateToTab('customers')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-sky-100/80 text-sky-800 rounded-lg border border-sky-200 text-xs font-medium cursor-pointer transition-colors shadow-2xs whitespace-nowrap shrink-0"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>View in Customers ({matchedCustomersCount})</span>
                  <ArrowRight className="w-3 h-3 ml-0.5" />
                </button>
                <button
                  onClick={() => onNavigateToTab('inventory')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-sky-100/80 text-sky-800 rounded-lg border border-sky-200 text-xs font-medium cursor-pointer transition-colors shadow-2xs whitespace-nowrap shrink-0"
                >
                  <Boxes className="w-3.5 h-3.5" />
                  <span>View in Inventory ({matchedInventoryCount})</span>
                  <ArrowRight className="w-3 h-3 ml-0.5" />
                </button>
              </>
            )}
            {onClearSearch && (
              <button
                onClick={onClearSearch}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-sky-200/60 hover:bg-sky-200 text-sky-900 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0"
                title="Clear global filter"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear Filter</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Daily Performance Summary Block with Quick Date Switcher */}
      <div 
        id="dashboard-todays-performance-block"
        className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-3"
      >
        {/* Top Header Row with Title, Date Switcher, and Action Buttons */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center font-bold border border-sky-100/80 shrink-0">
              <Activity className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">
                  {reportHeading}
                </h2>
                <span className="text-xs text-slate-400" aria-hidden="true">·</span>
                <span className="text-xs font-medium text-slate-600 font-mono tabular-nums">
                  {readableSelectedDate}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isGujarati 
                  ? 'પસંદ કરેલ તારીખના ડિલિવરી, જાર વિતરણ અને બાકી વસૂલાત સહિતની કુલ આવક' 
                  : 'Verified daily dispatches, jar movement, and revenue including due settlements'}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 flex-wrap">
            {/* Quick Date Switcher (Today | Yesterday | Custom Date) */}
            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200/70">
              <button
                type="button"
                onClick={() => setSelectedDate(todayStr)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  isToday
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {isGujarati ? 'આજે' : 'Today'}
              </button>
              <button
                type="button"
                onClick={() => setSelectedDate(yesterdayStr)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  isYesterday
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {isGujarati ? 'ગઈકાલે' : 'Yesterday'}
              </button>
              <label
                className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  !isToday && !isYesterday
                    ? 'bg-white text-sky-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Pick a specific date for the daily report"
              >
                <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <input
                  type="date"
                  value={selectedDate}
                  max={todayStr}
                  onChange={(e) => {
                    if (e.target.value) setSelectedDate(e.target.value);
                  }}
                  aria-label="Select report date"
                  className="bg-transparent text-xs font-mono tabular-nums focus:outline-none cursor-pointer w-[108px]"
                />
              </label>
            </div>

            <button
              onClick={onOpenNewDelivery}
              id="dashboard-record-delivery-header-btn"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white rounded-lg text-xs font-bold shadow-2xs transition-all cursor-pointer whitespace-nowrap shrink-0"
              title="Record a new delivery dispatch"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Record Delivery</span>
            </button>

            {userRole !== 'WORKER' && onOpenExportAccounting && (
              <button
                onClick={onOpenExportAccounting}
                id="dashboard-export-accounting-csv-btn"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0"
                title="Export daily delivery & transaction log as CSV"
              >
                <Download className="w-3.5 h-3.5 text-emerald-700" />
                <span>Export Day Book (CSV)</span>
              </button>
            )}
          </div>
        </div>

        {/* 3 Compact KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
          {/* 1. Total Deliveries */}
          <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg bg-slate-50/80 border border-slate-200/70 hover:bg-slate-50 transition-colors">
            <div className="space-y-0.5">
              <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                {isGujarati ? 'કુલ ડિલિવરી' : 'Total Deliveries'}
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight font-mono tabular-nums leading-none">
                  {totalDeliveriesCount.toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] sm:text-[11px] font-medium text-slate-500">
                  {totalDeliveriesCount === 1 ? 'trip' : 'trips'}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-medium font-mono tabular-nums">
                {totalDeliveriesCount > 0
                  ? `${totalDeliveriesCount} ${isToday ? 'completed today' : `on ${selectedDateLabel}`}`
                  : isToday
                  ? 'No deliveries logged today'
                  : `No deliveries on ${selectedDateLabel}`}
                {daySummary.dueClearanceCount > 0 && ` · +${daySummary.dueClearanceCount} due settled`}
              </p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-sky-100/80 text-sky-700 flex items-center justify-center shrink-0 border border-sky-200/60 shadow-2xs">
              <Truck className="w-4 h-4 stroke-[2.2]" />
            </div>
          </div>

          {/* 2. Jars Delivered */}
          <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg bg-slate-50/80 border border-slate-200/70 hover:bg-slate-50 transition-colors">
            <div className="space-y-0.5">
              <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                {isGujarati ? 'ડિલિવર થયેલ જાર' : 'Jars Delivered'}
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg sm:text-xl font-extrabold text-sky-950 tracking-tight font-mono tabular-nums leading-none">
                  {totalJarsDelivered.toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] sm:text-[11px] font-medium text-slate-500">
                  jars
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-medium font-mono tabular-nums">
                {totalEmptiesReturned > 0 
                  ? `${totalEmptiesReturned} empties returned` 
                  : 'Total water units dispatched'}
              </p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-cyan-100/80 text-cyan-700 flex items-center justify-center shrink-0 border border-cyan-200/60 shadow-2xs">
              <Boxes className="w-4 h-4 stroke-[2.2]" />
            </div>
          </div>

          {/* 3. Selected Day's Revenue (Delivery Collections + Due Settlements) */}
          <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg bg-emerald-50/40 border border-emerald-200/80 hover:bg-emerald-50/70 transition-colors">
            <div className="space-y-0.5">
              <span className="text-[10px] sm:text-[11px] font-semibold text-emerald-800 uppercase tracking-wider block">
                {isToday
                  ? (isGujarati ? "આજની આવક" : "Today's Revenue")
                  : (isGujarati ? `${selectedDateLabel} આવક` : `${selectedDateLabel} Revenue`)}
              </span>
              <div className="flex items-baseline">
                <span className="text-sm sm:text-base font-bold mr-0.5 text-emerald-700 font-sans leading-none">₹</span>
                <span className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight font-mono tabular-nums leading-none">
                  {currentDayRevenue.toLocaleString('en-IN')}
                </span>
              </div>
              <p className="text-[10px] text-emerald-700 font-medium font-mono tabular-nums">
                ₹{cashRevenue.toLocaleString('en-IN')} Cash · ₹{upiRevenue.toLocaleString('en-IN')} UPI
                {daySummary.totalDueClearances > 0 && (
                  <span> · Incl. ₹{daySummary.totalDueClearances.toLocaleString('en-IN')} due recovery</span>
                )}
              </p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-emerald-100/80 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-200/70 shadow-2xs">
              <IndianRupee className="w-4 h-4 stroke-[2.2]" />
            </div>
          </div>
        </div>
      </div>

      {/* 4 Clean Primary Metrics */}
      <KpiMetrics
        todayDeliveries={dateFilteredDeliveries}
        todayTransactions={dateFilteredTransactions}
        customers={customers}
        isToday={isToday}
        selectedDateLabel={selectedDateLabel}
      />

      {/* Main Operational View: Deliveries & Inventory */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Deliveries Stream (Primary operational area) */}
        <div className="lg:col-span-7 xl:col-span-8">
          <DispatchStream 
            todayDeliveries={dateFilteredDeliveries}
            allDeliveries={sourceDeliveries}
            dayTransactions={dateFilteredTransactions}
            isToday={isToday}
            selectedDateLabel={selectedDateLabel}
            onOpenNewDelivery={onOpenNewDelivery} 
            onOpenInvoice={userRole !== 'WORKER' ? onOpenInvoice : undefined}
            onOpenExportCSV={userRole !== 'WORKER' ? onOpenExportAccounting : undefined}
            searchQuery={searchQuery}
            onClearSearch={onClearSearch}
            onSearchChange={onSearchChange}
            onRefresh={onRefresh}
            userRole={userRole}
          />
        </div>

        {/* Warehouse Stock Gauge & Quick Restock */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-6">
          <InventoryGauge 
            inventory={inventory} 
            onOpenRestock={onOpenRestock} 
          />

          {/* Cooler / Function Jar Bookings Overview with CardSpotlight */}
          <CardSpotlight spotlightColor="rgba(6, 182, 212, 0.12)" className="p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-700 flex items-center justify-center border border-cyan-100/60 shadow-2xs">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 tracking-tight">
                    Cooler & Event Orders
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {orders.filter(o => o.status !== 'CANCELLED' && o.status !== 'DELIVERED').length} active bookings
                  </p>
                </div>
              </div>

              {onOpenNewOrder && (
                <button
                  onClick={onOpenNewOrder}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3 stroke-[2.5]" />
                  <span>Book Order</span>
                </button>
              )}
            </div>

            <div className="divide-y divide-slate-100 mt-2">
              {orders.slice(0, 3).map((ord) => (
                <div key={ord.id} className="py-2.5 flex items-center justify-between text-xs hover:bg-slate-50/60 rounded-lg px-1 transition-colors">
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-900 truncate">
                        {ord.customerName}
                      </span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wide ${
                        ord.status === 'CONFIRMED'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                          : ord.status === 'DELIVERED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                          : ord.status === 'PENDING'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                          : 'bg-slate-100 text-slate-600 border border-slate-200/60'
                      }`}>
                        {ord.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5 font-medium">
                      <span className="font-mono tabular-nums">{ord.quantity}x</span> {ord.itemType} • <span className="font-mono tabular-nums font-semibold text-slate-700">₹{ord.totalAmount}</span>
                    </p>
                  </div>

                  {onNavigateToTab && (
                    <button
                      onClick={() => onNavigateToTab('orders')}
                      className="text-[11px] text-cyan-600 hover:text-cyan-700 font-semibold shrink-0 cursor-pointer"
                    >
                      Details
                    </button>
                  )}
                </div>
              ))}

              {orders.length === 0 && (
                <p className="text-xs text-slate-400 py-4 text-center">No orders booked yet.</p>
              )}
            </div>

            {onNavigateToTab && orders.length > 0 && (
              <div className="pt-3 border-t border-slate-100 mt-2">
                <button
                  onClick={() => onNavigateToTab('orders')}
                  className="w-full flex items-center justify-center gap-1 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer border border-slate-200/60"
                >
                  <span>View All {orders.length} Orders</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </CardSpotlight>
        </div>
      </div>

    </div>
    </PullToRefresh>
  );
};
