import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  FileImage,
  Layers,
  Lock,
  Mail,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Star,
  Tag,
  Ticket,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import {
  Coupon,
  FlashDeal,
  OrderRecord,
  Product,
  ProductPackage,
  SavedVoucher,
  ValueBundle,
} from '../types';
import { useStore } from '../context/StoreContext';
import {
  DELIVERY_TYPE_LABELS,
  formatRemainingTime,
  generateAutoOrderNumber,
  getOrderStatusLabel,
  getTrackingStepsForDelivery,
  toMillisSafe,
} from '../utils/deliveryHelpers';

interface CheckoutModalProps {
  product: Product | null;
  initialPackageId?: string;
  flashDeal?: FlashDeal | null;
  bundle?: ValueBundle | null;
  onClose: () => void;
  onRequireAuth: () => void;
  onOpenInvoice: (order: OrderRecord) => void;
  onGoToOrders: () => void;
  onGoToProfileWallet: () => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  product,
  initialPackageId,
  flashDeal,
  bundle,
  onClose,
  onRequireAuth,
  onOpenInvoice,
  onGoToOrders,
  onGoToProfileWallet,
}) => {
  const {
    user,
    userProfile,
    isAdmin,
    siteConfig,
    coupons,
    savedVouchers,
    paymentMethods,
    reviews,
    catalogSeeded,
    walletsSeeded,
    bundlesSeeded,
    seedDefaultStoreData,
    placeOrderAndTrack,
    addToCart,
    setCartOpen,
    submitProductReview,
    userOrders,
    nowMs,
  } = useStore();

  const activeWallets = useMemo(
    () => paymentMethods.filter((m) => m.isActive),
    [paymentMethods]
  );

  const validSavedVouchers = useMemo(
    () => savedVouchers.filter((sv) => toMillisSafe(sv.expiresAt) > nowMs),
    [savedVouchers, nowMs]
  );

  const [selectedPkg, setSelectedPkg] = useState<ProductPackage | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [playerId, setPlayerId] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [accountNotes, setAccountNotes] = useState('');

  const [paymentSource, setPaymentSource] = useState<string>('');
  const [walletSenderPhone, setWalletSenderPhone] = useState('');
  const [draftOrderNumber, setDraftOrderNumber] = useState('');
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [appliedSavedVoucher, setAppliedSavedVoucher] = useState<SavedVoucher | null>(null);
  const [couponFeedback, setCouponFeedback] = useState('');

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [seedingNow, setSeedingNow] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
  const [fallbackOrder, setFallbackOrder] = useState<OrderRecord | null>(null);

  // Quick review state for completed orders inside modal
  const [modalRating, setModalRating] = useState(5);
  const [modalComment, setModalComment] = useState('');
  const [modalReviewSending, setModalReviewSending] = useState(false);
  const [modalReviewMsg, setModalReviewMsg] = useState('');

  useEffect(() => {
    if (product) {
      const matchedPkg = initialPackageId
        ? product.packages.find((p) => p.id === initialPackageId)
        : undefined;
      setSelectedPkg(matchedPkg || product.packages[0] || null);
      setQuantity(1);
      setPlayerId('');
      setAccountEmail('');
      setAccountPassword('');
      setAccountNotes('');
      setDraftOrderNumber(generateAutoOrderNumber());
      setCouponInput('');
      setAppliedCoupon(null);
      setAppliedSavedVoucher(null);
      setCouponFeedback('');
      setErrorMsg('');
      setCreatedOrderId(null);
      setFallbackOrder(null);
      setModalRating(5);
      setModalComment('');
      setModalReviewMsg('');
      setWalletSenderPhone(userProfile?.phone || '');
      if (user && (userProfile?.walletBalance ?? 0) > 0) {
        setPaymentSource('site_balance');
      } else if (activeWallets.length > 0) {
        setPaymentSource(activeWallets[0].id);
      }
    }
  }, [product, initialPackageId, userProfile?.phone]);

  useEffect(() => {
    if (
      paymentSource !== 'site_balance' &&
      activeWallets.length > 0 &&
      !activeWallets.some((w) => w.id === paymentSource)
    ) {
      setPaymentSource(activeWallets[0].id);
    }
  }, [activeWallets, paymentSource]);

  const isSiteBalance = paymentSource === 'site_balance';
  const selectedWallet = !isSiteBalance
    ? activeWallets.find((w) => w.id === paymentSource) || activeWallets[0]
    : null;

  const unitPrice = selectedPkg?.price || 0;
  const rawSubtotal = unitPrice * quantity;

  const discountAmount = useMemo(() => {
    if (appliedSavedVoucher) {
      if (rawSubtotal < appliedSavedVoucher.minOrderAmount) return 0;
      if (appliedSavedVoucher.voucherType === 'discount_percent') {
        return Number(((rawSubtotal * appliedSavedVoucher.value) / 100).toFixed(2));
      }
      return Math.min(rawSubtotal, appliedSavedVoucher.value);
    }
    if (appliedCoupon) {
      if (rawSubtotal < appliedCoupon.minOrderAmount) return 0;
      if (appliedCoupon.discountType === 'percent') {
        return Number(((rawSubtotal * appliedCoupon.discountValue) / 100).toFixed(2));
      }
      return Math.min(rawSubtotal, appliedCoupon.discountValue);
    }
    return 0;
  }, [appliedCoupon, appliedSavedVoucher, rawSubtotal]);

  const productReviews = useMemo(() => {
    if (!product) return [];
    return reviews.filter((r) => r.productId === product.id);
  }, [reviews, product]);

  const averageRating = useMemo(() => {
    if (productReviews.length === 0) return null;
    const sum = productReviews.reduce((acc, r) => acc + r.rating, 0);
    return (sum / productReviews.length).toFixed(1);
  }, [productReviews]);

  if (!product) return null;

  const discountedSubtotal = Math.max(0, rawSubtotal - discountAmount);
  const feePercent = isSiteBalance ? 0 : selectedWallet?.feePercent || 0;
  const feeAmount = Number(((discountedSubtotal * feePercent) / 100).toFixed(2));
  const totalAmount = Number((discountedSubtotal + feeAmount).toFixed(2));
  const userBalance = userProfile?.walletBalance ?? 0;

  const liveOrder = userOrders.find((o) => o.id === createdOrderId) || fallbackOrder;
  const liveOrderReview = liveOrder ? reviews.find((r) => r.orderId === liveOrder.id) : undefined;

  const requiresDirectId = product.deliveryType === 'direct_id' || product.requiresPlayerId;
  const requiresSubLogin = product.deliveryType === 'subscription_login';

  const handleApplyCoupon = () => {
    setCouponFeedback('');
    const code = couponInput.trim().toUpperCase();
    if (!code) return;

    const sv = validSavedVouchers.find((v) => v.code.toUpperCase() === code);
    if (sv) {
      if (rawSubtotal < sv.minOrderAmount) {
        setAppliedCoupon(null);
        setAppliedSavedVoucher(null);
        setCouponFeedback(`الحد الأدنى لهذه القسيمة هو ${sv.minOrderAmount} ${siteConfig.currencySymbol}.`);
        return;
      }
      setAppliedSavedVoucher(sv);
      setAppliedCoupon(null);
      setCouponFeedback(`تم تفعيل قسيمة الخصم (${sv.code}) بنجاح.`);
      return;
    }

    const match = coupons.find((c) => c.isActive && c.code.toUpperCase() === code);
    if (!match) {
      setAppliedCoupon(null);
      setAppliedSavedVoucher(null);
      setCouponFeedback('كود الخصم أو القسيمة غير صالح.');
      return;
    }
    if (rawSubtotal < match.minOrderAmount) {
      setAppliedCoupon(null);
      setAppliedSavedVoucher(null);
      setCouponFeedback(
        `الحد الأدنى لاستخدام الكود هو ${match.minOrderAmount} ${siteConfig.currencySymbol}.`
      );
      return;
    }
    setAppliedCoupon(match);
    setAppliedSavedVoucher(null);
    setCouponFeedback(
      `تم تفعيل خصم ${
        match.discountType === 'percent'
          ? `${match.discountValue}%`
          : `${match.discountValue} ${siteConfig.currencySymbol}`
      } بنجاح.`
    );
  };

  const handleSelectSavedVoucher = (sv: SavedVoucher) => {
    if (rawSubtotal < sv.minOrderAmount) {
      setCouponFeedback(`الحد الأدنى للقسيمة ${sv.code} هو ${sv.minOrderAmount} ${siteConfig.currencySymbol}.`);
      return;
    }
    setAppliedSavedVoucher(sv);
    setAppliedCoupon(null);
    setCouponInput(sv.code);
    setCouponFeedback(`تم تطبيق القسيمة المحفوظة (${sv.code}).`);
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleSeedFromModal = async () => {
    setSeedingNow(true);
    try {
      await seedDefaultStoreData();
      setErrorMsg('');
    } catch {
      setErrorMsg('تعذر تهيئة بيانات المتجر.');
    } finally {
      setSeedingNow(false);
    }
  };

  const validateItemInputs = (): boolean => {
    if (!selectedPkg) {
      setErrorMsg('يرجى اختيار الباقة أولاً.');
      return false;
    }
    if (requiresDirectId && !playerId.trim()) {
      setErrorMsg(`يرجى إدخال ${product.playerIdLabel || 'معرّف اللاعب'}.`);
      return false;
    }
    if (requiresSubLogin && (!accountEmail.trim() || !accountPassword.trim())) {
      setErrorMsg('يرجى إدخال البريد/اسم المستخدم وكلمة المرور الخاصة بالاشتراك لتفعيله.');
      return false;
    }
    return true;
  };

  const handleAddItemToCart = () => {
    setErrorMsg('');
    if (!validateItemInputs() || !selectedPkg) return;
    addToCart({
      product,
      pkg: selectedPkg,
      quantity,
      playerId: playerId.trim(),
      accountEmail: accountEmail.trim(),
      accountPassword: accountPassword.trim(),
      accountNotes: accountNotes.trim(),
    });
    onClose();
    setCartOpen(true);
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!user) {
      onRequireAuth();
      return;
    }

    if (!catalogSeeded || !walletsSeeded || (bundle && !bundlesSeeded)) {
      setErrorMsg(
        'بانتظار تفعيل قاعدة بيانات المتجر من حساب المشرف أولاً لإتمام عمليات الشراء الحقيقية.'
      );
      return;
    }

    if (!validateItemInputs() || !selectedPkg) return;

    if (isSiteBalance) {
      if (userBalance < totalAmount) {
        setErrorMsg('رصيد حسابك بالموقع غير كافٍ. يمكنك شحن الرصيد من ملفك الشخصي.');
        return;
      }
    } else {
      if (!selectedWallet) {
        setErrorMsg('يرجى اختيار محفظة الدفع.');
        return;
      }
      if (walletSenderPhone.trim().length < 4) {
        setErrorMsg('يرجى إدخال رقم المحفظة المحوّل منها.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const order = await placeOrderAndTrack({
        product,
        pkg: selectedPkg,
        quantity,
        paymentMethodId: isSiteBalance ? 'site_balance' : selectedWallet!.id,
        paymentMethodName: isSiteBalance ? 'رصيد الحساب بالموقع' : selectedWallet!.name,
        feePercent,
        walletSenderPhone: isSiteBalance ? 'رصيد الحساب بالموقع' : walletSenderPhone,
        orderNumber: draftOrderNumber,
        playerId,
        accountEmail,
        accountPassword,
        accountNotes,
        couponCode: appliedSavedVoucher?.code || appliedCoupon?.code || '',
        discountAmount,
      });
      setCreatedOrderId(order.id);
      setFallbackOrder(order);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'حدث خطأ أثناء إرسال الطلب.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleModalReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveOrder || liveOrder.status !== 'completed') return;
    setModalReviewSending(true);
    setModalReviewMsg('');
    try {
      await submitProductReview({
        order: liveOrder,
        rating: modalRating,
        comment: modalComment,
      });
      setModalComment('');
    } catch (err) {
      setModalReviewMsg(err instanceof Error ? err.message : 'تعذر نشر التقييم.');
    } finally {
      setModalReviewSending(false);
    }
  };

  const trackingSteps = getTrackingStepsForDelivery(
    liveOrder ? liveOrder.deliveryType : product.deliveryType
  );

  const getStepIndex = (status: string) => {
    if (status === 'completed') return 3;
    if (status === 'processing') return 2;
    if (status === 'verifying') return 1;
    return 0;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-4xl my-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-lg font-extrabold text-zinc-900 dark:text-white truncate">
                {liveOrder ? `تتبع الطلب · ${liveOrder.orderNumber}` : product.title}
              </h2>
              {!liveOrder && (
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                  {DELIVERY_TYPE_LABELS[product.deliveryType]?.short}
                </span>
              )}
              {!liveOrder && averageRating && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-500">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span className="font-mono-tabular">{averageRating}</span>
                  <span className="text-zinc-400 font-normal">({productReviews.length})</span>
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
              {liveOrder ? `${liveOrder.productTitle} — ${liveOrder.packageName}` : product.subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Distinct Order Tracking View after submission */}
        {liveOrder ? (
          <div className="p-6 sm:p-8 space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {trackingSteps.map((step, idx) => {
                const activeIdx = getStepIndex(liveOrder.status);
                const done = idx <= activeIdx;
                return (
                  <div
                    key={step.key}
                    className={`rounded-xl border p-3.5 transition-colors ${
                      done
                        ? 'border-emerald-500/40 bg-emerald-500/10'
                        : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-mono-tabular font-bold text-zinc-500 dark:text-zinc-400">
                        0{idx + 1}
                      </span>
                      {done ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Clock className="w-4 h-4 text-zinc-400" />
                      )}
                    </div>
                    <p className="text-xs font-bold text-zinc-900 dark:text-white">{step.label}</p>
                  </div>
                );
              })}
            </div>

            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0B0E14] p-6 text-center space-y-3">
              <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                {getOrderStatusLabel(liveOrder.status, liveOrder.deliveryType)}
              </p>

              {/* Delivered Account Box (for account_delivery) */}
              {(liveOrder.deliveredAccountEmail || liveOrder.deliveredAccountPassword) && (
                <div className="max-w-md mx-auto rounded-xl border border-emerald-500/40 bg-white dark:bg-[#11151B] p-4 text-right space-y-2.5">
                  <p className="text-xs font-extrabold text-emerald-500">
                    بيانات الحساب الجاهز المسلم لك:
                  </p>
                  {liveOrder.deliveredAccountEmail && (
                    <div className="flex items-center justify-between gap-2 text-xs bg-zinc-50 dark:bg-zinc-900 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                      <span className="font-mono-tabular font-bold select-all truncate">
                        {liveOrder.deliveredAccountEmail}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(liveOrder.deliveredAccountEmail, 'acc_email')}
                        className="px-2 py-1 rounded bg-zinc-200 dark:bg-zinc-800 text-[11px] font-bold cursor-pointer shrink-0"
                      >
                        {copiedKey === 'acc_email' ? 'نُسخ' : 'نسخ البريد'}
                      </button>
                    </div>
                  )}
                  {liveOrder.deliveredAccountPassword && (
                    <div className="flex items-center justify-between gap-2 text-xs bg-zinc-50 dark:bg-zinc-900 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                      <span className="font-mono-tabular font-bold select-all truncate">
                        {liveOrder.deliveredAccountPassword}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(liveOrder.deliveredAccountPassword, 'acc_pass')}
                        className="px-2 py-1 rounded bg-zinc-200 dark:bg-zinc-800 text-[11px] font-bold cursor-pointer shrink-0"
                      >
                        {copiedKey === 'acc_pass' ? 'نُسخ' : 'نسخ كلمة السر'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {liveOrder.deliveredCode ? (
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <code className="px-5 py-3 rounded-xl bg-white dark:bg-[#11151B] border border-emerald-500/40 text-lg sm:text-xl font-extrabold font-mono-tabular text-emerald-600 dark:text-emerald-400 tracking-wider select-all">
                    {liveOrder.deliveredCode}
                  </code>
                  <button
                    type="button"
                    onClick={() => handleCopy(liveOrder.deliveredCode, 'code')}
                    className="h-11 px-4 rounded-xl bg-zinc-900 dark:bg-zinc-800 text-white text-xs font-bold flex items-center gap-2 hover:opacity-90 cursor-pointer"
                  >
                    {copiedKey === 'code' ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    <span>{copiedKey === 'code' ? 'تم النسخ' : 'نسخ'}</span>
                  </button>
                </div>
              ) : (
                !liveOrder.deliveredAccountEmail && (
                  <div className="py-2 space-y-1">
                    <p className="text-sm font-bold text-amber-600 dark:text-amber-400">
                      {liveOrder.paymentMethodId === 'site_balance'
                        ? 'تم الخصم من رصيدك بنجاح وجاري تنفيذ الطلب من الإدارة'
                        : `بانتظار مراجعة التحويل وتأكيد المبلغ (${liveOrder.totalAmount} ${liveOrder.currencySymbol})`}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {liveOrder.deliveryType === 'subscription_login'
                        ? 'سيتم الدخول لحسابك لتفعيل الاشتراك ثم تسجيل الخروج فوراً وإشعارك عند الاكتمال.'
                        : 'يتم تحديث مراحل التتبع تلقائياً وإرسال إشعار فور التنفيذ.'}
                    </p>
                  </div>
                )
              )}
            </div>

            {/* Post-completion Rating Prompt right inside tracking */}
            {liveOrder.status === 'completed' && !liveOrderReview && (
              <form
                onSubmit={handleModalReviewSubmit}
                className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-zinc-900 dark:text-white">
                    شارك تقييمك بعد اكتمال الطلب:
                  </span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((starVal) => (
                      <button
                        key={starVal}
                        type="button"
                        onClick={() => setModalRating(starVal)}
                        className="p-0.5 cursor-pointer"
                      >
                        <Star
                          className={`w-5 h-5 ${
                            starVal <= modalRating
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-zinc-300 dark:text-zinc-700'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={400}
                    value={modalComment}
                    onChange={(e) => setModalComment(e.target.value)}
                    placeholder="اكتب رأيك في الخدمة وسرعة التنفيذ..."
                    className="flex-1 h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] text-xs text-zinc-900 dark:text-white"
                  />
                  <button
                    type="submit"
                    disabled={modalReviewSending}
                    className="h-10 px-4 rounded-xl text-xs font-bold text-white shrink-0 cursor-pointer"
                    style={{ backgroundColor: siteConfig.primaryAccentColor || '#10B981' }}
                  >
                    {modalReviewSending ? 'جاري النشر...' : 'إرسال التقييم'}
                  </button>
                </div>
                {modalReviewMsg && <p className="text-[11px] text-rose-500">{modalReviewMsg}</p>}
              </form>
            )}

            {liveOrderReview && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 text-xs text-emerald-700 dark:text-emerald-300 flex items-center justify-between gap-2">
                <span>شكراً لك! تم تسجيل تقييمك: «{liveOrderReview.comment}»</span>
                <span className="font-mono-tabular font-bold shrink-0">★ {liveOrderReview.rating}/5</span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <div className="text-xs text-zinc-600 dark:text-zinc-400 space-y-0.5">
                <p>
                  طريقة الدفع: <strong className="text-zinc-900 dark:text-white">{liveOrder.paymentMethodName}</strong>
                </p>
                <p>
                  الإجمالي:{' '}
                  <strong className="font-mono-tabular text-zinc-900 dark:text-white">
                    {liveOrder.totalAmount} {liveOrder.currencySymbol}
                  </strong>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => onOpenInvoice(liveOrder)}
                  className="h-10 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white text-xs font-bold flex items-center gap-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer"
                >
                  <FileImage className="w-4 h-4" />
                  <span>عرض وتحميل الفاتورة</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onGoToOrders();
                  }}
                  className="h-10 px-4 rounded-xl text-white text-xs font-bold cursor-pointer"
                  style={{ backgroundColor: siteConfig.primaryAccentColor || '#10B981' }}
                >
                  الانتقال إلى طلباتي
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Checkout Form */
          <form onSubmit={handleSubmitOrder} className="grid grid-cols-1 lg:grid-cols-12">
            {/* Right Side (RTL start): Packages, Delivery Inputs, Coupon, Payment Source & Reviews */}
            <div className="lg:col-span-7 p-6 space-y-5 border-b lg:border-b-0 lg:border-l border-zinc-200 dark:border-zinc-800">
              {(!catalogSeeded || !walletsSeeded || (bundle && !bundlesSeeded)) && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-700 dark:text-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span>
                    تعمل المعاينة بالبيانات الافتراضية؛ لتفعيل الشراء الحقيقي يرجى تهيئة قاعدة البيانات من حساب المشرف.
                  </span>
                  {isAdmin && (
                    <button
                      type="button"
                      disabled={seedingNow}
                      onClick={handleSeedFromModal}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 text-zinc-950 font-bold shrink-0 cursor-pointer"
                    >
                      {seedingNow ? 'جاري التفعيل...' : 'تفعيل المتجر الآن'}
                    </button>
                  )}
                </div>
              )}

              {flashDeal && (
                <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Zap className="w-4 h-4 text-amber-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold text-zinc-900 dark:text-white truncate">
                        عرض فلاش نشط: {flashDeal.title}
                      </p>
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                        سعر مخفض حصرياً بدلاً من {flashDeal.originalPrice} {siteConfig.currencySymbol}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono-tabular font-bold text-amber-600 dark:text-amber-400 shrink-0">
                    {formatRemainingTime(flashDeal.endsAt, nowMs)}
                  </span>
                </div>
              )}

              {bundle && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-extrabold text-zinc-900 dark:text-white">
                      <Layers className="w-4 h-4 text-emerald-500" />
                      <span>محتويات بكج التوفير ({bundle.items.length} عناصر)</span>
                    </div>
                    <span className="text-xs font-mono-tabular font-bold text-emerald-600 dark:text-emerald-400">
                      توفير {Math.max(0, bundle.originalTotalPrice - bundle.bundlePrice)} {siteConfig.currencySymbol}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {bundle.items.map((item, idx) => (
                      <div
                        key={`${item.productId}-${idx}`}
                        className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] px-3 py-2 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-zinc-900 dark:text-white truncate">
                            {item.productTitle}
                          </p>
                          <p className="text-[11px] text-zinc-500 truncate">{item.packageName}</p>
                        </div>
                        <span className="text-[11px] font-mono-tabular text-zinc-400 line-through shrink-0">
                          {item.originalPrice} {siteConfig.currencySymbol}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-bold text-zinc-900 dark:text-white">
                    {bundle ? '1. تفاصيل سعر البكج الموحد' : '1. اختر الفئة أو الباقة'}
                  </label>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {product.region}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {product.packages.map((pkg) => {
                    const active = selectedPkg?.id === pkg.id;
                    return (
                      <button
                        key={pkg.id}
                        type="button"
                        onClick={() => setSelectedPkg(pkg)}
                        className={`text-right p-3 rounded-xl border transition-all cursor-pointer ${
                          active
                            ? 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500'
                            : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 hover:border-zinc-300 dark:hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                            {pkg.name}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                          {pkg.amount}
                        </p>
                        <div className="mt-2 flex items-baseline gap-1.5">
                          <span className="text-sm font-extrabold font-mono-tabular text-emerald-600 dark:text-emerald-400">
                            {pkg.price} {siteConfig.currencySymbol}
                          </span>
                          {pkg.originalPrice && (
                            <span className="text-[11px] font-mono-tabular line-through text-zinc-400">
                              {pkg.originalPrice}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quantity & Coupon/Voucher */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    الكمية
                  </label>
                  <div className="h-11 px-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="w-8 h-8 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 flex items-center justify-center cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-mono-tabular font-bold text-sm text-zinc-900 dark:text-white">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                      className="w-8 h-8 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 flex items-center justify-center cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    كود خصم أو قسيمة (اختياري)
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag className="w-3.5 h-3.5 text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                        placeholder="ZONE10"
                        className="w-full h-11 pr-9 pl-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 text-xs font-mono-tabular text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleApplyCoupon}
                      className="h-11 px-3.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-xs font-bold text-zinc-800 dark:text-zinc-100 shrink-0 cursor-pointer"
                    >
                      تطبيق
                    </button>
                  </div>
                  {validSavedVouchers.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {validSavedVouchers.map((sv) => (
                        <button
                          key={sv.id}
                          type="button"
                          onClick={() => handleSelectSavedVoucher(sv)}
                          className="px-2 py-0.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 cursor-pointer"
                        >
                          <Ticket className="w-2.5 h-2.5" />
                          <span>{sv.code}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {couponFeedback && (
                    <p
                      className={`text-[11px] mt-1 ${
                        appliedCoupon || appliedSavedVoucher ? 'text-emerald-500' : 'text-rose-500'
                      }`}
                    >
                      {couponFeedback}
                    </p>
                  )}
                </div>
              </div>

              {/* Delivery-Type Specific Inputs */}
              {requiresDirectId && (
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    {product.playerIdLabel || 'معرّف اللاعب (Player ID)'}
                  </label>
                  <input
                    type="text"
                    required
                    value={playerId}
                    onChange={(e) => setPlayerId(e.target.value)}
                    placeholder="أدخل معرّف الحساب بدقة للشحن المباشر"
                    className="w-full h-11 px-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 text-sm font-mono-tabular text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              {requiresSubLogin && (
                <div className="rounded-2xl border border-sky-500/30 bg-sky-500/5 p-4 space-y-3">
                  <div className="flex items-start gap-2 text-xs text-sky-700 dark:text-sky-300">
                    <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                    <p className="font-bold leading-relaxed">
                      معلومات الحساب لتفعيل الاشتراك: يتم استخدام بياناتك فقط للدخول وتفعيل الباقة ثم تسجيل الخروج فوراً من الحساب بأمان تام.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                        البريد أو اسم المستخدم للحساب
                      </label>
                      <div className="relative">
                        <Mail className="w-3.5 h-3.5 text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          required
                          value={accountEmail}
                          onChange={(e) => setAccountEmail(e.target.value)}
                          placeholder="email@example.com"
                          className="w-full h-10 pr-9 pl-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                        كلمة المرور للحساب
                      </label>
                      <div className="relative">
                        <Lock className="w-3.5 h-3.5 text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          required
                          value={accountPassword}
                          onChange={(e) => setAccountPassword(e.target.value)}
                          placeholder="كلمة مرور الحساب"
                          className="w-full h-10 pr-9 pl-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-mono-tabular text-zinc-900 dark:text-white"
                        />
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <input
                        type="text"
                        value={accountNotes}
                        onChange={(e) => setAccountNotes(e.target.value)}
                        placeholder="ملاحظات إضافية (مثال: رمز التحقق أو نوع الربط - اختياري)"
                        className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {product.deliveryType === 'account_delivery' && (
                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3 text-xs text-emerald-700 dark:text-emerald-300 font-semibold">
                  هذا المنتج يُسلّم كحساب جاهز — ستظهر بيانات الحساب (البريد وكلمة المرور) تلقائياً في صفحة «طلباتي» فور تأكيد الطلب.
                </div>
              )}

              {/* Payment Source: Site Balance OR E-Wallets */}
              <div className="space-y-2.5">
                <label className="block text-sm font-bold text-zinc-900 dark:text-white">
                  2. اختر طريقة الدفع
                </label>

                {user && (
                  <button
                    type="button"
                    onClick={() => setPaymentSource('site_balance')}
                    className={`w-full text-right p-3 rounded-xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                      isSiteBalance
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 hover:border-zinc-300 dark:hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                        <Wallet className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-extrabold text-zinc-900 dark:text-white">
                          الدفع من رصيد الحساب بالموقع
                        </p>
                        <p className="text-[11px] font-mono-tabular text-zinc-500 dark:text-zinc-400">
                          الرصيد المتاح: {userBalance.toFixed(2)} {siteConfig.currencySymbol} · بدون رسوم
                        </p>
                      </div>
                    </div>
                    {userBalance < totalAmount && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          onClose();
                          onGoToProfileWallet();
                        }}
                        className="text-[11px] font-bold text-amber-500 underline cursor-pointer shrink-0"
                      >
                        شحن الرصيد
                      </span>
                    )}
                  </button>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {activeWallets.map((wallet) => {
                    const active = paymentSource === wallet.id;
                    return (
                      <button
                        key={wallet.id}
                        type="button"
                        onClick={() => setPaymentSource(wallet.id)}
                        className={`text-right p-3 rounded-xl border transition-all flex items-center gap-3 cursor-pointer ${
                          active
                            ? 'border-emerald-500 bg-emerald-500/10'
                            : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 hover:border-zinc-300 dark:hover:border-zinc-700'
                        }`}
                      >
                        <div
                          className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center text-white"
                          style={{ backgroundColor: wallet.accentColor || '#10B981' }}
                        >
                          <Wallet className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                            {wallet.name}
                          </p>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                            {wallet.feePercent > 0 ? `رسوم ${wallet.feePercent}%` : 'بدون رسوم إضافية'}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Verified Product Buyer Reviews */}
              {productReviews.length > 0 && (
                <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-zinc-900 dark:text-white">
                      آراء وتقييمات المشترين ({productReviews.length})
                    </span>
                    {averageRating && (
                      <span className="font-mono-tabular font-bold text-amber-500">
                        ★ {averageRating} / 5
                      </span>
                    )}
                  </div>
                  <div className="space-y-2 max-h-36 overflow-y-auto pl-1">
                    {productReviews.slice(0, 5).map((rev) => (
                      <div
                        key={rev.id}
                        className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-3 space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="font-bold text-zinc-800 dark:text-zinc-200">
                            {rev.customerName}
                          </span>
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`w-3 h-3 ${
                                  i < rev.rating
                                    ? 'fill-amber-400 text-amber-400'
                                    : 'text-zinc-300 dark:text-zinc-700'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                        <p className="text-xs text-zinc-600 dark:text-zinc-300">{rev.comment}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Left Side (RTL end): Auto Order Number, Wallet Details & Actions */}
            <div className="lg:col-span-5 p-6 bg-zinc-50/70 dark:bg-[#0D1016] flex flex-col justify-between gap-5">
              <div className="space-y-4">
                {/* Auto-Generated Order & Reference Number */}
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
                      رقم الأوردر التلقائي (المرجع)
                    </p>
                    <p className="text-base font-black font-mono-tabular text-emerald-600 dark:text-emerald-400">
                      {draftOrderNumber}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(draftOrderNumber, 'ordnum')}
                    className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === 'ordnum' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedKey === 'ordnum' ? 'نُسخ' : 'نسخ'}</span>
                  </button>
                </div>

                {!isSiteBalance && selectedWallet && (
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                        بيانات التحويل إلى {selectedWallet.name}
                      </span>
                      <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    </div>

                    <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                      <span className="font-mono-tabular font-bold text-sm text-zinc-900 dark:text-white select-all truncate">
                        {selectedWallet.walletNumber}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(selectedWallet.walletNumber, 'wallet')}
                        className="px-2.5 py-1 rounded-md bg-zinc-200 dark:bg-zinc-800 text-[11px] font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        {copiedKey === 'wallet' ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>{copiedKey === 'wallet' ? 'نُسخ' : 'نسخ'}</span>
                      </button>
                    </div>

                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      باسم: <strong className="text-zinc-800 dark:text-zinc-200">{selectedWallet.accountHolder}</strong>
                      <br />
                      {selectedWallet.instructions}
                    </p>

                    <div>
                      <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                        رقم محفظتك المرسل منها
                      </label>
                      <input
                        type="text"
                        required
                        value={walletSenderPhone}
                        onChange={(e) => setWalletSenderPhone(e.target.value)}
                        placeholder="مثال: 01012345678"
                        className="w-full h-11 px-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-sm font-mono-tabular text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                )}

                {isSiteBalance && (
                  <div className="rounded-xl border border-emerald-500/30 bg-white dark:bg-[#11151B] p-4 space-y-1.5 text-xs">
                    <p className="font-extrabold text-zinc-900 dark:text-white">
                      السداد المباشر من رصيد الحساب
                    </p>
                    <p className="text-zinc-500 dark:text-zinc-400">
                      سيتم خصم المبلغ تلقائياً من رصيدك في المتجر وتنفيذ طلبك برقم الأوردر{' '}
                      <span className="font-mono-tabular font-bold text-emerald-500">
                        {draftOrderNumber}
                      </span>
                      .
                    </p>
                  </div>
                )}

                {errorMsg && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                    <span>المجموع الفرعي ({quantity}×)</span>
                    <span className="font-mono-tabular font-semibold">
                      {rawSubtotal.toFixed(2)} {siteConfig.currencySymbol}
                    </span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                      <span>
                        خصم ({appliedSavedVoucher?.code || appliedCoupon?.code})
                      </span>
                      <span className="font-mono-tabular font-bold">
                        -{discountAmount.toFixed(2)} {siteConfig.currencySymbol}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                    <span>رسوم الدفع</span>
                    <span className="font-mono-tabular font-semibold">
                      {feeAmount.toFixed(2)} {siteConfig.currencySymbol}
                    </span>
                  </div>
                  <div className="flex justify-between text-base font-extrabold text-zinc-900 dark:text-white pt-1.5 border-t border-zinc-200 dark:border-zinc-800">
                    <span>الإجمالي المطلوب</span>
                    <span
                      className="font-mono-tabular"
                      style={{ color: siteConfig.primaryAccentColor || '#10B981' }}
                    >
                      {totalAmount.toFixed(2)} {siteConfig.currencySymbol}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  {!user ? (
                    <button
                      type="button"
                      onClick={onRequireAuth}
                      className="w-full h-12 rounded-xl font-bold text-sm text-white transition-opacity hover:opacity-90 cursor-pointer"
                      style={{ backgroundColor: siteConfig.primaryAccentColor || '#10B981' }}
                    >
                      سجّل الدخول لإتمام الدفع والشحن
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full h-12 rounded-xl font-bold text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-60 cursor-pointer"
                      style={{ backgroundColor: siteConfig.primaryAccentColor || '#10B981' }}
                    >
                      {submitting
                        ? 'جاري تسجيل الطلب...'
                        : isSiteBalance
                        ? 'دفع فوري من رصيدي وإتمام الطلب'
                        : 'تأكيد إرسال التحويل وإتمام الطلب'}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleAddItemToCart}
                    className="w-full h-11 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-[#11151B] hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-bold text-zinc-800 dark:text-zinc-100 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    <span>أضف إلى سلة المشتريات</span>
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
