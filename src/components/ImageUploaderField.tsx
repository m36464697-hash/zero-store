import React, { useRef, useState } from 'react';
import { Image as ImageIcon, Loader2, Upload, X } from 'lucide-react';
import { compressImageFileToDataUrl } from '../utils/imageUpload';

interface ImageUploaderFieldProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  allowClear?: boolean;
  maxDimension?: number;
  maxBytes?: number;
}

export const ImageUploaderField: React.FC<ImageUploaderFieldProps> = ({
  label,
  value,
  onChange,
  placeholder = 'https://... أو ارفع صورة من جهازك بأعلى جودة',
  allowClear = false,
  maxDimension = 1600,
  maxBytes = 780000,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg('');
    setUploading(true);
    try {
      const dataUrl = await compressImageFileToDataUrl(file, maxDimension, maxBytes);
      onChange(dataUrl);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذر رفع الصورة.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300">
        {label}
      </label>

      <div className="flex items-center gap-2.5">
        <div className="w-12 h-12 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 overflow-hidden shrink-0 flex items-center justify-center">
          {value ? (
            <img
              src={value}
              alt={label}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          ) : (
            <ImageIcon className="w-5 h-5 text-zinc-400" />
          )}
        </div>

        <input
          type="text"
          value={value.startsWith('data:image/') ? 'صورة مرفوعة بأعلى جودة' : value}
          onChange={(e) => {
            setErrorMsg('');
            onChange(e.target.value);
          }}
          placeholder={placeholder}
          className="flex-1 h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500"
        />

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-1.5 shrink-0 cursor-pointer"
        >
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          <span>رفع صورة</span>
        </button>

        {allowClear && value && (
          <button
            type="button"
            onClick={() => onChange('')}
            title="حذف الصورة"
            className="h-10 w-10 rounded-xl border border-zinc-200 dark:border-zinc-700 text-rose-500 hover:bg-rose-500/10 flex items-center justify-center shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {errorMsg && <p className="text-[11px] text-rose-500">{errorMsg}</p>}
    </div>
  );
};
