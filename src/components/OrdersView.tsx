import React, { useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  FileImage,
  KeyRound,
  Package,
  Search,
  ShieldCheck,
  Star,
  XCircle,
} from 'lucide-react';
import { OrderRecord } from '../types';
import { useStore } from '../context/StoreContext';
import { formatOrderDate } from '../utils/invoiceGenerator';
import {
  DELIVERY_TYPE_LABELS,
  getOrderStatusLabel,
  getTrackingStepsForDelivery,
} from '../utils/deliveryHelpers';

interface OrdersViewProps {
  onOpenAuth: () => void;
  onOpenInvoice: (order: OrderRecord) => void;
  onBrowseStore: () => void;
}

export const OrdersView: React.FC<OrdersViewProps> = ({
  onOpenAuth,
  onOpenInvoice,
  onBrowseStore,
}) => {
  const { user, userOrders, reviews, submitProductReview, siteConfig } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'failed'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [reviewingOrderId, setReviewingOrderId] = useState<string | null>(null);
  const [ratingValue, setRatingValue] = useState(5);
  const [commentValue, setCommentValue] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const filteredOrders = useMemo(() => {
    return userOrders.filter((order) => {
      if (statusFilter === 'completed' && order.status !== 'completed') return false;
      if (statusFilter === 'failed' && order.status !== 'failed') return false;
      if (
        statusFilter === 'active' &&
        (order.status === 'completed' || order.status === 'failed')
      ) {
        return false;
      }

      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        return (
          order.orderNumber.toLowerCase().includes(q) ||
          order.productTitle.toLowerCase().includes(q) ||
          order.transactionRef.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [userOrders, statusFilter, searchTerm]);

  const handleCopyText = (id: string, value: string) => {
    navigator.clipboard?.writeText(value);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleOpenReviewForm = (orderId: string) => {
    setReviewingOrderId((prev) => (prev === orderId ? null : orderId));
    setRatingValue(5);
    setCommentValue('');
    setReviewError('');
  };

  const handleSubmitReview = async (e: React.FormEvent, order: OrderRecord) => {
    e.preventDefault();
    setReviewError('');
    setSubmittingReview(true);
    try {
      await submitProductReview({
        order,
        rating: ratingValue,
        comment: commentValue,
      });
      setReviewingOrderId(null);
      setCommentValue('');
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'تعذر إرسال التقييم.');
    } finally {
      setSubmittingReview(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-5">
        <div className="w-14 h-14 mx-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] flex items-center justify-center text-zinc-700 dark:text-zinc-200">
          <Package className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-white">
          سجل الطلبات واستلام الأكواد والحسابات
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-md mx-auto">
          سجّل الدخول بحسابك لمتابعة مراحل كل طلب حسب نوعه، استلام الأكواد أو الحسابات الجاهزة، وتنزيل الفواتير.
        </p>
        <button
          type="button"
          onClick={onOpenAuth}
          className="h-11 px-6 rounded-xl text-sm font-bold text-white cursor-pointer"
          style={{ backgroundColor: siteConfig.primaryAccentColor || '#10B981' }}
        >
          تسجيل الدخول الآن
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white">
            طلباتي وتتبع الشحنات
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            يظهر مسار التتبع الخاص بكل طلب حسب نوعه (شحن مباشر، كود رقمي، اشتراك بحسابك، أو حساب جاهز).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ابحث برقم الأوردر ZN-..."
              className="h-10 w-60 pr-10 pl-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            {(
              [
                { id: 'all', label: 'الكل' },
                { id: 'active', label: 'قيد التنفيذ' },
                { id: 'completed', label: 'مكتمل' },
                { id: 'failed', label: 'مرفوض' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-white dark:bg-[#181E27] text-zinc-900 dark:text-white shadow-sm'
                    : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] p-12 text-center space-y-4">
          <Package className="w-10 h-10 mx-auto text-zinc-400" />
          <h3 className="text-base font-bold text-zinc-900 dark:text-white">
            لا توجد طلبات مطابقة حالياً
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            ابدأ بطلب منتج من المتجر لتظهر مراحل التتبع والأكواد أو الحسابات هنا مباشرة.
          </p>
          <button
            type="button"
            onClick={onBrowseStore}
            className="h-10 px-5 rounded-xl text-xs font-bold text-white cursor-pointer"
            style={{ backgroundColor: siteConfig.primaryAccentColor || '#10B981' }}
          >
            تصفح المتجر
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const steps = getTrackingStepsForDelivery(order.deliveryType);
            const stepIdx =
              order.status === 'completed'
                ? 4
                : order.status === 'processing'
                ? 3
                : order.status === 'verifying'
                ? 2
                : order.status === 'failed'
                ? 0
                : 1;

            const statusColor =
              order.status === 'completed'
                ? 'text-emerald-600 dark:text-emerald-400'
                : order.status === 'failed'
                ? 'text-rose-600 dark:text-rose-400'
                : order.status === 'verifying'
                ? 'text-sky-600 dark:text-sky-400'
                : 'text-amber-600 dark:text-amber-400';

            const existingReview = reviews.find((r) => r.orderId === order.id);
            const isReviewing = reviewingOrderId === order.id;

            return (
              <div
                key={order.id}
                className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] p-5 sm:p-6 space-y-5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800/80">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                      <span className="font-mono-tabular font-bold text-zinc-900 dark:text-white">
                        {order.orderNumber}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-bold text-zinc-700 dark:text-zinc-300">
                        {DELIVERY_TYPE_LABELS[order.deliveryType]?.short || 'طلب رقمي'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{formatOrderDate(order.createdAt)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{order.paymentMethodName}</span>
                    </div>
                    <h3 className="text-base font-extrabold text-zinc-900 dark:text-white">
                      {order.productTitle} — {order.packageName} (×{order.quantity})
                    </h3>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-left">
                      <div className={`flex items-center gap-1.5 text-xs font-bold ${statusColor}`}>
                        {order.status === 'completed' ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : order.status === 'failed' ? (
                          <XCircle className="w-4 h-4" />
                        ) : (
                          <Clock className="w-4 h-4" />
                        )}
                        <span>{getOrderStatusLabel(order.status, order.deliveryType)}</span>
                      </div>
                      <p className="text-sm font-extrabold font-mono-tabular text-zinc-900 dark:text-white mt-0.5">
                        {order.totalAmount.toFixed(2)} {order.currencySymbol}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Distinct 4-Step Tracking Pipeline per Delivery Type */}
                {order.status !== 'failed' && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-[11px]">
                    {steps.map((step, i) => {
                      const active = i + 1 <= stepIdx;
                      return (
                        <div key={step.key} className="space-y-1.5">
                          <div
                            className={`h-1.5 rounded-full transition-colors ${
                              active ? 'bg-emerald-500' : 'bg-zinc-200 dark:bg-zinc-800'
                            }`}
                          />
                          <p
                            className={`font-semibold leading-snug ${
                              active
                                ? 'text-zinc-900 dark:text-zinc-100'
                                : 'text-zinc-400 dark:text-zinc-600'
                            }`}
                          >
                            {step.label}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Subscription Login Security Status Notice */}
                {order.deliveryType === 'subscription_login' && order.accountEmail && (
                  <div className="rounded-xl border border-sky-500/25 bg-sky-500/5 px-3.5 py-2.5 text-xs text-sky-700 dark:text-sky-300 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>
                      حساب التفعيل المرسل: <strong className="font-mono-tabular">{order.accountEmail}</strong>
                      {order.status === 'completed'
                        ? ' — تم تفعيل الاشتراك وتسجيل الخروج من الحساب بنجاح.'
                        : ' — سيتم الخروج من الحساب فور إتمام التفعيل.'}
                    </span>
                  </div>
                )}

                {/* Delivered Account Credentials Box (account_delivery) */}
                {(order.deliveredAccountEmail || order.deliveredAccountPassword) && (
                  <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/5 p-4 space-y-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                      <KeyRound className="w-4 h-4" />
                      <span>بيانات الحساب الجاهز المسلمة لك:</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {order.deliveredAccountEmail && (
                        <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs">
                          <span className="font-mono-tabular font-bold select-all truncate">
                            {order.deliveredAccountEmail}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyText(`${order.id}_email`, order.deliveredAccountEmail)}
                            className="px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-[11px] font-bold shrink-0 cursor-pointer"
                          >
                            {copiedId === `${order.id}_email` ? 'نُسخ' : 'نسخ البريد'}
                          </button>
                        </div>
                      )}
                      {order.deliveredAccountPassword && (
                        <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs">
                          <span className="font-mono-tabular font-bold select-all truncate">
                            {order.deliveredAccountPassword}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyText(`${order.id}_pass`, order.deliveredAccountPassword)}
                            className="px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-[11px] font-bold shrink-0 cursor-pointer"
                          >
                            {copiedId === `${order.id}_pass` ? 'نُسخ' : 'نسخ كلمة السر'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
                  <div className="flex-1 min-w-0">
                    {order.deliveredCode ? (
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                          {order.deliveryType === 'direct_id'
                            ? 'مرجع تأكيد الشحن:'
                            : order.deliveryType === 'subscription_login'
                            ? 'تأكيد التفعيل والخروج:'
                            : order.deliveryType === 'account_delivery'
                            ? 'ملاحظة الحساب:'
                            : 'الكود الرقمي:'}
                        </span>
                        <code className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm font-mono-tabular font-bold text-emerald-600 dark:text-emerald-400 select-all">
                          {order.deliveredCode}
                        </code>
                        <button
                          type="button"
                          onClick={() => handleCopyText(order.id, order.deliveredCode)}
                          className="h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-200 flex items-center gap-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                        >
                          {copiedId === order.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span>{copiedId === order.id ? 'تم النسخ' : 'نسخ'}</span>
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {order.playerId ? `معرّف اللاعب: ${order.playerId} · ` : ''}
                        رقم الأوردر: {order.orderNumber}
                        {order.adminNote ? ` · ملاحظة الإدارة: ${order.adminNote}` : ''}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    {order.status === 'completed' && !existingReview && (
                      <button
                        type="button"
                        onClick={() => handleOpenReviewForm(order.id)}
                        className="h-10 px-4 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-xs font-bold text-amber-600 dark:text-amber-300 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <span>{isReviewing ? 'إلغاء التقييم' : 'قيّم المنتج'}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onOpenInvoice(order)}
                      className="h-10 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-bold text-zinc-800 dark:text-zinc-100 flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                    >
                      <FileImage className="w-4 h-4" />
                      <span>تنزيل الفاتورة كصورة</span>
                    </button>
                  </div>
                </div>

                {/* Submitted Review Display */}
                {existingReview && (
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                          تقييمك الموثق للطلب:
                        </span>
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, idx) => (
                            <Star
                              key={idx}
                              className={`w-3.5 h-3.5 ${
                                idx < existingReview.rating
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-zinc-300 dark:text-zinc-700'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-zinc-700 dark:text-zinc-300">
                        «{existingReview.comment}»
                      </p>
                    </div>
                  </div>
                )}

                {/* Inline Review Submission Form */}
                {order.status === 'completed' && !existingReview && isReviewing && (
                  <form
                    onSubmit={(e) => handleSubmitReview(e, order)}
                    className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0D1016] p-4 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-zinc-900 dark:text-white">
                        أضف تقييمك ورأيك في {order.productTitle}
                      </span>
                      <div className="flex items-center gap-1" role="radiogroup" aria-label="اختر عدد النجوم">
                        {[1, 2, 3, 4, 5].map((starVal) => (
                          <button
                            key={starVal}
                            type="button"
                            onClick={() => setRatingValue(starVal)}
                            className="p-1 cursor-pointer transition-transform hover:scale-110"
                            aria-label={`${starVal} نجوم`}
                          >
                            <Star
                              className={`w-5 h-5 ${
                                starVal <= ratingValue
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-zinc-300 dark:text-zinc-700'
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>

                    <textarea
                      rows={2}
                      required
                      minLength={2}
                      maxLength={400}
                      value={commentValue}
                      onChange={(e) => setCommentValue(e.target.value)}
                      placeholder="اكتب رأيك حول سرعة الشحن وموثوقية الخدمة..."
                      className="w-full p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    />

                    {reviewError && <p className="text-[11px] text-rose-500">{reviewError}</p>}

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={submittingReview}
                        className="h-9 px-5 rounded-xl text-xs font-bold text-white disabled:opacity-60 cursor-pointer"
                        style={{ backgroundColor: siteConfig.primaryAccentColor || '#10B981' }}
                      >
                        {submittingReview ? 'جاري النشر...' : 'نشر التقييم'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
