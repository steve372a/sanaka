import React, { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  visible: boolean;
  onClose: () => void;
  duration?: number;
  tone?: 'default' | 'success';
}

export function Toast({ message, visible, onClose, duration = 3000, tone = 'default' }: ToastProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (visible) {
      setShow(true);
      const timer = setTimeout(() => {
        setShow(false);
        setTimeout(onClose, 300);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [visible, duration, onClose]);

  if (!visible && !show) return null;

  return (
    <div
      className={`toast toast--${tone} ${show ? 'toast--visible' : 'toast--hidden'}`}
      role="status"
      aria-live="polite"
    >
      {tone === 'success' && (
        <span className="toast__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="m8 12 2.6 2.6L16.5 9" />
          </svg>
        </span>
      )}
      <span className="toast__message">{message}</span>
    </div>
  );
}
