import React, { useState } from 'react';
import { X, ShieldCheck, Copy, Check, ExternalLink, KeyRound, AlertTriangle, Sparkles, RefreshCw } from 'lucide-react';
import { signInWithGoogle, signOutUser, setStoredUserEmail, firebaseConfig } from '../config/firebase';
import { purgeAllAppCaches } from '../services/cacheService';

interface FirebaseRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string | null;
  onUserChange?: (email: string | null) => void;
}

const FIRESTORE_RULES_TEXT = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /{document=**} {
      allow read, write: if false;
    }

    function isValidId(id) {
      return id is string && id.size() > 0 && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\\\-\\\\.\\\\s]+$');
    }

    function incoming() {
      return request.resource.data;
    }

    function existing() {
      return resource.data;
    }

    function isSignedIn() {
      return request.auth != null;
    }

    function isAdmin() {
      return isSignedIn() && (
        request.auth.token.email == 'jayydhangar09@gmail.com' ||
        exists(/databases/$(database)/documents/admins/$(request.auth.uid))
      );
    }

    function isValidCustomer(data) {
      return data.keys().hasAll(['id', 'name', 'customerType', 'jarsHolding', 'dueAmount', 'depositPaid', 'createdAt']) &&
        data.keys().hasOnly(['id', 'name', 'phone', 'address', 'customerType', 'route', 'jarsHolding', 'dueAmount', 'depositPaid', 'createdAt']) &&
        data.id is string && data.id.size() <= 64 &&
        data.name is string && data.name.size() > 0 && data.name.size() <= 128 &&
        (!('phone' in data) || (data.phone is string && data.phone.size() <= 32)) &&
        (!('address' in data) || (data.address is string && data.address.size() <= 256)) &&
        data.customerType in ['RESIDENTIAL', 'COMMERCIAL'] &&
        (!('route' in data) || (data.route is string && data.route.size() <= 64)) &&
        data.jarsHolding is number && data.jarsHolding >= 0 &&
        data.dueAmount is number && data.dueAmount >= 0 &&
        data.depositPaid is number && data.depositPaid >= 0 &&
        data.createdAt is number;
    }

    function isValidInventory(data) {
      return data.keys().hasAll(['itemType', 'displayName', 'availableStock', 'borrowedStock', 'unitPrice', 'lastUpdated']) &&
        data.keys().hasOnly(['itemType', 'displayName', 'availableStock', 'borrowedStock', 'totalCapacity', 'unitPrice', 'depositAmount', 'lastUpdated']) &&
        data.itemType is string && data.itemType.size() <= 64 &&
        data.displayName is string && data.displayName.size() <= 128 &&
        data.availableStock is number && data.availableStock >= 0 &&
        data.borrowedStock is number && data.borrowedStock >= 0 &&
        (!('totalCapacity' in data) || (data.totalCapacity is number && data.totalCapacity >= 0)) &&
        data.unitPrice is number && data.unitPrice >= 0 &&
        (!('depositAmount' in data) || (data.depositAmount is number && data.depositAmount >= 0)) &&
        data.lastUpdated is number;
    }

    function isValidDelivery(data) {
      return data.keys().hasAll(['id', 'customerId', 'customerName', 'jarsDelivered', 'emptyJarsCollected', 'amountCollected', 'paymentMode', 'timestamp']) &&
        data.keys().hasOnly(['id', 'customerId', 'customerName', 'workerName', 'jarsDelivered', 'emptyJarsCollected', 'amountCollected', 'paymentMode', 'itemType', 'timestamp']) &&
        data.id is string && data.id.size() <= 64 &&
        data.customerId is string && data.customerId.size() <= 64 &&
        data.customerName is string && data.customerName.size() <= 128 &&
        (!('workerName' in data) || (data.workerName is string && data.workerName.size() <= 64)) &&
        data.jarsDelivered is number && data.jarsDelivered >= 0 &&
        data.emptyJarsCollected is number && data.emptyJarsCollected >= 0 &&
        data.amountCollected is number && data.amountCollected >= 0 &&
        data.paymentMode in ['CASH', 'UPI', 'CREDIT'] &&
        (!('itemType' in data) || (data.itemType is string && data.itemType.size() <= 64)) &&
        data.timestamp is number;
    }

    function isValidTransaction(data) {
      return data.keys().hasAll(['id', 'customerId', 'type', 'amount', 'paymentMode', 'timestamp']) &&
        data.keys().hasOnly(['id', 'customerId', 'customerName', 'type', 'amount', 'paymentMode', 'timestamp', 'notes']) &&
        data.id is string && data.id.size() <= 64 &&
        data.customerId is string && data.customerId.size() <= 64 &&
        (!('customerName' in data) || (data.customerName is string && data.customerName.size() <= 128)) &&
        data.type in ['REFILL_PAYMENT', 'DUE_CLEARANCE', 'SECURITY_DEPOSIT'] &&
        data.amount is number && data.amount >= 0 &&
        data.paymentMode in ['CASH', 'UPI', 'BANK_TRANSFER'] &&
        data.timestamp is number &&
        (!('notes' in data) || (data.notes is string && data.notes.size() <= 256));
    }

    match /businesses/{businessId} {
      allow read: if isSignedIn() && isValidId(businessId);
      allow create: if isSignedIn() && isValidId(businessId) && isValidBusiness(incoming()) && incoming().id == businessId;
      allow update: if isSignedIn() && isValidId(businessId) && isValidBusiness(incoming()) && incoming().id == existing().id;
      allow delete: if isAdmin();

      match /customers/{customerId} {
        allow read: if isSignedIn() && isValidId(businessId);
        allow create: if isSignedIn() && isValidId(businessId) && isValidId(customerId) &&
                      isValidCustomer(incoming()) &&
                      incoming().id == customerId;
        allow update: if isSignedIn() && isValidId(businessId) && isValidId(customerId) &&
                      isValidCustomer(incoming()) &&
                      incoming().id == existing().id &&
                      incoming().createdAt == existing().createdAt;
        allow delete: if isAdmin();
      }

      match /inventory/{itemType} {
        allow read: if isSignedIn() && isValidId(businessId);
        allow create: if isSignedIn() && isValidId(businessId) &&
                      isValidInventory(incoming()) &&
                      incoming().itemType == itemType;
        allow update: if isSignedIn() && isValidId(businessId) &&
                      isValidInventory(incoming()) &&
                      incoming().itemType == existing().itemType;
        allow delete: if isAdmin();
      }

      match /deliveries/{deliveryId} {
        allow read: if isSignedIn() && isValidId(businessId);
        allow create: if isSignedIn() && isValidId(businessId) && isValidId(deliveryId) &&
                      isValidDelivery(incoming()) &&
                      incoming().id == deliveryId;
        allow update: if false; // Immutable audit log
        allow delete: if isAdmin();
      }

      match /transactions/{transactionId} {
        allow read: if isSignedIn() && isValidId(businessId);
        allow create: if isSignedIn() && isValidId(businessId) && isValidId(transactionId) &&
                      isValidTransaction(incoming()) &&
                      incoming().id == transactionId;
        allow update: if false; // Immutable financial receipt
        allow delete: if isAdmin();
      }

      match /orders/{orderId} {
        allow read: if isSignedIn() && isValidId(businessId);
        allow create: if isSignedIn() && isValidId(businessId) && isValidId(orderId) &&
                      incoming().id == orderId;
        allow update: if isSignedIn() && isValidId(businessId) && isValidId(orderId) &&
                      incoming().id == existing().id;
        allow delete: if isAdmin();
      }

      match /workers/{workerId} {
        allow read: if isSignedIn() && isValidId(businessId);
        allow write: if isSignedIn() && isValidId(businessId) && isValidId(workerId);
      }
    }

    match /worker_assignments/{assignmentId} {
      allow read: if isSignedIn() && isValidId(assignmentId);
      allow write: if isSignedIn() && isValidId(assignmentId);
    }

    match /{path=**}/workers/{workerId} {
      allow read: if isSignedIn() && isValidId(workerId);
      allow write: if false;
    }

    match /test/{docId} {
      allow read: if isSignedIn() && isValidId(docId);
      allow write: if isAdmin();
    }
  }
}`;

export const FirebaseRulesModal: React.FC<FirebaseRulesModalProps> = ({
  isOpen,
  onClose,
  userEmail,
  onUserChange
}) => {
  const [copied, setCopied] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(FIRESTORE_RULES_TEXT);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      const res = await signInWithGoogle();
      if (res.success && res.email) {
        onUserChange?.(res.email);
      } else if (res.isConfigurationMissing) {
        setAuthError("Google Sign-In is not enabled yet in your Firebase project console. Please enable it in Firebase Console > Authentication.");
      } else if (res.error) {
        setAuthError(res.error);
      }
    } catch {
      setAuthError('Authentication could not be completed.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
      onUserChange?.(null);
    } catch {}
  };

  const activeProjectId = firebaseConfig.projectId || 'silver-champion-8z37z';

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Database Access & Security Rules</h3>
              <p className="text-xs text-slate-500">Project: <span className="font-mono">{activeProjectId}</span></p>
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
          {/* Auth State Card */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Authentication Status</p>
                <p className="text-sm font-bold text-slate-900">
                  {userEmail ? (
                    <span className="text-emerald-700 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      Signed in as {userEmail}
                    </span>
                  ) : (
                    <span className="text-slate-600">Not signed in (Guest session)</span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {userEmail ? (
                <button
                  onClick={handleSignOut}
                  className="px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 rounded-lg border border-rose-200 cursor-pointer"
                >
                  Sign Out
                </button>
              ) : (
                <button
                  onClick={handleGoogleSignIn}
                  disabled={isSigningIn}
                  className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSigningIn ? 'Connecting...' : 'Sign in with Google'}
                </button>
              )}
            </div>
          </div>

          {authError && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <div className="leading-relaxed">
                  <p className="font-semibold">{authError}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <a
                  href={`https://console.firebase.google.com/project/${activeProjectId}/authentication/providers`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded text-xs font-semibold transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Open Firebase Auth Console</span>
                </a>
              </div>
            </div>
          )}


          {/* Quick instructions */}
          <div className="bg-sky-50/80 border border-sky-200 rounded-2xl p-4 text-xs text-sky-950 space-y-2">
            <h4 className="font-bold flex items-center gap-1.5 text-sky-900">
              <AlertTriangle className="w-4 h-4 text-sky-600" />
              Why did "Missing or insufficient permissions" occur?
            </h4>
            <p className="leading-relaxed">
              In Firebase Firestore, new databases enforce default read/write security restrictions. Because <span className="font-semibold font-mono">{firebaseConfig.projectId}</span> is your personal project, security rules must be applied in your Firebase Console.
            </p>
            <ol className="list-decimal list-inside space-y-1 text-slate-700 font-medium">
              <li>Click the <strong>Copy Hardened Rules</strong> button below.</li>
              <li>Click <strong>Open Firebase Console</strong> to visit the Rules editor.</li>
              <li>Replace the existing rules, paste the copied rules, and click <strong>Publish</strong>.</li>
            </ol>
          </div>

          {/* Rules Box */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Hardened Firestore Rules (firestore.rules)
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
                      <span>Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Rules</span>
                    </>
                  )}
                </button>
                <a
                  href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/rules`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded-lg text-xs font-bold border border-sky-200 transition-colors"
                >
                  <span>Firebase Console</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            <pre className="p-3.5 bg-slate-900 text-slate-100 rounded-xl text-[11px] font-mono overflow-x-auto max-h-56 leading-relaxed border border-slate-800">
              {FIRESTORE_RULES_TEXT}
            </pre>
          </div>

          <div className="pt-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 border-t border-slate-100">
            <button
              onClick={async () => {
                await purgeAllAppCaches();
                window.location.reload();
              }}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold rounded-xl cursor-pointer transition-colors"
              title="Purge service worker & browser caches and force reload"
            >
              <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
              <span>Purge Cache & Force Reload</span>
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
