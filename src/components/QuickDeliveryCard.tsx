import React, { useState } from 'react';
import { 
  Check, 
  Phone, 
  MapPin, 
  MessageSquare, 
  TrendingUp, 
  PackageCheck, 
  Sparkles,
  ChevronDown,
  CreditCard,
  Banknote,
  Clock,
  RotateCcw,
  AlertCircle
} from 'lucide-react';
import { Customer, CustomerSchedule, DeliveryTrip } from '../types';
import { CardSpotlight } from './ui/CardSpotlight';
import { Button } from './ui/Button';
import { triggerHaptic } from '../utils/haptics';
import { useLanguage } from '../context/LanguageContext';

interface QuickDeliveryCardProps {
  customer: Customer;
  schedule?: CustomerSchedule;
  defaultJarRate: number;
  isCompleted: boolean;
  activeTrip?: DeliveryTrip | null;
  onQuickDeliver: (payload: {
    customerId: string;
    customerName: string;
    jarsDelivered: number;
    emptyJarsCollected: number;
    amountCollected: number;
    paymentMode: 'CASH' | 'UPI' | 'CREDIT';
    notes?: string;
  }) => Promise<void>;
  onOpenDetailedModal?: (customer: Customer) => void;
}

export const QuickDeliveryCard: React.FC<QuickDeliveryCardProps> = ({
  customer,
  schedule,
  defaultJarRate,
  isCompleted,
  activeTrip,
  onQuickDeliver,
  onOpenDetailedModal
}) => {
  const { t, isGujarati } = useLanguage();
  const defaultDeliverQty = schedule?.defaultQuantity || 1;
  const [deliverQty, setDeliverQty] = useState<number>(defaultDeliverQty);
  const [emptyQty, setEmptyQty] = useState<number>(defaultDeliverQty);
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI' | 'CREDIT'>('CASH');
  const [showAdjust, setShowAdjust] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [completedAnim, setCompletedAnim] = useState<boolean>(isCompleted);

  const estimatedAmount = deliverQty * defaultJarRate;

  const handle1TapDelivery = async () => {
    setIsSubmitting(true);
    try {
      await onQuickDeliver({
        customerId: customer.id,
        customerName: customer.name,
        jarsDelivered: deliverQty,
        emptyJarsCollected: emptyQty,
        amountCollected: paymentMode === 'CREDIT' ? 0 : estimatedAmount,
        paymentMode: paymentMode,
        notes: schedule ? `Scheduled (${schedule.frequency}) run stop` : 'Route delivery'
      });
      triggerHaptic('delivery');
      setCompletedAnim(true);
      setShowAdjust(false);
    } catch (err) {
      console.error('Quick deliver error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCall = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!customer.phone) return;
    window.location.href = `tel:${customer.phone.replace(/\D/g, '')}`;
  };

  const handleWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!customer.phone) return;
    const cleanPhone = customer.phone.replace(/\D/g, '').slice(-10);
    const text = `Hello ${customer.name}, AquaPure Springs delivery update:\nDelivered: ${deliverQty} Water Jar(s)\nEmpty Collected: ${emptyQty}\nAmount: ₹${paymentMode === 'CREDIT' ? '0 (Added to Account)' : estimatedAmount}\nThank you!`;
    window.open(`https://wa.me/91${cleanPhone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleMaps = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!customer.address) return;
    const query = encodeURIComponent(`${customer.address}, ${customer.name}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  };

  return (
    <CardSpotlight 
      spotlightColor={completedAnim || isCompleted ? 'rgba(16, 185, 129, 0.1)' : 'rgba(14, 165, 233, 0.12)'}
      className={`transition-all duration-200 ${
        completedAnim || isCompleted
          ? 'bg-slate-50/80 border-emerald-200/80 opacity-90'
          : 'bg-white border-slate-200/90 hover:border-sky-300'
      }`}
    >
      {/* Top Details Header */}
      <div className="p-4 sm:p-4.5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-base font-bold text-slate-900 truncate">
                {customer.name}
              </h4>
              {schedule && (
                <span className="text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-md">
                  {schedule.frequency}
                </span>
              )}
              {customer.route && (
                <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                  {customer.route}
                </span>
              )}
            </div>

            {customer.address && (
              <p className="text-xs text-slate-500 flex items-center gap-1 line-clamp-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{customer.address}</span>
              </p>
            )}
          </div>

          {/* Quick Contact Icons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {customer.address && (
              <Button
                type="button"
                variant="secondary"
                size="icon-sm"
                onClick={handleMaps}
                title="Open in Google Maps"
                className="hover:border-sky-300 hover:text-sky-600"
              >
                <MapPin className="w-3.5 h-3.5" />
              </Button>
            )}
            {customer.phone && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon-sm"
                  onClick={handleWhatsApp}
                  title="WhatsApp message"
                  className="hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon-sm"
                  onClick={handleCall}
                  title="Call customer"
                  className="hover:bg-sky-50 hover:text-sky-700 hover:border-sky-300"
                >
                  <Phone className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Customer Balance Badges */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1 text-slate-600">
            <span className="text-slate-400">Holding:</span>
            <strong className="font-bold text-slate-800 font-mono tabular-nums">{customer.jarsHolding || 0} Jars</strong>
          </div>
          <span className="text-slate-300">·</span>
          <div className="flex items-center gap-1">
            <span className="text-slate-400">Due:</span>
            <strong className={`font-bold font-mono tabular-nums ${customer.dueAmount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              ₹{customer.dueAmount || 0}
            </strong>
          </div>
        </div>

        {/* Adjustable Options Drawer */}
        {showAdjust && (
          <div className="mt-3 p-3.5 bg-slate-50/90 rounded-xl border border-slate-200/90 space-y-3 animate-in fade-in zoom-in-95 duration-150">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  {t.worker.jarsDroppedFull}
                </label>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon-sm"
                    onClick={() => setDeliverQty(Math.max(1, deliverQty - 1))}
                    className="font-bold text-sm"
                  >
                    -
                  </Button>
                  <span className="flex-1 text-center font-bold text-slate-800 text-sm font-mono tabular-nums">
                    {deliverQty}
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon-sm"
                    onClick={() => setDeliverQty(deliverQty + 1)}
                    className="font-bold text-sm"
                  >
                    +
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  {t.worker.collectEmptyCans}
                </label>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon-sm"
                    onClick={() => setEmptyQty(Math.max(0, emptyQty - 1))}
                    className="font-bold text-sm"
                  >
                    -
                  </Button>
                  <span className="flex-1 text-center font-bold text-slate-800 text-sm font-mono tabular-nums">
                    {emptyQty}
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon-sm"
                    onClick={() => setEmptyQty(emptyQty + 1)}
                    className="font-bold text-sm"
                  >
                    +
                  </Button>
                </div>
              </div>
            </div>

            {/* Payment Mode Selector */}
            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                {t.worker.paymentCollection}
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                <Button
                  type="button"
                  variant={paymentMode === 'CASH' ? 'emerald' : 'secondary'}
                  size="xs"
                  glow={paymentMode === 'CASH'}
                  leftIcon={<Banknote className="w-3.5 h-3.5" />}
                  onClick={() => setPaymentMode('CASH')}
                >
                  {t.worker.cash}
                </Button>
                <Button
                  type="button"
                  variant={paymentMode === 'UPI' ? 'primary' : 'secondary'}
                  size="xs"
                  glow={paymentMode === 'UPI'}
                  leftIcon={<CreditCard className="w-3.5 h-3.5" />}
                  onClick={() => setPaymentMode('UPI')}
                >
                  {t.worker.upi}
                </Button>
                <Button
                  type="button"
                  variant={paymentMode === 'CREDIT' ? 'amber' : 'secondary'}
                  size="xs"
                  glow={paymentMode === 'CREDIT'}
                  leftIcon={<Clock className="w-3.5 h-3.5" />}
                  onClick={() => setPaymentMode('CREDIT')}
                >
                  {t.worker.creditDue}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Action Button Strip */}
        <div className="flex items-center gap-2 mt-3.5">
          {completedAnim || isCompleted ? (
            <div className="w-full py-2.5 px-4 rounded-xl bg-emerald-50 text-emerald-800 font-bold text-xs flex items-center justify-center gap-1.5 border border-emerald-200/80 shadow-2xs">
              <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
              <span>{t.worker.completedForTrip}</span>
            </div>
          ) : (
            <>
              <Button
                type="button"
                variant="emerald"
                size="md"
                glow
                fullWidth
                isLoading={isSubmitting}
                leftIcon={<PackageCheck className="w-4 h-4 stroke-[2.5]" />}
                onClick={handle1TapDelivery}
                className="text-xs sm:text-sm font-bold shadow-xs py-2.5"
              >
                <span>
                  {isGujarati
                    ? `${t.worker.deliverAction} ${deliverQty} જાર (₹${paymentMode === 'CREDIT' ? '૦ બાકી' : estimatedAmount})`
                    : `Deliver ${deliverQty} Full (₹${paymentMode === 'CREDIT' ? '0 Due' : estimatedAmount})`}
                </span>
              </Button>

              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={() => setShowAdjust(!showAdjust)}
                title="Adjust drop quantities or payment mode"
              >
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showAdjust ? 'rotate-180' : ''}`} />
              </Button>
            </>
          )}
        </div>
      </div>
    </CardSpotlight>
  );
};
