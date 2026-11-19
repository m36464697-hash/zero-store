import React, { useEffect, useState } from 'react';
import { useStore } from '../context/StoreContext';

export const DEFAULT_LOGO_PATH = '/assets/aistudio/__________ZCIO________2f74a1f6.png';

interface ZoneLogoProps {
  brandName?: string;
  logoUrl?: string;
  accentColor?: string;
  size?: 'header' | 'footer';
}

const processedLogoCache = new Map<string, string>();

function processBlackBgLogo(src: string, mode: 'dark' | 'light'): Promise<string> {
  const cacheKey = `${src}::${mode}`;
  const cached = processedLogoCache.get(cacheKey);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onerror = () => reject(new Error('Failed to load logo image'));
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(src);
          return;
        }

        ctx.drawImage(img, 0, 0, w, h);
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;

        let minX = w;
        let minY = h;
        let maxX = 0;
        let maxY = 0;

        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const lum = Math.max(r, g, b);

            if (lum <= 18) {
              data[i + 3] = 0;
              continue;
            }

            // Smooth anti-aliased alpha ramp on edges, solid inside letters
            const alpha =
              lum >= 135 ? 255 : Math.min(255, Math.round(((lum - 18) / (135 - 18)) * 255));
            data[i + 3] = alpha;

            if (mode === 'dark') {
              // Un-premultiply dark anti-aliased edge pixels so zero dark halo appears
              if (lum < 150) {
                const factor = Math.min(4.2, 235 / Math.max(lum, 1));
                data[i] = Math.min(255, Math.round(r * factor));
                data[i + 1] = Math.min(255, Math.round(g * factor));
                data[i + 2] = Math.min(255, Math.round(b * factor));
              }
            } else {
              // Render crisp deep-slate/obsidian typography for Light mode with subtle 3D bevel
              const shade = lum >= 150 ? Math.max(0, 255 - lum) : 0;
              data[i] = Math.min(90, 15 + Math.round(shade * 0.65));
              data[i + 1] = Math.min(100, 23 + Math.round(shade * 0.65));
              data[i + 2] = Math.min(115, 42 + Math.round(shade * 0.65));
            }

            if (alpha > 20) {
              if (x < minX) minX = x;
              if (y < minY) minY = y;
              if (x > maxX) maxX = x;
              if (y > maxY) maxY = y;
            }
          }
        }

        ctx.putImageData(imgData, 0, 0);

        // Trim transparent outer margins cleanly so the logo fills its slot crisply
        if (maxX > minX && maxY > minY) {
          const pad = 6;
          const sx = Math.max(0, minX - pad);
          const sy = Math.max(0, minY - pad);
          const sw = Math.min(w - sx, maxX - minX + 1 + pad * 2);
          const sh = Math.min(h - sy, maxY - minY + 1 + pad * 2);

          const outCanvas = document.createElement('canvas');
          outCanvas.width = sw;
          outCanvas.height = sh;
          const outCtx = outCanvas.getContext('2d');
          if (outCtx) {
            outCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
            const result = outCanvas.toDataURL('image/png');
            processedLogoCache.set(cacheKey, result);
            resolve(result);
            return;
          }
        }

        const fallback = canvas.toDataURL('image/png');
        processedLogoCache.set(cacheKey, fallback);
        resolve(fallback);
      } catch {
        resolve(src);
      }
    };
    img.src = src;
  });
}

export const ZoneLogo: React.FC<ZoneLogoProps> = ({
  brandName = 'Zero Store',
  logoUrl,
  size = 'header',
}) => {
  const { theme } = useStore();
  const [imgError, setImgError] = useState(false);
  const resolvedSrc = logoUrl?.trim() ? logoUrl.trim() : DEFAULT_LOGO_PATH;
  const isDefaultBlackBgLogo = resolvedSrc === DEFAULT_LOGO_PATH;

  const [transparentSrc, setTransparentSrc] = useState<string>(() =>
    isDefaultBlackBgLogo
      ? processedLogoCache.get(`${resolvedSrc}::${theme}`) || ''
      : resolvedSrc
  );

  useEffect(() => {
    setImgError(false);
    if (!isDefaultBlackBgLogo) {
      setTransparentSrc(resolvedSrc);
      return;
    }

    let cancelled = false;
    const cached = processedLogoCache.get(`${resolvedSrc}::${theme}`);
    if (cached) {
      setTransparentSrc(cached);
      return;
    }

    processBlackBgLogo(resolvedSrc, theme)
      .then((res) => {
        if (!cancelled) setTransparentSrc(res);
      })
      .catch(() => {
        if (!cancelled) setTransparentSrc(resolvedSrc);
      });

    return () => {
      cancelled = true;
    };
  }, [resolvedSrc, isDefaultBlackBgLogo, theme]);

  const activeSrc = transparentSrc || resolvedSrc;

  return (
    <div className="flex items-center shrink-0">
      {!imgError ? (
        <img
          src={activeSrc}
          alt={brandName || 'Zero Store'}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className={`${
            size === 'footer'
              ? 'h-12 sm:h-14 max-w-[220px]'
              : 'h-10 sm:h-11 max-w-[190px]'
          } w-auto object-contain transition-transform duration-200 hover:scale-[1.03] ${
            isDefaultBlackBgLogo && !transparentSrc
              ? 'invert mix-blend-multiply dark:invert-0 dark:mix-blend-screen'
              : ''
          }`}
        />
      ) : (
        <span className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
          {brandName || 'Zero Store'}
        </span>
      )}
    </div>
  );
};
