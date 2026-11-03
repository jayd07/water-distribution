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
  Cloud,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  FileText,
  Printer,
  Share2,
  MessageCircle,
  Send,
  Phone,
  Sliders,
  UserCheck
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
  downloadDailyDeliveryPdf,
  printDailyDeliveryPdf,
  shareDailyDeliveryPdfOrWhatsApp,
  generateDailyWhatsAppSummary,
  computeDriverBreakdown
} from '../utils/deliveryPdfReport';
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
  customersMap?: Map<string, Customer>;
  customers?: Customer[];
  business?: BusinessAccount | null;
  initialDate?: string;
  onToast?: (message: string) => void;
}

export const ExportAccountingModal: React.FC<ExportAccountingModalProps> = ({
  isOpen,
  onClose,
  deliveries,
  transactions,
  customers = [],
  customersMap: propCustomersMap,
  business,
  initialDate,
  onToast
}) => {
  const todayStr = useMemo(() => formatDateToYYYYMMDD(new Date()), []);
  const [activeTab, setActiveTab] = useState<'PDF_SUMMARY' | 'CSV' | 'GOOGLE_SHEETS'>('PDF_SUMMARY');
  const [selectedDate, setSelectedDate] = useState<string>(initialDate || todayStr);
  const [exportType, setExportType] = useState<AccountingExportType>('COMBINED');
  const [includeSummaryHeader, setIncludeSummaryHeader] = useState<boolean>(true);
  const [showCsvPreview, setShowCsvPreview] = useState<boolean>(false);
  const [copiedCsv, setCopiedCsv] = useState<boolean>(false);

  // PDF & WhatsApp Configuration States
  const [includeFinancials, setIncludeFinancials] = useState<boolean>(true);
  const [includeDriverBreakdown, setIncludeDriverBreakdown] = useState<boolean>(true);
  const [includeCustomerPhone, setIncludeCustomerPhone] = useState<boolean>(true);
  const [supervisorNote, setSupervisorNote] = useState<string>('');
  const [showNotesInput, setShowNotesInput] = useState<boolean>(false);
  const [previewMode, setPreviewMode] = useState<'TABLE' | 'WHATSAPP'>('TABLE');
  const [copiedWhatsApp, setCopiedWhatsApp] = useState<boolean>(false);
  const [isSharingWhatsApp, setIsSharingWhatsApp] = useState<boolean>(false);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);

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
    if (propCustomersMap) return propCustomersMap;
    const map = new Map<string, Customer>();
    customers.forEach(c => map.set(c.id, c));
    return map;
  }, [customers, propCustomersMap]);

  // Yesterday date string for quick selector
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return formatDateToYYYYMMDD(d);
  }, []);

  // Filter deliveries and transactions for the selected day
  const dayDeliveries = useMemo(() => {
    return deliveries
      .filter(d => isTimestampOnDate(d.timestamp, selectedDate))
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [deliveries, selectedDate]);

  const dayTransactions = useMemo(() => {
    return transactions.filter(t => isTimestampOnDate(t.timestamp, selectedDate));
  }, [transactions, selectedDate]);

  // Compute accounting metrics for the day
  const summary = useMemo(() => {
    return computeDayAccountingSummary(selectedDate, deliveries, transactions);
  }, [selectedDate, deliveries, transactions]);

  // Driver breakdown stats
  const driverStats = useMemo(() => {
    return computeDriverBreakdown(dayDeliveries);
  }, [dayDeliveries]);

  // Formatted WhatsApp Summary Text
  const whatsAppSummaryText = useMemo(() => {
    return generateDailyWhatsAppSummary(selectedDate, deliveries, transactions, business);
  }, [selectedDate, deliveries, transactions, business]);

  // Generate CSV text dynamically
  const generatedCSV = useMemo(() => {
    const biz = business || undefined;
    if (exportType === 'COMBINED') {
      return generateUnifiedDayBookCSV(
        selectedDate,
        deliveries,
        transactions,
        biz,
        customersMap,
        includeSummaryHeader
      );
    } else if (exportType === 'DELIVERIES') {
      return generateDeliveriesCSV(
        selectedDate,
        deliveries,
        biz,
        customersMap,
        includeSummaryHeader
      );
    } else {
      return generateTransactionsCSV(
        selectedDate,
        transactions,
        biz,
        customersMap,
        includeSummaryHeader
      );
    }
  }, [selectedDate, deliveries, transactions, business, customersMap, exportType, includeSummaryHeader]);

  if (!isOpen) return null;

  // --- Handlers: PDF & WhatsApp ---
  const handleDownloadPdf = () => {
    try {
      const filename = downloadDailyDeliveryPdf(
        selectedDate,
        deliveries,
        transactions,
        customersMap,
        business,
        {
          includeFinancials,
          includeDriverBreakdown,
          includeCustomerContact: includeCustomerPhone,
          notes: supervisorNote.trim()
        }
      );
      onToast?.(`Downloaded PDF: ${filename}`);
    } catch (err: any) {
      console.error('Failed to generate PDF:', err);
      onToast?.('Failed to generate PDF summary. Please try again.');
    }
  };

  const handlePrintPdf = () => {
    setIsPrinting(true);
    try {
      printDailyDeliveryPdf(
        selectedDate,
        deliveries,
        transactions,
        customersMap,
        business,
        {
          includeFinancials,
          includeDriverBreakdown,
          includeCustomerContact: includeCustomerPhone,
          notes: supervisorNote.trim()
        }
      );
      onToast?.('Opened print dialog for delivery log sheet');
    } catch (err) {
      console.error('Print PDF failed:', err);
      onToast?.('Could not launch print preview.');
    } finally {
      setTimeout(() => setIsPrinting(false), 1000);
    }
  };

  const handleShareWhatsApp = async () => {
    setIsSharingWhatsApp(true);
    try {
      const res = await shareDailyDeliveryPdfOrWhatsApp(
        selectedDate,
        deliveries,
        transactions,
        customersMap,
        business,
        {
          includeFinancials,
          includeDriverBreakdown,
          includeCustomerContact: includeCustomerPhone,
          notes: supervisorNote.trim()
        }
      );
      onToast?.(res.message);
    } catch (err) {
      console.error('WhatsApp share error:', err);
      onToast?.('Failed to share to WhatsApp.');
    } finally {
      setIsSharingWhatsApp(false);
    }
  };

  const handleCopyWhatsAppText = async () => {
    try {
      await navigator.clipboard.writeText(whatsAppSummaryText);
      setCopiedWhatsApp(true);
      onToast?.('WhatsApp delivery summary copied to clipboard!');
      setTimeout(() => setCopiedWhatsApp(false), 2500);
    } catch (err) {
      console.error('Failed to copy text:', err);
      onToast?.('Could not copy WhatsApp summary to clipboard.');
    }
  };

  // --- Handlers: CSV Export ---
  const handleDownloadCsv = () => {
    const cleanBusinessName = (business?.name || 'AquaPure').replace(/[^a-zA-Z0-9]/g, '_');
    const typeTag = exportType.toLowerCase();
    const filename = `${cleanBusinessName}_${typeTag}_${selectedDate}.csv`;
    downloadCSV(generatedCSV, filename);
    onToast?.(`Downloaded ${filename} successfully!`);
  };

  const handleCopyCsv = async () => {
    const success = await copyCSVToClipboard(generatedCSV);
    if (success) {
      setCopiedCsv(true);
      onToast?.('CSV content copied to clipboard for Excel/Sheets!');
      setTimeout(() => setCopiedCsv(false), 2500);
    } else {
      onToast?.('Could not copy automatically. Please use Download button.');
    }
  };

  // --- Handlers: Google Sheets ---
  const handleGoogleConnect = async () => {
    setIsGoogleSigningIn(true);
    setSheetsSyncMessage(null);
    try {
      const { user } = await signInWithGoogleSheets();
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
        text: err?.message || 'Failed to sync with Google Sheet. Ensure write permissions.',
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

  const netJarVariance = summary.totalJarsDelivered - summary.totalEmptiesCollected;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-start justify-between gap-3 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-xs shrink-0 ${
              activeTab === 'PDF_SUMMARY' 
                ? 'bg-sky-600 text-white' 
                : activeTab === 'CSV' 
                ? 'bg-emerald-600 text-white' 
                : 'bg-indigo-600 text-white'
            }`}>
              {activeTab === 'PDF_SUMMARY' ? (
                <FileText className="w-5 h-5" />
              ) : activeTab === 'CSV' ? (
                <FileSpreadsheet className="w-5 h-5" />
              ) : (
                <Cloud className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  Delivery Reports & Export Center
                </h2>
                {isToday && (
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Today's Dispatch
                  </span>
                )}
                {sheetsConfig.autoBackupEnabled && (
                  <span className="text-[10px] font-bold text-sky-800 bg-sky-100 px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                    <Cloud className="w-3 h-3 text-sky-600" />
                    <span>Sheets Synced</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Generate printable PDF delivery sheets, share summaries to WhatsApp, or export accounting registers
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
        <div className="px-4 pt-3 border-b border-slate-100 flex items-center gap-2 bg-slate-50/40 overflow-x-auto">
          <button
            type="button"
            id="tab-pdf-summary"
            onClick={() => setActiveTab('PDF_SUMMARY')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'PDF_SUMMARY'
                ? 'border-sky-600 text-sky-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-sky-600" />
            <span>Daily Delivery PDF & WhatsApp</span>
            <span className="text-[9px] bg-sky-100 text-sky-800 font-semibold px-1.5 py-0.5 rounded-full">
              Print / Share
            </span>
          </button>

          <button
            type="button"
            id="tab-csv-export"
            onClick={() => setActiveTab('CSV')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'CSV'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Day Book CSV</span>
          </button>

          <button
            type="button"
            id="tab-google-sheets"
            onClick={() => setActiveTab('GOOGLE_SHEETS')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'GOOGLE_SHEETS'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Cloud className="w-3.5 h-3.5 text-indigo-600" />
            <span>Google Sheets Live Sync</span>
            {sheetsConfig.autoBackupEnabled && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            )}
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          
          {/* ============================================================== */}
          {/* TAB 1: DAILY DELIVERY PDF & WHATSAPP SHARING */}
          {/* ============================================================== */}
          {activeTab === 'PDF_SUMMARY' && (
            <div className="space-y-4">
              
              {/* 1. Date Selector Banner */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      Target Log Date: <span className="text-sky-700">{formattedDisplayDate}</span>
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Format delivery sheets and WhatsApp dispatch for this operational day
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

              {/* 2. Key Metrics Snapshot */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Operational Snapshot ({selectedDate})
                  </span>
                  <span className="text-[11px] font-medium text-slate-500">
                    {dayDeliveries.length} orders logged • {driverStats.length} active drivers
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 bg-sky-50/60 rounded-xl border border-sky-100">
                    <span className="text-[10px] text-sky-800 block font-semibold uppercase">Jars Delivered</span>
                    <div className="flex items-baseline gap-1.5 mt-1">
                      <strong className="text-base font-bold text-slate-900 font-mono">
                        {summary.totalJarsDelivered}
                      </strong>
                      <span className="text-[10px] text-slate-500 font-medium">units</span>
                    </div>
                    <span className="text-[10px] text-sky-700 flex items-center gap-1 mt-0.5">
                      <Truck className="w-3 h-3" />
                      <span>{dayDeliveries.length} drops</span>
                    </span>
                  </div>

                  <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
                    <span className="text-[10px] text-emerald-800 block font-semibold uppercase">Empties Returned</span>
                    <div className="flex items-baseline gap-1.5 mt-1">
                      <strong className="text-base font-bold text-emerald-900 font-mono">
                        {summary.totalEmptiesCollected}
                      </strong>
                      <span className="text-[10px] text-emerald-700 font-medium">jars</span>
                    </div>
                    <span className="text-[10px] text-emerald-700 flex items-center gap-1 mt-0.5">
                      <RotateCcw className="w-3 h-3" />
                      <span>{netJarVariance >= 0 ? `+${netJarVariance} net out` : `${netJarVariance} net in`}</span>
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-500 block font-semibold uppercase">Cash Remitted</span>
                    <div className="flex items-baseline gap-1 mt-1">
                      <strong className="text-base font-bold text-slate-900 font-mono">
                        ₹{summary.totalCashCollected.toLocaleString('en-IN')}
                      </strong>
                    </div>
                    <span className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                      <DollarSign className="w-3 h-3 text-slate-600" />
                      <span>Cash in hand</span>
                    </span>
                  </div>

                  <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100">
                    <span className="text-[10px] text-indigo-800 block font-semibold uppercase">Digital / UPI</span>
                    <div className="flex items-baseline gap-1 mt-1">
                      <strong className="text-base font-bold text-indigo-900 font-mono">
                        ₹{summary.totalUpiCollected.toLocaleString('en-IN')}
                      </strong>
                    </div>
                    <span className="text-[10px] text-indigo-700 flex items-center gap-1 mt-0.5">
                      <CreditCard className="w-3 h-3" />
                      <span>₹{summary.totalSettledAmount.toLocaleString('en-IN')} total</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. Primary Export & Share Action Hub */}
              <div className="p-4 bg-gradient-to-r from-sky-50/90 via-emerald-50/50 to-slate-50 rounded-2xl border border-sky-200/90 shadow-2xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Printer className="w-4 h-4 text-sky-600" />
                      <span>Downloadable PDF Summary & Instant Sharing</span>
                    </h3>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Specially formatted for printing physical dispatch log sheets or direct sharing with drivers via WhatsApp
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1">
                  {/* Download PDF Button */}
                  <button
                    type="button"
                    id="btn-download-delivery-pdf"
                    onClick={handleDownloadPdf}
                    className="inline-flex items-center justify-center gap-2 px-3 py-2.5 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-bold rounded-xl shadow-xs transition-all cursor-pointer active:scale-98"
                    title="Download A4 printable PDF document"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download PDF</span>
                  </button>

                  {/* Print PDF Button */}
                  <button
                    type="button"
                    id="btn-print-delivery-pdf"
                    onClick={handlePrintPdf}
                    disabled={isPrinting}
                    className="inline-flex items-center justify-center gap-2 px-3 py-2.5 bg-slate-800 hover:bg-slate-900 active:bg-slate-950 text-white font-bold rounded-xl shadow-xs transition-all cursor-pointer active:scale-98 disabled:opacity-50"
                    title="Send directly to printer or system print preview"
                  >
                    <Printer className="w-4 h-4" />
                    <span>{isPrinting ? 'Preparing Print...' : 'Print Summary'}</span>
                  </button>

                  {/* Share via WhatsApp Button */}
                  <button
                    type="button"
                    id="btn-share-whatsapp"
                    onClick={handleShareWhatsApp}
                    disabled={isSharingWhatsApp}
                    className="inline-flex items-center justify-center gap-2 px-3 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl shadow-xs transition-all cursor-pointer active:scale-98 disabled:opacity-50"
                    title="Share PDF report or summary directly via WhatsApp"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>{isSharingWhatsApp ? 'Sharing...' : 'Share via WhatsApp'}</span>
                  </button>

                  {/* Copy WhatsApp Text */}
                  <button
                    type="button"
                    id="btn-copy-whatsapp-text"
                    onClick={handleCopyWhatsAppText}
                    className="inline-flex items-center justify-center gap-2 px-3 py-2.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-semibold rounded-xl transition-all cursor-pointer shadow-2xs active:scale-98"
                    title="Copy formatted WhatsApp text to clipboard"
                  >
                    {copiedWhatsApp ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-emerald-700 font-bold">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-slate-600" />
                        <span>Copy Summary</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* 4. PDF Customization Options */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/90 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-slate-500" />
                    <span>Report Formatting & Content Preferences</span>
                  </span>
                  
                  <button
                    type="button"
                    onClick={() => setShowNotesInput(!showNotesInput)}
                    className="text-[11px] text-sky-700 hover:text-sky-800 font-semibold cursor-pointer underline-offset-2 hover:underline"
                  >
                    {showNotesInput ? 'Hide Supervisor Note' : '+ Add Dispatch Memo/Note'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-700">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includeFinancials}
                      onChange={(e) => setIncludeFinancials(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                    />
                    <span>Include Cash / UPI amounts</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includeDriverBreakdown}
                      onChange={(e) => setIncludeDriverBreakdown(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                    />
                    <span>Include Driver reconciliation table</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includeCustomerPhone}
                      onChange={(e) => setIncludeCustomerPhone(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                    />
                    <span>Include Customer phone numbers</span>
                  </label>
                </div>

                {showNotesInput && (
                  <div className="pt-2 border-t border-slate-200">
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                      Warehouse Supervisor Remarks / Shift Note:
                    </label>
                    <input
                      type="text"
                      value={supervisorNote}
                      onChange={(e) => setSupervisorNote(e.target.value)}
                      placeholder="e.g. Route 2 extra 10 jars dispatched for event; morning vehicle returned safely"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                )}
              </div>

              {/* 5. Live Interactive Preview Mode Switcher */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Report Preview
                    </span>
                    <div className="inline-flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setPreviewMode('TABLE')}
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-colors cursor-pointer ${
                          previewMode === 'TABLE' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        Log Sheet Table ({dayDeliveries.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewMode('WHATSAPP')}
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-colors cursor-pointer ${
                          previewMode === 'WHATSAPP' ? 'bg-white text-emerald-800 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        WhatsApp Text View
                      </button>
                    </div>
                  </div>

                  <span className="text-[10px] text-slate-400">
                    PDF includes A4 printable header, barcodes & signature blocks
                  </span>
                </div>

                {previewMode === 'TABLE' ? (
                  /* Delivery Log Table Preview */
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                    {dayDeliveries.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 space-y-2">
                        <Truck className="w-8 h-8 mx-auto text-slate-300" />
                        <p className="text-xs font-semibold text-slate-600">
                          No delivery dispatches logged on {selectedDate}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Select Today or another date from the picker above to generate the log sheet.
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto max-h-56">
                        <table className="w-full text-left border-collapse text-[11px]">
                          <thead className="bg-slate-900 text-slate-100 sticky top-0 text-[10px] uppercase font-bold tracking-wider">
                            <tr>
                              <th className="py-2 px-2.5 text-center w-8">#</th>
                              <th className="py-2 px-2.5">Time</th>
                              <th className="py-2 px-2.5">Customer</th>
                              <th className="py-2 px-2.5">Route / Address</th>
                              <th className="py-2 px-2 text-center text-sky-300">Out</th>
                              <th className="py-2 px-2 text-center text-emerald-300">In</th>
                              {includeFinancials && (
                                <>
                                  <th className="py-2 px-2.5 text-right">Amt</th>
                                  <th className="py-2 px-2 text-center">Mode</th>
                                </>
                              )}
                              <th className="py-2 px-2.5">Staff</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {dayDeliveries.map((del, idx) => {
                              const cust = customersMap.get(del.customerId);
                              const timeStr = new Date(del.timestamp).toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit'
                              });
                              return (
                                <tr key={del.id || idx} className="hover:bg-slate-50 transition-colors">
                                  <td className="py-1.5 px-2.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                                  <td className="py-1.5 px-2.5 font-medium text-slate-600 font-mono whitespace-nowrap">{timeStr}</td>
                                  <td className="py-1.5 px-2.5 font-bold text-slate-900">
                                    <div>{del.customerName || cust?.name || 'Customer'}</div>
                                    {includeCustomerPhone && (del.customerPhone || cust?.phone) && (
                                      <div className="text-[10px] text-slate-400 font-mono font-normal">
                                        {del.customerPhone || cust?.phone}
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-1.5 px-2.5 text-slate-500 truncate max-w-[140px]">
                                    {del.customerAddress || cust?.address || cust?.route || 'Route drop'}
                                  </td>
                                  <td className="py-1.5 px-2 text-center font-bold text-sky-700 bg-sky-50/50">
                                    {del.jarsDelivered}
                                  </td>
                                  <td className="py-1.5 px-2 text-center font-bold text-emerald-700 bg-emerald-50/50">
                                    {del.emptyJarsCollected}
                                  </td>
                                  {includeFinancials && (
                                    <>
                                      <td className="py-1.5 px-2.5 text-right font-mono font-bold text-slate-900">
                                        ₹{Number(del.amountCollected || 0).toLocaleString('en-IN')}
                                      </td>
                                      <td className="py-1.5 px-2 text-center">
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                          del.paymentMode === 'CASH'
                                            ? 'bg-slate-100 text-slate-700'
                                            : del.paymentMode === 'UPI'
                                            ? 'bg-sky-100 text-sky-800'
                                            : 'bg-amber-100 text-amber-800'
                                        }`}>
                                          {del.paymentMode || 'CASH'}
                                        </span>
                                      </td>
                                    </>
                                  )}
                                  <td className="py-1.5 px-2.5 text-slate-600">
                                    {del.workerName || 'Staff'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot className="bg-slate-100 font-bold text-slate-900 border-t border-slate-200">
                            <tr>
                              <td colSpan={4} className="py-2 px-2.5 text-right uppercase text-[10px] text-slate-600">
                                Total ({dayDeliveries.length} drops)
                              </td>
                              <td className="py-2 px-2 text-center text-sky-800 font-mono">
                                {summary.totalJarsDelivered}
                              </td>
                              <td className="py-2 px-2 text-center text-emerald-800 font-mono">
                                {summary.totalEmptiesCollected}
                              </td>
                              {includeFinancials && (
                                <>
                                  <td className="py-2 px-2.5 text-right font-mono text-slate-900">
                                    ₹{summary.totalSettledAmount.toLocaleString('en-IN')}
                                  </td>
                                  <td colSpan={2}></td>
                                </>
                              )}
                              {!includeFinancials && <td></td>}
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                ) : (
                  /* WhatsApp Text Message Preview */
                  <div className="bg-emerald-950/90 text-emerald-100 p-3.5 rounded-xl border border-emerald-800/80 font-mono text-[11px] space-y-2">
                    <div className="flex items-center justify-between pb-2 border-b border-emerald-800/60 font-sans">
                      <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Formatted WhatsApp Dispatch Note</span>
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleCopyWhatsAppText}
                          className="text-[10px] font-bold text-emerald-200 hover:text-white bg-emerald-800/80 px-2 py-0.5 rounded cursor-pointer transition-colors"
                        >
                          {copiedWhatsApp ? 'Copied!' : 'Copy Text'}
                        </button>
                        <button
                          type="button"
                          id="btn-preview-share-whatsapp"
                          onClick={handleShareWhatsApp}
                          disabled={isSharingWhatsApp}
                          className="text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-500 px-2.5 py-0.5 rounded flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
                          title="Share via WhatsApp"
                        >
                          <MessageCircle className="w-3 h-3" />
                          <span>Share via WhatsApp</span>
                        </button>
                      </div>
                    </div>
                    <pre className="whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto text-emerald-200 font-mono text-[11px]">
                      {whatsAppSummaryText}
                    </pre>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 2: DAY BOOK CSV EXPORT */}
          {/* ============================================================== */}
          {activeTab === 'CSV' && (
            <div className="space-y-4">
              {/* 1. Date Selection Row */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
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
                        ? 'bg-emerald-600 text-white shadow-2xs'
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
                        ? 'bg-emerald-600 text-white shadow-2xs'
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
                    className="px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* 2. Export Preset Options */}
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
                        ? 'bg-emerald-50/80 border-emerald-400 ring-1 ring-emerald-400'
                        : 'bg-white hover:bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-xs">Unified Day Book</span>
                        {exportType === 'COMBINED' && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Both delivery drops and financial payments in a single, comprehensive chronological statement.
                      </p>
                    </div>
                    <span className="mt-2 text-[10px] font-semibold text-emerald-800 bg-emerald-100/80 px-1.5 py-0.5 rounded w-fit">
                      Recommended
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExportType('DELIVERIES')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      exportType === 'DELIVERIES'
                        ? 'bg-emerald-50/80 border-emerald-400 ring-1 ring-emerald-400'
                        : 'bg-white hover:bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-xs">Delivery & Stock Register</span>
                        {exportType === 'DELIVERIES' && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
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
                        ? 'bg-emerald-50/80 border-emerald-400 ring-1 ring-emerald-400'
                        : 'bg-white hover:bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-xs">Cash & Bank Register</span>
                        {exportType === 'TRANSACTIONS' && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
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

              {/* 3. Formatting Preferences & Preview Toggle */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeSummaryHeader}
                    onChange={(e) => setIncludeSummaryHeader(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span className="text-xs text-slate-700 font-medium">
                    Include business GSTIN, date, and audit summary header block
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => setShowCsvPreview(!showCsvPreview)}
                  className="inline-flex items-center gap-1.5 text-xs text-emerald-700 hover:text-emerald-800 font-semibold cursor-pointer py-1 px-2 rounded-lg hover:bg-emerald-50 transition-colors"
                >
                  {showCsvPreview ? (
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

              {/* 4. Live CSV Preview Window */}
              {showCsvPreview && (
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
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 3: GOOGLE SHEETS CLOUD BACKUP */}
          {/* ============================================================== */}
          {activeTab === 'GOOGLE_SHEETS' && (
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
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl font-bold shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSheets ? 'animate-spin' : ''}`} />
                  <span>{isSyncingSheets ? 'Syncing...' : 'Sync All Current Records Now'}</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/80 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <span>
              {activeTab === 'PDF_SUMMARY' 
                ? 'Print-Ready A4 Document with Route & Driver Audit Logs' 
                : 'Ready for Excel, Google Sheets, Tally ERP, and QuickBooks'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 justify-end">
            {activeTab === 'PDF_SUMMARY' ? (
              <>
                <button
                  type="button"
                  onClick={handleCopyWhatsAppText}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer shadow-2xs active:scale-98"
                >
                  {copiedWhatsApp ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span className="text-emerald-700 font-bold">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-slate-500" />
                      <span>Copy Text</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handlePrintPdf}
                  disabled={isPrinting}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer shadow-2xs active:scale-98 disabled:opacity-50"
                >
                  <Printer className="w-4 h-4 text-slate-600" />
                  <span>Print</span>
                </button>

                <button
                  type="button"
                  id="btn-footer-share-whatsapp"
                  onClick={handleShareWhatsApp}
                  disabled={isSharingWhatsApp}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all cursor-pointer shadow-xs active:scale-98 disabled:opacity-50"
                  title="Share PDF or summary via WhatsApp"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>{isSharingWhatsApp ? 'Sharing...' : 'Share via WhatsApp'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-xl transition-all cursor-pointer shadow-xs active:scale-98"
                >
                  <Download className="w-4 h-4" />
                  <span>Download PDF</span>
                </button>
              </>
            ) : activeTab === 'CSV' ? (
              <>
                <button
                  type="button"
                  onClick={handleCopyCsv}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer shadow-2xs active:scale-98"
                >
                  {copiedCsv ? (
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
                  onClick={() => setActiveTab('PDF_SUMMARY')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-300 rounded-xl transition-all cursor-pointer shadow-2xs active:scale-98"
                >
                  <FileText className="w-4 h-4 text-sky-600" />
                  <span>Switch to PDF</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadCsv}
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
