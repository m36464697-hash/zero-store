import React, { useState } from 'react';
import { StoreProvider, useStore } from './context/StoreContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ActivePage, Navbar } from './components/Navbar';
import { StorefrontView } from './components/StorefrontView';
import { OrdersView } from './components/OrdersView';
import { ProfileTab, ProfileView } from './components/ProfileView';
import { AdminDashboard } from './components/AdminDashboard';
import { AuthModal } from './components/AuthModal';
import { CheckoutModal } from './components/CheckoutModal';
import { CartDrawer } from './components/CartDrawer';
import { InvoiceModal } from './components/InvoiceModal';
import { LivePurchaseToast } from './components/LivePurchaseToast';
import { FloatingSupportWidget } from './components/FloatingSupportWidget';
import { OfflineIndicator } from './components/OfflineIndicator';
import { FlashDeal, OrderRecord, Product, ValueBundle } from './types';

interface CheckoutTarget {
  product: Product;
  initialPackageId?: string;
  flashDeal?: FlashDeal | null;
  bundle?: ValueBundle | null;
}

function ZoneAppContent() {
  const { products, categories, addToCart, setCartOpen } = useStore();
  const [activePage, setActivePage] = useState<ActivePage>('home');
  const [profileInitialTab, setProfileInitialTab] = useState<ProfileTab>('info');
  const [prefilledVoucherCode, setPrefilledVoucherCode] = useState('');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [checkoutTarget, setCheckoutTarget] = useState<CheckoutTarget | null>(null);
  const [invoiceOrder, setInvoiceOrder] = useState<OrderRecord | null>(null);

  const handleNavigate = (page: ActivePage) => {
    setActivePage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGoToProfileWallet = () => {
    setProfileInitialTab('wallet');
    handleNavigate('profile');
  };

  const handleRedeemVoucherFromNotif = (code: string) => {
    setPrefilledVoucherCode(code);
    setProfileInitialTab('vouchers');
    handleNavigate('profile');
  };

  const bundleToVirtualProduct = (bundle: ValueBundle): Product => ({
    id: bundle.id,
    title: bundle.title,
    subtitle: bundle.subtitle,
    category: categories[0]?.id || 'bundles',
    region: 'بكج توفير مجمّع',
    deliveryType: bundle.deliveryType,
    requiresPlayerId: bundle.requiresPlayerId,
    playerIdLabel: bundle.playerIdLabel || 'معرّف اللاعب (Player ID)',
    imageUrl: bundle.imageUrl,
    accentColor: bundle.accentColor || '#10B981',
    isFeatured: true,
    isActive: bundle.isActive,
    sortOrder: bundle.sortOrder,
    packages: [
      {
        id: 'bundle_pkg',
        name: bundle.title,
        amount: bundle.items.map((i) => `${i.productTitle} (${i.packageName})`).join(' + '),
        price: bundle.bundlePrice,
        originalPrice: bundle.originalTotalPrice,
      },
    ],
  });

  const handleSelectProduct = (product: Product) => {
    setCheckoutTarget({ product });
  };

  const handleSelectFlashDeal = (deal: FlashDeal) => {
    const baseProduct = products.find((p) => p.id === deal.productId);
    if (baseProduct) {
      const updatedPackages = baseProduct.packages.map((pkg) =>
        pkg.id === deal.packageId
          ? {
              ...pkg,
              price: deal.flashPrice,
              originalPrice: deal.originalPrice,
            }
          : pkg
      );
      setCheckoutTarget({
        product: { ...baseProduct, packages: updatedPackages },
        initialPackageId: deal.packageId,
        flashDeal: deal,
      });
      return;
    }

    const fallbackProduct: Product = {
      id: deal.productId,
      title: deal.productTitle,
      subtitle: deal.title,
      category: categories[0]?.id || 'games',
      region: 'عرض فلاش',
      deliveryType: 'direct_id',
      requiresPlayerId: true,
      playerIdLabel: 'معرّف اللاعب (Player ID)',
      imageUrl: deal.imageUrl,
      accentColor: '#F43F5E',
      isFeatured: true,
      isActive: true,
      sortOrder: 0,
      packages: [
        {
          id: deal.packageId || 'flash_pkg',
          name: deal.packageName,
          amount: deal.packageName,
          price: deal.flashPrice,
          originalPrice: deal.originalPrice,
        },
      ],
    };

    setCheckoutTarget({
      product: fallbackProduct,
      initialPackageId: fallbackProduct.packages[0].id,
      flashDeal: deal,
    });
  };

  const handleSelectBundle = (bundle: ValueBundle) => {
    setCheckoutTarget({
      product: bundleToVirtualProduct(bundle),
      bundle,
    });
  };

  const handleQuickAddBundleToCart = (bundle: ValueBundle) => {
    const vp = bundleToVirtualProduct(bundle);
    if (bundle.requiresPlayerId || bundle.deliveryType === 'subscription_login') {
      setCheckoutTarget({ product: vp, bundle });
      return;
    }
    addToCart({
      product: vp,
      pkg: vp.packages[0],
      quantity: 1,
      playerId: '',
      accountEmail: '',
      accountPassword: '',
      accountNotes: '',
    });
    setCartOpen(true);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#090B0E] text-zinc-900 dark:text-zinc-50 transition-colors">
      <Navbar
        activePage={activePage}
        onNavigate={handleNavigate}
        onOpenAuth={() => setAuthModalOpen(true)}
        onRedeemVoucherFromNotif={handleRedeemVoucherFromNotif}
      />

      {activePage === 'orders' ? (
        <OrdersView
          onOpenAuth={() => setAuthModalOpen(true)}
          onOpenInvoice={(order) => setInvoiceOrder(order)}
          onBrowseStore={() => handleNavigate('home')}
        />
      ) : activePage === 'profile' ? (
        <ProfileView
          initialTab={profileInitialTab}
          prefilledVoucherCode={prefilledVoucherCode}
          onClearPrefilledVoucher={() => setPrefilledVoucherCode('')}
          onOpenAuth={() => setAuthModalOpen(true)}
          onNavigateOrders={() => handleNavigate('orders')}
        />
      ) : activePage === 'admin' ? (
        <AdminDashboard onOpenInvoice={(order) => setInvoiceOrder(order)} />
      ) : (
        <StorefrontView
          activePage={activePage}
          onNavigate={handleNavigate}
          onSelectProduct={handleSelectProduct}
          onSelectFlashDeal={handleSelectFlashDeal}
          onSelectBundle={handleSelectBundle}
          onQuickAddBundleToCart={handleQuickAddBundleToCart}
        />
      )}

      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />

      <CheckoutModal
        product={checkoutTarget?.product ?? null}
        initialPackageId={checkoutTarget?.initialPackageId}
        flashDeal={checkoutTarget?.flashDeal}
        bundle={checkoutTarget?.bundle}
        onClose={() => setCheckoutTarget(null)}
        onRequireAuth={() => setAuthModalOpen(true)}
        onOpenInvoice={(order) => setInvoiceOrder(order)}
        onGoToOrders={() => handleNavigate('orders')}
        onGoToProfileWallet={handleGoToProfileWallet}
      />

      <CartDrawer
        onRequireAuth={() => setAuthModalOpen(true)}
        onGoToOrders={() => handleNavigate('orders')}
        onGoToProfileWallet={handleGoToProfileWallet}
      />

      <InvoiceModal order={invoiceOrder} onClose={() => setInvoiceOrder(null)} />

      <LivePurchaseToast />
      <FloatingSupportWidget onOpenAuth={() => setAuthModalOpen(true)} />
      <OfflineIndicator />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <StoreProvider>
        <ZoneAppContent />
      </StoreProvider>
    </ErrorBoundary>
  );
}
