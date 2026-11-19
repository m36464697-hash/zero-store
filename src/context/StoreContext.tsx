import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  auth,
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import {
  createDefaultFlashDeals,
  DEFAULT_BUNDLES,
  DEFAULT_CATEGORIES,
  DEFAULT_COUPONS,
  DEFAULT_PAYMENT_METHODS,
  DEFAULT_PRODUCTS,
  DEFAULT_SITE_CONFIG,
} from '../data/defaultCatalog';
import {
  CartItem,
  Coupon,
  FlashDeal,
  OrderRecord,
  PaymentMethod,
  Product,
  ProductPackage,
  ProductReview,
  PublicActivityItem,
  SavedVoucher,
  SiteConfig,
  SiteNotification,
  StoreCategory,
  SupportMessage,
  SupportThread,
  TopupRequest,
  UserProfile,
  ValueBundle,
  Voucher,
  VoucherType,
} from '../types';
import {
  generateAutoOrderNumber,
  generateAutoTopupRef,
  toMillisSafe,
} from '../utils/deliveryHelpers';

export type ThemeMode = 'dark' | 'light';

export interface PlaceOrderPayload {
  product: Product;
  pkg: ProductPackage;
  quantity: number;
  paymentMethodId: string;
  paymentMethodName: string;
  feePercent: number;
  walletSenderPhone: string;
  orderNumber?: string;
  playerId: string;
  accountEmail?: string;
  accountPassword?: string;
  accountNotes?: string;
  couponCode: string;
  discountAmount: number;
}

interface PlaceCartOrdersPayload {
  items: CartItem[];
  paymentMethodId: string;
  paymentMethodName: string;
  feePercent: number;
  walletSenderPhone: string;
  batchOrderNumber: string;
  couponCode: string;
  totalDiscount: number;
}

interface SubmitReviewPayload {
  order: OrderRecord;
  rating: number;
  comment: string;
}

interface RequestTopupPayload {
  amount: number;
  paymentMethod: PaymentMethod;
  walletSenderPhone: string;
  referenceCode?: string;
}

interface CreateVoucherPayload {
  code: string;
  title: string;
  voucherType: VoucherType;
  value: number;
  minOrderAmount: number;
  maxUses: number;
  durationHours: number;
  alsoBroadcastNotification?: boolean;
}

interface SendNotificationPayload {
  targetUserId: string;
  title: string;
  message: string;
  notifType: 'order_tracking' | 'news' | 'voucher';
  voucherCode?: string;
  orderNumber?: string;
  durationMinutes: number;
}

interface StoreContextValue {
  theme: ThemeMode;
  toggleTheme: () => void;
  nowMs: number;
  user: User | null;
  authReady: boolean;
  userProfile: UserProfile | null;
  isAdmin: boolean;
  siteConfig: SiteConfig;
  categories: StoreCategory[];
  products: Product[];
  coupons: Coupon[];
  paymentMethods: PaymentMethod[];
  flashDeals: FlashDeal[];
  activeFlashDeals: FlashDeal[];
  bundles: ValueBundle[];
  activeBundles: ValueBundle[];
  reviews: ProductReview[];
  catalogSeeded: boolean;
  walletsSeeded: boolean;
  categoriesSeeded: boolean;
  flashDealsSeeded: boolean;
  bundlesSeeded: boolean;
  userOrders: OrderRecord[];
  allOrders: OrderRecord[];
  publicActivity: PublicActivityItem[];
  supportThread: SupportThread | null;
  supportMessages: SupportMessage[];
  allSupportThreads: SupportThread[];
  favorites: string[];
  toggleFavorite: (productId: string) => void;
  // Shopping Cart
  cart: CartItem[];
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  addToCart: (item: Omit<CartItem, 'cartItemId'>) => void;
  updateCartQuantity: (cartItemId: string, delta: number) => void;
  removeFromCart: (cartItemId: string) => void;
  clearCart: () => void;
  // Wallet Topups, Vouchers & Notifications
  userTopups: TopupRequest[];
  allTopups: TopupRequest[];
  vouchers: Voucher[];
  savedVouchers: SavedVoucher[];
  activeNotifications: SiteNotification[];
  allAdminNotifications: SiteNotification[];
  readNotifIds: string[];
  unreadNotificationsCount: number;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  // Actions
  seedDefaultStoreData: () => Promise<void>;
  updateUserProfile: (data: { displayName: string; phone: string }) => Promise<void>;
  placeOrderAndTrack: (payload: PlaceOrderPayload) => Promise<OrderRecord>;
  placeCartOrders: (payload: PlaceCartOrdersPayload) => Promise<OrderRecord[]>;
  requestWalletTopup: (payload: RequestTopupPayload) => Promise<TopupRequest>;
  approveTopupRequest: (req: TopupRequest, adminNote?: string) => Promise<void>;
  rejectTopupRequest: (req: TopupRequest, adminNote?: string) => Promise<void>;
  redeemVoucherCode: (code: string) => Promise<{ message: string; type: VoucherType }>;
  createVoucher: (payload: CreateVoucherPayload) => Promise<void>;
  toggleVoucherStatus: (v: Voucher) => Promise<void>;
  deleteVoucher: (id: string) => Promise<void>;
  sendSiteNotification: (payload: SendNotificationPayload) => Promise<void>;
  deleteSiteNotification: (id: string) => Promise<void>;
  publishActivityForOrder: (order: OrderRecord) => Promise<void>;
  submitProductReview: (payload: SubmitReviewPayload) => Promise<void>;
  deleteProductReview: (reviewId: string) => Promise<void>;
  sendSupportMessage: (text: string) => Promise<void>;
  markSupportReadByUser: () => Promise<void>;
  sendAdminSupportReply: (threadId: string, text: string) => Promise<void>;
  toggleSupportThreadStatus: (threadId: string, status: 'open' | 'resolved') => Promise<void>;
  markSupportReadByAdmin: (threadId: string) => Promise<void>;
  logout: () => Promise<void>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

function maskBuyerName(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return 'عميل زون';
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) {
    return `${parts[0].slice(0, 8)}`;
  }
  return `${parts[0]} ${parts[1].charAt(0)}.`;
}

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('zone_theme');
      if (saved === 'light' || saved === 'dark') return saved;
    }
    return 'dark';
  });

  const [nowMs, setNowMs] = useState(() => Date.now());

  const [favorites, setFavorites] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('zone_favorites');
        if (raw) return JSON.parse(raw) as string[];
      } catch {
        return [];
      }
    }
    return [];
  });

  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('zone_cart_v1');
        if (raw) return JSON.parse(raw) as CartItem[];
      } catch {
        return [];
      }
    }
    return [];
  });
  const [cartOpen, setCartOpen] = useState(false);

  const [readNotifIds, setReadNotifIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('zone_read_notifs');
        if (raw) return JSON.parse(raw) as string[];
      } catch {
        return [];
      }
    }
    return [];
  });

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const defaultFlashDeals = useMemo(() => createDefaultFlashDeals(), []);
  const [siteConfig, setSiteConfig] = useState<SiteConfig>(DEFAULT_SITE_CONFIG);
  const [categories, setCategories] = useState<StoreCategory[]>(DEFAULT_CATEGORIES);
  const [products, setProducts] = useState<Product[]>(DEFAULT_PRODUCTS);
  const [coupons, setCoupons] = useState<Coupon[]>(DEFAULT_COUPONS);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(DEFAULT_PAYMENT_METHODS);
  const [flashDeals, setFlashDeals] = useState<FlashDeal[]>(defaultFlashDeals);
  const [bundles, setBundles] = useState<ValueBundle[]>(DEFAULT_BUNDLES);
  const [reviews, setReviews] = useState<ProductReview[]>([]);

  const [catalogSeeded, setCatalogSeeded] = useState(false);
  const [walletsSeeded, setWalletsSeeded] = useState(false);
  const [categoriesSeeded, setCategoriesSeeded] = useState(false);
  const [flashDealsSeeded, setFlashDealsSeeded] = useState(false);
  const [bundlesSeeded, setBundlesSeeded] = useState(false);

  const [userOrders, setUserOrders] = useState<OrderRecord[]>([]);
  const [allOrders, setAllOrders] = useState<OrderRecord[]>([]);
  const [publicActivity, setPublicActivity] = useState<PublicActivityItem[]>([]);

  const [userTopups, setUserTopups] = useState<TopupRequest[]>([]);
  const [allTopups, setAllTopups] = useState<TopupRequest[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [savedVouchers, setSavedVouchers] = useState<SavedVoucher[]>([]);

  const [publicNotifications, setPublicNotifications] = useState<SiteNotification[]>([]);
  const [personalNotifications, setPersonalNotifications] = useState<SiteNotification[]>([]);
  const [allAdminNotifications, setAllAdminNotifications] = useState<SiteNotification[]>([]);

  const [supportThread, setSupportThread] = useState<SupportThread | null>(null);
  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>([]);
  const [allSupportThreads, setAllSupportThreads] = useState<SupportThread[]>([]);

  // Live ticker every 15s to auto-expire timed notifications/vouchers cleanly
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('zone_theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty('--zone-accent', siteConfig.primaryAccentColor || '#10B981');
  }, [siteConfig.primaryAccentColor]);

  useEffect(() => {
    try {
      localStorage.setItem('zone_cart_v1', JSON.stringify(cart));
    } catch {
      // ignore storage quota
    }
  }, [cart]);

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  const toggleFavorite = (productId: string) => {
    setFavorites((prev) => {
      const next = prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId];
      localStorage.setItem('zone_favorites', JSON.stringify(next));
      return next;
    });
  };

  const addToCart = (item: Omit<CartItem, 'cartItemId'>) => {
    setCart((prev) => {
      const idx = prev.findIndex(
        (c) =>
          c.product.id === item.product.id &&
          c.pkg.id === item.pkg.id &&
          c.playerId.trim() === item.playerId.trim() &&
          c.accountEmail.trim() === item.accountEmail.trim()
      );
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = {
          ...copy[idx],
          quantity: Math.min(20, copy[idx].quantity + item.quantity),
        };
        return copy;
      }
      return [
        ...prev,
        {
          ...item,
          cartItemId: `ci_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        },
      ];
    });
  };

  const updateCartQuantity = (cartItemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) =>
          c.cartItemId === cartItemId
            ? { ...c, quantity: Math.max(0, Math.min(20, c.quantity + delta)) }
            : c
        )
        .filter((c) => c.quantity > 0)
    );
  };

  const removeFromCart = (cartItemId: string) => {
    setCart((prev) => prev.filter((c) => c.cartItemId !== cartItemId));
  };

  const clearCart = () => setCart([]);

  const markNotificationRead = (id: string) => {
    setReadNotifIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [id, ...prev].slice(0, 120);
      localStorage.setItem('zone_read_notifs', JSON.stringify(next));
      return next;
    });
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setUserProfile(null);
        setIsAdmin(false);
        setUserOrders([]);
        setAllOrders([]);
        setUserTopups([]);
        setAllTopups([]);
        setVouchers([]);
        setSavedVouchers([]);
        setPersonalNotifications([]);
        setAllAdminNotifications([]);
        setSupportThread(null);
        setSupportMessages([]);
        setAllSupportThreads([]);
        setAuthReady(true);
        return;
      }

      const bootstrapped =
        firebaseUser.email === BOOTSTRAPPED_ADMIN_EMAIL && firebaseUser.emailVerified;
      if (bootstrapped) {
        setIsAdmin(true);
      } else {
        try {
          const adminDoc = await getDoc(doc(db, 'admins', firebaseUser.uid));
          setIsAdmin(adminDoc.exists());
        } catch {
          setIsAdmin(false);
        }
      }

      try {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const data = snap.data() as Partial<UserProfile>;
          if (data.walletBalance === undefined || data.lastVoucherId === undefined) {
            await updateDoc(userRef, {
              walletBalance: typeof data.walletBalance === 'number' ? data.walletBalance : 0,
              lastVoucherId: typeof data.lastVoucherId === 'string' ? data.lastVoucherId : '',
              updatedAt: serverTimestamp(),
            });
          }
          setUserProfile({
            uid: firebaseUser.uid,
            displayName: data.displayName || firebaseUser.displayName || 'عميل المتجر',
            email: data.email || firebaseUser.email || '',
            phone: data.phone || '',
            walletBalance: typeof data.walletBalance === 'number' ? data.walletBalance : 0,
            lastVoucherId: typeof data.lastVoucherId === 'string' ? data.lastVoucherId : '',
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          });
        } else {
          const newProfile: UserProfile = {
            uid: firebaseUser.uid,
            displayName:
              firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'عميل Zero Store',
            email: firebaseUser.email || `${firebaseUser.uid}@users.zero-store.local`,
            phone: '',
            walletBalance: 0,
            lastVoucherId: '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          await setDoc(userRef, newProfile);
          setUserProfile(newProfile);
        }
      } catch (err) {
        console.warn('Profile sync warning:', err);
      }

      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Public Catalog & Global Broadcast Notifications
  useEffect(() => {
    const unsubConfig = onSnapshot(
      doc(db, 'siteConfig', 'main'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Partial<SiteConfig>;
          const rawLogo = data.logoUrl?.trim() || '';
          const shouldUseNewDefault =
            !rawLogo || rawLogo.includes('__________zero_store________068f7bda.png');
          setSiteConfig({
            ...DEFAULT_SITE_CONFIG,
            ...data,
            logoUrl: shouldUseNewDefault ? DEFAULT_SITE_CONFIG.logoUrl : rawLogo,
          });
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'siteConfig/main');
      }
    );

    const unsubCategories = onSnapshot(
      collection(db, 'categories'),
      (snapshot) => {
        if (!snapshot.empty) {
          const list = snapshot.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<StoreCategory, 'id'>),
          }));
          list.sort((a, b) => a.sortOrder - b.sortOrder);
          setCategories(list);
          setCategoriesSeeded(true);
        } else {
          setCategories(DEFAULT_CATEGORIES);
          setCategoriesSeeded(false);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'categories');
      }
    );

    const unsubProducts = onSnapshot(
      collection(db, 'products'),
      (snapshot) => {
        if (!snapshot.empty) {
          const list = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Product, 'id'>) }));
          list.sort((a, b) => a.sortOrder - b.sortOrder);
          setProducts(list);
          setCatalogSeeded(true);
        } else {
          setProducts(DEFAULT_PRODUCTS);
          setCatalogSeeded(false);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'products');
      }
    );

    const unsubCoupons = onSnapshot(
      collection(db, 'coupons'),
      (snapshot) => {
        if (!snapshot.empty) {
          setCoupons(
            snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Coupon, 'id'>) }))
          );
        } else {
          setCoupons(DEFAULT_COUPONS);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'coupons');
      }
    );

    const unsubWallets = onSnapshot(
      collection(db, 'paymentMethods'),
      (snapshot) => {
        if (!snapshot.empty) {
          const list = snapshot.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<PaymentMethod, 'id'>),
          }));
          list.sort((a, b) => a.sortOrder - b.sortOrder);
          setPaymentMethods(list);
          setWalletsSeeded(true);
        } else {
          setPaymentMethods(DEFAULT_PAYMENT_METHODS);
          setWalletsSeeded(false);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'paymentMethods');
      }
    );

    const unsubReviews = onSnapshot(
      collection(db, 'reviews'),
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ProductReview, 'id'>),
        }));
        list.sort((a, b) => toMillisSafe(b.createdAt) - toMillisSafe(a.createdAt));
        setReviews(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'reviews');
      }
    );

    const activityQuery = query(
      collection(db, 'publicActivity'),
      orderBy('createdAt', 'desc'),
      limit(15)
    );
    const unsubActivity = onSnapshot(
      activityQuery,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<PublicActivityItem, 'id'>),
        }));
        setPublicActivity(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'publicActivity');
      }
    );

    const publicNotifQuery = query(
      collection(db, 'notifications'),
      where('targetUserId', '==', 'all')
    );
    const unsubPublicNotifs = onSnapshot(
      publicNotifQuery,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<SiteNotification, 'id'>),
        }));
        setPublicNotifications(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'notifications');
      }
    );

    const unsubFlashDeals = onSnapshot(
      collection(db, 'flashDeals'),
      (snapshot) => {
        if (!snapshot.empty) {
          const list = snapshot.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<FlashDeal, 'id'>),
          }));
          list.sort((a, b) => a.sortOrder - b.sortOrder);
          setFlashDeals(list);
          setFlashDealsSeeded(true);
        } else {
          setFlashDeals(defaultFlashDeals);
          setFlashDealsSeeded(false);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'flashDeals');
      }
    );

    const unsubBundles = onSnapshot(
      collection(db, 'bundles'),
      (snapshot) => {
        if (!snapshot.empty) {
          const list = snapshot.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<ValueBundle, 'id'>),
          }));
          list.sort((a, b) => a.sortOrder - b.sortOrder);
          setBundles(list);
          setBundlesSeeded(true);
        } else {
          setBundles(DEFAULT_BUNDLES);
          setBundlesSeeded(false);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'bundles');
      }
    );

    return () => {
      unsubConfig();
      unsubCategories();
      unsubProducts();
      unsubCoupons();
      unsubWallets();
      unsubReviews();
      unsubActivity();
      unsubPublicNotifs();
      unsubFlashDeals();
      unsubBundles();
    };
  }, [defaultFlashDeals]);

  // User-Scoped Subscriptions (Profile, Orders, Topups, Vouchers, Personal Notifications, Support)
  useEffect(() => {
    if (!authReady || !user) {
      setUserOrders([]);
      setUserTopups([]);
      setVouchers([]);
      setSavedVouchers([]);
      setPersonalNotifications([]);
      setSupportThread(null);
      setSupportMessages([]);
      return;
    }

    const unsubUserDoc = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data() as Partial<UserProfile>;
          setUserProfile({
            uid: user.uid,
            displayName: d.displayName || user.displayName || 'عميل المتجر',
            email: d.email || user.email || '',
            phone: d.phone || '',
            walletBalance: typeof d.walletBalance === 'number' ? d.walletBalance : 0,
            lastVoucherId: typeof d.lastVoucherId === 'string' ? d.lastVoucherId : '',
            createdAt: d.createdAt,
            updatedAt: d.updatedAt,
          });
        }
      },
      (error) => handleFirestoreError(error, OperationType.GET, `users/${user.uid}`)
    );

    const ordersQ = query(collection(db, 'orders'), where('userId', '==', user.uid));
    const unsubOrders = onSnapshot(
      ordersQ,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<OrderRecord, 'id'>),
        }));
        list.sort((a, b) => toMillisSafe(b.createdAt) - toMillisSafe(a.createdAt));
        setUserOrders(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'orders')
    );

    const topupsQ = query(collection(db, 'topupRequests'), where('userId', '==', user.uid));
    const unsubTopups = onSnapshot(
      topupsQ,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<TopupRequest, 'id'>),
        }));
        list.sort((a, b) => toMillisSafe(b.createdAt) - toMillisSafe(a.createdAt));
        setUserTopups(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'topupRequests')
    );

    const unsubVouchers = onSnapshot(
      collection(db, 'vouchers'),
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Voucher, 'id'>),
        }));
        list.sort((a, b) => toMillisSafe(b.createdAt) - toMillisSafe(a.createdAt));
        setVouchers(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'vouchers')
    );

    const unsubSavedVouchers = onSnapshot(
      collection(db, 'users', user.uid, 'savedVouchers'),
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<SavedVoucher, 'id'>),
        }));
        list.sort((a, b) => toMillisSafe(b.savedAt) - toMillisSafe(a.savedAt));
        setSavedVouchers(list);
      },
      (error) =>
        handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/savedVouchers`)
    );

    const personalNotifQ = query(
      collection(db, 'notifications'),
      where('targetUserId', '==', user.uid)
    );
    const unsubPersonalNotifs = onSnapshot(
      personalNotifQ,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<SiteNotification, 'id'>),
        }));
        setPersonalNotifications(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'notifications')
    );

    const unsubThread = onSnapshot(
      doc(db, 'supportThreads', user.uid),
      (snap) => {
        if (snap.exists()) {
          setSupportThread({
            id: snap.id,
            ...(snap.data() as Omit<SupportThread, 'id'>),
          });
        } else {
          setSupportThread(null);
        }
      },
      (error) => handleFirestoreError(error, OperationType.GET, `supportThreads/${user.uid}`)
    );

    const msgsQuery = query(
      collection(db, 'supportThreads', user.uid, 'messages'),
      orderBy('createdAt', 'asc')
    );
    const unsubMsgs = onSnapshot(
      msgsQuery,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<SupportMessage, 'id'>),
        }));
        setSupportMessages(list);
      },
      (error) =>
        handleFirestoreError(error, OperationType.LIST, `supportThreads/${user.uid}/messages`)
    );

    return () => {
      unsubUserDoc();
      unsubOrders();
      unsubTopups();
      unsubVouchers();
      unsubSavedVouchers();
      unsubPersonalNotifs();
      unsubThread();
      unsubMsgs();
    };
  }, [authReady, user]);

  // Admin-Only Subscriptions
  useEffect(() => {
    if (!authReady || !user || !isAdmin) {
      setAllOrders([]);
      setAllTopups([]);
      setAllAdminNotifications([]);
      setAllSupportThreads([]);
      return;
    }

    const unsubOrders = onSnapshot(
      collection(db, 'orders'),
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<OrderRecord, 'id'>),
        }));
        list.sort((a, b) => toMillisSafe(b.createdAt) - toMillisSafe(a.createdAt));
        setAllOrders(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'orders')
    );

    const unsubAllTopups = onSnapshot(
      collection(db, 'topupRequests'),
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<TopupRequest, 'id'>),
        }));
        list.sort((a, b) => toMillisSafe(b.createdAt) - toMillisSafe(a.createdAt));
        setAllTopups(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'topupRequests')
    );

    const unsubAllNotifs = onSnapshot(
      collection(db, 'notifications'),
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<SiteNotification, 'id'>),
        }));
        list.sort((a, b) => toMillisSafe(b.createdAt) - toMillisSafe(a.createdAt));
        setAllAdminNotifications(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'notifications')
    );

    const unsubThreads = onSnapshot(
      collection(db, 'supportThreads'),
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<SupportThread, 'id'>),
        }));
        list.sort((a, b) => toMillisSafe(b.updatedAt) - toMillisSafe(a.updatedAt));
        setAllSupportThreads(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'supportThreads')
    );

    return () => {
      unsubOrders();
      unsubAllTopups();
      unsubAllNotifs();
      unsubThreads();
    };
  }, [authReady, user, isAdmin]);

  // Active unexpired notifications (auto-hide when expiresAt <= nowMs)
  const activeNotifications = useMemo(() => {
    const map = new Map<string, SiteNotification>();
    [...publicNotifications, ...personalNotifications].forEach((n) => {
      const exp = toMillisSafe(n.expiresAt);
      if (exp === 0 || exp > nowMs) {
        map.set(n.id, n);
      }
    });
    return Array.from(map.values()).sort(
      (a, b) => toMillisSafe(b.createdAt) - toMillisSafe(a.createdAt)
    );
  }, [publicNotifications, personalNotifications, nowMs]);

  const unreadNotificationsCount = useMemo(
    () => activeNotifications.filter((n) => !readNotifIds.includes(n.id)).length,
    [activeNotifications, readNotifIds]
  );

  const markAllNotificationsRead = () => {
    const ids = activeNotifications.map((n) => n.id);
    if (ids.length === 0) return;
    setReadNotifIds((prev) => {
      const merged = Array.from(new Set([...ids, ...prev])).slice(0, 150);
      localStorage.setItem('zone_read_notifs', JSON.stringify(merged));
      return merged;
    });
  };

  const activeFlashDeals = useMemo(() => {
    return flashDeals.filter((d) => {
      if (!d.isActive) return false;
      const startMs = toMillisSafe(d.startsAt);
      const endMs = toMillisSafe(d.endsAt);
      if (startMs > 0 && startMs > nowMs) return false;
      if (endMs > 0 && endMs <= nowMs) return false;
      if (d.claimedCount >= d.maxStock) return false;
      return true;
    });
  }, [flashDeals, nowMs]);

  const activeBundles = useMemo(
    () => bundles.filter((b) => b.isActive),
    [bundles]
  );

  const seedPromotionsOnly = async (seedFlash: boolean, seedBundles: boolean) => {
    if (!seedFlash && !seedBundles) return;
    const batch = writeBatch(db);
    if (seedFlash) {
      const freshDeals = createDefaultFlashDeals(Date.now());
      for (const deal of freshDeals) {
        const { id, ...rest } = deal;
        batch.set(doc(db, 'flashDeals', id), {
          ...rest,
          startsAt: Timestamp.fromMillis(toMillisSafe(rest.startsAt) || Date.now()),
          endsAt: Timestamp.fromMillis(
            toMillisSafe(rest.endsAt) || Date.now() + 18 * 60 * 60 * 1000
          ),
          updatedAt: serverTimestamp(),
        });
      }
    }
    if (seedBundles) {
      for (const bundle of DEFAULT_BUNDLES) {
        const { id, ...rest } = bundle;
        batch.set(doc(db, 'bundles', id), {
          ...rest,
          updatedAt: serverTimestamp(),
        });
      }
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'seed_promotions');
    }
  };

  const seedDefaultStoreData = async () => {
    const batch = writeBatch(db);
    batch.set(doc(db, 'siteConfig', 'main'), {
      ...DEFAULT_SITE_CONFIG,
      updatedAt: serverTimestamp(),
    });

    for (const cat of DEFAULT_CATEGORIES) {
      const { id, ...rest } = cat;
      batch.set(doc(db, 'categories', id), {
        ...rest,
        updatedAt: serverTimestamp(),
      });
    }

    for (const product of DEFAULT_PRODUCTS) {
      const { id, ...rest } = product;
      batch.set(doc(db, 'products', id), {
        ...rest,
        updatedAt: serverTimestamp(),
      });
    }

    for (const coupon of DEFAULT_COUPONS) {
      const { id, ...rest } = coupon;
      batch.set(doc(db, 'coupons', id), {
        ...rest,
        updatedAt: serverTimestamp(),
      });
    }

    for (const method of DEFAULT_PAYMENT_METHODS) {
      const { id, ...rest } = method;
      batch.set(doc(db, 'paymentMethods', id), {
        ...rest,
        updatedAt: serverTimestamp(),
      });
    }

    const freshDeals = createDefaultFlashDeals(Date.now());
    for (const deal of freshDeals) {
      const { id, ...rest } = deal;
      batch.set(doc(db, 'flashDeals', id), {
        ...rest,
        startsAt: Timestamp.fromMillis(toMillisSafe(rest.startsAt) || Date.now()),
        endsAt: Timestamp.fromMillis(
          toMillisSafe(rest.endsAt) || Date.now() + 18 * 60 * 60 * 1000
        ),
        updatedAt: serverTimestamp(),
      });
    }

    for (const bundle of DEFAULT_BUNDLES) {
      const { id, ...rest } = bundle;
      batch.set(doc(db, 'bundles', id), {
        ...rest,
        updatedAt: serverTimestamp(),
      });
    }

    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'seed_store');
    }
  };

  useEffect(() => {
    if (!authReady || !isAdmin) return;
    if (!catalogSeeded || !walletsSeeded || !categoriesSeeded) {
      void seedDefaultStoreData();
    } else if (!flashDealsSeeded || !bundlesSeeded) {
      void seedPromotionsOnly(!flashDealsSeeded, !bundlesSeeded);
    }
  }, [authReady, isAdmin, catalogSeeded, walletsSeeded, categoriesSeeded, flashDealsSeeded, bundlesSeeded]);

  const updateUserProfile = async (data: { displayName: string; phone: string }) => {
    if (!user) throw new Error('يجب تسجيل الدخول أولاً.');
    const cleanName = data.displayName.trim().slice(0, 80);
    if (!cleanName) throw new Error('يرجى إدخال الاسم.');
    const cleanPhone = data.phone.trim().slice(0, 30);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: cleanName,
        phone: cleanPhone,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const placeOrderWithKnownBalance = async (
    payload: PlaceOrderPayload,
    knownBalance: number
  ): Promise<{ order: OrderRecord; nextBalance: number }> => {
    if (!user) {
      throw new Error('يجب تسجيل الدخول أولاً لإتمام الطلب.');
    }

    const orderId = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const orderNumber =
      payload.orderNumber && /^ZN-[0-9]{5,10}$/.test(payload.orderNumber)
        ? payload.orderNumber
        : generateAutoOrderNumber();
    const rawSubtotal = payload.pkg.price * payload.quantity;
    const discountedSubtotal = Math.max(0, rawSubtotal - payload.discountAmount);
    const feeAmount =
      payload.paymentMethodId === 'site_balance'
        ? 0
        : Number(((discountedSubtotal * payload.feePercent) / 100).toFixed(2));
    const totalAmount = Number((discountedSubtotal + feeAmount).toFixed(2));

    const customerName =
      userProfile?.displayName || user.displayName || user.email?.split('@')[0] || 'عميل المتجر';
    const customerEmail = user.email || userProfile?.email || 'customer@zero-store.com';

    const isSiteBalance = payload.paymentMethodId === 'site_balance';
    if (isSiteBalance && knownBalance < totalAmount) {
      throw new Error('رصيد حسابك بالموقع غير كافٍ لإتمام هذا الطلب.');
    }

    const orderData: Omit<OrderRecord, 'id'> = {
      userId: user.uid,
      customerName: customerName.slice(0, 80),
      customerEmail: customerEmail.slice(0, 120),
      orderNumber,
      productId: payload.product.id,
      productTitle: payload.product.title.slice(0, 80),
      category: payload.product.category,
      packageId: payload.pkg.id,
      packageName: payload.pkg.name.slice(0, 80),
      quantity: payload.quantity,
      unitPrice: payload.pkg.price,
      discountAmount: Number(payload.discountAmount.toFixed(2)),
      couponCode: payload.couponCode.trim().toUpperCase().slice(0, 32),
      feeAmount,
      totalAmount,
      currencySymbol: siteConfig.currencySymbol,
      paymentMethodId: payload.paymentMethodId,
      paymentMethodName: payload.paymentMethodName.slice(0, 60),
      walletSenderPhone: isSiteBalance
        ? 'رصيد الحساب بالموقع'
        : payload.walletSenderPhone.trim().slice(0, 40),
      transactionRef: orderNumber,
      playerId: payload.playerId.trim().slice(0, 64),
      accountEmail: (payload.accountEmail || '').trim().slice(0, 120),
      accountPassword: (payload.accountPassword || '').trim().slice(0, 120),
      accountNotes: (payload.accountNotes || '').trim().slice(0, 200),
      deliveryType: payload.product.deliveryType,
      status: 'pending_payment',
      deliveredCode: '',
      deliveredAccountEmail: '',
      deliveredAccountPassword: '',
      adminNote: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const orderRef = doc(db, 'orders', orderId);
    let nextBalance = knownBalance;

    try {
      if (isSiteBalance) {
        nextBalance = Math.max(0, Number((knownBalance - totalAmount).toFixed(2)));
        const batch = writeBatch(db);
        batch.set(orderRef, orderData);
        batch.update(doc(db, 'users', user.uid), {
          walletBalance: nextBalance,
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
      } else {
        await setDoc(orderRef, orderData);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `orders/${orderId}`);
    }

    return {
      order: {
        id: orderId,
        ...orderData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      nextBalance,
    };
  };

  const placeOrderAndTrack = async (payload: PlaceOrderPayload): Promise<OrderRecord> => {
    const currentBal = userProfile?.walletBalance ?? 0;
    const { order } = await placeOrderWithKnownBalance(payload, currentBal);
    return order;
  };

  const placeCartOrders = async (payload: PlaceCartOrdersPayload): Promise<OrderRecord[]> => {
    if (!user) throw new Error('يجب تسجيل الدخول لإتمام السلة.');
    if (payload.items.length === 0) throw new Error('سلة المشتريات فارغة.');

    const rawTotal = payload.items.reduce(
      (sum, item) => sum + item.pkg.price * item.quantity,
      0
    );

    let runningBalance = userProfile?.walletBalance ?? 0;
    let remainingDiscount = Math.min(rawTotal, payload.totalDiscount);

    if (payload.paymentMethodId === 'site_balance') {
      const grandTotal = Math.max(0, rawTotal - remainingDiscount);
      if (runningBalance < grandTotal) {
        throw new Error('رصيدك بالموقع غير كافٍ لسداد إجمالي السلة.');
      }
    }

    const created: OrderRecord[] = [];
    for (let i = 0; i < payload.items.length; i++) {
      const item = payload.items[i];
      const itemSubtotal = item.pkg.price * item.quantity;
      const isLast = i === payload.items.length - 1;
      const itemDiscount =
        remainingDiscount <= 0
          ? 0
          : isLast
          ? Number(remainingDiscount.toFixed(2))
          : Number(Math.min(itemSubtotal, (itemSubtotal / rawTotal) * payload.totalDiscount).toFixed(2));
      remainingDiscount = Math.max(0, remainingDiscount - itemDiscount);

      const itemOrderNumber =
        i === 0 ? payload.batchOrderNumber : generateAutoOrderNumber();

      const res = await placeOrderWithKnownBalance(
        {
          product: item.product,
          pkg: item.pkg,
          quantity: item.quantity,
          paymentMethodId: payload.paymentMethodId,
          paymentMethodName: payload.paymentMethodName,
          feePercent: payload.feePercent,
          walletSenderPhone: payload.walletSenderPhone,
          orderNumber: itemOrderNumber,
          playerId: item.playerId,
          accountEmail: item.accountEmail,
          accountPassword: item.accountPassword,
          accountNotes: item.accountNotes,
          couponCode: payload.couponCode,
          discountAmount: itemDiscount,
        },
        runningBalance
      );
      runningBalance = res.nextBalance;
      created.push(res.order);
    }

    clearCart();
    return created;
  };

  const requestWalletTopup = async (payload: RequestTopupPayload): Promise<TopupRequest> => {
    if (!user) throw new Error('يجب تسجيل الدخول أولاً لشحن الرصيد.');
    if (payload.amount < 5) throw new Error('الحد الأدنى لشحن الرصيد هو 5.');
    if (payload.walletSenderPhone.trim().length < 4) {
      throw new Error('يرجى إدخال رقم المحفظة المحوّل منها.');
    }

    const topupId = `top_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const referenceCode =
      payload.referenceCode && /^TOP-[0-9]{5,10}$/.test(payload.referenceCode)
        ? payload.referenceCode
        : generateAutoTopupRef();

    const docData: Omit<TopupRequest, 'id'> = {
      userId: user.uid,
      customerName: (
        userProfile?.displayName ||
        user.displayName ||
        user.email?.split('@')[0] ||
        'عميل المتجر'
      ).slice(0, 80),
      customerEmail: (user.email || userProfile?.email || 'customer@zero-store.com').slice(0, 120),
      referenceCode,
      amount: Number(payload.amount.toFixed(2)),
      currencySymbol: siteConfig.currencySymbol,
      paymentMethodId: payload.paymentMethod.id,
      paymentMethodName: payload.paymentMethod.name.slice(0, 60),
      walletSenderPhone: payload.walletSenderPhone.trim().slice(0, 40),
      status: 'pending',
      adminNote: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, 'topupRequests', topupId), docData);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `topupRequests/${topupId}`);
    }

    return {
      id: topupId,
      ...docData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  };

  const approveTopupRequest = async (req: TopupRequest, adminNote?: string) => {
    if (!isAdmin) return;
    if (req.status === 'approved') return;
    try {
      const userRef = doc(db, 'users', req.userId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        throw new Error('تعذر العثور على ملف المستخدم.');
      }
      const userData = userSnap.data() as Partial<UserProfile>;
      const currentBal = typeof userData.walletBalance === 'number' ? userData.walletBalance : 0;
      const nextBal = Number((currentBal + req.amount).toFixed(2));

      const batch = writeBatch(db);
      batch.update(doc(db, 'topupRequests', req.id), {
        status: 'approved',
        adminNote: (adminNote || 'تم تأكيد وصول التحويل وشحن الرصيد').slice(0, 200),
        updatedAt: serverTimestamp(),
      });
      batch.update(userRef, {
        walletBalance: nextBal,
        ...(userData.lastVoucherId === undefined ? { lastVoucherId: '' } : {}),
        updatedAt: serverTimestamp(),
      });

      const notifId = `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      batch.set(doc(db, 'notifications', notifId), {
        targetUserId: req.userId,
        title: `تم شحن رصيدك (+${req.amount} ${req.currencySymbol})`,
        message: `تمت مراجعة وتأكيد عملية الشحن ${req.referenceCode} وإضافة المبلغ لرصيد حسابك بالموقع بنجاح.`,
        notifType: 'order_tracking',
        voucherCode: '',
        orderNumber: req.referenceCode,
        expiresAt: Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: serverTimestamp(),
      });

      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `topupRequests/${req.id}`);
    }
  };

  const rejectTopupRequest = async (req: TopupRequest, adminNote?: string) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'topupRequests', req.id), {
        status: 'rejected',
        adminNote: (adminNote || 'تعذر التحقق من وصول المبلغ').slice(0, 200),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `topupRequests/${req.id}`);
    }
  };

  const redeemVoucherCode = async (
    rawCode: string
  ): Promise<{ message: string; type: VoucherType }> => {
    if (!user) throw new Error('يجب تسجيل الدخول أولاً لاسترداد القسائم.');
    const cleanCode = rawCode.trim().toUpperCase();
    if (cleanCode.length < 3) throw new Error('يرجى إدخال كود القسيمة بشكل صحيح.');

    const match = vouchers.find((v) => v.code.toUpperCase() === cleanCode);
    if (!match) {
      throw new Error('كود القسيمة غير موجود.');
    }
    if (!match.isActive) {
      throw new Error('هذه القسيمة معطلة حالياً.');
    }
    if (toMillisSafe(match.expiresAt) <= Date.now()) {
      throw new Error('انتهت صلاحية هذه القسيمة.');
    }
    if (match.usedCount >= match.maxUses) {
      throw new Error('تم استهلاك الحد الأقصى لاستخدام هذه القسيمة.');
    }

    const redemptionRef = doc(db, 'vouchers', match.id, 'redemptions', user.uid);
    const alreadySnap = await getDoc(redemptionRef);
    if (alreadySnap.exists()) {
      throw new Error('لقد قمت باسترداد هذه القسيمة مسبقاً في حسابك.');
    }

    const batch = writeBatch(db);
    batch.set(redemptionRef, {
      userId: user.uid,
      voucherId: match.id,
      code: match.code,
      redeemedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'vouchers', match.id), {
      usedCount: match.usedCount + 1,
      updatedAt: serverTimestamp(),
    });

    if (match.voucherType === 'balance') {
      const currentBal = userProfile?.walletBalance ?? 0;
      const nextBal = Number((currentBal + match.value).toFixed(2));
      batch.update(doc(db, 'users', user.uid), {
        walletBalance: nextBal,
        lastVoucherId: match.id,
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.set(doc(db, 'users', user.uid, 'savedVouchers', match.id), {
        voucherId: match.id,
        code: match.code,
        title: match.title,
        voucherType: match.voucherType,
        value: match.value,
        minOrderAmount: match.minOrderAmount,
        expiresAt: match.expiresAt,
        savedAt: serverTimestamp(),
      });
    }

    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `vouchers/${match.id}`);
    }

    return {
      type: match.voucherType,
      message:
        match.voucherType === 'balance'
          ? `تم استرداد القسيمة وإضافة ${match.value} ${siteConfig.currencySymbol} إلى رصيدك بنجاح!`
          : `تم حفظ قسيمة الخصم (${match.title}) في حسابك لاستخدامها عند الدفع!`,
    };
  };

  const createVoucher = async (payload: CreateVoucherPayload) => {
    if (!isAdmin) return;
    const cleanCode = payload.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (cleanCode.length < 3) {
      throw new Error('كود القسيمة يجب أن يكون 3 أحرف/أرقام إنجليزية على الأقل.');
    }
    const voucherId = `vch_${cleanCode.toLowerCase()}_${Date.now().toString(36)}`;
    const expiresAt = Timestamp.fromMillis(
      Date.now() + Math.max(5, payload.durationHours * 60) * 60 * 1000
    );

    const batch = writeBatch(db);
    batch.set(doc(db, 'vouchers', voucherId), {
      code: cleanCode,
      title: payload.title.trim().slice(0, 80),
      voucherType: payload.voucherType,
      value: Number(payload.value) || 10,
      minOrderAmount: Number(payload.minOrderAmount) || 0,
      maxUses: Math.max(1, Number(payload.maxUses) || 50),
      usedCount: 0,
      expiresAt,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (payload.alsoBroadcastNotification) {
      const notifId = `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const benefitLabel =
        payload.voucherType === 'balance'
          ? `رصيد مجاني بقيمة ${payload.value} ${siteConfig.currencySymbol}`
          : payload.voucherType === 'discount_percent'
          ? `خصم ${payload.value}% على المنتجات`
          : `خصم فوري ${payload.value} ${siteConfig.currencySymbol}`;
      batch.set(doc(db, 'notifications', notifId), {
        targetUserId: 'all',
        title: `قسيمة هدية جديدة: ${payload.title.trim().slice(0, 60)}`,
        message: `استرد الكود (${cleanCode}) الآن واحصل على ${benefitLabel} قبل انتهاء الوقت المحدد!`,
        notifType: 'voucher',
        voucherCode: cleanCode,
        orderNumber: '',
        expiresAt,
        createdAt: serverTimestamp(),
      });
    }

    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `vouchers/${voucherId}`);
    }
  };

  const toggleVoucherStatus = async (v: Voucher) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'vouchers', v.id), {
        isActive: !v.isActive,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `vouchers/${v.id}`);
    }
  };

  const deleteVoucher = async (id: string) => {
    if (!isAdmin) return;
    try {
      await deleteDoc(doc(db, 'vouchers', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `vouchers/${id}`);
    }
  };

  const sendSiteNotification = async (payload: SendNotificationPayload) => {
    if (!isAdmin) return;
    const notifId = `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const expiresAt = Timestamp.fromMillis(
      Date.now() + Math.max(1, payload.durationMinutes) * 60 * 1000
    );
    try {
      await setDoc(doc(db, 'notifications', notifId), {
        targetUserId: payload.targetUserId.trim() || 'all',
        title: payload.title.trim().slice(0, 100),
        message: payload.message.trim().slice(0, 360),
        notifType: payload.notifType,
        voucherCode: (payload.voucherCode || '').trim().toUpperCase().slice(0, 28),
        orderNumber: (payload.orderNumber || '').trim().slice(0, 20),
        expiresAt,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `notifications/${notifId}`);
    }
  };

  const deleteSiteNotification = async (id: string) => {
    if (!isAdmin) return;
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `notifications/${id}`);
    }
  };

  const publishActivityForOrder = async (order: OrderRecord) => {
    if (!user || !isAdmin) return;
    const actId = `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    try {
      await setDoc(doc(db, 'publicActivity', actId), {
        userId: user.uid,
        displayName: maskBuyerName(order.customerName),
        productTitle: `${order.productTitle} · ${order.packageName}`.slice(0, 80),
        city: 'تم التنفيذ',
        amountLabel: `${order.totalAmount} ${order.currencySymbol}`.slice(0, 30),
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Public activity broadcast warning:', err);
    }
  };

  const submitProductReview = async ({ order, rating, comment }: SubmitReviewPayload) => {
    if (!user) {
      throw new Error('يجب تسجيل الدخول لإضافة تقييم.');
    }
    if (order.status !== 'completed') {
      throw new Error('يمكنك تقييم المنتج بعد اكتمال الطلب فقط.');
    }
    const cleanComment = comment.trim().slice(0, 400);
    if (cleanComment.length < 2) {
      throw new Error('يرجى كتابة تعليق لا يقل عن حرفين.');
    }
    const clampedRating = Math.min(5, Math.max(1, Math.round(rating)));
    const reviewerName = (
      userProfile?.displayName ||
      user.displayName ||
      order.customerName ||
      'عميل المتجر'
    ).slice(0, 60);

    const reviewRef = doc(db, 'reviews', order.id);
    try {
      await setDoc(reviewRef, {
        userId: user.uid,
        customerName: reviewerName,
        productId: order.productId,
        productTitle: order.productTitle.slice(0, 80),
        orderId: order.id,
        rating: clampedRating,
        comment: cleanComment,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `reviews/${order.id}`);
    }
  };

  const deleteProductReview = async (reviewId: string) => {
    try {
      await deleteDoc(doc(db, 'reviews', reviewId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `reviews/${reviewId}`);
    }
  };

  const sendSupportMessage = async (text: string) => {
    if (!user) {
      throw new Error('يرجى تسجيل الدخول أولاً لمراسلة الدعم الفني.');
    }
    const cleanText = text.trim().slice(0, 800);
    if (!cleanText) return;

    const senderName = (
      userProfile?.displayName ||
      user.displayName ||
      user.email?.split('@')[0] ||
      'عميل المتجر'
    ).slice(0, 80);
    const customerEmail = (user.email || userProfile?.email || 'customer@zero-store.com').slice(0, 120);

    const threadRef = doc(db, 'supportThreads', user.uid);
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const msgRef = doc(db, 'supportThreads', user.uid, 'messages', msgId);

    try {
      const existingSnap = await getDoc(threadRef);
      const batch = writeBatch(db);
      if (existingSnap.exists()) {
        batch.update(threadRef, {
          lastMessage: cleanText.slice(0, 300),
          lastSenderRole: 'user',
          unreadByAdmin: true,
          unreadByUser: false,
          status: 'open',
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.set(threadRef, {
          userId: user.uid,
          customerName: senderName,
          customerEmail,
          lastMessage: cleanText.slice(0, 300),
          lastSenderRole: 'user',
          unreadByAdmin: true,
          unreadByUser: false,
          status: 'open',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      batch.set(msgRef, {
        senderId: user.uid,
        senderName,
        senderRole: 'user',
        text: cleanText,
        createdAt: serverTimestamp(),
      });

      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `supportThreads/${user.uid}`);
    }
  };

  const markSupportReadByUser = async () => {
    if (!user || !supportThread || !supportThread.unreadByUser) return;
    try {
      await updateDoc(doc(db, 'supportThreads', user.uid), {
        unreadByUser: false,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `supportThreads/${user.uid}`);
    }
  };

  const sendAdminSupportReply = async (threadId: string, text: string) => {
    if (!user || !isAdmin) return;
    const cleanText = text.trim().slice(0, 800);
    if (!cleanText) return;

    const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const threadRef = doc(db, 'supportThreads', threadId);
    const msgRef = doc(db, 'supportThreads', threadId, 'messages', msgId);

    const batch = writeBatch(db);
    batch.update(threadRef, {
      lastMessage: cleanText.slice(0, 300),
      lastSenderRole: 'admin',
      unreadByAdmin: false,
      unreadByUser: true,
      updatedAt: serverTimestamp(),
    });
    batch.set(msgRef, {
      senderId: user.uid,
      senderName: `فريق دعم ${siteConfig.brandName || 'Zero Store'}`.slice(0, 80),
      senderRole: 'admin',
      text: cleanText,
      createdAt: serverTimestamp(),
    });

    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `supportThreads/${threadId}`);
    }
  };

  const toggleSupportThreadStatus = async (threadId: string, status: 'open' | 'resolved') => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'supportThreads', threadId), {
        status,
        unreadByAdmin: false,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `supportThreads/${threadId}`);
    }
  };

  const markSupportReadByAdmin = async (threadId: string) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'supportThreads', threadId), {
        unreadByAdmin: false,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `supportThreads/${threadId}`);
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <StoreContext.Provider
      value={{
        theme,
        toggleTheme,
        nowMs,
        user,
        authReady,
        userProfile,
        isAdmin,
        siteConfig,
        categories,
        products,
        coupons,
        paymentMethods,
        flashDeals,
        activeFlashDeals,
        bundles,
        activeBundles,
        reviews,
        catalogSeeded,
        walletsSeeded,
        categoriesSeeded,
        flashDealsSeeded,
        bundlesSeeded,
        userOrders,
        allOrders,
        publicActivity,
        supportThread,
        supportMessages,
        allSupportThreads,
        favorites,
        toggleFavorite,
        cart,
        cartOpen,
        setCartOpen,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        userTopups,
        allTopups,
        vouchers,
        savedVouchers,
        activeNotifications,
        allAdminNotifications,
        readNotifIds,
        unreadNotificationsCount,
        markNotificationRead,
        markAllNotificationsRead,
        seedDefaultStoreData,
        updateUserProfile,
        placeOrderAndTrack,
        placeCartOrders,
        requestWalletTopup,
        approveTopupRequest,
        rejectTopupRequest,
        redeemVoucherCode,
        createVoucher,
        toggleVoucherStatus,
        deleteVoucher,
        sendSiteNotification,
        deleteSiteNotification,
        publishActivityForOrder,
        submitProductReview,
        deleteProductReview,
        sendSupportMessage,
        markSupportReadByUser,
        sendAdminSupportReply,
        toggleSupportThreadStatus,
        markSupportReadByAdmin,
        logout,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error('useStore must be used inside StoreProvider');
  }
  return ctx;
}
