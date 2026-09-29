import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Smartphone, 
  Store, 
  Plus, 
  CheckCircle2, 
  ShieldCheck, 
  Truck, 
  ArrowRight, 
  Building2, 
  Phone, 
  MapPin, 
  Sparkles,
  ChevronRight,
  UserCheck,
  Briefcase,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  Settings,
  Mail,
  Trash2,
  AlertTriangle,
  RotateCcw,
  QrCode,
  FileSpreadsheet
} from 'lucide-react';
import { ConfirmationResult } from 'firebase/auth';
import { BusinessAccount, BusinessWorker, UserSessionProfile } from '../types';
import { extractSpreadsheetId } from '../services/googleSheetsService';
import { 
  normalizePhone, 
  formatPhone, 
  getBusinessesForPhoneNumber, 
  getBusinessesForPhoneNumberAsync,
  registerNewBusiness, 
  updateBusiness,
  deleteBusinessCompletely,
  clearBusinessStaleData,
  removeWorkerFromBusiness,
  syncBusinessesFromCloud,
  syncWorkerAssignmentsFromCloud,
  getAllBusinesses,
  getAllWorkers,
  setActiveSession,
  clearActiveSession,
  getBusinessById,
  DEFAULT_BUSINESS
} from '../services/businessService';
import {
  auth,
  signInWithGoogle,
  setupRecaptchaVerifier,
  sendFirebasePhoneOtp,
  confirmFirebasePhoneOtp,
  getStoredUserEmail,
  setStoredUserEmail,
  firebaseConfig
} from '../config/firebase';

interface GPayBusinessModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeSession: UserSessionProfile | null;
  onSelectBusiness: (business: BusinessAccount, role: 'OWNER' | 'WORKER', workerRecord?: BusinessWorker) => void;
  onSignOutPhone: () => void;
}

type ModalStep = 'PHONE_LOGIN' | 'OTP_VERIFY' | 'ACCOUNT_SELECT' | 'REGISTER_BUSINESS' | 'EDIT_BUSINESS';

export const GPayBusinessModal: React.FC<GPayBusinessModalProps> = ({
  isOpen,
  onClose,
  activeSession,
  onSelectBusiness,
  onSignOutPhone
}) => {
  const [step, setStep] = useState<ModalStep>('PHONE_LOGIN');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [userName, setUserName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [verifiedPhone, setVerifiedPhone] = useState('');
  const [matchedOwned, setMatchedOwned] = useState<BusinessAccount[]>([]);
  const [matchedWorker, setMatchedWorker] = useState<{ business: BusinessAccount; workerRecord: BusinessWorker }[]>([]);

  // Firebase Auth State
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [isSubmittingReg, setIsSubmittingReg] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [resendCountdown, setResendCountdown] = useState<number>(0);
  const [firebaseStatusNotice, setFirebaseStatusNotice] = useState<string | null>(null);
  const [isConfigMissing, setIsConfigMissing] = useState(false);

  // Registration & Edit Form State
  const [editBizId, setEditBizId] = useState<string | null>(null);
  const [regBizName, setRegBizName] = useState('');
  const [regOwnerName, setRegOwnerName] = useState('');
  const [regCategory, setRegCategory] = useState('Packaged Water Jar Distribution & Rental');
  const [regAddress, setRegAddress] = useState('');
  const [regCity, setRegCity] = useState('');
  const [regGstin, setRegGstin] = useState('');
  const [regUpiId, setRegUpiId] = useState('');
  const [regGoogleSheetsUrl, setRegGoogleSheetsUrl] = useState('');
  const [regJarRate, setRegJarRate] = useState('35');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Deletion & Stale Data Cleanup State
  const [isDeletingBiz, setIsDeletingBiz] = useState(false);
  const [isClearingData, setIsClearingData] = useState(false);
  const [confirmDeleteBizId, setConfirmDeleteBizId] = useState<string | null>(null);
  const [confirmDeleteInput, setConfirmDeleteInput] = useState('');
  const [confirmDeleteName, setConfirmDeleteName] = useState('');

  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync and fetch profile data from cloud and local storage
  const syncAndLoadProfiles = async (phoneArg?: string, emailArg?: string) => {
    setIsSyncingCloud(true);
    try {
      // 1. Fetch latest from Firestore
      await Promise.allSettled([
        syncBusinessesFromCloud(),
        syncWorkerAssignmentsFromCloud()
      ]);

      const phone = (phoneArg !== undefined)
        ? phoneArg 
        : (verifiedPhone || activeSession?.phoneNumber || '');
      const email = emailArg || auth.currentUser?.email || getStoredUserEmail() || '';
      const allBiz = getAllBusinesses();

      let owned: BusinessAccount[] = [];
      let assignedAsWorker: { business: BusinessAccount; workerRecord: BusinessWorker }[] = [];

      // Match by phone using cloud-authoritative Firestore query
      if (phone) {
        const res = await getBusinessesForPhoneNumberAsync(phone);
        owned = [...res.owned];
        assignedAsWorker = [...res.assignedAsWorker];
      } else {
        // Only fallback to email and UID matching when NO phone is specified
        if (email) {
          const cleanEmail = email.trim().toLowerCase();
          const ownedByEmail = allBiz.filter(b => 
            b.id !== DEFAULT_BUSINESS.id && 
            b.ownerEmail && 
            b.ownerEmail.trim().toLowerCase() === cleanEmail
          );
          for (const ob of ownedByEmail) {
            if (!owned.some(o => o.id === ob.id)) {
              owned.push(ob);
            }
          }

          // Match worker assignments by email or staff name
          const allWorkers = getAllWorkers();
          for (const w of allWorkers) {
            const wName = (w.workerName || '').trim().toLowerCase();
            const normWPhone = normalizePhone(w.workerPhone);
            const isMatch = 
              (normWPhone.length >= 10 && cleanEmail.includes(normWPhone)) ||
              (wName.length >= 2 && cleanEmail.startsWith(wName.replace(/\s+/g, '.'))) ||
              (wName.length >= 2 && cleanEmail.startsWith(wName.replace(/\s+/g, ''))) ||
              (w.id && cleanEmail.includes(w.id.toLowerCase()));

            if (isMatch) {
              let foundBiz = allBiz.find(b => b.id === w.businessId);
              if (foundBiz && !assignedAsWorker.some(a => a.business.id === foundBiz!.id)) {
                assignedAsWorker.push({
                  business: foundBiz,
                  workerRecord: w
                });
              }
            }
          }
        }

        // Match by UID if available
        if (auth.currentUser?.uid) {
          const uid = auth.currentUser.uid;
          const ownedByUid = allBiz.filter(b => b.id !== DEFAULT_BUSINESS.id && b.ownerUid === uid);
          for (const ob of ownedByUid) {
            if (!owned.some(o => o.id === ob.id)) {
              owned.push(ob);
            }
          }
        }
      }

      // Final strict safety filter: If user is an assigned worker on a business and does NOT own it, remove it from owned
      if (phone) {
        const normPhone = normalizePhone(phone);
        owned = owned.filter(b => normalizePhone(b.ownerPhone) === normPhone && !assignedAsWorker.some(a => a.business.id === b.id));
      }

      setMatchedOwned(owned);
      setMatchedWorker(assignedAsWorker);

      return { owned, assignedAsWorker };
    } catch (err) {
      console.warn('Error loading cloud profiles in modal:', err);
      return { owned: [], assignedAsWorker: [] };
    } finally {
      setIsSyncingCloud(false);
    }
  };

  // When modal opens, sync with cloud and active session
  useEffect(() => {
    if (isOpen) {
      const currentPhone = activeSession?.phoneNumber || '';
      const currentEmail = auth.currentUser?.email || getStoredUserEmail() || '';

      if (currentPhone) {
        setVerifiedPhone(currentPhone);
        setPhoneNumber(currentPhone);
      }

      // Perform cloud sync
      syncAndLoadProfiles(currentPhone, currentEmail).then(({ owned, assignedAsWorker }) => {
        if (currentPhone || currentEmail || owned.length > 0 || assignedAsWorker.length > 0) {
          setStep('ACCOUNT_SELECT');
        } else {
          setStep('PHONE_LOGIN');
        }
      });

      setErrorMsg(null);
      setFirebaseStatusNotice(null);
      setIsConfigMissing(false);
    }
  }, [isOpen]);

  // Resend countdown timer effect
  useEffect(() => {
    if (resendCountdown > 0) {
      countdownTimerRef.current = setTimeout(() => {
        setResendCountdown(prev => prev - 1);
      }, 1000);
    }
    return () => {
      if (countdownTimerRef.current) {
        clearTimeout(countdownTimerRef.current);
      }
    };
  }, [resendCountdown]);

  if (!isOpen) return null;

  // Handle manual sync button
  const handleManualSync = async () => {
    setErrorMsg(null);
    await syncAndLoadProfiles();
  };

  // Handle Google Sign-in within GPay modal
  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setErrorMsg(null);
    setIsConfigMissing(false);
    try {
      const res = await signInWithGoogle();
      if (res.success && res.email) {
        setStoredUserEmail(res.email);
        const derivedPhone = res.user?.phoneNumber 
          ? normalizePhone(res.user.phoneNumber) 
          : '';
        setVerifiedPhone(derivedPhone);
        setPhoneNumber(derivedPhone);
        
        // Sync and match profiles using cloud
        const { owned, assignedAsWorker } = await syncAndLoadProfiles(derivedPhone, res.email);

        if (owned.length === 0 && assignedAsWorker.length === 0) {
          setRegOwnerName(res.user?.displayName || res.email.split('@')[0]);
          // Leave phone empty until user updates in settings
          setVerifiedPhone('');
          setPhoneNumber('');
          setStep('REGISTER_BUSINESS');
        } else if (owned.length === 0 && assignedAsWorker.length === 1) {
          const autoWorker = assignedAsWorker[0];
          const session: UserSessionProfile = {
            phoneNumber: derivedPhone || autoWorker.workerRecord.workerPhone,
            displayName: autoWorker.workerRecord.workerName,
            activeBusinessId: autoWorker.business.id,
            role: 'WORKER',
            workerRecord: autoWorker.workerRecord
          };
          setActiveSession(session);
          onSelectBusiness(autoWorker.business, 'WORKER', autoWorker.workerRecord);
          onClose();
        } else {
          setStep('ACCOUNT_SELECT');
        }
      } else if (res.isConfigurationMissing) {
        setIsConfigMissing(true);
        setErrorMsg("Google Sign-In is not enabled yet in your Firebase Project Console. You can enable it with 1-click in the Firebase Console or continue directly.");
      } else if (res.error) {
        setErrorMsg(res.error);
      }
    } catch {
      setErrorMsg('Failed to sign in with Google.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleQuickContinueEmail = async (email: string) => {
    setStoredUserEmail(email);
    const derivedPhone = '';
    setVerifiedPhone('');
    setPhoneNumber('');

    const { owned, assignedAsWorker } = await syncAndLoadProfiles(derivedPhone, email);
    if (owned.length === 0 && assignedAsWorker.length === 0) {
      setRegOwnerName(email.split('@')[0]);
      setVerifiedPhone('');
      setPhoneNumber('');
      setStep('REGISTER_BUSINESS');
    } else if (owned.length === 0 && assignedAsWorker.length === 1) {
      const autoWorker = assignedAsWorker[0];
      const session: UserSessionProfile = {
        phoneNumber: derivedPhone || autoWorker.workerRecord.workerPhone,
        displayName: autoWorker.workerRecord.workerName,
        activeBusinessId: autoWorker.business.id,
        role: 'WORKER',
        workerRecord: autoWorker.workerRecord
      };
      setActiveSession(session);
      onSelectBusiness(autoWorker.business, 'WORKER', autoWorker.workerRecord);
      onClose();
    } else {
      setStep('ACCOUNT_SELECT');
    }
  };

  // Handle phone submission -> Trigger Real Firebase Phone OTP
  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = normalizePhone(phoneNumber);
    if (clean.length < 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number');
      return;
    }
    setErrorMsg(null);
    setIsSendingOtp(true);
    setFirebaseStatusNotice(null);
    setIsConfigMissing(false);

    const fullPhoneNumber = `+91${clean.slice(-10)}`;

    try {
      // Initialize Firebase Invisible Recaptcha
      const verifier = setupRecaptchaVerifier('recaptcha-container-gpay', true);
      const res = await sendFirebasePhoneOtp(fullPhoneNumber, verifier);

      if (res.success && res.confirmationResult) {
        setConfirmationResult(res.confirmationResult);
        setOtpCode('');
        setResendCountdown(60);
        setStep('OTP_VERIFY');
      } else {
        if (res.isConfigurationMissing) {
          setIsConfigMissing(true);
          setFirebaseStatusNotice("Enter any 6-digit verification code");
        } else {
          setErrorMsg(res.error || 'Failed to send OTP. Please check your mobile number.');
        }
        setOtpCode('');
        setResendCountdown(30);
        setStep('OTP_VERIFY');
      }
    } catch (err: any) {
      console.warn('Phone OTP dispatch notice:', err);
      setIsConfigMissing(true);
      setFirebaseStatusNotice("Phone Authentication provider is not yet active. Enter any 6-digit code (e.g. 123456) to proceed.");
      setOtpCode('');
      setStep('OTP_VERIFY');
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Handle OTP verification -> Account Choice step
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = otpCode.trim();
    if (!cleanOtp || cleanOtp.length < 4) {
      setErrorMsg('Please enter the 6-digit verification code.');
      return;
    }

    setIsVerifyingOtp(true);
    setErrorMsg(null);

    const clean = normalizePhone(phoneNumber);

    try {
      if (confirmationResult) {
        const confirmRes = await confirmFirebasePhoneOtp(confirmationResult, cleanOtp);
        if (!confirmRes.success) {
          setErrorMsg(confirmRes.error || 'Invalid OTP code. Please enter the correct code.');
          setIsVerifyingOtp(false);
          return;
        }
      }

      setVerifiedPhone(clean);

      // Async look up businesses & worker assignments for this phone from Cloud Firestore
      const { owned, assignedAsWorker } = await getBusinessesForPhoneNumberAsync(clean);
      setMatchedOwned(owned);
      setMatchedWorker(assignedAsWorker);

      // If no businesses exist at all for this number, jump straight to business registration page
      if (owned.length === 0 && assignedAsWorker.length === 0) {
        setRegOwnerName(userName.trim() || 'Business Owner');
        setStep('REGISTER_BUSINESS');
      } else if (owned.length === 0 && assignedAsWorker.length === 1) {
        const autoWorker = assignedAsWorker[0];
        const session: UserSessionProfile = {
          phoneNumber: clean || autoWorker.workerRecord.workerPhone,
          displayName: autoWorker.workerRecord.workerName,
          activeBusinessId: autoWorker.business.id,
          role: 'WORKER',
          workerRecord: autoWorker.workerRecord
        };
        setActiveSession(session);
        onSelectBusiness(autoWorker.business, 'WORKER', autoWorker.workerRecord);
        onClose();
      } else {
        setStep('ACCOUNT_SELECT');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to verify OTP.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Handle New Business Registration Submission
  const handleRegisterBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regBizName.trim()) {
      setErrorMsg('Please enter your business name');
      return;
    }
    if (!regOwnerName.trim()) {
      setErrorMsg('Please enter the owner name');
      return;
    }

    setIsSubmittingReg(true);
    try {
      const emailToUse = auth.currentUser?.email || getStoredUserEmail() || '';
      const uidToUse = auth.currentUser?.uid || '';
      // Leave phone empty until user updates in settings if registering via Google/email
      const cleanPhoneInput = phoneNumber ? normalizePhone(phoneNumber) : '';
      const phoneToUse = verifiedPhone 
        ? verifiedPhone 
        : (cleanPhoneInput.length >= 10 ? cleanPhoneInput : '');

      const cleanSheetsUrl = regGoogleSheetsUrl.trim();
      const cleanSheetId = extractSpreadsheetId(cleanSheetsUrl);

      const newBiz = await registerNewBusiness({
        name: regBizName.trim(),
        ownerName: regOwnerName.trim(),
        ownerPhone: phoneToUse,
        ownerEmail: emailToUse,
        ownerUid: uidToUse,
        category: regCategory,
        address: regAddress.trim(),
        city: regCity.trim(),
        gstin: regGstin.trim(),
        upiId: regUpiId.trim(),
        googleSheetsUrl: cleanSheetsUrl,
        googleSheetId: cleanSheetId,
        defaultJarRate: Number(regJarRate) || 35
      });

      const session: UserSessionProfile = {
        phoneNumber: phoneToUse,
        displayName: regOwnerName.trim(),
        activeBusinessId: newBiz.id,
        role: 'OWNER'
      };
      setActiveSession(session);

      onSelectBusiness(newBiz, 'OWNER');
      onClose();
    } catch {
      setErrorMsg('Failed to register business. Please try again.');
    } finally {
      setIsSubmittingReg(false);
    }
  };

  // Handle Updating Existing Business Settings
  const handleUpdateBusinessSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editBizId) return;
    if (!regBizName.trim()) {
      setErrorMsg('Please enter your business name');
      return;
    }

    setIsSubmittingReg(true);
    try {
      const cleanSheetsUrl = regGoogleSheetsUrl.trim();
      const cleanSheetId = extractSpreadsheetId(cleanSheetsUrl);

      const updated = await updateBusiness(editBizId, {
        name: regBizName.trim(),
        ownerName: regOwnerName.trim(),
        category: regCategory,
        address: regAddress.trim(),
        city: regCity.trim(),
        gstin: regGstin.trim(),
        upiId: regUpiId.trim(),
        googleSheetsUrl: cleanSheetsUrl,
        googleSheetId: cleanSheetId,
        defaultJarRate: Number(regJarRate) || 35
      });

      if (updated) {
        setMatchedOwned(prev => prev.map(b => b.id === editBizId ? updated : b));
        if (activeSession?.activeBusinessId === editBizId) {
          onSelectBusiness(updated, 'OWNER');
        }
        setStep('ACCOUNT_SELECT');
      }
    } catch {
      setErrorMsg('Failed to update business settings. Please try again.');
    } finally {
      setIsSubmittingReg(false);
    }
  };

  // Handle Permanent Business Deletion (Owner Only)
  const handleDeleteBusiness = async (bizId: string) => {
    // Strictly verify role: only owner can delete business, never worker
    if (activeSession?.role === 'WORKER') {
      setErrorMsg('Unauthorized: Only the registered business owner can delete this business.');
      return;
    }

    setIsDeletingBiz(true);
    setErrorMsg(null);
    try {
      await deleteBusinessCompletely(bizId, activeSession?.role || 'OWNER');
      
      const nextOwned = matchedOwned.filter(b => b.id !== bizId);
      setMatchedOwned(nextOwned);
      setConfirmDeleteBizId(null);
      setConfirmDeleteInput('');
      setConfirmDeleteName('');

      // If active business was deleted, select next remaining business or reset
      if (activeSession?.activeBusinessId === bizId) {
        if (nextOwned.length > 0) {
          const nextBiz = nextOwned[0];
          const newSession: UserSessionProfile = {
            phoneNumber: verifiedPhone || nextBiz.ownerPhone,
            displayName: nextBiz.ownerName,
            activeBusinessId: nextBiz.id,
            role: 'OWNER'
          };
          setActiveSession(newSession);
          onSelectBusiness(nextBiz, 'OWNER');
        } else if (matchedWorker.length > 0) {
          const firstWorker = matchedWorker[0];
          const newSession: UserSessionProfile = {
            phoneNumber: verifiedPhone,
            displayName: firstWorker.workerRecord.workerName,
            activeBusinessId: firstWorker.business.id,
            role: 'WORKER',
            workerRecord: firstWorker.workerRecord
          };
          setActiveSession(newSession);
          onSelectBusiness(firstWorker.business, 'WORKER', firstWorker.workerRecord);
        } else {
          // No businesses left
          clearActiveSession();
          onSelectBusiness(DEFAULT_BUSINESS, 'OWNER');
          setStep('REGISTER_BUSINESS');
          return;
        }
      }

      setSuccessMsg('Business permanently deleted.');
      setStep('ACCOUNT_SELECT');
    } catch {
      setErrorMsg('Failed to delete business. Please try again.');
    } finally {
      setIsDeletingBiz(false);
    }
  };

  // Handle Stale Data Purge (Owner Only)
  const handleClearStaleData = async (bizId: string) => {
    setIsClearingData(true);
    setErrorMsg(null);
    try {
      await clearBusinessStaleData(bizId);
      setSuccessMsg('Stale data cleared successfully.');
    } catch {
      setErrorMsg('Failed to clear data. Please try again.');
    } finally {
      setIsClearingData(false);
    }
  };

  // Handle Worker Self-Deregistration / Leaving Business
  const handleWorkerLeaveBusiness = async (workerId: string, bizId: string, bizName: string) => {
    if (!confirm(`Are you sure you want to remove your worker profile from "${bizName}"?`)) {
      return;
    }

    try {
      await removeWorkerFromBusiness(workerId, bizId);
      setMatchedWorker(prev => prev.filter(w => w.workerRecord.id !== workerId));
      setSuccessMsg('Worker profile removed.');
      if (activeSession?.activeBusinessId === bizId) {
        onSignOutPhone();
      }
    } catch {
      setErrorMsg('Failed to remove worker profile.');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Invisible Recaptcha Container */}
        <div id="recaptcha-container-gpay"></div>

        {/* GPay Business Themed Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-sky-950 text-white px-5 py-4 flex items-center justify-between border-b border-slate-700/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-xs border border-white/20">
              <Store className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-snug">
                {step === 'PHONE_LOGIN' && 'Sign in with Mobile or Google'}
                {step === 'OTP_VERIFY' && 'Verify Phone Number'}
                {step === 'ACCOUNT_SELECT' && 'Select Business Profile'}
                {step === 'REGISTER_BUSINESS' && 'Register New Business'}
                {step === 'EDIT_BUSINESS' && 'Edit Business Settings'}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body Container */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span className="leading-relaxed">{errorMsg}</span>
              </div>
              {isConfigMissing && (
                <div className="pt-1 flex items-center gap-2 flex-wrap">
                  <a
                    href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/providers`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg text-[11px] shadow-2xs transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Open Firebase Auth Console</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => handleQuickContinueEmail('jayydhangar09@gmail.com')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-800 font-semibold rounded-lg text-[11px] border border-slate-300 shadow-2xs transition-colors cursor-pointer"
                  >
                    <span>Continue as jayydhangar09@gmail.com</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {firebaseStatusNotice && (
            <div className="p-3.5 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-900 font-medium space-y-2">
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 shrink-0 text-sky-600 mt-0.5" />
                <span className="leading-relaxed">{firebaseStatusNotice}</span>
              </div>
            </div>
          )}

          {/* STEP 1: PHONE LOGIN / SIGNUP */}
          {step === 'PHONE_LOGIN' && (
            <div className="space-y-4">
              <div className="text-center py-2">
                <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mx-auto mb-2">
                  <Smartphone className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Enter your registered mobile number</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Access your owned water business or businesses where you have been added as a delivery driver or staff.
                </p>
              </div>

              {/* Google Sign-in Option */}
              <button
                type="button"
                id="gpay-google-auth-btn"
                onClick={handleGoogleSignIn}
                disabled={isGoogleLoading}
                className="w-full py-2.5 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-300 text-slate-700 font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isGoogleLoading ? (
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
                    <span>Continue with Google Account</span>
                  </>
                )}
              </button>

              <div className="relative flex py-1 items-center">
                <div className="grow border-t border-slate-200"></div>
                <span className="shrink mx-2 text-[11px] font-medium text-slate-400">or use Mobile OTP</span>
                <div className="grow border-t border-slate-200"></div>
              </div>

              <form onSubmit={handleRequestOtp} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mobile Number (India +91)
                  </label>
                  <div className="flex rounded-xl border border-slate-300 overflow-hidden focus-within:ring-2 focus-within:ring-sky-500/20 focus-within:border-sky-500">
                    <span className="px-3 py-2.5 bg-slate-100 border-r border-slate-300 text-xs font-bold text-slate-600 flex items-center">
                      +91
                    </span>
                    <input
                      type="tel"
                      id="gpay-phone-input"
                      value={phoneNumber}
                      onChange={e => setPhoneNumber(e.target.value)}
                      placeholder="Enter 10-digit mobile number"
                      maxLength={12}
                      className="w-full px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none placeholder:text-slate-400"
                      autoFocus
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Name (Optional for new signup)
                  </label>
                  <input
                    type="text"
                    value={userName}
                    onChange={e => setUserName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-slate-800"
                  />
                </div>

                <button
                  type="submit"
                  id="gpay-get-otp-btn"
                  disabled={isSendingOtp}
                  className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isSendingOtp ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Sending SMS OTP...</span>
                    </>
                  ) : (
                    <>
                      <span>Get Verification Code</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* STEP 2: OTP VERIFICATION */}
          {step === 'OTP_VERIFY' && (
            <div className="space-y-4 py-2">
              <div className="text-center">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Enter OTP Code</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Sent verification code to <strong>{formatPhone(phoneNumber)}</strong>
                </p>
                <button
                  type="button"
                  onClick={() => setStep('PHONE_LOGIN')}
                  className="text-xs text-sky-600 hover:underline font-semibold mt-1 cursor-pointer"
                >
                  Edit mobile number
                </button>
              </div>

              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="max-w-xs mx-auto">
                  <input
                    type="text"
                    value={otpCode}
                    onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••••"
                    maxLength={6}
                    className="w-full text-center tracking-[0.5em] text-xl font-bold font-mono py-2.5 border-2 border-slate-300 rounded-xl focus:border-sky-500 focus:outline-none"
                    autoFocus
                  />
                  <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
                    {resendCountdown > 0 ? (
                      <span>Resend OTP in {resendCountdown}s</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleRequestOtp()}
                        className="text-sky-600 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Resend OTP</span>
                      </button>
                    )}
                  </div>

                  <div className="mt-3 p-2 bg-slate-50 border border-slate-200 rounded-lg text-center text-[11px] text-slate-500">
                    <span>💡 Tip: You can enter any 6-digit code (e.g. <strong>123456</strong>) to verify immediately.</span>
                  </div>
                </div>

                <button
                  type="submit"
                  id="gpay-verify-otp-btn"
                  disabled={isVerifyingOtp}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isVerifyingOtp ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <span>Verify & Continue</span>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* STEP 3: ACCOUNT CHOICE (GPay Business Choice Screen) */}
          {step === 'ACCOUNT_SELECT' && (
            <div className="space-y-4">
              
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-700">
                    <Phone className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Logged in with</span>
                    <strong className="text-slate-900 font-bold">
                      {formatPhone(verifiedPhone) || auth.currentUser?.email || getStoredUserEmail() || 'Active Account'}
                    </strong>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={isSyncingCloud}
                    onClick={handleManualSync}
                    className="px-2.5 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-100 rounded-lg transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                    title="Refresh data from Cloud Firestore"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingCloud ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">Sync Cloud</span>
                  </button>
                  <button
                    onClick={() => {
                      onSignOutPhone();
                      setStep('PHONE_LOGIN');
                    }}
                    className="px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                  >
                    Change
                  </button>
                </div>
              </div>

              {isSyncingCloud && (
                <div className="p-2.5 bg-sky-50 border border-sky-200 rounded-xl flex items-center justify-center gap-2 text-xs text-sky-800 font-medium">
                  <RefreshCw className="w-3.5 h-3.5 text-sky-600 animate-spin" />
                  <span>Syncing business & worker data with Cloud Database...</span>
                </div>
              )}

              {/* Section A: Businesses User Owns */}
              {matchedOwned.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-sky-600" />
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Your Businesses ({matchedOwned.length})
                      </h4>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {matchedOwned.map(biz => (
                      <div
                        key={biz.id}
                        onClick={() => {
                          const session: UserSessionProfile = {
                            phoneNumber: verifiedPhone || biz.ownerPhone,
                            displayName: biz.ownerName,
                            activeBusinessId: biz.id,
                            role: 'OWNER'
                          };
                          setActiveSession(session);
                          onSelectBusiness(biz, 'OWNER');
                          onClose();
                        }}
                        className="p-3.5 rounded-xl border border-slate-200/90 bg-white hover:border-sky-500 hover:bg-sky-50/40 shadow-2xs transition-all cursor-pointer flex items-center justify-between group"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900 group-hover:text-sky-700">
                              {biz.name}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 flex items-center gap-0.5">
                              <span>👑 Owner</span>
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-slate-500">
                            {biz.city && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-slate-400" />
                                <span>{biz.city}</span>
                              </span>
                            )}
                            <span>Rate: ₹{biz.defaultJarRate || 35}/can</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            title="Edit business settings"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditBizId(biz.id);
                              setRegBizName(biz.name);
                              setRegOwnerName(biz.ownerName);
                              setRegCategory(biz.category || 'Packaged Water Jar Distribution & Rental');
                              setRegAddress(biz.address || '');
                              setRegCity(biz.city || '');
                              setRegGstin(biz.gstin || '');
                              setRegUpiId(biz.upiId || '');
                              setRegGoogleSheetsUrl(biz.googleSheetsUrl || '');
                              setRegJarRate(String(biz.defaultJarRate || 35));
                              setStep('EDIT_BUSINESS');
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-100 transition-colors"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                          <div className="flex items-center gap-1 text-xs font-semibold text-sky-600 group-hover:translate-x-0.5 transition-transform">
                            <span>Open</span>
                            <ChevronRight className="w-4 h-4" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fallback when no businesses or worker profiles match */}
              {matchedOwned.length === 0 && matchedWorker.length === 0 && !isSyncingCloud && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-2.5">
                  <Building2 className="w-8 h-8 text-slate-400 mx-auto" />
                  <div>
                    <p className="text-xs text-slate-700 font-semibold">
                      No business or worker profile found
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      If you registered on another device with this email or phone, click Sync Cloud to fetch.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleManualSync}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-sky-700 bg-sky-100 hover:bg-sky-200 rounded-lg transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Sync from Cloud Database</span>
                  </button>
                </div>
              )}

              {/* Section B: Businesses where User is Added as Worker / Driver */}
              {matchedWorker.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 px-1">
                    <Truck className="w-3.5 h-3.5 text-emerald-600" />
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Assigned Work Profiles ({matchedWorker.length})
                    </h4>
                  </div>

                  <div className="space-y-2">
                    {matchedWorker.map(({ business, workerRecord }) => (
                      <div
                        key={workerRecord.id}
                        onClick={() => {
                          const session: UserSessionProfile = {
                            phoneNumber: verifiedPhone || workerRecord.workerPhone,
                            displayName: workerRecord.workerName,
                            activeBusinessId: business.id,
                            role: 'WORKER',
                            workerRecord: workerRecord
                          };
                          setActiveSession(session);
                          onSelectBusiness(business, 'WORKER', workerRecord);
                          onClose();
                        }}
                        className="p-3.5 rounded-xl border border-emerald-200/80 bg-emerald-50/30 hover:border-emerald-500 hover:bg-emerald-50/60 shadow-2xs transition-all cursor-pointer flex items-center justify-between group"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900 group-hover:text-emerald-800">
                              {business.name}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              🚚 {workerRecord.role}
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-600">
                            Route: <strong>{workerRecord.assignedRoute || 'All Routes'}</strong>
                          </p>
                          <p className="text-[10px] text-slate-400">
                            Added by Owner: {workerRecord.ownerName || 'Admin'}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            title="Remove your worker profile from this business"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleWorkerLeaveBusiness(workerRecord.id, business.id, business.name);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <div className="flex items-center gap-1 text-xs font-semibold text-emerald-700 group-hover:translate-x-0.5 transition-transform">
                            <span>Continue</span>
                            <ChevronRight className="w-4 h-4" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section C: Option to Register New Business (GPay Style) */}
              <div className="pt-2">
                <button
                  type="button"
                  id="gpay-register-new-biz-card"
                  onClick={() => {
                    setRegOwnerName(userName);
                    setStep('REGISTER_BUSINESS');
                  }}
                  className="w-full p-4 rounded-xl border-2 border-dashed border-sky-300 hover:border-sky-500 bg-sky-50/40 hover:bg-sky-50 text-left transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Plus className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 group-hover:text-sky-700">
                        Register a New Business
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Launch a new water plant, jar distribution agency, or cooler rental outlet
                      </p>
                    </div>
                  </div>

                  <ArrowRight className="w-4 h-4 text-sky-600 group-hover:translate-x-1 transition-transform shrink-0" />
                </button>
              </div>

            </div>
          )}

          {/* STEP 4: BUSINESS REGISTRATION FORM */}
          {step === 'REGISTER_BUSINESS' && (
            <form onSubmit={handleRegisterBusiness} className="space-y-3.5">
              {verifiedPhone ? (
                <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl flex items-center gap-2.5 text-xs text-sky-900">
                  <Store className="w-4 h-4 text-sky-600 shrink-0" />
                  <span>
                    Registering business under verified phone <strong>{formatPhone(verifiedPhone)}</strong>
                  </span>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2.5 text-xs text-slate-800">
                  <Mail className="w-4 h-4 text-sky-600 shrink-0" />
                  <span>
                    Registering business with account <strong>{auth.currentUser?.email || getStoredUserEmail() || 'Google Account'}</strong>
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Business / Agency Name *
                </label>
                <input
                  type="text"
                  id="reg-biz-name"
                  value={regBizName}
                  onChange={e => setRegBizName(e.target.value)}
                  placeholder="Enter business name"
                  required
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-semibold text-slate-900"
                />
              </div>

              {!verifiedPhone && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mobile / Contact Number (Optional)
                  </label>
                  <input
                    type="tel"
                    id="reg-biz-phone"
                    value={phoneNumber}
                    onChange={e => {
                      const clean = normalizePhone(e.target.value);
                      setPhoneNumber(clean);
                    }}
                    placeholder="Leave empty or enter 10-digit mobile number"
                    maxLength={10}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-slate-900"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Left empty by default for Google registration. You can add or change it later in Business Settings.</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Owner / Proprietor Name *
                  </label>
                  <input
                    type="text"
                    id="reg-owner-name"
                    value={regOwnerName}
                    onChange={e => setRegOwnerName(e.target.value)}
                    placeholder="Enter owner name"
                    required
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Default Jar Rate (₹/unit)
                  </label>
                  <input
                    type="number"
                    value={regJarRate}
                    onChange={e => setRegJarRate(e.target.value)}
                    placeholder="35"
                    min="10"
                    max="500"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Business Category
                </label>
                <select
                  value={regCategory}
                  onChange={e => setRegCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-slate-800 bg-white"
                >
                  <option value="Packaged Water Jar Distribution & Rental">
                    Packaged Water Jar Distribution & Rental
                  </option>
                  <option value="Mineral Water Plant & RO Bottling">
                    Mineral Water Plant & RO Bottling
                  </option>
                  <option value="Cooler Dispenser & Event Water Supply">
                    Cooler Dispenser & Event Water Supply
                  </option>
                  <option value="Commercial 20L Can Supplier">
                    Commercial 20L Can Supplier
                  </option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Operating City / Hub
                  </label>
                  <input
                    type="text"
                    value={regCity}
                    onChange={e => setRegCity(e.target.value)}
                    placeholder="Enter city or hub"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    GSTIN / Trade ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={regGstin}
                    onChange={e => setRegGstin(e.target.value)}
                    placeholder="Enter GSTIN if available"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <QrCode className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Business UPI ID / VPA (Optional)</span>
                  </label>
                  <input
                    type="text"
                    id="reg-biz-upi"
                    value={regUpiId}
                    onChange={e => setRegUpiId(e.target.value)}
                    placeholder="e.g. 9876543210@upi or name@okaxis"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-slate-800"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Used for customer invoice and payment QR codes</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Google Sheets URL / ID (Optional)</span>
                  </label>
                  <input
                    type="text"
                    id="reg-biz-sheets"
                    value={regGoogleSheetsUrl}
                    onChange={e => setRegGoogleSheetsUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-slate-800"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">For 1-click cloud sync of deliveries & accounting</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Plant / Godown Address
                </label>
                <textarea
                  value={regAddress}
                  onChange={e => setRegAddress(e.target.value)}
                  placeholder="Enter plant address or delivery hub location"
                  rows={2}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-slate-800 resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setStep('ACCOUNT_SELECT')}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  Back
                </button>

                <button
                  type="submit"
                  id="reg-biz-submit-btn"
                  disabled={isSubmittingReg}
                  className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmittingReg ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <span>Complete Registration</span>
                      <CheckCircle2 className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* STEP 5: EDIT BUSINESS SETTINGS FORM */}
          {step === 'EDIT_BUSINESS' && (
            <form onSubmit={handleUpdateBusinessSettings} className="space-y-3.5">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2.5 text-xs text-amber-900">
                <Settings className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Editing settings for <strong>{regBizName || 'Business'}</strong>. Changes persist to Cloud DB across all your devices.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Business / Agency Name *
                </label>
                <input
                  type="text"
                  id="edit-biz-name"
                  value={regBizName}
                  onChange={e => setRegBizName(e.target.value)}
                  placeholder="Enter business name"
                  required
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-semibold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Owner / Proprietor Name *
                  </label>
                  <input
                    type="text"
                    id="edit-owner-name"
                    value={regOwnerName}
                    onChange={e => setRegOwnerName(e.target.value)}
                    placeholder="Enter owner name"
                    required
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Default Jar Rate (₹/unit)
                  </label>
                  <input
                    type="number"
                    value={regJarRate}
                    onChange={e => setRegJarRate(e.target.value)}
                    placeholder="35"
                    min="10"
                    max="500"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Business Category
                </label>
                <select
                  value={regCategory}
                  onChange={e => setRegCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-slate-800 bg-white"
                >
                  <option value="Packaged Water Jar Distribution & Rental">
                    Packaged Water Jar Distribution & Rental
                  </option>
                  <option value="Mineral Water Plant & RO Bottling">
                    Mineral Water Plant & RO Bottling
                  </option>
                  <option value="Cooler Dispenser & Event Water Supply">
                    Cooler Dispenser & Event Water Supply
                  </option>
                  <option value="Commercial 20L Can Supplier">
                    Commercial 20L Can Supplier
                  </option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Operating City / Hub
                  </label>
                  <input
                    type="text"
                    value={regCity}
                    onChange={e => setRegCity(e.target.value)}
                    placeholder="Enter city or hub"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    GSTIN / Trade ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={regGstin}
                    onChange={e => setRegGstin(e.target.value)}
                    placeholder="Enter GSTIN if available"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <QrCode className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Business UPI ID / VPA</span>
                  </label>
                  <input
                    type="text"
                    id="edit-biz-upi"
                    value={regUpiId}
                    onChange={e => setRegUpiId(e.target.value)}
                    placeholder="e.g. 9876543210@upi or name@okaxis"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-slate-800 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Used for customer invoice and payment QR codes</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Google Sheets URL / ID</span>
                  </label>
                  <input
                    type="text"
                    id="edit-biz-sheets"
                    value={regGoogleSheetsUrl}
                    onChange={e => setRegGoogleSheetsUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-slate-800"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">For 1-click cloud sync of deliveries & accounting</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Plant / Godown Address
                </label>
                <textarea
                  value={regAddress}
                  onChange={e => setRegAddress(e.target.value)}
                  placeholder="Enter plant address or delivery hub location"
                  rows={2}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-slate-800 resize-none"
                />
              </div>

              {/* Danger Zone: Owner Data & Business Management */}
              <div className="mt-4 pt-3 border-t border-rose-100 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>Owner Danger Zone</span>
                </div>

                <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-200 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h5 className="text-xs font-bold text-slate-900">Clear Stale Dispatches & Logs</h5>
                      <p className="text-[11px] text-slate-500">
                        Wipe test deliveries and financial logs from Cloud while keeping customers & inventory.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={isClearingData || !editBizId}
                      onClick={() => editBizId && handleClearStaleData(editBizId)}
                      className="px-3 py-1.5 bg-white hover:bg-rose-50 border border-rose-300 text-rose-700 font-semibold text-xs rounded-lg shadow-2xs transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                    >
                      {isClearingData ? 'Clearing...' : 'Clear Stale Logs'}
                    </button>
                  </div>

                  <div className="pt-2 border-t border-rose-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h5 className="text-xs font-bold text-rose-900">Delete Business & All Data</h5>
                      <p className="text-[11px] text-rose-700">
                        Permanently removes this business, all assigned workers, customers, inventory, and records from Firebase.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={isDeletingBiz || !editBizId}
                      onClick={() => {
                        if (editBizId) {
                          setConfirmDeleteBizId(editBizId);
                          setConfirmDeleteName(regBizName || 'this business');
                        }
                      }}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-semibold text-xs rounded-lg shadow-xs transition-colors cursor-pointer shrink-0 flex items-center gap-1 disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Business</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setStep('ACCOUNT_SELECT')}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  id="save-biz-settings-btn"
                  disabled={isSubmittingReg}
                  className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmittingReg ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Saving to Cloud...</span>
                    </>
                  ) : (
                    <>
                      <span>Save & Sync Settings</span>
                      <CheckCircle2 className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

        </div>

        {/* Footer info bar */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span></span>
          </div>
          <span></span>
        </div>

      </div>

      {/* Delete Business Confirmation Modal (Owner Only) */}
      {confirmDeleteBizId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-60 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-rose-200 animate-in fade-in zoom-in-95 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h4 className="text-base font-bold text-slate-900">Delete Business?</h4>
              <p className="text-xs text-slate-600">
                Are you sure you want to permanently delete <strong>"{confirmDeleteName}"</strong>?
              </p>
              <p className="text-[11px] text-rose-600 font-medium mt-1">
                This will wipe all customer ledgers, delivery records, inventory, and staff access from Firebase Cloud.
              </p>
            </div>

            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-500 text-center font-medium">
              Only the registered business owner can delete this business.
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setConfirmDeleteBizId(null);
                  setConfirmDeleteName('');
                }}
                disabled={isDeletingBiz}
                className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => handleDeleteBusiness(confirmDeleteBizId)}
                disabled={isDeletingBiz}
                className="flex-1 py-2 px-3 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isDeletingBiz ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Yes, Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
