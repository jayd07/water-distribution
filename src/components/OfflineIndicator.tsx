import React, { useState, useEffect } from 'react';
import { WifiOff, CheckCircle2 } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [showBackOnlineToast, setShowBackOnlineToast] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowBackOnlineToast(true);
      const timer = setTimeout(() => setShowBackOnlineToast(false), 3000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowBackOnlineToast(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (showBackOnlineToast) {
    return (
      <div className="fixed bottom-20 md:bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-lg animate-in fade-in slide-in-from-bottom-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-300" />
        <span>Back online — Changes synced!</span>
      </div>
    );
  }

  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 md:bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-amber-600 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-lg animate-in fade-in slide-in-from-bottom-2">
      <WifiOff className="w-4 h-4 animate-pulse text-amber-200" />
      <span>Offline Mode — All deliveries & data saved locally!</span>
    </div>
  );
};
