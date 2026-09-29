import React from 'react';
import { InventoryItem, Customer, DeliveryLog, ActiveTab, OrderBooking } from '../types';
import { KpiMetrics } from '../components/KpiMetrics';
import { InventoryGauge } from '../components/InventoryGauge';
import { DispatchStream } from '../components/DispatchStream';
import { Search, X, Users, Boxes, ArrowRight, Package, Calendar, Plus, FileSpreadsheet, Download, Truck } from 'lucide-react';

interface DashboardPageProps {
  inventory: InventoryItem[];
  customers: Customer[];
  todayDeliveries: DeliveryLog[];
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
  userRole?: 'OWNER' | 'WORKER';
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  inventory,
  customers,
  todayDeliveries,
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
  userRole = 'OWNER'
}) => {
  const q = searchQuery.toLowerCase().trim();

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

  return (
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
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-sky-100/80 text-sky-800 rounded-lg border border-sky-200 text-xs font-medium cursor-pointer transition-colors shadow-2xs"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>View in Customers ({matchedCustomersCount})</span>
                  <ArrowRight className="w-3 h-3 ml-0.5" />
                </button>
                <button
                  onClick={() => onNavigateToTab('inventory')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-sky-100/80 text-sky-800 rounded-lg border border-sky-200 text-xs font-medium cursor-pointer transition-colors shadow-2xs"
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
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-sky-200/60 hover:bg-sky-200 text-sky-900 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                title="Clear global filter"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear Filter</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Operations & Daily Accounting Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 sm:px-4 rounded-xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold shrink-0">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold text-slate-900">
                Daily Operations & Accounting Day Book
              </h2>
              <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100/70 px-1.5 py-0.2 rounded">
                Tally / Excel Ready
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Track deliveries, empty jar circulation, cash & UPI collections with formatted ledger export
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            onClick={onOpenNewDelivery}
            id="dashboard-record-delivery-header-btn"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white rounded-lg text-xs font-bold shadow-2xs transition-all cursor-pointer"
            title="Record a new delivery dispatch"
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Record Delivery</span>
          </button>

          {userRole !== 'WORKER' && onOpenExportAccounting && (
            <button
              onClick={onOpenExportAccounting}
              id="dashboard-export-accounting-csv-btn"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-2xs transition-all cursor-pointer"
              title="Export current day's delivery & transaction log as CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Day Book (CSV)</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 Clean Primary Metrics */}
      <KpiMetrics todayDeliveries={todayDeliveries} customers={customers} />

      {/* Main Operational View: Deliveries & Inventory */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Deliveries Stream (Primary operational area) */}
        <div className="lg:col-span-7 xl:col-span-8">
          <DispatchStream 
            todayDeliveries={todayDeliveries} 
            onOpenNewDelivery={onOpenNewDelivery} 
            onOpenInvoice={userRole !== 'WORKER' ? onOpenInvoice : undefined}
            onOpenExportCSV={userRole !== 'WORKER' ? onOpenExportAccounting : undefined}
            searchQuery={searchQuery}
            onClearSearch={onClearSearch}
            onSearchChange={onSearchChange}
            userRole={userRole}
          />
        </div>

        {/* Warehouse Stock Gauge & Quick Restock */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-6">
          <InventoryGauge 
            inventory={inventory} 
            onOpenRestock={onOpenRestock} 
          />

          {/* Cooler / Function Jar Bookings Overview */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-700 flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 tracking-tight">
                    Cooler & Event Orders
                  </h3>
                  <p className="text-[11px] text-slate-500">
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
                <div key={ord.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-900 truncate">
                        {ord.customerName}
                      </span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                        ord.status === 'CONFIRMED'
                          ? 'bg-blue-50 text-blue-700'
                          : ord.status === 'DELIVERED'
                          ? 'bg-emerald-50 text-emerald-700'
                          : ord.status === 'PENDING'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {ord.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {ord.quantity}x {ord.itemType} • ₹{ord.totalAmount}
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
                <p className="text-xs text-slate-400 py-3 text-center">No orders booked yet.</p>
              )}
            </div>

            {onNavigateToTab && orders.length > 0 && (
              <div className="pt-3 border-t border-slate-100 mt-2">
                <button
                  onClick={() => onNavigateToTab('orders')}
                  className="w-full flex items-center justify-center gap-1 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                >
                  <span>View All {orders.length} Orders</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
