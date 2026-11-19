import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Clock,
  Gamepad2,
  Heart,
  Layers,
  Search,
  ShoppingCart,
  Star,
  Zap,
} from 'lucide-react';
import { FlashDeal, Product, ValueBundle } from '../types';
import { useStore } from '../context/StoreContext';
import { ProductCard } from './ProductCard';
import { ActivePage } from './Navbar';
import { ZoneLogo } from './ZoneLogo';
import { DELIVERY_TYPE_LABELS, toMillisSafe } from '../utils/deliveryHelpers';

interface StorefrontViewProps {
  activePage: ActivePage;
  onNavigate: (page: ActivePage) => void;
  onSelectProduct: (product: Product) => void;
  onSelectFlashDeal: (deal: FlashDeal) => void;
  onSelectBundle: (bundle: ValueBundle) => void;
  onQuickAddBundleToCart: (bundle: ValueBundle) => void;
}

const FlashCountdown: React.FC<{ endsAt: unknown }> = ({ endsAt }) => {
  const [tickMs, setTickMs] = useState(() => Date.now());
  const targetMs = toMillisSafe(endsAt);

  useEffect(() => {
    const id = setInterval(() => setTickMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const diffSec = Math.max(0, Math.floor((targetMs - tickMs) / 1000));
  if (targetMs === 0 || diffSec <= 0) {
    return <span className="font-mono-tabular text-rose-500">انتهى العرض</span>;
  }

  const days = Math.floor(diffSec / 86400);
  const hrs = Math.floor((diffSec % 86400) / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  const secs = diffSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <span className="font-mono-tabular font-extrabold tracking-tight" dir="ltr">
      {days > 0 ? `${days}d ` : ''}
      {pad(hrs)}:{pad(mins)}:{pad(secs)}
    </span>
  );
};

const PromoBannerCard: React.FC<{
  product: Product;
  currencySymbol: string;
  accentColor: string;
  onSelect: (product: Product) => void;
}> = ({ product, currencySymbol, accentColor, onSelect }) => {
  const [imgError, setImgError] = useState(false);
  const minPrice =
    product.packages && product.packages.length > 0
      ? Math.min(...product.packages.map((p) => p.price))
      : 0;

  return (
    <button
      type="button"
      dir="rtl"
      onClick={() => onSelect(product)}
      className="group relative w-36 sm:w-44 aspect-square rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-900 text-right shrink-0 cursor-pointer transition-transform duration-200 hover:-translate-y-0.5 hover:border-emerald-500/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
    >
      {!imgError && product.imageUrl ? (
        <img
          src={product.imageUrl}
          alt={product.title}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.05]"
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center text-white/80"
          style={{
            background: `linear-gradient(135deg, ${product.accentColor || accentColor}44, #0F172A)`,
          }}
        >
          <Gamepad2 className="w-7 h-7" />
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/10" />

      <div className="absolute inset-x-0 bottom-0 p-2.5 sm:p-3 space-y-0.5">
        <span className="block text-[10px] text-zinc-300 truncate">
          {DELIVERY_TYPE_LABELS[product.deliveryType]?.short || 'شحن فوري'}
        </span>
        <h3 className="text-xs sm:text-sm font-extrabold text-white truncate">{product.title}</h3>
        <div className="flex items-center justify-between gap-1 pt-0.5">
          <span
            className="text-[11px] font-extrabold font-mono-tabular truncate"
            style={{ color: accentColor || '#10B981' }}
          >
            {minPrice} {currencySymbol}
          </span>
          <span className="text-[10px] font-bold text-white/90 group-hover:text-emerald-400 transition-colors shrink-0">
            شحن &larr;
          </span>
        </div>
      </div>
    </button>
  );
};

export const StorefrontView: React.FC<StorefrontViewProps> = ({
  activePage,
  onNavigate,
  onSelectProduct,
  onSelectFlashDeal,
  onSelectBundle,
  onQuickAddBundleToCart,
}) => {
  const {
    products,
    categories,
    activeFlashDeals,
    activeBundles,
    siteConfig,
    favorites,
    reviews,
  } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [homeFilter, setHomeFilter] = useState<'all' | 'favorites' | string>('all');

  const activeCategories = useMemo(
    () => categories.filter((c) => c.isActive),
    [categories]
  );

  const activeProducts = useMemo(
    () => products.filter((p) => p.isActive),
    [products]
  );

  const promoProducts = useMemo(() => {
    const featured = activeProducts.filter((p) => p.isFeatured);
    const nonFeatured = activeProducts.filter((p) => !p.isFeatured);
    return featured.length > 0 ? [...featured, ...nonFeatured] : activeProducts;
  }, [activeProducts]);

  const selectedCategoryObj = activeCategories.find((c) => c.id === activePage);
  const isCategoryView = Boolean(selectedCategoryObj);

  const displayedProducts = useMemo(() => {
    return activeProducts.filter((p) => {
      if (isCategoryView && p.category !== activePage) return false;
      if (!isCategoryView) {
        if (homeFilter === 'favorites' && !favorites.includes(p.id)) return false;
        if (homeFilter !== 'all' && homeFilter !== 'favorites' && p.category !== homeFilter) {
          return false;
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        return (
          p.title.toLowerCase().includes(q) ||
          p.subtitle.toLowerCase().includes(q) ||
          p.region.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [activeProducts, activePage, isCategoryView, homeFilter, searchQuery, favorites]);

  const scrollToCatalog = () => {
    const el = document.getElementById('zone-catalog');
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="space-y-12 pb-16">
      {/* Hero Section (Homepage) with Left-to-Right Animated Promotional Product Banners */}
      {!isCategoryView ? (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-8">
          <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#11151B] overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
            {/* Hero Editorial + Search + Primary Action */}
            <div className="lg:col-span-5 p-6 sm:p-10 flex flex-col justify-center gap-6">
              <div className="space-y-4">
                <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                  منصة الشحن المباشر والبطاقات الرقمية الموثوقة
                </p>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-zinc-900 dark:text-white leading-[1.2] text-balance max-w-xl">
                  {siteConfig.heroTitle}
                </h1>
                <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-lg">
                  {siteConfig.heroSubtitle}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-zinc-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث عن لعبة أو بطاقة (PUBG, PSN...)"
                    className="w-full h-12 pr-10 pl-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0B0E14] text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={scrollToCatalog}
                  className="h-12 px-6 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
                  style={{ backgroundColor: siteConfig.primaryAccentColor || '#10B981' }}
                >
                  <span>{siteConfig.heroCtaText}</span>
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Promotional Product Advertising Showcase Moving Left-to-Right */}
            <div className="lg:col-span-7 relative bg-zinc-50 dark:bg-[#0D1016] border-t lg:border-t-0 lg:border-r border-zinc-200 dark:border-zinc-800/80 py-6 flex flex-col justify-center gap-4 overflow-hidden">
              <div className="px-6 flex items-center justify-between gap-2 text-xs">
                <span className="font-bold text-zinc-800 dark:text-zinc-200">
                  عروض المنتجات والإعلانات المميزة
                </span>
                <span className="text-zinc-500 dark:text-zinc-400">
                  اضغط على أي عرض للشحن الفوري
                </span>
              </div>

              {/* Single Left-to-Right Kinetic Promotional Carousel */}
              <div className="relative overflow-hidden py-2">
                <div className="pointer-events-none absolute inset-y-0 left-0 w-10 sm:w-14 z-10 bg-gradient-to-r from-zinc-50 dark:from-[#0D1016] to-transparent" />
                <div className="pointer-events-none absolute inset-y-0 right-0 w-10 sm:w-14 z-10 bg-gradient-to-l from-zinc-50 dark:from-[#0D1016] to-transparent" />

                {promoProducts.length > 0 && (
                  <div dir="ltr" className="promo-marquee-wrapper overflow-hidden">
                    <div className="animate-promo-ltr gap-3.5 px-2">
                      {[...promoProducts, ...promoProducts].map((prod, idx) => (
                        <PromoBannerCard
                          key={`promo-${prod.id}-${idx}`}
                          product={prod}
                          currencySymbol={siteConfig.currencySymbol}
                          accentColor={siteConfig.primaryAccentColor || '#10B981'}
                          onSelect={onSelectProduct}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      ) : (
        /* Title-Only Dynamic Category Header (Zero Category Images) */
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-8">
          <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#11151B] p-6 sm:p-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                <button
                  type="button"
                  onClick={() => onNavigate('home')}
                  className="hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                >
                  الرئيسية
                </button>
                <span aria-hidden="true">/</span>
                <span className="text-zinc-900 dark:text-white font-semibold">
                  {selectedCategoryObj?.name}
                </span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold text-zinc-900 dark:text-white text-balance">
                {selectedCategoryObj?.name}
              </h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {selectedCategoryObj?.description}
              </p>
            </div>

            <div className="relative w-full md:w-80 shrink-0">
              <Search className="w-4 h-4 text-zinc-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث داخل القسم..."
                className="w-full h-11 pr-10 pl-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0B0E14] text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </section>
      )}

      {/* Title-Only Storefront Categories Section (Homepage - Zero Category Images) */}
      {!isCategoryView && activeCategories.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 space-y-5">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-zinc-900 dark:text-white">
              أقسام المتجر الرئيسية
            </h2>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              اختر القسم للوصول المباشر إلى باقات الشحن والبطاقات الرقمية
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {activeCategories.map((cat) => {
              const count = activeProducts.filter((p) => p.category === cat.id).length;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => onNavigate(cat.id)}
                  className="group rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#11151B] hover:border-emerald-500/50 hover:-translate-y-0.5 p-6 text-right transition-all duration-200 flex flex-col justify-between gap-4 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  <div className="space-y-2">
                    <h3 className="text-lg sm:text-xl font-extrabold text-zinc-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      {cat.name}
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed line-clamp-2">
                      {cat.description}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-xs">
                    <span className="font-mono-tabular font-semibold text-zinc-500 dark:text-zinc-400">
                      {count} منتجات متاحة
                    </span>
                    <span
                      className="font-bold flex items-center gap-1"
                      style={{ color: siteConfig.primaryAccentColor || '#10B981' }}
                    >
                      <span>تصفح القسم</span>
                      <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Flash Deals Section (Live 1s Countdown + Limited Stock) */}
      {!isCategoryView && activeFlashDeals.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-zinc-900 dark:text-white">
                  عروض الفلاش المحدودة
                </h2>
                <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
                  خصومات حصرية بوقت وكمية محدودة — تتجدد باستمرار
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeFlashDeals.map((deal) => {
              const discountPct =
                deal.originalPrice > deal.flashPrice
                  ? Math.round(((deal.originalPrice - deal.flashPrice) / deal.originalPrice) * 100)
                  : 0;
              const remaining = Math.max(0, deal.maxStock - deal.claimedCount);
              const stockPct = Math.min(
                100,
                Math.max(8, Math.round((remaining / Math.max(1, deal.maxStock)) * 100))
              );

              return (
                <div
                  key={deal.id}
                  className="rounded-2xl border border-amber-500/30 dark:border-amber-500/25 bg-white dark:bg-[#11151B] p-4 flex flex-col justify-between gap-4 hover:border-amber-500/60 transition-colors"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="w-20 h-20 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shrink-0 bg-zinc-900">
                      <img
                        src={deal.imageUrl}
                        alt={deal.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        {discountPct > 0 && (
                          <span className="px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-500 text-[11px] font-extrabold font-mono-tabular">
                            خصم {discountPct}%
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                          <Clock className="w-3.5 h-3.5" />
                          <FlashCountdown endsAt={deal.endsAt} />
                        </span>
                      </div>
                      <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white line-clamp-1">
                        {deal.title}
                      </h3>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                        {deal.productTitle} · {deal.packageName}
                      </p>
                    </div>
                  </div>

                  {/* Stock bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                      <span>المتبقي من العرض</span>
                      <span className="font-mono-tabular font-bold text-zinc-800 dark:text-zinc-200">
                        {remaining} / {deal.maxStock} متاح
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-900 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-500 transition-all duration-300"
                        style={{ width: `${stockPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between gap-3">
                    <div className="flex items-baseline gap-2">
                      <span
                        className="text-lg font-black font-mono-tabular"
                        style={{ color: siteConfig.primaryAccentColor || '#10B981' }}
                      >
                        {deal.flashPrice} {siteConfig.currencySymbol}
                      </span>
                      <span className="text-xs font-mono-tabular line-through text-zinc-400">
                        {deal.originalPrice} {siteConfig.currencySymbol}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectFlashDeal(deal)}
                      className="h-9 px-4 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 hover:opacity-90 transition-opacity cursor-pointer shrink-0"
                      style={{ backgroundColor: siteConfig.primaryAccentColor || '#10B981' }}
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>اقتنص العرض</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Value Bundles Section (Curated Multi-Item Saving Packs) */}
      {!isCategoryView && activeBundles.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 space-y-5">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 text-white"
              style={{
                backgroundColor: siteConfig.primaryAccentColor || '#10B981',
                borderColor: siteConfig.primaryAccentColor || '#10B981',
              }}
            >
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-zinc-900 dark:text-white">
                بكجات التوفير المجمّعة
              </h2>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
                اجمع باقاتك واشتراكاتك المفضلة في بكج واحد بسعر مخفض وتوصيل موحد
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {activeBundles.map((bundle) => {
              const savings = Math.max(0, bundle.originalTotalPrice - bundle.bundlePrice);
              const savingsPct =
                bundle.originalTotalPrice > 0
                  ? Math.round((savings / bundle.originalTotalPrice) * 100)
                  : 0;

              return (
                <div
                  key={bundle.id}
                  className="rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#11151B] p-5 flex flex-col justify-between gap-4 hover:border-emerald-500/45 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row items-start gap-4">
                    <div className="w-full sm:w-28 h-40 sm:h-28 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shrink-0 bg-zinc-900">
                      <img
                        src={bundle.imageUrl}
                        alt={bundle.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        {bundle.badge && (
                          <span
                            className="px-2.5 py-0.5 rounded-md text-[11px] font-extrabold text-white"
                            style={{ backgroundColor: bundle.accentColor || '#10B981' }}
                          >
                            {bundle.badge}
                          </span>
                        )}
                        {savingsPct > 0 && (
                          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 font-mono-tabular">
                            توفير {savingsPct}%
                          </span>
                        )}
                      </div>
                      <h3 className="text-base sm:text-lg font-extrabold text-zinc-900 dark:text-white">
                        {bundle.title}
                      </h3>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                        {bundle.subtitle}
                      </p>
                    </div>
                  </div>

                  {/* Included Items Checklist */}
                  <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0B0E14] p-3.5 space-y-2">
                    <p className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
                      محتويات البكج المشمولة:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {bundle.items.map((item, idx) => (
                        <div
                          key={`${bundle.id}-${item.productId}-${idx}`}
                          className="flex items-center justify-between gap-2 text-xs bg-white dark:bg-[#11151B] px-2.5 py-2 rounded-lg border border-zinc-200/70 dark:border-zinc-800"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span className="font-bold text-zinc-900 dark:text-white truncate">
                              {item.productTitle} ({item.packageName})
                            </span>
                          </div>
                          <span className="font-mono-tabular text-[11px] text-zinc-400 line-through shrink-0">
                            {item.originalPrice}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-baseline gap-2">
                        <span
                          className="text-xl font-black font-mono-tabular"
                          style={{ color: siteConfig.primaryAccentColor || '#10B981' }}
                        >
                          {bundle.bundlePrice} {siteConfig.currencySymbol}
                        </span>
                        <span className="text-xs font-mono-tabular line-through text-zinc-400">
                          {bundle.originalTotalPrice} {siteConfig.currencySymbol}
                        </span>
                      </div>
                      {savings > 0 && (
                        <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                          توفر {savings} {siteConfig.currencySymbol} مقارنة بالشراء المنفصل
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onQuickAddBundleToCart(bundle)}
                        title="أضف البكج إلى السلة"
                        aria-label="أضف البكج إلى السلة"
                        className="h-10 w-10 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-100 flex items-center justify-center cursor-pointer"
                      >
                        <ShoppingCart className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onSelectBundle(bundle)}
                        className="h-10 px-5 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 hover:opacity-90 transition-opacity cursor-pointer"
                        style={{ backgroundColor: siteConfig.primaryAccentColor || '#10B981' }}
                      >
                        <span>اطلب البكج الآن</span>
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Main Compact Catalog Grid */}
      <section id="zone-catalog" className="max-w-7xl mx-auto px-4 sm:px-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-zinc-900 dark:text-white">
              {isCategoryView
                ? `جميع منتجات ${selectedCategoryObj?.name}`
                : 'الكتالوج والباقات المتاحة'}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
              اختر المنتج لعرض الباقات، التقييمات الموثقة، وإتمام الشحن عبر محفظتك
            </p>
          </div>

          {!isCategoryView && (
            <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setHomeFilter('all')}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  homeFilter === 'all'
                    ? 'bg-white dark:bg-[#181E27] text-zinc-900 dark:text-white shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                الكل
              </button>
              {activeCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setHomeFilter(cat.id)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    homeFilter === cat.id
                      ? 'bg-white dark:bg-[#181E27] text-zinc-900 dark:text-white shadow-sm'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setHomeFilter('favorites')}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  homeFilter === 'favorites'
                    ? 'bg-white dark:bg-[#181E27] text-zinc-900 dark:text-white shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                <Heart className="w-3.5 h-3.5 text-rose-500" />
                <span>المفضلة ({favorites.length})</span>
              </button>
            </div>
          )}
        </div>

        {displayedProducts.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] p-12 text-center space-y-3">
            <p className="text-base font-bold text-zinc-900 dark:text-white">
              لم يتم العثور على منتجات مطابقة
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setHomeFilter('all');
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white cursor-pointer"
              style={{ backgroundColor: siteConfig.primaryAccentColor || '#10B981' }}
            >
              عرض جميع المنتجات
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4">
            {displayedProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onSelect={onSelectProduct}
              />
            ))}
          </div>
        )}
      </section>

      {/* Verified Customer Reviews Section (Only real buyer reviews after completed orders) */}
      {!isCategoryView && reviews.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-zinc-900 dark:text-white">
                تقييمات وآراء المشترين الموثقة
              </h2>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                آراء حقيقية لعملاء أتمّوا طلباتهم بنجاح على متجر {siteConfig.brandName}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reviews.slice(0, 6).map((rev) => (
              <div
                key={rev.id}
                className="rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#11151B] p-4 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-zinc-900 dark:text-white truncate">
                      {rev.customerName}
                    </p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                      {rev.productTitle}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0" aria-label={`تقييم ${rev.rating} من 5`}>
                    {Array.from({ length: 5 }).map((_, idx) => (
                      <Star
                        key={idx}
                        className={`w-3.5 h-3.5 ${
                          idx < rev.rating
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-zinc-300 dark:text-zinc-700'
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed line-clamp-3">
                  «{rev.comment}»
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 border-t border-zinc-200 dark:border-zinc-800/80">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-8">
          <div className="space-y-3">
            <ZoneLogo
              brandName={siteConfig.brandName}
              logoUrl={siteConfig.logoUrl}
              accentColor={siteConfig.primaryAccentColor}
              size="footer"
            />
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-sm">
              {siteConfig.footerAboutText}
            </p>
          </div>

          <div className="space-y-2.5">
            <h4 className="text-xs font-bold text-zinc-900 dark:text-white">
              أقسام المتجر
            </h4>
            <ul className="space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
              {activeCategories.map((cat) => (
                <li key={cat.id}>
                  <button
                    type="button"
                    onClick={() => onNavigate(cat.id)}
                    className="hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                  >
                    {cat.name}
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('orders')}
                  className="hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                >
                  تتبع الطلبات وطلباتي
                </button>
              </li>
            </ul>
          </div>

          <div className="space-y-2.5">
            <h4 className="text-xs font-bold text-zinc-900 dark:text-white">
              الدعم وخدمة العملاء
            </h4>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              البريد الإلكتروني:{' '}
              <span className="font-mono-tabular text-zinc-900 dark:text-zinc-200">
                {siteConfig.supportEmail}
              </span>
            </p>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              واتساب الدعم:{' '}
              <span className="font-mono-tabular text-zinc-900 dark:text-zinc-200" dir="ltr">
                {siteConfig.supportWhatsapp}
              </span>
            </p>
          </div>
        </div>

        <div className="pt-5 border-t border-zinc-200 dark:border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <p>جميع الحقوق محفوظة &copy; {new Date().getFullYear()} {siteConfig.brandName}</p>
          <p>بوابة شحن الألعاب والبطاقات الرقمية</p>
        </div>
      </footer>
    </div>
  );
};
