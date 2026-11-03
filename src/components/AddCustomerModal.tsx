import React, { useState, useEffect } from 'react';
import { Customer } from '../types';
import { createCustomer, updateCustomer } from '../services/deliveryService';
import { X, Check, AlertCircle, Edit2, UserPlus, MapPin } from 'lucide-react';
import { Button } from './ui/Button';
import { useLanguage } from '../context/LanguageContext';

interface AddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  customerToEdit?: Customer | null;
  onCustomerCreated: (message: string, createdOrUpdatedCustomer?: Customer) => void;
  onOpenRulesModal?: () => void;
  existingRoutes?: string[];
  customers?: Customer[];
}

export const AddCustomerModal: React.FC<AddCustomerModalProps> = ({
  isOpen,
  onClose,
  businessId,
  customerToEdit,
  onCustomerCreated,
  onOpenRulesModal,
  existingRoutes,
  customers = []
}) => {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [customerType, setCustomerType] = useState<'RESIDENTIAL' | 'COMMERCIAL'>('RESIDENTIAL');
  const [route, setRoute] = useState('');
  const [initialJars, setInitialJars] = useState(0);
  const [depositPaid, setDepositPaid] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = Boolean(customerToEdit && customerToEdit.id);

  // Extract unique already entered routes from existing customers
  const availableRoutes: string[] = Array.from(
    new Set(
      (existingRoutes || customers.map(c => c.route?.trim()).filter(Boolean) as string[])
    )
  ).filter(Boolean);

  // Sync form state when modal opens or customerToEdit changes
  useEffect(() => {
    if (isOpen) {
      if (customerToEdit) {
        setName(customerToEdit.name || '');
        setPhone(customerToEdit.phone || '');
        setAddress(customerToEdit.address || '');
        setCustomerType(customerToEdit.customerType || 'RESIDENTIAL');
        setRoute(customerToEdit.route || '');
        setInitialJars(customerToEdit.jarsHolding || 0);
        setDepositPaid(customerToEdit.depositPaid || 0);
      } else {
        setName('');
        setPhone('');
        setAddress('');
        setCustomerType('RESIDENTIAL');
        setRoute('');
        setInitialJars(0);
        setDepositPaid(0);
      }
      setError(null);
    }
  }, [isOpen, customerToEdit]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId || businessId === 'AquaPure_Springs') {
      setError('You must register or select an active business first before managing customers.');
      return;
    }
    if (!name.trim()) {
      setError('Customer name is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (isEditing && customerToEdit) {
        const updated = await updateCustomer(businessId, customerToEdit.id, {
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim(),
          customerType,
          route: route.trim(),
          jarsHolding: Number(initialJars) || 0,
          dueAmount: Number(customerToEdit.dueAmount) || 0,
          depositPaid: Number(depositPaid) || 0
        });

        onCustomerCreated(`Customer "${name.trim()}" updated successfully`, updated || undefined);
      } else {
        const created = await createCustomer(businessId, {
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim(),
          customerType,
          route: route.trim(),
          jarsHolding: Number(initialJars) || 0,
          dueAmount: 0,
          depositPaid: Number(depositPaid) || 0
        });

        onCustomerCreated(`Customer "${name.trim()}" added`, created);
      }
      onClose();
    } catch {
      setError('Could not save customer profile. Please verify your connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              isEditing ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'
            }`}>
              {isEditing ? <Edit2 className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {isEditing ? t.customer.editCustomer : t.customer.newCustomer}
              </h3>
              <p className="text-xs text-slate-500">
                {isEditing ? `Editing ${customerToEdit?.name}` : 'Create a route customer record'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <div>
                  <span className="font-semibold block">{error}</span>
                  {error.includes('security permissions') && onOpenRulesModal && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenRulesModal();
                      }}
                      className="mt-1.5 text-xs text-rose-700 hover:text-rose-900 font-bold underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>Fix Security Permissions</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
              {t.customer.customerBusinessName}
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Customer Name / Business Store"
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                {t.customer.customerType}
              </label>
              <select
                value={customerType}
                onChange={(e) => {
                  const val = e.target.value as 'RESIDENTIAL' | 'COMMERCIAL';
                  setCustomerType(val);
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="RESIDENTIAL">{t.customer.residential}</option>
                <option value="COMMERCIAL">{t.customer.commercial}</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                {t.customer.mobileNumber}
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98xxx xxxxx"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                {t.customer.routeArea}
              </label>
              {availableRoutes.length > 0 && (
                <span className="text-[10px] text-slate-400">
                  {availableRoutes.length} saved route{availableRoutes.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="relative">
              <input
                type="text"
                value={route}
                onChange={(e) => setRoute(e.target.value)}
                placeholder={availableRoutes.length > 0 ? "Select from dropdown or type new route..." : "e.g. Route 1, Ring Road, Sector 5 (Optional)"}
                list="existing-entered-routes-list"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              {availableRoutes.length > 0 && (
                <datalist id="existing-entered-routes-list">
                  {availableRoutes.map((r) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
              )}
            </div>

            {/* Quick clickable chips for already entered routes */}
            {availableRoutes.length > 0 && (
              <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-slate-400 font-medium">Existing:</span>
                {availableRoutes.slice(0, 6).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRoute(r)}
                    className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors cursor-pointer ${
                      route === r
                        ? 'bg-sky-100 text-sky-800 border-sky-300 font-bold'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
              {t.customer.deliveryAddress}
            </label>
            <textarea
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Flat 304, Emerald Court, Sector 12"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                {isEditing ? t.customer.jarsCurrentlyHeld : t.customer.initialJarsIssued}
              </label>
              <input
                type="number"
                min="0"
                value={initialJars}
                onChange={(e) => setInitialJars(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                {t.customer.securityDeposit}
              </label>
              <input
                type="number"
                min="0"
                value={depositPaid}
                onChange={(e) => setDepositPaid(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={onClose}
            >
              {t.common.cancel}
            </Button>
            <Button
              type="submit"
              variant={isEditing ? 'amber' : 'primary'}
              size="md"
              glow
              isLoading={isSubmitting}
              leftIcon={<Check className="w-4 h-4 stroke-[2.5]" />}
            >
              {isEditing ? t.customer.saveChanges : t.customer.createCustomer}
            </Button>
          </div>
        </form>

      </div>
    </div>
  );
};
