import { DeliveryType, OrderStatus } from '../types';

export const DELIVERY_TYPE_LABELS: Record<
  DeliveryType,
  { short: string; full: string; badge: string }
> = {
  direct_id: {
    short: 'شحن مباشر',
    full: 'شحن مباشر بالمعرّف (ID)',
    badge: 'شحن مباشر ID',
  },
  voucher_code: {
    short: 'كود رقمي',
    full: 'تسليم كود رقمي فوري',
    badge: 'كود رقمي',
  },
  subscription_login: {
    short: 'اشتراك بحسابك',
    full: 'شحن الاشتراك بتسجيل الدخول ثم الخروج فوراً',
    badge: 'اشتراك بحسابك',
  },
  account_delivery: {
    short: 'تسليم كحساب',
    full: 'تسليم كحساب جاهز (بريد وكلمة مرور)',
    badge: 'حساب جاهز',
  },
};

export interface TrackingStepMeta {
  key: 'pending_payment' | 'verifying' | 'processing' | 'completed';
  label: string;
}

export function getTrackingStepsForDelivery(deliveryType: DeliveryType): TrackingStepMeta[] {
  switch (deliveryType) {
    case 'direct_id':
      return [
        { key: 'pending_payment', label: 'استلام طلب الشحن المباشر' },
        { key: 'verifying', label: 'تأكيد وصول الدفع' },
        { key: 'processing', label: 'جاري الشحن لمعرّف اللاعب' },
        { key: 'completed', label: 'تم الشحن للحساب بنجاح' },
      ];
    case 'voucher_code':
      return [
        { key: 'pending_payment', label: 'استلام طلب البطاقة' },
        { key: 'verifying', label: 'تأكيد وصول الدفع' },
        { key: 'processing', label: 'تجهيز وإصدار الكود الرقمي' },
        { key: 'completed', label: 'تم تسليم الكود الرقمي' },
      ];
    case 'subscription_login':
      return [
        { key: 'pending_payment', label: 'استلام بيانات الحساب' },
        { key: 'verifying', label: 'تأكيد الدفع والدخول للحساب' },
        { key: 'processing', label: 'جاري تفعيل الاشتراك الآن' },
        { key: 'completed', label: 'تم التفعيل وتسجيل الخروج بأمان' },
      ];
    case 'account_delivery':
      return [
        { key: 'pending_payment', label: 'استلام طلب الحساب' },
        { key: 'verifying', label: 'تأكيد وصول الدفع' },
        { key: 'processing', label: 'تجهيز وفحص الحساب الجديد' },
        { key: 'completed', label: 'تم تسليم بيانات الحساب' },
      ];
    default:
      return [
        { key: 'pending_payment', label: 'استلام الطلب' },
        { key: 'verifying', label: 'تأكيد وصول المبلغ' },
        { key: 'processing', label: 'جاري التجهيز' },
        { key: 'completed', label: 'اكتمال التسليم' },
      ];
  }
}

export function getOrderStatusLabel(status: OrderStatus, deliveryType?: DeliveryType): string {
  if (status === 'pending_payment') return 'بانتظار مراجعة الدفع';
  if (status === 'verifying') {
    return deliveryType === 'subscription_login'
      ? 'تم تأكيد الدفع — جاري الدخول'
      : 'تم تأكيد وصول المبلغ';
  }
  if (status === 'processing') {
    if (deliveryType === 'direct_id') return 'جاري الشحن لحساب اللاعب';
    if (deliveryType === 'voucher_code') return 'جاري تجهيز الكود الرقمي';
    if (deliveryType === 'subscription_login') return 'جاري تفعيل الاشتراك بالحساب';
    if (deliveryType === 'account_delivery') return 'جاري تجهيز بيانات الحساب';
    return 'جاري تجهيز الطلب';
  }
  if (status === 'completed') {
    if (deliveryType === 'direct_id') return 'مكتمل — تم الشحن بالمعرّف';
    if (deliveryType === 'voucher_code') return 'مكتمل — تم تسليم الكود';
    if (deliveryType === 'subscription_login') return 'مكتمل — تم التفعيل والخروج';
    if (deliveryType === 'account_delivery') return 'مكتمل — تم تسليم الحساب';
    return 'مكتمل — تم التسليم';
  }
  return 'مرفوض / ملغي';
}

export function generateAutoOrderNumber(): string {
  return `ZN-${Math.floor(100000 + Math.random() * 899999)}`;
}

export function generateAutoTopupRef(): string {
  return `TOP-${Math.floor(100000 + Math.random() * 899999)}`;
}

export function toMillisSafe(ts: unknown): number {
  if (ts && typeof ts === 'object') {
    if ('toMillis' in ts && typeof (ts as { toMillis: unknown }).toMillis === 'function') {
      return (ts as { toMillis: () => number }).toMillis();
    }
    if ('seconds' in ts && typeof (ts as { seconds: unknown }).seconds === 'number') {
      const sec = (ts as { seconds: number }).seconds;
      const ns =
        'nanoseconds' in ts && typeof (ts as { nanoseconds: unknown }).nanoseconds === 'number'
          ? (ts as { nanoseconds: number }).nanoseconds
          : 0;
      return sec * 1000 + Math.floor(ns / 1e6);
    }
    if ('_seconds' in ts && typeof (ts as { _seconds: unknown })._seconds === 'number') {
      const sec = (ts as { _seconds: number })._seconds;
      const ns =
        '_nanoseconds' in ts && typeof (ts as { _nanoseconds: unknown })._nanoseconds === 'number'
          ? (ts as { _nanoseconds: number })._nanoseconds
          : 0;
      return sec * 1000 + Math.floor(ns / 1e6);
    }
  }
  if (typeof ts === 'string' || typeof ts === 'number') {
    const t = new Date(ts).getTime();
    return Number.isNaN(t) ? 0 : t;
  }
  return 0;
}

export function formatRemainingTime(expiresAt: unknown, nowMs: number): string {
  const end = toMillisSafe(expiresAt);
  if (!end) return '';
  const diffSec = Math.max(0, Math.floor((end - nowMs) / 1000));
  if (diffSec <= 0) return 'منتهي';
  const days = Math.floor(diffSec / 86400);
  const hours = Math.floor((diffSec % 86400) / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  if (days > 0) return `${days} يوم و ${hours} ساعة`;
  if (hours > 0) return `${hours} س ${mins} د`;
  return `${Math.max(1, mins)} دقيقة`;
}
