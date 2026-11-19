import React, { useState } from 'react';
import { WifiOff, X } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [dismissed, setDismissed] = useState(false);

  if (isOnline || dismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 left-4 sm:left-auto sm:right-4 z-50 flex items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-amber-500 px-4 py-2.5 text-xs font-bold text-zinc-950 shadow-2xl"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="w-7 h-7 rounded-xl bg-zinc-950/15 flex items-center justify-center shrink-0">
          <WifiOff className="w-4 h-4" />
        </span>
        <span className="truncate">
          وضع عدم الاتصال — يتم عرض البيانات المخزنة مؤقتاً حتى عودة الإنترنت.
        </span>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="إغلاق تنبيه عدم الاتصال"
        className="p-1 rounded-lg hover:bg-zinc-950/10 shrink-0 cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
