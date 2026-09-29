import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, X, CheckCircle2 } from 'lucide-react';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'button' | 'banner' | 'compact';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ 
  className = '',
  variant = 'compact'
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [installing, setInstalling] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    setInstalling(true);
    try {
      await install();
    } finally {
      setInstalling(false);
    }
  };

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    if (variant === 'banner') {
      return (
        <div className={`bg-gradient-to-r from-cyan-600 to-blue-600 text-white p-3 rounded-xl shadow-md flex items-center justify-between gap-3 ${className}`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold leading-tight truncate">Install App</p>
              <p className="text-[11px] text-cyan-100 leading-tight">Instant offline access on your phone</p>
            </div>
          </div>
          <button
            onClick={handleInstallClick}
            disabled={installing}
            className="px-3 py-1.5 bg-white text-cyan-700 hover:bg-cyan-50 font-bold text-xs rounded-lg shadow-xs transition-colors shrink-0 cursor-pointer"
          >
            {installing ? 'Installing...' : 'Install Now'}
          </button>
        </div>
      );
    }

    return (
      <button
        onClick={handleInstallClick}
        disabled={installing}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer ${className}`}
        title="Install as Mobile/Desktop App"
      >
        <Download className="w-3.5 h-3.5" />
        <span>{installing ? 'Installing...' : 'Install App'}</span>
      </button>
    );
  }

  // iOS Safari flow (beforeinstallprompt is not supported by WebKit)
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors cursor-pointer ${className}`}
          title="Add to Home Screen on iPhone"
        >
          <Smartphone className="w-3.5 h-3.5 text-cyan-600" />
          <span>Add to Phone</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-cyan-600 text-white flex items-center justify-center font-bold">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Install on iPhone</h3>
                    <p className="text-[11px] text-slate-500">Run like a native app</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 space-y-3 text-xs text-slate-700">
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="w-5 h-5 rounded-full bg-cyan-100 text-cyan-700 font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">1</div>
                  <p>In Safari, tap the <strong className="font-semibold text-cyan-700">Share</strong> button at the bottom navigation bar (square with arrow up).</p>
                </div>

                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="w-5 h-5 rounded-full bg-cyan-100 text-cyan-700 font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">2</div>
                  <p>Scroll down the menu and tap <strong className="font-semibold text-cyan-700">"Add to Home Screen"</strong>.</p>
                </div>

                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="w-5 h-5 rounded-full bg-cyan-100 text-cyan-700 font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">3</div>
                  <p>Tap <strong className="font-semibold text-cyan-700">"Add"</strong> in the top right. The app will now appear on your home screen with its app icon!</p>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Got It</span>
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
