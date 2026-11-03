import React, { useState } from 'react';
import { 
  X, 
  Truck, 
  Play, 
  CheckCircle2, 
  AlertCircle, 
  Package, 
  RotateCcw, 
  Banknote, 
  ShieldCheck,
  CreditCard,
  FileSpreadsheet,
  Layers,
  ArrowRight
} from 'lucide-react';
import { BusinessAccount, BusinessWorker, DeliveryTrip, InventoryItem } from '../types';

interface VehicleDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'START' | 'COMPLETE';
  business: BusinessAccount;
  activeTrip?: DeliveryTrip | null;
  workers: BusinessWorker[];
  inventory: InventoryItem[];
  currentDriverName?: string;
  currentDriverPhone?: string;
  onStartTrip: (data: {
    driverPhone: string;
    driverName: string;
    vehicleNumber?: string;
    routeName: string;
    loadedFullJars: number;
  }) => Promise<void>;
  onCompleteTrip: (tripId: string, reconciliation: {
    returnedFullJars: number;
    notes?: string;
  }) => Promise<void>;
}

export const VehicleDispatchModal: React.FC<VehicleDispatchModalProps> = ({
  isOpen,
  onClose,
  mode,
  business,
  activeTrip,
  workers,
  inventory,
  currentDriverName,
  currentDriverPhone,
  onStartTrip,
  onCompleteTrip
}) => {
  const normalJarStock = inventory.find(i => i.itemType.toLowerCase().includes('normal') || i.itemType.toLowerCase().includes('20l')) || inventory[0];
  const availableWarehouseStock = normalJarStock?.availableStock || 100;

  // Start Trip Form State
  const [driverName, setDriverName] = useState<string>(currentDriverName || business.ownerName || 'Driver');
  const [driverPhone, setDriverPhone] = useState<string>(currentDriverPhone || business.ownerPhone || '');
  const [vehicleNumber, setVehicleNumber] = useState<string>('');
  const [routeName, setRouteName] = useState<string>('Main Route');
  const [loadedFullJars, setLoadedFullJars] = useState<number>(Math.min(60, availableWarehouseStock));

  // Complete Trip Form State
  const [returnedFullJars, setReturnedFullJars] = useState<number>(activeTrip?.remainingFullJars || 0);
  const [tripNotes, setTripNotes] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverName.trim()) {
      setErrorMessage('Please specify driver name');
      return;
    }
    if (loadedFullJars <= 0) {
      setErrorMessage('Please enter number of full jars loaded onto the vehicle');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await onStartTrip({
        driverName: driverName.trim(),
        driverPhone: driverPhone.trim(),
        vehicleNumber: vehicleNumber.trim(),
        routeName: routeName.trim(),
        loadedFullJars: Number(loadedFullJars)
      });
      onClose();
    } catch (err) {
      setErrorMessage('Failed to start trip. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTrip) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await onCompleteTrip(activeTrip.id, {
        returnedFullJars: Number(returnedFullJars) || 0,
        notes: tripNotes.trim()
      });
      onClose();
    } catch (err) {
      setErrorMessage('Failed to complete trip reconciliation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              mode === 'START' ? 'bg-sky-50 text-sky-600' : 'bg-emerald-50 text-emerald-600'
            }`}>
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {mode === 'START' ? 'Start Vehicle Delivery Run' : 'Trip Reconciliation & Shift End'}
              </h3>
              <p className="text-xs text-slate-500">
                {mode === 'START' ? 'Load vehicle stock & assign route' : 'Audit returns, empties & cash'}
              </p>
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

        {errorMessage && (
          <div className="m-5 p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* MODE A: START RUN */}
        {mode === 'START' && (
          <form onSubmit={handleStartSubmit} className="p-6 space-y-4">
            {/* Driver Picker */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                Assign Driver
              </label>
              <select
                value={driverPhone}
                onChange={(e) => {
                  const selectedPhone = e.target.value;
                  setDriverPhone(selectedPhone);
                  const matched = workers.find(w => w.workerPhone === selectedPhone);
                  if (matched) setDriverName(matched.workerName);
                  else if (selectedPhone === business.ownerPhone) setDriverName(business.ownerName);
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value={business.ownerPhone}>{business.ownerName} (Owner)</option>
                {workers.map((w, idx) => (
                  <option key={`opt_${w.id || 'w'}_${w.workerPhone}_${idx}`} value={w.workerPhone}>
                    {w.workerName} ({w.role} - {w.workerPhone})
                  </option>
                ))}
              </select>
            </div>

            {/* Route & Vehicle */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Route Name
                </label>
                <input
                  type="text"
                  value={routeName}
                  onChange={(e) => setRouteName(e.target.value)}
                  placeholder="e.g. North Colony"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Vehicle No. (Optional)
                </label>
                <input
                  type="text"
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value)}
                  placeholder="e.g. MH 12 AB 1234"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            {/* Loaded Full Jars */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Full Jars Loaded on Vehicle
                </label>
                <span className="text-[11px] text-slate-500">
                  Available in Plant: <strong>{availableWarehouseStock} Jars</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={loadedFullJars}
                  onChange={(e) => setLoadedFullJars(Math.max(1, parseInt(e.target.value, 10) || 0))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                This will track starting vehicle stock and decrement full stock as deliveries are logged.
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
            >
              {isSubmitting ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>Start Active Route Dispatch</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* MODE B: COMPLETE & RECONCILE TRIP */}
        {mode === 'COMPLETE' && activeTrip && (
          <form onSubmit={handleCompleteSubmit} className="p-6 space-y-4">
            
            {/* Audit Summary Box */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Driver & Route</span>
                <strong className="text-slate-900 font-bold">
                  {activeTrip.driverName} ({activeTrip.routeName})
                </strong>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Initial Loaded Stock</span>
                <strong className="text-slate-800 font-bold tabular-nums">
                  {activeTrip.loadedFullJars} Full Jars
                </strong>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Delivered on Route</span>
                <strong className="text-emerald-700 font-bold tabular-nums">
                  {activeTrip.deliveredFullJars} Full Jars
                </strong>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Empty Cans Collected</span>
                <strong className="text-amber-700 font-bold tabular-nums">
                  {activeTrip.collectedEmptyJars} Empty Cans
                </strong>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <span className="text-slate-700 font-bold">Total Cash Collected</span>
                <strong className="text-emerald-600 font-extrabold text-sm tabular-nums">
                  ₹{activeTrip.totalCollected}
                </strong>
              </div>
            </div>

            {/* Returned Unsold Stock Input */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                Full Jars Returned to Warehouse (Unsold)
              </label>
              <input
                type="number"
                min="0"
                value={returnedFullJars}
                onChange={(e) => setReturnedFullJars(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Reconciliation Discrepancy Note */}
            {activeTrip.loadedFullJars - activeTrip.deliveredFullJars !== returnedFullJars && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Stock Variance: </span>
                  Loaded ({activeTrip.loadedFullJars}) - Delivered ({activeTrip.deliveredFullJars}) = {activeTrip.loadedFullJars - activeTrip.deliveredFullJars} remaining. You entered {returnedFullJars}.
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                Shift Summary Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={tripNotes}
                onChange={(e) => setTripNotes(e.target.value)}
                placeholder="e.g. All deliveries completed, 2 bottles extra collected from Sharma Dairy."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              ></textarea>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
            >
              {isSubmitting ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Verify Shift End & Close Trip</span>
                </>
              )}
            </button>
          </form>
        )}

      </div>
    </div>
  );
};
