import React from 'react';
import { motion, HTMLMotionProps } from 'motion/react';

export type ButtonVariant = 
  | 'primary' 
  | 'secondary' 
  | 'outline' 
  | 'ghost' 
  | 'emerald' 
  | 'indigo' 
  | 'amber' 
  | 'danger' 
  | 'shimmer';

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onAnimationStart' | 'onDragStart' | 'onDragEnd' | 'onDrag'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  glow?: boolean;
  fullWidth?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: `
    bg-gradient-to-b from-sky-500 to-sky-600 hover:from-sky-400 hover:to-sky-500 
    text-white shadow-2xs hover:shadow-md hover:shadow-sky-500/20 
    border border-sky-400/40 active:from-sky-600 active:to-sky-700
    shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25)]
  `,
  emerald: `
    bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 
    text-white shadow-2xs hover:shadow-md hover:shadow-emerald-500/20 
    border border-emerald-400/40 active:from-emerald-600 active:to-emerald-700
    shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25)]
  `,
  indigo: `
    bg-gradient-to-b from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 
    text-white shadow-2xs hover:shadow-md hover:shadow-indigo-500/20 
    border border-indigo-400/40 active:from-indigo-600 active:to-indigo-700
    shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25)]
  `,
  amber: `
    bg-gradient-to-b from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 
    text-white shadow-2xs hover:shadow-md hover:shadow-amber-500/20 
    border border-amber-400/40 active:from-amber-600 active:to-amber-700
    shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25)]
  `,
  danger: `
    bg-gradient-to-b from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 
    text-white shadow-2xs hover:shadow-md hover:shadow-rose-500/20 
    border border-rose-400/40 active:from-rose-600 active:to-rose-700
    shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25)]
  `,
  secondary: `
    bg-white hover:bg-slate-50/90 text-slate-700 hover:text-slate-900 
    border border-slate-200/90 hover:border-slate-300 shadow-2xs
  `,
  outline: `
    bg-transparent hover:bg-slate-100/70 text-slate-700 hover:text-slate-900 
    border border-slate-300/80 hover:border-slate-400/80
  `,
  ghost: `
    bg-transparent hover:bg-slate-100/80 text-slate-600 hover:text-slate-900 
    border border-transparent
  `,
  shimmer: `
    relative bg-slate-900 text-white overflow-hidden shadow-md
    border border-slate-700/60 hover:bg-slate-800
  `
};

const sizeStyles: Record<ButtonSize, string> = {
  xs: 'h-7 px-2.5 text-[11px] font-semibold gap-1.5 rounded-lg',
  sm: 'h-8 px-3 text-xs font-semibold gap-1.5 rounded-lg',
  md: 'h-9 px-3.5 text-xs font-semibold gap-2 rounded-xl',
  lg: 'h-11 px-5 text-sm font-semibold gap-2.5 rounded-xl',
  icon: 'w-9 h-9 p-0 flex items-center justify-center rounded-xl shrink-0',
  'icon-sm': 'w-7 h-7 p-0 flex items-center justify-center rounded-lg shrink-0'
};

const glowStyles: Partial<Record<ButtonVariant, string>> = {
  primary: 'shadow-md shadow-sky-500/25',
  emerald: 'shadow-md shadow-emerald-500/25',
  indigo: 'shadow-md shadow-indigo-500/25',
  amber: 'shadow-md shadow-amber-500/25',
  danger: 'shadow-md shadow-rose-500/25',
  shimmer: 'shadow-lg shadow-sky-500/20'
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  glow = false,
  fullWidth = false,
  className = '',
  disabled,
  children,
  ...props
}, ref) => {
  const isIconButton = size === 'icon' || size === 'icon-sm';

  return (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      className={`
        relative inline-flex items-center justify-center select-none font-medium cursor-pointer
        transition-all duration-150 ease-out active:scale-[0.97]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 focus-visible:ring-offset-1
        disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none disabled:active:scale-100
        ${fullWidth ? 'w-full' : ''}
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${glow && glowStyles[variant] ? glowStyles[variant] : ''}
        ${className}
      `}
      {...props}
    >
      {/* Aceternity Shimmer Streak Effect */}
      {variant === 'shimmer' && (
        <span 
          className="absolute inset-0 block h-full w-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-700 ease-in-out pointer-events-none"
        />
      )}

      {isLoading ? (
        <span className="inline-flex items-center gap-2">
          <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0 opacity-80" />
          {!isIconButton && children}
        </span>
      ) : (
        <>
          {leftIcon && <span className="shrink-0">{leftIcon}</span>}
          {children}
          {rightIcon && <span className="shrink-0">{rightIcon}</span>}
        </>
      )}
    </button>
  );
});

Button.displayName = 'Button';
