import React from 'react';
import { motion } from 'motion/react';

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
  badgeColor?: string;
}

interface AnimatedTabsProps<T extends string = string> {
  tabs: TabItem<T>[];
  activeTab: T;
  onChange: (tabId: T) => void;
  layoutId?: string;
  className?: string;
  tabClassName?: string;
  activeTabClassName?: string;
  inactiveTabClassName?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function AnimatedTabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  layoutId = 'animated-tab-indicator',
  className = '',
  tabClassName = '',
  activeTabClassName = 'text-slate-900 font-bold',
  inactiveTabClassName = 'text-slate-600 hover:text-slate-900',
  size = 'md'
}: AnimatedTabsProps<T>) {
  const sizeStyles = {
    sm: 'h-7 px-2.5 text-[11px]',
    md: 'h-8 px-3 text-xs',
    lg: 'h-9 px-4 text-sm'
  };

  return (
    <div className={`relative flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 ${className}`}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`relative flex items-center justify-center gap-1.5 font-medium rounded-lg transition-colors cursor-pointer select-none z-10 ${sizeStyles[size]} ${
              isActive ? activeTabClassName : inactiveTabClassName
            } ${tabClassName}`}
          >
            {isActive && (
              <motion.div
                layoutId={layoutId}
                className="absolute inset-0 bg-white rounded-lg shadow-2xs -z-10 border border-slate-200/60"
                transition={{ type: 'spring', bounce: 0.15, duration: 0.35 }}
              />
            )}
            {tab.icon && <span className="shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full leading-tight ${
                  tab.badgeColor || (isActive ? 'bg-slate-100 text-slate-700' : 'bg-slate-200/80 text-slate-600')
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
