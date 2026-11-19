import React, { useEffect, useMemo, useState } from 'react';
import { sendPasswordResetEmail, updateProfile } from 'firebase/auth';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  KeyRound,
  LogOut,
  Moon,
  Package,
  Plus,
  Save,
  Settings,
  ShoppingCart,
  Sun,
  Ticket,
  User as UserIcon,
  Wallet,
} from 'lucide-react';
import { auth } from '../firebase';
import { useStore } from '../context/StoreContext';
import { PWAInstallButton } from './PWAInstallButton';
import { formatOrderDate } from '../utils/invoiceGenerator';
import {
  formatRemainingTime,
  generateAutoTopupRef,
  toMillisSafe,
} from '../utils/deliveryHelpers';

export type ProfileTab = 'info' | 'wallet' | 'vouchers';

interface ProfileViewProps {
  initialTab?: ProfileTab;
  prefilledVoucherCode?: string;
  onClearPrefilledVoucher?: () => void;
  onOpenAuth: () => void;
  onNavigateOrders: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  initialTab = 'info',
  prefilledVoucherCode = '',
  onClearPrefilledVoucher,
  onOpenAuth,
  onNavigateOrders,
}) => {
  const {
    theme,
    toggleTheme,
    user,
    userProfile,
    siteConfig,
    paymentMethods,
    userTopups,
    savedVouchers,
    userOrders,
    cart,
    setCartOpen,
    updateUserProfile,
    requestWalletTopup,
    redeemVoucherCode,
    logout,
    nowMs,
  } = useStore();

  const [tab, setTab] = useState<ProfileTab>(initialTab);

  // Personal Settings
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');
  const [resetSentMsg, setResetSentMsg] = useState('');

  // Wallet Topup
  const activeWallets = useMemo(
    () => paymentMethods.filter((m) => m.isActive),
    [paymentMethods]
  );
  const [topupAmount, setTopupAmount] = useState(100);
  const [topupWalletId, setTopupWalletId] = useState('');
  const [topupSenderPhone, setTopupSenderPhone] = useState('');
  const [autoTopupRef, setAutoTopupRef] = useState(() => generateAutoTopupRef());
  const [copiedWallet, setCopiedWallet] = useState(false);
  const [submittingTopup, setSubmittingTopup] = useState(false);
  const [topupMsg, setTopupMsg] = useState('');
  const [topupErr, setTopupErr] = useState('');

  // Vouchers
  const [voucherCodeInput, setVoucherCodeInput] = useState('');
  const [redeemingVoucher, setRedeemingVoucher] = useState(false);
  const [voucherMsg, setVoucherMsg] = useState('');
  const [voucherErr, setVoucherErr] = useState('');
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (prefilledVoucherCode) {
      setTab('vouchers');
      setVoucherCodeInput(prefilledVoucherCode);
      onClearPrefilledVoucher?.();
    }
  }, [prefilledVoucherCode]);

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName || '');
      setPhone(userProfile.phone || '');
      setTopupSenderPhone((prev) => prev || userProfile.phone || '');
    }
  }, [userProfile]);

  useEffect(() => {
    if (activeWallets.length > 0 && !activeWallets.some((w) => w.id === topupWalletId)) {
      setTopupWalletId(activeWallets[0].id);
    }
  }, [activeWallets, topupWalletId]);

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-5">
        <div className="w-14 h-14 mx-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] flex items-center justify-center text-zinc-700 dark:text-zinc-200">
          <UserIcon className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-white">
          الملف الشخصي والرصيد والقسائم
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-md mx-auto">
          سجّل الدخول لإدارة حسابك الشخصي، شحن رصيدك في المتجر، واسترداد قسائم الهدايا والخصومات.
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

  const selectedTopupWallet =
    activeWallets.find((w) => w.id === topupWalletId) || activeWallets[0];

  const activeSavedVouchers = savedVouchers.filter(
    (sv) => toMillisSafe(sv.expiresAt) > nowMs
  );

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg('');
    setProfileErr('');
    setSavingProfile(true);
    try {
      await updateUserProfile({ displayName, phone });
      if (auth.currentUser && displayName.trim()) {
        await updateProfile(auth.currentUser, { displayName: displayName.trim() });
      }
      setProfileMsg('تم حفظ بيانات ملفك الشخصي بنجاح.');
    } catch (err) {
      setProfileErr(err instanceof Error ? err.message : 'تعذر حفظ التعديلات.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordReset = async () => {
    setResetSentMsg('');
    if (!user.email) return;
    try {
      await sendPasswordResetEmail(auth, user.email);
      setResetSentMsg(`تم إرسال رابط تغيير كلمة المرور إلى بريدك ${user.email}`);
    } catch {
      setResetSentMsg('تعذر إرسال رابط كلمة المرور حالياً. حاول لاحقاً.');
    }
  };

  const handleSubmitTopup = async (e: React.FormEvent) => {
    e.preventDefault();
    setTopupMsg('');
    setTopupErr('');
    if (!selectedTopupWallet) {
      setTopupErr('لا توجد محفظة دفع متاحة حالياً.');
      return;
    }
    setSubmittingTopup(true);
    try {
      const req = await requestWalletTopup({
        amount: topupAmount,
        paymentMethod: selectedTopupWallet,
        walletSenderPhone: topupSenderPhone,
        referenceCode: autoTopupRef,
      });
      setTopupMsg(
        `تم تسجيل طلب شحن الرصيد رقم ${req.referenceCode} بمبلغ ${req.amount} ${req.currencySymbol}. سيتم إضافة الرصيد لحسابك فور مراجعة الإدارة.`
      );
      setAutoTopupRef(generateAutoTopupRef());
    } catch (err) {
      setTopupErr(err instanceof Error ? err.message : 'تعذر إرسال طلب شحن الرصيد.');
    } finally {
      setSubmittingTopup(false);
    }
  };

  const handleRedeemVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    setVoucherMsg('');
    setVoucherErr('');
    setRedeemingVoucher(true);
    try {
      const res = await redeemVoucherCode(voucherCodeInput);
      setVoucherMsg(res.message);
      setVoucherCodeInput('');
    } catch (err) {
      setVoucherErr(err instanceof Error ? err.message : 'تعذر استرداد القسيمة.');
    } finally {
      setRedeemingVoucher(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Header Summary Card */}
      <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4 min-w-0">
          <div
            className="w-16 h-16 rounded-2xl shrink-0 flex items-center justify-center text-white text-2xl font-black"
            style={{ backgroundColor: siteConfig.primaryAccentColor || '#10B981' }}
          >
            {(userProfile?.displayName || user.email || 'Z').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 space-y-1">
            <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white truncate">
              {userProfile?.displayName || user.displayName || 'عضو Zero Store'}
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
              {user.email} {userProfile?.phone ? `· ${userProfile.phone}` : ''}
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
              <span className="text-zinc-500 dark:text-zinc-400">
                الطلبات: <strong className="text-zinc-900 dark:text-white font-mono-tabular">{userOrders.length}</strong>
              </span>
              <span className="text-zinc-500 dark:text-zinc-400">
                القسائم المحفوظة:{' '}
                <strong className="text-zinc-900 dark:text-white font-mono-tabular">
                  {activeSavedVouchers.length}
                </strong>
              </span>
            </div>
          </div>
        </div>

        {/* Live Balance Box */}
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 sm:px-6 flex items-center justify-between gap-6 shrink-0">
          <div>
            <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
              رصيدي في الموقع
            </p>
            <p className="text-2xl sm:text-3xl font-black font-mono-tabular text-zinc-900 dark:text-white mt-0.5">
              {(userProfile?.walletBalance ?? 0).toFixed(2)}{' '}
              <span className="text-sm font-bold">{siteConfig.currencySymbol}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setTab('wallet')}
            className="h-10 px-4 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer"
            style={{ backgroundColor: siteConfig.primaryAccentColor || '#10B981' }}
          >
            <Plus className="w-4 h-4" />
            <span>شحن الرصيد</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="grid grid-cols-3 p-1.5 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
        {[
          { id: 'info' as ProfileTab, label: 'المعلومات والإعدادات', icon: Settings },
          { id: 'wallet' as ProfileTab, label: 'رصيدي وشحن الرصيد', icon: Wallet },
          { id: 'vouchers' as ProfileTab, label: 'القسائم واسترداد قسيمة', icon: Ticket },
        ].map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`h-11 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                active
                  ? 'bg-white dark:bg-[#181E27] text-zinc-900 dark:text-white shadow-sm'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: PERSONAL INFO & ALL PROFILE SETTINGS */}
      {tab === 'info' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleSaveProfile}
            className="lg:col-span-7 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] p-6 space-y-4"
          >
            <h2 className="text-base font-extrabold text-zinc-900 dark:text-white">
              تعديل البيانات الشخصية
            </h2>

            <div>
              <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1.5">
                الاسم المعروض في الحساب والفواتير
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1.5">
                رقم المحفظة / الهاتف الافتراضي للتحويلات
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="010xxxxxxxx"
                className="w-full h-11 px-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-sm font-mono-tabular text-zinc-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1.5">
                البريد الإلكتروني المسجل
              </label>
              <input
                type="email"
                disabled
                value={user.email || ''}
                className="w-full h-11 px-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900/50 text-xs text-zinc-500"
              />
            </div>

            {profileMsg && (
              <p className="text-xs font-bold text-emerald-500 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>{profileMsg}</span>
              </p>
            )}
            {profileErr && <p className="text-xs font-bold text-rose-500">{profileErr}</p>}

            <button
              type="submit"
              disabled={savingProfile}
              className="h-11 px-6 rounded-xl text-xs font-bold text-white flex items-center gap-2 cursor-pointer"
              style={{ backgroundColor: siteConfig.primaryAccentColor || '#10B981' }}
            >
              <Save className="w-4 h-4" />
              <span>{savingProfile ? 'جاري الحفظ...' : 'حفظ التعديلات'}</span>
            </button>
          </form>

          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] p-6 space-y-4">
              <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white">
                إعدادات الحساب والأمان
              </h3>

              <button
                type="button"
                onClick={toggleTheme}
                className="w-full h-11 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex items-center justify-between text-xs font-bold text-zinc-800 dark:text-zinc-200 cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  <span>مظهر الموقع</span>
                </span>
                <span className="text-emerald-500">
                  {theme === 'dark' ? 'الوضع الداكن' : 'الوضع الفاتح'}
                </span>
              </button>

              <button
                type="button"
                onClick={handlePasswordReset}
                className="w-full h-11 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex items-center justify-between text-xs font-bold text-zinc-800 dark:text-zinc-200 cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4" />
                  <span>تغيير أو استعادة كلمة المرور</span>
                </span>
                <span className="text-zinc-400">إرسال رابط</span>
              </button>
              {resetSentMsg && (
                <p className="text-[11px] font-semibold text-emerald-500">{resetSentMsg}</p>
              )}

              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={onNavigateOrders}
                  className="h-10 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Package className="w-4 h-4" />
                  <span>طلباتي ({userOrders.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCartOpen(true)}
                  className="h-10 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>السلة ({cart.length})</span>
                </button>
              </div>

              <button
                type="button"
                onClick={logout}
                className="w-full h-11 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>تسجيل الخروج من الحساب</span>
              </button>
            </div>

            <PWAInstallButton variant="card" />
          </div>
        </div>
      )}

      {/* TAB 2: SITE WALLET BALANCE & TOP-UP */}
      {tab === 'wallet' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleSubmitTopup}
            className="lg:col-span-7 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] p-6 space-y-4"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-extrabold text-zinc-900 dark:text-white">
                طلب شحن رصيد لحسابك بالموقع
              </h2>
              <span className="text-xs font-mono-tabular font-extrabold text-emerald-500">
                رقم المرجع: {autoTopupRef}
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-2">
                اختر مبلغ الشحن ({siteConfig.currencySymbol})
              </label>
              <div className="grid grid-cols-5 gap-2 mb-2.5">
                {[50, 100, 250, 500, 1000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setTopupAmount(amt)}
                    className={`h-10 rounded-xl border text-xs font-mono-tabular font-bold cursor-pointer ${
                      topupAmount === amt
                        ? 'border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    {amt}
                  </button>
                ))}
              </div>
              <input
                type="number"
                required
                min={5}
                value={topupAmount}
                onChange={(e) => setTopupAmount(Number(e.target.value))}
                className="w-full h-11 px-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-sm font-mono-tabular text-zinc-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-2">
                اختر المحفظة التي ستحول إليها
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {activeWallets.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => setTopupWalletId(w.id)}
                    className={`p-3 rounded-xl border text-right flex items-center gap-2.5 cursor-pointer ${
                      selectedTopupWallet?.id === w.id
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900'
                    }`}
                  >
                    <div
                      className="w-8 h-8 rounded-lg text-white flex items-center justify-center shrink-0"
                      style={{ backgroundColor: w.accentColor || '#10B981' }}
                    >
                      <Wallet className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                        {w.name}
                      </p>
                      <p className="text-[11px] font-mono-tabular text-zinc-500 truncate">
                        {w.walletNumber}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {selectedTopupWallet && (
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0B0E14] p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300">
                    حوّل المبلغ ({topupAmount} {siteConfig.currencySymbol}) إلى:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(selectedTopupWallet.walletNumber);
                      setCopiedWallet(true);
                      setTimeout(() => setCopiedWallet(false), 1600);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    {copiedWallet ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedWallet ? 'نُسخ' : 'نسخ الرقم'}</span>
                  </button>
                </div>
                <p className="font-mono-tabular font-extrabold text-sm text-zinc-900 dark:text-white">
                  {selectedTopupWallet.walletNumber} — {selectedTopupWallet.accountHolder}
                </p>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1.5">
                رقم محفظتك التي أرسلت منها التحويل
              </label>
              <input
                type="text"
                required
                value={topupSenderPhone}
                onChange={(e) => setTopupSenderPhone(e.target.value)}
                placeholder="مثال: 01012345678"
                className="w-full h-11 px-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-sm font-mono-tabular text-zinc-900 dark:text-white"
              />
            </div>

            {topupMsg && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
                {topupMsg}
              </div>
            )}
            {topupErr && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-semibold text-rose-500 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{topupErr}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submittingTopup}
              className="w-full h-11 rounded-xl text-xs font-bold text-white cursor-pointer"
              style={{ backgroundColor: siteConfig.primaryAccentColor || '#10B981' }}
            >
              {submittingTopup ? 'جاري إرسال طلب الشحن...' : 'تأكيد إرسال التحويل وشحن الرصيد'}
            </button>
          </form>

          {/* Topup Requests History */}
          <div className="lg:col-span-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] p-6 space-y-4">
            <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white">
              سجل عمليات شحن الرصيد
            </h3>
            {userTopups.length === 0 ? (
              <p className="text-xs text-zinc-500 py-8 text-center">
                لم تقم بإرسال أي طلبات شحن رصيد بعد.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-[420px] overflow-y-auto">
                {userTopups.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-3.5 space-y-1"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono-tabular font-bold text-zinc-900 dark:text-white">
                        {t.referenceCode}
                      </span>
                      <span
                        className={`font-bold ${
                          t.status === 'approved'
                            ? 'text-emerald-500'
                            : t.status === 'rejected'
                            ? 'text-rose-500'
                            : 'text-amber-500'
                        }`}
                      >
                        {t.status === 'approved'
                          ? 'تمت الإضافة لرصيدك'
                          : t.status === 'rejected'
                          ? 'مرفوض'
                          : 'قيد المراجعة'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-zinc-500">
                      <span>{t.paymentMethodName}</span>
                      <span className="font-mono-tabular font-extrabold text-zinc-900 dark:text-white">
                        +{t.amount} {t.currencySymbol}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400">{formatOrderDate(t.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: VOUCHERS REDEMPTION & SAVED DISCOUNT VOUCHERS */}
      {tab === 'vouchers' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleRedeemVoucher}
            className="lg:col-span-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] p-6 space-y-4"
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-10 h-10 rounded-xl text-white flex items-center justify-center shrink-0"
                style={{ backgroundColor: siteConfig.primaryAccentColor || '#10B981' }}
              >
                <Ticket className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-zinc-900 dark:text-white">
                  استرداد قسيمة هدية أو خصم
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  تُضاف قسائم الرصيد إلى رصيدك فوراً، وتُحفظ قسائم الخصم للاستخدام على المنتجات.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1.5">
                كود القسيمة
              </label>
              <input
                type="text"
                required
                value={voucherCodeInput}
                onChange={(e) => setVoucherCodeInput(e.target.value.toUpperCase())}
                placeholder="مثال: GIFT-100 أو VIP50"
                className="w-full h-12 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-sm font-mono-tabular font-bold text-zinc-900 dark:text-white"
              />
            </div>

            {voucherMsg && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-bold text-emerald-600 dark:text-emerald-300">
                {voucherMsg}
              </div>
            )}
            {voucherErr && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-bold text-rose-500">
                {voucherErr}
              </div>
            )}

            <button
              type="submit"
              disabled={redeemingVoucher}
              className="w-full h-11 rounded-xl text-xs font-bold text-white cursor-pointer"
              style={{ backgroundColor: siteConfig.primaryAccentColor || '#10B981' }}
            >
              {redeemingVoucher ? 'جاري التحقق والاسترداد...' : 'استرداد القسيمة الآن'}
            </button>
          </form>

          <div className="lg:col-span-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] p-6 space-y-4">
            <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white">
              قسائم الخصم المحفوظة والصالحة ({activeSavedVouchers.length})
            </h3>

            {activeSavedVouchers.length === 0 ? (
              <p className="text-xs text-zinc-500 py-8 text-center">
                لا توجد قسائم خصم محفوظة في حسابك حالياً. استرد قسيمة أو ترقب الإشعارات بالهدايا!
              </p>
            ) : (
              <div className="space-y-3">
                {activeSavedVouchers.map((sv) => (
                  <div
                    key={sv.id}
                    className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <p className="text-xs font-extrabold text-zinc-900 dark:text-white truncate">
                        {sv.title}
                      </p>
                      <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        خصم{' '}
                        {sv.voucherType === 'discount_percent'
                          ? `${sv.value}%`
                          : `${sv.value} ${siteConfig.currencySymbol}`}{' '}
                        {sv.minOrderAmount > 0 ? `· حد أدنى ${sv.minOrderAmount}` : ''}
                      </p>
                      <p className="text-[10px] text-zinc-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>متبقي: {formatRemainingTime(sv.expiresAt, nowMs)}</span>
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(sv.code);
                        setCopiedCodeId(sv.id);
                        setTimeout(() => setCopiedCodeId(null), 1600);
                      }}
                      className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-mono-tabular font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      {copiedCodeId === sv.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{sv.code}</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
