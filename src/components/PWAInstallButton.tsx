import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, X, CheckCircle2, Monitor } from 'lucide-react';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'button' | 'banner' | 'compact' | 'menu-item';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ 
  className = '',
  variant = 'compact'
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [installing, setInstalling] = useState(false);

  // If already running as an installed standalone PWA, hide the button
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      setInstalling(true);
      try {
        await install();
      } finally {
        setInstalling(false);
      }
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      {variant === 'menu-item' ? (
        <button
          id="download-pwa-app-btn"
          onClick={handleInstallClick}
          disabled={installing}
          className={`w-full flex items-center justify-between px-2.5 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50/70 hover:bg-emerald-100/70 rounded-lg transition-colors cursor-pointer text-left ${className}`}
          title="Download / Install Mobile & Desktop App"
        >
          <span className="flex items-center gap-2">
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>{installing ? 'Installing...' : 'Download App'}</span>
          </span>
          <span className="text-[10px] bg-emerald-200/70 text-emerald-900 px-1.5 py-0.2 rounded font-bold">
            PWA
          </span>
        </button>
      ) : (
        <button
          id="download-pwa-app-btn"
          onClick={handleInstallClick}
          disabled={installing}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer shrink-0 ${className}`}
          title="Download / Install Mobile & Desktop App"
        >
          <Download className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>{installing ? 'Installing...' : 'Download App'}</span>
        </button>
      )}

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold">
                  <Download className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Download AquaPure App</h3>
                  <p className="text-[11px] text-slate-500">Install for offline & quick access</p>
                </div>
              </div>
              <button
                onClick={() => setShowGuide(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3.5 space-y-2.5 text-xs text-slate-700">
              {isIOS ? (
                <>
                  <div className="flex items-start gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">1</div>
                    <p>In Safari, tap the <strong className="font-semibold text-emerald-700">Share</strong> button at bottom.</p>
                  </div>
                  <div className="flex items-start gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">2</div>
                    <p>Scroll and tap <strong className="font-semibold text-emerald-700">"Add to Home Screen"</strong>.</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">
                      <Smartphone className="w-3 h-3" />
                    </div>
                    <div>
                      <strong className="block text-slate-900 font-semibold">Android / Mobile</strong>
                      <p className="text-[11px] text-slate-500">Tap browser menu <strong>(⋮)</strong> $\rightarrow$ tap <strong>"Install App"</strong> or <strong>"Add to Home screen"</strong>.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="w-5 h-5 rounded-full bg-sky-100 text-sky-700 font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">
                      <Monitor className="w-3 h-3" />
                    </div>
                    <div>
                      <strong className="block text-slate-900 font-semibold">Desktop Chrome / Edge</strong>
                      <p className="text-[11px] text-slate-500">Click the <strong>Install App icon (⊕)</strong> in your browser address bar.</p>
                    </div>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => setShowGuide(false)}
              className="mt-4 w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Got It</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};
