import React from 'react';
import clsx from 'clsx';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, icon, className, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-[#0F172A] mb-1.5 font-sans">
            {label}
            {props.required && <span className="text-[#BE123C] ml-0.5">*</span>}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute inset-y-0 left-0 w-10 flex items-center justify-center pointer-events-none text-slate-400">
              <i className={clsx(icon, 'text-xs')} />
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            style={{
              ...(icon ? { paddingLeft: '2.5rem', paddingInlineStart: '2.5rem' } : {}),
              ...props.style,
            }}
            className={clsx(
              'w-full input-base',
              icon && '!pl-10 !ps-10',
              error && 'border-[#BE123C] focus:border-[#BE123C] focus:ring-[#BE123C]/12',
              className
            )}
            {...props}
          />
        </div>
        {error ? (
          <p className="text-xs text-[#BE123C] mt-1 flex items-center gap-1 font-sans">
            <i className="fa-solid fa-circle-exclamation text-[10px]" />
            <span>{error}</span>
          </p>
        ) : helperText ? (
          <p className="text-xs text-[#64748B] mt-1 font-sans">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
