import React, { useMemo } from 'react';
import { Truck, IndianRupee, QrCode, AlertCircle } from 'lucide-react';
import { Customer, DeliveryLog } from '../types';
import { CardSpotlight } from './ui/CardSpotlight';
import { useLanguage } from '../context/LanguageContext';

interface KpiMetricsProps {
  todayDeliveries: DeliveryLog[];
  customers: Customer[];
}

export const KpiMetrics: React.FC<KpiMetricsProps> = ({ todayDeliveries, customers }) => {
  const { t, isGujarati } = useLanguage();

  const totalDeliveredToday = useMemo(
    () => todayDeliveries.reduce((sum, d) => sum + (Number(d.jarsDelivered) || 0), 0),
    [todayDeliveries]
  );

  const totalEmptiesToday = useMemo(
    () => todayDeliveries.reduce((sum, d) => sum + (Number(d.emptyJarsCollected) || 0), 0),
    [todayDeliveries]
  );

  const cashDeliveries = useMemo(
    () => todayDeliveries.filter((d) => d.paymentMode === 'CASH'),
    [todayDeliveries]
  );

  const totalCashRevenue = useMemo(
    () => cashDeliveries.reduce((sum, d) => sum + (Number(d.amountCollected) || 0), 0),
    [cashDeliveries]
  );

  const upiDeliveries = useMemo(
    () => todayDeliveries.filter((d) => d.paymentMode === 'UPI'),
    [todayDeliveries]
  );

  const totalUpiRevenue = useMemo(
    () => upiDeliveries.reduce((sum, d) => sum + (Number(d.amountCollected) || 0), 0),
    [upiDeliveries]
  );

  const totalDuePending = useMemo(
    () => customers.reduce((sum, c) => sum + (Number(c.dueAmount) || 0), 0),
    [customers]
  );

  const totalJarsInCirculation = useMemo(
    () => customers.reduce((sum, c) => sum + (Number(c.jarsHolding) || 0), 0),
    [customers]
  );

  const customersWithDues = useMemo(
    () => customers.filter((c) => Number(c.dueAmount) > 0).length,
    [customers]
  );

  const totalTodayRevenue = totalCashRevenue + totalUpiRevenue;
  const returnRatePercent =
    totalDeliveredToday > 0 ? Math.round((totalEmptiesToday / totalDeliveredToday) * 100) : null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
      {/* 1. Jars Dispatched */}
      <CardSpotlight
        spotlightColor="rgba(2, 132, 199, 0.08)"
        className="p-3.5 sm:p-5 border border-slate-200/90 shadow-2xs hover:shadow-md transition-all duration-200 ease-out hover:-translate-y-1 hover:border-slate-300 active:translate-y-0 active:scale-[0.99] relative overflow-hidden flex flex-col justify-between"
      >
        {/* Crisp subtle top accent line */}
        <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-sky-500 to-sky-400" />
        
        <div>
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] sm:text-xs font-bold text-slate-600 uppercase tracking-wider truncate">
              {t.kpi.todayDispatch}
            </span>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center border border-sky-200/80 shadow-2xs shrink-0">
              <Truck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>

          <div className="mt-2.5 sm:mt-3.5">
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight font-mono tabular-nums leading-none">
                {totalDeliveredToday.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {t.kpi.jars}
              </span>
            </div>
          </div>
        </div>

        {/* Clean unboxed secondary metadata */}
        <div className="text-[10px] sm:text-xs text-slate-600 mt-2 sm:mt-2.5 flex items-center gap-1 sm:gap-1.5 flex-wrap font-medium leading-normal">
          <span className="text-emerald-700 font-mono tabular-nums font-semibold">
            {totalEmptiesToday}
          </span>
          <span>{t.kpi.emptiesReturned}</span>
          {returnRatePercent !== null && (
            <>
              <span className="text-slate-300 font-bold" aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-slate-500">
                {returnRatePercent}% {t.kpi.returnRate}
              </span>
            </>
          )}
        </div>
      </CardSpotlight>

      {/* 2. Cash Collection */}
      <CardSpotlight
        spotlightColor="rgba(16, 185, 129, 0.08)"
        className="p-3.5 sm:p-5 border border-slate-200/90 shadow-2xs hover:shadow-md transition-all duration-200 ease-out hover:-translate-y-1 hover:border-slate-300 active:translate-y-0 active:scale-[0.99] relative overflow-hidden flex flex-col justify-between"
      >
        {/* Crisp subtle top accent line */}
        <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-emerald-500 to-emerald-400" />

        <div>
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] sm:text-xs font-bold text-slate-600 uppercase tracking-wider truncate">
              {t.kpi.cashCollected}
            </span>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200/80 shadow-2xs shrink-0">
              <IndianRupee className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>

          <div className="mt-2.5 sm:mt-3.5">
            <div className="flex items-baseline">
              <span className="text-base sm:text-xl lg:text-2xl font-bold mr-0.5 text-slate-700 font-sans leading-none">₹</span>
              <span className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight font-mono tabular-nums leading-none">
                {totalCashRevenue.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>

        {/* Clean unboxed secondary metadata */}
        <div className="text-[10px] sm:text-xs text-slate-600 mt-2 sm:mt-2.5 flex items-center gap-1 sm:gap-1.5 flex-wrap font-medium leading-normal">
          <span className="font-mono tabular-nums text-slate-800 font-semibold">
            {cashDeliveries.length}
          </span>
          <span>{t.kpi.cashDrops}</span>
          {totalTodayRevenue > 0 && (
            <>
              <span className="text-slate-300 font-bold" aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-slate-500">
                {Math.round((totalCashRevenue / totalTodayRevenue) * 100)}% {isGujarati ? 'હિસ્સો' : 'share'}
              </span>
            </>
          )}
        </div>
      </CardSpotlight>

      {/* 3. UPI / Digital Revenue */}
      <CardSpotlight
        spotlightColor="rgba(99, 102, 241, 0.08)"
        className="p-3.5 sm:p-5 border border-slate-200/90 shadow-2xs hover:shadow-md transition-all duration-200 ease-out hover:-translate-y-1 hover:border-slate-300 active:translate-y-0 active:scale-[0.99] relative overflow-hidden flex flex-col justify-between"
      >
        {/* Crisp subtle top accent line */}
        <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-indigo-500 to-indigo-400" />

        <div>
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] sm:text-xs font-bold text-slate-600 uppercase tracking-wider truncate">
              {t.kpi.upiPayments}
            </span>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-200/80 shadow-2xs shrink-0">
              <QrCode className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>

          <div className="mt-2.5 sm:mt-3.5">
            <div className="flex items-baseline">
              <span className="text-base sm:text-xl lg:text-2xl font-bold mr-0.5 text-slate-700 font-sans leading-none">₹</span>
              <span className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight font-mono tabular-nums leading-none">
                {totalUpiRevenue.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>

        {/* Clean unboxed secondary metadata */}
        <div className="text-[10px] sm:text-xs text-slate-600 mt-2 sm:mt-2.5 flex items-center gap-1 sm:gap-1.5 flex-wrap font-medium leading-normal">
          <span className="font-mono tabular-nums text-slate-800 font-semibold">
            {upiDeliveries.length}
          </span>
          <span>{t.kpi.digitalSettlements}</span>
          {totalTodayRevenue > 0 && (
            <>
              <span className="text-slate-300 font-bold" aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-slate-500">
                {Math.round((totalUpiRevenue / totalTodayRevenue) * 100)}% {isGujarati ? 'ડિજિટલ' : 'digital'}
              </span>
            </>
          )}
        </div>
      </CardSpotlight>

      {/* 4. Pending Receivables */}
      <CardSpotlight
        spotlightColor="rgba(245, 158, 11, 0.09)"
        className="p-3.5 sm:p-5 border border-slate-200/90 shadow-2xs hover:shadow-md transition-all duration-200 ease-out hover:-translate-y-1 hover:border-slate-300 active:translate-y-0 active:scale-[0.99] relative overflow-hidden flex flex-col justify-between"
      >
        {/* Crisp subtle top accent line */}
        <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-amber-500 to-amber-400" />

        <div>
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] sm:text-xs font-bold text-slate-600 uppercase tracking-wider truncate">
              {t.kpi.pendingReceivables}
            </span>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200/80 shadow-2xs shrink-0">
              <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>

          <div className="mt-2.5 sm:mt-3.5">
            <div className="flex items-baseline">
              <span className="text-base sm:text-xl lg:text-2xl font-bold mr-0.5 text-amber-600 font-sans leading-none">₹</span>
              <span className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-amber-700 tracking-tight font-mono tabular-nums leading-none">
                {totalDuePending.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>

        {/* Clean unboxed secondary metadata */}
        <div className="text-[10px] sm:text-xs text-slate-600 mt-2 sm:mt-2.5 flex items-center gap-1 sm:gap-1.5 flex-wrap font-medium leading-normal">
          <span className="font-mono tabular-nums text-slate-800 font-semibold">
            {totalJarsInCirculation}
          </span>
          <span>{t.kpi.jarsHoldingCount}</span>
          <span className="text-slate-300 font-bold" aria-hidden="true">·</span>
          <span className="font-mono tabular-nums text-slate-800 font-semibold">
            {customersWithDues}
          </span>
          <span>{isGujarati ? 'બાકી ખાતાઓ' : `of ${customers.length} accounts`}</span>
        </div>
      </CardSpotlight>
    </div>
  );
};
