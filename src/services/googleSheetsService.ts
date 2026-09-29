import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  User 
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { DeliveryLog, TransactionRecord, Customer, BusinessAccount } from '../types';

export const SHEETS_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets'
];

export interface SheetsBackupConfig {
  spreadsheetId: string;
  autoBackupEnabled: boolean;
  connectedEmail?: string;
  lastSyncedTimestamp?: number;
  lastSyncedStatus?: 'SUCCESS' | 'ERROR' | 'IDLE';
  lastErrorMessage?: string;
  totalBackedUpCount?: number;
}

const STORAGE_KEY_PREFIX = 'aquapure_sheets_backup_';

let cachedAccessToken: string | null = null;

export function getCachedSheetsToken(): string | null {
  return cachedAccessToken;
}

export function setCachedSheetsToken(token: string | null) {
  cachedAccessToken = token;
}

/**
 * Gets saved Google Sheets backup configuration for a business
 */
export function getSheetsBackupConfig(businessId: string): SheetsBackupConfig {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${businessId}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Failed to read sheets backup config:', e);
  }
  return {
    spreadsheetId: '',
    autoBackupEnabled: false,
    lastSyncedStatus: 'IDLE'
  };
}

/**
 * Saves Google Sheets backup configuration for a business
 */
export function saveSheetsBackupConfig(businessId: string, config: Partial<SheetsBackupConfig>): SheetsBackupConfig {
  const current = getSheetsBackupConfig(businessId);
  const updated: SheetsBackupConfig = {
    ...current,
    ...config
  };
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${businessId}`, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to save sheets backup config:', e);
  }
  return updated;
}

/**
 * Initiates Google Sign-In with Google Sheets scope to get OAuth access token
 */
export async function signInWithGoogleSheets(): Promise<{ user: User; accessToken: string }> {
  const provider = new GoogleAuthProvider();
  SHEETS_SCOPES.forEach(scope => provider.addScope(scope));
  provider.setCustomParameters({
    prompt: 'consent'
  });

  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  
  if (!credential?.accessToken) {
    throw new Error('Could not retrieve Google Sheets access token.');
  }

  cachedAccessToken = credential.accessToken;
  return { user: result.user, accessToken: cachedAccessToken };
}

/**
 * Extracts spreadsheet ID from raw input (supports plain ID or full URL)
 */
export function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }
  return trimmed;
}

/**
 * Syncs delivery logs and transaction records directly to a Google Spreadsheet
 */
export async function syncLogsToGoogleSheet(
  spreadsheetId: string,
  deliveries: DeliveryLog[],
  transactions: TransactionRecord[],
  customers: Customer[],
  business?: BusinessAccount,
  accessToken?: string
): Promise<{ success: boolean; rowsSynced: number; message: string; spreadsheetUrl: string }> {
  const token = accessToken || cachedAccessToken;
  if (!token) {
    throw new Error('Google authentication required. Please connect with Google.');
  }

  const cleanSheetId = extractSpreadsheetId(spreadsheetId);
  if (!cleanSheetId) {
    throw new Error('Please enter a valid Google Spreadsheet ID or URL.');
  }

  const customersMap = new Map<string, Customer>();
  customers.forEach(c => customersMap.set(c.id, c));

  // Build rows for Deliveries
  const deliveryHeader = [
    'Date & Time',
    'Delivery ID',
    'Customer Name',
    'Customer Phone',
    'Route',
    'Jars Delivered',
    'Empties Collected',
    'Payment Mode',
    'Amount Collected (₹)',
    'Driver / Staff',
    'Notes'
  ];

  const deliveryRows = deliveries.map(d => {
    const cust = customersMap.get(d.customerId);
    const dateStr = new Date(d.timestamp).toLocaleString('en-IN');
    return [
      dateStr,
      d.id,
      d.customerName || cust?.name || 'Customer',
      d.customerPhone || cust?.phone || '',
      cust?.route || 'General Route',
      d.jarsDelivered || 0,
      d.emptyJarsCollected || 0,
      d.paymentMode || 'CASH',
      d.amountCollected || 0,
      d.workerName || 'Staff Driver',
      d.notes || ''
    ];
  });

  // Build rows for Transactions
  const transactionHeader = [
    'Date & Time',
    'Transaction ID',
    'Customer Name',
    'Type',
    'Payment Mode',
    'Amount (₹)',
    'Notes'
  ];

  const transactionRows = transactions.map(t => {
    const cust = customersMap.get(t.customerId);
    const dateStr = new Date(t.timestamp).toLocaleString('en-IN');
    return [
      dateStr,
      t.id,
      t.customerName || cust?.name || 'Customer',
      t.type || 'REFILL_PAYMENT',
      t.paymentMode || 'CASH',
      t.amount || 0,
      t.notes || ''
    ];
  });

  const allRows = [
    ['--- WATER DISTRIBUTION LOGS EXPORT ---'],
    [`Business: ${business?.name || 'AquaPure Springs'} | Exported: ${new Date().toLocaleString('en-IN')}`],
    [],
    ['=== DISPATCH & DELIVERIES LOG ==='],
    deliveryHeader,
    ...deliveryRows,
    [],
    ['=== FINANCIAL TRANSACTIONS & SETTLEMENTS ==='],
    transactionHeader,
    ...transactionRows
  ];

  const endpoint = `https://sheets.googleapis.com/v4/spreadsheets/${cleanSheetId}/values/A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: allRows
      })
    });
  } catch (netErr: any) {
    throw new Error(`Network/CORS error connecting to Google Sheets API: ${netErr?.message || 'Check network connection or token validity'}`);
  }

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    const errMsg = errJson?.error?.message || `Google Sheets API returned status ${response.status}`;
    if (response.status === 401) {
      cachedAccessToken = null;
      throw new Error('Google authorization token expired. Please reconnect your Google account.');
    }
    if (response.status === 404) {
      throw new Error('Spreadsheet not found. Please verify the Google Sheet ID.');
    }
    if (response.status === 403) {
      throw new Error('Permission denied. Make sure you have edit access to this spreadsheet and granted Google Sheets permission.');
    }
    throw new Error(`Failed to sync with Google Sheets: ${errMsg}`);
  }

  const rowsSynced = (deliveryRows.length + transactionRows.length);
  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${cleanSheetId}/edit`;

  if (business?.id) {
    saveSheetsBackupConfig(business.id, {
      spreadsheetId: cleanSheetId,
      lastSyncedTimestamp: Date.now(),
      lastSyncedStatus: 'SUCCESS',
      lastErrorMessage: undefined
    });
  }

  return {
    success: true,
    rowsSynced,
    message: `Successfully appended ${rowsSynced} records to Google Sheet!`,
    spreadsheetUrl
  };
}

/**
 * Appends a newly recorded single delivery or transaction event directly to the Google Sheet in the background.
 */
export async function appendSingleLogToGoogleSheet(
  spreadsheetId: string,
  recordType: 'DELIVERY' | 'TRANSACTION',
  data: {
    id: string;
    customerName: string;
    customerPhone?: string;
    route?: string;
    jarsDelivered?: number;
    emptyJarsCollected?: number;
    paymentMode: string;
    amount: number;
    workerName?: string;
    notes?: string;
    timestamp?: number;
  },
  accessToken?: string
): Promise<boolean> {
  const token = accessToken || cachedAccessToken;
  if (!token) return false;

  const cleanSheetId = extractSpreadsheetId(spreadsheetId);
  if (!cleanSheetId) return false;

  const dateStr = new Date(data.timestamp || Date.now()).toLocaleString('en-IN');
  let rowValues: (string | number)[] = [];

  if (recordType === 'DELIVERY') {
    rowValues = [
      dateStr,
      data.id,
      data.customerName,
      data.customerPhone || '',
      data.route || '',
      data.jarsDelivered || 0,
      data.emptyJarsCollected || 0,
      data.paymentMode,
      data.amount,
      data.workerName || 'Staff',
      data.notes || 'Auto-Live Backup'
    ];
  } else {
    rowValues = [
      dateStr,
      data.id,
      data.customerName,
      'PAYMENT_SETTLEMENT',
      data.paymentMode,
      data.amount,
      data.notes || 'Auto-Live Backup'
    ];
  }

  try {
    const endpoint = `https://sheets.googleapis.com/v4/spreadsheets/${cleanSheetId}/values/A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    const res = await fetch(endpoint, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [rowValues]
      })
    });
    return res.ok;
  } catch (err) {
    console.warn('Background Google Sheet append error:', err);
    return false;
  }
}

/**
 * Non-blocking background worker trigger called after any delivery or transaction record is committed
 */
export function triggerBackgroundBackup(
  businessId: string,
  recordType: 'DELIVERY' | 'TRANSACTION',
  data: {
    id: string;
    customerName: string;
    customerPhone?: string;
    route?: string;
    jarsDelivered?: number;
    emptyJarsCollected?: number;
    paymentMode: string;
    amount: number;
    workerName?: string;
    notes?: string;
    timestamp?: number;
  }
) {
  // Execute completely asynchronously without blocking main thread
  setTimeout(async () => {
    try {
      const config = getSheetsBackupConfig(businessId);
      if (!config.autoBackupEnabled || !config.spreadsheetId) {
        return;
      }

      const token = getCachedSheetsToken();
      if (!token) {
        return;
      }

      const success = await appendSingleLogToGoogleSheet(
        config.spreadsheetId,
        recordType,
        data,
        token
      );

      if (success) {
        saveSheetsBackupConfig(businessId, {
          lastSyncedTimestamp: Date.now(),
          lastSyncedStatus: 'SUCCESS',
          totalBackedUpCount: (config.totalBackedUpCount || 0) + 1
        });
      }
    } catch (e: any) {
      console.warn('Background Sheets sync worker notification:', e);
      saveSheetsBackupConfig(businessId, {
        lastSyncedStatus: 'ERROR',
        lastErrorMessage: e?.message || 'Background sync issue'
      });
    }
  }, 100);
}
