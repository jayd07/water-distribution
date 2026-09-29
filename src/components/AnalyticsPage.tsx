import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  TrendingUp,
  DollarSign,
  Package,
  RotateCcw,
  Calendar,
  CreditCard,
  Building2,
  Home,
  Download,
  Database,
  ArrowUpRight,
  Sparkles,
  Search,
  CheckCircle2,
  Filter,
  BarChart3,
  Wallet,
  FileSpreadsheet,
  ExternalLink,
  AlertCircle,
  X,
  Check
} from 'lucide-react';
import { DeliveryLog, TransactionRecord, Customer, InventoryItem, OrderBooking, BusinessAccount, ActiveTab } from '../types';
import { 
  signInWithGoogleSheets, 
  syncLogsToGoogleSheet, 
  extractSpreadsheetId, 
  getCachedSheetsToken 
} from '../services/googleSheetsService';

interface AnalyticsPageProps {
  deliveries: DeliveryLog[];
  transactions: TransactionRecord[];
  customers: Customer[];
  inventory: InventoryItem[];
  orders?: OrderBooking[];
  currentBusiness?: BusinessAccount;
  onNavigateToTab?: (tab: ActiveTab) => void;
  onOpenExportAccounting?: () => void;
  onOpenBusinessProfile?: () => void;
}

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({
  deliveries,
  transactions,
  customers,
  inventory,
  orders = [],
  currentBusiness,
  onNavigateToTab,
  onOpenExportAccounting,
  onOpenBusinessProfile
}) => {
  const [dateRange, setDateRange] = useState<30 | 14 | 7>(30);
  const [revenueView, setRevenueView] = useState<'daily' | 'cumulative'>('daily');
  const [txFilterMode, setTxFilterMode] = useState<string>('ALL');
  const [txSearchQuery, setTxSearchQuery] = useState('');

  // Google Sheets Sync State
  const [isGoogleSheetsSyncOpen, setIsGoogleSheetsSyncOpen] = useState(false);
  const [sheetIdInput, setSheetIdInput] = useState<string>(() => 
    currentBusiness?.googleSheetsUrl || currentBusiness?.googleSheetId || localStorage.getItem('aquapure_saved_sheet_id') || ''
  );
  const [isSyncingSheets, setIsSyncingSheets] = useState(false);
  const [sheetsSyncResult, setSheetsSyncResult] = useState<{ rowsSynced: number; message: string; spreadsheetUrl: string } | null>(null);
  const [sheetsError, setSheetsError] = useState<string | null>(null);

  useEffect(() => {
    if (currentBusiness?.googleSheetsUrl || currentBusiness?.googleSheetId) {
      setSheetIdInput(currentBusiness.googleSheetsUrl || currentBusiness.googleSheetId || '');
    }
  }, [currentBusiness]);

  const handleSyncToGoogleSheets = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!sheetIdInput.trim()) {
      setSheetsError('Please enter a Google Sheet ID or URL.');
      return;
    }

    setIsSyncingSheets(true);
    setSheetsError(null);
    setSheetsSyncResult(null);

    try {
      let token = getCachedSheetsToken();
      if (!token) {
        const authRes = await signInWithGoogleSheets();
        token = authRes.accessToken;
      }

      const result = await syncLogsToGoogleSheet(
        sheetIdInput,
        deliveries,
        transactions,
        customers,
        currentBusiness,
        token
      );

      localStorage.setItem('aquapure_saved_sheet_id', extractSpreadsheetId(sheetIdInput));
      setSheetsSyncResult(result);
    } catch (err: any) {
      setSheetsError(err?.message || 'Failed to sync with Google Sheets. Please check permissions and Sheet ID.');
    } finally {
      setIsSyncingSheets(false);
    }
  };

  // 1. Calculate the active time window (e.g. last 30 days)
  const { startDate, endDate, daysArray } = useMemo(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date(end.getTime() - (dateRange - 1) * 86400000);
    start.setHours(0, 0, 0, 0);

    const days: { dateKey: string; displayDate: string; timestamp: number }[] = [];
    for (let i = 0; i < dateRange; i++) {
      const d = new Date(start.getTime() + i * 86400000);
      const dateKey = d.toISOString().split('T')[0];
      const displayDate = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      days.push({
        dateKey,
        displayDate,
        timestamp: d.getTime()
      });
    }

    return { startDate: start.getTime(), endDate: end.getTime(), daysArray: days };
  }, [dateRange]);

  // 2. Filter records within the selected date range
  const filteredDeliveries = useMemo(() => {
    return deliveries.filter(d => d.timestamp >= startDate && d.timestamp <= endDate);
  }, [deliveries, startDate, endDate]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => t.timestamp >= startDate && t.timestamp <= endDate);
  }, [transactions, startDate, endDate]);

  // 3. Aggregate daily metrics for Recharts
  const dailyChartData = useMemo(() => {
    const map = new Map<string, {
      jarsDelivered: number;
      emptyCollected: number;
      trips: number;
      deliveryRevenue: number;
      settledRevenue: number;
      upiSettled: number;
      cashSettled: number;
      bankSettled: number;
      dueClearances: number;
      refillSettlements: number;
    }>();

    daysArray.forEach(day => {
      map.set(day.dateKey, {
        jarsDelivered: 0,
        emptyCollected: 0,
        trips: 0,
        deliveryRevenue: 0,
        settledRevenue: 0,
        upiSettled: 0,
        cashSettled: 0,
        bankSettled: 0,
        dueClearances: 0,
        refillSettlements: 0
      });
    });

    // Populate deliveries
    filteredDeliveries.forEach(deliv => {
      const dKey = new Date(deliv.timestamp).toISOString().split('T')[0];
      const entry = map.get(dKey);
      if (entry) {
        entry.jarsDelivered += deliv.jarsDelivered || 0;
        entry.emptyCollected += deliv.emptyJarsCollected || 0;
        entry.trips += 1;
        entry.deliveryRevenue += deliv.amountCollected || 0;
      }
    });

    // Populate transactions (settled revenue)
    filteredTransactions.forEach(tx => {
      const dKey = new Date(tx.timestamp).toISOString().split('T')[0];
      const entry = map.get(dKey);
      if (entry) {
        entry.settledRevenue += tx.amount || 0;
        if (tx.paymentMode === 'UPI') {
          entry.upiSettled += tx.amount || 0;
        } else if (tx.paymentMode === 'CASH') {
          entry.cashSettled += tx.amount || 0;
        } else if (tx.paymentMode === 'BANK_TRANSFER') {
          entry.bankSettled += tx.amount || 0;
        }

        if (tx.type === 'DUE_CLEARANCE') {
          entry.dueClearances += tx.amount || 0;
        } else {
          entry.refillSettlements += tx.amount || 0;
        }
      }
    });

    let runningCumulative = 0;
    return daysArray.map(day => {
      const data = map.get(day.dateKey) || {
        jarsDelivered: 0,
        emptyCollected: 0,
        trips: 0,
        deliveryRevenue: 0,
        settledRevenue: 0,
        upiSettled: 0,
        cashSettled: 0,
        bankSettled: 0,
        dueClearances: 0,
        refillSettlements: 0
      };

      runningCumulative += data.settledRevenue;
      const returnRatio = data.jarsDelivered > 0 
        ? Math.min(100, Math.round((data.emptyCollected / data.jarsDelivered) * 100))
        : 100;

      return {
        date: day.dateKey,
        displayDate: day.displayDate,
        jarsDelivered: data.jarsDelivered,
        emptyCollected: data.emptyCollected,
        trips: data.trips,
        returnRate: returnRatio,
        settledRevenue: data.settledRevenue,
        upiSettled: data.upiSettled,
        cashSettled: data.cashSettled,
        bankSettled: data.bankSettled,
        dueClearances: data.dueClearances,
        cumulativeRevenue: runningCumulative
      };
    });
  }, [daysArray, filteredDeliveries, filteredTransactions]);

  // 4. Overall Key Performance Indicators (KPIs)
  const kpis = useMemo(() => {
    const totalJarsDelivered = filteredDeliveries.reduce((sum, d) => sum + (d.jarsDelivered || 0), 0);
    const totalEmptyCollected = filteredDeliveries.reduce((sum, d) => sum + (d.emptyJarsCollected || 0), 0);
    const totalTrips = filteredDeliveries.length;
    const returnEfficiency = totalJarsDelivered > 0 
      ? Math.round((totalEmptyCollected / totalJarsDelivered) * 1000) / 10 
      : 100;

    const totalSettledRevenue = filteredTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    const upiRevenue = filteredTransactions
      .filter(t => t.paymentMode === 'UPI')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    const cashRevenue = filteredTransactions
      .filter(t => t.paymentMode === 'CASH')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    const bankRevenue = filteredTransactions
      .filter(t => t.paymentMode === 'BANK_TRANSFER')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    const dueClearanceRevenue = filteredTransactions
      .filter(t => t.type === 'DUE_CLEARANCE')
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const averageDailyRevenue = Math.round(totalSettledRevenue / dateRange);
    const averageTxValue = filteredTransactions.length > 0 
      ? Math.round(totalSettledRevenue / filteredTransactions.length) 
      : 0;
    const averageJarsPerDay = Math.round((totalJarsDelivered / dateRange) * 10) / 10;

    // Peak delivery day
    let peakDay = { date: 'N/A', jars: 0 };
    dailyChartData.forEach(d => {
      if (d.jarsDelivered > peakDay.jars) {
        peakDay = { date: d.displayDate, jars: d.jarsDelivered };
      }
    });

    return {
      totalJarsDelivered,
      totalEmptyCollected,
      totalTrips,
      returnEfficiency,
      totalSettledRevenue,
      upiRevenue,
      cashRevenue,
      bankRevenue,
      dueClearanceRevenue,
      averageDailyRevenue,
      averageTxValue,
      averageJarsPerDay,
      peakDay
    };
  }, [filteredDeliveries, filteredTransactions, dateRange, dailyChartData]);

  // 5. Payment Mode Distribution for Pie Chart
  const paymentModeData = useMemo(() => {
    return [
      { name: 'UPI Digital', value: kpis.upiRevenue, color: '#0284c7' }, // Sky 600
      { name: 'Cash', value: kpis.cashRevenue, color: '#d97706' }, // Amber 600
      { name: 'Bank Transfer', value: kpis.bankRevenue, color: '#8b5cf6' } // Purple 500
    ].filter(p => p.value > 0);
  }, [kpis]);

  // 6. Product / Item Breakdown
  const productDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    filteredDeliveries.forEach(d => {
      const type = d.itemType || '20L Normal Water Jar';
      counts.set(type, (counts.get(type) || 0) + (d.jarsDelivered || 0));
    });

    return Array.from(counts.entries()).map(([name, count]) => ({
      name: name.replace('20L ', '').replace('Water Jar', 'Jar'),
      fullName: name,
      count
    })).sort((a, b) => b.count - a.count);
  }, [filteredDeliveries]);

  // 7. Customer Type Breakdown (Commercial vs Residential)
  const customerTypeStats = useMemo(() => {
    const custTypeMap = new Map<string, 'RESIDENTIAL' | 'COMMERCIAL'>();
    customers.forEach(c => custTypeMap.set(c.id, c.customerType));

    let commercialJars = 0;
    let residentialJars = 0;
    let commercialRevenue = 0;
    let residentialRevenue = 0;

    filteredDeliveries.forEach(d => {
      const type = custTypeMap.get(d.customerId) || 'RESIDENTIAL';
      if (type === 'COMMERCIAL') {
        commercialJars += d.jarsDelivered || 0;
        commercialRevenue += d.amountCollected || 0;
      } else {
        residentialJars += d.jarsDelivered || 0;
        residentialRevenue += d.amountCollected || 0;
      }
    });

    return {
      commercialJars,
      residentialJars,
      commercialRevenue,
      residentialRevenue
    };
  }, [customers, filteredDeliveries]);

  // 8. Filtered Settled Transactions for Table
  const recentSettledTransactions = useMemo(() => {
    return filteredTransactions.filter(tx => {
      if (txFilterMode !== 'ALL' && tx.paymentMode !== txFilterMode) return false;
      if (txSearchQuery.trim()) {
        const q = txSearchQuery.toLowerCase();
        return (
          (tx.customerName || '').toLowerCase().includes(q) ||
          (tx.notes || '').toLowerCase().includes(q) ||
          (tx.id || '').toLowerCase().includes(q)
        );
      }
      return true;
    }).slice(0, 15);
  }, [filteredTransactions, txFilterMode, txSearchQuery]);

  // CSV Export Handler
  const handleExportCSV = () => {
    const headers = ['Date', 'Jars Delivered', 'Empty Jars Collected', 'Delivery Trips', 'Settled Revenue (INR)', 'UPI (INR)', 'Cash (INR)', 'Return Rate (%)'];
    const rows = dailyChartData.map(d => [
      d.date,
      d.jarsDelivered,
      d.emptyCollected,
      d.trips,
      d.settledRevenue,
      d.upiSettled,
      d.cashSettled,
      `${d.returnRate}%`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + 
      [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Analytics_${dateRange}Days_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner & Date Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-xs">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Delivery & Revenue Analytics</h1>
              <p className="text-xs text-slate-500">
                Visualizing jar deliveries, bottle circulation, and settled revenue for <span className="font-semibold text-slate-700">{currentBusiness?.name}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Date Filter & Quick Actions */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* 30D / 14D / 7D Range Pills */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200/80">
            <button
              onClick={() => setDateRange(7)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                dateRange === 7 
                  ? 'bg-white text-slate-900 shadow-2xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Last 7 Days
            </button>
            <button
              onClick={() => setDateRange(14)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                dateRange === 14 
                  ? 'bg-white text-slate-900 shadow-2xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Last 14 Days
            </button>
            <button
              onClick={() => setDateRange(30)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                dateRange === 30 
                  ? 'bg-white text-sky-800 shadow-2xs font-bold' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Last 30 Days
            </button>
          </div>

          {/* Export CSV (Range Summary) */}
          <button
            onClick={handleExportCSV}
            title="Download 30-day aggregate CSV report"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200/80 border border-slate-200/80 rounded-xl transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>

          {/* Export to Google Sheets Action */}
          <button
            onClick={() => setIsGoogleSheetsSyncOpen(true)}
            id="analytics-export-google-sheets-btn"
            title="Export & sync delivery and transaction logs to Google Sheets"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl transition-all cursor-pointer shadow-2xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export to Sheets</span>
          </button>

          {/* Daily Accounting Day Book CSV */}
          {onOpenExportAccounting && (
            <button
              onClick={onOpenExportAccounting}
              id="analytics-export-accounting-csv-btn"
              title="Export formatted day book & transaction log for external accounting"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100/90 border border-emerald-200/90 rounded-xl transition-all cursor-pointer shadow-2xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Daily Accounting CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Settled Revenue */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-sm transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Settled Revenue</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">
              ₹{kpis.totalSettledRevenue.toLocaleString('en-IN')}
            </span>
            <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
              Settled
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>UPI: <strong className="text-slate-800">₹{kpis.upiRevenue.toLocaleString('en-IN')}</strong></span>
            <span>Cash: <strong className="text-slate-800">₹{kpis.cashRevenue.toLocaleString('en-IN')}</strong></span>
          </div>
        </div>

        {/* KPI 2: Total Jars Delivered */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-sm transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Jars Delivered</span>
            <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">
              {kpis.totalJarsDelivered.toLocaleString('en-IN')} <span className="text-sm font-semibold text-slate-500">Jars</span>
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>{kpis.totalTrips} Dispatches</span>
            <span>Avg: <strong className="text-slate-800">{kpis.averageJarsPerDay} jars/day</strong></span>
          </div>
        </div>

        {/* KPI 3: Bottle Return Efficiency */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-sm transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Bottle Return Rate</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-100 text-cyan-700 flex items-center justify-center">
              <RotateCcw className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">
              {kpis.returnEfficiency}%
            </span>
            <span className="text-[11px] font-medium text-cyan-800 bg-cyan-50 px-1.5 py-0.5 rounded">
              Rotation
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Collected: <strong className="text-slate-800">{kpis.totalEmptyCollected} empty</strong></span>
            <span>Active in Market: <strong className="text-slate-800">{Math.max(0, kpis.totalJarsDelivered - kpis.totalEmptyCollected)}</strong></span>
          </div>
        </div>

        {/* KPI 4: Due Recovery & Daily Run Rate */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-sm transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Daily Run Rate</span>
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">
              ₹{kpis.averageDailyRevenue.toLocaleString('en-IN')}
            </span>
            <span className="text-xs text-slate-500 font-medium">/ day</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Peak Day: <strong className="text-slate-800">{kpis.peakDay.date} ({kpis.peakDay.jars} jars)</strong></span>
          </div>
        </div>
      </div>

      {/* Main Charts Row 1: Delivery Trends (Last 30 Days) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Package className="w-4 h-4 text-sky-600" />
              <span>Daily Delivery Trends ({dateRange} Days)</span>
            </h2>
            <p className="text-xs text-slate-500">
              Jars delivered vs empty jars returned back to warehouse per day
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-sky-500"></span>
              <span className="text-slate-700">Jars Delivered</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-emerald-500"></span>
              <span className="text-slate-700">Empty Bottles Collected</span>
            </div>
          </div>
        </div>

        <div className="h-72 w-full mt-5">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorJars" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0284c7" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorEmpty" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis 
                dataKey="displayDate" 
                tick={{ fontSize: 11, fill: '#64748b' }} 
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
                interval={dateRange === 30 ? 3 : 1}
              />
              <YAxis 
                tick={{ fontSize: 11, fill: '#64748b' }} 
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#ffffff', 
                  borderRadius: '12px', 
                  border: '1px solid #e2e8f0', 
                  boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                  fontSize: '12px'
                }}
                formatter={(value: any, name: any) => {
                  if (name === 'jarsDelivered') return [`${value} jars`, 'Delivered'];
                  if (name === 'emptyCollected') return [`${value} jars`, 'Collected'];
                  return [value, name];
                }}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Area 
                type="monotone" 
                dataKey="jarsDelivered" 
                name="jarsDelivered"
                stroke="#0284c7" 
                strokeWidth={2.5}
                fillOpacity={1} 
                fill="url(#colorJars)" 
              />
              <Area 
                type="monotone" 
                dataKey="emptyCollected" 
                name="emptyCollected"
                stroke="#10b981" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorEmpty)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Main Charts Row 2: Revenue from Settled Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Revenue Breakdown & Trend */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <span>Settled Transaction Revenue (₹)</span>
              </h2>
              <p className="text-xs text-slate-500">
                Direct refill settlements and outstanding due clearances
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="inline-flex p-0.5 bg-slate-100 rounded-lg text-xs font-medium">
                <button
                  onClick={() => setRevenueView('daily')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    revenueView === 'daily' 
                      ? 'bg-white text-slate-900 font-bold shadow-2xs' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Daily Breakdown
                </button>
                <button
                  onClick={() => setRevenueView('cumulative')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    revenueView === 'cumulative' 
                      ? 'bg-white text-slate-900 font-bold shadow-2xs' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Cumulative Growth
                </button>
              </div>
            </div>
          </div>

          <div className="h-72 w-full mt-5">
            <ResponsiveContainer width="100%" height="100%">
              {revenueView === 'daily' ? (
                <BarChart data={dailyChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis 
                    dataKey="displayDate" 
                    tick={{ fontSize: 11, fill: '#64748b' }} 
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                    interval={dateRange === 30 ? 3 : 1}
                  />
                  <YAxis 
                    tick={{ fontSize: 11, fill: '#64748b' }} 
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `₹${val}`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#ffffff', 
                      borderRadius: '12px', 
                      border: '1px solid #e2e8f0', 
                      boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                      fontSize: '12px'
                    }}
                    formatter={(val: any, name: any) => {
                      if (name === 'upiSettled') return [`₹${Number(val).toLocaleString('en-IN')}`, 'UPI Payment'];
                      if (name === 'cashSettled') return [`₹${Number(val).toLocaleString('en-IN')}`, 'Cash Payment'];
                      if (name === 'bankSettled') return [`₹${Number(val).toLocaleString('en-IN')}`, 'Bank Transfer'];
                      return [`₹${Number(val).toLocaleString('en-IN')}`, name];
                    }}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Legend 
                    verticalAlign="top" 
                    height={36} 
                    iconType="circle"
                    formatter={(value) => {
                      if (value === 'upiSettled') return 'UPI (GPay / Paytm)';
                      if (value === 'cashSettled') return 'Cash on Delivery';
                      if (value === 'bankSettled') return 'Bank NEFT/RTGS';
                      return value;
                    }}
                  />
                  <Bar dataKey="upiSettled" name="upiSettled" stackId="revenue" fill="#0284c7" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="cashSettled" name="cashSettled" stackId="revenue" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="bankSettled" name="bankSettled" stackId="revenue" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : (
                <LineChart data={dailyChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis 
                    dataKey="displayDate" 
                    tick={{ fontSize: 11, fill: '#64748b' }} 
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                    interval={dateRange === 30 ? 3 : 1}
                  />
                  <YAxis 
                    tick={{ fontSize: 11, fill: '#64748b' }} 
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `₹${val >= 1000 ? `${(val/1000).toFixed(1)}k` : val}`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#ffffff', 
                      borderRadius: '12px', 
                      border: '1px solid #e2e8f0', 
                      boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                      fontSize: '12px'
                    }}
                    formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Cumulative Settled Revenue']}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="cumulativeRevenue" 
                    stroke="#10b981" 
                    strokeWidth={3} 
                    dot={{ fill: '#10b981', r: 3 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right 1 Col: Payment Mode Share (Pie Chart) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-sky-600" />
              <span>Settlement Modes</span>
            </h2>
            <p className="text-xs text-slate-500">
              Share of collections across digital UPI vs Cash
            </p>

            <div className="h-48 w-full mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentModeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {paymentModeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Settled']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Payment Breakdown Cards */}
          <div className="space-y-2 mt-4 pt-3 border-t border-slate-100">
            {paymentModeData.map(item => {
              const pct = kpis.totalSettledRevenue > 0 
                ? Math.round((item.value / kpis.totalSettledRevenue) * 100) 
                : 0;
              return (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></span>
                    <span className="font-medium text-slate-700">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">₹{item.value.toLocaleString('en-IN')}</span>
                    <span className="text-[10px] text-slate-400">({pct}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Row 3: Product Breakdown & Client Segments */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Product Delivery Volume Breakdown */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Package className="w-4 h-4 text-cyan-600" />
            <span>Volume by Item Category</span>
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Most dispatched jar types and units over the last {dateRange} days
          </p>

          <div className="space-y-3.5">
            {productDistribution.map(item => {
              const totalJars = kpis.totalJarsDelivered || 1;
              const pct = Math.round((item.count / totalJars) * 100);
              return (
                <div key={item.fullName} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">{item.fullName}</span>
                    <span className="font-bold text-slate-900">{item.count} units ({pct}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-cyan-600 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Customer Segment Breakdown: Commercial vs Residential */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-sky-600" />
              <span>Customer Segmentation</span>
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Comparing commercial tech parks/gyms vs residential flats
            </p>

            <div className="grid grid-cols-2 gap-3">
              {/* Commercial Box */}
              <div className="p-4 rounded-xl bg-sky-50/70 border border-sky-200/80">
                <div className="flex items-center gap-2 text-sky-900 font-bold text-xs">
                  <Building2 className="w-4 h-4 text-sky-700" />
                  <span>Commercial Clients</span>
                </div>
                <div className="mt-2 text-xl font-extrabold text-sky-950">
                  {customerTypeStats.commercialJars} <span className="text-xs font-semibold text-sky-700">Jars</span>
                </div>
                <div className="text-[11px] text-sky-800 mt-1">
                  Revenue: <strong>₹{customerTypeStats.commercialRevenue.toLocaleString('en-IN')}</strong>
                </div>
              </div>

              {/* Residential Box */}
              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/80">
                <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                  <Home className="w-4 h-4 text-emerald-700" />
                  <span>Residential Societies</span>
                </div>
                <div className="mt-2 text-xl font-extrabold text-emerald-950">
                  {customerTypeStats.residentialJars} <span className="text-xs font-semibold text-emerald-700">Jars</span>
                </div>
                <div className="text-[11px] text-emerald-800 mt-1">
                  Revenue: <strong>₹{customerTypeStats.residentialRevenue.toLocaleString('en-IN')}</strong>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Enterprise accounts order higher jar volumes with bi-weekly settlements</span>
            {onNavigateToTab && (
              <button 
                onClick={() => onNavigateToTab('customers')} 
                className="text-sky-600 font-semibold hover:underline cursor-pointer"
              >
                View Clients →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Row 4: Settled Transactions Audit Table */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Settled Transactions Log ({dateRange} Days)</span>
            </h2>
            <p className="text-xs text-slate-500">
              Verified financial records from cash collected, UPI payments, and due clearances
            </p>
          </div>

          {/* Search & Mode Filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search transaction..."
                value={txSearchQuery}
                onChange={(e) => setTxSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 text-slate-800"
              />
            </div>

            <select
              value={txFilterMode}
              onChange={(e) => setTxFilterMode(e.target.value)}
              className="text-xs py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 cursor-pointer"
            >
              <option value="ALL">All Modes</option>
              <option value="UPI">UPI Only</option>
              <option value="CASH">Cash Only</option>
              <option value="BANK_TRANSFER">Bank Only</option>
            </select>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-500 font-semibold">
                <th className="pb-3 px-3">Date & Time</th>
                <th className="pb-3 px-3">Customer</th>
                <th className="pb-3 px-3">Type</th>
                <th className="pb-3 px-3">Mode</th>
                <th className="pb-3 px-3 text-right">Settled Amount</th>
                <th className="pb-3 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentSettledTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No transactions recorded matching the selected filter criteria.
                  </td>
                </tr>
              ) : (
                recentSettledTransactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                      {new Date(tx.timestamp).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">
                      {tx.customerName || 'Direct Refill Client'}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded-md font-medium text-[11px] ${
                        tx.type === 'DUE_CLEARANCE'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-sky-100 text-sky-800'
                      }`}>
                        {tx.type === 'DUE_CLEARANCE' ? 'Due Clearance' : 'Refill Payment'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded-md font-semibold text-[10px] ${
                        tx.paymentMode === 'UPI'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : tx.paymentMode === 'CASH'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-purple-50 text-purple-700 border border-purple-200'
                      }`}>
                        {tx.paymentMode}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-extrabold text-slate-900 whitespace-nowrap">
                      ₹{tx.amount.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Settled</span>
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Google Sheets Sync Modal */}
      {isGoogleSheetsSyncOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div 
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col text-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Sync to Google Sheets</h3>
                  <p className="text-[11px] text-slate-400">Export deliveries & transactions directly to your Spreadsheet</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsGoogleSheetsSyncOpen(false);
                  setSheetsError(null);
                  setSheetsSyncResult(null);
                }}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSyncToGoogleSheets} className="p-5 space-y-4 text-xs">
              {sheetsError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{sheetsError}</span>
                </div>
              )}

              {sheetsSyncResult && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 font-bold text-emerald-800">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{sheetsSyncResult.message}</span>
                  </div>
                  <a
                    href={sheetsSyncResult.spreadsheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 underline"
                  >
                    <span>Open Spreadsheet in Google Sheets</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block mb-1">
                  Google Spreadsheet ID or URL
                </label>
                <input
                  type="text"
                  value={sheetIdInput}
                  onChange={(e) => setSheetIdInput(e.target.value)}
                  placeholder="e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms or paste full URL"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  required
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Paste your Google Sheet's URL or ID. Make sure your account has edit permissions on the sheet.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-600 space-y-1">
                <span className="font-bold text-slate-800 block">What gets exported?</span>
                <p>• <strong>{deliveries.length}</strong> Dispatch & Delivery Log entries</p>
                <p>• <strong>{transactions.length}</strong> Payment & Due Settlement records</p>
                <p>• Full financial columns, timestamps, customer details, and payment modes</p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsGoogleSheetsSyncOpen(false);
                    setSheetsError(null);
                    setSheetsSyncResult(null);
                  }}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl transition-colors cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isSyncingSheets}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  {isSyncingSheets ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
                      <span>Syncing with Google...</span>
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Sync to Google Sheet</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
