import React, { useMemo, useState } from 'react';
import { Gamepad2, Heart, Star } from 'lucide-react';
import { Product } from '../types';
import { useStore } from '../context/StoreContext';
import { DELIVERY_TYPE_LABELS } from '../utils/deliveryHelpers';

interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onSelect }) => {
  const { siteConfig, favorites, toggleFavorite, reviews } = useStore();
  const [imgError, setImgError] = useState(false);

  const minPrice =
    product.packages && product.packages.length > 0
      ? Math.min(...product.packages.map((p) => p.price))
      : 0;

  const isFav = favorites.includes(product.id);

  const ratingStats = useMemo(() => {
    const productReviews = reviews.filter((r) => r.productId === product.id);
    if (productReviews.length === 0) return null;
    const total = productReviews.reduce((acc, r) => acc + r.rating, 0);
    return {
      avg: (total / productReviews.length).toFixed(1),
      count: productReviews.length,
    };
  }, [reviews, product.id]);

  return (
    <div className="group relative w-full rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#11151B] overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-lg flex flex-col">
      {/* Favorite Quick Button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggleFavorite(product.id);
        }}
        aria-label={isFav ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}
        className="absolute top-2 left-2 z-10 w-7 h-7 rounded-lg bg-black/55 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/75 transition-colors cursor-pointer"
      >
        <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-rose-500 text-rose-500' : ''}`} />
      </button>

      <button
        type="button"
        onClick={() => onSelect(product)}
        className="text-right w-full flex-1 flex flex-col focus-visible:outline-none cursor-pointer"
      >
        {/* Product Image Slot (Compact 1:1 square aspect ratio) */}
        <div className="relative w-full aspect-square bg-zinc-900 overflow-hidden">
          {!imgError && product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.title}
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div
              className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-white/90"
              style={{
                background: `linear-gradient(135deg, ${product.accentColor || '#10B981'}33, #0F172A)`,
              }}
            >
              <Gamepad2 className="w-7 h-7 opacity-85" />
              <span className="text-[11px] font-bold px-2 truncate max-w-full">{product.title}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <div className="absolute bottom-2 right-2.5 left-2.5 flex items-center justify-between gap-1 text-[11px] text-white/90">
            <span className="font-medium truncate">
              {DELIVERY_TYPE_LABELS[product.deliveryType]?.short || 'شحن فوري'}
            </span>
            {ratingStats && (
              <span className="flex items-center gap-0.5 font-mono-tabular font-bold text-amber-400 shrink-0">
                <Star className="w-3 h-3 fill-amber-400" />
                <span>{ratingStats.avg}</span>
              </span>
            )}
          </div>
        </div>

        {/* Compact Card Body */}
        <div className="p-3 flex-1 w-full flex flex-col justify-between gap-2">
          <div className="space-y-0.5">
            <div className="flex items-center justify-between gap-1 text-[11px] text-zinc-500 dark:text-zinc-400">
              <span className="truncate">{product.region}</span>
              {ratingStats ? (
                <span className="shrink-0">({ratingStats.count} تقييم)</span>
              ) : (
                <span className="shrink-0">{product.packages.length} باقات</span>
              )}
            </div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white leading-snug line-clamp-1">
              {product.title}
            </h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-1">
              {product.subtitle}
            </p>
          </div>

          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between gap-1.5 w-full">
            <span
              className="text-xs sm:text-sm font-extrabold font-mono-tabular truncate"
              style={{ color: siteConfig.primaryAccentColor || '#10B981' }}
            >
              {minPrice} {siteConfig.currencySymbol}
            </span>
            <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 group-hover:text-emerald-500 transition-colors whitespace-nowrap shrink-0">
              اشحن &larr;
            </span>
          </div>
        </div>
      </button>
    </div>
  );
};
