import React, { useState } from 'react';
import { InventoryItem, TransactionRecord } from '../types';
import { updateInventoryItem } from '../services/deliveryService';
import { EditInventoryModal } from './EditInventoryModal';
import { 
  Plus, 
  Clock,
  Search,
  X,
  Boxes,
  Edit2,
  Minus,
  IndianRupee,
  ShieldCheck,
  TrendingDown,
  Sparkles
} from 'lucide-react';

interface WarehouseViewProps {
  inventory: InventoryItem[];
  transactions: TransactionRecord[];
  onOpenRestock: (itemType?: string) => void;
  searchQuery?: string;
  onClearSearch?: () => void;
  onSearchChange?: (term: string) => void;
  businessId?: string;
  onRefresh?: () => void;
  onToast?: (message: string, type?: 'success' | 'error') => void;
  userRole?: 'OWNER' | 'WORKER';
}

export const WarehouseView: React.FC<WarehouseViewProps> = ({
  inventory,
  transactions,
  onOpenRestock,
  searchQuery = '',
  onClearSearch,
  onSearchChange,
  businessId = 'AquaPure_Springs',
  onRefresh,
  onToast,
  userRole = 'OWNER'
}) => {
  const [localSearch, setLocalSearch] = useState('');
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [adjustingStockMap, setAdjustingStockMap] = useState<Record<string, boolean>>({});

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

  const filteredInventory = inventory.filter((item) => {
    if (!effectiveSearch.trim()) return true;
    const q = effectiveSearch.toLowerCase().trim();
    return (
      (item.displayName || '').toLowerCase().includes(q) ||
      (item.itemType || '').toLowerCase().includes(q)
    );
  });

  const filteredTransactions = transactions.filter((tx) => {
    if (!effectiveSearch.trim()) return true;
    const q = effectiveSearch.toLowerCase().trim();
    return (
      (tx.customerName || '').toLowerCase().includes(q) ||
      (tx.customerId || '').toLowerCase().includes(q) ||
      (tx.paymentMode || '').toLowerCase().includes(q) ||
      (tx.notes || '').toLowerCase().includes(q)
    );
  });

  const totalAvailable = inventory.reduce((sum, i) => sum + (Number(i.availableStock) || 0), 0);
  const totalBorrowed = inventory.reduce((sum, i) => sum + (Number(i.borrowedStock) || 0), 0);
  const totalFleet = totalAvailable + totalBorrowed;

  const handleQuickAdjustStock = async (item: InventoryItem, delta: number) => {
    const curStock = Number(item.availableStock) || 0;
    const newStock = Math.max(0, curStock + delta);
    if (newStock === curStock) return;

    setAdjustingStockMap(prev => ({ ...prev, [item.itemType]: true }));
    try {
      await updateInventoryItem(businessId, item.itemType, {
        availableStock: newStock,
        totalCapacity: Math.max(newStock + (Number(item.borrowedStock) || 0), Number(item.totalCapacity) || 0)
      });
      onRefresh?.();
      const actionText = delta < 0 ? `Decreased stock (-${Math.abs(delta)})` : `Added stock (+${delta})`;
      onToast?.(`${actionText} for ${item.displayName || item.itemType}. Ready: ${newStock} jars`, 'success');
    } catch {
      onToast?.('Failed to adjust stock. Please try again.', 'error');
    } finally {
      setAdjustingStockMap(prev => ({ ...prev, [item.itemType]: false }));
    }
  };

  const handleOpenEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setIsEditModalOpen(true);
  };

  return (
    <div className="space-y-5">
      {/* Clean Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Warehouse Inventory
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {filteredInventory.length} of {inventory.length} SKUs
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {totalAvailable} units ready in warehouse • {totalFleet} total fleet assets
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {userRole !== 'WORKER' && (
            <button
              onClick={() => onOpenRestock()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white rounded-lg text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Restock Inventory</span>
            </button>
          )}
        </div>
      </div>

      {/* Global Filter Indicator */}
      {effectiveSearch.trim() && (
        <div className="bg-sky-50/80 border border-sky-200/90 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-sky-900">
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-sky-600 shrink-0" />
            <span>
              Showing inventory filtered by: <strong>"{effectiveSearch}"</strong> ({filteredInventory.length} item{filteredInventory.length !== 1 ? 's' : ''} found)
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

      {/* Inventory Item Cards */}
      {filteredInventory.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200/90 p-8 text-center space-y-3 shadow-2xs">
          <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-800">
              {effectiveSearch.trim() ? `No inventory items match "${effectiveSearch}"` : 'No Inventory Stock Yet'}
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              {effectiveSearch.trim()
                ? 'Try searching by bottle size or jar type (e.g. 20L Chilled, 20L Normal)'
                : (userRole === 'WORKER' ? 'Warehouse stock is currently empty.' : 'Click Restock to add your first batch of water jars into the warehouse.')}
            </p>
          </div>
          {effectiveSearch.trim() ? (
            <button
              onClick={handleClear}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear Filter</span>
            </button>
          ) : (
            userRole !== 'WORKER' && (
              <button
                onClick={() => onOpenRestock()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Restock / Add Stock</span>
              </button>
            )
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredInventory.map((item) => {
            const avail = Number(item.availableStock) || 0;
            const borrowed = Number(item.borrowedStock) || 0;
            const capacity = (avail + borrowed) || (Number(item.totalCapacity) || 1);
            const availPct = Math.round((avail / capacity) * 100);
            const isAdjusting = adjustingStockMap[item.itemType] || false;

            return (
              <div
                key={item.itemType}
                className="bg-white rounded-2xl border border-slate-200/90 p-4.5 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-4 group"
              >
                <div>
                  {/* Card Header with Title & Price + Edit Button */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 pr-1">
                      <h3 className="text-sm font-bold text-slate-900 truncate">
                        {item.displayName || item.itemType}
                      </h3>
                      <span className="text-[11px] text-slate-400 font-mono block truncate">
                        {item.itemType}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs font-bold px-2 py-0.5 bg-sky-50 text-sky-700 border border-sky-100 rounded-md">
                        ₹{item.unitPrice || 35}/jar
                      </span>
                      {userRole !== 'WORKER' && (
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="p-1 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg border border-transparent hover:border-sky-200 transition-colors cursor-pointer"
                          title="Edit SKU (Price, Stock, Details)"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Stock Levels & Quick Stepper */}
                  <div className="mt-3.5 p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-600">Ready in Warehouse:</span>
                      <div className="flex items-center gap-2">
                        {/* Quick Decrease Stock (-1) - Owner Only */}
                        {userRole !== 'WORKER' && (
                          <button
                            disabled={isAdjusting || avail <= 0}
                            onClick={() => handleQuickAdjustStock(item, -1)}
                            className="w-6 h-6 rounded-md bg-white border border-slate-200 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 text-slate-600 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40"
                            title="Decrease warehouse stock by 1 (damaged / manual count)"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                        )}
                        
                        <strong className="text-sm font-extrabold text-slate-900 min-w-[32px] text-center">
                          {avail}
                        </strong>

                        {/* Quick Increase Stock (+1) - Owner Only */}
                        {userRole !== 'WORKER' && (
                          <button
                            disabled={isAdjusting}
                            onClick={() => handleQuickAdjustStock(item, 1)}
                            className="w-6 h-6 rounded-md bg-white border border-slate-200 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 text-slate-600 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40"
                            title="Increase warehouse stock by 1 (refilled jar batch)"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-between text-xs text-slate-500">
                      <span>With Customer Accounts:</span>
                      <strong className="text-slate-800">{borrowed} jars</strong>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-200/80 rounded-full h-2 overflow-hidden flex mt-1">
                      <div
                        className="bg-sky-500 h-full transition-all duration-500"
                        style={{ width: `${availPct}%` }}
                      />
                      <div
                        className="bg-indigo-500 h-full transition-all duration-500"
                        style={{ width: `${100 - availPct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>{availPct}% ready stock</span>
                      <span>Total Fleet: {capacity} jars</span>
                    </div>
                  </div>

                  {/* Spec details */}
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 bg-slate-50/70 rounded-lg border border-slate-100">
                      <span className="text-slate-400 text-[10px] block">Jar Deposit</span>
                      <strong className="text-slate-800">₹{item.depositAmount || 150}</strong>
                    </div>
                    <div className="p-2 bg-slate-50/70 rounded-lg border border-slate-100">
                      <span className="text-slate-400 text-[10px] block">Unit Price</span>
                      <strong className="text-sky-700">₹{item.unitPrice || 35} / refill</strong>
                    </div>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                  <button
                    onClick={() => onOpenRestock(item.itemType)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 bg-sky-50 hover:bg-sky-100 text-sky-700 font-semibold border border-sky-200/80 rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Restock Batch</span>
                  </button>

                  <button
                    onClick={() => handleOpenEdit(item)}
                    className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold border border-slate-200 rounded-xl text-xs transition-colors cursor-pointer"
                    title="Edit SKU Details & Stock"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Transaction & Settlement Ledger */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">
              Recent Transactions & Settlements
            </h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {filteredTransactions.length} of {transactions.length}
            </span>
          </div>
          <span className="text-xs text-slate-400">
            Auto-recorded
          </span>
        </div>

        <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
          {filteredTransactions.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              {effectiveSearch.trim() ? `No transactions matching "${effectiveSearch}".` : 'No transactions recorded yet.'}
            </div>
          ) : (
            filteredTransactions.map((tx) => (
              <div key={tx.id} className="p-3.5 px-4 sm:px-6 hover:bg-slate-50/80 transition-colors flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded uppercase ${
                      tx.type === 'DUE_CLEARANCE'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}>
                      {tx.type === 'DUE_CLEARANCE' ? 'Due Settled' : 'Payment'}
                    </span>
                    <span className="text-xs font-bold text-slate-800">
                      {tx.customerName || `Customer: ${tx.customerId}`}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(tx.timestamp).toLocaleString()}</span>
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-xs font-bold text-emerald-700 block">
                    +₹{tx.amount.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 uppercase">
                    {tx.paymentMode}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Edit Inventory Modal */}
      {editingItem && (
        <EditInventoryModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingItem(null);
          }}
          item={editingItem}
          businessId={businessId}
          onItemUpdated={(msg) => {
            onRefresh?.();
            onToast?.(msg, 'success');
          }}
          onItemDeleted={(msg) => {
            onRefresh?.();
            onToast?.(msg, 'success');
          }}
        />
      )}
    </div>
  );
};
