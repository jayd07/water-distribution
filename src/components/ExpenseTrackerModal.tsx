import React, { useState } from 'react';
import { 
  X, 
  Banknote, 
  Fuel, 
  Wrench, 
  Zap, 
  Users, 
  Plus, 
  Trash2, 
  TrendingDown, 
  Calendar,
  Layers,
  AlertCircle
} from 'lucide-react';
import { BusinessAccount, ExpenseCategory, FieldExpense } from '../types';

interface ExpenseTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  business: BusinessAccount;
  expenses: FieldExpense[];
  currentUserName?: string;
  onAddExpense: (data: {
    category: ExpenseCategory;
    amount: number;
    description: string;
    loggedBy: string;
    vehicleNumber?: string;
  }) => Promise<void>;
  onDeleteExpense: (expenseId: string) => Promise<void>;
}

const CATEGORY_OPTIONS: { category: ExpenseCategory; label: string; icon: any }[] = [
  { category: 'FUEL', label: 'Vehicle Fuel (Diesel/Petrol)', icon: Fuel },
  { category: 'MAINTENANCE', label: 'Vehicle / Plant Maintenance', icon: Wrench },
  { category: 'STAFF_WAGES', label: 'Helper Wage / Driver Allowance', icon: Users },
  { category: 'PLANT_UTILITIES', label: 'RO Plant Electricity / Filters', icon: Zap },
  { category: 'OTHER', label: 'Other Operational Expense', icon: Layers },
];

export const ExpenseTrackerModal: React.FC<ExpenseTrackerModalProps> = ({
  isOpen,
  onClose,
  business,
  expenses,
  currentUserName,
  onAddExpense,
  onDeleteExpense
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [category, setCategory] = useState<ExpenseCategory>('FUEL');
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [vehicleNumber, setVehicleNumber] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const totalSpent = expenses.reduce((acc, e) => acc + (e.amount || 0), 0);
  const todaySpent = expenses
    .filter(e => new Date(e.timestamp).toDateString() === new Date().toDateString())
    .reduce((acc, e) => acc + (e.amount || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setErrorMsg('Please enter a valid expense amount');
      return;
    }
    if (!description.trim()) {
      setErrorMsg('Please enter expense description');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await onAddExpense({
        category,
        amount: numAmount,
        description: description.trim(),
        loggedBy: currentUserName || business.ownerName || 'Staff',
        vehicleNumber: vehicleNumber.trim() || undefined
      });
      setAmount('');
      setDescription('');
      setVehicleNumber('');
      setIsAdding(false);
    } catch (err) {
      setErrorMsg('Failed to log expense. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Field Expenses & Fuel</h3>
              <p className="text-xs text-slate-500">Track operating costs, fuel & driver allowances</p>
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

        {/* Total Cost Stats Strip */}
        <div className="bg-slate-900 text-white p-4.5 grid grid-cols-2 gap-3 text-xs">
          <div className="bg-white/10 rounded-2xl p-3 border border-white/10">
            <span className="text-slate-400 block text-[11px]">Today's Expenses</span>
            <strong className="text-lg font-bold text-rose-400 tabular-nums">
              ₹{todaySpent.toLocaleString()}
            </strong>
          </div>

          <div className="bg-white/10 rounded-2xl p-3 border border-white/10">
            <span className="text-slate-400 block text-[11px]">Total Recorded</span>
            <strong className="text-lg font-bold text-slate-200 tabular-nums">
              ₹{totalSpent.toLocaleString()}
            </strong>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {isAdding ? (
            <form onSubmit={handleSubmit} className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-200">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Log New Expense
              </h4>

              {/* Category Picker */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Expense Category
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORY_OPTIONS.map(({ category: catVal, label }) => (
                    <button
                      key={catVal}
                      type="button"
                      onClick={() => setCategory(catVal)}
                      className={`p-2 rounded-xl text-[11px] font-bold border transition-all text-left truncate ${
                        category === catVal
                          ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {label.split('(')[0].trim()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount & Vehicle */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Amount (₹)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 500"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Vehicle No. (Optional)
                  </label>
                  <input
                    type="text"
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value)}
                    placeholder="e.g. MH 12 AB 1234"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Description / Remarks
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Diesel for morning route, puncture repair"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
                >
                  {isSubmitting ? 'Saving...' : 'Record Expense'}
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Recent Expense Logs ({expenses.length})
              </h4>
              <button
                type="button"
                onClick={() => setIsAdding(true)}
                className="py-2 px-3.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Expense</span>
              </button>
            </div>
          )}

          {/* Expense Log List */}
          <div className="space-y-2">
            {expenses.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500 space-y-2">
                <Banknote className="w-8 h-8 text-slate-400 mx-auto" />
                <p>No field expenses recorded yet.</p>
                <p className="text-[11px] text-slate-400">
                  Log diesel fuel, driver allowances, and plant maintenance to see your true daily net margins.
                </p>
              </div>
            ) : (
              expenses.map((exp, idx) => (
                <div
                  key={`exp_${exp.id || 'ex'}_${idx}`}
                  className="p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 shadow-2xs flex items-center justify-between gap-3"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {exp.description}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                        {exp.category}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400">
                      Logged by {exp.loggedBy} · {new Date(exp.timestamp).toLocaleDateString()} {new Date(exp.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {exp.vehicleNumber && ` · Vehicle: ${exp.vehicleNumber}`}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <strong className="text-sm font-bold text-rose-600 tabular-nums">
                      -₹{exp.amount.toLocaleString()}
                    </strong>
                    <button
                      type="button"
                      onClick={() => onDeleteExpense(exp.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Delete expense"
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
