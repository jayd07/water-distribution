import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import firebaseAppletConfig from '../../firebase-applet-config.json';

// Production Log Filter - Silences unnecessary console output in production
if (typeof window !== 'undefined' && (import.meta.env.PROD || process.env.NODE_ENV === 'production')) {
  const noop = () => {};
  console.log = noop;
  console.debug = noop;
  console.info = noop;
}

export const firebaseConfig = {
  apiKey: firebaseAppletConfig.apiKey,
  authDomain: firebaseAppletConfig.authDomain,
  projectId: firebaseAppletConfig.projectId,
  storageBucket: firebaseAppletConfig.storageBucket,
  messagingSenderId: firebaseAppletConfig.messagingSenderId,
  appId: firebaseAppletConfig.appId
};

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Configure persistent local storage for Firebase Auth
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch(() => {});
}

const databaseId = (firebaseAppletConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId;

let firestoreInstance;
try {
  if (databaseId && databaseId !== '(default)') {
    firestoreInstance = initializeFirestore(app, {
      experimentalForceLongPolling: true,
      ignoreUndefinedProperties: true
    }, databaseId);
  } else {
    firestoreInstance = initializeFirestore(app, {
      experimentalForceLongPolling: true,
      ignoreUndefinedProperties: true
    });
  }
} catch {
  firestoreInstance = databaseId && databaseId !== '(default)' 
    ? getFirestore(app, databaseId) 
    : getFirestore(app);
}

export const db = firestoreInstance;
export const DEFAULT_BUSINESS_ID = "AquaPure_Springs";

// Authentication helpers
export const LOCAL_USER_STORAGE_KEY = 'aquapure_active_user';

export function getStoredUserEmail(): string | null {
  try {
    return localStorage.getItem(LOCAL_USER_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredUserEmail(email: string): void {
  try {
    localStorage.setItem(LOCAL_USER_STORAGE_KEY, email);
  } catch {}
}

export function clearStoredUserEmail(): void {
  try {
    localStorage.removeItem(LOCAL_USER_STORAGE_KEY);
  } catch {}
}

export interface SignInResult {
  success: boolean;
  user?: User | null;
  email?: string;
  error?: string;
  isConfigurationMissing?: boolean;
}

export async function signInWithGoogle(): Promise<SignInResult> {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    const email = result.user?.email || undefined;
    if (email) {
      setStoredUserEmail(email);
    }
    return {
      success: true,
      user: result.user,
      email
    };
  } catch (err: any) {
    const errorCode = err?.code || '';
    const isConfigMissing = errorCode === 'auth/configuration-not-found' ||
      errorCode === 'auth/operation-not-allowed' ||
      errorCode === 'auth/admin-restricted-operation' ||
      String(err?.message || '').includes('auth/configuration-not-found') ||
      String(err?.message || '').includes('configuration-not-found') ||
      String(err?.message || '').includes('operation-not-allowed');

    if (isConfigMissing) {
      console.warn(`Firebase Auth Notice: Google Sign-in provider is not enabled in Firebase Console for project '${firebaseConfig.projectId}'.`);
      return {
        success: false,
        error: 'Google Sign-In is not enabled yet in your Firebase Project Console.',
        isConfigurationMissing: true
      };
    }

    if (errorCode === 'auth/popup-closed-by-user' || errorCode === 'auth/cancelled-popup-request') {
      return {
        success: false,
        error: 'Sign-in window was closed.'
      };
    }

    console.warn("Google authentication notice:", err?.message || err);
    return {
      success: false,
      error: err?.message || 'Authentication could not be completed.'
    };
  }
}

// Setup or retrieve RecaptchaVerifier for Phone OTP Auth
export function setupRecaptchaVerifier(containerId: string = 'recaptcha-container', invisible: boolean = true): RecaptchaVerifier {
  // Clear any existing verifier instance
  if ((window as any).recaptchaVerifier) {
    try {
      (window as any).recaptchaVerifier.clear();
    } catch {}
    (window as any).recaptchaVerifier = null;
  }

  // Ensure fresh container DOM element without existing widget attachments
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    document.body.appendChild(container);
  } else {
    container.innerHTML = '';
  }

  const verifier = new RecaptchaVerifier(auth, container, {
    size: invisible ? 'invisible' : 'normal',
    callback: () => {
      // reCAPTCHA solved
    },
    'expired-callback': () => {
      console.warn('reCAPTCHA expired. Please try again.');
    }
  });

  (window as any).recaptchaVerifier = verifier;
  return verifier;
}

// Send Real SMS OTP via Firebase Phone Auth
export async function sendFirebasePhoneOtp(
  phoneNumberWithCountryCode: string,
  appVerifier: RecaptchaVerifier
): Promise<{ success: boolean; confirmationResult?: ConfirmationResult; error?: string; isConfigurationMissing?: boolean }> {
  try {
    const confirmationResult = await signInWithPhoneNumber(auth, phoneNumberWithCountryCode, appVerifier);
    return {
      success: true,
      confirmationResult
    };
  } catch (err: any) {
    console.warn('Firebase Phone OTP Notice:', err?.code || err?.message);
    const errorCode = err?.code || '';
    const isConfigMissing = errorCode === 'auth/configuration-not-found' ||
      errorCode === 'auth/operation-not-allowed' ||
      String(err?.message || '').includes('configuration-not-found') ||
      String(err?.message || '').includes('operation-not-allowed');

    if (isConfigMissing) {
      return {
        success: false,
        error: 'Phone Authentication is not enabled yet in your Firebase Project Console. Go to Firebase Console > Authentication > Sign-in method and enable "Phone".',
        isConfigurationMissing: true
      };
    }

    let errorMsg = err?.message || 'Failed to send OTP via Firebase Phone Auth.';

    if (errorCode === 'auth/invalid-phone-number') {
      errorMsg = 'Invalid phone number format. Please check the mobile number and country code.';
    } else if (errorCode === 'auth/too-many-requests') {
      errorMsg = 'Too many requests. Firebase has temporarily blocked SMS requests from this device. Please try again later.';
    } else if (errorCode === 'auth/quota-exceeded') {
      errorMsg = 'SMS Quota exceeded for this Firebase project.';
    } else if (errorCode === 'auth/captcha-check-failed') {
      errorMsg = 'reCAPTCHA verification failed. Please try again.';
    }

    return {
      success: false,
      error: errorMsg
    };
  }
}

// Confirm OTP code with Firebase ConfirmationResult
export async function confirmFirebasePhoneOtp(
  confirmationResult: ConfirmationResult,
  otpCode: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const userCredential = await confirmationResult.confirm(otpCode);
    return {
      success: true,
      user: userCredential.user
    };
  } catch (err: any) {
    console.error('Firebase OTP Confirmation Error:', err);
    const errorCode = err?.code || '';
    let errorMsg = err?.message || 'Invalid verification code.';

    if (errorCode === 'auth/invalid-verification-code') {
      errorMsg = 'Incorrect 6-digit OTP code. Please re-check the SMS code.';
    } else if (errorCode === 'auth/code-expired') {
      errorMsg = 'Verification code has expired. Please request a new OTP.';
    }

    return {
      success: false,
      error: errorMsg
    };
  }
}

export async function signOutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch {}
  clearStoredUserEmail();
}

export const logOut = signOutUser;

// Structured Firestore Error Handling as mandated by Firebase Integration Skill
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
