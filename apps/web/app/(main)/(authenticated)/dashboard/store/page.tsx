'use client';

import React, { useState, useEffect, Suspense } from 'react';
import {
    CheckCircle2,
    Zap,
    ShieldCheck,
    Star,
    Info,
    XCircle,
    AlertCircle,
    Package,
    Check,
    Settings,
    Plus,
    Clock,
    Image as ImageIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useProfile } from '@/lib/profile-context';
import { apiFetch } from '@/lib/api';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase, ShopItem, ShopCategory } from '@/lib/supabase';
import PaymentModal from '@/components/store/PaymentModal';
import PreviewModal from '@/components/store/PreviewModal';
import EndfieldLoadingScreen from '@/components/store/EndfieldLoadingScreen';

interface StoreProduct {
    id: string;
    name: string;
    type: 'vip' | 'coins';
    price: number;
    amount: number;
    active: boolean;
}

interface StoreLayoutConfig {
    id: string;
    asset_key: string;
    x_pos: number;
    y_pos: number;
    scale: number;
    is_visible: boolean;
}

interface VipExclusiveFrame {
    id: string;
    image_url: string;
    label: string;
    description: string;
    starts_at: string;
    expires_at: string;
    is_active: boolean;
    scale_factor: number;
    offset_x: number;
    offset_y: number;
}

export default function StorePage() {
    return (
        <Suspense fallback={
            <main className="relative h-full min-h-0 overflow-hidden bg-[var(--bb-dark)] text-[var(--bb-text)]">
                <EndfieldLoadingScreen isReady={false} />
            </main>
        }>
            <StoreContent />
        </Suspense>
    );
}



function StoreContent() {
    const { profile, refreshProfile, isGuest } = useProfile();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [itemsLoading, setItemsLoading] = useState<Record<string, boolean>>({});
    const [userInventory, setUserInventory] = useState<string[]>([]); // Just store item IDs
    const [shopItems, setShopItems] = useState<ShopItem[]>([]);
    const [previewItem, setPreviewItem] = useState<ShopItem | null>(null);
    const [purchaseMessage, setPurchaseMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [activeView, setActiveView] = useState<'items' | 'recharge'>('items');
    const [showDebugInfo, setShowDebugInfo] = useState(false);

    // Endfield Loading Screen States
    const [isPageReady, setIsPageReady] = useState(false);
    const [showLoadingScreen, setShowLoadingScreen] = useState(true);

    const status = searchParams.get('status');
    const paymentStatus = searchParams.get('payment');
    const statusDetail = searchParams.get('status_detail');
    const merchantOrderId = searchParams.get('merchant_order_id');
    const collectionId = searchParams.get('collection_id') || searchParams.get('payment_id');
    const effectiveStatus = paymentStatus || status;

    React.useEffect(() => {
        if (effectiveStatus === 'success' || effectiveStatus === 'approved') {
            refreshProfile();
        }
    }, [effectiveStatus, refreshProfile]);

    const [shopCategories, setShopCategories] = useState<ShopCategory[]>([]);
    const [coinPackages, setCoinPackages] = useState<StoreProduct[]>([]);
    const [vipProduct, setVipProduct] = useState<StoreProduct | null>(null);
    const [activeFrame, setActiveFrame] = useState<VipExclusiveFrame | null>(null);

    // Helper para precarga de imágenes
    const preloadImages = (urls: (string | null | undefined)[]) => {
        if (typeof window === 'undefined') return Promise.resolve();
        const validUrls = [...new Set(urls.filter((url): url is string => typeof url === 'string' && url.length > 0))];
        if (validUrls.length === 0) return Promise.resolve();

        return Promise.all(
            validUrls.map(
                (url) =>
                    new Promise<void>((resolve) => {
                        const img = new Image();
                        img.decoding = 'async';
                        let settled = false;
                        const finish = () => {
                            if (settled) return;
                            settled = true;
                            window.clearTimeout(timeoutId);
                            resolve();
                        };
                        const decodeAndFinish = () => {
                            if (typeof img.decode === 'function') {
                                void img.decode().catch(() => undefined).finally(finish);
                            } else {
                                finish();
                            }
                        };
                        const timeoutId = window.setTimeout(finish, 12000);
                        img.onload = decodeAndFinish;
                        img.onerror = finish;
                        img.src = url;
                        if (img.complete) decodeAndFinish();
                    })
            )
        ).then(() => undefined);
    };

    // Fetch shop items, categories, and recharge products (VIP/Coins)
    useEffect(() => {
        const fetchData = async () => {
            try {
                // 1. Fetch Categories
                const { data: catData, error: catError } = await supabase
                    .from('shop_categories')
                    .select('*')
                    .eq('is_active', true)
                    .order('display_order', { ascending: true });

                if (!catError && catData) {
                    setShopCategories(catData);
                }

                // 2. Fetch Items
                const { data: itemData, error: itemError } = await supabase
                    .from('shop_items')
                    .select('*')
                    .eq('is_active', true)
                    .order('price_coins', { ascending: true });

                if (!itemError && itemData) {
                    setShopItems(itemData);
                }

                // 3. Fetch Store Products (Dynamic Pricing)
                const { data: prodData, error: prodError } = await supabase
                    .from('store_products')
                    .select('*')
                    .eq('active', true);

                if (!prodError && prodData) {
                    const products = prodData as unknown as StoreProduct[];
                    setCoinPackages(products.filter(p => p.type === 'coins').sort((a, b) => a.price - b.price));
                    setVipProduct(products.find(p => p.type === 'vip') || null);
                }

                // 4. Fetch Active VIP Frame
                const currentTimestamp = new Date().toISOString();
                const { data: frameData } = await supabase
                    .from('vip_exclusive_frames')
                    .select('*')
                    .eq('is_active', true)
                    .lte('starts_at', currentTimestamp)
                    .gt('expires_at', currentTimestamp)
                    .order('starts_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                if (frameData) setActiveFrame(frameData);

                // 5. Fetch Inventory
                if (profile?.id) {
                    const { data: invData } = await supabase
                        .from('user_inventory')
                        .select('item_id')
                        .eq('user_id', profile.id);

                    if (invData) {
                        setUserInventory(invData.map(item => item.item_id));
                    }
                }

                // 6. Precargar imágenes críticas
                // Solo bloqueamos la entrada por la primera fila visible. Las demas
                // imagenes se cargan al acercarse al viewport, especialmente los GIF.
                const firstCategoryId = catData?.[0]?.id;
                const firstCategoryItems = (itemData || []).filter((item: any) => item.category_id === firstCategoryId);
                const initialCatalogItems = (firstCategoryItems.length > 0 ? firstCategoryItems : (itemData || [])).slice(0, 4);
                const imagesToPreload: (string | null | undefined)[] = [
                    '/icons/moneda.png',
                    '/tienda/ChatGPT Image 20 feb 2026, 12_02_20 (1) 1.png',
                    '/tienda/ChatGPT Image 20 feb 2026, 12_02_20 (1)2.png',
                    '/tienda/ChatGPT Image 20 feb 2026, 12_02_20 (1) 4.png',
                    ...initialCatalogItems.map((item: any) => item.image_url)
                ];

                await preloadImages(imagesToPreload);
            } catch (err) {
                console.error('[Store] Error cargando datos:', err);
            } finally {
                setIsPageReady(true);
            }
        };

        fetchData();
    }, [supabase, profile?.id]);

    const handleBuyItem = async (item: ShopItem) => {
        if (isGuest) {
            alert('Modo Lectura: Inicia sesión para comprar artículos en la tienda.');
            router.push('/auth/login');
            return;
        }
        if (profile?.monedas && profile.monedas < item.price_coins) {
            setPurchaseMessage({ type: 'error', text: 'No tienes suficientes monedas' });
            return;
        }

        try {
            setItemsLoading(prev => ({ ...prev, [item.id]: true }));

            // Use the Worker API endpoint instead of Supabase Edge Function to avoid CORS
            await apiFetch('/shop/buy', {
                method: 'POST',
                body: JSON.stringify({ item_id: item.id }),
            });

            // Refresh profile to update coins
            await refreshProfile();

            // Refresh Inventory State to show "Adquirido" immediately
            const { data: invData } = await supabase
                .from('user_inventory')
                .select('item_id')
                .eq('user_id', profile!.id);

            if (invData) {
                setUserInventory(invData.map(i => i.item_id));
            }

            // Show success message
            setPurchaseMessage({ type: 'success', text: `¡Has comprado ${item.name} éxitosamente!` });

        } catch (error: any) {
            console.error('Error buying item:', error);
            setPurchaseMessage({ type: 'error', text: error.message || 'Error al procesar la compra' });
        } finally {
            setItemsLoading(prev => ({ ...prev, [item.id]: false }));
            setTimeout(() => setPurchaseMessage(null), 5000);
        }
    };

    // Payment Modal State
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<{
        id: string;
        name: string;
        price: number;
        type: 'vip' | 'coins' | 'item';
        amount?: number;
    } | null>(null);

    const handlePurchase = (productId: string) => {
        if (isGuest) {
            alert('Debes iniciar sesión para comprar productos o suscribirte.');
            router.push('/auth/login');
            return;
        }
        const selectedPackage = coinPackages.find(p => p.id === productId) || vipProduct;
        if (!selectedPackage) return;

        setSelectedProduct({
            id: selectedPackage.id,
            name: selectedPackage.name,
            price: selectedPackage.price,
            type: selectedPackage.type,
            amount: selectedPackage.amount
        });
        setIsPaymentModalOpen(true);
    };

    const handlePaymentSuccess = async (result: any) => {
        console.log('[StorePage] Payment successful. Product:', selectedProduct);
        await refreshProfile();
    };

    const handlePaymentError = (error: any) => {
        console.error('Payment Error:', error);
        setPurchaseMessage({ type: 'error', text: 'Error al procesar el pago. Intenta nuevamente.' });
    };

    if (showLoadingScreen) {
        return (
            <main className="relative h-full min-h-0 overflow-hidden bg-[var(--bb-dark)] text-[var(--bb-text)]">
                <EndfieldLoadingScreen
                    isReady={isPageReady}
                    onFinished={() => setShowLoadingScreen(false)}
                />
            </main>
        );
    }

    return (
        <main className="relative min-h-full bg-[var(--bb-dark)] px-4 py-6 text-[var(--bb-text)] transition-colors duration-200 sm:px-6 lg:px-10 lg:py-10">
            <div className="mx-auto max-w-[1380px] space-y-10">

                    {/* Alert Messages */}
                    {effectiveStatus && (
                        <div className={`flex items-start gap-4 rounded-2xl border p-5 ${(effectiveStatus === 'success' || effectiveStatus === 'approved')
                            ? 'bg-green-500/10 border-green-500/20'
                            : (effectiveStatus === 'failure' || effectiveStatus === 'rejected')
                                ? 'bg-red-500/10 border-red-500/20'
                                : 'bg-yellow-500/10 border-yellow-500/20'
                            }`}>
                            {(effectiveStatus === 'success' || effectiveStatus === 'approved') ? (
                                <CheckCircle2 className="text-green-500 shrink-0" size={32} />
                            ) : (effectiveStatus === 'failure' || effectiveStatus === 'rejected') ? (
                                <XCircle className="text-red-500 shrink-0" size={32} />
                            ) : (
                                <AlertCircle className="text-yellow-500 shrink-0" size={32} />
                            )}
                            <div>
                                <h3 className="text-xl font-bold text-[var(--bb-text)]">
                                    {(effectiveStatus === 'success' || effectiveStatus === 'approved') ? '¡Pago Exitoso!' : (effectiveStatus === 'failure' || effectiveStatus === 'rejected') ? 'Hubo un error' : 'Pago Pendiente'}
                                </h3>
                                <p className="text-bb-text-secondary text-sm">
                                    {(effectiveStatus === 'success' || effectiveStatus === 'approved') ? (
                                        'Tu compra se ha procesado correctamente y tus beneficios han sido activados.'
                                    ) : (effectiveStatus === 'failure' || effectiveStatus === 'rejected') ? (
                                        statusDetail === 'cc_rejected_insufficient_amount' ? 'Tu tarjeta no tiene saldo suficiente.' :
                                            statusDetail === 'cc_rejected_call_for_authorize' ? 'Debes autorizar el pago ante tu banco.' :
                                                statusDetail === 'cc_rejected_duplicated_payment' ? 'Se detectó un pago duplicado.' :
                                                    statusDetail === 'cc_rejected_bad_filled_security_code' ? 'El código de seguridad es incorrecto.' :
                                                        statusDetail === 'cc_rejected_card_disabled' ? 'Tu tarjeta se encuentra inactiva.' :
                                                            'No pudimos procesar tu pago. Por favor, intenta con otro método de pago.'
                                    ) : (
                                        'Estamos procesando tu pago. Te avisaremos cuando se complete.'
                                    )}
                                </p>
                            </div>
                        </div>
                    )}


                {/* Header Section */}
                <header className="flex flex-col gap-6 border-b border-[var(--bb-border)] pb-8 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-blue-500">
                            <ShieldCheck className="h-4 w-4" /> Tienda oficial CampusLink
                        </div>
                        <h1 className="mt-4 text-4xl font-black tracking-[-0.05em] text-[var(--bb-text)] sm:text-5xl lg:text-6xl">Personaliza tu experiencia.</h1>
                        <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--bb-text-secondary)] sm:text-base">Compra artículos con monedas o recarga de forma segura. Los precios y beneficios se validan siempre en nuestros servidores.</p>
                    </div>
                    <div className="flex w-fit items-center gap-3 rounded-xl border border-[var(--bb-border)] bg-[var(--bb-card)] px-4 py-3">
                        <img src="/icons/moneda.png" alt="Monedas" className="h-7 w-7" />
                        <div><p className="text-[10px] font-black uppercase tracking-wider text-[var(--bb-text-secondary)]">Tu saldo</p><p className="text-lg font-black tabular-nums">{profile?.monedas ?? 0}</p></div>
                    </div>
                </header>

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex w-full rounded-xl border border-[var(--bb-border)] bg-[var(--bb-card)] p-1 sm:w-auto">
                        <button
                            onClick={() => setActiveView('items')}
                            className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-lg px-5 text-sm font-black transition-colors sm:flex-none ${activeView === 'items' ? 'bg-blue-600 text-white' : 'text-[var(--bb-text-secondary)] hover:bg-[var(--bb-hover)] hover:text-[var(--bb-text)]'}`}
                        >
                            <Package size={18} /> Artículos
                        </button>
                        <button
                            onClick={() => setActiveView('recharge')}
                            className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-lg px-5 text-sm font-black transition-colors sm:flex-none ${activeView === 'recharge' ? 'bg-blue-600 text-white' : 'text-[var(--bb-text-secondary)] hover:bg-[var(--bb-hover)] hover:text-[var(--bb-text)]'}`}
                        >
                            <Zap size={18} /> Monedas y VIP
                        </button>
                    </div>
                    {(profile?.role === 'admin' || profile?.role === 'superadmin') && (
                        <Link href="/admin/shop" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--bb-border)] bg-[var(--bb-card)] px-5 text-sm font-bold text-[var(--bb-text)] hover:bg-[var(--bb-hover)]">
                            <Settings size={17} /> Administrar tienda
                        </Link>
                    )}
                </div>

                {
                    activeView === 'recharge' ? (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
                            {/* VIP membership */}
                            {vipProduct && (
                                <div className="lg:col-span-12">
                                    <div className="flex flex-col items-center gap-8 rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-card)] p-5 sm:p-10 lg:flex-row lg:gap-12">
                                        {/* Mascot Origi + Frame Component */}
                                        <div className="w-full lg:w-1/2 flex flex-col justify-center items-center relative order-first z-10 gap-8">
                                            <img
                                                src="/tienda/orivipp.png"
                                                alt="Origi Mascot"
                                                className="relative z-10 w-[180px] select-none object-contain sm:w-[320px]"
                                            />

                                            {/* VIP Exclusive Frame Showcase */}
                                            {activeFrame && new Date(activeFrame.expires_at) > new Date() && (
                                                <div className="relative w-full max-w-[320px] overflow-hidden rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-darker)] p-5">
                                                    {(profile?.role === 'admin' || profile?.role === 'superadmin') && (
                                                        <Link
                                                            href="/admin/shop/vip-frame"
                                                            className="absolute right-3 top-3 z-20 rounded-full bg-[var(--bb-card)] p-2 text-[var(--bb-text-secondary)] transition-colors hover:bg-[var(--bb-hover)] hover:text-[var(--bb-text)]"
                                                            title="Editar marco"
                                                        >
                                                            <Settings size={14} />
                                                        </Link>
                                                    )}
                                                    <div className="flex flex-col items-center text-center gap-3 relative z-10">
                                                        <div className="flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1">
                                                            <Clock size={12} className="text-black" />
                                                            <span className="text-[9px] font-black uppercase tracking-wider text-black">Por tiempo limitado</span>
                                                        </div>
                                                        <div className="relative w-28 h-28 my-2">
                                                            <div className="absolute inset-0 bg-zinc-800 rounded-full flex items-center justify-center animate-pulse border-2 border-zinc-700">
                                                                <ImageIcon size={24} className="text-[var(--bb-text-secondary)]" />
                                                            </div>
                                                            <div className="absolute inset-0 z-10">
                                                                <img
                                                                    src={activeFrame.image_url}
                                                                    alt={activeFrame.label}
                                                                    className="absolute top-1/2 left-1/2 w-[140%] h-[140%] object-contain drop-shadow-2xl pointer-events-none"
                                                                    style={{
                                                                        transform: `translate(calc(-50% + ${activeFrame.offset_x || 0}px), calc(-50% + ${activeFrame.offset_y || 0}px)) scale(${activeFrame.scale_factor === undefined ? 1.4 : activeFrame.scale_factor})`,
                                                                        transformOrigin: 'center center'
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <h4 className="text-lg font-black italic uppercase leading-tight text-[var(--bb-text)]">{activeFrame.label}</h4>
                                                            {activeFrame.description && <p className="mt-1 text-xs text-[var(--bb-text-secondary)]">{activeFrame.description}</p>}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            {(!activeFrame || new Date(activeFrame.expires_at) < new Date()) && (profile?.role === 'admin' || profile?.role === 'superadmin') && (
                                                <Link href="/admin/shop/vip-frame">
                                                    <Button
                                                        variant="ghost"
                                                        className="gap-2 rounded-full border border-[var(--bb-border)] bg-[var(--bb-darker)] text-xs font-bold text-[var(--bb-text-secondary)] hover:bg-[var(--bb-hover)] hover:text-[var(--bb-text)]"
                                                    >
                                                        <Plus size={14} /> Activar Marco Exclusivo
                                                    </Button>
                                                </Link>
                                            )}
                                        </div>

                                        <div className="w-full space-y-6 text-center lg:w-1/2 lg:text-left">
                                            <div className="space-y-6">
                                                <div className="space-y-3">
                                                    <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-500">Membresía CampusLink</p>
                                                    <h2 className="text-3xl font-black tracking-[-0.04em] text-[var(--bb-text)] sm:text-5xl">
                                                        Hazte VIP y apoya la comunidad.
                                                    </h2>
                                                    <p className="mx-auto max-w-xl text-sm font-medium leading-6 text-[var(--bb-text-secondary)] sm:text-base lg:mx-0">
                                                        Apoya a los administradores de la plataforma y obtén beneficios cosméticos exclusivos para destacar tu perfil en CampusLink.
                                                    </p>
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-5">
                                                    {[
                                                        { text: 'Insignia Dorada VIP', icon: Check },
                                                        { text: 'Roles Destacados', icon: Check },
                                                        { text: 'Marcos de perfil únicos', icon: Check },
                                                        { text: 'Apoyo a la plataforma', icon: Check }
                                                    ].map((f, i) => (
                                                        <div key={i} className="flex items-center gap-3 rounded-xl border border-[var(--bb-border)] bg-[var(--bb-darker)] p-3 lg:p-4">
                                                            <div className="grid h-6 w-6 place-items-center rounded-full bg-emerald-500"><Check className="h-3.5 w-3.5 text-black" /></div>
                                                            <span className="text-xs font-bold text-[var(--bb-text)] sm:text-sm">{f.text}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="flex flex-col items-center gap-4 border-t border-[var(--bb-border)] pt-6 sm:flex-row lg:justify-between">
                                                <div className="text-3xl font-black tabular-nums text-[var(--bb-text)]">S/ {vipProduct.price} <span className="mt-1 block text-xs font-bold uppercase tracking-wider text-[var(--bb-text-secondary)] sm:inline">/ {vipProduct.amount} días</span></div>
                                                <Button
                                                    onClick={() => handlePurchase(vipProduct.id)}
                                                    className="h-12 w-full rounded-xl bg-blue-600 px-8 text-sm font-black text-white hover:bg-blue-500 sm:w-auto"
                                                >
                                                    Activar membresía
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Coins Section */}
                            <div className="space-y-6 lg:col-span-12">
                                <div className="flex items-center gap-3">
                                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600">
                                        <Zap className="h-5 w-5 text-white" />
                                    </div>
                                    <div><p className="text-xs font-black uppercase tracking-[0.18em] text-blue-500">Saldo CampusLink</p><h2 className="mt-1 text-2xl font-black tracking-tight text-[var(--bb-text)]">Paquetes de monedas</h2></div>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                    {coinPackages.map((pkg) => {
                                        const coinImage = pkg.amount <= 100
                                            ? '/tienda/ChatGPT Image 20 feb 2026, 12_02_20 (1) 1.png'
                                            : pkg.amount <= 500
                                                ? '/tienda/ChatGPT Image 20 feb 2026, 12_02_20 (1)2.png'
                                                : '/tienda/ChatGPT Image 20 feb 2026, 12_02_20 (1) 4.png';

                                        return (
                                            <button key={pkg.id} onClick={() => handlePurchase(pkg.id)} className="group flex min-h-52 flex-col justify-between rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-card)] p-5 text-left transition-colors hover:border-blue-500/70 hover:bg-[var(--bb-hover)]">
                                                <div className="flex items-start justify-between gap-4"><img src={coinImage} alt={`Paquete de ${pkg.amount} monedas`} loading="lazy" decoding="async" className="h-16 w-16 object-contain" /><span className="rounded-lg bg-[var(--bb-darker)] px-3 py-1.5 text-xs font-black text-[var(--bb-text-secondary)]">S/ {pkg.price}</span></div>
                                                <div><p className="text-3xl font-black tabular-nums text-[var(--bb-text)]">{pkg.amount}</p><h3 className="mt-1 text-sm font-bold text-[var(--bb-text-secondary)]">{pkg.name}</h3><span className="mt-4 inline-flex text-sm font-black text-blue-500">Comprar paquete</span></div>
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="flex items-start gap-3 rounded-xl border border-[var(--bb-border)] bg-[var(--bb-card)] p-4">
                                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                                    <p className="text-sm leading-6 text-[var(--bb-text-secondary)]">Las monedas se acreditan únicamente después de que Mercado Pago confirma la transacción. Si la confirmación tarda, podrás cerrar esta ventana sin perder el pago.</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Shop Items Section */
                        <div className="space-y-12">
                            {shopCategories.map((category) => {
                                const categoryItems = shopItems.filter(item => {
                                    if (item.category_id === category.id) return true;
                                    // Fallback for VIP frame if category is "Decoraciones de Avatar"
                                    if (category.name === 'Decoraciones de Avatar' && item.frame_key === 'vip_exclusive' && !item.category_id) return true;
                                    return false;
                                });
                                if (categoryItems.length === 0) return null;

                                return (
                                    <div key={category.id} className="space-y-5">
                                        <div className="flex items-end justify-between gap-4 border-b border-[var(--bb-border)] pb-5">
                                            <div>
                                                <span className="text-xs font-black uppercase tracking-[0.18em] text-blue-500">Colección</span>
                                                <h2 className="mt-2 text-2xl font-black tracking-tight text-[var(--bb-text)] sm:text-3xl">{category.name}</h2>
                                                <p className="mt-1 text-xs text-[var(--bb-text-secondary)]">{categoryItems.length} artículo{categoryItems.length === 1 ? '' : 's'}</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
                                            {categoryItems.map((item) => {
                                                const isOwned = userInventory.includes(item.id);
                                                return (
                                                    <div
                                                        key={item.id}
                                                        className={`group relative flex flex-col overflow-hidden rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-card)] transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-500/60 hover:bg-[var(--bb-hover)] hover:shadow-xl ${isOwned ? 'opacity-70' : ''}`}
                                                        style={{ contentVisibility: 'auto', containIntrinsicSize: '420px' }}
                                                    >
                                                        {/* ── Preview Area ── */}
                                                        <div
                                                            className="relative flex cursor-pointer items-center justify-center overflow-hidden bg-[var(--bb-darker)]"
                                                            style={{ aspectRatio: '1/1', minHeight: 0 }}
                                                            onClick={() => setPreviewItem(item)}
                                                        >
                                                            {item.type === 'profile_frame' ? (
                                                                <div className="relative flex items-center justify-center w-28 h-28 sm:w-36 sm:h-36 md:w-40 md:h-40">
                                                                    {/* Dummy Avatar */}
                                                                    <div className="relative z-0 flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-[var(--bb-border)] bg-[var(--bb-card)] opacity-50">
                                                                        <ImageIcon className="h-8 w-8 text-[var(--bb-text-secondary)]" />
                                                                    </div>
                                                                    {/* Frame */}
                                                                    {item.image_url && (
                                                                        <img
                                                                            src={item.image_url}
                                                                            alt={item.name}
                                                                            loading="lazy"
                                                                            decoding="async"
                                                                            className="absolute z-10 max-w-none object-contain"
                                                                            style={{
                                                                                top: '50%',
                                                                                left: '50%',
                                                                                width: `${(item.frame_settings?.preview?.scale || 1.4) * 100}%`,
                                                                                height: `${(item.frame_settings?.preview?.scale || 1.4) * 100}%`,
                                                                                transform: `translate(calc(-50% + ${item.frame_settings?.preview?.x || 0}px), calc(-50% + ${item.frame_settings?.preview?.y || 0}px))`
                                                                            }}
                                                                        />
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <img
                                                                    src={item.image_url || ''}
                                                                    alt={item.name}
                                                                    className="h-28 w-28 sm:h-36 sm:w-36 object-contain"
                                                                    loading="lazy"
                                                                    decoding="async"
                                                                />
                                                            )}

                                                            {/* Badges */}
                                                            {item.max_uses !== null && (
                                                                <div className="absolute right-0 top-0 z-20 rounded-bl-xl rounded-tr-lg bg-blue-600 px-2 py-1 text-[9px] font-black text-white">
                                                                    {item.max_uses} USOS
                                                                </div>
                                                            )}
                                                            {/* Hover zoom hint */}
                                                            <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors">
                                                                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-black text-white bg-black/60 px-2 py-1 rounded-full">
                                                                    Ver preview
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* ── Card Body ── */}
                                                        <div className="flex flex-1 flex-col gap-3 p-3 sm:p-4">
                                                            <div className="space-y-0.5">
                                                                <div className="text-[9px] font-black uppercase tracking-[0.16em] text-[var(--bb-text-secondary)]">
                                                                    {item.type.replace('_', ' ')}
                                                                    {item.bundle_items && item.bundle_items.length > 0 && (
                                                                        <span className="ml-1.5 bg-indigo-500/20 text-indigo-400 px-1 py-0.5 rounded uppercase tracking-widest border border-indigo-500/30">PACK</span>
                                                                    )}
                                                                </div>
                                                                <h3 className="line-clamp-2 text-sm font-black leading-tight text-[var(--bb-text)] sm:text-base">{item.name}</h3>
                                                                <p className="mt-1 line-clamp-2 text-[10px] font-medium leading-4 text-[var(--bb-text-secondary)] sm:text-xs">{item.description}</p>
                                                            </div>

                                                            {/* ── Action Row ── */}
                                                            <div className="mt-auto flex items-center gap-1.5 border-t border-[var(--bb-border)] pt-3">
                                                                {item.frame_key === 'vip_exclusive' ? (
                                                                    <>
                                                                        {!profile?.es_vip && (
                                                                            <div className="flex flex-shrink-0 items-center gap-1 rounded-lg bg-amber-500 px-2 py-1">
                                                                                <Star className="h-3 w-3 text-black" />
                                                                                <span className="text-[10px] font-black text-black">VIP</span>
                                                                            </div>
                                                                        )}
                                                                        {profile?.es_vip ? (
                                                                            <Button className="h-8 flex-1 rounded-xl bg-[var(--bb-hover)] px-1 text-[10px] font-bold text-[var(--bb-text-secondary)] sm:h-9 sm:text-xs" disabled>ADQUIRIDO</Button>
                                                                        ) : (
                                                                            <Button
                                                                                onClick={() => setActiveView('recharge')}
                                                                                className="h-8 sm:h-9 flex-1 rounded-xl bg-amber-500 px-1 text-[10px] font-black text-black hover:bg-amber-400 sm:text-xs"
                                                                            >
                                                                                OBTENER VIP
                                                                            </Button>
                                                                        )}
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        {!isOwned && (
                                                                            <div className="flex flex-shrink-0 items-center gap-1 rounded-lg bg-[var(--bb-darker)] px-2 py-1">
                                                                                <img src="/icons/moneda.png" alt="Coin" className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                                                                                <span className="text-[10px] font-black tracking-tighter text-[var(--bb-text)] sm:text-xs">{item.price_coins}</span>
                                                                            </div>
                                                                        )}
                                                                        {isOwned ? (
                                                                            <Button className="h-8 flex-1 rounded-xl bg-[var(--bb-hover)] px-1 text-[10px] font-bold text-[var(--bb-text-secondary)] sm:h-9 sm:text-xs" disabled>ADQUIRIDO</Button>
                                                                        ) : (
                                                                            <Button onClick={() => setPreviewItem(item)} className="h-8 flex-1 rounded-xl bg-[var(--bb-text)] px-1 text-[10px] font-black text-[var(--bb-darker)] hover:opacity-90 sm:h-9 sm:text-xs">
                                                                                Ver preview
                                                                            </Button>
                                                                        )}
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                {/* Purchase Notification */}
                {purchaseMessage && (
                    <div role="status" className={`fixed bottom-4 left-4 right-4 z-50 rounded-xl border p-4 sm:left-auto sm:right-6 sm:max-w-md ${purchaseMessage.type === 'success' ? 'border-emerald-500/40 bg-[#153128] text-emerald-100' : 'border-red-500/40 bg-[#351a1a] text-red-100'}`}>
                        <div className="flex items-center gap-3 text-sm font-bold">
                            {purchaseMessage.type === 'success' ? <CheckCircle2 size={24} /> : <XCircle size={24} />}
                            {purchaseMessage.text}
                        </div>
                    </div>
                )}

                <div className="border-t border-[var(--bb-border)] py-8">
                    <div className="flex flex-col gap-4 text-xs font-bold text-[var(--bb-text-secondary)] sm:flex-row sm:justify-center sm:gap-10">
                        <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-500" /> Pago validado por el proveedor</div>
                        <div className="flex items-center gap-2"><Star className="h-4 w-4 text-blue-500" /> Artículos ligados a tu cuenta</div>
                        <div className="flex items-center gap-2"><Zap className="h-4 w-4 text-blue-500" /> Entrega automática tras confirmación</div>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {previewItem && (
                <PreviewModal
                    isOpen={!!previewItem}
                    onClose={() => setPreviewItem(null)}
                    item={previewItem}
                    profile={profile}
                    onBuy={(item) => { handleBuyItem(item); setPreviewItem(null); }}
                    isOwned={userInventory.includes(previewItem.id)}
                    loading={itemsLoading[previewItem.id]}
                    canAfford={(profile?.monedas ?? 0) >= previewItem.price_coins}
                />
            )}
            <PaymentModal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                product={selectedProduct}
                onPaymentSuccess={handlePaymentSuccess}
                onPaymentError={handlePaymentError}
            />
        </main>
    );
}
