import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DeliveryLog } from '../types';
import { 
  Truck, 
  Search, 
  RefreshCw,
  Plus, 
  X, 
  FileSpreadsheet, 
  Share2,
  ChevronDown,
  Clock,
  User,
  MapPin,
  CheckCircle2,
  Receipt
} from 'lucide-react';
import { CardSpotlight } from './ui/CardSpotlight';
import { AnimatedTabs, TabItem } from './ui/AnimatedTabs';
import { useLanguage } from '../context/LanguageContext';
import { triggerHaptic } from '../utils/haptics';

interface DispatchStreamProps {
  todayDeliveries: DeliveryLog[];
  onOpenNewDelivery: () => void;
  onOpenInvoice?: (delivery: DeliveryLog) => void;
  onOpenExportCSV?: () => void;
  searchQuery?: string;
  onClearSearch?: () => void;
  onSearchChange?: (val: string) => void;
  onRefresh?: () => Promise<void> | void;
  userRole?: 'OWNER' | 'WORKER';
}

type PaymentFilterMode = 'ALL' | 'CASH' | 'UPI' | 'CREDIT';

export const DispatchStream: React.FC<DispatchStreamProps> = ({ 
  todayDeliveries,
  onOpenNewDelivery,
  onOpenInvoice,
  onOpenExportCSV,
  searchQuery = '',
  onClearSearch,
  onSearchChange,
  onRefresh,
  userRole = 'OWNER'
}) => {
  const { isGujarati } = useLanguage();
  const [localSearch, setLocalSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilterMode>('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Dropdown expansion state (defaults to false so user can click to drop down and view deliveries)
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(() => {
    try {
      const saved = sessionStorage.getItem('dispatch_stream_expanded');
      if (saved !== null) return saved === 'true';
    } catch {}
    return false;
  });

  // Track an individually expanded delivery item for micro-detail inspection
  const [expandedDeliveryId, setExpandedDeliveryId] = useState<string | null>(null);

  const effectiveSearch = searchQuery !== undefined && searchQuery !== '' ? searchQuery : localSearch;

  // Auto-expand dropdown when an active search query is entered
  useEffect(() => {
    if (effectiveSearch.trim() !== '') {
      setIsDropdownOpen(true);
    }
  }, [effectiveSearch]);

  const toggleDropdown = () => {
    triggerHaptic('light');
    setIsDropdownOpen(prev => {
      const next = !prev;
      try {
        sessionStorage.setItem('dispatch_stream_expanded', String(next));
      } catch {}
      return next;
    });
  };

  const handleManualSync = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!onRefresh || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await Promise.resolve(onRefresh());
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  const handleSearchInput = (val: string) => {
    setLocalSearch(val);
    onSearchChange?.(val);
  };

  const handleClear = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setLocalSearch('');
    onSearchChange?.('');
    onClearSearch?.();
  };

  // Operational aggregates for quick header summary
  const totalJarsDelivered = useMemo(
    () => todayDeliveries.reduce((sum, d) => sum + (Number(d.jarsDelivered) || 0), 0),
    [todayDeliveries]
  );

  const totalCollected = useMemo(
    () => todayDeliveries.reduce((sum, d) => sum + (Number(d.amountCollected) || 0), 0),
    [todayDeliveries]
  );

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

  const paymentTabs: TabItem<PaymentFilterMode>[] = [
    { id: 'ALL', label: isGujarati ? 'બધા' : 'All' },
    { id: 'CASH', label: isGujarati ? 'રોકડ' : 'Cash' },
    { id: 'UPI', label: 'UPI' },
    { id: 'CREDIT', label: isGujarati ? 'બાકી' : 'Due' },
  ];

  return (
    <CardSpotlight 
      spotlightColor="rgba(2, 132, 199, 0.08)" 
      className="overflow-hidden transition-all duration-300 ease-out hover:shadow-xl hover:-translate-y-0.5 hover:scale-[1.004] hover:border-sky-300/70"
    >
      {/* Header Bar with Smooth Hover Feedback & Interactive Dropdown Trigger */}
      <div 
        onClick={toggleDropdown}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleDropdown();
          }
        }}
        aria-expanded={isDropdownOpen}
        id="dispatch-stream-header"
        className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors duration-200 hover:bg-slate-50/70 cursor-pointer select-none group border-b border-transparent data-[open=true]:border-slate-100"
        data-open={isDropdownOpen}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold border border-sky-100/80 shrink-0 group-hover:bg-sky-100 group-hover:scale-105 transition-all duration-200 shadow-2xs">
            <Truck className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                {isGujarati ? "આજની ડિલિવરી" : "Today's Deliveries"}
              </h3>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono tabular-nums">
                {isDropdownOpen 
                  ? `${filteredDeliveries.length} of ${todayDeliveries.length}` 
                  : `${todayDeliveries.length} ${todayDeliveries.length === 1 ? 'logged' : 'logged'}`}
              </span>
            </div>
            
            {/* Quick Informative Summary Pill */}
            <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2 font-medium flex-wrap">
              {todayDeliveries.length > 0 ? (
                <>
                  <span className="text-slate-600 font-mono tabular-nums">+{totalJarsDelivered} jars</span>
                  <span className="text-slate-300">•</span>
                  <span className="font-semibold text-emerald-700 font-mono tabular-nums">₹{totalCollected.toLocaleString('en-IN')} collected</span>
                  <span className="text-slate-300 hidden sm:inline">•</span>
                  <span className="text-sky-600 text-[10px] font-semibold hidden sm:inline">
                    {isDropdownOpen ? (isGujarati ? 'છુપાવવા ક્લિક કરો' : 'Click to collapse') : (isGujarati ? 'જોવા માટે ક્લિક કરો' : 'Click to view list')}
                  </span>
                </>
              ) : (
                <span>{isGujarati ? 'આજે હજુ કોઈ ડિલિવરી નોંધાઈ નથી' : 'No dispatches recorded today'}</span>
              )}
            </p>
          </div>
        </div>

        {/* Action Controls & Dropdown Trigger */}
        <div 
          className="flex items-center gap-2 self-end sm:self-center shrink-0" 
          onClick={(e) => e.stopPropagation()}
        >
          {/* Quick Record Drop Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenNewDelivery();
            }}
            id="dispatch-quick-record-btn"
            title="Record a new delivery drop"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white rounded-lg text-xs font-bold shadow-2xs hover:shadow-xs hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>{isGujarati ? 'ડિલિવરી' : 'Record Drop'}</span>
          </button>

          {/* Dedicated Animated Dropdown Toggle Button */}
          <button
            type="button"
            onClick={toggleDropdown}
            id="dispatch-toggle-dropdown-btn"
            aria-expanded={isDropdownOpen}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-xs hover:scale-105 active:scale-95 ${
              isDropdownOpen 
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200/90' 
                : 'bg-sky-50 hover:bg-sky-100 text-sky-700 border-sky-200/90'
            }`}
          >
            <span>{isDropdownOpen ? (isGujarati ? 'છુપાવો' : 'Hide Deliveries') : (isGujarati ? 'ડિલિવરી જુઓ' : 'View Deliveries')}</span>
            <ChevronDown 
              className={`w-3.5 h-3.5 transition-transform duration-300 ease-out ${
                isDropdownOpen ? 'rotate-180 text-slate-700' : 'text-sky-600'
              }`} 
            />
          </button>
        </div>
      </div>

      {/* Smooth Collapsible Dropdown Body */}
      <AnimatePresence initial={false}>
        {isDropdownOpen && (
          <motion.div
            key="dispatch-dropdown-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-slate-100"
          >
            {/* Filter & Search Toolbar */}
            <div className="p-3 sm:px-5 bg-slate-50/70 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Search Field */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder={isGujarati ? 'ગ્રાહક અથવા ડ્રાઇવર શોધો...' : 'Search customer or driver...'}
                    value={effectiveSearch}
                    onChange={(e) => handleSearchInput(e.target.value)}
                    className="pl-8 pr-7 py-1 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 w-36 sm:w-44 text-slate-900 shadow-2xs"
                  />
                  {effectiveSearch && (
                    <button
                      onClick={handleClear}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                      title="Clear search"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Animated Payment Mode Filter */}
                <AnimatedTabs
                  tabs={paymentTabs}
                  activeTab={paymentFilter}
                  onChange={(mode) => setPaymentFilter(mode)}
                  layoutId="dispatch-payment-filter"
                  size="sm"
                />
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                {/* Export CSV for External Accounting */}
                {onOpenExportCSV && (
                  <button
                    onClick={onOpenExportCSV}
                    id="dispatch-export-csv-btn"
                    title="Export today's delivery and transaction log as CSV"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-emerald-800 bg-white hover:bg-emerald-50 border border-emerald-200/90 rounded-lg transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-2xs"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="hidden sm:inline">Export CSV</span>
                    <span className="sm:hidden">CSV</span>
                  </button>
                )}

                {/* Manual Refresh / Sync Button */}
                {onRefresh && (
                  <button
                    onClick={handleManualSync}
                    disabled={isRefreshing}
                    id="dispatch-manual-sync-btn"
                    title="Manually sync latest delivery records from Firestore"
                    className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-sky-700 bg-white hover:bg-sky-50 border border-sky-200/90 rounded-lg transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-2xs disabled:opacity-60"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-sky-600 ${isRefreshing ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">{isRefreshing ? 'Syncing...' : 'Sync'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Deliveries Stream List */}
            <div className="divide-y divide-slate-100 max-h-[460px] overflow-y-auto">
              {filteredDeliveries.length === 0 ? (
                <div className="py-12 px-4 text-center">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2.5">
                    <Truck className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-semibold text-slate-700">
                    {isGujarati ? 'આજે કોઈ ડિલિવરી મળી નથી' : 'No deliveries logged today'}
                  </p>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">
                    {todayDeliveries.length === 0
                      ? (isGujarati ? "પ્રથમ ડિલિવરી નોંધવા માટે 'Record Drop' પર ક્લિક કરો." : "Click 'Record Drop' above to log your first drop.")
                      : (isGujarati ? 'તમારા ફિલ્ટર સાથે કોઈ મેળ ખાતું નથી.' : 'No delivery logs match your filter.')}
                  </p>
                  {todayDeliveries.length === 0 && (
                    <button
                      onClick={onOpenNewDelivery}
                      className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" /> 
                      <span>{isGujarati ? 'પ્રથમ ડિલિવરી નોંધો' : 'Record First Drop'}</span>
                    </button>
                  )}
                </div>
              ) : (
                filteredDeliveries.map((deliv) => {
                  const timeStr = new Date(deliv.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                  const isItemExpanded = expandedDeliveryId === deliv.id;

                  return (
                    <div
                      key={deliv.id}
                      className="transition-colors hover:bg-slate-50/80"
                    >
                      {/* Main Delivery Row with Smooth Hover Lift & Scale Feedback */}
                      <div
                        onClick={() => {
                          triggerHaptic('light');
                          setExpandedDeliveryId(prev => prev === deliv.id ? null : deliv.id);
                        }}
                        className="py-3 px-3.5 sm:px-5 flex items-center justify-between gap-3 sm:gap-4 cursor-pointer transition-all duration-200 ease-out hover:shadow-2xs group"
                      >
                        {/* Customer & Driver Info */}
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 font-semibold text-xs flex items-center justify-center shrink-0 group-hover:bg-sky-100 group-hover:text-sky-700 transition-colors">
                            {deliv.customerName ? deliv.customerName.charAt(0).toUpperCase() : 'C'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate group-hover:text-sky-900 transition-colors">
                              {deliv.customerName}
                            </p>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5 font-medium truncate">
                              <span className="font-mono text-slate-500">{timeStr}</span>
                              <span className="text-slate-300">•</span>
                              <span className="truncate">{deliv.workerName || 'Staff Driver'}</span>
                            </div>
                          </div>
                        </div>

                        {/* Quantities, Financial Mode & Actions */}
                        <div className="flex items-center gap-3 sm:gap-5 text-right shrink-0">
                          {/* Jars Summary */}
                          <div className="min-w-[50px] sm:min-w-[60px]">
                            {deliv.jarsDelivered === 0 && deliv.emptyJarsCollected > 0 ? (
                              <div>
                                <span className="text-xs font-semibold text-emerald-700 block font-mono tabular-nums">
                                  {deliv.emptyJarsCollected} ret
                                </span>
                                <span className="text-[10px] text-slate-400 block font-medium">Return</span>
                              </div>
                            ) : (
                              <div>
                                <span className="text-xs font-semibold text-slate-900 block font-mono tabular-nums">
                                  +{deliv.jarsDelivered} <span className="text-[10px] font-normal text-slate-400">jars</span>
                                </span>
                                {deliv.emptyJarsCollected > 0 && (
                                  <span className="text-[11px] text-slate-500 block font-mono tabular-nums">
                                    -{deliv.emptyJarsCollected} ret
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Financial Amount & Payment Status */}
                          <div className="min-w-[52px] sm:min-w-[62px]">
                            <span className="text-xs sm:text-sm font-bold text-slate-900 block font-mono tabular-nums">
                              ₹{deliv.amountCollected.toLocaleString('en-IN')}
                            </span>
                            <span
                              className={`block text-[10px] font-semibold uppercase tracking-wider mt-0.5 ${
                                deliv.paymentMode === 'CREDIT'
                                  ? 'text-amber-600 font-bold'
                                  : deliv.paymentMode === 'UPI'
                                  ? 'text-indigo-600 font-bold'
                                  : 'text-slate-500'
                              }`}
                            >
                              {deliv.paymentMode === 'CREDIT' ? 'Due' : deliv.paymentMode}
                            </span>
                          </div>

                          {/* Send Bill Action */}
                          {userRole !== 'WORKER' && onOpenInvoice && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenInvoice(deliv);
                              }}
                              id={`send-bill-btn-${deliv.id}`}
                              className="inline-flex items-center gap-1 p-1.5 sm:px-2.5 sm:py-1 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg text-xs font-medium transition-all hover:scale-105 active:scale-95 cursor-pointer shrink-0"
                              title="Send WhatsApp Bill or Print Tax Invoice"
                            >
                              <Share2 className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 transition-colors" />
                              <span className="hidden sm:inline text-[11px]">Bill</span>
                            </button>
                          )}

                          {/* Micro Expand Arrow for Item Details */}
                          <div className="text-slate-400 group-hover:text-slate-600 transition-colors">
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isItemExpanded ? 'rotate-180 text-sky-600' : ''}`} />
                          </div>
                        </div>
                      </div>

                      {/* Micro Dropdown Details for Individual Delivery */}
                      <AnimatePresence>
                        {isItemExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden bg-sky-50/40 border-t border-slate-100 px-4 py-2.5 sm:px-6 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-4 flex-wrap">
                              <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                                <Clock className="w-3 h-3 text-sky-600" />
                                <span>{new Date(deliv.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                              </span>
                              {deliv.itemType && (
                                <span className="inline-flex items-center gap-1 bg-white border border-slate-200/80 px-2 py-0.5 rounded text-[11px] font-semibold text-slate-700">
                                  {deliv.itemType}
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                                <User className="w-3 h-3 text-slate-400" />
                                <span>Driver: {deliv.workerName || 'Staff'}</span>
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              {userRole !== 'WORKER' && onOpenInvoice && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenInvoice(deliv);
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-[11px] font-semibold transition-colors cursor-pointer"
                                >
                                  <Receipt className="w-3 h-3" />
                                  <span>Share WhatsApp Receipt</span>
                                </button>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </CardSpotlight>
  );
};
