import { useEffect, useRef, useCallback } from 'react';
import { checkDeploymentUpdate, applyDeploymentUpdate, purgeAllAppCaches, AppVersionInfo } from '../services/cacheService';

const RELOAD_COOLDOWN_MS = 10000; // 10s cooldown guard against rapid refresh loops
const RELOAD_FLAG_KEY = 'aquapure_last_auto_reload_time';

export function useDeploymentCache() {
  const isUpdatingRef = useRef(false);

  const performAutoUpdate = useCallback(async (latest: AppVersionInfo | null) => {
    if (isUpdatingRef.current) return;

    // Check cooldown to avoid rapid reload loops
    const lastReloadStr = sessionStorage.getItem(RELOAD_FLAG_KEY);
    const lastReload = lastReloadStr ? parseInt(lastReloadStr, 10) : 0;
    if (Date.now() - lastReload < RELOAD_COOLDOWN_MS) {
      console.log('[useDeploymentCache] Cooldown active, skipping auto-reload');
      return;
    }

    isUpdatingRef.current = true;
    sessionStorage.setItem(RELOAD_FLAG_KEY, Date.now().toString());

    console.log('[useDeploymentCache] Auto-invalidating cache and hard reloading for newly detected deployment...');
    try {
      if (latest) {
        await applyDeploymentUpdate(latest);
      } else {
        await purgeAllAppCaches();
        window.location.reload();
      }
    } catch (err) {
      console.error('[useDeploymentCache] Failed to apply deployment update:', err);
      isUpdatingRef.current = false;
    }
  }, []);

  const checkForUpdate = useCallback(async () => {
    if (isUpdatingRef.current) return;
    try {
      const res = await checkDeploymentUpdate();
      if (res.hasNewDeployment && res.latestVersion) {
        console.log(`[useDeploymentCache] New deployment detected (build ${res.latestVersion.buildTimestamp}). Auto-refreshing...`);
        await performAutoUpdate(res.latestVersion);
      }
    } catch (err) {
      console.debug('[useDeploymentCache] Check update error:', err);
    }
  }, [performAutoUpdate]);

  useEffect(() => {
    // 1. Initial check on mount
    checkForUpdate();

    // 2. Check whenever user switches tabs back to the app
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdate();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 3. Periodic check in background every 2 minutes
    const interval = setInterval(checkForUpdate, 2 * 60 * 1000);

    // 4. Automatically reload when a fresh service worker takes control
    if ('serviceWorker' in navigator) {
      const handleControllerChange = async () => {
        console.log('[useDeploymentCache] Service worker updated to new version. Purging cache & reloading...');
        await performAutoUpdate(null);
      };
      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        clearInterval(interval);
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      };
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [checkForUpdate, performAutoUpdate]);

  return {
    checkForUpdate,
    performAutoUpdate
  };
}
