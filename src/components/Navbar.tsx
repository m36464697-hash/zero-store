import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bell,
  Clock,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Moon,
  Package,
  ShoppingCart,
  Sun,
  Ticket,
  User as UserIcon,
  Wallet,
  X,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { ZoneLogo } from './ZoneLogo';
import { PWAInstallButton } from './PWAInstallButton';
import { formatRemainingTime } from '../utils/deliveryHelpers';

export type ActivePage = string;

interface NavbarProps {
  activePage: ActivePage;
  onNavigate: (page: ActivePage) => void;
  onOpenAuth: () => void;
  onRedeemVoucherFromNotif: (code: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activePage,
  onNavigate,
  onOpenAuth,
  onRedeemVoucherFromNotif,
}) => {
  const {
    theme,
    toggleTheme,
    user,
    userProfile,
    isAdmin,
    siteConfig,
    categories,
    cart,
    setCartOpen,
    activeNotifications,
    readNotifIds,
    unreadNotificationsCount,
    markNotificationRead,
    markAllNotificationsRead,
    logout,
    nowMs,
  } = useStore();

  const [promoDismissed, setPromoDismissed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [featureIdx, setFeatureIdx] = useState(0);
  const notifRef = useRef<HTMLDivElement>(null);

  const featuresList =
    siteConfig.marqueeFeatures && siteConfig.marqueeFeatures.length > 0
      ? siteConfig.marqueeFeatures
      : [siteConfig.promoBannerText];

  useEffect(() => {
    if (featuresList.length <= 1) return;
    const timer = setInterval(() => {
      setFeatureIdx((prev) => (prev + 1) % featuresList.length);
    }, 3800);
    return () => clearInterval(timer);
  }, [featuresList.length]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const activeCategories = categories.filter((c) => c.isActive).slice(0, 3);

  const navItems: Array<{ id: ActivePage; label: string }> = [
    { id: 'home', label: 'الرئيسية' },
    ...activeCategories.map((c) => ({ id: c.id, label: c.name })),
    { id: 'orders', label: 'طلباتي' },
    ...(user ? [{ id: 'profile', label: 'الملف الشخصي' }] : []),
  ];

  const currentFeature = featuresList[featureIdx % featuresList.length];
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="sticky top-0 z-40 w-full">
      {/* Animated Popping Features Top Bar */}
      {siteConfig.promoBannerActive && !promoDismissed && currentFeature && (
        <div
          className="h-9 px-9 flex items-center justify-center relative text-xs font-bold text-white overflow-hidden"
          style={{ backgroundColor: siteConfig.primaryAccentColor || '#10B981' }}
        >
          <AnimatePresence mode="wait">
            <motion.span
              key={`${featureIdx}-${currentFeature}`}
              initial={{ opacity: 0, y: 12, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.94 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="truncate max-w-4xl text-center block"
            >
              {currentFeature}
            </motion.span>
          </AnimatePresence>

          <button
            type="button"
            onClick={() => setPromoDismissed(true)}
            aria-label="إغلاق الشريط العلوي"
            className="absolute left-3 p-1 rounded hover:bg-black/15 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <header className="h-[74px] bg-white dark:bg-[#0D1016] border-b border-zinc-200 dark:border-zinc-800/80">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4">
          {/* Zone 1: Custom Blended Logo */}
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="cursor-pointer focus-visible:outline-none shrink-0 flex items-center"
          >
            <ZoneLogo
              brandName={siteConfig.brandName}
              logoUrl={siteConfig.logoUrl}
              accentColor={siteConfig.primaryAccentColor}
              size="header"
            />
          </button>

          {/* Zone 2: Dynamic Single-Line Nav Links */}
          <nav className="hidden lg:flex items-center gap-5 text-sm font-bold overflow-x-auto">
            {navItems.map((item) => {
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
                    isActive
                      ? 'text-zinc-900 dark:text-white border-emerald-500'
                      : 'text-zinc-600 dark:text-zinc-400 border-transparent hover:text-zinc-900 dark:hover:text-zinc-100'
                  }`}
                  style={isActive ? { borderColor: siteConfig.primaryAccentColor } : undefined}
                >
                  {item.label}
                </button>
              );
            })}
            {isAdmin && (
              <button
                type="button"
                onClick={() => onNavigate('admin')}
                className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activePage === 'admin'
                    ? 'text-zinc-900 dark:text-white border-emerald-500'
                    : 'text-zinc-600 dark:text-zinc-400 border-transparent hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
                style={
                  activePage === 'admin' ? { borderColor: siteConfig.primaryAccentColor } : undefined
                }
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>لوحة الإدارة</span>
              </button>
            )}
          </nav>

          {/* Zone 3: PWA Install, Notifications, Cart, Theme, Balance/Profile & Auth */}
          <div className="flex items-center gap-2 shrink-0">
            <PWAInstallButton variant="compact" />

            {/* Top Notifications Bell */}
            <div ref={notifRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotifOpen((prev) => !prev);
                  if (!notifOpen) markAllNotificationsRead();
                }}
                aria-label="الإشعارات"
                title="الإشعارات والتحديثات والقسائم"
                className="relative w-10 h-10 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900/70 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 flex items-center justify-center transition-colors cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-extrabold font-mono-tabular flex items-center justify-center">
                    {unreadNotificationsCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute left-0 mt-2 w-80 sm:w-96 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] shadow-2xl overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-extrabold text-zinc-900 dark:text-white">
                        الإشعارات والتحديثات ({activeNotifications.length})
                      </h3>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                        تتبع الطلبات، الأخبار، والقسائم المؤقتة
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNotifOpen(false)}
                      className="p-1 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="max-h-96 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/80">
                    {activeNotifications.length === 0 ? (
                      <div className="p-8 text-center text-xs text-zinc-500">
                        لا توجد إشعارات أو قسائم نشطة حالياً.
                      </div>
                    ) : (
                      activeNotifications.map((n) => {
                        const unread = !readNotifIds.includes(n.id);
                        return (
                          <div
                            key={n.id}
                            onClick={() => markNotificationRead(n.id)}
                            className={`p-3.5 space-y-2 transition-colors ${
                              unread ? 'bg-emerald-500/5' : ''
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                {n.notifType === 'voucher' ? (
                                  <Ticket className="w-4 h-4 text-amber-500 shrink-0" />
                                ) : n.notifType === 'order_tracking' ? (
                                  <Package className="w-4 h-4 text-emerald-500 shrink-0" />
                                ) : (
                                  <Megaphone className="w-4 h-4 text-sky-500 shrink-0" />
                                )}
                                <p className="text-xs font-extrabold text-zinc-900 dark:text-white truncate">
                                  {n.title}
                                </p>
                              </div>
                              <span className="text-[10px] text-zinc-400 flex items-center gap-0.5 shrink-0">
                                <Clock className="w-3 h-3" />
                                <span>{formatRemainingTime(n.expiresAt, nowMs)}</span>
                              </span>
                            </div>

                            <p className="text-[11px] text-zinc-600 dark:text-zinc-300 leading-relaxed">
                              {n.message}
                            </p>

                            {n.voucherCode && (
                              <div className="flex items-center justify-between gap-2 pt-1">
                                <code className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[11px] font-mono-tabular font-extrabold text-amber-500">
                                  {n.voucherCode}
                                </code>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setNotifOpen(false);
                                    onRedeemVoucherFromNotif(n.voucherCode);
                                  }}
                                  className="h-7 px-3 rounded-lg text-[11px] font-bold text-white cursor-pointer"
                                  style={{ backgroundColor: siteConfig.primaryAccentColor || '#10B981' }}
                                >
                                  استرداد القسيمة
                                </button>
                              </div>
                            )}

                            {!n.voucherCode && n.orderNumber && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setNotifOpen(false);
                                  onNavigate('orders');
                                }}
                                className="text-[11px] font-bold text-emerald-500 hover:underline cursor-pointer"
                              >
                                عرض الطلب {n.orderNumber} &larr;
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Shopping Cart Button */}
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              aria-label="سلة المشتريات"
              title="سلة المشتريات"
              className="relative w-10 h-10 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900/70 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 flex items-center justify-center transition-colors cursor-pointer"
            >
              <ShoppingCart className="w-4 h-4" />
              {cartCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-white text-[10px] font-extrabold font-mono-tabular flex items-center justify-center"
                  style={{ backgroundColor: siteConfig.primaryAccentColor || '#10B981' }}
                >
                  {cartCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الداكن'}
              title={theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}
              className="w-10 h-10 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900/70 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 flex items-center justify-center transition-colors cursor-pointer"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {user ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onNavigate('profile')}
                  className="hidden sm:flex items-center gap-2 h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-bold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <UserIcon className="w-3.5 h-3.5" />
                  <span className="max-w-[90px] truncate">
                    {userProfile?.displayName || user.displayName || user.email?.split('@')[0]}
                  </span>
                  <span className="text-[11px] font-mono-tabular text-emerald-600 dark:text-emerald-400 border-r border-zinc-200 dark:border-zinc-700 pr-2 flex items-center gap-1">
                    <Wallet className="w-3 h-3" />
                    {(userProfile?.walletBalance ?? 0).toFixed(0)} {siteConfig.currencySymbol}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={logout}
                  title="تسجيل الخروج"
                  aria-label="تسجيل الخروج"
                  className="w-10 h-10 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-rose-500 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenAuth}
                className="h-10 px-4 rounded-xl text-xs sm:text-sm font-bold text-white transition-opacity hover:opacity-90 whitespace-nowrap shrink-0 cursor-pointer"
                style={{ backgroundColor: siteConfig.primaryAccentColor || '#10B981' }}
              >
                تسجيل الدخول
              </button>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label="القائمة"
              className="lg:hidden w-10 h-10 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-200 cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0D1016] px-4 py-3 space-y-1.5 shadow-lg">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onNavigate(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full text-right px-3 py-2.5 rounded-xl text-sm font-bold flex items-center justify-between cursor-pointer ${
                  activePage === item.id
                    ? 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-900 dark:text-white'
                    : 'text-zinc-600 dark:text-zinc-400'
                }`}
              >
                <span>{item.label}</span>
                {item.id === 'orders' && <Package className="w-4 h-4" />}
                {item.id === 'profile' && (
                  <span className="text-xs font-mono-tabular text-emerald-500">
                    {(userProfile?.walletBalance ?? 0).toFixed(0)} {siteConfig.currencySymbol}
                  </span>
                )}
              </button>
            ))}
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  onNavigate('admin');
                  setMobileMenuOpen(false);
                }}
                className="w-full text-right px-3 py-2.5 rounded-xl text-sm font-bold flex items-center justify-between text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 cursor-pointer"
              >
                <span>لوحة الإدارة والتحكم</span>
                <LayoutDashboard className="w-4 h-4" />
              </button>
            )}
            <div className="pt-1">
              <PWAInstallButton variant="full" />
            </div>
          </div>
        )}
      </header>
    </div>
  );
};
