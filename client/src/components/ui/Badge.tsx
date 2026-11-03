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

  // Strict DESIGN.md styles:
  // Height locked at 20px (h-5), 6px horizontal padding (px-1.5)
  // Max-pill radius (rounded-full)
  const variantStyles = {
    ok: 'bg-[#F0FDF4] text-[#15803D] border border-[#DCFCE7]',
    warning: 'bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]',
    error: 'bg-[#FFF1F2] text-[#BE123C] border border-[#FFE4E6]',
    primary: 'bg-[#EEF2FF] text-[#1E1B4B] border border-[#C7D2FE]',
    neutral: 'bg-[#F1F5F9] text-[#475569] border-0',
  }[computedVariant];

  return (
    <span
      className={clsx(
        'inline-flex items-center justify-center h-5 px-1.5 text-[11px] font-semibold rounded-full select-none no-gradient whitespace-nowrap leading-none gap-1',
        variantStyles,
        className
      )}
    >
      {computedIcon ? <i className={clsx(computedIcon, 'text-[9px]')} /> : null}
      <span>{text}</span>
    </span>
  );
};
