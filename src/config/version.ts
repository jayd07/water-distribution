// Versioning, Patch Tracking, and Fallback Management for Water Distributor v1

export interface PatchRelease {
  version: string;
  releaseDate: string;
  codeName: string;
  type: 'MAJOR' | 'MINOR' | 'PATCH' | 'HOTFIX';
  isStableBaseline?: boolean;
  summary: string;
  changes: string[];
  fixes: string[];
}

export const APP_NAME = 'Water Distributor';
export const APP_VERSION = '1.0.0';
export const APP_RELEASE_LABEL = 'Water Distributor v1';
export const APP_BUILD_TAG = 'v1.0.0-PROD-STABLE';
export const STABLE_BASELINE_VERSION = '1.0.0';

export const PATCH_HISTORY: PatchRelease[] = [
  {
    version: '1.0.0',
    releaseDate: '2026-09-26',
    codeName: 'Water Distributor v1 Gold Master',
    type: 'MAJOR',
    isStableBaseline: true,
    summary: 'Production release for public deployment with multi-business isolation, atomic delivery logistics, UPI QR payments, automated WhatsApp reminders, and Google Sheets accounting.',
    changes: [
      'Multi-tenant Firestore isolation per business workspace with role-based access (Owner, Manager, Staff, Driver)',
      'Atomic delivery dispatching with real-time jar stock increment/decrement and zero race conditions',
      'Dynamic Bharat UPI QR code generator for invoices, due clearances, and doorstep delivery collection',
      'Automated 1-click WhatsApp payment reminders with dynamic UPI payment links and customer holding summaries',
      'Unified Accounting Day Book with CSV download and 1-click Google Sheets TSV copy',
      'PWA offline-first capabilities with local cache synchronization and background long-polling',
      'React 19 & Firestore hook validation with unconditional lifecycle order'
    ],
    fixes: [
      'Resolved React 19 static flag assertion warnings on early return modals',
      'Hardened Firestore multi-subcollection security rules against unauthorized open writes',
      'Standardized business header branding, tax ID, and address rendering across tax invoices'
    ]
  }
];

const SNAPSHOT_STORAGE_KEY = 'water_distributor_stable_snapshot_v1';
const SAFE_MODE_STORAGE_KEY = 'water_distributor_safe_mode';
const CRASH_COUNTER_KEY = 'water_distributor_crash_count';

export interface StateSnapshot {
  version: string;
  timestamp: number;
  dateStr: string;
  data: Record<string, any>;
}

/**
 * Creates an emergency snapshot of all critical application data in localStorage
 */
export function createLocalStateSnapshot(): StateSnapshot {
  const dataToBackup: Record<string, any> = {};
  
  if (typeof window !== 'undefined') {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('aquapure_') || key.startsWith('water_distributor_') || key.includes('business'))) {
        try {
          dataToBackup[key] = JSON.parse(localStorage.getItem(key) || 'null');
        } catch {
          dataToBackup[key] = localStorage.getItem(key);
        }
      }
    }
  }

  const snapshot: StateSnapshot = {
    version: APP_VERSION,
    timestamp: Date.now(),
    dateStr: new Date().toISOString(),
    data: dataToBackup
  };

  try {
    localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshot));
  } catch (err) {
    console.warn('[VersionManager] Could not save snapshot to localStorage:', err);
  }

  return snapshot;
}

/**
 * Downloads a complete JSON backup of the active version snapshot
 */
export function exportSnapshotToFile(): void {
  const snapshot = createLocalStateSnapshot();
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `water_distributor_v1_backup_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Restores data from a previously created snapshot object or JSON string
 */
export function restoreSnapshotData(snapshotOrJson: StateSnapshot | string): boolean {
  try {
    const snapshot: StateSnapshot = typeof snapshotOrJson === 'string' 
      ? JSON.parse(snapshotOrJson) 
      : snapshotOrJson;

    if (!snapshot || !snapshot.data) {
      throw new Error('Invalid snapshot format');
    }

    Object.entries(snapshot.data).forEach(([key, val]) => {
      if (val !== null && val !== undefined) {
        const strVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
        localStorage.setItem(key, strVal);
      }
    });

    return true;
  } catch (err) {
    console.error('[VersionManager] Failed to restore snapshot:', err);
    return false;
  }
}

/**
 * Safe fallback execution: Clears broken runtime caches, sets safe mode flag, and reloads to stable baseline
 */
export async function executeEmergencyFallbackToStableV1(): Promise<void> {
  try {
    // 1. Mark safe mode active
    sessionStorage.setItem(SAFE_MODE_STORAGE_KEY, 'true');
    localStorage.setItem('water_distributor_active_version', STABLE_BASELINE_VERSION);

    // 2. Clear service worker and dynamic bundle caches
    if ('caches' in window) {
      const names = await window.caches.keys();
      await Promise.all(names.map(name => window.caches.delete(name)));
    }

    // 3. Unregister service workers
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) {
        await reg.unregister();
      }
    }

    // 4. Force hard reload bypassing cache
    window.location.href = window.location.origin + window.location.pathname + `?_fallback_reset=${Date.now()}`;
  } catch (err) {
    console.error('[VersionManager] Emergency fallback error:', err);
    window.location.reload();
  }
}

/**
 * Checks if the current session is running in safe fallback mode
 */
export function isSafeFallbackMode(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(SAFE_MODE_STORAGE_KEY) === 'true';
}

/**
 * Tracks runtime crashes and triggers auto-fallback if consecutive errors occur
 */
export function recordCrashAndCheckFallback(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const countStr = sessionStorage.getItem(CRASH_COUNTER_KEY);
    const count = (countStr ? parseInt(countStr, 10) : 0) + 1;
    sessionStorage.setItem(CRASH_COUNTER_KEY, count.toString());

    // If more than 2 crashes in this session, recommend automatic fallback
    return count >= 2;
  } catch {
    return false;
  }
}

// Register backend tracing metadata on global window for telemetry
if (typeof window !== 'undefined') {
  (window as any).__APP_NAME__ = APP_NAME;
  (window as any).__APP_VERSION__ = APP_VERSION;
  (window as any).__APP_BUILD_TAG__ = APP_BUILD_TAG;
  (window as any).__STABLE_BASELINE__ = STABLE_BASELINE_VERSION;
  (window as any).__WATER_DISTRIBUTOR_DIAGNOSTICS__ = {
    getPatchHistory: () => PATCH_HISTORY,
    createBackup: () => exportSnapshotToFile(),
    triggerFallback: () => executeEmergencyFallbackToStableV1(),
    isSafeMode: () => isSafeFallbackMode()
  };
}

