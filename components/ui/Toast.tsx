'use client';
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

const ToastContext = createContext<(msg: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  const showToast = useCallback((m: string) => {
    setMsg(m);
    setVisible(true);
    setTimeout(() => setVisible(false), 2200);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] rounded-full px-5 py-2.5 text-white text-[12.5px] transition-all duration-300 pointer-events-none"
        style={{
          background: 'linear-gradient(135deg,#123527,#0B6E4F)',
          boxShadow: '0 14px 34px rgba(11,110,79,.35)',
          opacity: visible ? 1 : 0,
          transform: `translate(-50%, ${visible ? '-4px' : '0'})`,
        }}
      >
        {msg}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
