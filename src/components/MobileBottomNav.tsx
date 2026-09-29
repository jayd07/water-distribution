import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  MoreHorizontal, 
  Boxes, 
  UserCheck, 
  Store, 
  X, 
  Truck,
  TrendingUp,
  LogOut,
  CalendarDays,
  Plus,
  QrCode
} from 'lucide-react';
import { ActiveTab, BusinessAccount, UserSessionProfile } from '../types';
import { PWAInstallButton } from './PWAInstallButton';

interface MobileBottomNavProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenNewDelivery: () => void;
  onOpenNewOrder: () => void;
  onOpenPaymentQR?: () => void;
  onOpenBusinessModal?: () => void;
  onOpenRules?: () => void;
  onSignOut?: () => void;
  ordersCount?: number;
  currentBusiness?: BusinessAccount;
  userSession?: UserSessionProfile | null;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  onOpenNewDelivery,
  onOpenNewOrder,
  onOpenPaymentQR,
  onOpenBusinessModal,
  onSignOut,
  ordersCount = 0,
  currentBusiness,
  userSession,
}) => {
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const handleSelectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    setIsMoreOpen(false);
  };

  const isWorker = userSession?.role === 'WORKER';

  return (
    <>
      {/* Slide-up "More" Sheet for Secondary Actions */}
      {isMoreOpen && (
        <div 
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex flex-col justify-end md:hidden animate-in fade-in duration-200"
          onClick={() => setIsMoreOpen(false)}
        >
          <div 
            className="bg-white rounded-t-3xl p-5 shadow-2xl border-t border-slate-200/90 animate-in slide-in-from-bottom duration-250 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sheet Handle */}
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-4" />

            {/* Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-500 text-white flex items-center justify-center shadow-xs">
                  <MoreHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">More Tools & Views</h3>
                  <p className="text-xs text-slate-500 truncate max-w-[200px]">
                    {currentBusiness?.name || 'Water Distribution'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsMoreOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 active:bg-slate-300 flex items-center justify-center text-slate-500 transition-colors cursor-pointer"
                aria-label="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Mobile PWA Install Banner */}
            <div className="mt-3.5">
              <PWAInstallButton variant="banner" />
            </div>

            {/* Grid of secondary features */}
            <div className="mt-3.5 grid grid-cols-2 gap-2.5">
              {!isWorker && (
                <button
                  onClick={() => handleSelectTab('analytics')}
                  className={`p-3.5 rounded-2xl border text-left flex flex-col gap-1.5 transition-all cursor-pointer ${
                    activeTab === 'analytics'
                      ? 'bg-sky-50/90 border-sky-300 text-sky-900 shadow-xs'
                      : 'bg-slate-50/80 hover:bg-slate-100 border-slate-200/80 text-slate-800'
                  }`}
                >
                  <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold block text-slate-900">30D Analytics</span>
                    <span className="text-[11px] text-slate-500">Sales, revenue & charts</span>
                  </div>
                </button>
              )}

              <button
                onClick={() => handleSelectTab('inventory')}
                className={`p-3.5 rounded-2xl border text-left flex flex-col gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'inventory'
                    ? 'bg-sky-50/90 border-sky-300 text-sky-900 shadow-xs'
                    : 'bg-slate-50/80 hover:bg-slate-100 border-slate-200/80 text-slate-800'
                }`}
              >
                <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
                  <Boxes className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold block text-slate-900">Warehouse Stock</span>
                  <span className="text-[11px] text-slate-500">{isWorker ? 'Check stock levels' : 'Restock & track jars'}</span>
                </div>
              </button>

              {!isWorker && (
                <button
                  onClick={() => handleSelectTab('team')}
                  className={`p-3.5 rounded-2xl border text-left flex flex-col gap-1.5 transition-all cursor-pointer ${
                    activeTab === 'team'
                      ? 'bg-emerald-50/90 border-emerald-300 text-emerald-900 shadow-xs'
                      : 'bg-slate-50/80 hover:bg-slate-100 border-slate-200/80 text-slate-800'
                  }`}
                >
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold block text-slate-900">Delivery Staff</span>
                    <span className="text-[11px] text-slate-500">Manage drivers & PINs</span>
                  </div>
                </button>
              )}

              <button
                onClick={() => {
                  setIsMoreOpen(false);
                  onOpenNewOrder();
                }}
                className="p-3.5 rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-cyan-50/80 hover:from-sky-100 hover:to-cyan-100 text-left flex flex-col gap-1.5 transition-all cursor-pointer"
              >
                <div className="w-8 h-8 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-2xs">
                  <CalendarDays className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold block text-sky-950">Book Cooler Order</span>
                  <span className="text-[11px] text-sky-700">Events & Dispenser</span>
                </div>
              </button>
            </div>

            {/* Account switch & Logout actions */}
            <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
              {onOpenBusinessModal && (
                <button
                  onClick={() => {
                    setIsMoreOpen(false);
                    onOpenBusinessModal();
                  }}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold transition-colors cursor-pointer"
                >
                  <Store className="w-4 h-4 text-slate-600" />
                  <span>Switch Business</span>
                </button>
              )}

              {onSignOut && (
                <button
                  id="mobile-drawer-logout-btn"
                  onClick={() => {
                    setIsMoreOpen(false);
                    onSignOut();
                  }}
                  className="flex items-center gap-1.5 text-rose-700 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 px-3.5 py-2 rounded-xl font-bold transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-rose-600" />
                  <span>Sign Out</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Persistent Bottom Bar on Mobile Devices (< 768px) */}
      <nav 
        id="mobile-bottom-navigation"
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200/90 shadow-[0_-4px_24px_rgba(0,0,0,0.07)] px-3 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      >
        <div className="flex items-center justify-around max-w-lg mx-auto">
          {isWorker ? (
            <>
              {/* Worker Profile: Customers Tab */}
              <button
                id="mobile-nav-customers-worker"
                onClick={() => setActiveTab('customers')}
                className={`flex flex-col items-center justify-center flex-1 min-h-[48px] py-1 px-2 rounded-xl transition-all cursor-pointer ${
                  activeTab === 'customers'
                    ? 'text-sky-700 font-bold'
                    : 'text-slate-500 hover:text-slate-800 font-medium'
                }`}
              >
                <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'customers' ? 'bg-sky-50 text-sky-600' : 'text-slate-500'}`}>
                  <Users className="w-5 h-5 stroke-[2.2]" />
                </div>
                <span className="text-[10px] tracking-tight mt-0.5">Customers</span>
              </button>

              {/* Primary Quick Delivery Action (Elevated Floating Center Button) */}
              <div className="relative -top-3.5 px-2">
                <button
                  id="mobile-quick-delivery-btn"
                  onClick={onOpenNewDelivery}
                  aria-label="Record New Delivery"
                  className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-sky-600 via-sky-500 to-cyan-500 text-white flex flex-col items-center justify-center shadow-lg shadow-sky-600/30 hover:shadow-sky-600/40 active:scale-95 transition-all cursor-pointer border-3 border-white ring-1 ring-slate-100"
                >
                  <Truck className="w-5 h-5 stroke-[2.2]" />
                  <span className="text-[8.5px] font-extrabold tracking-tight -mt-0.5">DISPATCH</span>
                </button>
              </div>

              {/* Account / Business Switcher */}
              {onOpenBusinessModal && (
                <button
                  onClick={onOpenBusinessModal}
                  className="flex flex-col items-center justify-center flex-1 min-h-[48px] py-1 px-1 rounded-xl transition-all cursor-pointer text-slate-500 hover:text-slate-800 font-medium"
                >
                  <div className="p-1.5 rounded-xl text-slate-500">
                    <Store className="w-5 h-5 stroke-[2]" />
                  </div>
                  <span className="text-[10px] tracking-tight mt-0.5">Account</span>
                </button>
              )}

              {/* Worker Logout */}
              {onSignOut && (
                <button
                  id="mobile-worker-logout-btn"
                  onClick={onSignOut}
                  className="flex flex-col items-center justify-center flex-1 min-h-[48px] py-1 px-1 rounded-xl transition-all cursor-pointer text-rose-600 hover:text-rose-700 font-medium"
                >
                  <div className="p-1.5 rounded-xl text-rose-500">
                    <LogOut className="w-5 h-5 stroke-[2]" />
                  </div>
                  <span className="text-[10px] font-semibold tracking-tight mt-0.5">Logout</span>
                </button>
              )}
            </>
          ) : (
            <>
              {/* Dashboard / Home */}
              <button
                id="mobile-nav-dashboard"
                onClick={() => setActiveTab('dashboard')}
                className={`flex flex-col items-center justify-center flex-1 min-h-[48px] py-1 px-1 rounded-xl transition-all cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'text-sky-700 font-bold'
                    : 'text-slate-500 hover:text-slate-800 font-medium'
                }`}
              >
                <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-sky-50 text-sky-600' : 'text-slate-500'}`}>
                  <LayoutDashboard className="w-5 h-5 stroke-[2]" />
                </div>
                <span className="text-[10px] tracking-tight mt-0.5">Home</span>
              </button>

              {/* Orders */}
              <button
                id="mobile-nav-orders"
                onClick={() => setActiveTab('orders')}
                className={`flex flex-col items-center justify-center flex-1 min-h-[48px] py-1 px-1 rounded-xl transition-all cursor-pointer relative ${
                  activeTab === 'orders'
                    ? 'text-sky-700 font-bold'
                    : 'text-slate-500 hover:text-slate-800 font-medium'
                }`}
              >
                <div className={`p-1.5 rounded-xl transition-all relative ${activeTab === 'orders' ? 'bg-sky-50 text-sky-600' : 'text-slate-500'}`}>
                  <Package className="w-5 h-5 stroke-[2]" />
                  {ordersCount > 0 && (
                    <span className="absolute -top-0.5 -right-1 bg-rose-500 text-white text-[9px] font-extrabold min-w-4 h-4 px-1 rounded-full flex items-center justify-center border-2 border-white shadow-2xs">
                      {ordersCount > 9 ? '9+' : ordersCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px] tracking-tight mt-0.5">Orders</span>
              </button>

              {/* Primary Quick Delivery Action (Elevated Floating Center Button) */}
              <div className="relative -top-3.5 px-1">
                <button
                  id="mobile-quick-delivery-btn"
                  onClick={onOpenNewDelivery}
                  aria-label="Record New Delivery"
                  className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-sky-600 via-sky-500 to-cyan-500 text-white flex flex-col items-center justify-center shadow-lg shadow-sky-600/30 hover:shadow-sky-600/40 active:scale-95 transition-all cursor-pointer border-3 border-white ring-1 ring-slate-100"
                >
                  <Plus className="w-5 h-5 stroke-[2.5]" />
                  <span className="text-[8.5px] font-extrabold tracking-tight -mt-0.5">DELIVER</span>
                </button>
              </div>

              {/* Customers */}
              <button
                id="mobile-nav-customers"
                onClick={() => setActiveTab('customers')}
                className={`flex flex-col items-center justify-center flex-1 min-h-[48px] py-1 px-1 rounded-xl transition-all cursor-pointer ${
                  activeTab === 'customers'
                    ? 'text-sky-700 font-bold'
                    : 'text-slate-500 hover:text-slate-800 font-medium'
                }`}
              >
                <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'customers' ? 'bg-sky-50 text-sky-600' : 'text-slate-500'}`}>
                  <Users className="w-5 h-5 stroke-[2]" />
                </div>
                <span className="text-[10px] tracking-tight mt-0.5">Clients</span>
              </button>

              {/* More Drawer Trigger */}
              <button
                id="mobile-nav-more"
                onClick={() => setIsMoreOpen(true)}
                className={`flex flex-col items-center justify-center flex-1 min-h-[48px] py-1 px-1 rounded-xl transition-all cursor-pointer ${
                  isMoreOpen || activeTab === 'inventory' || activeTab === 'team' || activeTab === 'analytics'
                    ? 'text-sky-700 font-bold'
                    : 'text-slate-500 hover:text-slate-800 font-medium'
                }`}
              >
                <div className={`p-1.5 rounded-xl transition-all ${isMoreOpen || activeTab === 'inventory' || activeTab === 'team' || activeTab === 'analytics' ? 'bg-sky-50 text-sky-600' : 'text-slate-500'}`}>
                  <MoreHorizontal className="w-5 h-5 stroke-[2]" />
                </div>
                <span className="text-[10px] tracking-tight mt-0.5">More</span>
              </button>
            </>
          )}
        </div>
      </nav>
    </>
  );
};
