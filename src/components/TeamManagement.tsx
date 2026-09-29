import React, { useState } from 'react';
import { 
  Users, 
  UserPlus, 
  Phone, 
  Truck, 
  ShieldCheck, 
  Trash2, 
  Check, 
  AlertCircle, 
  Sparkles,
  MessageSquare,
  Building2,
  Crown,
  Share2
} from 'lucide-react';
import { BusinessAccount, BusinessWorker, WorkerRole, UserSessionProfile } from '../types';
import { 
  assignWorkerToBusiness, 
  removeWorkerFromBusiness, 
  formatPhone, 
  normalizePhone 
} from '../services/businessService';

interface TeamManagementProps {
  business: BusinessAccount;
  workers: BusinessWorker[];
  currentUserSession: UserSessionProfile | null;
  onWorkersUpdated: () => void;
  onSimulateWorkerLogin?: (workerPhone: string, workerName: string) => void;
}

export const TeamManagement: React.FC<TeamManagementProps> = ({
  business,
  workers,
  currentUserSession,
  onWorkersUpdated,
  onSimulateWorkerLogin
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [workerName, setWorkerName] = useState('');
  const [workerPhone, setWorkerPhone] = useState('');
  const [role, setRole] = useState<WorkerRole>('DRIVER');
  const [assignedRoute, setAssignedRoute] = useState('');
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [workerToDelete, setWorkerToDelete] = useState<BusinessWorker | null>(null);
  const [isDeletingWorker, setIsDeletingWorker] = useState(false);

  const isOwner = !currentUserSession || currentUserSession.role === 'OWNER';

  const handleAddWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) {
      setErrorNotice('Unauthorized: Only the business owner can assign staff members.');
      return;
    }
    const cleanPhone = normalizePhone(workerPhone);
    if (!workerName.trim()) {
      setErrorNotice('Please enter worker name');
      return;
    }
    if (cleanPhone.length < 10) {
      setErrorNotice('Please enter a valid 10-digit mobile number');
      return;
    }

    setIsSubmitting(true);
    setErrorNotice(null);

    try {
      const newWorker = await assignWorkerToBusiness(
        business.id,
        {
          workerName: workerName.trim(),
          workerPhone: cleanPhone,
          role,
          assignedRoute: assignedRoute.trim()
        },
        business.ownerPhone
      );

      setWorkerName('');
      setWorkerPhone('');
      setErrorNotice(null);
      setSuccessNotice('Staff member assigned successfully.');
      setIsAdding(false);
      onWorkersUpdated();
    } catch {
      setErrorNotice('Failed to assign worker. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmRemoveWorker = async () => {
    if (!workerToDelete) return;
    if (!isOwner) {
      setErrorNotice('Unauthorized: Only the business owner can remove or delete staff members.');
      setWorkerToDelete(null);
      return;
    }

    setIsDeletingWorker(true);
    try {
      await removeWorkerFromBusiness(workerToDelete.id, business.id, currentUserSession?.role || 'OWNER');
      setSuccessNotice(`Removed worker ${workerToDelete.workerName} from ${business.name}`);
      setWorkerToDelete(null);
      onWorkersUpdated();
    } catch (err: any) {
      setErrorNotice(err?.message || 'Failed to remove worker. Please try again.');
    } finally {
      setIsDeletingWorker(false);
    }
  };

  const handleSendWhatsAppInvite = (worker: BusinessWorker) => {
    const clean = normalizePhone(worker.workerPhone);
    const text = `Hello ${worker.workerName}, you have been assigned to ${business.name} as a ${worker.role} (Route: ${worker.assignedRoute || 'General'}).`;
    const url = `https://wa.me/91${clean}?text=${encodeURIComponent(text)}`;
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner: Business & Ownership Context */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">{business.name} Staff & Workers</h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                  <Crown className="w-3 h-3 text-amber-600" />
                  <span>Owner: {business.ownerName}</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Owner assigns workers by entering their mobile phone number. Workers can then log in using that phone number and choose this business.
              </p>
            </div>
          </div>

          {isOwner && (
            <button
              onClick={() => {
                setIsAdding(!isAdding);
                setErrorNotice(null);
                setSuccessNotice(null);
              }}
              id="assign-worker-btn"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer shrink-0"
            >
              <UserPlus className="w-4 h-4" />
              <span>{isAdding ? 'Close Form' : 'Assign Worker by Phone'}</span>
            </button>
          )}
        </div>

        {/* Success Notice */}
        {successNotice && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-2 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">{successNotice}</p>
            </div>
            <button 
              onClick={() => setSuccessNotice(null)}
              className="text-emerald-700 hover:text-emerald-900 text-xs font-bold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Not Owner Notice */}
        {!isOwner && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              You are logged in as a <strong>Worker</strong>. Only the registered business owner (<strong>{business.ownerName}</strong>, {formatPhone(business.ownerPhone)}) can add or remove workers.
            </span>
          </div>
        )}
      </div>

      {/* Assign Worker by Phone Form */}
      {isAdding && isOwner && (
        <div className="bg-slate-50 border border-sky-200 rounded-2xl p-5 shadow-xs animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-200 text-slate-900">
            <UserPlus className="w-4 h-4 text-sky-600" />
            <h3 className="text-sm font-bold">Assign New Worker by Mobile Phone</h3>
          </div>

          <form onSubmit={handleAddWorker} className="mt-4 space-y-4">
            {errorNotice && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 font-medium">
                {errorNotice}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Worker Full Name *
                </label>
                <input
                  type="text"
                  id="worker-name-input"
                  value={workerName}
                  onChange={e => setWorkerName(e.target.value)}
                  placeholder="e.g. Delivery Driver / Warehouse Staff Name"
                  required
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Worker Mobile Number * (Login Phone)
                </label>
                <div className="flex rounded-xl border border-slate-300 overflow-hidden focus-within:ring-2 focus-within:ring-sky-500/20 focus-within:border-sky-500 bg-white">
                  <span className="px-3 py-2 bg-slate-100 border-r border-slate-300 text-xs font-bold text-slate-600">
                    +91
                  </span>
                  <input
                    type="tel"
                    id="worker-phone-input"
                    value={workerPhone}
                    onChange={e => setWorkerPhone(e.target.value)}
                    placeholder="98765 43210"
                    maxLength={12}
                    required
                    className="w-full px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none"
                  />
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  The worker will use this exact phone number to sign in and access the business.
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Assigned Staff Role
                </label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value as WorkerRole)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
                >
                  <option value="DRIVER">🚚 Delivery Driver (Record Deliveries & Collect Cash/UPI)</option>
                  <option value="DISPATCH_STAFF">📦 Dispatch / Warehouse Staff (Restock & Bottle Audit)</option>
                  <option value="MANAGER">📋 Route Manager (Customer Balance & Jar Accounts)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Assigned Route / Vehicle
                </label>
                <input
                  type="text"
                  value={assignedRoute}
                  onChange={e => setAssignedRoute(e.target.value)}
                  placeholder="e.g. Route 1, North Zone, Vehicle 1"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
                />
              </div>
            </div>

            {/* Explanatory Callout */}
            <div className="p-3 bg-sky-50/70 border border-sky-200/80 rounded-xl text-xs text-sky-900 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-sky-600 mt-0.5 shrink-0" />
              <div className="leading-relaxed">
                <strong>Google Pay for Business Integration:</strong> When this worker logs in using phone number <strong>{workerPhone ? formatPhone(workerPhone) : '[Mobile Number]'}</strong>, they will be given the choice to continue with <strong>{business.name}</strong> as an authorized {role}!
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-300 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                id="submit-assign-worker-btn"
                className="px-5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Assign Worker to Business</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Workers Roster List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Active Assigned Workers ({workers.length})
            </h3>
          </div>
          <span className="text-xs text-slate-500">
            Registered for {business.name}
          </span>
        </div>

        {workers.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200/80 shadow-xs">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No workers assigned yet</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Click "Assign Worker by Phone" above to add drivers or dispatch team members.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {workers.map(w => {
              return (
                <div
                  key={w.id}
                  id={`worker-card-${w.id}`}
                  className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:border-sky-300 transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{w.workerName}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                          {w.role}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <a href={`tel:${w.workerPhone}`} className="hover:text-sky-700 hover:underline">
                          {formatPhone(w.workerPhone)}
                        </a>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Truck className="w-3.5 h-3.5 text-slate-400" />
                        <span>{w.assignedRoute || 'General Delivery Route'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleSendWhatsAppInvite(w)}
                        title="Send WhatsApp details"
                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer border border-emerald-200"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>

                      {isOwner && (
                        <button
                          onClick={() => setWorkerToDelete(w)}
                          title="Remove worker"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Worker Card Footer */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Added {new Date(w.addedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Remove Staff Member Confirmation Modal (Owner Only) */}
      {workerToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-rose-200 animate-in fade-in zoom-in-95 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h4 className="text-base font-bold text-slate-900">Remove Staff Member?</h4>
              <p className="text-xs text-slate-600">
                Are you sure you want to remove <strong>"{workerToDelete.workerName}"</strong> ({formatPhone(workerToDelete.workerPhone)}) from <strong>{business.name}</strong>?
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                They will no longer have access to deliveries, customers, or routes for this business.
              </p>
            </div>

            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-500 text-center font-medium">
              Only the registered business owner can add or remove staff members.
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setWorkerToDelete(null)}
                disabled={isDeletingWorker}
                className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmRemoveWorker}
                disabled={isDeletingWorker}
                className="flex-1 py-2 px-3 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isDeletingWorker ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Removing...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Yes, Remove</span>
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
