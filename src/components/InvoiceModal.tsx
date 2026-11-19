import React, { useEffect, useState } from 'react';
import { Download, Loader2, X } from 'lucide-react';
import { OrderRecord } from '../types';
import { useStore } from '../context/StoreContext';
import {
  downloadInvoiceImage,
  formatOrderDate,
  generateInvoicePngDataUrl,
} from '../utils/invoiceGenerator';

interface InvoiceModalProps {
  order: OrderRecord | null;
  onClose: () => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({ order, onClose }) => {
  const { siteConfig } = useStore();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!order) {
      setPreviewUrl(null);
      return;
    }
    let active = true;
    generateInvoicePngDataUrl(
      order,
      siteConfig.brandName || 'ZONE',
      siteConfig.primaryAccentColor || '#10B981'
    )
      .then((url) => {
        if (active) setPreviewUrl(url);
      })
      .catch(() => {
        if (active) setPreviewUrl(null);
      });
    return () => {
      active = false;
    };
  }, [order, siteConfig.brandName, siteConfig.primaryAccentColor]);

  if (!order) return null;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadInvoiceImage(
        order,
        siteConfig.brandName || 'ZONE',
        siteConfig.primaryAccentColor || '#10B981'
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-xl my-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-extrabold text-zinc-900 dark:text-white">
              الفاتورة الرقمية · {order.orderNumber}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {formatOrderDate(order.createdAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {previewUrl ? (
            <div className="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-[#0B0E14]">
              <img
                src={previewUrl}
                alt={`فاتورة ${order.orderNumber}`}
                className="w-full h-auto block"
              />
            </div>
          ) : (
            <div className="h-64 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-center gap-2 text-xs text-zinc-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>جاري تجهيز صورة الفاتورة...</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300 cursor-pointer"
            >
              إغلاق
            </button>
            <button
              type="button"
              disabled={downloading}
              onClick={handleDownload}
              className="h-10 px-5 rounded-xl text-xs font-bold text-white flex items-center gap-2 hover:opacity-90 disabled:opacity-60 cursor-pointer"
              style={{ backgroundColor: siteConfig.primaryAccentColor || '#10B981' }}
            >
              <Download className="w-4 h-4" />
              <span>{downloading ? 'جاري التحميل...' : 'تنزيل الفاتورة كصورة PNG'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
