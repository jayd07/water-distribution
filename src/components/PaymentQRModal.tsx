import React, { useState, useMemo } from 'react';
import { 
  X, 
  QrCode, 
  IndianRupee, 
  Share2, 
  Copy, 
  Check, 
  Printer, 
  Building2, 
  Edit3, 
  Sparkles,
  Phone,
  ShieldCheck,
  Download
} from 'lucide-react';
import { BusinessAccount, UserSessionProfile } from '../types';

interface PaymentQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  business?: BusinessAccount;
  userSession?: UserSessionProfile | null;
  onToast?: (message: string) => void;
  initialAmount?: string;
  initialNote?: string;
}

export const PaymentQRModal: React.FC<PaymentQRModalProps> = ({
  isOpen,
  onClose,
  business,
  userSession,
  onToast,
  initialAmount,
  initialNote
}) => {
  const defaultVpa = useMemo(() => {
    // 1. Strictly prioritize business configured UPI ID
    if (business?.upiId && business.upiId.trim().length > 0) {
      return business.upiId.trim();
    }
    // 2. Fall back to business owner phone if no specific UPI ID string is stored
    const rawOwnerPhone = (business?.ownerPhone || '').replace(/\D/g, '');
    if (rawOwnerPhone.length >= 10) {
      const tenDigits = rawOwnerPhone.slice(-10);
      return `${tenDigits}@upi`;
    }
    return '';
  }, [business?.upiId, business?.ownerPhone]);

  const isWorker = userSession?.role === 'WORKER';
  const [amount, setAmount] = useState<string>(initialAmount || '70');
  const [vpa, setVpa] = useState<string>(defaultVpa);
  const [payeeName, setPayeeName] = useState<string>(business?.name || 'Water Distribution');
  const [note, setNote] = useState<string>(initialNote || 'Water Jar Refill Payment');
  const [isEditingVpa, setIsEditingVpa] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Synchronize VPA, amount, note, and payee name whenever the modal opens or business data changes
  React.useEffect(() => {
    if (isOpen) {
      setVpa(defaultVpa);
      setPayeeName(business?.name || 'Water Distribution');
      setAmount(initialAmount !== undefined ? initialAmount : '70');
      setNote(initialNote !== undefined ? initialNote : 'Water Jar Refill Payment');
      setIsEditingVpa(false);
    }
  }, [isOpen, defaultVpa, business?.name, initialAmount, initialNote]);

  const numAmount = parseFloat(amount) || 0;

  // Build standard UPI URL with query parameters
  const upiUrl = useMemo(() => {
    const cleanVpa = (vpa || defaultVpa).trim();
    const cleanName = (payeeName || business?.name || 'Water Distribution').trim();
    const cleanNote = (note || 'Water Supply').trim();
    
    let url = `upi://pay?pa=${encodeURIComponent(cleanVpa)}&pn=${encodeURIComponent(cleanName)}&cu=INR`;
    if (numAmount > 0) {
      url += `&am=${numAmount.toFixed(2)}`;
    }
    if (cleanNote) {
      url += `&tn=${encodeURIComponent(cleanNote)}`;
    }
    return url;
  }, [vpa, defaultVpa, payeeName, business?.name, note, numAmount]);

  const qrImageUrl = useMemo(() => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(upiUrl)}`;
  }, [upiUrl]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(upiUrl);
    setCopied(true);
    onToast?.('UPI Payment Link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const shareText = `*Payment Request from ${payeeName}*
----------------------------------------
*Amount:* ${numAmount > 0 ? `₹${numAmount}` : 'Any amount'}
*UPI ID (VPA):* ${vpa}
*Note:* ${note}
----------------------------------------
👉 *Tap to pay directly with Google Pay / PhonePe / Paytm / BHIM:*
${upiUrl}`;
    
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  const quickAmounts = [35, 70, 100, 150, 300, 500, 1000];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md max-h-[95vh] flex flex-col overflow-hidden text-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">Instant UPI Payment QR</h3>
              <p className="text-[11px] text-slate-400">Dynamic QR with live amount & VPA</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Dynamic Amount Input */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
              Enter Amount (₹)
            </label>
            <div className="relative">
              <IndianRupee className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="number"
                min="0"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Leave empty for customer-entered amount"
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-base font-bold text-slate-900 focus:outline-none"
              />
            </div>

            {/* Quick Amount Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-2">
              {quickAmounts.map((qAmt) => (
                <button
                  key={qAmt}
                  type="button"
                  onClick={() => setAmount(qAmt.toString())}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors shrink-0 cursor-pointer ${
                    amount === qAmt.toString()
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  ₹{qAmt}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAmount('')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors shrink-0 cursor-pointer ${
                  amount === ''
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Custom / Open
              </button>
            </div>
          </div>

          {/* QR Code Standee Card (Printable) */}
          <div className="bg-gradient-to-b from-indigo-50/70 to-slate-50 p-4 rounded-2xl border border-indigo-100/80 text-center space-y-3 shadow-2xs">
            <div className="space-y-0.5">
              <div className="flex items-center justify-center gap-1.5 font-bold text-sm text-slate-900">
                <Building2 className="w-4 h-4 text-indigo-600" />
                <span className="truncate max-w-[240px]">{payeeName}</span>
              </div>
              <p className="text-[11px] text-slate-500 font-mono">
                {vpa || 'Set UPI ID in Customize settings below'}
              </p>
            </div>

            {/* High-Res QR Code Image */}
            <div className="inline-block bg-white p-3 rounded-2xl border border-slate-200/90 shadow-sm mx-auto">
              <img
                src={qrImageUrl}
                alt="Dynamic UPI QR Code"
                className="w-44 h-44 sm:w-48 sm:h-48 object-contain mx-auto rounded-lg"
              />
            </div>

            {/* Payment Summary */}
            <div className="space-y-1">
              <div className="text-sm font-extrabold text-indigo-900">
                {numAmount > 0 ? `Pay ₹${numAmount.toLocaleString('en-IN')}` : 'Scan & Pay Any Amount'}
              </div>
              <p className="text-[10px] text-slate-500">
                Google Pay • PhonePe • Paytm • BHIM UPI
              </p>
            </div>
          </div>

          {/* VPA & Note Configuration Accordion (Owner Only) */}
          {!isWorker && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-600">Business VPA & Remarks</span>
                <button
                  type="button"
                  onClick={() => setIsEditingVpa(!isEditingVpa)}
                  className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 cursor-pointer"
                >
                  {isEditingVpa ? 'Hide Settings' : 'Customize VPA / Note'}
                </button>
              </div>

              {isEditingVpa && (
                <div className="space-y-2 pt-1">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 block mb-0.5">UPI ID (VPA)</label>
                    <input
                      type="text"
                      value={vpa}
                      onChange={(e) => setVpa(e.target.value)}
                      placeholder="e.g. 9876543210@upi"
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 block mb-0.5">Business / Payee Name</label>
                    <input
                      type="text"
                      value={payeeName}
                      onChange={(e) => setPayeeName(e.target.value)}
                      placeholder="Business Name"
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 block mb-0.5">Payment Note</label>
                    <input
                      type="text"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="e.g. Water Delivery"
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer shadow-2xs"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Link Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>Copy Link</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-2">
            {!isWorker && (
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all cursor-pointer shadow-xs"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>WhatsApp QR</span>
              </button>
            )}
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-all cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print Standee</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
