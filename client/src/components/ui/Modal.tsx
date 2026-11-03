import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'lg',
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const maxWidthClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '4xl': 'max-w-4xl',
  }[maxWidth];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="fixed inset-0 bg-[#070235]/60 backdrop-blur-none"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Dialog Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 6 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={clsx(
              'relative w-full bg-white rounded-lg border border-[#CBD5E1] overflow-hidden z-10 no-gradient my-8',
              'shadow-[0_4px_12px_-2px_rgba(15,23,42,0.06),0_2px_4px_-1px_rgba(15,23,42,0.04)]',
              maxWidthClass
            )}
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            {title && (
              <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center justify-between bg-white">
                <div>
                  <h3 className="text-sm sm:text-base font-semibold text-[#0F172A] tracking-tight font-heading">{title}</h3>
                  {description && <p className="text-xs text-[#64748B] mt-0.5 font-sans">{description}</p>}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  aria-label="Tutup dialog"
                >
                  <i className="fa-solid fa-xmark text-xs" />
                </button>
              </div>
            )}

            {/* Body */}
            <div className="p-4 sm:p-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
