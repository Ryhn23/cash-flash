import React from 'react';
import clsx from 'clsx';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: string;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  className,
  disabled,
  ...props
}) => {
  // Soft architectural geometry: 0.25rem (4px)
  const baseClasses =
    'inline-flex items-center justify-center font-medium rounded transition-all select-none no-gradient focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]';

  // Compact 32px (h-8), Default 38px (h-[38px])
  const sizeClasses = {
    sm: 'h-8 text-xs px-2.5 gap-1.5 font-medium',
    md: 'h-[38px] text-xs px-3.5 gap-2 font-medium',
    lg: 'h-11 text-sm px-5 gap-2.5 font-semibold',
  }[size];

  // Colors per Sovereign Operations DESIGN.md:
  // Primary: #1E1B4B, hover #3730A3, 1px border #1E1B4B
  // Secondary / Outline: #FFFFFF, 1px border #E2E8F0, label #1E293B, hover #F8FAFC & border #CBD5E1
  // Ghost / Utility: transparent, label #64748B, hover #0F172A & #F1F5F9
  const variantClasses = {
    primary:
      'bg-[#1E1B4B] text-white border border-[#1E1B4B] hover:bg-[#3730A3] hover:border-[#3730A3] focus:ring-2 focus:ring-[#3730A3]/20 shadow-none',
    secondary:
      'bg-white text-slate-700 border border-[#CBD5E1] hover:bg-[#F8FAFC] hover:border-slate-400 hover:text-slate-900 focus:ring-2 focus:ring-slate-200 shadow-none',
    danger:
      'bg-[#BE123C] text-white border border-[#BE123C] hover:bg-[#9F1239] hover:border-[#9F1239] focus:ring-2 focus:ring-rose-200 shadow-none',
    outline:
      'bg-white text-slate-700 border border-[#CBD5E1] hover:bg-[#F8FAFC] hover:border-slate-400 hover:text-slate-900 focus:ring-2 focus:ring-slate-200 shadow-none',
    ghost:
      'bg-transparent text-slate-600 hover:bg-[#F1F5F9] hover:text-[#0F172A] border border-transparent shadow-none',
  }[variant];

  return (
    <button
      className={clsx(baseClasses, sizeClasses, variantClasses, className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <i className="fa-solid fa-circle-notch fa-spin text-current text-xs" />
      ) : icon ? (
        <i className={clsx(icon, 'text-current text-xs')} />
      ) : null}
      {children}
    </button>
  );
};
