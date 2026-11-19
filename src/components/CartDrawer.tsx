import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Minus,
  Plus,
  ShoppingCart,
  Tag,
  Ticket,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { Coupon, SavedVoucher } from '../types';
import {
  DELIVERY_TYPE_LABELS,
  generateAutoOrderNumber,
  toMillisSafe,
} from '../utils/deliveryHelpers';

interface CartDrawerProps {
  onRequireAuth: () => void;
  onGoToOrders: () => void;
  onGoToProfileWallet: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  onRequireAuth,
  onGoToOrders,
  onGoToProfileWallet,
}) => {
  const {
    user,
    userProfile,
    cart,
    cartOpen,
    setCartOpen,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    paymentMethods,
    coupons,
    savedVouchers,
    siteConfig,
    catalogSeeded,
    walletsSeeded,
    placeCartOrders,
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

  const [paymentSource, setPaymentSource] = useState<string>('site_balance');
  const [walletSenderPhone, setWalletSenderPhone] = useState('');
  const [batchOrderNumber, setBatchOrderNumber] = useState('');
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [appliedSavedVoucher, setAppliedSavedVoucher] = useState<SavedVoucher | null>(null);
  const [couponMsg, setCouponMsg] = useState('');
  const [copiedWallet, setCopiedWallet] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [completedCount, setCompletedCount] = useState<number | null>(null);

  useEffect(() => {
    if (cartOpen) {
      setBatchOrderNumber(generateAutoOrderNumber());
      setErrorMsg('');
      setCompletedCount(null);
      setWalletSenderPhone(userProfile?.phone || '');
      if ((userProfile?.walletBalance ?? 0) > 0) {
        setPaymentSource('site_balance');
      } else if (activeWallets.length > 0) {
        setPaymentSource(activeWallets[0].id);
      }
    }
  }, [cartOpen, userProfile?.phone]);

  useEffect(() => {
    if (
      paymentSource !== 'site_balance' &&
      activeWallets.length > 0 &&
      !activeWallets.some((w) => w.id === paymentSource)
    ) {
      setPaymentSource(activeWallets[0].id);
    }
  }, [activeWallets, paymentSource]);

  const rawSubtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.pkg.price * item.quantity, 0),
    [cart]
  );

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

  if (!cartOpen) return null;

  const isSiteBalance = paymentSource === 'site_balance';
  const selectedWallet = !isSiteBalance
    ? activeWallets.find((w) => w.id === paymentSource) || activeWallets[0]
    : null;

  const discountedSubtotal = Math.max(0, rawSubtotal - discountAmount);
  const feePercent = isSiteBalance ? 0 : selectedWallet?.feePercent || 0;
  const feeAmount = Number(((discountedSubtotal * feePercent) / 100).toFixed(2));
  const totalAmount = Number((discountedSubtotal + feeAmount).toFixed(2));
  const userBalance = userProfile?.walletBalance ?? 0;

  const handleApplyCode = () => {
    setCouponMsg('');
    const code = couponInput.trim().toUpperCase();
    if (!code) return;

    const sv = validSavedVouchers.find((v) => v.code.toUpperCase() === code);
    if (sv) {
      if (rawSubtotal < sv.minOrderAmount) {
        setCouponMsg(`الحد الأدنى لهذه القسيمة هو ${sv.minOrderAmount} ${siteConfig.currencySymbol}.`);
        return;
      }
      setAppliedSavedVoucher(sv);
      setAppliedCoupon(null);
      setCouponMsg(`تم تطبيق القسيمة (${sv.code}) بنجاح.`);
      return;
    }

    const match = coupons.find((c) => c.isActive && c.code.toUpperCase() === code);
    if (!match) {
      setAppliedCoupon(null);
      setAppliedSavedVoucher(null);
      setCouponMsg('كود الخصم أو القسيمة غير صالح.');
      return;
    }
    if (rawSubtotal < match.minOrderAmount) {
      setCouponMsg(`الحد الأدنى للكوبون هو ${match.minOrderAmount} ${siteConfig.currencySymbol}.`);
      return;
    }
    setAppliedCoupon(match);
    setAppliedSavedVoucher(null);
    setCouponMsg(`تم تفعيل خصم (${match.code}) بنجاح.`);
  };

  const handleSelectSavedVoucher = (sv: SavedVoucher) => {
    if (rawSubtotal < sv.minOrderAmount) {
      setCouponMsg(`الحد الأدنى للقسيمة ${sv.code} هو ${sv.minOrderAmount} ${siteConfig.currencySymbol}.`);
      return;
    }
    setAppliedSavedVoucher(sv);
    setAppliedCoupon(null);
    setCouponInput(sv.code);
    setCouponMsg(`تم تطبيق قسيمة الخصم (${sv.code}).`);
  };

  const handleCheckoutCart = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!user) {
      onRequireAuth();
      return;
    }
    if (!catalogSeeded || !walletsSeeded) {
      setErrorMsg('يرجى تفعيل بيانات المتجر من لوحة الإدارة أولاً.');
      return;
    }
    if (cart.length === 0) return;

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
      const created = await placeCartOrders({
        items: cart,
        paymentMethodId: isSiteBalance ? 'site_balance' : selectedWallet!.id,
        paymentMethodName: isSiteBalance ? 'رصيد الحساب بالموقع' : selectedWallet!.name,
        feePercent,
        walletSenderPhone: isSiteBalance ? 'رصيد الحساب بالموقع' : walletSenderPhone,
        batchOrderNumber: batchOrderNumber || generateAutoOrderNumber(),
        couponCode: appliedSavedVoucher?.code || appliedCoupon?.code || '',
        totalDiscount: discountAmount,
      });
      setCompletedCount(created.length);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'حدث خطأ أثناء إتمام السلة.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg h-full bg-white dark:bg-[#0D1016] border-r border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShoppingCart className="w-5 h-5" style={{ color: siteConfig.primaryAccentColor }} />
            <div>
              <h2 className="text-base font-extrabold text-zinc-900 dark:text-white">
                سلة المشتريات ({cart.reduce((s, c) => s + c.quantity, 0)})
              </h2>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                أكمل طلباتك دفعة واحدة عبر رصيدك أو المحفظة الإلكترونية
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCartOpen(false)}
            aria-label="إغلاق السلة"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {completedCount !== null ? (
            <div className="py-12 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-extrabold text-zinc-900 dark:text-white">
                تم تسجيل {completedCount} طلبات بنجاح!
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto leading-relaxed">
                يمكنك الآن متابعة خطوات تنفيذ كل طلب بشكل منفصل حسب نوعه من صفحة «طلباتي».
              </p>
              <button
                type="button"
                onClick={() => {
                  setCartOpen(false);
                  onGoToOrders();
                }}
                className="h-11 px-6 rounded-xl text-xs font-bold text-white cursor-pointer"
                style={{ backgroundColor: siteConfig.primaryAccentColor || '#10B981' }}
              >
                متابعة الطلبات في صفحة طلباتي
              </button>
            </div>
          ) : cart.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <ShoppingCart className="w-11 h-11 mx-auto text-zinc-400 opacity-60" />
              <p className="text-sm font-bold text-zinc-900 dark:text-white">
                سلة المشتريات فارغة حالياً
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                اختر أي منتج من المتجر واضغط «أضف إلى السلة» لتجميع طلباتك بسهولة.
              </p>
            </div>
          ) : (
            <form id="cart-checkout-form" onSubmit={handleCheckoutCart} className="space-y-5">
              {/* Items list */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-zinc-700 dark:text-zinc-300">المنتجات المضافة</span>
                  <button
                    type="button"
                    onClick={clearCart}
                    className="text-rose-500 font-semibold hover:underline cursor-pointer"
                  >
                    إفراغ السلة
                  </button>
                </div>

                {cart.map((item) => (
                  <div
                    key={item.cartItemId}
                    className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#11151B] p-3.5 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={item.product.imageUrl}
                          alt={item.product.title}
                          referrerPolicy="no-referrer"
                          className="w-12 h-12 rounded-lg object-cover shrink-0 border border-zinc-200 dark:border-zinc-800"
                        />
                        <div className="min-w-0">
                          <h4 className="text-xs font-extrabold text-zinc-900 dark:text-white truncate">
                            {item.product.title}
                          </h4>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                            {item.pkg.name} · {DELIVERY_TYPE_LABELS[item.product.deliveryType]?.short}
                          </p>
                          {item.playerId && (
                            <p className="text-[11px] font-mono-tabular text-emerald-600 dark:text-emerald-400 truncate">
                              ID: {item.playerId}
                            </p>
                          )}
                          {item.accountEmail && (
                            <p className="text-[11px] font-mono-tabular text-sky-600 dark:text-sky-400 truncate">
                              حساب الاشتراك: {item.accountEmail}
                            </p>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeFromCart(item.cartItemId)}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 cursor-pointer shrink-0"
                        aria-label="حذف المنتج"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-zinc-200/70 dark:border-zinc-800">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(item.cartItemId, -1)}
                          className="w-7 h-7 rounded-lg border border-zinc-200 dark:border-zinc-700 flex items-center justify-center cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center text-xs font-bold font-mono-tabular">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(item.cartItemId, 1)}
                          className="w-7 h-7 rounded-lg border border-zinc-200 dark:border-zinc-700 flex items-center justify-center cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="text-xs font-extrabold font-mono-tabular text-zinc-900 dark:text-white">
                        {(item.pkg.price * item.quantity).toFixed(2)} {siteConfig.currencySymbol}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Coupon & Saved Vouchers */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  كود خصم أو قسيمة منتجات
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag className="w-3.5 h-3.5 text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      placeholder="أدخل كود الخصم أو القسيمة"
                      className="w-full h-10 pr-9 pl-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#11151B] text-xs font-mono-tabular text-zinc-900 dark:text-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyCode}
                    className="h-10 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-xs font-bold cursor-pointer"
                  >
                    تطبيق
                  </button>
                </div>
                {validSavedVouchers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {validSavedVouchers.map((sv) => (
                      <button
                        key={sv.id}
                        type="button"
                        onClick={() => handleSelectSavedVoucher(sv)}
                        className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                          appliedSavedVoucher?.id === sv.id
                            ? 'border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300'
                        }`}
                      >
                        <Ticket className="w-3 h-3" />
                        <span>
                          {sv.code} (
                          {sv.voucherType === 'discount_percent'
                            ? `${sv.value}%`
                            : `${sv.value} ${siteConfig.currencySymbol}`}
                          )
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {couponMsg && (
                  <p
                    className={`text-[11px] ${
                      appliedCoupon || appliedSavedVoucher ? 'text-emerald-500' : 'text-rose-500'
                    }`}
                  >
                    {couponMsg}
                  </p>
                )}
              </div>

              {/* Payment Method */}
              <div className="space-y-2.5">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  طريقة السداد
                </label>

                {user && (
                  <button
                    type="button"
                    onClick={() => setPaymentSource('site_balance')}
                    className={`w-full text-right p-3 rounded-xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                      isSiteBalance
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#11151B]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                        <Wallet className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-extrabold text-zinc-900 dark:text-white">
                          رصيد الحساب بالموقع (بدون رسوم)
                        </p>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono-tabular">
                          المتاح: {userBalance.toFixed(2)} {siteConfig.currencySymbol}
                        </p>
                      </div>
                    </div>
                    {userBalance < totalAmount && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          setCartOpen(false);
                          onGoToProfileWallet();
                        }}
                        className="text-[11px] font-bold text-amber-500 underline cursor-pointer"
                      >
                        شحن الرصيد
                      </span>
                    )}
                  </button>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {activeWallets.map((w) => {
                    const active = paymentSource === w.id;
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => setPaymentSource(w.id)}
                        className={`text-right p-2.5 rounded-xl border flex items-center gap-2.5 cursor-pointer ${
                          active
                            ? 'border-emerald-500 bg-emerald-500/10'
                            : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#11151B]'
                        }`}
                      >
                        <div
                          className="w-8 h-8 rounded-lg text-white flex items-center justify-center shrink-0"
                          style={{ backgroundColor: w.accentColor || '#10B981' }}
                        >
                          <Wallet className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                            {w.name}
                          </p>
                          <p className="text-[10px] text-zinc-500">
                            {w.feePercent > 0 ? `رسوم ${w.feePercent}%` : 'بدون رسوم'}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {!isSiteBalance && selectedWallet && (
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#11151B] p-3.5 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-500">رقم الأوردر التلقائي المرجعي:</span>
                      <span className="font-mono-tabular font-extrabold text-emerald-500">
                        {batchOrderNumber}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                      <span className="font-mono-tabular font-bold text-xs text-zinc-900 dark:text-white select-all">
                        {selectedWallet.walletNumber}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(selectedWallet.walletNumber);
                          setCopiedWallet(true);
                          setTimeout(() => setCopiedWallet(false), 1600);
                        }}
                        className="px-2 py-1 rounded bg-zinc-200 dark:bg-zinc-800 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        {copiedWallet ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedWallet ? 'نُسخ' : 'نسخ'}</span>
                      </button>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                        رقم محفظتك المحوّل منها
                      </label>
                      <input
                        type="text"
                        required
                        value={walletSenderPhone}
                        onChange={(e) => setWalletSenderPhone(e.target.value)}
                        placeholder="مثال: 01012345678"
                        className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-mono-tabular text-zinc-900 dark:text-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              {errorMsg && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </form>
          )}
        </div>

        {/* Footer Totals */}
        {cart.length > 0 && completedCount === null && (
          <div className="p-5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#11151B] space-y-3">
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-zinc-500 dark:text-zinc-400">
                <span>المجموع الفرعي</span>
                <span className="font-mono-tabular font-bold">
                  {rawSubtotal.toFixed(2)} {siteConfig.currencySymbol}
                </span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-500 font-bold">
                  <span>الخصم</span>
                  <span className="font-mono-tabular">
                    -{discountAmount.toFixed(2)} {siteConfig.currencySymbol}
                  </span>
                </div>
              )}
              {feeAmount > 0 && (
                <div className="flex justify-between text-zinc-500 dark:text-zinc-400">
                  <span>رسوم المحفظة</span>
                  <span className="font-mono-tabular font-bold">
                    {feeAmount.toFixed(2)} {siteConfig.currencySymbol}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm font-extrabold text-zinc-900 dark:text-white pt-1.5 border-t border-zinc-200 dark:border-zinc-800">
                <span>الإجمالي النهائي</span>
                <span className="font-mono-tabular" style={{ color: siteConfig.primaryAccentColor }}>
                  {totalAmount.toFixed(2)} {siteConfig.currencySymbol}
                </span>
              </div>
            </div>

            {!user ? (
              <button
                type="button"
                onClick={onRequireAuth}
                className="w-full h-11 rounded-xl text-xs font-bold text-white cursor-pointer"
                style={{ backgroundColor: siteConfig.primaryAccentColor || '#10B981' }}
              >
                سجّل الدخول لإتمام طلبات السلة
              </button>
            ) : (
              <button
                type="submit"
                form="cart-checkout-form"
                disabled={submitting}
                className="w-full h-11 rounded-xl text-xs font-bold text-white disabled:opacity-60 cursor-pointer"
                style={{ backgroundColor: siteConfig.primaryAccentColor || '#10B981' }}
              >
                {submitting
                  ? 'جاري تسجيل الطلبات...'
                  : isSiteBalance
                  ? 'سداد فوري من رصيد الحساب'
                  : 'تأكيد إرسال الطلبات الآن'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
