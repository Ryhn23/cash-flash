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
        'bg-white border border-[#E2E8F0] rounded-xl p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-gradient',
        className
      )}
    >
      <div className="flex items-start sm:items-center gap-3.5 min-w-0">
        {icon && (
          <div className="w-10 h-10 rounded-lg bg-[#EEF2FF] border border-[#C7D2FE] text-[#3730A3] flex items-center justify-center text-base shrink-0 shadow-none">
            <i className={icon} />
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-base sm:text-lg font-bold text-[#0F172A] tracking-tight font-heading truncate">
              {title}
            </h2>
            {badge}
          </div>
          {description && (
            <p className="text-xs text-slate-500 font-sans mt-0.5 leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </div>

      {actions && (
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
};

