function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('تعذر قراءة ملف الصورة.'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

export async function compressImageFileToDataUrl(
  file: File,
  maxDimension = 1600,
  maxBytes = 780000
): Promise<string> {
  const originalDataUrl = await readFileAsDataUrl(file);

  // Preserve original file with 100% lossless native resolution/quality when it safely fits Firestore field limit
  if (originalDataUrl.length <= maxBytes) {
    return originalDataUrl;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error('ملف الصورة غير صالح.'));
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > maxDimension || height > maxDimension) {
        if (width >= height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('تعذر معالجة الصورة.'));
        return;
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      // Start at ultra-high 0.96 quality WebP to preserve maximum sharpness
      let quality = 0.96;
      let dataUrl = canvas.toDataURL('image/webp', quality);
      const format = dataUrl.startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg';
      if (format === 'image/jpeg') {
        dataUrl = canvas.toDataURL('image/jpeg', quality);
      }

      while (dataUrl.length > maxBytes && quality > 0.6) {
        quality = Number((quality - 0.06).toFixed(2));
        dataUrl = canvas.toDataURL(format, quality);
      }

      // If still oversized for huge 4K/8K raw uploads, scale dimension gently while keeping high quality
      if (dataUrl.length > maxBytes) {
        const scale = 0.72;
        canvas.width = Math.max(400, Math.round(width * scale));
        canvas.height = Math.max(400, Math.round(height * scale));
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        dataUrl = canvas.toDataURL(format, 0.9);
      }

      if (dataUrl.length > maxBytes) {
        reject(new Error('حجم الصورة كبير جداً. يرجى اختيار صورة أصغر أو استخدام رابط مباشر.'));
        return;
      }

      resolve(dataUrl);
    };
    img.src = originalDataUrl;
  });
}
