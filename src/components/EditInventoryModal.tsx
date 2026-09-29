import React, { useState, useEffect } from 'react';
import { InventoryItem } from '../types';
import { updateInventoryItem, deleteInventoryItem } from '../services/deliveryService';
import { 
  X, 
  Boxes, 
  IndianRupee, 
  Save, 
  Trash2, 
  AlertTriangle, 
  TrendingDown, 
  Plus, 
  Minus,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface EditInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: InventoryItem | null;
  businessId: string;
  onItemUpdated: (message: string) => void;
  onItemDeleted?: (message: string) => void;
}

export const EditInventoryModal: React.FC<EditInventoryModalProps> = ({
  isOpen,
  onClose,
  item,
  businessId,
  onItemUpdated,
  onItemDeleted
}) => {
  const [displayName, setDisplayName] = useState<string>('');
  const [unitPrice, setUnitPrice] = useState<number>(35);
  const [availableStock, setAvailableStock] = useState<number>(100);
  const [borrowedStock, setBorrowedStock] = useState<number>(0);
  const [depositAmount, setDepositAmount] = useState<number>(150);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (item && isOpen) {
      setDisplayName(item.displayName || item.itemType);
      setUnitPrice(Number(item.unitPrice) || 35);
      setAvailableStock(Number(item.availableStock) || 0);
      setBorrowedStock(Number(item.borrowedStock) || 0);
      setDepositAmount(Number(item.depositAmount) || 150);
      setShowDeleteConfirm(false);
      setErrorMessage(null);
    }
  }, [item, isOpen]);

  if (!isOpen || !item) return null;

  const originalStock = Number(item.availableStock) || 0;
  const stockDifference = availableStock - originalStock;

  const handleStockAdjust = (delta: number) => {
    setAvailableStock(prev => Math.max(0, prev + delta));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setErrorMessage('SKU display name cannot be empty.');
      return;
    }
    if (unitPrice < 0) {
      setErrorMessage('Unit price cannot be negative.');
      return;
    }
    if (availableStock < 0) {
      setErrorMessage('Available stock cannot be negative.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await updateInventoryItem(businessId, item.itemType, {
        displayName: displayName.trim(),
        unitPrice: Number(unitPrice),
        availableStock: Number(availableStock),
        borrowedStock: Number(borrowedStock),
        depositAmount: Number(depositAmount),
        totalCapacity: Math.max(Number(availableStock) + Number(borrowedStock), Number(item.totalCapacity) || 0)
      });

      let msg = `Updated ${displayName} (Rate: ₹${unitPrice}/jar, Stock: ${availableStock})`;
      if (stockDifference < 0) {
        msg = `Decreased stock by ${Math.abs(stockDifference)} units for ${displayName} (New stock: ${availableStock})`;
      } else if (stockDifference > 0) {
        msg = `Adjusted stock (+${stockDifference}) for ${displayName} (New stock: ${availableStock})`;
      }

      onItemUpdated(msg);
      onClose();
    } catch {
      setErrorMessage('Could not update SKU. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteInventoryItem(businessId, item.itemType);
      onItemDeleted?.(`Removed SKU ${item.displayName || item.itemType} from inventory`);
      onClose();
    } catch {
      setErrorMessage('Could not delete SKU.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center">
              <Boxes className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">Edit Inventory SKU</h3>
              <p className="text-[11px] text-slate-400 font-mono">{item.itemType}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 overflow-y-auto space-y-4 text-xs">
          {errorMessage && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* SKU Display Name */}
          <div>
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
              SKU Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. 20L Chilled Water Jar"
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white"
              required
            />
          </div>

          {/* Unit Price per Refill */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Unit Price per Jar / Refill (₹)
              </label>
              <span className="text-[11px] text-slate-400">Used for delivery billing</span>
            </div>
            <div className="relative">
              <IndianRupee className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="number"
                min="0"
                step="any"
                value={unitPrice}
                onChange={(e) => setUnitPrice(Number(e.target.value))}
                className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white"
                required
              />
            </div>
            {/* Quick Price Buttons */}
            <div className="flex items-center gap-1.5 mt-2">
              {[25, 30, 35, 40, 50, 60, 70].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setUnitPrice(p)}
                  className={`px-2 py-0.5 text-[11px] font-semibold rounded-md transition-colors cursor-pointer ${
                    unitPrice === p
                      ? 'bg-sky-600 text-white shadow-2xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  ₹{p}
                </button>
              ))}
            </div>
          </div>

          {/* Available Stock with Direct Edit & Decrease Controls */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-[11px] font-bold text-slate-800 uppercase tracking-wider block">
                  Warehouse Ready Stock
                </label>
                <p className="text-[10px] text-slate-500">Filled jars currently in warehouse</p>
              </div>
              <span className="text-xs font-mono font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                Prev: {originalStock}
              </span>
            </div>

            {/* Stepper Controls & Input */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleStockAdjust(-1)}
                className="w-9 h-9 rounded-lg bg-white border border-slate-300 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 text-slate-700 flex items-center justify-center transition-colors cursor-pointer shrink-0 shadow-2xs"
                title="Decrease stock by 1"
              >
                <Minus className="w-4 h-4" />
              </button>
              
              <input
                type="number"
                min="0"
                value={availableStock}
                onChange={(e) => setAvailableStock(Math.max(0, Number(e.target.value) || 0))}
                className="flex-1 text-center py-2 bg-white border border-slate-300 rounded-xl text-base font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
                required
              />

              <button
                type="button"
                onClick={() => handleStockAdjust(1)}
                className="w-9 h-9 rounded-lg bg-white border border-slate-300 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 text-slate-700 flex items-center justify-center transition-colors cursor-pointer shrink-0 shadow-2xs"
                title="Increase stock by 1"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Decrease / Increase Stepper Chips */}
            <div className="flex items-center justify-between pt-1 gap-1 flex-wrap">
              <span className="text-[10px] font-bold text-slate-400">Quick adjust:</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleStockAdjust(-10)}
                  className="px-2 py-0.5 text-[10px] font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 rounded border border-rose-200/60 cursor-pointer"
                  title="Decrease stock by 10 (damaged / count)"
                >
                  -10
                </button>
                <button
                  type="button"
                  onClick={() => handleStockAdjust(-5)}
                  className="px-2 py-0.5 text-[10px] font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 rounded border border-rose-200/60 cursor-pointer"
                  title="Decrease stock by 5"
                >
                  -5
                </button>
                <button
                  type="button"
                  onClick={() => handleStockAdjust(5)}
                  className="px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded border border-emerald-200/60 cursor-pointer"
                >
                  +5
                </button>
                <button
                  type="button"
                  onClick={() => handleStockAdjust(10)}
                  className="px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded border border-emerald-200/60 cursor-pointer"
                >
                  +10
                </button>
                <button
                  type="button"
                  onClick={() => handleStockAdjust(50)}
                  className="px-2 py-0.5 text-[10px] font-bold bg-sky-50 text-sky-700 hover:bg-sky-100 rounded border border-sky-200/60 cursor-pointer"
                >
                  +50
                </button>
              </div>
            </div>

            {/* Stock change notice */}
            {stockDifference !== 0 && (
              <div className={`p-2 rounded-lg text-[11px] font-medium flex items-center justify-between ${
                stockDifference < 0 ? 'bg-amber-50 text-amber-900 border border-amber-200' : 'bg-emerald-50 text-emerald-900 border border-emerald-200'
              }`}>
                <span>{stockDifference < 0 ? `Stock decrease: ${Math.abs(stockDifference)} units (breakage/correction)` : `Stock added: +${stockDifference} units`}</span>
                <span className="font-bold">{availableStock} total</span>
              </div>
            )}
          </div>

          {/* Secondary Details: Borrowed Stock & Deposit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Jars with Accounts
              </label>
              <input
                type="number"
                min="0"
                value={borrowedStock}
                onChange={(e) => setBorrowedStock(Math.max(0, Number(e.target.value) || 0))}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Security Deposit (₹)
              </label>
              <input
                type="number"
                min="0"
                value={depositAmount}
                onChange={(e) => setDepositAmount(Math.max(0, Number(e.target.value) || 0))}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>

          {/* Delete Danger Zone */}
          {showDeleteConfirm ? (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
              <div className="flex items-center gap-1.5 text-rose-800 font-bold">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Confirm SKU Deletion</span>
              </div>
              <p className="text-[11px] text-rose-700">
                Are you sure you want to remove <strong>{displayName}</strong>? Historical deliveries will retain records.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleDelete}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-2xs transition-colors"
                >
                  {isDeleting ? 'Deleting...' : 'Yes, Delete SKU'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 bg-white text-slate-700 hover:bg-slate-100 rounded-lg font-semibold text-xs border border-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete this SKU</span>
              </button>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
