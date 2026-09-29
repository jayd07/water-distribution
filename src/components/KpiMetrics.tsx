import React from 'react';
import { Truck, IndianRupee, QrCode, AlertCircle } from 'lucide-react';
import { Customer, DeliveryLog } from '../types';

interface KpiMetricsProps {
  todayDeliveries: DeliveryLog[];
  customers: Customer[];
}

export const KpiMetrics: React.FC<KpiMetricsProps> = ({ todayDeliveries, customers }) => {
  const totalDeliveredToday = todayDeliveries.reduce((sum, d) => sum + (Number(d.jarsDelivered) || 0), 0);
  const totalEmptiesToday = todayDeliveries.reduce((sum, d) => sum + (Number(d.emptyJarsCollected) || 0), 0);
  
  const totalCashRevenue = todayDeliveries
    .filter(d => d.paymentMode === 'CASH')
    .reduce((sum, d) => sum + (Number(d.amountCollected) || 0), 0);

  const totalUpiRevenue = todayDeliveries
    .filter(d => d.paymentMode === 'UPI')
    .reduce((sum, d) => sum + (Number(d.amountCollected) || 0), 0);

  const totalDuePending = customers.reduce((sum, c) => sum + (Number(c.dueAmount) || 0), 0);
  const totalJarsInCirculation = customers.reduce((sum, c) => sum + (Number(c.jarsHolding) || 0), 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Jars Dispatched */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500">Today's Dispatch</span>
          <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
            <Truck className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            {totalDeliveredToday} <span className="text-sm font-normal text-slate-500">jars</span>
          </div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
            <span className="font-medium text-emerald-600">{totalEmptiesToday} empties returned</span>
          </div>
        </div>
      </div>

      {/* Cash Collection */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500">Cash Collected</span>
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <IndianRupee className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            ₹{totalCashRevenue.toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {todayDeliveries.filter(d => d.paymentMode === 'CASH').length} cash drops recorded
          </div>
        </div>
      </div>

      {/* UPI / Digital Revenue */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500">UPI Payments</span>
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <QrCode className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            ₹{totalUpiRevenue.toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {todayDeliveries.filter(d => d.paymentMode === 'UPI').length} digital settlements
          </div>
        </div>
      </div>

      {/* Outstanding Dues */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500">Pending Receivables</span>
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <AlertCircle className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-2xl font-bold text-amber-600 tracking-tight">
            ₹{totalDuePending.toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {totalJarsInCirculation} jars across {customers.length} accounts
          </div>
        </div>
      </div>
    </div>
  );
};
