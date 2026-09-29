import React, { useState } from 'react';
import { 
  X, 
  LogIn, 
  ShieldCheck, 
  UserCheck, 
  ExternalLink, 
  AlertCircle, 
  Check, 
  Sparkles,
  Truck,
  Store,
  Smartphone,
  ArrowRight
} from 'lucide-react';
import { signInWithGoogle, setStoredUserEmail, firebaseConfig } from '../config/firebase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserEmail: string | null;
  onUserChange: (email: string | null) => void;
  onOpenGPayBusiness?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUserEmail,
  onUserChange,
  onOpenGPayBusiness
}) => {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [configMissing, setConfigMissing] = useState(false);
  const [customName, setCustomName] = useState('');

  if (!isOpen) return null;

  const handleGoogleAuth = async () => {
    setIsSigningIn(true);
    setErrorMessage(null);
    setConfigMissing(false);

    try {
      const res = await signInWithGoogle();
      if (res.success && res.email) {
        onUserChange(res.email);
        onClose();
      } else if (res.isConfigurationMissing) {
        setConfigMissing(true);
        setErrorMessage("Google Sign-In is not enabled yet in your Firebase Project Console.");
      } else if (res.error) {
        setErrorMessage(res.error);
      }
    } catch {
      setErrorMessage("Unable to complete Google authentication.");
    } finally {
      setIsSigningIn(false);
    }
  };

  const activeProjectId = firebaseConfig.projectId || 'silver-champion-8z37z';

  const handleCustomStaffLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;
    const staffId = `${customName.trim().toLowerCase().replace(/\s+/g, '.')}@staff.local`;
    setStoredUserEmail(staffId);
    onUserChange(staffId);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center">
              <LogIn className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Sign In</h3>
              <p className="text-xs text-slate-500">Access manager operations and route dispatch</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Current Status if Logged In */}
          {currentUserEmail && (
            <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-emerald-800">
                <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Currently active as <strong>{currentUserEmail}</strong></span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onUserChange(null);
                  onClose();
                }}
                className="px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100/70 rounded transition-colors cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          )}

          {/* Error Notice */}
          {errorMessage && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <div className="leading-relaxed">
                  <p className="font-semibold">{errorMessage}</p>
                  {configMissing && (
                    <p className="text-amber-800 mt-1">
                      Firebase Authentication needs the Google provider turned on in your Firebase project console.
                    </p>
                  )}
                </div>
              </div>
              {configMissing && (
                <a
                  href={`https://console.firebase.google.com/project/${activeProjectId}/authentication/providers`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded font-semibold transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Firebase Authentication Console</span>
                </a>
              )}
            </div>
          )}

          {/* Option 0: Google Pay Style Business Accounts (Owner / Worker) */}
          {onOpenGPayBusiness && (
            <div className="p-4 rounded-xl border-2 border-sky-300 bg-gradient-to-br from-sky-50/80 to-slate-50 space-y-2.5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center shadow-xs">
                    <Store className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <span>Business Accounts</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-200 text-sky-800 font-bold uppercase">GPay Style</span>
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Login with phone • Choose business • Assign staff
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                id="gpay-business-flow-trigger-btn"
                onClick={() => {
                  onClose();
                  onOpenGPayBusiness();
                }}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Smartphone className="w-3.5 h-3.5 text-sky-400" />
                <span>Phone Login / Business Accounts</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 ml-1" />
              </button>
            </div>
          )}

          {/* Option 1: Verified Google Sign In via Firebase */}
          <div className="space-y-2">
            <button
              type="button"
              id="google-signin-btn"
              onClick={handleGoogleAuth}
              disabled={isSigningIn}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSigningIn ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-slate-700 rounded-full animate-spin"></span>
                  <span>Signing in with Google...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>Sign in with Google Account</span>
                </>
              )}
            </button>
          </div>

          <div className="relative flex py-1 items-center">
            <div className="grow border-t border-slate-200"></div>
            <span className="shrink mx-2 text-[11px] font-medium text-slate-400">or sign in as route staff</span>
            <div className="grow border-t border-slate-200"></div>
          </div>

          {/* Option 2: Staff / Worker Name */}
          <form onSubmit={handleCustomStaffLogin} className="space-y-2.5">
            <label className="block text-xs font-semibold text-slate-700">
              Driver / Route Operator Name
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Enter worker / driver name"
                className="grow px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
              />
              <button
                type="submit"
                disabled={!customName.trim()}
                className="inline-flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 disabled:opacity-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Join</span>
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span>Project: <strong className="font-mono text-slate-700">{activeProjectId}</strong></span>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};

