import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, CloudDownload } from 'lucide-react';
import { triggerHaptic } from '../../utils/haptics';
import { useLanguage } from '../../context/LanguageContext';

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  pullThreshold?: number;
  maxPull?: number;
}

type RefreshState = 'idle' | 'pulling' | 'ready' | 'refreshing' | 'success';

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  children,
  className = '',
  disabled = false,
  pullThreshold = 68,
  maxPull = 115
}) => {
  const { t } = useLanguage();
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshState, setRefreshState] = useState<RefreshState>('idle');
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const isTrackingRef = useRef(false);
  const isRefreshingRef = useRef(false);

  // Calculate pull progress (0.0 to 1.0+)
  const progress = Math.min(1.2, pullDistance / pullThreshold);

  const performRefresh = useCallback(async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    setRefreshState('refreshing');
    setPullDistance(56); // Hold at indicator height

    const startTime = Date.now();
    try {
      await Promise.resolve(onRefresh());
    } catch (err) {
      console.warn('Manual sync error:', err);
    } finally {
      // Ensure smooth minimum duration for spinner visibility
      const elapsed = Date.now() - startTime;
      const minDuration = 650;
      if (elapsed < minDuration) {
        await new Promise((resolve) => setTimeout(resolve, minDuration - elapsed));
      }

      setRefreshState('success');
      setLastRefreshedAt(new Date());

      // Single tactile haptic feedback strictly upon sync completion
      triggerHaptic('light');

      // Hold success state momentarily before snapping back
      setTimeout(() => {
        setPullDistance(0);
        setRefreshState('idle');
        isRefreshingRef.current = false;
      }, 400);
    }
  }, [onRefresh]);

  // Helper to check if touch started inside a modal or nested scrollable element
  const isInsideScrollableOrModal = (target: EventTarget | null): boolean => {
    let el = target as HTMLElement | null;
    while (el && el !== containerRef.current && el !== document.body) {
      if (
        el.tagName === 'INPUT' ||
        el.tagName === 'SELECT' ||
        el.tagName === 'TEXTAREA' ||
        el.getAttribute('role') === 'dialog'
      ) {
        return true;
      }
      const style = window.getComputedStyle(el);
      if (style.position === 'fixed') {
        return true;
      }
      const overflowY = style.overflowY;
      if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
        return true;
      }
      el = el.parentElement;
    }
    return false;
  };

  // Touch event handlers
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (disabled || isRefreshingRef.current) return;
    if (isInsideScrollableOrModal(e.target)) {
      isTrackingRef.current = false;
      return;
    }

    // Check if the scroll position is at the very top
    const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
    const containerScrollTop = containerRef.current ? containerRef.current.scrollTop : 0;

    if (scrollTop <= 1 && containerScrollTop <= 1) {
      startYRef.current = e.touches[0].clientY;
      startXRef.current = e.touches[0].clientX;
      isTrackingRef.current = true;
    } else {
      isTrackingRef.current = false;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isTrackingRef.current || disabled || isRefreshingRef.current) return;

    const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
    if (scrollTop > 2) {
      isTrackingRef.current = false;
      if (pullDistance !== 0) setPullDistance(0);
      if (refreshState !== 'idle') setRefreshState('idle');
      return;
    }

    const currentY = e.touches[0].clientY;
    const currentX = e.touches[0].clientX;
    const deltaY = currentY - startYRef.current;
    const deltaX = currentX - startXRef.current;

    // Immediately release tracking if user scrolls downward (deltaY <= 0) or swipes horizontally
    if (deltaY <= 0 || (Math.abs(deltaX) > Math.abs(deltaY) * 0.8 && Math.abs(deltaX) > 8)) {
      isTrackingRef.current = false;
      if (pullDistance !== 0) setPullDistance(0);
      if (refreshState !== 'idle') setRefreshState('idle');
      return;
    }

    // Require a deliberate 16px downward pull deadzone before activating rubber-band offset
    if (deltaY > 16) {
      const effectiveDelta = deltaY - 16;
      const dampedDistance = Math.min(
        maxPull,
        Math.pow(effectiveDelta, 0.82) * 1.45
      );
      setPullDistance(dampedDistance);

      if (dampedDistance >= pullThreshold) {
        if (refreshState !== 'ready') {
          setRefreshState('ready');
        }
      } else {
        if (refreshState !== 'pulling') {
          setRefreshState('pulling');
        }
      }
    }
  };

  const handleTouchEnd = () => {
    if (!isTrackingRef.current || disabled || isRefreshingRef.current) return;
    isTrackingRef.current = false;

    if (pullDistance >= pullThreshold) {
      performRefresh();
    } else {
      // Snap back if released before threshold
      setPullDistance(0);
      setRefreshState('idle');
    }
  };

  // Pointer event support strictly for desktop mouse dragging (ignore touch pointers to prevent double-firing)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || disabled || isRefreshingRef.current || e.button !== 0) return;
    if (isInsideScrollableOrModal(e.target)) return;
    const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
    if (scrollTop <= 1) {
      startYRef.current = e.clientY;
      startXRef.current = e.clientX;
      isTrackingRef.current = true;
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || !isTrackingRef.current || disabled || isRefreshingRef.current) return;
    const deltaY = e.clientY - startYRef.current;
    if (deltaY <= 0) {
      isTrackingRef.current = false;
      setPullDistance(0);
      setRefreshState('idle');
      return;
    }
    if (deltaY > 16) {
      const dampedDistance = Math.min(maxPull, Math.pow(deltaY - 16, 0.82) * 1.45);
      setPullDistance(dampedDistance);
      setRefreshState(dampedDistance >= pullThreshold ? 'ready' : 'pulling');
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || !isTrackingRef.current || disabled || isRefreshingRef.current) return;
    isTrackingRef.current = false;
    if (pullDistance >= pullThreshold) {
      performRefresh();
    } else {
      setPullDistance(0);
      setRefreshState('idle');
    }
  };

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`relative w-full ${className}`}
    >
      {/* Pull to Refresh Floating Indicator */}
      <div
        className="pointer-events-none absolute left-0 right-0 top-0 z-40 flex items-center justify-center overflow-hidden transition-all duration-150 ease-out"
        style={{
          height: `${pullDistance}px`,
          opacity: pullDistance > 8 ? 1 : 0
        }}
      >
        <motion.div
          initial={false}
          animate={{
            scale: refreshState === 'idle' ? 0.7 : 1,
            y: refreshState === 'refreshing' || refreshState === 'success' ? 0 : Math.min(10, pullDistance * 0.15)
          }}
          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/90 backdrop-blur-md border border-sky-200/80 shadow-md text-xs font-semibold text-slate-700"
        >
          {/* Water Droplet Graphic & Dynamic Animation */}
          <div className="relative flex items-center justify-center w-7 h-7">
            {refreshState === 'success' ? (
              <motion.div
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs"
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </motion.div>
            ) : refreshState === 'refreshing' ? (
              <div className="relative w-6 h-6 flex items-center justify-center">
                {/* Rotating Water Glow Ring */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1.1, ease: 'linear' }}
                  className="absolute inset-0 rounded-full border-2 border-sky-400 border-t-transparent border-r-cyan-400"
                />
                {/* Pulsing Droplet Core */}
                <motion.svg
                  viewBox="0 0 24 24"
                  className="w-4 h-4 text-sky-600 drop-shadow-xs"
                  animate={{ scale: [0.9, 1.15, 0.9] }}
                  transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
                  fill="url(#ptr-water-grad)"
                >
                  <defs>
                    <linearGradient id="ptr-water-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#0284c7" />
                      <stop offset="100%" stopColor="#06b6d4" />
                    </linearGradient>
                  </defs>
                  <path d="M12 2.5C12 2.5 5 11 5 16C5 19.866 8.134 23 12 23C15.866 23 19 19.866 19 16C19 11 12 2.5 12 2.5Z" />
                </motion.svg>
              </div>
            ) : (
              <motion.div
                style={{
                  transform: `scale(${Math.min(1.2, 0.6 + progress * 0.5)}) rotate(${progress * 180}deg)`
                }}
                className="relative w-6 h-6 flex items-center justify-center"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="w-5 h-5 drop-shadow-xs"
                  fill="url(#ptr-drag-grad)"
                >
                  <defs>
                    <linearGradient id="ptr-drag-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#0284c7" />
                      <stop offset="100%" stopColor="#38bdf8" />
                    </linearGradient>
                  </defs>
                  <path d="M12 2.5C12 2.5 5 11 5 16C5 19.866 8.134 23 12 23C15.866 23 19 19.866 19 16C19 11 12 2.5 12 2.5Z" />
                </svg>
              </motion.div>
            )}
          </div>

          {/* Status Text Message */}
          <span className="tracking-tight text-slate-800">
            {refreshState === 'idle' || refreshState === 'pulling' ? (
              <span className="text-slate-600">{t.pullRefresh.pullToRefresh}</span>
            ) : refreshState === 'ready' ? (
              <span className="text-sky-600 font-bold">{t.pullRefresh.releaseToRefresh}</span>
            ) : refreshState === 'refreshing' ? (
              <span className="text-cyan-700 font-medium">{t.pullRefresh.refreshing}</span>
            ) : (
              <span className="text-emerald-700 font-bold">{t.pullRefresh.upToDate}</span>
            )}
          </span>
        </motion.div>
      </div>

      {/* Main Content with smooth spring offset while pulling */}
      <motion.div
        animate={{
          y: isRefreshingRef.current || refreshState === 'success' ? 50 : pullDistance > 0 ? pullDistance * 0.7 : 0
        }}
        transition={{
          type: isTrackingRef.current ? 'tween' : 'spring',
          duration: isTrackingRef.current ? 0 : 0.25,
          stiffness: 300,
          damping: 24
        }}
        className="w-full"
      >
        {children}
      </motion.div>
    </div>
  );
};
