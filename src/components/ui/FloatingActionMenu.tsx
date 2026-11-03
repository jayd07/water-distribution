import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Truck, Package, Boxes, X } from 'lucide-react';
import { triggerHaptic } from '../../utils/haptics';
import { useLanguage } from '../../context/LanguageContext';

export interface FloatingActionMenuProps {
  onNewDelivery?: () => void;
  onNewOrder?: () => void;
  onRestock?: () => void;
  className?: string;
}

export const FloatingActionMenu: React.FC<FloatingActionMenuProps> = ({
  onNewDelivery,
  onNewOrder,
  onRestock,
  className = ''
}) => {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const toggleMenu = () => {
    triggerHaptic('light');
    setIsOpen(prev => !prev);
  };

  const handleAction = (callback?: () => void) => {
    triggerHaptic('medium');
    setIsOpen(false);
    callback?.();
  };

  const actions = [
    {
      id: 'delivery',
      label: t.nav.recordDelivery,
      icon: Truck,
      color: 'bg-sky-600 hover:bg-sky-500 text-white shadow-sky-500/25',
      badgeColor: 'bg-sky-50 text-sky-700 border-sky-200',
      action: onNewDelivery,
      show: !!onNewDelivery
    },
    {
      id: 'order',
      label: t.nav.newOrder,
      icon: Package,
      color: 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-500/25',
      badgeColor: 'bg-cyan-50 text-cyan-700 border-cyan-200',
      action: onOpenNewOrderWrapper(onNewOrder),
      show: !!onNewOrder
    },
    {
      id: 'restock',
      label: t.nav.restock,
      icon: Boxes,
      color: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/25',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      action: onRestock,
      show: !!onRestock
    }
  ].filter(a => a.show);

  function onOpenNewOrderWrapper(cb?: () => void) {
    return cb;
  }

  if (actions.length === 0) return null;

  return (
    <div className={`fixed bottom-20 md:bottom-8 right-4 sm:right-6 md:right-8 z-40 ${className}`}>
      {/* Dimmed backdrop when menu is expanded */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-slate-950/25 backdrop-blur-[1.5px] -z-10"
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      <div className="relative flex flex-col items-end gap-3">
        {/* Speed Dial Menu Items */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              className="flex flex-col items-end gap-2.5 mb-1"
              initial="closed"
              animate="open"
              exit="closed"
              variants={{
                open: {
                  transition: { staggerChildren: 0.06, delayChildren: 0.02 }
                },
                closed: {
                  transition: { staggerChildren: 0.04, staggerDirection: -1 }
                }
              }}
            >
              {actions.map((item) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.id}
                    variants={{
                      open: { opacity: 1, y: 0, scale: 1 },
                      closed: { opacity: 0, y: 14, scale: 0.85 }
                    }}
                    transition={{ type: 'spring', stiffness: 450, damping: 25 }}
                    className="flex items-center gap-3 group"
                  >
                    {/* Action Label */}
                    <span
                      onClick={() => handleAction(item.action)}
                      className="px-3 py-1.5 rounded-xl bg-slate-900/90 text-white text-xs font-semibold backdrop-blur-md shadow-lg border border-slate-700/60 cursor-pointer select-none whitespace-nowrap hover:bg-slate-900 transition-colors"
                    >
                      {item.label}
                    </span>

                    {/* Action Circle Button */}
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.92 }}
                      onClick={() => handleAction(item.action)}
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg border border-white/20 transition-all cursor-pointer ${item.color}`}
                      title={item.label}
                      aria-label={item.label}
                    >
                      <Icon className="w-5 h-5 stroke-[2.2]" />
                    </motion.button>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Primary FAB Trigger Button */}
        <motion.button
          type="button"
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          onClick={toggleMenu}
          className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-600 via-sky-500 to-cyan-500 text-white shadow-xl shadow-sky-600/30 border border-sky-400/40 flex items-center justify-center cursor-pointer focus:outline-hidden focus:ring-4 focus:ring-sky-500/30 transition-shadow"
          aria-expanded={isOpen}
          aria-label={isOpen ? 'Close rapid action menu' : 'Open rapid action menu'}
        >
          <motion.div
            animate={{ rotate: isOpen ? 45 : 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
          >
            {isOpen ? (
              <X className="w-6 h-6 stroke-[2.5]" />
            ) : (
              <Plus className="w-6 h-6 stroke-[2.5]" />
            )}
          </motion.div>
        </motion.button>
      </div>
    </div>
  );
};
