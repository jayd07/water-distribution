import React, { useState, useRef, useEffect } from 'react';
import { 
  Droplets, 
  Plus, 
  Boxes, 
  LayoutDashboard, 
  Users, 
  Cloud,
  CloudOff,
  LogIn,
  LogOut,
  Search,
  X,
  Truck,
  IndianRupee,
  ArrowRight,
  MapPin,
  Phone,
  Package,
  Building2,
  ChevronDown,
  UserCheck,
  TrendingUp,
  FileSpreadsheet,
  MoreVertical,
  QrCode,
  Home,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { motion } from 'motion/react';
import { ActiveTab, Customer, InventoryItem, BusinessAccount, UserSessionProfile } from '../types';
import { isRegisteredBusiness } from '../services/businessService';
import { PWAInstallButton } from './PWAInstallButton';
import { Button } from './ui/Button';
import { useLanguage } from '../context/LanguageContext';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenRestock: (itemType?: string) => void;
  onOpenNewDelivery: (customerId?: string) => void;
  onOpenRules: () => void;
  onOpenAuth: () => void;
  onOpenExportAccounting?: () => void;
  onOpenPaymentQR?: () => void;
  isOnline: boolean;
  businessId: string;
  userEmail: string | null;
  onSignOut: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  customers: Customer[];
  inventory: InventoryItem[];
  onOpenSettleDue?: (customer: Customer) => void;
  currentBusiness?: BusinessAccount;
  userSession?: UserSessionProfile | null;
  onOpenBusinessModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenRestock,
  onOpenNewDelivery,
  onOpenRules,
  onOpenAuth,
  onOpenExportAccounting,
  onOpenPaymentQR,
  isOnline,
  userEmail,
  onSignOut,
  searchQuery,
  onSearchChange,
  customers,
  inventory,
  onOpenSettleDue,
  currentBusiness,
  userSession,
  onOpenBusinessModal
}) => {
  const { language, setLanguage, t } = useLanguage();
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const moreMenuContainerRef = useRef<HTMLDivElement>(null);

  // Breadcrumb tab metadata lookup
  const getTabInfo = (tab: ActiveTab) => {
    switch (tab) {
      case 'dashboard':
        return { label: t.nav.dashboard || 'Dashboard', icon: LayoutDashboard };
      case 'orders':
        return { label: t.nav.orders || 'Orders', icon: Package };
      case 'customers':
        return { label: t.nav.customers || 'Customers', icon: Users };
      case 'inventory':
        return { label: t.nav.inventory || 'Inventory', icon: Boxes };
      case 'driver_run':
        return { label: t.nav.driverRun || 'Delivery Run', icon: Truck };
      case 'operations':
        return { label: 'Operations Hub', icon: Truck };
      case 'team':
        return { label: 'Staff & Team', icon: UserCheck };
      case 'analytics':
        return { label: 'Analytics', icon: TrendingUp };
      default:
        return { label: tab, icon: LayoutDashboard };
    }
  };

  // Breadcrumb path tracking (tracks user's path e.g. Home > Dashboard > Analytics)
  const [navPath, setNavPath] = useState<ActiveTab[]>(() => {
    try {
      const stored = sessionStorage.getItem('aquapure_nav_path');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
    return [activeTab];
  });

  // Keep navigation path updated as user browses
  useEffect(() => {
    setNavPath(prev => {
      if (prev[prev.length - 1] === activeTab) return prev;

      const existingIdx = prev.indexOf(activeTab);
      let updated: ActiveTab[];
      if (existingIdx !== -1) {
        updated = prev.slice(0, existingIdx + 1);
      } else {
        if (prev.length >= 3) {
          updated = [prev[0], prev[prev.length - 1], activeTab];
        } else {
          updated = [...prev, activeTab];
        }
      }

      try {
        sessionStorage.setItem('aquapure_nav_path', JSON.stringify(updated));
      } catch {}

      return updated;
    });
  }, [activeTab]);

  const handleNavigateHome = () => {
    setActiveTab('dashboard');
    setNavPath(['dashboard']);
    try {
      sessionStorage.setItem('aquapure_nav_path', JSON.stringify(['dashboard']));
    } catch {}
  };

  const handleNavigateBreadcrumb = (targetTab: ActiveTab, index: number) => {
    setActiveTab(targetTab);
    const updated = navPath.slice(0, index + 1);
    setNavPath(updated);
    try {
      sessionStorage.setItem('aquapure_nav_path', JSON.stringify(updated));
    } catch {}
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (searchContainerRef.current && !searchContainerRef.current.contains(target)) {
        setIsSearchDropdownOpen(false);
      }
      if (moreMenuContainerRef.current && !moreMenuContainerRef.current.contains(target)) {
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Global keyboard shortcuts (Cmd+K / Ctrl+K / / to search, Esc to close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        mobileSearchInputRef.current?.focus();
        setIsSearchDropdownOpen(true);
      } else if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA' &&
        document.activeElement?.tagName !== 'SELECT'
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
        mobileSearchInputRef.current?.focus();
        setIsSearchDropdownOpen(true);
      } else if (e.key === 'Escape') {
        setIsSearchDropdownOpen(false);
        setIsMoreMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const q = searchQuery.toLowerCase().trim();

  // Filter matching customers
  const matchingCustomers = q
    ? customers.filter((c) => {
        return (
          (c.name || '').toLowerCase().includes(q) ||
          (c.phone || '').toLowerCase().includes(q) ||
          (c.address || '').toLowerCase().includes(q) ||
          (c.route || '').toLowerCase().includes(q)
        );
      })
    : [];

  // Filter matching inventory
  const matchingInventory = q
    ? inventory.filter((item) => {
        return (
          (item.displayName || '').toLowerCase().includes(q) ||
          (item.itemType || '').toLowerCase().includes(q)
        );
      })
    : [];

  const totalMatches = matchingCustomers.length + matchingInventory.length;

  const highlightText = (text: string) => {
    if (!q || !text) return text;
    const index = text.toLowerCase().indexOf(q);
    if (index === -1) return text;
    const before = text.substring(0, index);
    const match = text.substring(index, index + q.length);
    const after = text.substring(index + q.length);
    return (
      <span>
        {before}
        <mark className="bg-amber-200/80 text-amber-900 rounded-xs px-0.5 font-semibold not-italic">
          {match}
        </mark>
        {after}
      </span>
    );
  };

  const handleSelectCustomer = (c: Customer) => {
    setActiveTab('customers');
    setIsSearchDropdownOpen(false);
  };

  const handleSelectInventory = (item: InventoryItem) => {
    setActiveTab('inventory');
    setIsSearchDropdownOpen(false);
  };

  const isRegistered = isRegisteredBusiness(currentBusiness);

  const handleQuickDelivery = (e: React.MouseEvent, c: Customer) => {
    e.stopPropagation();
    setIsSearchDropdownOpen(false);
    if (!isRegistered) {
      onOpenBusinessModal?.();
      return;
    }
    onOpenNewDelivery(c.id);
  };

  const handleQuickSettle = (e: React.MouseEvent, c: Customer) => {
    e.stopPropagation();
    setIsSearchDropdownOpen(false);
    if (!isRegistered) {
      onOpenBusinessModal?.();
      return;
    }
    onOpenSettleDue?.(c);
  };

  const handleQuickRestock = (e: React.MouseEvent, item: InventoryItem) => {
    e.stopPropagation();
    setIsSearchDropdownOpen(false);
    if (!isRegistered) {
      onOpenBusinessModal?.();
      return;
    }
    onOpenRestock(item.itemType);
  };

  const handleClearSearch = () => {
    onSearchChange('');
    searchInputRef.current?.focus();
  };

  const businessDisplayName = (() => {
    if (!isRegistered) {
      return 'Register Business';
    }
    if (currentBusiness?.name && currentBusiness.name.trim() !== '') {
      return currentBusiness.name.trim();
    }
    return 'Water Supply Business';
  })();

  const ownerNameDisplay = (() => {
    if (userSession?.role === 'WORKER') {
      return userSession?.workerRecord?.workerName || userSession?.displayName || 'Staff';
    }
    return currentBusiness?.ownerName || userSession?.displayName || (userEmail ? userEmail.split('@')[0] : 'Owner');
  })();

  const userDisplayName = currentBusiness?.ownerName || userSession?.displayName || userSession?.workerRecord?.workerName || (userEmail ? userEmail.split('@')[0] : (userSession?.phoneNumber || 'Owner'));
  const userRoleDisplay = userSession?.role === 'WORKER' ? 'Staff' : 'Owner';

  return (
    <header className="bg-white border-b border-slate-200/90 sticky top-0 z-30 shadow-2xs w-full">
      {/* Shared Page Container Alignment */}
      <div className="max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 bg-white">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-1.5 sm:gap-3 lg:gap-4">
          {/* Left: Brand Logo & Navigation */}
          <div className="flex items-center gap-1.5 sm:gap-3 lg:gap-5 min-w-0 shrink">
            {/* Brand Logo & Business Title */}
            <div 
              id="header-business-badge"
              onClick={() => {
                if (onOpenBusinessModal) {
                  onOpenBusinessModal();
                } else {
                  setActiveTab('dashboard');
                }
              }}
              title={onOpenBusinessModal ? (!isRegistered ? "Click to register your business" : `Active Business: ${businessDisplayName} (${ownerNameDisplay}) - Click to switch or manage`) : "Business Management"}
              className="flex items-center gap-1.5 sm:gap-2.5 p-1 rounded-xl hover:bg-slate-100/80 border border-transparent hover:border-slate-200/80 transition-all cursor-pointer select-none group min-w-0"
            >
              <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-white shadow-2xs transition-all shrink-0 ${
                !isRegistered 
                  ? 'bg-amber-500 group-hover:bg-amber-600' 
                  : 'bg-gradient-to-tr from-sky-600 to-cyan-600 group-hover:from-sky-700 group-hover:to-cyan-700'
              }`}>
                {!isRegistered ? <Building2 className="w-4 h-4 sm:w-5 sm:h-5" /> : <Droplets className="w-4 h-4 sm:w-5 sm:h-5" />}
              </div>
              
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1 min-w-0">
                  <span 
                    id="header-business-name-text"
                    title={businessDisplayName}
                    className={`text-xs xs:text-sm sm:text-base font-bold tracking-tight transition-colors truncate max-w-[100px] xs:max-w-[130px] sm:max-w-[170px] md:max-w-[200px] lg:max-w-[240px] leading-tight select-none ${
                      !isRegistered ? 'text-amber-700 group-hover:text-amber-800' : 'text-slate-900 group-hover:text-sky-600'
                    }`}
                  >
                    {businessDisplayName}
                  </span>
                  {onOpenBusinessModal && (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 shrink-0 transition-transform group-hover:translate-y-0.5" />
                  )}
                </div>
                <div className="flex items-center gap-1 text-[10px] sm:text-[11px] leading-tight">
                  {!isRegistered ? (
                    <span className="text-amber-600 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                      Setup Required
                    </span>
                  ) : (
                    <span 
                      id="header-owner-name-badge"
                      className={`font-semibold inline-flex items-center gap-0.5 truncate max-w-[75px] xs:max-w-[90px] sm:max-w-[130px] ${
                        userSession?.role === 'WORKER' ? 'text-emerald-700' : 'text-slate-600'
                      }`}
                      title={ownerNameDisplay}
                    >
                      {ownerNameDisplay}
                    </span>
                  )}
                  {isRegistered && currentBusiness?.city && (
                    <>
                      <span className="hidden sm:inline text-slate-300">•</span>
                      <span className="hidden sm:inline text-slate-500 truncate max-w-[70px] sm:max-w-[100px]">{currentBusiness.city}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Desktop Navigation Tabs */}
            <nav className="hidden md:flex items-center gap-0.5 bg-slate-100/90 p-0.5 sm:p-1 rounded-xl border border-slate-200/80 shrink-0">
              {userSession?.role === 'WORKER' ? (
                <>
                  <button
                    id="nav-driver-run"
                    onClick={() => setActiveTab('driver_run')}
                    className={`relative flex items-center gap-1.5 h-8 px-2.5 sm:px-3 text-xs font-bold rounded-lg transition-colors cursor-pointer select-none z-10 ${
                      activeTab === 'driver_run'
                        ? 'text-white'
                        : 'text-slate-700 hover:text-slate-900'
                    }`}
                    title="Active Delivery Run"
                  >
                    {activeTab === 'driver_run' && (
                      <motion.div
                        layoutId="header-active-nav"
                        className="absolute inset-0 bg-sky-600 rounded-lg shadow-2xs -z-10"
                        transition={{ type: 'spring', bounce: 0.15, duration: 0.35 }}
                      />
                    )}
                    <Truck className="w-3.5 h-3.5 shrink-0" />
                    <span>Delivery Run</span>
                  </button>

                  <button
                    id="nav-customers"
                    onClick={() => setActiveTab('customers')}
                    className={`relative flex items-center gap-1.5 h-8 px-2.5 sm:px-3 text-xs font-bold rounded-lg transition-colors cursor-pointer select-none z-10 ${
                      activeTab === 'customers'
                        ? 'text-slate-900'
                        : 'text-slate-700 hover:text-slate-900'
                    }`}
                    title="Customers"
                  >
                    {activeTab === 'customers' && (
                      <motion.div
                        layoutId="header-active-nav"
                        className="absolute inset-0 bg-white rounded-lg shadow-2xs -z-10 border border-slate-200/60"
                        transition={{ type: 'spring', bounce: 0.15, duration: 0.35 }}
                      />
                    )}
                    <Users className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                    <span>Customers</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    id="nav-dashboard"
                    onClick={() => setActiveTab('dashboard')}
                    className={`relative flex items-center gap-1.5 h-8 px-2 xl:px-2.5 text-xs rounded-lg transition-colors cursor-pointer select-none z-10 ${
                      activeTab === 'dashboard'
                        ? 'text-slate-900 font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Dashboard"
                  >
                    {activeTab === 'dashboard' && (
                      <motion.div
                        layoutId="header-active-nav"
                        className="absolute inset-0 bg-white rounded-lg shadow-2xs -z-10 border border-slate-200/60"
                        transition={{ type: 'spring', bounce: 0.15, duration: 0.35 }}
                      />
                    )}
                    <LayoutDashboard className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="hidden lg:inline">{t.nav.dashboard}</span>
                  </button>

                  <button
                    id="nav-driver-run"
                    onClick={() => setActiveTab('driver_run')}
                    className={`relative flex items-center gap-1.5 h-8 px-2 xl:px-2.5 text-xs rounded-lg transition-colors cursor-pointer select-none z-10 ${
                      activeTab === 'driver_run'
                        ? 'text-white font-bold'
                        : 'text-sky-700 hover:text-sky-900'
                    }`}
                    title="Field Delivery Run"
                  >
                    {activeTab === 'driver_run' && (
                      <motion.div
                        layoutId="header-active-nav"
                        className="absolute inset-0 bg-sky-600 rounded-lg shadow-2xs -z-10"
                        transition={{ type: 'spring', bounce: 0.15, duration: 0.35 }}
                      />
                    )}
                    <Truck className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden lg:inline">{t.nav.driverRun}</span>
                  </button>

                  <button
                    id="nav-orders"
                    onClick={() => setActiveTab('orders')}
                    className={`relative flex items-center gap-1.5 h-8 px-2 xl:px-2.5 text-xs rounded-lg transition-colors cursor-pointer select-none z-10 ${
                      activeTab === 'orders'
                        ? 'text-slate-900 font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Orders"
                  >
                    {activeTab === 'orders' && (
                      <motion.div
                        layoutId="header-active-nav"
                        className="absolute inset-0 bg-white rounded-lg shadow-2xs -z-10 border border-slate-200/60"
                        transition={{ type: 'spring', bounce: 0.15, duration: 0.35 }}
                      />
                    )}
                    <Package className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                    <span className="hidden lg:inline">{t.nav.orders}</span>
                  </button>

                  <button
                    id="nav-customers"
                    onClick={() => setActiveTab('customers')}
                    className={`relative flex items-center gap-1.5 h-8 px-2 xl:px-2.5 text-xs rounded-lg transition-colors cursor-pointer select-none z-10 ${
                      activeTab === 'customers'
                        ? 'text-slate-900 font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Customers"
                  >
                    {activeTab === 'customers' && (
                      <motion.div
                        layoutId="header-active-nav"
                        className="absolute inset-0 bg-white rounded-lg shadow-2xs -z-10 border border-slate-200/60"
                        transition={{ type: 'spring', bounce: 0.15, duration: 0.35 }}
                      />
                    )}
                    <Users className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="hidden lg:inline">{t.nav.customers}</span>
                  </button>

                  <button
                    id="nav-inventory"
                    onClick={() => setActiveTab('inventory')}
                    className={`relative flex items-center gap-1.5 h-8 px-2 xl:px-2.5 text-xs rounded-lg transition-colors cursor-pointer select-none z-10 ${
                      activeTab === 'inventory'
                        ? 'text-slate-900 font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Inventory"
                  >
                    {activeTab === 'inventory' && (
                      <motion.div
                        layoutId="header-active-nav"
                        className="absolute inset-0 bg-white rounded-lg shadow-2xs -z-10 border border-slate-200/60"
                        transition={{ type: 'spring', bounce: 0.15, duration: 0.35 }}
                      />
                    )}
                    <Boxes className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="hidden lg:inline">{t.nav.inventory}</span>
                  </button>

                  <button
                    id="nav-team"
                    onClick={() => setActiveTab('team')}
                    className={`relative flex items-center gap-1.5 h-8 px-2 xl:px-2.5 text-xs rounded-lg transition-colors cursor-pointer select-none z-10 ${
                      activeTab === 'team'
                        ? 'text-slate-900 font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Staff / Team"
                  >
                    {activeTab === 'team' && (
                      <motion.div
                        layoutId="header-active-nav"
                        className="absolute inset-0 bg-white rounded-lg shadow-2xs -z-10 border border-slate-200/60"
                        transition={{ type: 'spring', bounce: 0.15, duration: 0.35 }}
                      />
                    )}
                    <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="hidden lg:inline">Staff</span>
                  </button>

                  <button
                    id="nav-analytics"
                    onClick={() => setActiveTab('analytics')}
                    className={`relative flex items-center gap-1.5 h-8 px-2 xl:px-2.5 text-xs rounded-lg transition-colors cursor-pointer select-none z-10 ${
                      activeTab === 'analytics'
                        ? 'text-sky-800 font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Analytics"
                  >
                    {activeTab === 'analytics' && (
                      <motion.div
                        layoutId="header-active-nav"
                        className="absolute inset-0 bg-white rounded-lg shadow-2xs -z-10 border border-slate-200/60"
                        transition={{ type: 'spring', bounce: 0.15, duration: 0.35 }}
                      />
                    )}
                    <TrendingUp className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                    <span className="hidden lg:inline">Analytics</span>
                  </button>
                </>
              )}
            </nav>
          </div>

          {/* Center: Global Search Bar (Desktop & Large Tablet) */}
          <div ref={searchContainerRef} className="hidden lg:flex flex-1 min-w-[120px] max-w-[180px] xl:max-w-[220px] relative mx-1">
            <div className="relative w-full flex items-center">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
              <input
                ref={searchInputRef}
                id="global-header-search-desktop"
                type="text"
                placeholder={t.common.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => {
                  onSearchChange(e.target.value);
                  setIsSearchDropdownOpen(true);
                }}
                onFocus={() => setIsSearchDropdownOpen(true)}
                className="w-full pl-8 pr-8 h-9 text-xs bg-slate-100/90 hover:bg-slate-100 focus:bg-white border border-slate-200/90 focus:border-sky-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 text-slate-900 placeholder:text-slate-400 transition-all"
              />
              <div className="absolute right-2 flex items-center gap-1">
                {searchQuery ? (
                  <button
                    onClick={handleClearSearch}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-200/70 transition-colors cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3 h-3" />
                  </button>
                ) : (
                  <kbd className="hidden xl:inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono font-medium text-slate-400 bg-white border border-slate-200 rounded shadow-2xs">
                    ⌘K
                  </kbd>
                )}
              </div>
            </div>

            {/* Desktop Live Filter Dropdown */}
            {isSearchDropdownOpen && searchQuery.trim() && (
              <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100 max-h-[75vh] flex flex-col">
                <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span>
                    Results for <strong>"{searchQuery}"</strong>
                  </span>
                  <span className="font-semibold text-slate-700">
                    {totalMatches} match{totalMatches !== 1 ? 'es' : ''} found
                  </span>
                </div>

                <div className="overflow-y-auto divide-y divide-slate-100 text-xs">
                  {/* Customers Section */}
                  {matchingCustomers.length > 0 && (
                    <div className="p-2">
                      <div className="flex items-center justify-between px-2 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        <span className="flex items-center gap-1.5">
                          <Users className="w-3 h-3 text-sky-600" />
                          Customers ({matchingCustomers.length})
                        </span>
                        <button
                          onClick={() => {
                            setActiveTab('customers');
                            setIsSearchDropdownOpen(false);
                          }}
                          className="text-sky-600 hover:text-sky-700 font-semibold normal-case flex items-center gap-0.5 cursor-pointer"
                        >
                          <span>View table</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="space-y-1 mt-1">
                        {matchingCustomers.slice(0, 5).map((c) => (
                          <div
                            key={c.id}
                            onClick={() => handleSelectCustomer(c)}
                            className="group p-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors flex items-center justify-between cursor-pointer"
                          >
                            <div className="min-w-0 pr-2">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 truncate">
                                  {highlightText(c.name)}
                                </span>
                                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                                  {c.customerType}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                                {c.phone && (
                                  <span className="flex items-center gap-1 truncate">
                                    <Phone className="w-2.5 h-2.5" />
                                    {highlightText(c.phone)}
                                  </span>
                                )}
                                {c.route && (
                                  <span className="flex items-center gap-1 truncate">
                                    <MapPin className="w-2.5 h-2.5" />
                                    {highlightText(c.route)}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {Number(c.dueAmount) > 0 ? (
                                <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">
                                  ₹{c.dueAmount} due
                                </span>
                              ) : (
                                <span className="text-[11px] font-medium text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded">
                                  {c.jarsHolding || 0} jars
                                </span>
                              )}

                              <button
                                onClick={(e) => handleQuickDelivery(e, c)}
                                title="Record delivery for this customer"
                                className="p-1 text-sky-600 hover:bg-sky-50 rounded border border-sky-200 hover:border-sky-300 transition-colors cursor-pointer"
                              >
                                <Truck className="w-3.5 h-3.5" />
                              </button>

                              {Number(c.dueAmount) > 0 && onOpenSettleDue && (
                                <button
                                  onClick={(e) => handleQuickSettle(e, c)}
                                  title="Settle outstanding balance"
                                  className="p-1 text-emerald-600 hover:bg-emerald-50 rounded border border-emerald-200 hover:border-emerald-300 transition-colors cursor-pointer"
                                >
                                  <IndianRupee className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Inventory Section */}
                  {matchingInventory.length > 0 && (
                    <div className="p-2">
                      <div className="flex items-center justify-between px-2 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        <span className="flex items-center gap-1.5">
                          <Boxes className="w-3 h-3 text-indigo-600" />
                          Inventory Items ({matchingInventory.length})
                        </span>
                        <button
                          onClick={() => {
                            setActiveTab('inventory');
                            setIsSearchDropdownOpen(false);
                          }}
                          className="text-sky-600 hover:text-sky-700 font-semibold normal-case flex items-center gap-0.5 cursor-pointer"
                        >
                          <span>View stock</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="space-y-1 mt-1">
                        {matchingInventory.slice(0, 4).map((item) => (
                          <div
                            key={item.itemType}
                            onClick={() => handleSelectInventory(item)}
                            className="group p-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors flex items-center justify-between cursor-pointer"
                          >
                            <div className="min-w-0 pr-2">
                              <span className="font-bold text-slate-900 block truncate">
                                {highlightText(item.displayName || item.itemType)}
                              </span>
                              <span className="text-[11px] text-slate-400 font-mono block">
                                {item.itemType}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <div className="text-right">
                                <span className="text-xs font-bold text-slate-900 block">
                                  {item.availableStock} in warehouse
                                </span>
                                <span className="text-[10px] text-slate-500 block">
                                  ₹{item.unitPrice}/refill
                                </span>
                              </div>

                              {userSession?.role !== 'WORKER' && (
                                <button
                                  onClick={(e) => handleQuickRestock(e, item)}
                                  title="Restock this item"
                                  className="px-2 py-1 text-[11px] font-semibold text-slate-700 bg-white hover:bg-sky-50 hover:text-sky-700 rounded border border-slate-200 hover:border-sky-200 transition-colors cursor-pointer"
                                >
                                  Restock
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Empty state if nothing matched */}
                  {matchingCustomers.length === 0 && matchingInventory.length === 0 && (
                    <div className="py-8 px-4 text-center">
                      <Search className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                      <p className="font-semibold text-slate-800 text-xs">
                        No matches found for "{searchQuery}"
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                        Search by customer name, phone number, delivery route, or bottle type.
                      </p>
                    </div>
                  )}
                </div>

                <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Filters all active tabs simultaneously</span>
                  <button
                    onClick={() => setIsSearchDropdownOpen(false)}
                    className="hover:text-slate-600 font-medium cursor-pointer"
                  >
                    Esc to close
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right: Consolidated Actions & Unified Menu */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Top Navigation Bar Language Switcher (English / ગુજરાતી) */}
            <div 
              id="top-nav-language-switcher"
              className="flex items-center bg-slate-100/90 p-0.5 rounded-xl border border-slate-200/90 shadow-2xs shrink-0" 
              role="group" 
              aria-label="Language selection"
            >
              <button
                type="button"
                id="lang-btn-en"
                onClick={() => setLanguage('en')}
                className={`px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  language === 'en'
                    ? 'bg-white text-sky-700 shadow-2xs font-extrabold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Switch to English"
              >
                <span className="sm:hidden">EN</span>
                <span className="hidden sm:inline">English</span>
              </button>
              <button
                type="button"
                id="lang-btn-gu"
                onClick={() => setLanguage('gu')}
                className={`px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  language === 'gu'
                    ? 'bg-sky-600 text-white shadow-2xs font-extrabold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="ગુજરાતી ભાષા પસંદ કરો"
              >
                <span className="sm:hidden">ગુ</span>
                <span className="hidden sm:inline">ગુજરાતી</span>
              </button>
            </div>

            {/* Primary Action CTA: Record Delivery */}
            <Button
              id="header-new-delivery-btn"
              variant="primary"
              size="sm"
              glow
              leftIcon={<Plus className="w-3.5 h-3.5 stroke-[2.5]" />}
              onClick={() => onOpenNewDelivery()}
              title={t.nav.recordDelivery}
              className="whitespace-nowrap px-2 sm:px-3.5 py-1.5 sm:py-2 text-xs font-bold shrink-0"
            >
              <span className="hidden sm:inline">{t.nav.recordDelivery}</span>
              <span className="sm:hidden">{t.nav.delivery}</span>
            </Button>

            {/* Consolidated Actions & Tools Menu (More ⋮) */}
            <div className="relative shrink-0" ref={moreMenuContainerRef}>
              <Button
                id="header-more-menu-btn"
                variant="secondary"
                size="icon"
                onClick={() => setIsMoreMenuOpen(prev => !prev)}
                title="Tools, Payment & Business Actions"
                className="h-8 w-8 sm:h-9 sm:w-9"
              >
                <MoreVertical className="w-4 h-4 text-slate-600" />
              </Button>

              {isMoreMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                  {/* User Profile Header if authenticated */}
                  {(userEmail || userSession) && (
                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 mb-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 truncate max-w-[130px]">
                          {userDisplayName}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          userSession?.role === 'WORKER' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {userRoleDisplay}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {userEmail || userSession?.phoneNumber || 'Logged in'}
                      </p>
                    </div>
                  )}

                  {/* Payment Section: Dynamic UPI QR Code */}
                  {onOpenPaymentQR && (
                    <button
                      id="header-payment-qr-btn"
                      onClick={() => {
                        setIsMoreMenuOpen(false);
                        onOpenPaymentQR();
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100/70 rounded-lg transition-colors cursor-pointer text-left mb-1"
                    >
                      <span className="flex items-center gap-2">
                        <QrCode className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Payment QR Code</span>
                      </span>
                      <span className="text-[10px] bg-indigo-200/70 text-indigo-900 px-1.5 py-0.2 rounded font-bold">
                        UPI
                      </span>
                    </button>
                  )}

                  {/* Restock Inventory Item (Owner Only) */}
                  {userSession?.role !== 'WORKER' && (
                    <button
                      id="header-more-restock-btn"
                      onClick={() => {
                        setIsMoreMenuOpen(false);
                        onOpenRestock();
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer text-left"
                    >
                      <Boxes className="w-3.5 h-3.5 text-slate-500" />
                      <span>{t.nav.restock}</span>
                    </button>
                  )}

                  {/* Export Day Book & Google Sheets (Owner Only) */}
                  {userSession?.role !== 'WORKER' && onOpenExportAccounting && (
                    <button
                      id="header-more-export-sheets-btn"
                      onClick={() => {
                        setIsMoreMenuOpen(false);
                        onOpenExportAccounting();
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer text-left"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{language === 'gu' ? 'એકાઉન્ટિંગ એક્સપોર્ટ' : 'Export & Google Sheets'}</span>
                    </button>
                  )}

                  {/* Cloud Sync Status Item */}
                  <div className="flex items-center justify-between px-2.5 py-2 text-xs text-slate-600">
                    <span className="flex items-center gap-2">
                      {isOnline ? <Cloud className="w-3.5 h-3.5 text-emerald-600" /> : <CloudOff className="w-3.5 h-3.5 text-amber-500" />}
                      <span>{language === 'gu' ? 'ક્લાઉડ સિન્ક' : 'Cloud Sync'}</span>
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isOnline ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      {isOnline ? (language === 'gu' ? 'સક્રિય' : 'Active') : (language === 'gu' ? 'ઑફલાઇન' : 'Offline')}
                    </span>
                  </div>

                  {/* Manage / Switch Business Action */}
                  {onOpenBusinessModal && (
                    <button
                      onClick={() => {
                        setIsMoreMenuOpen(false);
                        onOpenBusinessModal();
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-2 text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer text-left"
                    >
                      <span className="flex items-center gap-2 truncate">
                        <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="truncate">{currentBusiness?.name ? `${language === 'gu' ? 'વેપાર: ' : 'Business: '}${currentBusiness.name}` : t.nav.manageBusiness}</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium shrink-0 ml-1">{language === 'gu' ? 'બદલો' : 'Switch'}</span>
                    </button>
                  )}

                  {/* PWA Install */}
                  <div className="pt-1 mt-1 border-t border-slate-100">
                    <PWAInstallButton variant="menu-item" />
                  </div>

                  {/* Authentication (Sign In / Logout) */}
                  <div className="border-t border-slate-100 mt-1 pt-1">
                    {(userEmail || userSession) ? (
                      <button
                        id="header-logout-btn"
                        onClick={() => {
                          setIsMoreMenuOpen(false);
                          onSignOut();
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer text-left"
                      >
                        <LogOut className="w-3.5 h-3.5 text-rose-600" />
                        <span>{t.nav.logout}</span>
                      </button>
                    ) : (
                      <button
                        id="header-signin-btn"
                        onClick={() => {
                          setIsMoreMenuOpen(false);
                          if (onOpenBusinessModal) {
                            onOpenBusinessModal();
                          } else {
                            onOpenAuth();
                          }
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer text-left"
                      >
                        <LogIn className="w-3.5 h-3.5 text-slate-500" />
                        <span>{t.nav.signIn}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Breadcrumb Navigation Trail Sub-Bar */}
        <div 
          id="header-breadcrumb-sub-bar" 
          className="border-t border-slate-100/90 py-1 sm:py-1.5 flex items-center min-h-[30px] sm:min-h-[32px] overflow-hidden select-none"
        >
          {/* Desktop View: Full interactive breadcrumb trail */}
          <nav aria-label="Breadcrumb" className="hidden sm:flex items-center justify-between w-full min-w-0">
            <ol className="flex items-center gap-1 list-none m-0 p-0 text-xs min-w-0">
              {/* Home Segment */}
              <li className="flex items-center shrink-0">
                <button
                  type="button"
                  id="breadcrumb-home-btn"
                  onClick={handleNavigateHome}
                  className={`inline-flex items-center gap-1.5 py-0.5 px-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                    activeTab === 'dashboard' && navPath.length === 1
                      ? 'text-slate-900 font-semibold hover:bg-slate-100/60'
                      : 'text-slate-500 hover:text-sky-600 hover:bg-slate-100/80'
                  }`}
                  title="Return to Home Dashboard"
                >
                  <Home className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-600 shrink-0" />
                  <span>{t.nav.home || 'Home'}</span>
                </button>
              </li>

              {/* Path Segments */}
              {navPath.map((tab, idx) => {
                const info = getTabInfo(tab);
                const isCurrent = idx === navPath.length - 1;
                const IconComponent = info.icon;

                return (
                  <React.Fragment key={`${tab}-${idx}`}>
                    <li className="flex items-center text-slate-300 shrink-0 select-none" aria-hidden="true">
                      <ChevronRight className="w-3 h-3 text-slate-400" />
                    </li>
                    <li className="flex items-center min-w-0">
                      {isCurrent ? (
                        <span
                          id={`breadcrumb-item-current-${tab}`}
                          className="inline-flex items-center gap-1.5 py-0.5 px-1.5 font-semibold text-slate-900 truncate max-w-[200px]"
                          aria-current="page"
                        >
                          <IconComponent className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                          <span className="truncate">{info.label}</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          id={`breadcrumb-item-link-${tab}`}
                          onClick={() => handleNavigateBreadcrumb(tab, idx)}
                          className="inline-flex items-center gap-1.5 py-0.5 px-1.5 rounded-md font-medium text-slate-500 hover:text-sky-600 hover:bg-slate-100/80 transition-colors cursor-pointer truncate max-w-[180px]"
                          title={`Navigate to ${info.label}`}
                        >
                          <IconComponent className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{info.label}</span>
                        </button>
                      )}
                    </li>
                  </React.Fragment>
                );
              })}
            </ol>

            {/* Contextual unboxed metadata on right (anti-slop clean typography) */}
            <div className="flex items-center gap-2 text-[11px] text-slate-400 shrink-0 select-none">
              {currentBusiness?.name && (
                <>
                  <span className="truncate max-w-[140px] text-slate-500 font-medium">{currentBusiness.name}</span>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                </>
              )}
              <span className="inline-flex items-center gap-1 text-slate-500">
                <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                <span>{isOnline ? 'Cloud Synced' : 'Offline Mode'}</span>
              </span>
            </div>
          </nav>

          {/* Mobile View: Compact trail with back link and current page */}
          <div className="sm:hidden flex items-center justify-between w-full min-w-0">
            {navPath.length > 1 || activeTab !== 'dashboard' ? (
              <div className="flex items-center gap-1.5 min-w-0">
                <button
                  type="button"
                  id="mobile-breadcrumb-back-btn"
                  onClick={() => {
                    if (navPath.length > 1) {
                      handleNavigateBreadcrumb(navPath[navPath.length - 2], navPath.length - 2);
                    } else {
                      handleNavigateHome();
                    }
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-sky-600 active:text-sky-700 transition-colors py-0.5 px-1.5 rounded-md hover:bg-slate-100/80 cursor-pointer shrink-0"
                  title="Go to previous section"
                >
                  <ChevronLeft className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate max-w-[90px] xs:max-w-[120px]">
                    {t.common.back || 'Back'} {navPath.length > 1 ? `(${getTabInfo(navPath[navPath.length - 2]).label})` : ''}
                  </span>
                </button>
                <span className="text-slate-300 shrink-0 select-none" aria-hidden="true">/</span>
                <div 
                  id="mobile-breadcrumb-current"
                  className="flex items-center gap-1 min-w-0 font-semibold text-slate-900 text-[11px]" 
                  aria-current="page"
                >
                  {React.createElement(getTabInfo(activeTab).icon, { className: 'w-3.5 h-3.5 text-sky-600 shrink-0' })}
                  <span className="truncate max-w-[130px] xs:max-w-[160px]">{getTabInfo(activeTab).label}</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[11px] text-slate-700 min-w-0">
                <Home className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                <span className="font-semibold text-slate-900" aria-current="page">{t.nav.dashboard || 'Dashboard'}</span>
              </div>
            )}

            {/* Mobile Status Indicator */}
            <div className="flex items-center gap-1 text-[10px] text-slate-400 shrink-0">
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span>{isOnline ? 'Live' : 'Offline'}</span>
            </div>
          </div>
        </div>

        {/* Mobile Search Input (Visible on mobile screens) */}
        <div className="md:hidden pb-2 pt-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={mobileSearchInputRef}
              type="text"
              placeholder={t.common.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => {
                onSearchChange(e.target.value);
                setIsSearchDropdownOpen(true);
              }}
              onFocus={() => setIsSearchDropdownOpen(true)}
              className="w-full pl-8 pr-8 h-9 text-xs bg-slate-100/90 focus:bg-white border border-slate-200 focus:border-sky-500 rounded-lg focus:outline-none text-slate-900 shadow-2xs"
            />
            {searchQuery && (
              <button
                onClick={handleClearSearch}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation Bar for Owner (Horizontal scrollable with no-scrollbar) */}
        {userSession?.role !== 'WORKER' && (
          <div id="mobile-owner-nav-bar" className="md:hidden pb-2.5 pt-0.5 overflow-x-auto no-scrollbar -mx-3 px-3">
            <div className="flex items-center gap-1.5 min-w-max">
              <button
                id="mobile-nav-dashboard"
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center gap-1.5 h-7.5 px-2.5 text-xs rounded-lg transition-all cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'bg-sky-600 text-white font-bold shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </button>

              <button
                id="mobile-nav-orders"
                onClick={() => setActiveTab('orders')}
                className={`flex items-center gap-1.5 h-7.5 px-2.5 text-xs rounded-lg transition-all cursor-pointer ${
                  activeTab === 'orders'
                    ? 'bg-sky-600 text-white font-bold shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>Orders</span>
              </button>

              <button
                id="mobile-nav-customers"
                onClick={() => setActiveTab('customers')}
                className={`flex items-center gap-1.5 h-7.5 px-2.5 text-xs rounded-lg transition-all cursor-pointer ${
                  activeTab === 'customers'
                    ? 'bg-sky-600 text-white font-bold shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Customers</span>
              </button>

              <button
                id="mobile-nav-inventory"
                onClick={() => setActiveTab('inventory')}
                className={`flex items-center gap-1.5 h-7.5 px-2.5 text-xs rounded-lg transition-all cursor-pointer ${
                  activeTab === 'inventory'
                    ? 'bg-sky-600 text-white font-bold shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium'
                }`}
              >
                <Boxes className="w-3.5 h-3.5" />
                <span>Inventory</span>
              </button>

              <button
                id="mobile-nav-team"
                onClick={() => setActiveTab('team')}
                className={`flex items-center gap-1.5 h-7.5 px-2.5 text-xs rounded-lg transition-all cursor-pointer ${
                  activeTab === 'team'
                    ? 'bg-sky-600 text-white font-bold shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Staff</span>
              </button>

              <button
                id="mobile-nav-analytics"
                onClick={() => setActiveTab('analytics')}
                className={`flex items-center gap-1.5 h-7.5 px-2.5 text-xs rounded-lg transition-all cursor-pointer ${
                  activeTab === 'analytics'
                    ? 'bg-sky-600 text-white font-bold shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Analytics</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
