import React, { useState } from 'react';
import { 
  X, 
  Calendar, 
  Plus, 
  Check, 
  Clock, 
  Trash2, 
  Search, 
  Truck, 
  AlertCircle,
  Sparkles,
  Users,
  Edit2
} from 'lucide-react';
import { BusinessAccount, Customer, CustomerSchedule, ScheduleFrequency } from '../types';

interface ScheduleManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  business: BusinessAccount;
  customers: Customer[];
  schedules: CustomerSchedule[];
  onSaveSchedule: (scheduleData: Omit<CustomerSchedule, 'id'> & { id?: string }) => Promise<void>;
  onDeleteSchedule: (scheduleId: string) => Promise<void>;
}

const DAYS_OF_WEEK = [
  { label: 'Sun', value: 0 },
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 }
];

export const ScheduleManagementModal: React.FC<ScheduleManagementModalProps> = ({
  isOpen,
  onClose,
  business,
  customers,
  schedules,
  onSaveSchedule,
  onDeleteSchedule
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState(customers[0]?.id || '');
  const [frequency, setFrequency] = useState<ScheduleFrequency>('DAILY');
  const [customDays, setCustomDays] = useState<number[]>([1, 3, 5]); // Mon, Wed, Fri
  const [defaultQuantity, setDefaultQuantity] = useState<number>(1);
  const [preferredRoute, setPreferredRoute] = useState<string>('Main Route');
  const [active, setActive] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [editScheduleId, setEditScheduleId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartAdd = () => {
    setIsEditing(true);
    setEditScheduleId(null);
    setSelectedCustomerId(customers[0]?.id || '');
    setFrequency('DAILY');
    setDefaultQuantity(1);
    setPreferredRoute(customers[0]?.route || 'Main Route');
    setActive(true);
  };

  const handleStartEdit = (sched: CustomerSchedule) => {
    setIsEditing(true);
    setEditScheduleId(sched.id);
    setSelectedCustomerId(sched.customerId);
    setFrequency(sched.frequency);
    setCustomDays(sched.customDays || [1, 3, 5]);
    setDefaultQuantity(sched.defaultQuantity);
    setPreferredRoute(sched.preferredRoute);
    setActive(sched.active);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cust = customers.find(c => c.id === selectedCustomerId);
    if (!cust) return;

    setIsSubmitting(true);
    try {
      await onSaveSchedule({
        id: editScheduleId || undefined,
        customerId: cust.id,
        customerName: cust.name,
        customerPhone: cust.phone,
        customerAddress: cust.address,
        frequency,
        customDays: frequency === 'CUSTOM' ? customDays : undefined,
        defaultQuantity: Number(defaultQuantity) || 1,
        itemType: 'Normal Jar',
        preferredRoute: preferredRoute || cust.route || 'General Route',
        active
      });
      setIsEditing(false);
      setEditScheduleId(null);
    } catch (err) {
      console.error('Failed to save schedule:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleDay = (dayVal: number) => {
    if (customDays.includes(dayVal)) {
      setCustomDays(customDays.filter(d => d !== dayVal));
    } else {
      setCustomDays([...customDays, dayVal].sort());
    }
  };

  const filteredSchedules = schedules.filter(s => 
    s.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.preferredRoute.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Recurring Delivery Schedules</h3>
              <p className="text-xs text-slate-500">Auto-populates daily route dispatches</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          
          {isEditing ? (
            <form onSubmit={handleSubmit} className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-200">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                {editScheduleId ? 'Edit Delivery Schedule' : 'Create Recurring Delivery Schedule'}
              </h4>

              {/* Customer Selector */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Select Customer
                </label>
                <select
                  disabled={Boolean(editScheduleId)}
                  value={selectedCustomerId}
                  onChange={(e) => {
                    const cid = e.target.value;
                    setSelectedCustomerId(cid);
                    const matched = customers.find(c => c.id === cid);
                    if (matched?.route) setPreferredRoute(matched.route);
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.address || c.route || 'No Route'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Frequency */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: 'Daily (7 Days)', val: 'DAILY' },
                  { label: 'Weekdays (Mon-Sat)', val: 'WEEKDAYS' },
                  { label: 'Alternate Days', val: 'ALTERNATE' },
                  { label: 'Custom Days', val: 'CUSTOM' }
                ].map(({ label, val }) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setFrequency(val as ScheduleFrequency)}
                    className={`py-2 px-2 text-[11px] font-bold rounded-xl border transition-all text-center ${
                      frequency === val
                        ? 'bg-sky-600 text-white border-sky-600 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Custom Days Checkbox Row */}
              {frequency === 'CUSTOM' && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-600 block">
                    Deliver On
                  </label>
                  <div className="flex items-center gap-1.5">
                    {DAYS_OF_WEEK.map(({ label, value }) => {
                      const selected = customDays.includes(value);
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => toggleDay(value)}
                          className={`w-9 h-9 rounded-xl font-bold text-xs flex items-center justify-center border transition-all ${
                            selected
                              ? 'bg-sky-600 text-white border-sky-600'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Default Qty & Route */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Standard Drop Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={defaultQuantity}
                    onChange={(e) => setDefaultQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Delivery Route
                  </label>
                  <input
                    type="text"
                    value={preferredRoute}
                    onChange={(e) => setPreferredRoute(e.target.value)}
                    placeholder="e.g. North Route"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
                >
                  {isSubmitting ? 'Saving...' : 'Save Schedule'}
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by customer or route..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <button
                type="button"
                onClick={handleStartAdd}
                className="py-2 px-3.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Schedule</span>
              </button>
            </div>
          )}

          {/* Schedule List */}
          <div className="space-y-2">
            {filteredSchedules.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500 space-y-2">
                <Calendar className="w-8 h-8 text-slate-400 mx-auto" />
                <p>No recurring customer delivery schedules set yet.</p>
                <p className="text-[11px] text-slate-400">
                  Add recurring schedules to automatically populate daily delivery runs for drivers.
                </p>
              </div>
            ) : (
              filteredSchedules.map((sched, idx) => (
                <div
                  key={`sched_${sched.id || 'sc'}_${idx}`}
                  className="p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-sky-300 shadow-2xs flex items-center justify-between gap-3 transition-colors"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <strong className="text-xs font-bold text-slate-900 truncate">
                        {sched.customerName}
                      </strong>
                      <span className="text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded">
                        {sched.frequency}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-500">
                      <span>Standard Qty: <strong>{sched.defaultQuantity} Jars</strong></span>
                      {sched.preferredRoute && <span>Route: {sched.preferredRoute}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(sched)}
                      className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                      title="Edit schedule"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteSchedule(sched.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Delete schedule"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
