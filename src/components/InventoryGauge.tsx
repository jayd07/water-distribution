import React, { useState } from 'react';
import { InventoryItem } from '../types';
import { Plus } from 'lucide-react';

interface InventoryGaugeProps {
  inventory: InventoryItem[];
  onOpenRestock: (itemType?: string) => void;
}

export const InventoryGauge: React.FC<InventoryGaugeProps> = ({ inventory, onOpenRestock }) => {
  const [selectedItemType, setSelectedItemType] = useState<string>('');

  if (inventory.length === 0) {
    return (
      <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Inventory Status</h3>
            <p className="text-xs text-slate-500">Warehouse stock vs customer float</p>
          </div>
          <button
            onClick={() => onOpenRestock()}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-sky-700 hover:text-sky-800 bg-sky-50 hover:bg-sky-100 rounded-lg transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Restock</span>
          </button>
        </div>
        <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center space-y-2">
          <p className="text-xs text-slate-500 font-medium">No inventory stock added yet.</p>
          <button
            onClick={() => onOpenRestock()}
            className="text-xs font-semibold text-sky-600 hover:text-sky-700 cursor-pointer"
          >
            + Add First Stock / Restock
          </button>
        </div>
      </div>
    );
  }

  const activeItemType = selectedItemType || inventory[0].itemType;
  const currentItem = inventory.find(i => i.itemType === activeItemType) || inventory[0];

  const available = Number(currentItem.availableStock) || 0;
  const borrowed = Number(currentItem.borrowedStock) || 0;
  const total = (available + borrowed) || 1;
  const availablePct = total > 0 ? Math.round((available / total) * 100) : 0;
  const borrowedPct = 100 - availablePct;

  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Inventory Status</h3>
          <p className="text-xs text-slate-500">Warehouse stock vs customer float</p>
        </div>
        <button
          onClick={() => onOpenRestock(currentItem.itemType)}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-sky-700 hover:text-sky-800 bg-sky-50 hover:bg-sky-100 rounded-lg transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Restock</span>
        </button>
      </div>

      {/* Item Type Switcher */}
      {inventory.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {inventory.map(item => (
            <button
              key={item.itemType}
              onClick={() => setSelectedItemType(item.itemType)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                activeItemType === item.itemType
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {item.displayName || item.itemType}
            </button>
          ))}
        </div>
      )}

      {/* Stock Proportion Bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-slate-700">Stock Ratio</span>
          <span className="text-slate-500">{availablePct}% available</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden flex">
          <div 
            className="bg-sky-500 h-full rounded-l-full transition-all duration-500"
            style={{ width: `${Math.max(4, availablePct)}%` }}
          />
          <div 
            className="bg-indigo-500 h-full rounded-r-full transition-all duration-500"
            style={{ width: `${Math.max(4, borrowedPct)}%` }}
          />
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
          <span className="text-xs text-slate-500 block">Warehouse Ready</span>
          <span className="text-xl font-bold text-slate-900">{available}</span>
          <span className="text-[11px] text-slate-400 block mt-0.5">Filled & sealed</span>
        </div>

        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
          <span className="text-xs text-slate-500 block">With Customers</span>
          <span className="text-xl font-bold text-slate-900">{borrowed}</span>
          <span className="text-[11px] text-slate-400 block mt-0.5">In market float</span>
        </div>
      </div>

      {/* Rates Footer */}
      <div className="text-xs text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
        <span>Refill Price: <strong className="text-slate-800">₹{currentItem.unitPrice || 35}</strong></span>
        <span>Jar Deposit: <strong className="text-slate-800">₹{currentItem.depositAmount || 150}</strong></span>
      </div>
    </div>
  );
};
