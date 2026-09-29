import React, { useState, useEffect } from 'react';
import { InventoryItem } from '../types';
import { restockInventory } from '../services/deliveryService';
import { X, Boxes, Plus, Check, AlertCircle, IndianRupee } from 'lucide-react';

interface RestockModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: InventoryItem[];
  businessId: string;
  defaultItemType?: string;
  onRestockComplete: (message: string) => void;
}

const DEFAULT_CATALOG_OPTIONS = [
  '20L Chilled Water Jar',
  '20L Normal Jar',
  '10L Easy-Pour Bottle',
  '20L RO Dispenser Jar'
];

export const RestockModal: React.FC<RestockModalProps> = ({
  isOpen,
  onClose,
  inventory,
  businessId,
  defaultItemType,
  onRestockComplete
}) => {
  const [selectedItemType, setSelectedItemType] = useState<string>(
    defaultItemType || (inventory[0]?.itemType || '20L Chilled Water Jar')
  );
  const [customItemType, setCustomItemType] = useState<string>('');
  const [refillCount, setRefillCount] = useState<number>(50);
  const [unitPrice, setUnitPrice] = useState<number>(() => {
    const initItem = inventory.find(i => i.itemType === (defaultItemType || inventory[0]?.itemType));
    return initItem ? (Number(initItem.unitPrice) || 35) : 35;
  });
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentItem = inventory.find(i => i.itemType === selectedItemType);
  const targetItem = selectedItemType === 'CUSTOM' ? customItemType.trim() : selectedItemType;

  // Synchronize unit price when selected item changes or when modal is opened
  useEffect(() => {
    if (!isOpen) return;
    if (selectedItemType === 'CUSTOM') {
      setUnitPrice(35);
    } else {
      const found = inventory.find(i => i.itemType === selectedItemType);
      if (found && found.unitPrice !== undefined) {
        setUnitPrice(Number(found.unitPrice) || 35);
      }
    }
  }, [isOpen, selectedItemType, inventory]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetItem) {
      setErrorMessage('Please specify an item / bottle type.');
      return;
    }
    if (refillCount <= 0) {
      setErrorMessage('Quantity must be greater than 0.');
      return;
    }
    if (unitPrice < 0) {
      setErrorMessage('Unit price cannot be negative.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await restockInventory(businessId, targetItem, Number(refillCount), Number(unitPrice));
      onRestockComplete(`Restocked +${refillCount} units of ${targetItem} (Rate: ₹${unitPrice}/jar)`);
      onClose();
    } catch {
      setErrorMessage('Could not update inventory. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-sm w-full shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Restock Inventory</h3>
            <p className="text-xs text-slate-500">Add filled water jars into warehouse stock</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMessage && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
              Select Inventory Item
            </label>
            <select
              value={selectedItemType}
              onChange={(e) => setSelectedItemType(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              {inventory.length > 0 ? (
                inventory.map((i) => (
                  <option key={i.itemType} value={i.itemType}>
                    {i.displayName || i.itemType} (Current: {i.availableStock} units)
                  </option>
                ))
              ) : (
                DEFAULT_CATALOG_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt} (New Item)
                  </option>
                ))
              )}
              <option value="CUSTOM">+ Custom Bottle / SKU</option>
            </select>
          </div>

          {selectedItemType === 'CUSTOM' && (
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                Custom SKU / Item Name
              </label>
              <input
                type="text"
                value={customItemType}
                onChange={(e) => setCustomItemType(e.target.value)}
                placeholder="e.g. 5L Dispenser Can, 25L Premium Jar"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                required
              />
            </div>
          )}

          {/* SKU Unit Price Input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                SKU Unit Price (₹ / jar)
              </label>
              <span className="text-[11px] text-slate-400">Used during delivery billing</span>
            </div>
            <div className="relative">
              <IndianRupee className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="number"
                min="0"
                step="any"
                value={unitPrice}
                onChange={(e) => setUnitPrice(Number(e.target.value))}
                placeholder="e.g. 35, 40, 60"
                className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                required
              />
            </div>
            {/* Quick Price Presets */}
            <div className="flex items-center gap-1.5 mt-2">
              {[25, 30, 35, 40, 50, 70].map((presetPrice) => (
                <button
                  key={presetPrice}
                  type="button"
                  onClick={() => setUnitPrice(presetPrice)}
                  className={`px-2 py-0.5 text-[11px] font-semibold rounded-md transition-colors cursor-pointer ${
                    unitPrice === presetPrice 
                      ? 'bg-sky-600 text-white shadow-2xs' 
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  ₹{presetPrice}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Quantity of Refilled Jars
              </label>
              {currentItem && (
                <span className="text-[11px] text-slate-400">
                  Current Ready: {currentItem.availableStock}
                </span>
              )}
            </div>
            <input
              type="number"
              min="1"
              max="2000"
              value={refillCount}
              onChange={(e) => setRefillCount(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-base font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
              required
            />
            {/* Quick Add Presets */}
            <div className="flex items-center gap-2 mt-2">
              {[25, 50, 100, 200].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setRefillCount(preset)}
                  className="px-2.5 py-1 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                >
                  +{preset}
                </button>
              ))}
            </div>
          </div>

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
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
                  Restocking...
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  Confirm Restock
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
