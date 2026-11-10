import React from 'react';
import clsx from 'clsx';

export interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  icon,
  badge,
  actions,
  className,
}) => {
  return (
    <div
      className={clsx(
        'flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-[#E2E8F0] mb-5',
        className
      )}
    >
      <div className="flex items-start sm:items-center gap-3">
        {icon && (
          <div className="w-9 h-9 rounded bg-[#EEF2FF] border border-[#C7D2FE] text-[#3730A3] flex items-center justify-center shrink-0 shadow-none">
            <i className={clsx(icon, 'text-sm')} />
          </div>
        )}
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base sm:text-lg font-bold text-[#0F172A] tracking-tight font-heading">
              {title}
            </h2>
            {badge}
          </div>
          {description && (
            <p className="text-xs text-[#64748B] font-sans mt-0.5">
              {description}
            </p>
          )}
        </div>
      </div>

      {actions && (
        <div className="flex items-center gap-2 flex-wrap sm:shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
};

