import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  Download, 
  Copy, 
  Check, 
  Calendar, 
  FileSpreadsheet, 
  Truck, 
  DollarSign, 
  RotateCcw, 
  CreditCard,
  Building2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  Cloud,
  CloudCheck,
  RefreshCw,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import { DeliveryLog, TransactionRecord, BusinessAccount, Customer } from '../types';
import { 
  formatDateToYYYYMMDD, 
  isTimestampOnDate,
  computeDayAccountingSummary, 
  generateUnifiedDayBookCSV, 
  generateDeliveriesCSV, 
  generateTransactionsCSV, 
  downloadCSV, 
  copyCSVToClipboard,
  AccountingExportType 
} from '../utils/csvExport';
import {
  getSheetsBackupConfig,
  saveSheetsBackupConfig,
  signInWithGoogleSheets,
  syncLogsToGoogleSheet,
  getCachedSheetsToken,
  SheetsBackupConfig
} from '../services/googleSheetsService';

interface ExportAccountingModalProps {
  isOpen: boolean;
  onClose: () => void;
  deliveries: DeliveryLog[];
  transactions: TransactionRecord[];
  customers: Customer[];
  business?: BusinessAccount;
  initialDate?: string;
  onToast?: (message: string) => void;
}

export const ExportAccountingModal: React.FC<ExportAccountingModalProps> = ({
  isOpen,
  onClose,
  deliveries,
  transactions,
  customers,
  business,
  initialDate,
  onToast
}) => {
  const todayStr = useMemo(() => formatDateToYYYYMMDD(new Date()), []);
  const [activeTab, setActiveTab] = useState<'CSV' | 'GOOGLE_SHEETS'>('CSV');
  const [selectedDate, setSelectedDate] = useState<string>(initialDate || todayStr);
  const [exportType, setExportType] = useState<AccountingExportType>('COMBINED');
  const [includeSummaryHeader, setIncludeSummaryHeader] = useState<boolean>(true);
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Google Sheets Auto-Backup States
  const [sheetsConfig, setSheetsConfig] = useState<SheetsBackupConfig>(() => 
    getSheetsBackupConfig(business?.id || 'AquaPure_Springs')
  );
  const [spreadsheetInput, setSpreadsheetInput] = useState<string>('');
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState<boolean>(false);
  const [isSyncingSheets, setIsSyncingSheets] = useState<boolean>(false);
  const [sheetsSyncMessage, setSheetsSyncMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (business?.id) {
      const cfg = getSheetsBackupConfig(business.id);
      setSheetsConfig(cfg);
      setSpreadsheetInput(cfg.spreadsheetId || '');
    }
  }, [business?.id, isOpen]);

  // Map of customers for quick O(1) lookup
  const customersMap = useMemo(() => {
    const map = new Map<string, Customer>();
    customers.forEach(c => map.set(c.id, c));
    return map;
  }, [customers]);

  // Yesterday date string for quick selector
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return formatDateToYYYYMMDD(d);
  }, []);

  // Filter deliveries and transactions for the selected day
  const dayDeliveries = useMemo(() => {
    return deliveries.filter(d => isTimestampOnDate(d.timestamp, selectedDate));
  }, [deliveries, selectedDate]);

  const dayTransactions = useMemo(() => {
    return transactions.filter(t => isTimestampOnDate(t.timestamp, selectedDate));
  }, [transactions, selectedDate]);

  // Compute accounting metrics for the day
  const summary = useMemo(() => {
    return computeDayAccountingSummary(selectedDate, deliveries, transactions);
  }, [selectedDate, deliveries, transactions]);

  // Generate CSV text dynamically
  const generatedCSV = useMemo(() => {
    if (exportType === 'COMBINED') {
      return generateUnifiedDayBookCSV(
        selectedDate,
        deliveries,
        transactions,
        business,
        customersMap,
        includeSummaryHeader
      );
    } else if (exportType === 'DELIVERIES') {
      return generateDeliveriesCSV(
        selectedDate,
        deliveries,
        business,
        customersMap,
        includeSummaryHeader
      );
    } else {
      return generateTransactionsCSV(
        selectedDate,
        transactions,
        business,
        customersMap,
        includeSummaryHeader
      );
    }
  }, [selectedDate, deliveries, transactions, business, customersMap, exportType, includeSummaryHeader]);

  if (!isOpen) return null;

  const handleDownload = () => {
    const cleanBusinessName = (business?.name || 'AquaPure').replace(/[^a-zA-Z0-9]/g, '_');
    const typeTag = exportType.toLowerCase();
    const filename = `${cleanBusinessName}_${typeTag}_${selectedDate}.csv`;
    downloadCSV(generatedCSV, filename);
    onToast?.(`Downloaded ${filename} successfully!`);
  };

  const handleCopy = async () => {
    const success = await copyCSVToClipboard(generatedCSV);
    if (success) {
      setCopied(true);
      onToast?.('CSV content copied to clipboard for Excel/Sheets!');
      setTimeout(() => setCopied(false), 2500);
    } else {
      onToast?.('Could not copy automatically. Please use the Download button.');
    }
  };

  const handleGoogleConnect = async () => {
    setIsGoogleSigningIn(true);
    setSheetsSyncMessage(null);
    try {
      const { user, accessToken } = await signInWithGoogleSheets();
      const updated = saveSheetsBackupConfig(business?.id || 'AquaPure_Springs', {
        connectedEmail: user.email || undefined,
        lastSyncedStatus: 'IDLE'
      });
      setSheetsConfig(updated);
      onToast?.(`Connected Google Account: ${user.email}`);
    } catch (e: any) {
      console.warn('Google sign-in error:', e);
      setSheetsSyncMessage({
        text: e?.message || 'Could not connect Google account. Please try again.',
        type: 'error'
      });
    } finally {
      setIsGoogleSigningIn(false);
    }
  };

  const handleSaveSheetsAutoBackup = (enabled: boolean) => {
    if (!business?.id) return;
    const cleanId = spreadsheetInput.trim();
    const updated = saveSheetsBackupConfig(business.id, {
      spreadsheetId: cleanId,
      autoBackupEnabled: enabled
    });
    setSheetsConfig(updated);
    if (enabled && !cleanId) {
      onToast?.('Please paste a Google Sheet ID or URL to enable live backup');
    } else {
      onToast?.(enabled ? 'Real-time Google Sheet backup activated!' : 'Live Google Sheet backup paused');
    }
  };

  const handleManualSheetsSync = async () => {
    if (!business?.id) return;
    const cleanId = spreadsheetInput.trim();
    if (!cleanId) {
      setSheetsSyncMessage({
        text: 'Please enter a Google Spreadsheet ID or URL first.',
        type: 'error'
      });
      return;
    }

    setIsSyncingSheets(true);
    setSheetsSyncMessage(null);

    try {
      let token = getCachedSheetsToken();
      if (!token) {
        const authRes = await signInWithGoogleSheets();
        token = authRes.accessToken;
        saveSheetsBackupConfig(business.id, {
          connectedEmail: authRes.user.email || undefined
        });
      }

      const res = await syncLogsToGoogleSheet(
        cleanId,
        deliveries,
        transactions,
        customers,
        business,
        token
      );

      const updated = saveSheetsBackupConfig(business.id, {
        spreadsheetId: cleanId,
        lastSyncedTimestamp: Date.now(),
        lastSyncedStatus: 'SUCCESS',
        totalBackedUpCount: (deliveries.length + transactions.length)
      });
      setSheetsConfig(updated);

      setSheetsSyncMessage({
        text: res.message,
        type: 'success'
      });
      onToast?.(`Synced ${res.rowsSynced} records to Google Sheet!`);
    } catch (err: any) {
      console.warn('Manual sheets sync error:', err);
      setSheetsSyncMessage({
        text: err?.message || 'Failed to sync with Google Sheet. Ensure the spreadsheet is shared with write permissions.',
        type: 'error'
      });
    } finally {
      setIsSyncingSheets(false);
    }
  };

  const isToday = selectedDate === todayStr;
  const isYesterday = selectedDate === yesterdayStr;

  // Format date display
  const [y, m, d] = selectedDate.split('-').map(Number);
  const formattedDisplayDate = new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-xl border border-slate-200/90 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-start justify-between gap-3 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  Accounting & Cloud Backup
                </h2>
                {isToday && activeTab === 'CSV' && (
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Current Day
                  </span>
                )}
                {sheetsConfig.autoBackupEnabled && (
                  <span className="text-[10px] font-bold text-sky-800 bg-sky-100 px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                    <Cloud className="w-3 h-3 text-sky-600" />
                    <span>Auto-Backup Live</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Export formatted day books or setup real-time Google Sheets background backup
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 rounded-lg transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-4 pt-3 border-b border-slate-100 flex items-center gap-2 bg-slate-50/40">
          <button
            type="button"
            onClick={() => setActiveTab('CSV')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'CSV'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Daily Day Book CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('GOOGLE_SHEETS')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'GOOGLE_SHEETS'
                ? 'border-sky-600 text-sky-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>Google Sheets Live Backup</span>
            {sheetsConfig.autoBackupEnabled && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            )}
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-5 space-y-5 overflow-y-auto flex-1 text-xs">
          
          {activeTab === 'GOOGLE_SHEETS' ? (
            /* Google Sheets Live Backup Tab */
            <div className="space-y-4">
              {/* Integration Status Card */}
              <div className="p-4 bg-sky-50/80 border border-sky-200 rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center shrink-0">
                      <Cloud className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-sky-950">
                        Permanent Google Sheets Cloud Sync
                      </h4>
                      <p className="text-[11px] text-sky-800 mt-0.5">
                        Whenever a new delivery or payment transaction is logged, the background service instantly appends the row to your Google Spreadsheet.
                      </p>
                    </div>
                  </div>

                  {/* Google Auth Button */}
                  {sheetsConfig.connectedEmail ? (
                    <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-sky-200 text-sky-900 font-medium shrink-0">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span className="text-[11px] font-semibold">{sheetsConfig.connectedEmail}</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleGoogleConnect}
                      disabled={isGoogleSigningIn}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs transition-all cursor-pointer shrink-0 disabled:opacity-50"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 48 48">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                      </svg>
                      <span>{isGoogleSigningIn ? 'Connecting...' : 'Connect Google'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Spreadsheet ID / URL Configuration */}
              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Google Spreadsheet Link or ID
                  </label>
                  <a
                    href="https://sheets.new"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-sky-700 hover:text-sky-800 font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>Create new Google Sheet</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={spreadsheetInput}
                    onChange={(e) => setSpreadsheetInput(e.target.value)}
                    placeholder="e.g. https://docs.google.com/spreadsheets/d/1A2B3C... or Sheet ID"
                    className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  {sheetsConfig.spreadsheetId && (
                    <a
                      href={`https://docs.google.com/spreadsheets/d/${sheetsConfig.spreadsheetId}/edit`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold inline-flex items-center gap-1 transition-colors"
                      title="Open linked Google Sheet in new tab"
                    >
                      <span>Open</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>

                {/* Auto-Backup Toggle */}
                <div className="pt-2 flex items-center justify-between border-t border-slate-200/80">
                  <label htmlFor="auto-backup-sheets-toggle" className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      id="auto-backup-sheets-toggle"
                      checked={sheetsConfig.autoBackupEnabled}
                      onChange={(e) => handleSaveSheetsAutoBackup(e.target.checked)}
                      className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">
                        Enable Automatic Live Background Backup
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Append new delivery logs and cash payments to this sheet automatically
                      </span>
                    </div>
                  </label>

                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    sheetsConfig.autoBackupEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {sheetsConfig.autoBackupEnabled ? 'Active' : 'Disabled'}
                  </span>
                </div>
              </div>

              {/* Status and Manual Full Sync */}
              {sheetsSyncMessage && (
                <div className={`p-3 rounded-xl border flex items-start gap-2 text-xs ${
                  sheetsSyncMessage.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                  {sheetsSyncMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <span>{sheetsSyncMessage.text}</span>
                </div>
              )}

              <div className="p-3 bg-slate-100/70 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-slate-600">
                <div className="space-y-0.5">
                  <span className="text-[11px] font-semibold text-slate-700 block">
                    Backup Snapshot Status:
                  </span>
                  <p className="text-[11px] text-slate-500">
                    {sheetsConfig.lastSyncedTimestamp 
                      ? `Last synced: ${new Date(sheetsConfig.lastSyncedTimestamp).toLocaleString('en-IN')}` 
                      : 'No backup recorded yet'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleManualSheetsSync}
                  disabled={isSyncingSheets}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white rounded-xl font-bold shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSheets ? 'animate-spin' : ''}`} />
                  <span>{isSyncingSheets ? 'Syncing...' : 'Sync All Current Records Now'}</span>
                </button>
              </div>
            </div>
          ) : (
            /* CSV Export Tab */
            <>
              {/* 1. Date Selection Row */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-sky-600 shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      Target Accounting Date:
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {formattedDisplayDate}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setSelectedDate(todayStr)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      isToday
                        ? 'bg-sky-600 text-white shadow-2xs'
                        : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    Today
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedDate(yesterdayStr)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      isYesterday
                        ? 'bg-sky-600 text-white shadow-2xs'
                        : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    Yesterday
                  </button>

                  <input
                    type="date"
                    value={selectedDate}
                    max={todayStr}
                    onChange={(e) => {
                      if (e.target.value) setSelectedDate(e.target.value);
                    }}
                    className="px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* 2. Accounting Day Snapshot (KPI Cards) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Log Summary for {selectedDate}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {dayDeliveries.length} drops | {dayTransactions.length} receipts
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                    <span className="text-[10px] text-slate-500 block font-medium">Jars Delivered</span>
                    <strong className="text-sm font-bold text-slate-900 flex items-center gap-1 mt-0.5">
                      <Truck className="w-3.5 h-3.5 text-sky-600" />
                      <span>{summary.totalJarsDelivered}</span>
                    </strong>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                    <span className="text-[10px] text-slate-500 block font-medium">Empty Returned</span>
                    <strong className="text-sm font-bold text-emerald-700 flex items-center gap-1 mt-0.5">
                      <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{summary.totalEmptiesCollected}</span>
                    </strong>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                    <span className="text-[10px] text-slate-500 block font-medium">Cash Collected</span>
                    <strong className="text-sm font-bold text-slate-900 flex items-center gap-1 mt-0.5">
                      <DollarSign className="w-3.5 h-3.5 text-slate-600" />
                      <span>₹{summary.totalCashCollected}</span>
                    </strong>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                    <span className="text-[10px] text-slate-500 block font-medium">UPI / Digital</span>
                    <strong className="text-sm font-bold text-sky-700 flex items-center gap-1 mt-0.5">
                      <CreditCard className="w-3.5 h-3.5 text-sky-600" />
                      <span>₹{summary.totalUpiCollected}</span>
                    </strong>
                  </div>
                </div>
              </div>

              {/* 3. Export Preset Options */}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
                  Select Export Format Preset
                </span>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setExportType('COMBINED')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      exportType === 'COMBINED'
                        ? 'bg-sky-50/80 border-sky-400 ring-1 ring-sky-400'
                        : 'bg-white hover:bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-xs">Unified Day Book</span>
                        {exportType === 'COMBINED' && (
                          <CheckCircle2 className="w-4 h-4 text-sky-600" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Both delivery drops and financial payments in a single, comprehensive chronological statement.
                      </p>
                    </div>
                    <span className="mt-2 text-[10px] font-semibold text-sky-700 bg-sky-100/70 px-1.5 py-0.5 rounded w-fit">
                      Recommended
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExportType('DELIVERIES')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      exportType === 'DELIVERIES'
                        ? 'bg-sky-50/80 border-sky-400 ring-1 ring-sky-400'
                        : 'bg-white hover:bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-xs">Delivery & Stock Register</span>
                        {exportType === 'DELIVERIES' && (
                          <CheckCircle2 className="w-4 h-4 text-sky-600" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Jar dispatches, bottle balances, route drops, driver tags, and door-to-door sales.
                      </p>
                    </div>
                    <span className="mt-2 text-[10px] font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded w-fit">
                      Logistics
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExportType('TRANSACTIONS')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      exportType === 'TRANSACTIONS'
                        ? 'bg-sky-50/80 border-sky-400 ring-1 ring-sky-400'
                        : 'bg-white hover:bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-xs">Cash & Bank Register</span>
                        {exportType === 'TRANSACTIONS' && (
                          <CheckCircle2 className="w-4 h-4 text-sky-600" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Financial receipts log including UPI digital payments, Cash in hand deposits, and customer due clearances.
                      </p>
                    </div>
                    <span className="mt-2 text-[10px] font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded w-fit">
                      Cash Flow & Banking
                    </span>
                  </button>
                </div>
              </div>

              {/* 4. Formatting Preferences & Preview Toggle */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeSummaryHeader}
                    onChange={(e) => setIncludeSummaryHeader(e.target.checked)}
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                  />
                  <span className="text-xs text-slate-700 font-medium">
                    Include business GSTIN, date, and audit summary header block
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => setShowPreview(!showPreview)}
                  className="inline-flex items-center gap-1.5 text-xs text-sky-700 hover:text-sky-800 font-semibold cursor-pointer py-1 px-2 rounded-lg hover:bg-sky-50 transition-colors"
                >
                  {showPreview ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>Hide Preview</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5" />
                      <span>View CSV Preview</span>
                    </>
                  )}
                </button>
              </div>

              {/* 5. Live CSV Preview Window */}
              {showPreview && (
                <div className="bg-slate-950 text-slate-200 p-3.5 rounded-xl text-[11px] font-mono overflow-x-auto max-h-48 border border-slate-800">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-[10px] text-slate-400 mb-2 font-sans">
                    <span>CSV Output Preview (UTF-8 with BOM):</span>
                    <span>{generatedCSV.split('\n').length} lines</span>
                  </div>
                  <pre className="whitespace-pre overflow-x-auto leading-relaxed text-slate-300">
                    {generatedCSV.split('\n').slice(0, 15).join('\n')}
                    {generatedCSV.split('\n').length > 15 && '\n# ... (remaining lines omitted in preview)'}
                  </pre>
                </div>
              )}
            </>
          )}

        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/70 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <span>Ready for Excel, Google Sheets, Tally ERP, and QuickBooks</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 justify-end">
            {activeTab === 'CSV' ? (
              <>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer shadow-2xs active:scale-98"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span className="text-emerald-700 font-bold">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-slate-500" />
                      <span>Copy CSV</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  id="open-google-sheets-btn"
                  onClick={() => setActiveTab('GOOGLE_SHEETS')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-300 rounded-xl transition-all cursor-pointer shadow-2xs active:scale-98"
                  title="Configure live Google Sheets auto-backup"
                >
                  <Cloud className="w-4 h-4 text-sky-600" />
                  <span>Google Sheets Sync</span>
                </button>

                <button
                  type="button"
                  id="download-daily-csv-btn"
                  onClick={handleDownload}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all cursor-pointer shadow-xs active:scale-98"
                >
                  <Download className="w-4 h-4" />
                  <span>Download CSV</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer shadow-2xs"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
