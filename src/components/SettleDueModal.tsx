import React, { useState, useEffect, useMemo } from 'react';
import { Customer, BusinessAccount } from '../types';
import { recordDueSettlement } from '../services/deliveryService';
import { getActiveBusiness, getBusinessById } from '../services/businessService';
import { generateUpiUri, generateUpiQrDataUrl } from '../utils/upiUtils';
import { X, CreditCard, IndianRupee, Check, AlertCircle, QrCode, ExternalLink, Copy, Building2 } from 'lucide-react';

interface SettleDueModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  businessId: string;
  business?: BusinessAccount;
  onSettled: (message: string) => void;
}

export const SettleDueModal: React.FC<SettleDueModalProps> = ({
  isOpen,
  onClose,
  customer,
  businessId,
  business,
  onSettled
}) => {
  const [amount, setAmount] = useState<number>(() => {
    const due = Number(customer?.dueAmount) || 0;
    return due > 0 ? due : 35;
  });
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI' | 'BANK_TRANSFER'>('UPI');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [upiIntentUri, setUpiIntentUri] = useState<string>('');
  const [copiedUpi, setCopiedUpi] = useState<boolean>(false);

  const activeBiz = useMemo(() => {
    if (business && business.id) return business;
    if (businessId) {
      const found = getBusinessById(businessId);
      if (found) return found;
    }
    return getActiveBusiness();
  }, [business, businessId]);

  const effectiveBizName = activeBiz?.name?.trim() || 'AquaPure Springs Water Distribution';
  
  // Strictly derive business UPI handle
  const effectiveUpiId = useMemo(() => {
    // 1. Direct upiId on activeBiz
    if (activeBiz?.upiId && activeBiz.upiId.trim().length > 0) {
      return activeBiz.upiId.trim();
    }
    // 2. Format owner phone on activeBiz
    const rawOwnerPhone = (activeBiz?.ownerPhone || '').replace(/\D/g, '');
    if (rawOwnerPhone.length >= 10) {
      return `${rawOwnerPhone.slice(-10)}@upi`;
    }
    // 3. Fallback to stored business by businessId
    const stored = getBusinessById(businessId || activeBiz?.id || '');
    if (stored?.upiId && stored.upiId.trim().length > 0) {
      return stored.upiId.trim();
    }
    const storedPhone = (stored?.ownerPhone || '').replace(/\D/g, '');
    if (storedPhone.length >= 10) {
      return `${storedPhone.slice(-10)}@upi`;
    }
    return '';
  }, [activeBiz?.upiId, activeBiz?.ownerPhone, activeBiz?.id, businessId]);

  useEffect(() => {
    if (customer && isOpen) {
      const due = Number(customer.dueAmount) || 0;
      setAmount(due > 0 ? due : 35);
      setError(null);
      setCopiedUpi(false);
    }
  }, [customer, isOpen]);

  useEffect(() => {
    if (isOpen && paymentMode === 'UPI' && effectiveUpiId && amount > 0) {
      const uri = generateUpiUri({
        upiId: effectiveUpiId,
        merchantName: effectiveBizName,
        amount: Number(amount),
        note: `Due Settlement - ${customer?.name || 'Customer'}`
      });
      setUpiIntentUri(uri);
      generateUpiQrDataUrl(uri, { width: 220 }).then(setQrDataUrl);
    } else {
      setUpiIntentUri('');
      setQrDataUrl('');
    }
  }, [isOpen, paymentMode, effectiveUpiId, effectiveBizName, amount, customer]);

  // Ensure all hooks run unconditionally above before this early return
  if (!isOpen || !customer) return null;

  const currentDue = Number(customer.dueAmount) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      setError('Amount must be greater than 0.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await recordDueSettlement(
        businessId,
        customer.id,
        customer.name,
        Number(amount),
        paymentMode
      );
      onSettled(`Payment of ₹${amount} recorded for ${customer.name}`);
      onClose();
    } catch {
      setError('Could not record transaction. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenUpiApp = () => {
    if (upiIntentUri) {
      window.location.href = upiIntentUri;
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-sm w-full shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[95vh] flex flex-col">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {currentDue > 0 ? 'Settle Customer Due' : 'Record Transaction / Payment'}
            </h3>
            <p className="text-xs text-slate-500">Record cash, UPI or bank collection</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl">
            <span className="text-[11px] font-semibold text-amber-800 uppercase block">
              Customer Account
            </span>
            <h4 className="text-sm font-bold text-slate-900">{customer.name}</h4>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-amber-200/60 text-xs">
              <span className="text-slate-600">Total Pending:</span>
              <strong className="text-amber-700 font-extrabold text-sm">₹{currentDue}</strong>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
              Payment Amount (₹)
            </label>
            <div className="relative">
              <IndianRupee className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
              Payment Method
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['UPI', 'CASH', 'BANK_TRANSFER'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPaymentMode(mode)}
                  className={`py-2 px-1 text-center rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    paymentMode === mode
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {mode === 'BANK_TRANSFER' ? 'NEFT/Bank' : mode}
                </button>
              ))}
            </div>
          </div>

          {/* Instant UPI QR Code & Direct Deep Link for Customer */}
          {paymentMode === 'UPI' && (
            <div className="p-3.5 bg-gradient-to-b from-indigo-50/70 to-slate-50 rounded-2xl border border-indigo-100/90 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Building2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span className="text-xs font-bold text-slate-900 truncate">
                    {effectiveBizName}
                  </span>
                </div>
                <span className="text-[10px] font-bold px-1.5 py-0.2 bg-indigo-100 text-indigo-800 rounded shrink-0">
                  Business QR
                </span>
              </div>

              <div className="flex items-center gap-3.5">
                <div className="bg-white p-2 rounded-xl border border-slate-200/90 shadow-2xs shrink-0 text-center">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="UPI QR Code"
                      className="w-24 h-24 object-contain rounded-lg"
                    />
                  ) : (
                    <div className="w-24 h-24 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                      <QrCode className="w-10 h-10" />
                    </div>
                  )}
                  <span className="text-[9px] font-bold text-slate-500 block mt-1">Scan to Pay</span>
                </div>

                <div className="text-xs space-y-1.5 min-w-0 flex-1">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                      Payee UPI ID
                    </span>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-[11px] font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 truncate select-all">
                        {effectiveUpiId || 'UPI ID Not Set'}
                      </span>
                      {effectiveUpiId && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(effectiveUpiId);
                            setCopiedUpi(true);
                            setTimeout(() => setCopiedUpi(false), 2000);
                          }}
                          className="p-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100 rounded transition-colors cursor-pointer shrink-0"
                          title="Copy UPI ID"
                        >
                          {copiedUpi ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="pt-1">
                    <span className="text-[10px] text-slate-500 block">Total Settlement</span>
                    <strong className="text-base font-extrabold text-indigo-700">
                      ₹{amount}
                    </strong>
                  </div>

                  <p className="text-[10px] text-slate-500">
                    GPay • PhonePe • Paytm • BHIM
                  </p>
                </div>
              </div>

              {upiIntentUri && (
                <button
                  type="button"
                  onClick={handleOpenUpiApp}
                  className="w-full py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in UPI App (Deep Link)</span>
                </button>
              )}
            </div>
          )}

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
                  Recording...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  Record Payment
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
