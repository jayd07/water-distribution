import React, { useState, useMemo } from 'react';
import { 
  Truck, 
  Play, 
  CheckCircle2, 
  MapPin, 
  TrendingUp, 
  Banknote, 
  RotateCcw, 
  Calendar, 
  Filter, 
  Plus, 
  Search,
  AlertCircle,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import { 
  BusinessAccount, 
  Customer, 
  CustomerSchedule, 
  DeliveryTrip, 
  UserSessionProfile 
} from '../types';
import { QuickDeliveryCard } from './QuickDeliveryCard';
import { filterCustomersDueToday } from '../services/operationsService';
import { useLanguage } from '../context/LanguageContext';

interface DriverRunViewProps {
  business: BusinessAccount;
  customers: Customer[];
  schedules: CustomerSchedule[];
  activeTrip: DeliveryTrip | null;
  currentUserSession: UserSessionProfile | null;
  onStartTripClick: () => void;
  onCompleteTripClick: () => void;
  onRecordQuickDelivery: (payload: {
    customerId: string;
    customerName: string;
    jarsDelivered: number;
    emptyJarsCollected: number;
    amountCollected: number;
    paymentMode: 'CASH' | 'UPI' | 'CREDIT';
    notes?: string;
  }) => Promise<void>;
  onOpenSchedulesModal: () => void;
  onOpenExpensesModal: () => void;
  onRefreshData?: () => void;
}

export const DriverRunView: React.FC<DriverRunViewProps> = ({
  business,
  customers,
  schedules,
  activeTrip,
  currentUserSession,
  onStartTripClick,
  onCompleteTripClick,
  onRecordQuickDelivery,
  onOpenSchedulesModal,
  onOpenExpensesModal,
  onRefreshData
}) => {
  const { t, isGujarati } = useLanguage();
  const [selectedRoute, setSelectedRoute] = useState<string>('ALL');
  const [filterMode, setFilterMode] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Extract unique route list
  const routes = useMemo(() => {
    const list = new Set<string>();
    customers.forEach(c => {
      if (c.route && c.route.trim()) list.add(c.route.trim());
    });
    schedules.forEach(s => {
      if (s.preferredRoute && s.preferredRoute.trim()) list.add(s.preferredRoute.trim());
    });
    return Array.from(list);
  }, [customers, schedules]);

  // Compute customers scheduled/due for delivery run
  const dueCustomers = useMemo(() => {
    const list = filterCustomersDueToday(customers, schedules, new Date());
    return list;
  }, [customers, schedules]);

  // Filtered list
  const filteredList = useMemo(() => {
    return dueCustomers.filter(({ customer, schedule }) => {
      // 1. Route filter
      if (selectedRoute !== 'ALL') {
        const custRoute = customer.route || schedule?.preferredRoute;
        if (custRoute !== selectedRoute) return false;
      }

      // 2. Completion filter
      const isCompleted = activeTrip?.completedCustomerIds.includes(customer.id) || false;
      if (filterMode === 'PENDING' && isCompleted) return false;
      if (filterMode === 'COMPLETED' && !isCompleted) return false;

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = customer.name.toLowerCase().includes(q);
        const matchAddr = (customer.address || '').toLowerCase().includes(q);
        const matchPhone = (customer.phone || '').includes(q);
        if (!matchName && !matchAddr && !matchPhone) return false;
      }

      return true;
    });
  }, [dueCustomers, selectedRoute, filterMode, searchQuery, activeTrip]);

  const totalStops = dueCustomers.length;
  const completedStops = activeTrip?.completedCustomerIds.length || 0;
  const progressPercent = totalStops > 0 ? Math.min(100, Math.round((completedStops / totalStops) * 100)) : 0;

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      
      {/* 1. Trip Status & Dispatch Hero Card */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-sky-950 text-white rounded-3xl p-5 sm:p-6 shadow-xl border border-slate-700/60">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-bold">{t.worker.fieldDeliveryRun}</h2>
                  {activeTrip ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span>{t.worker.liveInTransit}</span>
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-700 text-slate-300">
                      {t.worker.standby}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  {activeTrip 
                    ? `Driver: ${activeTrip.driverName} · Route: ${activeTrip.routeName || t.worker.allAreas}`
                    : 'Dispatch driver run, track vehicle stock, and record 1-tap drops.'}
                </p>
              </div>
            </div>
          </div>

          {/* Action Trigger Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {onRefreshData && (
              <button
                type="button"
                onClick={onRefreshData}
                title="Refresh Cloud Sync"
                className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={onOpenExpensesModal}
              className="py-2.5 px-3.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Banknote className="w-4 h-4 text-emerald-400" />
              <span>{t.worker.logExpense}</span>
            </button>

            <button
              type="button"
              onClick={onOpenSchedulesModal}
              className="py-2.5 px-3.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Calendar className="w-4 h-4 text-sky-400" />
              <span>{t.worker.schedules}</span>
            </button>

            {activeTrip ? (
              <button
                type="button"
                onClick={onCompleteTripClick}
                className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{t.worker.reconcileEndRun}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onStartTripClick}
                className="py-2.5 px-4 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg transition-all cursor-pointer"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>{t.worker.startTrip}</span>
              </button>
            )}
          </div>
        </div>

        {/* Real-Time Live Run Telemetry HUD */}
        {activeTrip && (
          <div className="mt-5 pt-4 border-t border-slate-700/60 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
              <span className="text-slate-400 block text-[11px]">{t.worker.vehicleLoaded}</span>
              <strong className="text-base font-bold text-white tabular-nums">
                {activeTrip.loadedFullJars} Full
              </strong>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
              <span className="text-slate-400 block text-[11px]">{t.worker.deliveredRemaining}</span>
              <strong className="text-base font-bold text-sky-300 tabular-nums">
                {activeTrip.deliveredFullJars} / {activeTrip.remainingFullJars} Jars
              </strong>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
              <span className="text-slate-400 block text-[11px]">{t.worker.emptyJarsCollected}</span>
              <strong className="text-base font-bold text-amber-300 tabular-nums">
                {activeTrip.collectedEmptyJars} Empties
              </strong>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
              <span className="text-slate-400 block text-[11px]">{t.worker.cashCollected}</span>
              <strong className="text-base font-bold text-emerald-300 tabular-nums">
                ₹{activeTrip.totalCollected}
              </strong>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        <div className="mt-4 pt-3 border-t border-slate-700/40">
          <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5 font-medium">
            <span>Route Progress ({completedStops}/{totalStops} Stops)</span>
            <span className="font-bold text-sky-400">{progressPercent}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-sky-500 to-emerald-400 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* 2. Route & Search Controls Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search customer name, address, or phone..."
            className="w-full pl-9.5 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        {/* Route Selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedRoute}
            onChange={(e) => setSelectedRoute(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="ALL">All Routes ({dueCustomers.length})</option>
            {routes.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          {/* Pending / Completed Switch */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setFilterMode('ALL')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                filterMode === 'ALL'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('PENDING')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                filterMode === 'PENDING'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pending
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('COMPLETED')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                filterMode === 'COMPLETED'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Completed
            </button>
          </div>
        </div>
      </div>

      {/* 3. Customer Stops Queue */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Today's Dispatch Queue ({filteredList.length} Stops)
          </h3>
          <span className="text-xs text-slate-500">
            Tap Deliver to instantly update warehouse & account ledger
          </span>
        </div>

        {filteredList.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200/90 space-y-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <div>
              <h4 className="text-sm font-bold text-slate-800">
                {filterMode === 'PENDING' ? 'All Deliveries Completed!' : 'No matching stops found'}
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {filterMode === 'PENDING'
                  ? 'You have completed all scheduled deliveries for this route run.'
                  : 'Check route filter, or add new customer schedules.'}
              </p>
            </div>
            {!activeTrip && (
              <button
                type="button"
                onClick={onStartTripClick}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 text-white rounded-xl text-xs font-bold hover:bg-sky-500 transition-colors cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Start New Run</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredList.map(({ customer, schedule }) => {
              const isCompleted = activeTrip?.completedCustomerIds.includes(customer.id) || false;
              return (
                <QuickDeliveryCard
                  key={customer.id}
                  customer={customer}
                  schedule={schedule}
                  defaultJarRate={business.defaultJarRate || 35}
                  isCompleted={isCompleted}
                  activeTrip={activeTrip}
                  onQuickDeliver={onRecordQuickDelivery}
                />
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
