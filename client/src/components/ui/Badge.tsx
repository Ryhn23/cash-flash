import React from 'react';
import clsx from 'clsx';
import type { DataStatus } from '../../types/index.js';

export interface BadgeProps {
  variant?: 'ok' | 'warning' | 'error' | 'primary' | 'neutral';
  status?: DataStatus;
  children?: React.ReactNode;
  icon?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  variant,
  status,
  children,
  icon,
  className,
  size = 'md',
}) => {
  let computedVariant = variant || 'neutral';
  let computedIcon = icon;
  let text = children;

  // Auto-map if status prop is provided
  if (status) {
    switch (status) {
      case 'OK':
        computedVariant = 'ok';
        computedIcon = computedIcon || 'fa-solid fa-check';
        text = text || 'OK';
        break;
      case 'VERIFIED_DUPLICATE_OK':
        computedVariant = 'ok';
        computedIcon = computedIcon || 'fa-solid fa-shield-check';
        text = text || 'Terverifikasi (Bukan Dobel)';
        break;
      case 'POTENTIAL_DUPLICATE':
        computedVariant = 'warning';
        computedIcon = computedIcon || 'fa-solid fa-triangle-exclamation';
        text = text || 'Mungkin Dobel';
        break;
      case 'INCOMPLETE':
        computedVariant = 'error';
        computedIcon = computedIcon || 'fa-solid fa-circle-exclamation';
        text = text || 'Data Belum Lengkap';
        break;
    }
  }

  // Clean minimalist status indicator (inline dot + plain text, no heavy pill backgrounds)
  const dotColor = {
    ok: 'bg-emerald-500',
    warning: 'bg-amber-500',
    error: 'bg-rose-500',
    primary: 'bg-indigo-600',
    neutral: 'bg-slate-400',
  }[computedVariant];

  const textColor = {
    ok: 'text-slate-700',
    warning: 'text-amber-800 font-medium',
    error: 'text-rose-700 font-medium',
    primary: 'text-indigo-950 font-medium',
    neutral: 'text-slate-600',
  }[computedVariant];

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 text-xs select-none whitespace-nowrap leading-none',
        textColor,
        className
      )}
    >
      <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', dotColor)} />
      <span>{text}</span>
    </span>
  );
};
