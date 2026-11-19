export type ProductCategory = string;
export type DeliveryType =
  | 'direct_id'
  | 'voucher_code'
  | 'subscription_login'
  | 'account_delivery';
export type OrderStatus = 'pending_payment' | 'verifying' | 'processing' | 'completed' | 'failed';
export type CurrencyCode = 'EGP' | 'SAR' | 'AED' | 'USD';

export interface StoreCategory {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  sortOrder: number;
  isActive: boolean;
  updatedAt?: unknown;
}

export interface ProductPackage {
  id: string;
  name: string;
  amount: string;
  price: number;
  originalPrice?: number;
  tag?: string;
}

export interface Product {
  id: string;
  title: string;
  subtitle: string;
  category: ProductCategory;
  region: string;
  deliveryType: DeliveryType;
  requiresPlayerId: boolean;
  playerIdLabel: string;
  imageUrl: string;
  accentColor: string;
  isFeatured: boolean;
  isActive: boolean;
  sortOrder: number;
  packages: ProductPackage[];
  updatedAt?: unknown;
}

export interface Coupon {
  id: string;
  code: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  minOrderAmount: number;
  isActive: boolean;
  updatedAt?: unknown;
}

export interface PaymentMethod {
  id: string;
  name: string;
  walletNumber: string;
  accountHolder: string;
  instructions: string;
  feePercent: number;
  accentColor: string;
  requiresManualReview: boolean;
  isActive: boolean;
  sortOrder: number;
  updatedAt?: unknown;
}

export interface SiteConfig {
  brandName: string;
  logoUrl: string;
  heroTitle: string;
  heroSubtitle: string;
  heroCtaText: string;
  heroImageUrl: string;
  promoBannerText: string;
  promoBannerActive: boolean;
  marqueeFeatures: string[];
  primaryAccentColor: string;
  supportEmail: string;
  supportWhatsapp: string;
  currencyCode: CurrencyCode;
  currencySymbol: string;
  livePopupEnabled: boolean;
  autoFulfillmentEnabled: boolean;
  footerAboutText: string;
  updatedAt?: unknown;
}

export interface OrderRecord {
  id: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  orderNumber: string;
  productId: string;
  productTitle: string;
  category: ProductCategory;
  packageId: string;
  packageName: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  couponCode: string;
  feeAmount: number;
  totalAmount: number;
  currencySymbol: string;
  paymentMethodId: string;
  paymentMethodName: string;
  walletSenderPhone: string;
  transactionRef: string;
  playerId: string;
  accountEmail: string;
  accountPassword: string;
  accountNotes: string;
  deliveryType: DeliveryType;
  status: OrderStatus;
  deliveredCode: string;
  deliveredAccountEmail: string;
  deliveredAccountPassword: string;
  adminNote: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CartItem {
  cartItemId: string;
  product: Product;
  pkg: ProductPackage;
  quantity: number;
  playerId: string;
  accountEmail: string;
  accountPassword: string;
  accountNotes: string;
}

export interface PublicActivityItem {
  id: string;
  userId: string;
  displayName: string;
  productTitle: string;
  city: string;
  amountLabel: string;
  createdAt?: unknown;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  phone: string;
  walletBalance: number;
  lastVoucherId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TopupRequest {
  id: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  referenceCode: string;
  amount: number;
  currencySymbol: string;
  paymentMethodId: string;
  paymentMethodName: string;
  walletSenderPhone: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNote: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type VoucherType = 'balance' | 'discount_percent' | 'discount_fixed';

export interface Voucher {
  id: string;
  code: string;
  title: string;
  voucherType: VoucherType;
  value: number;
  minOrderAmount: number;
  maxUses: number;
  usedCount: number;
  expiresAt?: unknown;
  isActive: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SavedVoucher {
  id: string;
  voucherId: string;
  code: string;
  title: string;
  voucherType: 'discount_percent' | 'discount_fixed';
  value: number;
  minOrderAmount: number;
  expiresAt?: unknown;
  savedAt?: unknown;
}

export interface SiteNotification {
  id: string;
  targetUserId: string;
  title: string;
  message: string;
  notifType: 'order_tracking' | 'news' | 'voucher';
  voucherCode: string;
  orderNumber: string;
  expiresAt?: unknown;
  createdAt?: unknown;
}

export interface AdminRecord {
  uid: string;
  email: string;
  grantedAt?: unknown;
}

export interface ProductReview {
  id: string;
  userId: string;
  customerName: string;
  productId: string;
  productTitle: string;
  orderId: string;
  rating: number;
  comment: string;
  createdAt?: unknown;
}

export interface SupportThread {
  id: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  lastMessage: string;
  lastSenderRole: 'user' | 'admin';
  unreadByAdmin: boolean;
  unreadByUser: boolean;
  status: 'open' | 'resolved';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SupportMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: 'user' | 'admin';
  text: string;
  createdAt?: unknown;
}

export interface FlashDeal {
  id: string;
  title: string;
  productId: string;
  productTitle: string;
  packageId: string;
  packageName: string;
  imageUrl: string;
  originalPrice: number;
  flashPrice: number;
  startsAt?: unknown;
  endsAt?: unknown;
  maxStock: number;
  claimedCount: number;
  isActive: boolean;
  sortOrder: number;
  updatedAt?: unknown;
}

export interface BundleItem {
  productId: string;
  productTitle: string;
  packageId: string;
  packageName: string;
  originalPrice: number;
}

export interface ValueBundle {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  imageUrl: string;
  items: BundleItem[];
  originalTotalPrice: number;
  bundlePrice: number;
  accentColor: string;
  deliveryType: DeliveryType;
  requiresPlayerId: boolean;
  playerIdLabel: string;
  isActive: boolean;
  sortOrder: number;
  updatedAt?: unknown;
}
