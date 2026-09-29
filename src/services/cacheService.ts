// Cache management and invalidation service for deployment pipelines
export interface AppVersionInfo {
  version: string;
  buildId: string;
  buildTimestamp: number;
  buildDate: string;
  cacheInvalidated: boolean;
  environment: string;
}

const VERSION_STORAGE_KEY = 'aquapure_app_version';

/**
 * Purges all browser CacheStorage instances (service worker caches, Workbox caches, runtime caches)
 * and unregisters stale service workers to ensure fresh deployment code runs.
 */
export async function purgeAllAppCaches(): Promise<boolean> {
  let clearedAny = false;

  // 1. Purge window.caches (Service Worker / Workbox caches)
  if ('caches' in window) {
    try {
      const cacheNames = await window.caches.keys();
      await Promise.all(
        cacheNames.map(async (name) => {
          const deleted = await window.caches.delete(name);
          if (deleted) {
            console.log(`[CacheService] Deleted cache: ${name}`);
            clearedAny = true;
          }
        })
      );
    } catch (err) {
      console.warn('[CacheService] Error clearing CacheStorage:', err);
    }
  }

  // 2. Unregister or update existing service workers if needed
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.update();
      }
    } catch (err) {
      console.warn('[CacheService] Error updating service workers:', err);
    }
  }

  return clearedAny;
}

/**
 * Checks for a newly deployed version by querying /version.json with cache-busting headers.
 */
export async function fetchLatestDeploymentVersion(): Promise<AppVersionInfo | null> {
  try {
    const res = await fetch(`/version.json?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });

    if (!res.ok) {
      return null;
    }

    const text = await res.text();
    if (!text || text.trim().startsWith('<')) {
      // HTML fallback (e.g. 404 redirected to index.html)
      return null;
    }

    const data: AppVersionInfo = JSON.parse(text);
    return data;
  } catch (err) {
    console.debug('[CacheService] Could not reach version.json:', err);
    return null;
  }
}

/**
 * Compares current local version with newly deployed version.
 * If new version detected, optionally cleans old cache.
 */
export async function checkDeploymentUpdate(): Promise<{ hasNewDeployment: boolean; latestVersion: AppVersionInfo | null }> {
  const latest = await fetchLatestDeploymentVersion();
  if (!latest) {
    return { hasNewDeployment: false, latestVersion: null };
  }

  const storedTimestampStr = localStorage.getItem(VERSION_STORAGE_KEY);
  const storedTimestamp = storedTimestampStr ? parseInt(storedTimestampStr, 10) : null;

  if (storedTimestamp === null) {
    // First run with version tracker, initialize
    localStorage.setItem(VERSION_STORAGE_KEY, latest.buildTimestamp.toString());
    return { hasNewDeployment: false, latestVersion: latest };
  }

  // If newly deployed build timestamp is greater than stored timestamp
  if (latest.buildTimestamp > storedTimestamp) {
    console.log(`[CacheService] New deployment detected! Current: ${storedTimestamp}, Latest: ${latest.buildTimestamp}`);
    return { hasNewDeployment: true, latestVersion: latest };
  }

  return { hasNewDeployment: false, latestVersion: latest };
}

/**
 * Applies the update by updating local storage, clearing caches, and reloading.
 */
export async function applyDeploymentUpdate(latest: AppVersionInfo): Promise<void> {
  localStorage.setItem(VERSION_STORAGE_KEY, latest.buildTimestamp.toString());
  await purgeAllAppCaches();
  window.location.reload();
}
