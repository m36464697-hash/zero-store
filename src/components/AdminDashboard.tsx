import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  Clock,
  CreditCard,
  Database,
  FileImage,
  FolderTree,
  Headphones,
  Layers,
  LayoutDashboard,
  Package,
  Palette,
  Plus,
  Save,
  Send,
  Shield,
  ShoppingBag,
  Star,
  Tag,
  Ticket,
  Trash2,
  Users,
  Wallet,
  XCircle,
  Zap,
} from 'lucide-react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useStore } from '../context/StoreContext';
import {
  AdminRecord,
  BundleItem,
  Coupon,
  CurrencyCode,
  DeliveryType,
  FlashDeal,
  OrderRecord,
  OrderStatus,
  PaymentMethod,
  Product,
  ProductCategory,
  ProductPackage,
  SiteConfig,
  StoreCategory,
  SupportMessage,
  ValueBundle,
  VoucherType,
} from '../types';
import { GENERATED_IMAGES } from '../data/defaultCatalog';
import { formatOrderDate } from '../utils/invoiceGenerator';
import { ImageUploaderField } from './ImageUploaderField';
import {
  DELIVERY_TYPE_LABELS,
  formatRemainingTime,
  getOrderStatusLabel,
  toMillisSafe,
} from '../utils/deliveryHelpers';

interface AdminDashboardProps {
  onOpenInvoice: (order: OrderRecord) => void;
}

type AdminTab =
  | 'overview'
  | 'orders'
  | 'topups'
  | 'vouchers'
  | 'notifications'
  | 'support'
  | 'reviews'
  | 'categories'
  | 'products'
  | 'flash_deals'
  | 'bundles'
  | 'coupons'
  | 'wallets'
  | 'appearance'
  | 'admins';

function generateAutoCode(deliveryType: DeliveryType): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const block = (len: number) =>
    Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  if (deliveryType === 'direct_id') return `TOPUP-${block(4)}-${block(6)}`;
  if (deliveryType === 'subscription_login') return `SUB-DONE-${block(6)}`;
  if (deliveryType === 'account_delivery') return `ACC-DELIVERED-${block(5)}`;
  return `ZN-${block(4)}-${block(4)}-${block(4)}`;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onOpenInvoice }) => {
  const {
    isAdmin,
    nowMs,
    siteConfig,
    categories,
    products,
    coupons,
    paymentMethods,
    flashDeals,
    bundles,
    reviews,
    allOrders,
    allTopups,
    vouchers,
    allAdminNotifications,
    allSupportThreads,
    catalogSeeded,
    walletsSeeded,
    categoriesSeeded,
    seedDefaultStoreData,
    approveTopupRequest,
    rejectTopupRequest,
    createVoucher,
    toggleVoucherStatus,
    deleteVoucher,
    sendSiteNotification,
    deleteSiteNotification,
    publishActivityForOrder,
    deleteProductReview,
    sendAdminSupportReply,
    toggleSupportThreadStatus,
    markSupportReadByAdmin,
  } = useStore();

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [toastMessage, setToastMessage] = useState('');

  // Orders management state
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | OrderStatus>('all');
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [orderDraftStatus, setOrderDraftStatus] = useState<OrderStatus>('completed');
  const [orderDraftCode, setOrderDraftCode] = useState('');
  const [orderDraftAccEmail, setOrderDraftAccEmail] = useState('');
  const [orderDraftAccPass, setOrderDraftAccPass] = useState('');
  const [orderDraftNote, setOrderDraftNote] = useState('');

  // Vouchers creator state
  const [vCode, setVCode] = useState('');
  const [vTitle, setVTitle] = useState('');
  const [vType, setVType] = useState<VoucherType>('balance');
  const [vValue, setVValue] = useState(50);
  const [vMinOrder, setVMinOrder] = useState(0);
  const [vMaxUses, setVMaxUses] = useState(50);
  const [vDurationHours, setVDurationHours] = useState(24);
  const [vBroadcastNotif, setVBroadcastNotif] = useState(true);

  // Notifications creator state
  const [nTargetUser, setNTargetUser] = useState('all');
  const [nType, setNType] = useState<'news' | 'voucher' | 'order_tracking'>('news');
  const [nTitle, setNTitle] = useState('');
  const [nMessage, setNMessage] = useState('');
  const [nVoucherCode, setNVoucherCode] = useState('');
  const [nOrderNumber, setNOrderNumber] = useState('');
  const [nDurationMinutes, setNDurationMinutes] = useState(1440);

  // Appearance CMS state
  const [configDraft, setConfigDraft] = useState<SiteConfig>(siteConfig);
  const [newFeatureText, setNewFeatureText] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);

  // Category editor state
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catImageUrl, setCatImageUrl] = useState(GENERATED_IMAGES.directTopup);
  const [catSortOrder, setCatSortOrder] = useState(1);
  const [catActive, setCatActive] = useState(true);

  // Product editor state (No preset image select!)
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [prodTitle, setProdTitle] = useState('');
  const [prodSubtitle, setProdSubtitle] = useState('');
  const [prodCategory, setProdCategory] = useState<ProductCategory>(
    categories[0]?.id || 'direct_topup'
  );
  const [prodRegion, setProdRegion] = useState('عالمي');
  const [prodDeliveryType, setProdDeliveryType] = useState<DeliveryType>('direct_id');
  const [prodRequiresId, setProdRequiresId] = useState(true);
  const [prodIdLabel, setProdIdLabel] = useState('معرّف اللاعب (Player ID)');
  const [prodImageUrl, setProdImageUrl] = useState('');
  const [prodAccent, setProdAccent] = useState('#10B981');
  const [prodFeatured, setProdFeatured] = useState(true);
  const [prodActive, setProdActive] = useState(true);
  const [prodSortOrder, setProdSortOrder] = useState(1);
  const [prodPackages, setProdPackages] = useState<ProductPackage[]>([
    { id: 'pkg_1', name: 'باقة أساسية', amount: '100 وحدة', price: 99 },
  ]);

  // Coupon editor state
  const [couponCode, setCouponCode] = useState('');
  const [couponType, setCouponType] = useState<'percent' | 'fixed'>('percent');
  const [couponValue, setCouponValue] = useState(10);
  const [couponMin, setCouponMin] = useState(100);

  // Wallet editor state
  const [editingWalletId, setEditingWalletId] = useState<string | null>(null);
  const [walletName, setWalletName] = useState('');
  const [walletNumber, setWalletNumber] = useState('');
  const [walletHolder, setWalletHolder] = useState('');
  const [walletInstructions, setWalletInstructions] = useState('');
  const [walletFee, setWalletFee] = useState(0);
  const [walletColor, setWalletColor] = useState('#10B981');
  const [walletManual, setWalletManual] = useState(true);
  const [walletActive, setWalletActive] = useState(true);
  const [walletSort, setWalletSort] = useState(1);

  // Admins list
  const [adminsList, setAdminsList] = useState<AdminRecord[]>([]);
  const [newAdminUid, setNewAdminUid] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');

  // Flash Deals editor state
  const [editingFlashId, setEditingFlashId] = useState<string | null>(null);
  const [fdTitle, setFdTitle] = useState('');
  const [fdProductId, setFdProductId] = useState(products[0]?.id || 'pubg_mobile_uc');
  const [fdPackageId, setFdPackageId] = useState(products[0]?.packages[0]?.id || '');
  const [fdOriginalPrice, setFdOriginalPrice] = useState(500);
  const [fdFlashPrice, setFdFlashPrice] = useState(399);
  const [fdDurationHours, setFdDurationHours] = useState(12);
  const [fdMaxStock, setFdMaxStock] = useState(40);
  const [fdClaimedCount, setFdClaimedCount] = useState(0);
  const [fdActive, setFdActive] = useState(true);
  const [fdSortOrder, setFdSortOrder] = useState(1);

  // Value Bundles editor state
  const [editingBundleId, setEditingBundleId] = useState<string | null>(null);
  const [bdTitle, setBdTitle] = useState('');
  const [bdSubtitle, setBdSubtitle] = useState('');
  const [bdBadge, setBdBadge] = useState('توفير خاص');
  const [bdImageUrl, setBdImageUrl] = useState(GENERATED_IMAGES.vipStage);
  const [bdItems, setBdItems] = useState<BundleItem[]>([]);
  const [bdPickProductId, setBdPickProductId] = useState(products[0]?.id || 'pubg_mobile_uc');
  const [bdPickPackageId, setBdPickPackageId] = useState(products[0]?.packages[0]?.id || '');
  const [bdBundlePrice, setBdBundlePrice] = useState(399);
  const [bdAccent, setBdAccent] = useState('#10B981');
  const [bdDeliveryType, setBdDeliveryType] = useState<DeliveryType>('direct_id');
  const [bdRequiresId, setBdRequiresId] = useState(true);
  const [bdIdLabel, setBdIdLabel] = useState('معرّفات اللاعبين المشمولة في البكج');
  const [bdActive, setBdActive] = useState(true);
  const [bdSortOrder, setBdSortOrder] = useState(1);

  // Support inbox state
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<SupportMessage[]>([]);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  useEffect(() => {
    setConfigDraft(siteConfig);
  }, [siteConfig]);

  useEffect(() => {
    if (!isAdmin) return;
    const unsub = onSnapshot(
      collection(db, 'admins'),
      (snap) => {
        setAdminsList(
          snap.docs.map((d) => ({ ...(d.data() as AdminRecord), uid: d.id }))
        );
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'admins')
    );
    return () => unsub();
  }, [isAdmin]);

  useEffect(() => {
    if (allSupportThreads.length > 0 && !allSupportThreads.some((t) => t.id === selectedThreadId)) {
      setSelectedThreadId(allSupportThreads[0].id);
    }
    if (allSupportThreads.length === 0) {
      setSelectedThreadId(null);
      setThreadMessages([]);
    }
  }, [allSupportThreads, selectedThreadId]);

  useEffect(() => {
    if (!isAdmin || !selectedThreadId) {
      setThreadMessages([]);
      return;
    }

    const q = query(
      collection(db, 'supportThreads', selectedThreadId, 'messages'),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setThreadMessages(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SupportMessage, 'id'>) }))
        );
      },
      (error) =>
        handleFirestoreError(
          error,
          OperationType.LIST,
          `supportThreads/${selectedThreadId}/messages`
        )
    );
    return () => unsub();
  }, [isAdmin, selectedThreadId]);

  const activeSupportThread = allSupportThreads.find((t) => t.id === selectedThreadId) || null;
  useEffect(() => {
    if (activeTab === 'support' && activeSupportThread?.unreadByAdmin) {
      void markSupportReadByAdmin(activeSupportThread.id);
    }
  }, [activeTab, activeSupportThread?.id, activeSupportThread?.unreadByAdmin]);

  const notify = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3400);
  };

  const stats = useMemo(() => {
    const completed = allOrders.filter((o) => o.status === 'completed');
    const pending = allOrders.filter(
      (o) => o.status !== 'completed' && o.status !== 'failed'
    );
    const revenue = completed.reduce((acc, o) => acc + o.totalAmount, 0);

    const byCategory = categories.map((cat) => {
      const catRevenue = completed
        .filter((o) => o.category === cat.id)
        .reduce((sum, o) => sum + o.totalAmount, 0);
      return { name: cat.name, revenue: catRevenue };
    });

    return {
      revenue,
      completedCount: completed.length,
      pendingCount: pending.length,
      totalOrders: allOrders.length,
      byCategory,
    };
  }, [allOrders, categories]);

  const filteredOrders = useMemo(() => {
    return allOrders.filter((o) => {
      if (orderStatusFilter !== 'all' && o.status !== orderStatusFilter) return false;
      if (orderSearch.trim()) {
        const q = orderSearch.trim().toLowerCase();
        return (
          o.orderNumber.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.customerEmail.toLowerCase().includes(q) ||
          o.transactionRef.toLowerCase().includes(q) ||
          o.walletSenderPhone.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allOrders, orderStatusFilter, orderSearch]);

  if (!isAdmin) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <Shield className="w-12 h-12 mx-auto text-zinc-400" />
        <h1 className="text-xl font-extrabold text-zinc-900 dark:text-white">
          صلاحية الإدارة مطلوبة
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          هذا القسم مخصص لمشرفي المنصة فقط للتحكم في الواجهة والطلبات وطرق الدفع.
        </p>
      </div>
    );
  }

  // ─── Handlers ─────────────────────────────────────────────────────────
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      const features =
        configDraft.marqueeFeatures && configDraft.marqueeFeatures.length > 0
          ? configDraft.marqueeFeatures.slice(0, 8)
          : [configDraft.promoBannerText || 'مرحباً بكم في ZONE'];
      await setDoc(doc(db, 'siteConfig', 'main'), {
        ...configDraft,
        heroImageUrl: configDraft.heroImageUrl?.trim() || GENERATED_IMAGES.hero,
        logoUrl: configDraft.logoUrl?.trim() || '',
        marqueeFeatures: features,
        updatedAt: serverTimestamp(),
      });
      notify('تم حفظ إعدادات الواجهة والشعار وتطبيقها فوراً.');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'siteConfig/main');
    } finally {
      setSavingConfig(false);
    }
  };

  const notifyCustomerOrderUpdate = async (order: OrderRecord, status: OrderStatus) => {
    const label = getOrderStatusLabel(status, order.deliveryType);
    await sendSiteNotification({
      targetUserId: order.userId,
      title: `تحديث طلبك ${order.orderNumber}`,
      message: `${order.productTitle} (${order.packageName}) — ${label}`,
      notifType: 'order_tracking',
      orderNumber: order.orderNumber,
      durationMinutes: 60 * 24 * 7,
    });
  };

  const handleQuickOrderStage = async (
    order: OrderRecord,
    nextStatus: OrderStatus,
    customCode?: string
  ) => {
    const finalCode =
      nextStatus === 'completed'
        ? (customCode?.trim() || order.deliveredCode || generateAutoCode(order.deliveryType))
        : order.deliveredCode;

    try {
      await updateDoc(doc(db, 'orders', order.id), {
        status: nextStatus,
        deliveredCode: finalCode,
        updatedAt: serverTimestamp(),
      });
      await notifyCustomerOrderUpdate(order, nextStatus);
      if (nextStatus === 'completed' && order.status !== 'completed') {
        await publishActivityForOrder(order);
      }
      notify(`تم تحويل الطلب ${order.orderNumber} إلى ${getOrderStatusLabel(nextStatus, order.deliveryType)}.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${order.id}`);
    }
  };

  const handleOpenEditOrder = (order: OrderRecord) => {
    setEditingOrderId(order.id);
    setOrderDraftStatus(order.status);
    setOrderDraftCode(order.deliveredCode || '');
    setOrderDraftAccEmail(order.deliveredAccountEmail || '');
    setOrderDraftAccPass(order.deliveredAccountPassword || '');
    setOrderDraftNote(order.adminNote || '');
  };

  const handleSaveOrder = async (order: OrderRecord) => {
    const finalCode =
      orderDraftStatus === 'completed' &&
      !orderDraftCode.trim() &&
      order.deliveryType !== 'account_delivery'
        ? generateAutoCode(order.deliveryType)
        : orderDraftCode.trim().slice(0, 160);
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        status: orderDraftStatus,
        deliveredCode: finalCode,
        deliveredAccountEmail: orderDraftAccEmail.trim().slice(0, 120),
        deliveredAccountPassword: orderDraftAccPass.trim().slice(0, 120),
        adminNote: orderDraftNote.trim().slice(0, 200),
        updatedAt: serverTimestamp(),
      });
      await notifyCustomerOrderUpdate(order, orderDraftStatus);
      if (orderDraftStatus === 'completed' && order.status !== 'completed') {
        await publishActivityForOrder(order);
      }
      setEditingOrderId(null);
      notify('تم تحديث حالة الطلب وبيانات التسليم وإشعار العميل.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${order.id}`);
    }
  };

  const handleCreateVoucherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createVoucher({
        code: vCode,
        title: vTitle,
        voucherType: vType,
        value: vValue,
        minOrderAmount: vMinOrder,
        maxUses: vMaxUses,
        durationHours: vDurationHours,
        alsoBroadcastNotification: vBroadcastNotif,
      });
      setVCode('');
      setVTitle('');
      notify(
        vBroadcastNotif
          ? 'تم إنشاء القسيمة وإرسالها تلقائياً في الإشعارات لجميع المستخدمين!'
          : 'تم إنشاء القسيمة بنجاح.'
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : 'تعذر إنشاء القسيمة.');
    }
  };

  const handleSendNotificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await sendSiteNotification({
        targetUserId: nTargetUser.trim() || 'all',
        title: nTitle,
        message: nMessage,
        notifType: nType,
        voucherCode: nVoucherCode,
        orderNumber: nOrderNumber,
        durationMinutes: nDurationMinutes,
      });
      setNTitle('');
      setNMessage('');
      setNVoucherCode('');
      setNOrderNumber('');
      notify('تم إرسال الإشعار المؤقت بنجاح وسيظهر للمستخدمين حتى انتهاء المدة.');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'تعذر إرسال الإشعار.');
    }
  };

  // Category CRUD
  const loadCategoryIntoEditor = (c: StoreCategory) => {
    setEditingCategoryId(c.id);
    setCatName(c.name);
    setCatDesc(c.description);
    setCatImageUrl(c.imageUrl);
    setCatSortOrder(c.sortOrder);
    setCatActive(c.isActive);
  };

  const resetCategoryEditor = () => {
    setEditingCategoryId(null);
    setCatName('');
    setCatDesc('');
    setCatImageUrl(GENERATED_IMAGES.directTopup);
    setCatSortOrder(categories.length + 1);
    setCatActive(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const docId =
      editingCategoryId ||
      `cat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    try {
      await setDoc(doc(db, 'categories', docId), {
        name: catName.trim().slice(0, 60),
        description: catDesc.trim().slice(0, 200),
        imageUrl: catImageUrl.trim() || GENERATED_IMAGES.directTopup,
        sortOrder: Number(catSortOrder) || 1,
        isActive: catActive,
        updatedAt: serverTimestamp(),
      });
      notify(editingCategoryId ? 'تم تحديث القسم بنجاح.' : 'تم إنشاء القسم الجديد.');
      resetCategoryEditor();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `categories/${docId}`);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'categories', id));
      notify('تم حذف القسم.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `categories/${id}`);
    }
  };

  // Product CRUD
  const loadProductIntoEditor = (p: Product) => {
    setEditingProductId(p.id);
    setProdTitle(p.title);
    setProdSubtitle(p.subtitle);
    setProdCategory(p.category);
    setProdRegion(p.region);
    setProdDeliveryType(p.deliveryType);
    setProdRequiresId(p.requiresPlayerId);
    setProdIdLabel(p.playerIdLabel);
    setProdImageUrl(p.imageUrl);
    setProdAccent(p.accentColor);
    setProdFeatured(p.isFeatured);
    setProdActive(p.isActive);
    setProdSortOrder(p.sortOrder);
    setProdPackages(p.packages);
  };

  const resetProductEditor = () => {
    setEditingProductId(null);
    setProdTitle('');
    setProdSubtitle('');
    setProdCategory(categories[0]?.id || 'direct_topup');
    setProdRegion('عالمي');
    setProdDeliveryType('direct_id');
    setProdRequiresId(true);
    setProdIdLabel('معرّف اللاعب (Player ID)');
    setProdImageUrl('');
    setProdAccent('#10B981');
    setProdFeatured(false);
    setProdActive(true);
    setProdSortOrder(products.length + 1);
    setProdPackages([{ id: `pkg_${Date.now()}`, name: 'الباقة الأساسية', amount: '100', price: 100 }]);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodImageUrl.trim()) {
      notify('يرجى إدخال رابط صورة المنتج أو رفع صورة من جهازك.');
      return;
    }
    const docId =
      editingProductId ||
      `prod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    try {
      await setDoc(doc(db, 'products', docId), {
        title: prodTitle.trim(),
        subtitle: prodSubtitle.trim(),
        category: prodCategory,
        region: prodRegion.trim(),
        deliveryType: prodDeliveryType,
        requiresPlayerId: prodRequiresId,
        playerIdLabel: prodRequiresId ? prodIdLabel.trim() : '',
        imageUrl: prodImageUrl.trim(),
        accentColor: prodAccent,
        isFeatured: prodFeatured,
        isActive: prodActive,
        sortOrder: Number(prodSortOrder) || 1,
        packages: prodPackages.slice(0, 12).map((pkg) => ({
          id: pkg.id,
          name: pkg.name,
          amount: pkg.amount,
          price: Number(pkg.price) || 0,
          ...(pkg.originalPrice ? { originalPrice: Number(pkg.originalPrice) } : {}),
        })),
        updatedAt: serverTimestamp(),
      });
      notify(editingProductId ? 'تم تحديث المنتج بنجاح.' : 'تمت إضافة المنتج الجديد.');
      resetProductEditor();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `products/${docId}`);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'products', id));
      notify('تم حذف المنتج.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `products/${id}`);
    }
  };

  // Coupons CRUD
  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = couponCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (cleanCode.length < 2) {
      notify('يجب أن يحتوي كود الخصم على حرفين إنجليزيين أو أرقام على الأقل.');
      return;
    }
    const docId = cleanCode.toLowerCase();
    try {
      await setDoc(doc(db, 'coupons', docId), {
        code: cleanCode,
        discountType: couponType,
        discountValue: Number(couponValue) || 10,
        minOrderAmount: Number(couponMin) || 0,
        isActive: true,
        updatedAt: serverTimestamp(),
      });
      setCouponCode('');
      notify(`تم إنشاء كود الخصم ${cleanCode} بنجاح.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `coupons/${docId}`);
    }
  };

  const handleToggleCoupon = async (c: Coupon) => {
    try {
      await updateDoc(doc(db, 'coupons', c.id), {
        isActive: !c.isActive,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `coupons/${c.id}`);
    }
  };

  const handleDeleteCoupon = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'coupons', id));
      notify('تم حذف كود الخصم.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `coupons/${id}`);
    }
  };

  // Wallet CRUD
  const loadWalletIntoEditor = (w: PaymentMethod) => {
    setEditingWalletId(w.id);
    setWalletName(w.name);
    setWalletNumber(w.walletNumber);
    setWalletHolder(w.accountHolder);
    setWalletInstructions(w.instructions);
    setWalletFee(w.feePercent);
    setWalletColor(w.accentColor);
    setWalletManual(w.requiresManualReview);
    setWalletActive(w.isActive);
    setWalletSort(w.sortOrder);
  };

  const resetWalletEditor = () => {
    setEditingWalletId(null);
    setWalletName('');
    setWalletNumber('');
    setWalletHolder('');
    setWalletInstructions('');
    setWalletFee(0);
    setWalletColor('#10B981');
    setWalletManual(true);
    setWalletActive(true);
    setWalletSort(paymentMethods.length + 1);
  };

  const handleSaveWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    const docId =
      editingWalletId ||
      `wallet_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    try {
      await setDoc(doc(db, 'paymentMethods', docId), {
        name: walletName.trim(),
        walletNumber: walletNumber.trim(),
        accountHolder: walletHolder.trim(),
        instructions: walletInstructions.trim(),
        feePercent: Number(walletFee) || 0,
        accentColor: walletColor,
        requiresManualReview: walletManual,
        isActive: walletActive,
        sortOrder: Number(walletSort) || 1,
        updatedAt: serverTimestamp(),
      });
      notify(editingWalletId ? 'تم تحديث بيانات المحفظة.' : 'تمت إضافة المحفظة الإلكترونية.');
      resetWalletEditor();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `paymentMethods/${docId}`);
    }
  };

  const handleDeleteWallet = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'paymentMethods', id));
      notify('تم حذف طريقة الدفع.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `paymentMethods/${id}`);
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUid = newAdminUid.trim();
    if (!cleanUid) return;
    try {
      await setDoc(doc(db, 'admins', cleanUid), {
        uid: cleanUid,
        email: newAdminEmail.trim(),
        grantedAt: serverTimestamp(),
      });
      setNewAdminUid('');
      setNewAdminEmail('');
      notify('تم منح صلاحية الإدارة بنجاح.');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `admins/${cleanUid}`);
    }
  };

  const handleRemoveAdmin = async (uid: string) => {
    try {
      await deleteDoc(doc(db, 'admins', uid));
      notify('تم سحب صلاحية المشرف.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `admins/${uid}`);
    }
  };

  const handleSendAdminReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedThreadId || !replyText.trim() || sendingReply) return;
    setSendingReply(true);
    try {
      await sendAdminSupportReply(selectedThreadId, replyText);
      setReplyText('');
    } finally {
      setSendingReply(false);
    }
  };

  const unreadSupportCount = allSupportThreads.filter((t) => t.unreadByAdmin).length;
  const pendingTopupsCount = allTopups.filter((t) => t.status === 'pending').length;

  const navTabs: Array<{ id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'overview', label: 'نظرة عامة والتحليلات', icon: LayoutDashboard },
    { id: 'orders', label: `إدارة الطلبات (${stats.pendingCount})`, icon: ShoppingBag },
    { id: 'topups', label: `شحن الأرصدة (${pendingTopupsCount})`, icon: Wallet },
    { id: 'vouchers', label: `القسائم (${vouchers.length})`, icon: Ticket },
    { id: 'notifications', label: 'الإشعارات المؤقتة', icon: Bell },
    {
      id: 'support',
      label: unreadSupportCount > 0 ? `رسائل الدعم (${unreadSupportCount} جديد)` : 'رسائل الدعم الفني',
      icon: Headphones,
    },
    { id: 'reviews', label: `تقييمات المنتجات (${reviews.length})`, icon: Star },
    { id: 'categories', label: 'إدارة الأقسام', icon: FolderTree },
    { id: 'products', label: 'المنتجات والباقات', icon: Package },
    { id: 'flash_deals', label: `عروض الفلاش (${flashDeals.length})`, icon: Zap },
    { id: 'bundles', label: `بكجات التوفير (${bundles.length})`, icon: Layers },
    { id: 'coupons', label: 'أكواد الخصم', icon: Tag },
    { id: 'wallets', label: 'المحافظ الإلكترونية', icon: CreditCard },
    { id: 'appearance', label: 'تخصيص الواجهة والشعار', icon: Palette },
    { id: 'admins', label: 'صلاحيات المشرفين', icon: Users },
  ];

  // Flash Deal CRUD Handlers
  const loadFlashDealIntoEditor = (d: FlashDeal) => {
    setEditingFlashId(d.id);
    setFdTitle(d.title);
    setFdProductId(d.productId);
    setFdPackageId(d.packageId);
    setFdOriginalPrice(d.originalPrice);
    setFdFlashPrice(d.flashPrice);
    const remHours = Math.max(1, Math.round((toMillisSafe(d.endsAt) - Date.now()) / 3600000));
    setFdDurationHours(remHours);
    setFdMaxStock(d.maxStock);
    setFdClaimedCount(d.claimedCount);
    setFdActive(d.isActive);
    setFdSortOrder(d.sortOrder);
  };

  const resetFlashDealEditor = () => {
    const firstProd = products[0];
    const firstPkg = firstProd?.packages[0];
    setEditingFlashId(null);
    setFdTitle('');
    setFdProductId(firstProd?.id || '');
    setFdPackageId(firstPkg?.id || '');
    setFdOriginalPrice(firstPkg?.originalPrice || firstPkg?.price || 100);
    setFdFlashPrice(Math.max(1, Math.round((firstPkg?.price || 100) * 0.8)));
    setFdDurationHours(12);
    setFdMaxStock(40);
    setFdClaimedCount(0);
    setFdActive(true);
    setFdSortOrder(flashDeals.length + 1);
  };

  const handleSaveFlashDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    const matchedProd = products.find((p) => p.id === fdProductId) || products[0];
    if (!matchedProd) {
      notify('يرجى إضافة منتج واحد على الأقل أولاً.');
      return;
    }
    const matchedPkg =
      matchedProd.packages.find((pk) => pk.id === fdPackageId) || matchedProd.packages[0];
    if (!matchedPkg) {
      notify('المنتج المختار لا يحتوي على باقات.');
      return;
    }
    const docId =
      editingFlashId || `flash_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = Date.now();
    try {
      await setDoc(doc(db, 'flashDeals', docId), {
        title: (fdTitle.trim() || `عرض فلاش: ${matchedProd.title}`).slice(0, 80),
        productId: matchedProd.id,
        productTitle: matchedProd.title.slice(0, 80),
        packageId: matchedPkg.id,
        packageName: matchedPkg.name.slice(0, 80),
        imageUrl: matchedProd.imageUrl,
        originalPrice: Math.max(1, Number(fdOriginalPrice) || matchedPkg.price),
        flashPrice: Math.max(1, Number(fdFlashPrice) || Math.round(matchedPkg.price * 0.8)),
        startsAt: Timestamp.fromMillis(now - 60000),
        endsAt: Timestamp.fromMillis(now + Math.max(1, Number(fdDurationHours) || 12) * 3600000),
        maxStock: Math.max(1, Number(fdMaxStock) || 40),
        claimedCount: Math.max(0, Number(fdClaimedCount) || 0),
        isActive: fdActive,
        sortOrder: Number(fdSortOrder) || 1,
        updatedAt: serverTimestamp(),
      });
      notify(editingFlashId ? 'تم تحديث عرض الفلاش بنجاح.' : 'تم إطلاق عرض الفلاش الجديد!');
      resetFlashDealEditor();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `flashDeals/${docId}`);
    }
  };

  const handleDeleteFlashDeal = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'flashDeals', id));
      notify('تم حذف عرض الفلاش.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `flashDeals/${id}`);
    }
  };

  // Value Bundle CRUD Handlers
  const loadBundleIntoEditor = (b: ValueBundle) => {
    setEditingBundleId(b.id);
    setBdTitle(b.title);
    setBdSubtitle(b.subtitle);
    setBdBadge(b.badge);
    setBdImageUrl(b.imageUrl);
    setBdItems(b.items);
    setBdBundlePrice(b.bundlePrice);
    setBdAccent(b.accentColor);
    setBdDeliveryType(b.deliveryType);
    setBdRequiresId(b.requiresPlayerId);
    setBdIdLabel(b.playerIdLabel);
    setBdActive(b.isActive);
    setBdSortOrder(b.sortOrder);
  };

  const resetBundleEditor = () => {
    setEditingBundleId(null);
    setBdTitle('');
    setBdSubtitle('');
    setBdBadge('توفير خاص');
    setBdImageUrl(GENERATED_IMAGES.vipStage);
    setBdItems([]);
    setBdBundlePrice(399);
    setBdAccent('#10B981');
    setBdDeliveryType('direct_id');
    setBdRequiresId(true);
    setBdIdLabel('معرّفات اللاعبين المشمولة في البكج');
    setBdActive(true);
    setBdSortOrder(bundles.length + 1);
  };

  const handleAddBundleItem = () => {
    if (bdItems.length >= 6) {
      notify('الحد الأقصى لعناصر البكج هو 6 منتجات.');
      return;
    }
    const prod = products.find((p) => p.id === bdPickProductId) || products[0];
    if (!prod) return;
    const pkg = prod.packages.find((pk) => pk.id === bdPickPackageId) || prod.packages[0];
    if (!pkg) return;

    const nextItems: BundleItem[] = [
      ...bdItems,
      {
        productId: prod.id,
        productTitle: prod.title.slice(0, 80),
        packageId: pkg.id,
        packageName: pkg.name.slice(0, 80),
        originalPrice: pkg.price,
      },
    ];
    setBdItems(nextItems);
    const totalOrig = nextItems.reduce((s, it) => s + it.originalPrice, 0);
    setBdBundlePrice(Math.max(1, Math.round(totalOrig * 0.82)));
  };

  const handleSaveBundle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bdItems.length === 0) {
      notify('يرجى إضافة منتج واحد على الأقل داخل البكج.');
      return;
    }
    if (!bdImageUrl.trim()) {
      notify('يرجى اختيار أو رفع صورة للبكج.');
      return;
    }
    const originalTotalPrice = Math.max(
      1,
      bdItems.reduce((s, it) => s + it.originalPrice, 0)
    );
    const docId =
      editingBundleId || `bundle_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    try {
      await setDoc(doc(db, 'bundles', docId), {
        title: bdTitle.trim().slice(0, 80),
        subtitle: bdSubtitle.trim().slice(0, 160),
        badge: bdBadge.trim().slice(0, 40),
        imageUrl: bdImageUrl.trim(),
        items: bdItems.slice(0, 6),
        originalTotalPrice,
        bundlePrice: Math.max(1, Number(bdBundlePrice) || originalTotalPrice),
        accentColor: bdAccent,
        deliveryType: bdDeliveryType,
        requiresPlayerId: bdRequiresId,
        playerIdLabel: bdRequiresId ? bdIdLabel.trim().slice(0, 60) : '',
        isActive: bdActive,
        sortOrder: Number(bdSortOrder) || 1,
        updatedAt: serverTimestamp(),
      });
      notify(editingBundleId ? 'تم تحديث بكج التوفير بنجاح.' : 'تم إنشاء بكج التوفير الجديد!');
      resetBundleEditor();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `bundles/${docId}`);
    }
  };

  const handleDeleteBundle = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'bundles', id));
      notify('تم حذف بكج التوفير.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `bundles/${id}`);
    }
  };

  const maxCatRevenue = Math.max(1, ...stats.byCategory.map((c) => c.revenue));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-white">
            مركز التحكم وإدارة منصة {siteConfig.brandName}
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            التحكم المباشر في التحقق من التحويلات المالية، تعديل حالات الطلبات، إدارة الأقسام، وتخصيص كل صور ومظهر الموقع
          </p>
        </div>

        <button
          type="button"
          onClick={async () => {
            await seedDefaultStoreData();
            notify('تمت مزامنة الأقسام والمنتجات والكوبونات والمحافظ إلى قاعدة البيانات.');
          }}
          className="h-10 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-[#11151B] hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2 shrink-0 cursor-pointer"
        >
          <Database className="w-4 h-4" />
          <span>
            {catalogSeeded && walletsSeeded && categoriesSeeded
              ? 'إعادة مزامنة البيانات الأساسية'
              : 'تهيئة قاعدة البيانات الآن'}
          </span>
        </button>
      </div>

      {toastMessage && (
        <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Sidebar */}
        <aside className="lg:col-span-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] p-2.5 space-y-1">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2.5 transition-colors cursor-pointer ${
                  active
                    ? 'bg-zinc-900 dark:bg-zinc-800 text-white'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900/60 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </aside>

        {/* Main Viewport */}
        <main className="lg:col-span-9 space-y-6">
          {/* 1. OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {[
                  {
                    label: 'إجمالي المبيعات المؤكدة',
                    value: `${stats.revenue.toFixed(2)} ${siteConfig.currencySymbol}`,
                  },
                  { label: 'الطلبات المكتملة', value: String(stats.completedCount) },
                  { label: 'بانتظار مراجعة التحويل', value: String(stats.pendingCount) },
                  { label: 'الأقسام / المنتجات', value: `${categories.length} / ${products.length}` },
                ].map((kpi) => (
                  <div
                    key={kpi.label}
                    className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] p-5"
                  >
                    <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                      {kpi.label}
                    </p>
                    <p className="text-2xl font-extrabold font-mono-tabular text-zinc-900 dark:text-white mt-2">
                      {kpi.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Category Revenue Breakdown Chart */}
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] p-6 space-y-4">
                <h2 className="text-sm font-extrabold text-zinc-900 dark:text-white">
                  توزيع المبيعات حسب الأقسام
                </h2>
                <div className="space-y-3">
                  {stats.byCategory.map((item) => {
                    const pct = Math.round((item.revenue / maxCatRevenue) * 100);
                    return (
                      <div key={item.name} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-bold text-zinc-700 dark:text-zinc-300">
                            {item.name}
                          </span>
                          <span className="font-mono-tabular font-bold text-zinc-900 dark:text-white">
                            {item.revenue.toFixed(2)} {siteConfig.currencySymbol}
                          </span>
                        </div>
                        <div className="h-2.5 rounded-full bg-zinc-100 dark:bg-zinc-900 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.max(item.revenue > 0 ? 6 : 0, pct)}%`,
                              backgroundColor: siteConfig.primaryAccentColor || '#10B981',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] overflow-hidden">
                <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                    أحدث الطلبات الواردة للمراجعة
                  </h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab('orders')}
                    className="text-xs font-bold text-emerald-600 dark:text-emerald-400 cursor-pointer"
                  >
                    إدارة ومراجعة كافة الطلبات &larr;
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-zinc-50 dark:bg-zinc-900/60 text-zinc-500 dark:text-zinc-400">
                      <tr>
                        <th className="py-3 px-4 font-semibold">رقم الطلب</th>
                        <th className="py-3 px-4 font-semibold">العميل</th>
                        <th className="py-3 px-4 font-semibold">المحفظة والمرجع</th>
                        <th className="py-3 px-4 font-semibold">المبلغ</th>
                        <th className="py-3 px-4 font-semibold">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                      {allOrders.slice(0, 8).map((ord) => (
                        <tr key={ord.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-900/30">
                          <td className="py-3 px-4 font-mono-tabular font-bold text-zinc-900 dark:text-white">
                            {ord.orderNumber}
                          </td>
                          <td className="py-3 px-4 text-zinc-700 dark:text-zinc-300">
                            {ord.customerName}
                          </td>
                          <td className="py-3 px-4 font-mono-tabular text-zinc-500 dark:text-zinc-400">
                            {ord.walletSenderPhone} · {ord.transactionRef}
                          </td>
                          <td className="py-3 px-4 font-mono-tabular font-bold text-zinc-900 dark:text-white">
                            {ord.totalAmount} {ord.currencySymbol}
                          </td>
                          <td className="py-3 px-4 font-semibold text-emerald-600 dark:text-emerald-400">
                            {ord.status}
                          </td>
                        </tr>
                      ))}
                      {allOrders.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-zinc-500">
                            لا توجد طلبات مسجلة حتى الآن.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 2. ORDERS MANAGER (FULL ADMIN CONTROL OVER TRACKING & PAYMENT VERIFICATION) */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] p-4 flex flex-col sm:flex-row gap-3 justify-between">
                <input
                  type="text"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="بحث برقم الطلب، رقم محفظة العميل، أو مرجع التحويل..."
                  className="h-10 flex-1 px-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
                <select
                  value={orderStatusFilter}
                  onChange={(e) => setOrderStatusFilter(e.target.value as 'all' | OrderStatus)}
                  className="h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white"
                >
                  <option value="all">كل الحالات</option>
                  <option value="pending_payment">بانتظار مراجعة التحويل</option>
                  <option value="verifying">تم تأكيد استلام المبلغ</option>
                  <option value="processing">جاري التنفيذ</option>
                  <option value="completed">مكتمل</option>
                  <option value="failed">مرفوض</option>
                </select>
              </div>

              <div className="space-y-3">
                {filteredOrders.map((ord) => {
                  const isEditing = editingOrderId === ord.id;
                  return (
                    <div
                      key={ord.id}
                      className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] p-5 space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                            <span className="font-mono-tabular font-bold text-zinc-900 dark:text-white">
                              {ord.orderNumber}
                            </span>
                            <span>·</span>
                            <span>{formatOrderDate(ord.createdAt)}</span>
                            <span>·</span>
                            <span>{ord.customerName} ({ord.customerEmail})</span>
                            <span>·</span>
                            <span className="font-bold text-emerald-500">
                              {DELIVERY_TYPE_LABELS[ord.deliveryType]?.short}
                            </span>
                          </div>
                          <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white">
                            {ord.productTitle} — {ord.packageName} × {ord.quantity}
                          </h3>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            الدفع: <strong className="text-zinc-800 dark:text-zinc-200">{ord.paymentMethodName}</strong> · المرسل: <span className="font-mono-tabular font-bold text-zinc-900 dark:text-white">{ord.walletSenderPhone}</span> · المرجع: <span className="font-mono-tabular font-bold text-emerald-600 dark:text-emerald-400">{ord.transactionRef}</span>
                            {ord.playerId ? ` · Player ID: ${ord.playerId}` : ''}
                          </p>
                          {ord.deliveryType === 'subscription_login' && ord.accountEmail && (
                            <div className="mt-2 p-2.5 rounded-xl border border-sky-500/30 bg-sky-500/5 text-xs space-y-0.5">
                              <p className="font-bold text-sky-600 dark:text-sky-300">
                                بيانات حساب العميل لتفعيل الاشتراك (يُرجى الخروج فور التفعيل):
                              </p>
                              <p className="font-mono-tabular text-zinc-900 dark:text-white">
                                البريد/المستخدم: <strong>{ord.accountEmail}</strong> · كلمة المرور:{' '}
                                <strong>{ord.accountPassword}</strong>
                              </p>
                              {ord.accountNotes && (
                                <p className="text-zinc-500">ملاحظة العميل: {ord.accountNotes}</p>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <span className="font-mono-tabular font-extrabold text-sm text-emerald-600 dark:text-emerald-400 ml-2">
                            {ord.totalAmount} {ord.currencySymbol}
                          </span>
                          <button
                            type="button"
                            onClick={() => onOpenInvoice(ord)}
                            className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-200 flex items-center gap-1.5 cursor-pointer"
                          >
                            <FileImage className="w-3.5 h-3.5" />
                            <span>الفاتورة</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              isEditing ? setEditingOrderId(null) : handleOpenEditOrder(ord)
                            }
                            className="h-9 px-3 rounded-lg bg-zinc-900 dark:bg-zinc-800 text-white text-xs font-bold cursor-pointer"
                          >
                            {isEditing ? 'إغلاق' : 'تعديل التسليم والحالة'}
                          </button>
                        </div>
                      </div>

                      {/* Quick 1-Click Tracking Stage Progression for Admin */}
                      <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800/80">
                        <span className="text-[11px] font-bold text-zinc-500 ml-1">
                          تحكم سريع بالتتبع:
                        </span>
                        <button
                          type="button"
                          onClick={() => handleQuickOrderStage(ord, 'verifying')}
                          className={`h-8 px-3 rounded-lg text-[11px] font-bold border cursor-pointer ${
                            ord.status === 'verifying'
                              ? 'border-sky-500 bg-sky-500/15 text-sky-600 dark:text-sky-300'
                              : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300'
                          }`}
                        >
                          1. تأكيد المبلغ / الدخول
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickOrderStage(ord, 'processing')}
                          className={`h-8 px-3 rounded-lg text-[11px] font-bold border cursor-pointer ${
                            ord.status === 'processing'
                              ? 'border-amber-500 bg-amber-500/15 text-amber-600 dark:text-amber-300'
                              : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300'
                          }`}
                        >
                          2. قيد التنفيذ
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickOrderStage(ord, 'completed')}
                          className={`h-8 px-3 rounded-lg text-[11px] font-bold border cursor-pointer ${
                            ord.status === 'completed'
                              ? 'border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                              : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300'
                          }`}
                        >
                          3. اكتمال وتسليم
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickOrderStage(ord, 'failed')}
                          className={`h-8 px-3 rounded-lg text-[11px] font-bold border flex items-center gap-1 cursor-pointer ${
                            ord.status === 'failed'
                              ? 'border-rose-500 bg-rose-500/15 text-rose-600 dark:text-rose-300'
                              : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300'
                          }`}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>رفض</span>
                        </button>
                      </div>

                      {isEditing && (
                        <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-[11px] font-bold text-zinc-500 mb-1">
                                الحالة
                              </label>
                              <select
                                value={orderDraftStatus}
                                onChange={(e) => setOrderDraftStatus(e.target.value as OrderStatus)}
                                className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white"
                              >
                                <option value="pending_payment">بانتظار مراجعة التحويل</option>
                                <option value="verifying">تم تأكيد الدفع / الدخول</option>
                                <option value="processing">جاري التجهيز</option>
                                <option value="completed">مكتمل — تم التسليم</option>
                                <option value="failed">مرفوض</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-zinc-500 mb-1">
                                الكود الرقمي / مرجع التأكيد
                              </label>
                              <input
                                type="text"
                                value={orderDraftCode}
                                onChange={(e) => setOrderDraftCode(e.target.value)}
                                placeholder="اتركه فارغاً للتوليد التلقائي"
                                className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-xs font-mono-tabular text-zinc-900 dark:text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-zinc-500 mb-1">
                                ملاحظة للعميل
                              </label>
                              <input
                                type="text"
                                value={orderDraftNote}
                                onChange={(e) => setOrderDraftNote(e.target.value)}
                                placeholder="ملاحظة اختيارية"
                                className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white"
                              />
                            </div>
                          </div>

                          {ord.deliveryType === 'account_delivery' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
                              <div>
                                <label className="block text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mb-1">
                                  بريد / اسم المستخدم للحساب المسلم
                                </label>
                                <input
                                  type="text"
                                  value={orderDraftAccEmail}
                                  onChange={(e) => setOrderDraftAccEmail(e.target.value)}
                                  placeholder="account@example.com"
                                  className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-mono-tabular text-zinc-900 dark:text-white"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mb-1">
                                  كلمة مرور الحساب المسلم
                                </label>
                                <input
                                  type="text"
                                  value={orderDraftAccPass}
                                  onChange={(e) => setOrderDraftAccPass(e.target.value)}
                                  placeholder="كلمة مرور الحساب"
                                  className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-mono-tabular text-zinc-900 dark:text-white"
                                />
                              </div>
                            </div>
                          )}

                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleSaveOrder(ord)}
                              className="h-10 px-5 rounded-xl bg-emerald-600 text-white text-xs font-bold cursor-pointer"
                            >
                              حفظ التغييرات وإشعار العميل
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2A. WALLET TOPUPS MANAGEMENT */}
          {activeTab === 'topups' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] p-5">
                <h2 className="text-base font-extrabold text-zinc-900 dark:text-white">
                  طلبات شحن الرصيد بالموقع ({allTopups.length})
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  تأكد من وصول التحويل على محفظتك ثم اضغط «تأكيد وشحن الرصيد» لإضافة المبلغ فوراً إلى رصيد العميل.
                </p>
              </div>

              {allTopups.length === 0 ? (
                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] p-12 text-center text-xs text-zinc-500">
                  لا توجد طلبات شحن رصيد حالياً.
                </div>
              ) : (
                <div className="space-y-3">
                  {allTopups.map((t) => (
                    <div
                      key={t.id}
                      className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                          <span className="font-mono-tabular font-bold text-zinc-900 dark:text-white">
                            {t.referenceCode}
                          </span>
                          <span>·</span>
                          <span>{formatOrderDate(t.createdAt)}</span>
                          <span>·</span>
                          <span>{t.customerName} ({t.customerEmail})</span>
                        </div>
                        <p className="text-sm font-extrabold text-zinc-900 dark:text-white">
                          طلب شحن بمبلغ{' '}
                          <span className="font-mono-tabular text-emerald-500">
                            {t.amount} {t.currencySymbol}
                          </span>{' '}
                          عبر {t.paymentMethodName}
                        </p>
                        <p className="text-xs text-zinc-500">
                          رقم محفظة المرسل: <strong className="font-mono-tabular text-zinc-900 dark:text-white">{t.walletSenderPhone}</strong>
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {t.status === 'pending' ? (
                          <>
                            <button
                              type="button"
                              onClick={async () => {
                                await approveTopupRequest(t);
                                notify(`تمت إضافة ${t.amount} ${t.currencySymbol} لرصيد العميل ${t.customerName}.`);
                              }}
                              className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                            >
                              تأكيد وشحن الرصيد
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await rejectTopupRequest(t);
                                notify('تم رفض طلب شحن الرصيد.');
                              }}
                              className="h-9 px-3 rounded-xl border border-rose-500/40 text-rose-500 text-xs font-bold cursor-pointer"
                            >
                              رفض
                            </button>
                          </>
                        ) : (
                          <span
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                              t.status === 'approved'
                                ? 'bg-emerald-500/15 text-emerald-500'
                                : 'bg-rose-500/15 text-rose-500'
                            }`}
                          >
                            {t.status === 'approved' ? 'تمت الإضافة' : 'مرفوض'}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 2B. VOUCHERS & GIFT REWARDS MANAGER */}
          {activeTab === 'vouchers' && (
            <div className="space-y-6">
              <form
                onSubmit={handleCreateVoucherSubmit}
                className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] p-6 space-y-4"
              >
                <h2 className="text-base font-extrabold text-zinc-900 dark:text-white">
                  إنشاء قسيمة (رصيد بالموقع أو خصم على المنتجات)
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                      كود القسيمة (إنجليزي)
                    </label>
                    <input
                      type="text"
                      required
                      value={vCode}
                      onChange={(e) => setVCode(e.target.value.toUpperCase())}
                      placeholder="GIFT50"
                      className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-mono-tabular text-zinc-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                      اسم القسيمة
                    </label>
                    <input
                      type="text"
                      required
                      value={vTitle}
                      onChange={(e) => setVTitle(e.target.value)}
                      placeholder="هدية رصيد مجاني للعملاء"
                      className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                      نوع القسيمة
                    </label>
                    <select
                      value={vType}
                      onChange={(e) => setVType(e.target.value as VoucherType)}
                      className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white"
                    >
                      <option value="balance">شحن رصيد داخل الموقع ({siteConfig.currencySymbol})</option>
                      <option value="discount_percent">خصم نسبة مئوية على المنتجات (%)</option>
                      <option value="discount_fixed">خصم مبلغ ثابت على المنتجات ({siteConfig.currencySymbol})</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                      القيمة
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={vValue}
                      onChange={(e) => setVValue(Number(e.target.value))}
                      className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-mono-tabular text-zinc-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                      أقصى عدد مستخدمين
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={vMaxUses}
                      onChange={(e) => setVMaxUses(Number(e.target.value))}
                      className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-mono-tabular text-zinc-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                      مدة صلاحية القسيمة والإشعار (بالساعات)
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={vDurationHours}
                      onChange={(e) => setVDurationHours(Number(e.target.value))}
                      className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-mono-tabular text-zinc-900 dark:text-white"
                    />
                  </div>
                  {vType !== 'balance' && (
                    <div>
                      <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                        الحد الأدنى للطلب (للخصم)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={vMinOrder}
                        onChange={(e) => setVMinOrder(Number(e.target.value))}
                        className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-mono-tabular text-zinc-900 dark:text-white"
                      />
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={vBroadcastNotif}
                      onChange={(e) => setVBroadcastNotif(e.target.checked)}
                    />
                    <span>إرسال القسيمة تلقائياً في شريط الإشعارات بالرأس (تختفي تلقائياً بانتهاء المدة)</span>
                  </label>
                  <button
                    type="submit"
                    className="h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
                  >
                    <Ticket className="w-4 h-4" />
                    <span>إنشاء ونشر القسيمة</span>
                  </button>
                </div>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {vouchers.map((v) => (
                  <div
                    key={v.id}
                    className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] p-4 flex items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono-tabular font-black text-sm text-emerald-500">
                          {v.code}
                        </span>
                        <span className="text-[11px] font-bold text-zinc-500">
                          ({v.usedCount}/{v.maxUses})
                        </span>
                      </div>
                      <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                        {v.title} —{' '}
                        {v.voucherType === 'balance'
                          ? `رصيد ${v.value} ${siteConfig.currencySymbol}`
                          : v.voucherType === 'discount_percent'
                          ? `خصم ${v.value}%`
                          : `خصم ${v.value} ${siteConfig.currencySymbol}`}
                      </p>
                      <p className="text-[11px] text-zinc-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>متبقي: {formatRemainingTime(v.expiresAt, nowMs)}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleVoucherStatus(v)}
                        className={`h-8 px-3 rounded-lg text-xs font-bold cursor-pointer ${
                          v.isActive
                            ? 'bg-emerald-500/15 text-emerald-500'
                            : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'
                        }`}
                      >
                        {v.isActive ? 'نشطة' : 'معطلة'}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteVoucher(v.id)}
                        className="h-8 w-8 rounded-lg text-rose-500 hover:bg-rose-500/10 flex items-center justify-center cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2C. TIMED NOTIFICATIONS BROADCAST MANAGER */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <form
                onSubmit={handleSendNotificationSubmit}
                className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] p-6 space-y-4"
              >
                <h2 className="text-base font-extrabold text-zinc-900 dark:text-white">
                  إرسال إشعار مؤقت (أخبار الموقع / قسيمة / تتبع طلب)
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                      نوع الإشعار
                    </label>
                    <select
                      value={nType}
                      onChange={(e) =>
                        setNType(e.target.value as 'news' | 'voucher' | 'order_tracking')
                      }
                      className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white"
                    >
                      <option value="news">آخر الأخبار والتحديثات</option>
                      <option value="voucher">قسيمة هدية / خصم</option>
                      <option value="order_tracking">تحديث تتبع طلب</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                      الجمهور المستهدف (all أو UID العميل)
                    </label>
                    <input
                      type="text"
                      value={nTargetUser}
                      onChange={(e) => setNTargetUser(e.target.value)}
                      placeholder="all للجميع"
                      className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-mono-tabular text-zinc-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                      مدة الظهور قبل الاختفاء التلقائي (بالدقائق)
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={nDurationMinutes}
                      onChange={(e) => setNDurationMinutes(Number(e.target.value))}
                      className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-mono-tabular text-zinc-900 dark:text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                      عنوان الإشعار
                    </label>
                    <input
                      type="text"
                      required
                      value={nTitle}
                      onChange={(e) => setNTitle(e.target.value)}
                      placeholder="مثال: تحديث جديد ومكافآت فورية في Zero Store"
                      className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                      كود القسيمة المرفق (اختياري)
                    </label>
                    <input
                      type="text"
                      value={nVoucherCode}
                      onChange={(e) => setNVoucherCode(e.target.value.toUpperCase())}
                      placeholder="GIFT50"
                      className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-mono-tabular text-zinc-900 dark:text-white"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                      نص الإشعار
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={nMessage}
                      onChange={(e) => setNMessage(e.target.value)}
                      placeholder="اكتب محتوى الإشعار أو تفاصيل العرض..."
                      className="w-full p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>إرسال الإشعار المؤقت الآن</span>
                </button>
              </form>

              <div className="space-y-3">
                {allAdminNotifications.map((n) => (
                  <div
                    key={n.id}
                    className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] p-4 flex items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-extrabold text-zinc-900 dark:text-white">
                          {n.title}
                        </span>
                        <span className="text-[10px] font-mono-tabular px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                          {n.targetUserId === 'all' ? 'عام للجميع' : n.targetUserId}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                        {n.message}
                      </p>
                      <p className="text-[11px] text-amber-500">
                        المتبقي للاختفاء: {formatRemainingTime(n.expiresAt, nowMs)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteSiteNotification(n.id)}
                      className="h-8 w-8 rounded-lg text-rose-500 hover:bg-rose-500/10 flex items-center justify-center shrink-0 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2B. SUPPORT INBOX & LIVE REPLY */}
          {activeTab === 'support' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Customer Threads List */}
              <div className="lg:col-span-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] overflow-hidden flex flex-col max-h-[600px]">
                <div className="px-4 py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                  <h2 className="text-sm font-extrabold text-zinc-900 dark:text-white">
                    محادثات العملاء ({allSupportThreads.length})
                  </h2>
                  {unreadSupportCount > 0 && (
                    <span className="text-[11px] font-bold text-rose-500">
                      {unreadSupportCount} غير مقروءة
                    </span>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/80">
                  {allSupportThreads.length === 0 ? (
                    <div className="p-8 text-center text-xs text-zinc-500">
                      لا توجد رسائل دعم فني من العملاء حتى الآن.
                    </div>
                  ) : (
                    allSupportThreads.map((thread) => {
                      const active = thread.id === selectedThreadId;
                      return (
                        <button
                          key={thread.id}
                          type="button"
                          onClick={() => setSelectedThreadId(thread.id)}
                          className={`w-full p-3.5 text-right transition-colors cursor-pointer flex flex-col gap-1 ${
                            active
                              ? 'bg-emerald-500/10'
                              : 'hover:bg-zinc-50 dark:hover:bg-zinc-900/50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-extrabold text-zinc-900 dark:text-white truncate">
                              {thread.customerName}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {thread.unreadByAdmin && (
                                <span className="w-2 h-2 rounded-full bg-rose-500" />
                              )}
                              <span
                                className={`text-[10px] font-bold ${
                                  thread.status === 'resolved'
                                    ? 'text-zinc-400'
                                    : 'text-emerald-500'
                                }`}
                              >
                                {thread.status === 'resolved' ? 'مغلقة' : 'مفتوحة'}
                              </span>
                            </div>
                          </div>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                            {thread.lastMessage}
                          </p>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Active Thread Messages & Reply Box */}
              <div className="lg:col-span-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] overflow-hidden flex flex-col h-[560px]">
                {activeSupportThread ? (
                  <>
                    <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white truncate">
                          {activeSupportThread.customerName}
                        </h3>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                          {activeSupportThread.customerEmail}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          toggleSupportThreadStatus(
                            activeSupportThread.id,
                            activeSupportThread.status === 'open' ? 'resolved' : 'open'
                          )
                        }
                        className="h-8 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-200 shrink-0 cursor-pointer"
                      >
                        {activeSupportThread.status === 'open'
                          ? 'إغلاق التذكرة'
                          : 'إعادة فتح التذكرة'}
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-zinc-50/70 dark:bg-[#0B0E14]">
                      {threadMessages.map((msg) => {
                        const isAdminMsg = msg.senderRole === 'admin';
                        return (
                          <div
                            key={msg.id}
                            className={`flex flex-col ${isAdminMsg ? 'items-start' : 'items-end'}`}
                          >
                            <div
                              className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                                isAdminMsg
                                  ? 'bg-emerald-600 text-white rounded-br-sm'
                                  : 'bg-white dark:bg-[#161B23] border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-bl-sm'
                              }`}
                            >
                              <p className="text-[10px] font-bold opacity-80 mb-0.5">
                                {msg.senderName}
                              </p>
                              <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <form
                      onSubmit={handleSendAdminReply}
                      className="p-3.5 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-2"
                    >
                      <input
                        type="text"
                        maxLength={800}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="اكتب رد الإدارة للعميل..."
                        className="flex-1 h-10 px-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500"
                      />
                      <button
                        type="submit"
                        disabled={sendingReply || !replyText.trim()}
                        className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 disabled:opacity-50 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>إرسال الرد</span>
                      </button>
                    </form>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-xs text-zinc-500">
                    <Headphones className="w-8 h-8 mb-2 opacity-40" />
                    <p>اختر محادثة من القائمة لعرض الرسائل والرد على العميل فوراً.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2C. VERIFIED REVIEWS MODERATION */}
          {activeTab === 'reviews' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] p-5 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-extrabold text-zinc-900 dark:text-white">
                    تقييمات وآراء المشترين ({reviews.length})
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    تقييمات حقيقية موثقة أضافها العملاء بعد اكتمال طلباتهم بنجاح.
                  </p>
                </div>
              </div>

              {reviews.length === 0 ? (
                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] p-12 text-center text-xs text-zinc-500">
                  لا توجد تقييمات مسجلة حتى الآن.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {reviews.map((rev) => (
                    <div
                      key={rev.id}
                      className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] p-4 flex items-start justify-between gap-3"
                    >
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-zinc-900 dark:text-white truncate">
                            {rev.customerName}
                          </span>
                          <span className="text-xs font-mono-tabular font-bold text-amber-500">
                            ★ {rev.rating}/5
                          </span>
                        </div>
                        <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                          المنتج: {rev.productTitle}
                        </p>
                        <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                          «{rev.comment}»
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await deleteProductReview(rev.id);
                          notify('تم حذف التقييم.');
                        }}
                        title="حذف التقييم"
                        className="h-8 w-8 rounded-lg text-rose-500 hover:bg-rose-500/10 flex items-center justify-center shrink-0 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 3. CATEGORIES MANAGEMENT (TITLE & DESCRIPTION ONLY, ZERO IMAGES) */}
          {activeTab === 'categories' && (
            <div className="space-y-6">
              <form
                onSubmit={handleSaveCategory}
                className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] p-6 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-extrabold text-zinc-900 dark:text-white">
                    {editingCategoryId ? 'تعديل عنوان ووصف القسم' : 'إنشاء قسم جديد (عناوين فقط)'}
                  </h2>
                  {editingCategoryId && (
                    <button
                      type="button"
                      onClick={resetCategoryEditor}
                      className="text-xs font-bold text-zinc-500 cursor-pointer"
                    >
                      قسم جديد
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                      اسم القسم
                    </label>
                    <input
                      type="text"
                      required
                      value={catName}
                      onChange={(e) => setCatName(e.target.value)}
                      placeholder="مثال: بطاقات أمازون وأيتونز"
                      className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                      ترتيب الظهور
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={catSortOrder}
                      onChange={(e) => setCatSortOrder(Number(e.target.value))}
                      className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-mono-tabular text-zinc-900 dark:text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                      وصف القسم
                    </label>
                    <input
                      type="text"
                      required
                      value={catDesc}
                      onChange={(e) => setCatDesc(e.target.value)}
                      placeholder="وصف مختصر يظهر أسفل عنوان القسم..."
                      className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={catActive}
                      onChange={(e) => setCatActive(e.target.checked)}
                    />
                    <span>إظهار القسم في المتجر</span>
                  </label>
                  <button
                    type="submit"
                    className="h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>{editingCategoryId ? 'حفظ التعديلات' : 'إضافة القسم'}</span>
                  </button>
                </div>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {categories.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] p-4 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-zinc-900 dark:text-white truncate">
                        {c.name}
                      </h3>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                        الترتيب: {c.sortOrder} · {c.isActive ? 'نشط' : 'مخفي'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => loadCategoryIntoEditor(c)}
                        className="h-8 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-200 cursor-pointer"
                      >
                        تعديل
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(c.id)}
                        className="h-8 w-8 rounded-lg text-rose-500 hover:bg-rose-500/10 flex items-center justify-center cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. PRODUCTS & PACKAGES CMS (NO PRESET IMAGE DROPDOWN) */}
          {activeTab === 'products' && (
            <div className="space-y-6">
              <form
                onSubmit={handleSaveProduct}
                className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] p-6 space-y-5"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-extrabold text-zinc-900 dark:text-white">
                    {editingProductId ? 'تعديل المنتج وصورته' : 'إضافة منتج أو لعبة جديدة'}
                  </h2>
                  {editingProductId && (
                    <button
                      type="button"
                      onClick={resetProductEditor}
                      className="text-xs font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                    >
                      إنشاء منتج جديد
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                      اسم المنتج / اللعبة
                    </label>
                    <input
                      type="text"
                      required
                      value={prodTitle}
                      onChange={(e) => setProdTitle(e.target.value)}
                      placeholder="مثال: PUBG Mobile UC"
                      className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                      الوصف المختصر
                    </label>
                    <input
                      type="text"
                      required
                      value={prodSubtitle}
                      onChange={(e) => setProdSubtitle(e.target.value)}
                      placeholder="شحن فوري بالمعرّف"
                      className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                      القسم
                    </label>
                    <select
                      value={prodCategory}
                      onChange={(e) => setProdCategory(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                      المنطقة (Region)
                    </label>
                    <input
                      type="text"
                      required
                      value={prodRegion}
                      onChange={(e) => setProdRegion(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                      نوع التسليم والتتبع
                    </label>
                    <select
                      value={prodDeliveryType}
                      onChange={(e) => {
                        const val = e.target.value as DeliveryType;
                        setProdDeliveryType(val);
                        setProdRequiresId(val === 'direct_id');
                      }}
                      className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white"
                    >
                      <option value="direct_id">شحن مباشر لـ Player ID</option>
                      <option value="voucher_code">كود بطاقة رقمي</option>
                      <option value="subscription_login">اشتراك (يُطلب حساب العميل للتفعيل ثم الخروج)</option>
                      <option value="account_delivery">تسليم كحساب جاهز (بريد وكلمة مرور)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                      تسمية حقل المعرّف (عند الشحن المباشر)
                    </label>
                    <input
                      type="text"
                      value={prodIdLabel}
                      onChange={(e) => setProdIdLabel(e.target.value)}
                      disabled={!prodRequiresId}
                      className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white disabled:opacity-50"
                    />
                  </div>

                  {/* Direct Product Image Upload & URL Input (Maximum Upload Quality) */}
                  <div className="sm:col-span-2 lg:col-span-3">
                    <ImageUploaderField
                      label="صورة المنتج بأعلى جودة ممكنة — أبعاد مربعة 1:1 (مثال: 1000×1000 بكسل)"
                      value={prodImageUrl}
                      onChange={setProdImageUrl}
                      maxDimension={1600}
                      maxBytes={780000}
                    />
                  </div>
                </div>

                {/* Packages Builder */}
                <div className="space-y-2.5 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                      الباقات والأسعار ({prodPackages.length}/12)
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        prodPackages.length < 12 &&
                        setProdPackages((prev) => [
                          ...prev,
                          {
                            id: `pkg_${Date.now()}`,
                            name: 'باقة جديدة',
                            amount: '500',
                            price: 250,
                          },
                        ])
                      }
                      className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>إضافة باقة</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {prodPackages.map((pkg, idx) => (
                      <div key={pkg.id} className="grid grid-cols-12 gap-2 items-center">
                        <input
                          type="text"
                          value={pkg.name}
                          onChange={(e) => {
                            const copy = [...prodPackages];
                            copy[idx] = { ...copy[idx], name: e.target.value };
                            setProdPackages(copy);
                          }}
                          placeholder="اسم الباقة"
                          className="col-span-4 h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white"
                        />
                        <input
                          type="text"
                          value={pkg.amount}
                          onChange={(e) => {
                            const copy = [...prodPackages];
                            copy[idx] = { ...copy[idx], amount: e.target.value };
                            setProdPackages(copy);
                          }}
                          placeholder="الكمية"
                          className="col-span-4 h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white"
                        />
                        <input
                          type="number"
                          value={pkg.price}
                          onChange={(e) => {
                            const copy = [...prodPackages];
                            copy[idx] = { ...copy[idx], price: Number(e.target.value) };
                            setProdPackages(copy);
                          }}
                          placeholder="السعر"
                          className="col-span-3 h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-mono-tabular text-zinc-900 dark:text-white"
                        />
                        <button
                          type="button"
                          disabled={prodPackages.length <= 1}
                          onClick={() =>
                            setProdPackages((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="col-span-1 h-9 rounded-lg flex items-center justify-center text-rose-500 hover:bg-rose-500/10 disabled:opacity-30 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                  <div className="flex flex-wrap items-center gap-5">
                    <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={prodActive}
                        onChange={(e) => setProdActive(e.target.checked)}
                      />
                      <span>نشط ومتاح في المتجر</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={prodFeatured}
                        onChange={(e) => setProdFeatured(e.target.checked)}
                      />
                      <span>إبراز في الشريط الإعلاني المتحرك بالواجهة</span>
                    </label>
                  </div>
                  <button
                    type="submit"
                    className="h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>{editingProductId ? 'حفظ التعديلات' : 'إضافة المنتج'}</span>
                  </button>
                </div>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {products.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] p-4 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={p.imageUrl}
                        alt={p.title}
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-xl object-cover shrink-0 border border-zinc-200 dark:border-zinc-800"
                      />
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-zinc-900 dark:text-white truncate">
                          {p.title}
                        </h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {p.packages.length} باقات · {p.isActive ? 'نشط' : 'مخفي'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => loadProductIntoEditor(p)}
                        className="h-8 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-200 cursor-pointer"
                      >
                        تعديل
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteProduct(p.id)}
                        className="h-8 w-8 rounded-lg text-rose-500 hover:bg-rose-500/10 flex items-center justify-center cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4B. FLASH DEALS MANAGER */}
          {activeTab === 'flash_deals' && (
            <div className="space-y-6">
              <form
                onSubmit={handleSaveFlashDeal}
                className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] p-6 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-extrabold text-zinc-900 dark:text-white flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <span>{editingFlashId ? 'تعديل عرض الفلاش' : 'إطلاق عرض فلاش جديد'}</span>
                  </h2>
                  {editingFlashId && (
                    <button
                      type="button"
                      onClick={resetFlashDealEditor}
                      className="text-xs font-bold text-zinc-500 cursor-pointer"
                    >
                      عرض فلاش جديد
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                      عنوان العرض
                    </label>
                    <input
                      type="text"
                      required
                      value={fdTitle}
                      onChange={(e) => setFdTitle(e.target.value)}
                      placeholder="مثال: خصم خاطف — باقة 660 شدة ببجي"
                      className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                      المنتج المرتبط
                    </label>
                    <select
                      value={fdProductId}
                      onChange={(e) => {
                        const nextProd = products.find((p) => p.id === e.target.value);
                        setFdProductId(e.target.value);
                        const firstPkg = nextProd?.packages[0];
                        if (firstPkg) {
                          setFdPackageId(firstPkg.id);
                          setFdOriginalPrice(firstPkg.originalPrice || firstPkg.price);
                          setFdFlashPrice(Math.max(1, Math.round(firstPkg.price * 0.8)));
                        }
                      }}
                      className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                      الباقة المشمولة
                    </label>
                    <select
                      value={fdPackageId}
                      onChange={(e) => {
                        const prod = products.find((p) => p.id === fdProductId);
                        const pkg = prod?.packages.find((pk) => pk.id === e.target.value);
                        setFdPackageId(e.target.value);
                        if (pkg) {
                          setFdOriginalPrice(pkg.originalPrice || pkg.price);
                          setFdFlashPrice(Math.max(1, Math.round(pkg.price * 0.8)));
                        }
                      }}
                      className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white"
                    >
                      {(products.find((p) => p.id === fdProductId)?.packages || []).map((pk) => (
                        <option key={pk.id} value={pk.id}>
                          {pk.name} ({pk.price} {siteConfig.currencySymbol})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                      مدة العرض (بالساعات)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={720}
                      value={fdDurationHours}
                      onChange={(e) => setFdDurationHours(Number(e.target.value))}
                      className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-mono-tabular text-zinc-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                      السعر الأصلي قبل الخصم ({siteConfig.currencySymbol})
                    </label>
                    <input
                      type="number"
                      min={1}
                      step="0.01"
                      value={fdOriginalPrice}
                      onChange={(e) => setFdOriginalPrice(Number(e.target.value))}
                      className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-mono-tabular text-zinc-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                      سعر الفلاش المخفض ({siteConfig.currencySymbol})
                    </label>
                    <input
                      type="number"
                      min={1}
                      step="0.01"
                      value={fdFlashPrice}
                      onChange={(e) => setFdFlashPrice(Number(e.target.value))}
                      className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-mono-tabular text-zinc-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                      الكمية القصوى للعرض
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={fdMaxStock}
                      onChange={(e) => setFdMaxStock(Number(e.target.value))}
                      className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-mono-tabular text-zinc-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fdActive}
                      onChange={(e) => setFdActive(e.target.checked)}
                    />
                    <span>تفعيل العرض الآن بالمتجر</span>
                  </label>

                  <button
                    type="submit"
                    className="h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>{editingFlashId ? 'حفظ تعديلات العرض' : 'إطلاق عرض الفلاش'}</span>
                  </button>
                </div>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {flashDeals.map((d) => {
                  const expired = toMillisSafe(d.endsAt) <= nowMs;
                  return (
                    <div
                      key={d.id}
                      className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] p-4 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={d.imageUrl}
                          alt={d.title}
                          referrerPolicy="no-referrer"
                          className="w-12 h-12 rounded-xl object-cover shrink-0 border border-zinc-200 dark:border-zinc-800"
                        />
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-zinc-900 dark:text-white truncate">
                            {d.title}
                          </h3>
                          <p className="text-xs font-mono-tabular text-emerald-500 font-bold">
                            {d.flashPrice} {siteConfig.currencySymbol}{' '}
                            <span className="line-through text-zinc-400 font-normal">
                              {d.originalPrice}
                            </span>
                          </p>
                          <p className="text-[11px] text-zinc-500">
                            {expired
                              ? 'منتهي الصلاحية'
                              : `متبقي: ${formatRemainingTime(d.endsAt, nowMs)}`}{' '}
                            · {d.claimedCount}/{d.maxStock}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => loadFlashDealIntoEditor(d)}
                          className="h-8 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-200 cursor-pointer"
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteFlashDeal(d.id)}
                          className="h-8 w-8 rounded-lg text-rose-500 hover:bg-rose-500/10 flex items-center justify-center cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4C. VALUE BUNDLES MANAGER */}
          {activeTab === 'bundles' && (
            <div className="space-y-6">
              <form
                onSubmit={handleSaveBundle}
                className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] p-6 space-y-5"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-extrabold text-zinc-900 dark:text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-500" />
                    <span>{editingBundleId ? 'تعديل بكج التوفير' : 'إنشاء بكج توفير جديد'}</span>
                  </h2>
                  {editingBundleId && (
                    <button
                      type="button"
                      onClick={resetBundleEditor}
                      className="text-xs font-bold text-zinc-500 cursor-pointer"
                    >
                      بكج جديد
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                      عنوان البكج
                    </label>
                    <input
                      type="text"
                      required
                      value={bdTitle}
                      onChange={(e) => setBdTitle(e.target.value)}
                      placeholder="مثال: بكج التوفير الملكي للألعاب"
                      className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                      الشارة (Badge)
                    </label>
                    <input
                      type="text"
                      value={bdBadge}
                      onChange={(e) => setBdBadge(e.target.value)}
                      placeholder="وفر 125 ج.م"
                      className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                      سعر البكج النهائي ({siteConfig.currencySymbol})
                    </label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={bdBundlePrice}
                      onChange={(e) => setBdBundlePrice(Number(e.target.value))}
                      className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-mono-tabular text-zinc-900 dark:text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                      وصف البكج
                    </label>
                    <input
                      type="text"
                      required
                      value={bdSubtitle}
                      onChange={(e) => setBdSubtitle(e.target.value)}
                      placeholder="وصف مختصر لما يشمله البكج ومقدار التوفير..."
                      className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                      نوع تنفيذ البكج
                    </label>
                    <select
                      value={bdDeliveryType}
                      onChange={(e) => {
                        const val = e.target.value as DeliveryType;
                        setBdDeliveryType(val);
                        setBdRequiresId(val === 'direct_id');
                      }}
                      className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white"
                    >
                      <option value="direct_id">شحن مباشر لـ Player ID</option>
                      <option value="voucher_code">أكواد رقمية</option>
                      <option value="subscription_login">تفعيل اشتراك</option>
                      <option value="account_delivery">تسليم كحساب</option>
                    </select>
                  </div>

                  {bdRequiresId && (
                    <div className="sm:col-span-2 lg:col-span-3">
                      <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                        تسمية حقل المعرّفات للعميل
                      </label>
                      <input
                        type="text"
                        value={bdIdLabel}
                        onChange={(e) => setBdIdLabel(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white"
                      />
                    </div>
                  )}

                  <div className="sm:col-span-2 lg:col-span-3">
                    <ImageUploaderField
                      label="صورة البكج الترويجية"
                      value={bdImageUrl}
                      onChange={setBdImageUrl}
                      maxDimension={1200}
                      maxBytes={600000}
                    />
                  </div>
                </div>

                {/* Bundle Items Builder */}
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0B0E14] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-zinc-900 dark:text-white">
                      عناصر البكج المشمولة ({bdItems.length}/6) — المجموع الأصلي:{' '}
                      <span className="font-mono-tabular text-emerald-500">
                        {bdItems.reduce((s, it) => s + it.originalPrice, 0)} {siteConfig.currencySymbol}
                      </span>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <select
                      value={bdPickProductId}
                      onChange={(e) => {
                        const prod = products.find((p) => p.id === e.target.value);
                        setBdPickProductId(e.target.value);
                        setBdPickPackageId(prod?.packages[0]?.id || '');
                      }}
                      className="sm:col-span-5 h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                    <select
                      value={bdPickPackageId}
                      onChange={(e) => setBdPickPackageId(e.target.value)}
                      className="sm:col-span-5 h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white"
                    >
                      {(products.find((p) => p.id === bdPickProductId)?.packages || []).map((pk) => (
                        <option key={pk.id} value={pk.id}>
                          {pk.name} ({pk.price} {siteConfig.currencySymbol})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAddBundleItem}
                      className="sm:col-span-2 h-10 px-3 rounded-xl bg-zinc-900 dark:bg-zinc-800 text-white text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>إضافة</span>
                    </button>
                  </div>

                  {bdItems.length > 0 && (
                    <div className="space-y-1.5">
                      {bdItems.map((it, idx) => (
                        <div
                          key={`${it.productId}-${idx}`}
                          className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white dark:bg-[#11151B] border border-zinc-200 dark:border-zinc-800 text-xs"
                        >
                          <span className="font-bold text-zinc-900 dark:text-white truncate">
                            {it.productTitle} — {it.packageName}
                          </span>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="font-mono-tabular text-zinc-500">
                              {it.originalPrice} {siteConfig.currencySymbol}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setBdItems((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="text-rose-500 hover:bg-rose-500/10 p-1 rounded cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bdActive}
                      onChange={(e) => setBdActive(e.target.checked)}
                    />
                    <span>إظهار البكج في الواجهة الرئيسية</span>
                  </label>
                  <button
                    type="submit"
                    className="h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>{editingBundleId ? 'حفظ البكج' : 'نشر بكج التوفير'}</span>
                  </button>
                </div>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {bundles.map((b) => (
                  <div
                    key={b.id}
                    className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] p-4 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={b.imageUrl}
                        alt={b.title}
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-xl object-cover shrink-0 border border-zinc-200 dark:border-zinc-800"
                      />
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-zinc-900 dark:text-white truncate">
                          {b.title}
                        </h3>
                        <p className="text-xs font-mono-tabular text-emerald-500 font-bold">
                          {b.bundlePrice} {siteConfig.currencySymbol}{' '}
                          <span className="line-through text-zinc-400 font-normal">
                            {b.originalTotalPrice}
                          </span>{' '}
                          · {b.items.length} عناصر
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => loadBundleIntoEditor(b)}
                        className="h-8 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-200 cursor-pointer"
                      >
                        تعديل
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteBundle(b.id)}
                        className="h-8 w-8 rounded-lg text-rose-500 hover:bg-rose-500/10 flex items-center justify-center cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. COUPONS MANAGER */}
          {activeTab === 'coupons' && (
            <div className="space-y-6">
              <form
                onSubmit={handleSaveCoupon}
                className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] p-6 space-y-4"
              >
                <h2 className="text-base font-extrabold text-zinc-900 dark:text-white">
                  إنشاء كود خصم ترويجي
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <input
                    type="text"
                    required
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="الكود (مثل: ZONE20)"
                    className="h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-mono-tabular text-zinc-900 dark:text-white"
                  />
                  <select
                    value={couponType}
                    onChange={(e) => setCouponType(e.target.value as 'percent' | 'fixed')}
                    className="h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white"
                  >
                    <option value="percent">نسبة مئوية (%)</option>
                    <option value="fixed">مبلغ ثابت ({siteConfig.currencySymbol})</option>
                  </select>
                  <input
                    type="number"
                    required
                    min={1}
                    value={couponValue}
                    onChange={(e) => setCouponValue(Number(e.target.value))}
                    placeholder="قيمة الخصم"
                    className="h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-mono-tabular text-zinc-900 dark:text-white"
                  />
                  <input
                    type="number"
                    min={0}
                    value={couponMin}
                    onChange={(e) => setCouponMin(Number(e.target.value))}
                    placeholder="الحد الأدنى للطلب"
                    className="h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-mono-tabular text-zinc-900 dark:text-white"
                  />
                </div>
                <button
                  type="submit"
                  className="h-10 px-5 rounded-xl bg-emerald-600 text-white text-xs font-bold cursor-pointer"
                >
                  حفظ كود الخصم
                </button>
              </form>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {coupons.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] p-4 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-mono-tabular font-extrabold text-sm text-zinc-900 dark:text-white">
                        {c.code}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        خصم{' '}
                        {c.discountType === 'percent'
                          ? `${c.discountValue}%`
                          : `${c.discountValue} ${siteConfig.currencySymbol}`}{' '}
                        · حد أدنى {c.minOrderAmount}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleCoupon(c)}
                        className={`h-8 px-3 rounded-lg text-xs font-bold cursor-pointer ${
                          c.isActive
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'
                        }`}
                      >
                        {c.isActive ? 'مفعّل' : 'معطّل'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCoupon(c.id)}
                        className="h-8 w-8 rounded-lg text-rose-500 hover:bg-rose-500/10 flex items-center justify-center cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 6. ELECTRONIC WALLETS MANAGER */}
          {activeTab === 'wallets' && (
            <div className="space-y-6">
              <form
                onSubmit={handleSaveWallet}
                className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] p-6 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-extrabold text-zinc-900 dark:text-white">
                    {editingWalletId ? 'تعديل المحفظة الإلكترونية' : 'إضافة محفظة إلكترونية'}
                  </h2>
                  {editingWalletId && (
                    <button
                      type="button"
                      onClick={resetWalletEditor}
                      className="text-xs font-bold text-zinc-500 cursor-pointer"
                    >
                      محفظة جديدة
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                      اسم المحفظة
                    </label>
                    <input
                      type="text"
                      required
                      value={walletName}
                      onChange={(e) => setWalletName(e.target.value)}
                      placeholder="مثال: فودافون كاش / STC Pay"
                      className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                      رقم المحفظة / عنوان التحويل
                    </label>
                    <input
                      type="text"
                      required
                      value={walletNumber}
                      onChange={(e) => setWalletNumber(e.target.value)}
                      placeholder="010xxxxxxxx"
                      className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-mono-tabular text-zinc-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                      اسم المستلم المسجل
                    </label>
                    <input
                      type="text"
                      required
                      value={walletHolder}
                      onChange={(e) => setWalletHolder(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                      نسبة الرسوم (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={25}
                      step="0.5"
                      value={walletFee}
                      onChange={(e) => setWalletFee(Number(e.target.value))}
                      className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-mono-tabular text-zinc-900 dark:text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                      تعليمات التحويل للعميل
                    </label>
                    <input
                      type="text"
                      required
                      value={walletInstructions}
                      onChange={(e) => setWalletInstructions(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={walletActive}
                      onChange={(e) => setWalletActive(e.target.checked)}
                    />
                    <span>تفعيل المحفظة في صفحة الدفع</span>
                  </label>

                  <button
                    type="submit"
                    className="h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>{editingWalletId ? 'حفظ المحفظة' : 'إضافة المحفظة'}</span>
                  </button>
                </div>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {paymentMethods.map((w) => (
                  <div
                    key={w.id}
                    className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] p-4 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-zinc-900 dark:text-white truncate">
                        {w.name}
                      </h3>
                      <p className="text-xs font-mono-tabular text-zinc-500 dark:text-zinc-400">
                        {w.walletNumber} · رسوم {w.feePercent}% · {w.isActive ? 'مفعّلة' : 'معطّلة'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => loadWalletIntoEditor(w)}
                        className="h-8 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-200 cursor-pointer"
                      >
                        تعديل
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteWallet(w.id)}
                        className="h-8 w-8 rounded-lg text-rose-500 hover:bg-rose-500/10 flex items-center justify-center cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 7. FULL UI, LOGO & TOP MARQUEE FEATURES CUSTOMIZER */}
          {activeTab === 'appearance' && (
            <form
              onSubmit={handleSaveConfig}
              className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] p-6 space-y-5"
            >
              <h2 className="text-base font-extrabold text-zinc-900 dark:text-white">
                تخصيص واجهة الموقع، الشعار، والشريط العلوي
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                    اسم المنصة (للفواتير والعنوان)
                  </label>
                  <input
                    type="text"
                    required
                    value={configDraft.brandName}
                    onChange={(e) => setConfigDraft({ ...configDraft, brandName: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                    اللون الرئيسي للموقع (Accent)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={configDraft.primaryAccentColor}
                      onChange={(e) =>
                        setConfigDraft({ ...configDraft, primaryAccentColor: e.target.value })
                      }
                      className="h-10 w-14 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent cursor-pointer"
                    />
                    {['#10B981', '#F59E0B', '#3B82F6', '#E11D48'].map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => setConfigDraft({ ...configDraft, primaryAccentColor: hex })}
                        className="w-7 h-7 rounded-lg border border-white/20 cursor-pointer"
                        style={{ backgroundColor: hex }}
                        aria-label={`اختيار اللون ${hex}`}
                      />
                    ))}
                  </div>
                </div>

                {/* Custom Logo Uploader */}
                <div className="sm:col-span-2">
                  <ImageUploaderField
                    label="شعار الموقع (اتركه فارغاً لاستخدام شعار Zero Store المعتمد بدون خلفية)"
                    value={configDraft.logoUrl || ''}
                    onChange={(val) => setConfigDraft({ ...configDraft, logoUrl: val })}
                    maxDimension={900}
                    maxBytes={240000}
                    allowClear
                  />
                </div>

                {/* Hero Promotional Ads Info */}
                <div className="sm:col-span-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-3.5 text-xs text-zinc-600 dark:text-zinc-400">
                  الواجهة الرئيسية تعرض الآن شريطاً إعلانياً متحركاً من اليسار لليمين لصور وعروض المنتجات النشطة تلقائياً؛ ويمكنك التحكم في إبراز أي منتج من تبويب «المنتجات والباقات».
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                    العنوان الرئيسي (Hero Headline)
                  </label>
                  <input
                    type="text"
                    required
                    value={configDraft.heroTitle}
                    onChange={(e) => setConfigDraft({ ...configDraft, heroTitle: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                    الوصف التعريفي أسفل العنوان
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={configDraft.heroSubtitle}
                    onChange={(e) =>
                      setConfigDraft({ ...configDraft, heroSubtitle: e.target.value })
                    }
                    className="w-full p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                    نص زر البدء الرئيسي
                  </label>
                  <input
                    type="text"
                    required
                    value={configDraft.heroCtaText}
                    onChange={(e) =>
                      setConfigDraft({ ...configDraft, heroCtaText: e.target.value })
                    }
                    className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                    العملة
                  </label>
                  <select
                    value={configDraft.currencyCode}
                    onChange={(e) => {
                      const code = e.target.value as CurrencyCode;
                      const symMap: Record<CurrencyCode, string> = {
                        EGP: 'ج.م',
                        SAR: 'ر.س',
                        AED: 'د.إ',
                        USD: '$',
                      };
                      setConfigDraft({
                        ...configDraft,
                        currencyCode: code,
                        currencySymbol: symMap[code],
                      });
                    }}
                    className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white"
                  >
                    <option value="EGP">جنيه مصري (ج.م)</option>
                    <option value="SAR">ريال سعودي (ر.س)</option>
                    <option value="AED">درهم إماراتي (د.إ)</option>
                    <option value="USD">دولار أمريكي ($)</option>
                  </select>
                </div>

                {/* Animated Top Bar Features Manager */}
                <div className="sm:col-span-2 space-y-2.5 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                  <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200">
                    مميزات الشريط العلوي المنبثق (تتحرك بانبثاق تلقائي في أعلى الموقع)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newFeatureText}
                      onChange={(e) => setNewFeatureText(e.target.value)}
                      placeholder="أضف ميزة جديدة للشريط العلوي..."
                      className="flex-1 h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!newFeatureText.trim()) return;
                        setConfigDraft((prev) => ({
                          ...prev,
                          marqueeFeatures: [
                            ...(prev.marqueeFeatures || []),
                            newFeatureText.trim().slice(0, 120),
                          ].slice(0, 8),
                        }));
                        setNewFeatureText('');
                      }}
                      className="h-10 px-4 rounded-xl bg-zinc-900 dark:bg-zinc-800 text-white text-xs font-bold cursor-pointer"
                    >
                      إضافة
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {(configDraft.marqueeFeatures || []).map((feat, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={feat}
                          onChange={(e) => {
                            const next = [...(configDraft.marqueeFeatures || [])];
                            next[idx] = e.target.value;
                            setConfigDraft({ ...configDraft, marqueeFeatures: next });
                          }}
                          className="flex-1 h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setConfigDraft((prev) => ({
                              ...prev,
                              marqueeFeatures: (prev.marqueeFeatures || []).filter(
                                (_, i) => i !== idx
                              ),
                            }))
                          }
                          className="h-9 w-9 rounded-lg text-rose-500 hover:bg-rose-500/10 flex items-center justify-center cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                    بريد الدعم الفني
                  </label>
                  <input
                    type="email"
                    value={configDraft.supportEmail}
                    onChange={(e) =>
                      setConfigDraft({ ...configDraft, supportEmail: e.target.value })
                    }
                    className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                    رقم واتساب الدعم
                  </label>
                  <input
                    type="text"
                    value={configDraft.supportWhatsapp}
                    onChange={(e) =>
                      setConfigDraft({ ...configDraft, supportWhatsapp: e.target.value })
                    }
                    className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-mono-tabular text-zinc-900 dark:text-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                    وصف التذييل (Footer)
                  </label>
                  <textarea
                    rows={2}
                    value={configDraft.footerAboutText}
                    onChange={(e) =>
                      setConfigDraft({ ...configDraft, footerAboutText: e.target.value })
                    }
                    className="w-full p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-5 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={configDraft.promoBannerActive}
                    onChange={(e) =>
                      setConfigDraft({ ...configDraft, promoBannerActive: e.target.checked })
                    }
                  />
                  <span>عرض الشريط العلوي المنبثق لمميزات الموقع</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={configDraft.livePopupEnabled}
                    onChange={(e) =>
                      setConfigDraft({ ...configDraft, livePopupEnabled: e.target.checked })
                    }
                  />
                  <span>تفعيل الإشعارات المنبثقة لعمليات الشراء (أسفل اليسار)</span>
                </label>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingConfig}
                  className="h-11 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{savingConfig ? 'جاري الحفظ...' : 'حفظ وتحديث الواجهة الآن'}</span>
                </button>
              </div>
            </form>
          )}

          {/* 8. ADMINS RBAC */}
          {activeTab === 'admins' && (
            <div className="space-y-6">
              <form
                onSubmit={handleAddAdmin}
                className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] p-6 space-y-4"
              >
                <h2 className="text-base font-extrabold text-zinc-900 dark:text-white">
                  إضافة مشرف جديد
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input
                    type="text"
                    required
                    value={newAdminUid}
                    onChange={(e) => setNewAdminUid(e.target.value)}
                    placeholder="Firebase User UID"
                    className="h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-mono-tabular text-zinc-900 dark:text-white"
                  />
                  <input
                    type="email"
                    required
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    placeholder="البريد الإلكتروني للمشرف"
                    className="h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white"
                  />
                </div>
                <button
                  type="submit"
                  className="h-10 px-5 rounded-xl bg-emerald-600 text-white text-xs font-bold cursor-pointer"
                >
                  منح صلاحية الإدارة
                </button>
              </form>

              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] p-5 space-y-3">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                  قائمة المشرفين المعتمدين
                </h3>
                {adminsList.map((adm) => (
                  <div
                    key={adm.uid}
                    className="flex items-center justify-between py-2.5 border-b last:border-b-0 border-zinc-100 dark:border-zinc-800 text-xs"
                  >
                    <div>
                      <p className="font-bold text-zinc-900 dark:text-white">{adm.email}</p>
                      <p className="font-mono-tabular text-zinc-500">{adm.uid}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveAdmin(adm.uid)}
                      className="text-rose-500 font-bold cursor-pointer"
                    >
                      إزالة
                    </button>
                  </div>
                ))}
                {adminsList.length === 0 && (
                  <p className="text-xs text-zinc-500">
                    المشرف الرئيسي الموثق حالياً: m36464697@gmail.com
                  </p>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
