import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { AlertCircle, Lock, Mail, Phone, User as UserIcon, X } from 'lucide-react';
import { auth, db, googleProvider } from '../firebase';
import { useStore } from '../context/StoreContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { siteConfig } = useStore();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showProviderHelp, setShowProviderHelp] = useState(false);

  if (!isOpen) return null;

  const mapAuthError = (err: unknown): string => {
    const code = (err as { code?: string })?.code || '';
    if (code === 'auth/operation-not-allowed') {
      setShowProviderHelp(true);
      return 'مزود تسجيل الدخول بالبريد وكلمة المرور غير مفعّل حالياً في إعدادات Firebase Authentication.';
    }
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
      return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
    }
    if (code === 'auth/email-already-in-use') {
      return 'هذا البريد الإلكتروني مسجل بالفعل. يمكنك تسجيل الدخول مباشرة.';
    }
    if (code === 'auth/weak-password') {
      return 'كلمة المرور يجب أن تتكون من 6 أحرف على الأقل.';
    }
    if (code === 'auth/invalid-email') {
      return 'يرجى إدخال بريد إلكتروني صحيح.';
    }
    if (code === 'auth/popup-closed-by-user') {
      return 'تم إغلاق نافذة تسجيل الدخول قبل الإتمام.';
    }
    return 'تعذر إتمام تسجيل الدخول. يرجى المحاولة مرة أخرى.';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setShowProviderHelp(false);
    setLoading(true);
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const cleanName = (fullName.trim() || email.split('@')[0]).slice(0, 80);
        await updateProfile(cred.user, { displayName: cleanName });
        const userRef = doc(db, 'users', cred.user.uid);
        const existingSnap = await getDoc(userRef);
        if (existingSnap.exists()) {
          await updateDoc(userRef, {
            displayName: cleanName,
            phone: phone.trim().slice(0, 30),
            updatedAt: serverTimestamp(),
          });
        } else {
          try {
            await setDoc(userRef, {
              uid: cred.user.uid,
              displayName: cleanName,
              email: (cred.user.email || email).slice(0, 120),
              phone: phone.trim().slice(0, 30),
              walletBalance: 0,
              lastVoucherId: '',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } catch {
            await updateDoc(userRef, {
              displayName: cleanName,
              phone: phone.trim().slice(0, 30),
              updatedAt: serverTimestamp(),
            });
          }
        }
      }
      onClose();
    } catch (err) {
      setErrorMsg(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMsg('');
    setShowProviderHelp(false);
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      onClose();
    } catch (err) {
      setErrorMsg(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] shadow-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
              {mode === 'login' ? 'تسجيل الدخول إلى حسابك' : 'إنشاء حساب جديد'}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              احفظ طلباتك واستلم أكوادك الرقمية وفواتيرك تلقائياً
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Segmented Tabs */}
          <div className="grid grid-cols-2 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMsg('');
              }}
              className={`py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                mode === 'login'
                  ? 'bg-white dark:bg-[#181E27] text-zinc-900 dark:text-white shadow-sm'
                  : 'text-zinc-500 dark:text-zinc-400'
              }`}
            >
              تسجيل الدخول
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMsg('');
              }}
              className={`py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                mode === 'register'
                  ? 'bg-white dark:bg-[#181E27] text-zinc-900 dark:text-white shadow-sm'
                  : 'text-zinc-500 dark:text-zinc-400'
              }`}
            >
              حساب جديد
            </button>
          </div>

          {errorMsg && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-700 dark:text-rose-300 space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
              {showProviderHelp && (
                <p className="text-[11px] leading-relaxed text-zinc-700 dark:text-zinc-300">
                  لتفعيل البريد وكلمة المرور: افتح لوحة Firebase Console &larr; Authentication &larr; Sign-in method &larr; فعّل Email/Password. أو استخدم زر الدخول السريع عبر Google أدناه.
                </p>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    الاسم الكامل
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-zinc-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="مثال: أحمد محمد"
                      className="w-full h-11 pr-10 pl-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/70 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    رقم المحفظة / الهاتف (اختياري)
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-zinc-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="010xxxxxxxx"
                      className="w-full h-11 pr-10 pl-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/70 text-sm text-zinc-900 dark:text-white font-mono-tabular focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                البريد الإلكتروني
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full h-11 pr-10 pl-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/70 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                كلمة المرور
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 pr-10 pl-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/70 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl font-bold text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-60 cursor-pointer"
              style={{ backgroundColor: siteConfig.primaryAccentColor || '#10B981' }}
            >
              {loading
                ? 'جاري المعالجة...'
                : mode === 'login'
                ? 'دخول بالبريد وكلمة المرور'
                : 'إنشاء الحساب والبدء'}
            </button>
          </form>

          <div className="relative flex items-center py-1">
            <div className="flex-grow border-t border-zinc-200 dark:border-zinc-800" />
            <span className="shrink-0 mx-3 text-xs text-zinc-400">أو</span>
            <div className="flex-grow border-t border-zinc-200 dark:border-zinc-800" />
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={handleGoogleLogin}
            className="w-full h-11 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm font-semibold text-zinc-800 dark:text-zinc-100 flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
              />
            </svg>
            <span>المتابعة بحساب Google</span>
          </button>
        </div>
      </div>
    </div>
  );
};
