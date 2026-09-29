import React, { useState } from 'react';
import { DeliveryLog } from '../types';
import { 
  Truck, 
  Search, 
  Clock, 
  RotateCcw,
  Plus,
  X,
  Printer,
  Share2,
  FileSpreadsheet
} from 'lucide-react';

interface DispatchStreamProps {
  todayDeliveries: DeliveryLog[];
  onOpenNewDelivery: () => void;
  onOpenInvoice?: (delivery: DeliveryLog) => void;
  onOpenExportCSV?: () => void;
  searchQuery?: string;
  onClearSearch?: () => void;
  onSearchChange?: (val: string) => void;
  userRole?: 'OWNER' | 'WORKER';
}

export const DispatchStream: React.FC<DispatchStreamProps> = ({ 
  todayDeliveries,
  onOpenNewDelivery,
  onOpenInvoice,
  onOpenExportCSV,
  searchQuery = '',
  onClearSearch,
  onSearchChange,
  userRole = 'OWNER'
}) => {
  const [localSearch, setLocalSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | 'CASH' | 'UPI' | 'CREDIT'>('ALL');

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

  const filteredDeliveries = todayDeliveries.filter((d) => {
    const q = effectiveSearch.toLowerCase().trim();
    const matchesSearch = 
      !q ||
      (d.customerName || '').toLowerCase().includes(q) ||
      (d.workerName || '').toLowerCase().includes(q) ||
      (d.itemType || '').toLowerCase().includes(q);
    const matchesPayment = paymentFilter === 'ALL' || d.paymentMode === paymentFilter;
    return matchesSearch && matchesPayment;
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
      {/* Header Bar */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-slate-900">Today's Deliveries</h3>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
            {filteredDeliveries.length} of {todayDeliveries.length}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Search Field */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search customer or driver..."
              value={effectiveSearch}
              onChange={(e) => handleSearchInput(e.target.value)}
              className="pl-8 pr-7 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 w-36 sm:w-48 text-slate-900"
            />
            {effectiveSearch && (
              <button
                onClick={handleClear}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Payment Mode Filter */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs">
            {(['ALL', 'CASH', 'UPI', 'CREDIT'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setPaymentFilter(mode)}
                className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  paymentFilter === mode
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Export CSV for External Accounting */}
          {onOpenExportCSV && (
            <button
              onClick={onOpenExportCSV}
              id="dispatch-export-csv-btn"
              title="Export today's delivery and transaction log as CSV"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100/90 border border-emerald-200/90 rounded-lg transition-colors cursor-pointer shadow-2xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Export CSV</span>
              <span className="sm:hidden">CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* Deliveries List */}
      <div className="divide-y divide-slate-100 max-h-[460px] overflow-y-auto">
        {filteredDeliveries.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2.5">
              <Truck className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold text-slate-700">No deliveries logged today</p>
            <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">
              {todayDeliveries.length === 0
                ? "Click 'Record Delivery' above to log your first drop."
                : 'No delivery logs match your filter.'}
            </p>
            {todayDeliveries.length === 0 && (
              <button
                onClick={onOpenNewDelivery}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" /> Record First Drop
              </button>
            )}
          </div>
        ) : (
          filteredDeliveries.map((deliv) => {
            const timeStr = new Date(deliv.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            });

            return (
              <div
                key={deliv.id}
                className="p-3.5 sm:px-5 hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-3"
              >
                {/* Customer & Driver Info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-700 font-bold text-xs flex items-center justify-center shrink-0 border border-sky-100">
                    {deliv.customerName ? deliv.customerName.charAt(0).toUpperCase() : 'C'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {deliv.customerName}
                    </p>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                      <span>{deliv.workerName || 'Staff Driver'}</span>
                      <span>•</span>
                      <span className="flex items-center gap-0.5 text-slate-400">
                        <Clock className="w-3 h-3" /> {timeStr}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quantities, Financial Mode & Actions */}
                <div className="flex items-center gap-2 sm:gap-4 text-right shrink-0">
                  <div>
                    {deliv.jarsDelivered === 0 && deliv.emptyJarsCollected > 0 ? (
                      <>
                        <span className="text-xs font-bold text-emerald-700 flex items-center justify-end gap-1">
                          <RotateCcw className="w-3 h-3 text-emerald-600" />
                          {deliv.emptyJarsCollected} returned
                        </span>
                        <span className="text-[10px] text-slate-400 block">Return Only</span>
                      </>
                    ) : (
                      <>
                        <span className="text-xs font-bold text-sky-700 block">
                          +{deliv.jarsDelivered} jars
                        </span>
                        <span className="text-[11px] text-slate-500 flex items-center justify-end gap-0.5">
                          <RotateCcw className="w-3 h-3 text-emerald-600" /> -{deliv.emptyJarsCollected}
                        </span>
                      </>
                    )}
                  </div>

                  <div className="min-w-[55px] sm:min-w-[65px]">
                    <span className="text-xs font-bold text-slate-900 block">
                      ₹{deliv.amountCollected.toLocaleString('en-IN')}
                    </span>
                    <span
                      className={`inline-block text-[9px] font-bold px-1.5 py-0.2 rounded mt-0.5 uppercase ${
                        deliv.paymentMode === 'CREDIT'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : deliv.paymentMode === 'UPI'
                          ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {deliv.paymentMode}
                    </span>
                  </div>

                  {/* Send Bill & Receipt Button - Owner Only */}
                  {userRole !== 'WORKER' && onOpenInvoice && (
                    <button
                      onClick={() => onOpenInvoice(deliv)}
                      id={`send-bill-btn-${deliv.id}`}
                      className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0"
                      title="Send WhatsApp Bill or Print Tax Invoice"
                    >
                      <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="hidden sm:inline">Send Bill</span>
                      <span className="sm:hidden text-[11px]">Bill</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
