import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

type Toast = { id: number; message: string; type?: 'success' | 'error' | 'info' };

type ToastContextValue = {
  notify: (message: string, type?: Toast['type']) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const notify = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((t) => [...t, { id, message, type }]);
    // removal handled by the ToastItem to allow exit animation
  }, []);

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div className="fixed top-6 right-6 space-y-3 z-50 w-auto max-w-sm" aria-live="polite">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const { id, message, type } = toast;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // enter
    const enter = setTimeout(() => setVisible(true), 20);
    // auto close after 3s (start exit at 2.8s)
    const exit = setTimeout(() => setVisible(false), 2800);
    const remove = setTimeout(() => onClose(), 3200);
    return () => {
      clearTimeout(enter);
      clearTimeout(exit);
      clearTimeout(remove);
    };
  }, [id, onClose]);

  const base = 'rounded-lg border bg-white/80 backdrop-blur-sm px-4 py-3 shadow-lg flex items-start gap-3 ring-1 ring-black/5';
  const accent = type === 'success' ? 'text-rose-600' : type === 'error' ? 'text-red-600' : 'text-gray-700';

  return (
    <div
      role="status"
      className={`${base} ${visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'} transform transition-all duration-300 ease-out`}
      aria-live="polite"
    >
      <div className={`mt-0.5 ${accent} shrink-0`}> 
        {type === 'success' ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M9.3 16.29 4.6 11.6a1 1 0 10-1.4 1.42l5.3 5.29a1 1 0 001.42 0l10-9.99a1 1 0 10-1.42-1.42L9.3 16.29z"/></svg>
        ) : type === 'error' ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M11.25 2.5a1 1 0 011.5 0l8 10.5a1 1 0 01-.75 1.5H4a1 1 0 01-.75-1.5L11.25 2.5z"/></svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm.75 5.5a1 1 0 11-2 0 1 1 0 012 0zM11 10v6h2v-6h-2z"/></svg>
        )}
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium text-gray-900">{type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Info'}</div>
        <div className="text-sm text-gray-700">{message}</div>
      </div>
      <button onClick={() => { setVisible(false); setTimeout(onClose, 220); }} aria-label="Dismiss" className="text-gray-400 hover:text-gray-600">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6.28 5.22a.75.75 0 011.06 0L10 7.88l2.66-2.66a.75.75 0 111.06 1.06L11.06 9l2.66 2.66a.75.75 0 11-1.06 1.06L10 10.12l-2.66 2.66a.75.75 0 11-1.06-1.06L8.94 9 6.28 6.34a.75.75 0 010-1.06z" clipRule="evenodd"/></svg>
      </button>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

