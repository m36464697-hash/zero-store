import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';

interface FeedNotification {
  id: string;
  displayName: string;
  productTitle: string;
  city: string;
  amountLabel: string;
  timeText: string;
}

const THIRTY_MINUTES_MS = 30 * 60 * 1000;

function extractTimestampMs(createdAt: unknown): number | null {
  if (!createdAt) return null;
  if (typeof createdAt === 'object' && 'toMillis' in createdAt) {
    return (createdAt as { toMillis: () => number }).toMillis();
  }
  if (typeof createdAt === 'string' || typeof createdAt === 'number') {
    const parsed = new Date(createdAt).getTime();
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function formatMinutesAgo(diffMs: number): string {
  const mins = Math.max(0, Math.floor(diffMs / 60000));
  if (mins < 1) return 'الآن';
  if (mins === 1) return 'قبل دقيقة';
  if (mins === 2) return 'قبل دقيقتين';
  if (mins <= 10) return `قبل ${mins} دقائق`;
  return `قبل ${mins} دقيقة`;
}

export const LivePurchaseToast: React.FC = () => {
  const { publicActivity, siteConfig } = useStore();
  const [visible, setVisible] = useState(true);
  const [dismissedPermanently, setDismissedPermanently] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Re-evaluate 30-minute freshness window periodically
  useEffect(() => {
    const clock = setInterval(() => {
      setNowMs(Date.now());
    }, 20000);
    return () => clearInterval(clock);
  }, []);

  // Strictly show ONLY real completed orders from the last 30 minutes (no fake/seeded entries)
  const notifications = useMemo<FeedNotification[]>(() => {
    const fresh: FeedNotification[] = [];
    for (const item of publicActivity) {
      const ts = extractTimestampMs(item.createdAt);
      if (ts === null) continue;
      const diff = nowMs - ts;
      if (diff >= -60000 && diff <= THIRTY_MINUTES_MS) {
        fresh.push({
          id: item.id,
          displayName: item.displayName,
          productTitle: item.productTitle,
          city: item.city,
          amountLabel: item.amountLabel,
          timeText: formatMinutesAgo(Math.max(0, diff)),
        });
      }
    }
    return fresh;
  }, [publicActivity, nowMs]);

  useEffect(() => {
    if (notifications.length > 0 && siteConfig.livePopupEnabled && !dismissedPermanently) {
      setCurrentIndex(0);
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [notifications.length, siteConfig.livePopupEnabled, dismissedPermanently]);

  useEffect(() => {
    if (
      !siteConfig.livePopupEnabled ||
      dismissedPermanently ||
      notifications.length <= 1
    ) {
      return;
    }

    const cycleInterval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % notifications.length);
        setVisible(true);
      }, 400);
    }, 8500);

    return () => clearInterval(cycleInterval);
  }, [siteConfig.livePopupEnabled, dismissedPermanently, notifications.length]);

  if (!siteConfig.livePopupEnabled || dismissedPermanently || !visible || notifications.length === 0) {
    return null;
  }

  const activeItem = notifications[currentIndex % notifications.length];
  if (!activeItem) return null;

  return (
    <div
      dir="rtl"
      className="fixed bottom-4 left-4 z-30 max-w-[320px] w-[calc(100vw-2rem)] sm:w-auto pointer-events-auto transition-all duration-300"
      aria-live="polite"
    >
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-[#131820]/95 backdrop-blur-md shadow-xl px-3.5 py-3 flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center text-white"
          style={{ backgroundColor: siteConfig.primaryAccentColor || '#10B981' }}
        >
          <CheckCircle2 className="w-5 h-5" />
        </div>

        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-zinc-900 dark:text-white truncate">
              طلب مكتمل · {activeItem.displayName}
            </span>
            <button
              type="button"
              onClick={() => setDismissedPermanently(true)}
              aria-label="إخفاء التنبيهات"
              className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-xs text-zinc-700 dark:text-zinc-300 truncate font-medium">
            {activeItem.productTitle}
          </p>
          <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
            <span className="font-mono-tabular font-semibold text-emerald-600 dark:text-emerald-400">
              {activeItem.amountLabel}
            </span>
            <span aria-hidden="true">·</span>
            <span>{activeItem.timeText}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
