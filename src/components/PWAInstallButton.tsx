import React, { useState } from 'react';
import {
  CheckCircle2,
  Download,
  MoreVertical,
  PlusSquare,
  Share,
  Smartphone,
  X,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useStore } from '../context/StoreContext';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'full' | 'card';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'compact',
}) => {
  const { siteConfig } = useStore();
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  const accent = siteConfig.primaryAccentColor || '#10B981';

  // Suppress button cleanly when already running in standalone mode
  if (isInstalled) {
    if (variant === 'card') {
      return (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white">
              تطبيق Zero Store مثبّت بالفعل
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-0.5">
              أنت تتصفح المتجر الآن من تطبيق الهاتف المستقل.
            </p>
          </div>
        </div>
      );
    }
    return null;
  }

  // In header compact bar, only show when native install is ready or device is iOS
  if (variant === 'compact' && !isInstallable && !isIOS) {
    return null;
  }

  const handleAction = async () => {
    if (isInstallable) {
      await install();
      return;
    }
    setShowGuideModal(true);
  };

  return (
    <>
      {variant === 'compact' && (
        <button
          type="button"
          onClick={handleAction}
          title="تثبيت تطبيق Zero Store على الهاتف"
          className="h-10 px-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 text-xs font-extrabold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">تثبيت التطبيق</span>
        </button>
      )}

      {variant === 'full' && (
        <button
          type="button"
          onClick={handleAction}
          className="w-full text-right px-3 py-2.5 rounded-xl text-sm font-bold flex items-center justify-between text-white cursor-pointer"
          style={{ backgroundColor: accent }}
        >
          <span className="flex items-center gap-2">
            <Smartphone className="w-4 h-4" />
            <span>تثبيت تطبيق المتجر على الهاتف</span>
          </span>
          <Download className="w-4 h-4" />
        </button>
      )}

      {variant === 'card' && (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div
              className="w-11 h-11 rounded-2xl text-white flex items-center justify-center shrink-0"
              style={{ backgroundColor: accent }}
            >
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white">
                تطبيق الهاتف (PWA)
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                ثبّت Zero Store على شاشة هاتفك الرئيسية للوصول السريع وتتبع الطلبات وعروض الفلاش بلمسة واحدة.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAction}
            className="w-full h-11 rounded-xl text-xs font-extrabold text-white flex items-center justify-center gap-2 cursor-pointer"
            style={{ backgroundColor: accent }}
          >
            <Download className="w-4 h-4" />
            <span>
              {isInstallable
                ? 'تثبيت التطبيق الآن'
                : isIOS
                ? 'خطوات التثبيت على آيفون / آيباد'
                : 'تثبيت كتطبيق على جهازك'}
            </span>
          </button>
        </div>
      )}

      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-10 h-10 rounded-xl text-white flex items-center justify-center shrink-0"
                  style={{ backgroundColor: accent }}
                >
                  <Smartphone className="w-5 h-5" />
                </div>
                <h3 className="text-base font-black text-zinc-900 dark:text-white">
                  {isIOS ? 'التثبيت على iPhone / iPad' : 'تثبيت تطبيق Zero Store'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                aria-label="إغلاق"
                className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isIOS ? (
              <div className="space-y-3 text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                <div className="flex items-start gap-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/70 p-3 border border-zinc-200 dark:border-zinc-800">
                  <Share className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
                  <p>
                    1. افتح المتجر عبر متصفح <strong>Safari</strong> واضغط على زر{' '}
                    <strong>المشاركة (Share)</strong> أسفل الشاشة.
                  </p>
                </div>
                <div className="flex items-start gap-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/70 p-3 border border-zinc-200 dark:border-zinc-800">
                  <PlusSquare className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <p>
                    2. مرّر للأسفل واختر{' '}
                    <strong>إضافة إلى الشاشة الرئيسية (Add to Home Screen)</strong> ثم اضغط{' '}
                    <strong>إضافة</strong>.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                <div className="flex items-start gap-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/70 p-3 border border-zinc-200 dark:border-zinc-800">
                  <MoreVertical className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <p>
                    افتح قائمة المتصفح (Chrome أو Edge) واختر{' '}
                    <strong>تثبيت التطبيق (Install App)</strong> أو{' '}
                    <strong>الإضافة إلى الشاشة الرئيسية</strong>.
                  </p>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full h-11 rounded-xl text-xs font-extrabold text-white cursor-pointer"
              style={{ backgroundColor: accent }}
            >
              فهمت، إغلاق
            </button>
          </div>
        </div>
      )}
    </>
  );
};
