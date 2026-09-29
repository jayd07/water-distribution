import React, { useState } from 'react';
import { Customer, DeliveryLog, BusinessAccount } from '../types';
import { getActiveBusiness } from '../services/businessService';
import { generateWhatsAppReminderText, openWhatsAppChat } from '../utils/upiUtils';
import { 
  Users, 
  Search, 
  MapPin, 
  Phone, 
  Plus, 
  Building2, 
  Home, 
  Truck,
  X,
  RotateCw,
  RotateCcw,
  CreditCard,
  IndianRupee,
  Share2,
  Trash2,
  AlertTriangle,
  Receipt,
  QrCode,
  BellRing,
  Edit2
} from 'lucide-react';

interface CustomerManagementProps {
  customers: Customer[];
  onOpenAddCustomer: () => void;
  onOpenEditCustomer?: (customer: Customer) => void;
  onOpenSettleDue: (customer: Customer) => void;
  onQuickDeliveryToCustomer: (customer: Customer, mode?: 'STANDARD' | 'RETURN_ONLY' | 'DROP_ONLY') => void;
  onOpenPaymentQR?: (amount?: number, note?: string) => void;
  searchQuery?: string;
  onSearchChange?: (term: string) => void;
  onClearSearch?: () => void;
  onRefresh?: () => void;
  onDeleteCustomer?: (customerId: string, customerName: string) => Promise<void> | void;
  onOpenCustomerInvoice?: (customer: Customer) => void;
  userRole?: 'OWNER' | 'WORKER';
  business?: BusinessAccount;
  businessName?: string;
  businessPhone?: string;
}

export const CustomerManagement: React.FC<CustomerManagementProps> = ({
  customers,
  onOpenAddCustomer,
  onOpenEditCustomer,
  onOpenSettleDue,
  onQuickDeliveryToCustomer,
  onOpenPaymentQR,
  searchQuery = '',
  onSearchChange,
  onClearSearch,
  onRefresh,
  onDeleteCustomer,
  onOpenCustomerInvoice,
  userRole = 'OWNER',
  business,
  businessName,
  businessPhone
}) => {
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [isDeletingCustomer, setIsDeletingCustomer] = useState(false);
  const [localSearch, setLocalSearch] = useState('');
  const [routeFilter, setRouteFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'RESIDENTIAL' | 'COMMERCIAL'>('ALL');
  const [dueFilter, setDueFilter] = useState<'ALL' | 'OVERDUE'>('ALL');
  const [isReminderAssistantOpen, setIsReminderAssistantOpen] = useState(false);
  const [includeDueQrInReminders, setIncludeDueQrInReminders] = useState(true);
  const [sentReminders, setSentReminders] = useState<Record<string, boolean>>({});

  const activeBiz = business || getActiveBusiness();
  const effectiveBizName = businessName || activeBiz?.name || 'AquaPure Springs Water Distribution';
  const effectiveBizPhone = businessPhone || activeBiz?.ownerPhone || '';
  // Strictly genuine configured UPI ID only. No default fallback.
  const effectiveUpiId = (activeBiz?.upiId || '').trim();

  // Use searchQuery if provided, else localSearch
  const effectiveSearch = searchQuery !== undefined && searchQuery !== '' ? searchQuery : localSearch;

  const handleSearchInput = (val: string) => {
    setLocalSearch(val);
    onSearchChange?.(val);
  };

  const handleClear = () => {
    setLocalSearch('');
    onSearchChange?.('');
    onClearSearch?.();
  };

  const routes = Array.from(new Set(customers.map(c => c.route?.trim()).filter(Boolean))) as string[];

  const overdueCustomersList = customers.filter(c => (Number(c.dueAmount) || 0) > 0);

  const filteredCustomers = customers.filter((c) => {
    const q = effectiveSearch.toLowerCase().trim();
    const matchesSearch = 
      !q ||
      (c.name || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      (c.address || '').toLowerCase().includes(q) ||
      (c.route || '').toLowerCase().includes(q);
    
    const matchesRoute = routeFilter === 'ALL' || (c.route?.trim() || '') === routeFilter;
    const matchesType = typeFilter === 'ALL' || c.customerType === typeFilter;
    const matchesDue = dueFilter === 'ALL' || (Number(c.dueAmount) || 0) > 0;

    return matchesSearch && matchesRoute && matchesType && matchesDue;
  });

  const totalOutstanding = customers.reduce((sum, c) => sum + (Number(c.dueAmount) || 0), 0);
  const totalCirculation = customers.reduce((sum, c) => sum + (Number(c.jarsHolding) || 0), 0);

  // Send WhatsApp reminder for overdue balance with dynamic transactional QR option
  const handleSendPaymentReminder = (cust: Customer) => {
    const text = generateWhatsAppReminderText({
      customerName: cust.name,
      customerPhone: cust.phone || '',
      dueAmount: Number(cust.dueAmount) || 0,
      jarsHolding: Number(cust.jarsHolding) || 0,
      businessName: effectiveBizName,
      businessPhone: effectiveBizPhone,
      upiId: effectiveUpiId,
      includeQr: includeDueQrInReminders,
      transactionRef: `DUE-${cust.id.replace('cust_', '').toUpperCase()}`
    });

    openWhatsAppChat(cust.phone || '', text);
    setSentReminders(prev => ({ ...prev, [cust.id]: true }));
  };

  // Send WhatsApp bill / balance statement directly to the customer
  const handleSendCustomerBill = (cust: Customer) => {
    if ((Number(cust.dueAmount) || 0) > 0) {
      handleSendPaymentReminder(cust);
      return;
    }

    let cleanPhone = (cust.phone || '').replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }

    const todayStr = new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    const jarsCount = cust.jarsHolding || 0;
    const dueAmt = cust.dueAmount || 0;
    const deposit = cust.depositPaid || 0;

    const billMessage = `*💧 ${effectiveBizName.toUpperCase()}*
*CUSTOMER ACCOUNT BILL & LEDGER STATEMENT*
----------------------------------------
*Date:* ${todayStr}
*Customer:* ${cust.name}
*Phone:* ${cust.phone || 'N/A'}
*Address:* ${cust.address || 'Delivery Location'}
----------------------------------------
*20L Water Jars with You:* ${jarsCount} jar(s)
*Pending Due Balance:* ₹${dueAmt.toLocaleString('en-IN')}
*Security Deposit Paid:* ₹${deposit.toLocaleString('en-IN')}
*Payment Status:* ${dueAmt > 0 ? '⚠️ PAYMENT PENDING' : '✅ ALL DUES SETTLED'}
${effectiveUpiId ? `*UPI ID for Payment:* ${effectiveUpiId}\n` : ''}----------------------------------------
${dueAmt > 0 ? `Please clear the pending balance of *₹${dueAmt.toLocaleString('en-IN')}* via UPI or Cash.\n\n` : ''}Thank you for your business!
${effectiveBizPhone ? `For assistance, contact: ${effectiveBizPhone}` : ''}`;

    const encoded = encodeURIComponent(billMessage);
    const whatsappUrl = cleanPhone.length >= 10
      ? `https://wa.me/${cleanPhone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;

    window.open(whatsappUrl, '_blank');
  };


  // Handle customer deletion
  const handleConfirmDeleteCustomer = async () => {
    if (!customerToDelete || !onDeleteCustomer) return;
    setIsDeletingCustomer(true);
    try {
      await onDeleteCustomer(customerToDelete.id, customerToDelete.name);
      setCustomerToDelete(null);
    } finally {
      setIsDeletingCustomer(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Unified Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Customers
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {filteredCustomers.length} of {customers.length}
            </span>
            {overdueCustomersList.length > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                {overdueCustomersList.length} Overdue
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {totalCirculation} jars in circulation • ₹{totalOutstanding.toLocaleString('en-IN')} pending dues
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {userRole !== 'WORKER' && overdueCustomersList.length > 0 && (
            <button
              onClick={() => setIsReminderAssistantOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
              title="Open WhatsApp reminder assistant to notify overdue customers"
            >
              <BellRing className="w-3.5 h-3.5" />
              <span>Send Due Reminders ({overdueCustomersList.length})</span>
            </button>
          )}

          {onRefresh && (
            <button
              onClick={onRefresh}
              title="Refresh customer list"
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          )}

          <button
            onClick={() => {
              // Reset filters so newly added customer will be immediately visible
              setRouteFilter('ALL');
              setTypeFilter('ALL');
              setDueFilter('ALL');
              onOpenAddCustomer();
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      {/* Global Filter Indicator if search active */}
      {effectiveSearch.trim() && (
        <div className="bg-sky-50/80 border border-sky-200/90 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-sky-900">
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-sky-600 shrink-0" />
            <span>
              Showing results filtered by: <strong>"{effectiveSearch}"</strong> ({filteredCustomers.length} customer{filteredCustomers.length !== 1 ? 's' : ''} found)
            </span>
          </div>
          <button
            onClick={handleClear}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-white hover:bg-sky-100 text-sky-700 font-semibold rounded-md border border-sky-200 text-[11px] transition-colors cursor-pointer"
          >
            <X className="w-3 h-3" />
            <span>Clear search</span>
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Filter by name, phone, address, route..."
            value={effectiveSearch}
            onChange={(e) => handleSearchInput(e.target.value)}
            className="w-full pl-8 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 text-slate-900"
          />
          {effectiveSearch && (
            <button
              onClick={handleClear}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Due filter */}
          <div className="flex items-center p-0.5 bg-slate-100 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setDueFilter('ALL')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                dueFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Dues
            </button>
            <button
              type="button"
              onClick={() => setDueFilter('OVERDUE')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                dueFilter === 'OVERDUE'
                  ? 'bg-rose-600 text-white shadow-2xs font-bold'
                  : 'text-rose-700 hover:text-rose-900'
              }`}
            >
              <span>Overdue Only</span>
              {overdueCustomersList.length > 0 && (
                <span className={`text-[10px] px-1 py-0.2 rounded-full ${dueFilter === 'OVERDUE' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-800'}`}>
                  {overdueCustomersList.length}
                </span>
              )}
            </button>
          </div>

          {/* Route filter */}
          {routes.length > 0 && (
            <select
              value={routeFilter}
              onChange={(e) => setRouteFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
            >
              <option value="ALL">All Routes</option>
              {routes.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          )}

          {/* Type filter */}
          <div className="flex items-center p-0.5 bg-slate-100 rounded-lg text-xs">
            {(['ALL', 'RESIDENTIAL', 'COMMERCIAL'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  typeFilter === type
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {type === 'ALL' ? 'All' : type === 'RESIDENTIAL' ? 'Residential' : 'Commercial'}
              </button>
            ))}
          </div>
        </div>
      </div>


      {/* Customer Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCustomers.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-white rounded-xl border border-slate-200">
            <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700">No customers found</p>
            <p className="text-xs text-slate-400 mt-0.5">Try adjusting search or filters.</p>
          </div>
        ) : (
          filteredCustomers.map((cust) => {
            const hasDue = (cust.dueAmount || 0) > 0;

            return (
              <div
                key={cust.id}
                className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs hover:border-slate-300 transition-colors flex flex-col justify-between space-y-3"
              >
                <div>
                  {/* Top: Name, Type Badge & Route */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                        cust.customerType === 'COMMERCIAL'
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        {cust.customerType === 'COMMERCIAL' ? (
                          <Building2 className="w-4 h-4" />
                        ) : (
                          <Home className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-900 truncate">
                          {cust.name}
                        </h4>
                        <span className="text-[11px] text-slate-500 block truncate">
                          {cust.route?.trim() ? cust.route.trim() : (cust.address || 'No Route Assigned')}
                        </span>
                      </div>
                    </div>

                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                      {cust.customerType}
                    </span>
                  </div>

                  {/* Contact Info */}
                  <div className="mt-2.5 space-y-1 text-xs text-slate-500">
                    <p className="flex items-center gap-1.5 truncate">
                      <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>{cust.phone || 'No phone'}</span>
                    </p>
                    <p className="flex items-center gap-1.5 truncate">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{cust.address || 'Address not listed'}</span>
                    </p>
                  </div>

                  {/* Jars & Due Summary */}
                  <div className="mt-3 p-2.5 bg-slate-50 rounded-lg border border-slate-100 grid grid-cols-3 gap-1 text-center">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Jars Held</span>
                      <strong className="text-xs font-bold text-sky-700">
                        {cust.jarsHolding || 0}
                      </strong>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block">Due Balance</span>
                      <strong className={`text-xs font-bold ${
                        hasDue ? 'text-rose-600' : 'text-emerald-600'
                      }`}>
                        ₹{cust.dueAmount || 0}
                      </strong>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block">Deposit</span>
                      <strong className="text-xs font-medium text-slate-700">
                        ₹{cust.depositPaid || 0}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => onQuickDeliveryToCustomer(cust, 'STANDARD')}
                    className="flex-1 min-w-[65px] inline-flex items-center justify-center gap-1 py-1.5 px-2 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    title="Record a water jar delivery dispatch (Refill / Drop)"
                  >
                    <Truck className="w-3 h-3" />
                    <span>Deliver</span>
                  </button>

                  <button
                    onClick={() => onQuickDeliveryToCustomer(cust, 'RETURN_ONLY')}
                    className="flex-1 min-w-[65px] inline-flex items-center justify-center gap-1 py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    title={`Record empty jars returned from ${cust.name} (${cust.jarsHolding || 0} currently held)`}
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Return</span>
                  </button>

                  <button
                    onClick={() => onOpenSettleDue(cust)}
                    className={`flex-1 min-w-[55px] inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      hasDue
                        ? 'bg-amber-50 hover:bg-amber-100 text-amber-800'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                    title={hasDue ? 'Settle pending due balance' : 'Record payment or advance collection'}
                  >
                    <CreditCard className="w-3 h-3" />
                    <span>{hasDue ? 'Due' : 'Txn'}</span>
                  </button>

                  {/* Send Reminder or Bill to Customer (WhatsApp) - Owner / Manager Only */}
                  {userRole !== 'WORKER' && (
                    hasDue ? (
                      <button
                        onClick={() => handleSendPaymentReminder(cust)}
                        className={`flex-1 min-w-[95px] inline-flex items-center justify-center gap-1 py-1.5 px-2 text-white rounded-lg text-xs font-bold shadow-2xs transition-all cursor-pointer ${
                          sentReminders[cust.id]
                            ? 'bg-emerald-700 hover:bg-emerald-800'
                            : 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800'
                        }`}
                        title={`Send WhatsApp payment reminder to ${cust.name} for ₹${cust.dueAmount}`}
                      >
                        <BellRing className="w-3 h-3" />
                        <span>{sentReminders[cust.id] ? 'Reminded ✓' : 'Reminder'}</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSendCustomerBill(cust)}
                        className="flex-1 min-w-[85px] inline-flex items-center justify-center gap-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                        title={`Send WhatsApp bill and ledger statement to ${cust.name}`}
                      >
                        <Share2 className="w-3 h-3" />
                        <span>Send Bill</span>
                      </button>
                    )
                  )}

                  {/* View/Print Formal Tax Invoice & Ledger - Owner / Manager Only */}
                  {userRole !== 'WORKER' && onOpenCustomerInvoice && (
                    <button
                      onClick={() => onOpenCustomerInvoice(cust)}
                      className="p-1.5 text-slate-500 hover:text-sky-700 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer border border-slate-200"
                      title={`View and print formal bill/invoice for ${cust.name}`}
                    >
                      <Receipt className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Edit Customer Profile & Balances */}
                  {onOpenEditCustomer && (
                    <button
                      onClick={() => onOpenEditCustomer(cust)}
                      className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer border border-slate-200"
                      title={`Edit details for customer ${cust.name}`}
                      aria-label={`Edit customer ${cust.name}`}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Delete Customer (Available to Worker & Owner) */}
                  {onDeleteCustomer && (
                    <button
                      onClick={() => setCustomerToDelete(cust)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title={`Delete customer ${cust.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bulk Overdue Payment Reminder Assistant Modal */}
      {isReminderAssistantOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-amber-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center">
                  <BellRing className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Overdue Payment Reminder Assistant
                  </h3>
                  <p className="text-xs text-slate-500">
                    {overdueCustomersList.length} customer(s) with ₹{totalOutstanding.toLocaleString('en-IN')} pending balance
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsReminderAssistantOpen(false)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1 text-xs">
              {effectiveUpiId ? (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 font-semibold select-none">
                    <input
                      type="checkbox"
                      checked={includeDueQrInReminders}
                      onChange={(e) => setIncludeDueQrInReminders(e.target.checked)}
                      className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300 cursor-pointer"
                    />
                    <span className="flex items-center gap-1.5">
                      <QrCode className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                      <span>Include Dynamic Due Amount QR & Pay Link</span>
                    </span>
                  </label>
                  <span className="text-[11px] font-mono text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200 shrink-0 self-start sm:self-auto">
                    UPI: {effectiveUpiId}
                  </span>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 flex items-center justify-between">
                  <span>No UPI ID configured for this business. Reminders will be sent without QR links.</span>
                </div>
              )}

              {overdueCustomersList.length === 0 ? (
                <div className="py-10 text-center text-slate-500">
                  <p className="font-bold text-sm text-emerald-700">All customer accounts are clear!</p>
                  <p className="text-xs mt-1">No pending due balances at this time.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {overdueCustomersList.map((cust) => (
                    <div
                      key={`overdue-${cust.id}`}
                      className="p-3 bg-white rounded-xl border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-colors flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-900 truncate">{cust.name}</h4>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-medium">
                            {cust.route || 'General'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                          <span>Phone: {cust.phone || 'N/A'}</span>
                          <span>Holding: {cust.jarsHolding || 0} jars</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-semibold text-rose-500 block uppercase">Due Balance</span>
                        <strong className="text-sm font-extrabold text-rose-600">
                          ₹{cust.dueAmount.toLocaleString('en-IN')}
                        </strong>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSendPaymentReminder(cust)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer shrink-0 flex items-center gap-1.5 text-white ${
                          sentReminders[cust.id]
                            ? 'bg-emerald-600 hover:bg-emerald-700'
                            : 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800'
                        }`}
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>{sentReminders[cust.id] ? 'Sent ✓' : 'Send WhatsApp'}</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs">
              <span className="text-slate-500">
                {Object.keys(sentReminders).length} of {overdueCustomersList.length} reminders sent
              </span>
              <button
                type="button"
                onClick={() => setIsReminderAssistantOpen(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Customer Confirmation Modal */}
      {customerToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-rose-200 animate-in fade-in zoom-in-95 duration-150 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">Delete Customer?</h3>
              <p className="text-xs text-slate-600">
                Are you sure you want to remove <strong>"{customerToDelete.name}"</strong>?
              </p>
              {(customerToDelete.dueAmount || 0) > 0 && (
                <p className="text-[11px] text-amber-800 bg-amber-50 rounded-lg p-2 font-medium mt-1">
                  Customer has ₹{customerToDelete.dueAmount} in pending dues and {customerToDelete.jarsHolding || 0} bottle(s) held.
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setCustomerToDelete(null)}
                disabled={isDeletingCustomer}
                className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmDeleteCustomer}
                disabled={isDeletingCustomer}
                className="flex-1 py-2 px-3 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isDeletingCustomer ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

