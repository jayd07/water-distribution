/**
 * Safe haptic vibration utilities for mobile touch feedback.
 * Operates gracefully across all modern mobile browsers supporting navigator.vibrate().
 */
export type HapticType = 'light' | 'medium' | 'success' | 'warning' | 'delete' | 'order' | 'delivery';

export const triggerHaptic = (type: HapticType = 'light'): void => {
  if (typeof window === 'undefined' || !('navigator' in window) || typeof navigator.vibrate !== 'function') {
    return;
  }

  try {
    switch (type) {
      case 'light':
        // Gentle micro-pulse for UI toggles and button presses
        navigator.vibrate(18);
        break;
      case 'medium':
        navigator.vibrate(35);
        break;
      case 'delivery':
      case 'success':
        // Confirming multi-frequency pulse for Completed Deliveries
        navigator.vibrate([45, 35, 65]);
        break;
      case 'order':
        // Crisp dual-click feedback for Order Saving
        navigator.vibrate([35, 40, 50]);
        break;
      case 'delete':
      case 'warning':
        // Distinct tactile pattern for Customer Deletion confirmation
        navigator.vibrate([70, 50, 90]);
        break;
      default:
        navigator.vibrate(25);
    }
  } catch (err) {
    // Non-blocking catch if vibrations are suppressed by device battery saver or permissions
    console.debug('Haptic feedback skipped:', err);
  }
};
