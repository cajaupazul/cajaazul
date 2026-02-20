'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useTheme } from '@/lib/theme-context';
import {
    CreditCard,
    CheckCircle2,
    Zap,
    ShieldCheck,
    Star,
    Info,
    XCircle,
    AlertCircle,
    Package,
    Check,
    Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useProfile } from '@/lib/profile-context';
import { apiFetch } from '@/lib/api';
import { useSearchParams } from 'next/navigation';
import { supabase, ShopItem, ShopCategory } from '@/lib/supabase';
import PaymentModal from '@/components/store/PaymentModal';
import PreviewModal from '@/components/store/PreviewModal';

interface StoreProduct {
    id: string;
    name: string;
    type: 'vip' | 'coins';
    price: number;
    amount: number;
    active: boolean;
}

// MercadoPago now handled via Cloudflare Worker API

interface StoreLayoutConfig {
    asset_key: string;
    x_pos: number;
    y_pos: number;
    scale: number;
    is_visible: boolean;
}

export default function StorePage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-bb-text-secondary animate-pulse">Cargando tienda...</div>}>
            <StoreContent />
        </Suspense>
    );
}

function StoreContent() {
    const { colors } = useTheme();
    const { profile, refreshProfile, updateProfile } = useProfile();
    const searchParams = useSearchParams();
    const [itemsLoading, setItemsLoading] = useState<Record<string, boolean>>({});
    const [shopItems, setShopItems] = useState<ShopItem[]>([]);
    const [previewItem, setPreviewItem] = useState<ShopItem | null>(null);
    const [userInventory, setUserInventory] = useState<string[]>([]); // Just store item IDs
    const [purchaseMessage, setPurchaseMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [activeView, setActiveView] = useState<'items' | 'recharge'>('items');
    const [layoutConfig, setLayoutConfig] = useState<Record<string, StoreLayoutConfig>>({});

    const status = searchParams.get('status');
    const paymentStatus = searchParams.get('payment');
    const effectiveStatus = paymentStatus || status;

    React.useEffect(() => {
        if (effectiveStatus === 'success') {
            refreshProfile();
        }
    }, [effectiveStatus, refreshProfile]);

    const [shopCategories, setShopCategories] = useState<ShopCategory[]>([]);

    const [coinPackages, setCoinPackages] = useState<StoreProduct[]>([]);
    const [vipProduct, setVipProduct] = useState<StoreProduct | null>(null);

    // Fetch shop items, categories, and recharge products (VIP/Coins)
    useEffect(() => {
        const fetchData = async () => {
            // Fetch Layout Config
            const { data: layoutData } = await supabase
                .from('store_layout_config')
                .select('*');
            if (layoutData) {
                const configMap: Record<string, StoreLayoutConfig> = {};
                layoutData.forEach((item: StoreLayoutConfig) => {
                    configMap[item.asset_key] = item;
                });
                setLayoutConfig(configMap);
            }

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
                // Cast to StoreProduct[] to ensure types
                const products = prodData as unknown as StoreProduct[];
                setCoinPackages(products.filter(p => p.type === 'coins').sort((a, b) => a.price - b.price));
                setVipProduct(products.find(p => p.type === 'vip') || null);
            }
        };

        fetchData();
    }, []);

    // Fetch user inventory
    useEffect(() => {
        const fetchInventory = async () => {
            if (!profile?.id) return;

            const { data, error } = await supabase
                .from('user_inventory')
                .select('item_id')
                .eq('user_id', profile.id);

            if (!error && data) {
                setUserInventory(data.map(item => item.item_id));
            }
        };

        fetchInventory();
    }, [profile?.id]);

    const handleBuyItem = async (item: ShopItem) => {
        if (profile?.monedas && profile.monedas < item.price_coins) {
            setPurchaseMessage({ type: 'error', text: 'No tienes suficientes monedas' });
            return;
        }

        try {
            setItemsLoading(prev => ({ ...prev, [item.id]: true }));

            // Use the new Worker API endpoint instead of Supabase Edge Function to avoid CORS
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
        // The modal now handles the "Success View" and will be closed by the user.
        console.log('[StorePage] Payment successful. Product:', selectedProduct);

        // OPTIMISTIC UPDATE: Update profile immediately
        if (profile && selectedProduct) {

            if (selectedProduct.type === 'coins' && selectedProduct.amount) {
                // Force number type just in case
                const amountToAdd = Number(selectedProduct.amount);
                console.log(`[StorePage] Optimistically adding ${amountToAdd} coins to current: ${profile.monedas}`);

                const newCoins = (profile.monedas || 0) + amountToAdd;

                // Update local context immediately for instant feedback
                updateProfile({ ...profile, monedas: newCoins });
            } else if (selectedProduct.type === 'vip') {
                console.log('[StorePage] Optimistically setting VIP status');
                // For VIP we mark it true immediately
                updateProfile({ ...profile, es_vip: true });
            }
        }

        // TRIGGER BACKGROUND REFRESH
        // 1. Immediate (in case webhook was super fast or simple revalidation)
        refreshProfile();

        // 2. Delayed check (wait for webhook) to ensure DB consistency
        setTimeout(() => {
            console.log('[StorePage] Delayed DB refresh to sync final state');
            refreshProfile();
        }, 3000);
    };

    const handlePaymentError = (error: any) => {
        console.error('Payment Error:', error);
        // Do not close modal automatically on error, let user try again or see error in Brick
        // But for generic API errors we might want to show a toast
        setPurchaseMessage({ type: 'error', text: 'Error al procesar el pago. Intenta nuevamente.' });
    };

    const mascotConfig = layoutConfig['vip_mascot_origi'];

    return (
        <div className="relative min-h-screen bg-[#0a0a0c] overflow-hidden px-3 sm:px-8 py-8 sm:py-12">
            {/* Nitro Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/20 blur-[120px] rounded-full animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[100px] rounded-full" />
            </div>

            <div className="max-w-6xl mx-auto space-y-12 relative z-10">
                {/* Alert Messages */}
                {effectiveStatus && (
                    <div className={`p-6 rounded-3xl flex items-center gap-4 animate-in fade-in slide-in-from-top-4 border ${effectiveStatus === 'success' ? 'bg-green-500/10 border-green-500/20' : effectiveStatus === 'failure' ? 'bg-red-500/10 border-red-500/20' : 'bg-yellow-500/10 border-yellow-500/20'}`}>
                        {effectiveStatus === 'success' ? <CheckCircle2 className="text-green-500 shrink-0" size={32} /> : effectiveStatus === 'failure' ? <XCircle className="text-red-500 shrink-0" size={32} /> : <AlertCircle className="text-yellow-500 shrink-0" size={32} />}
                        <div>
                            <h3 className="text-xl font-bold text-white">{effectiveStatus === 'success' ? '¡Pago Exitoso!' : effectiveStatus === 'failure' ? 'Hubo un error' : 'Pago Pendiente'}</h3>
                            <p className="text-bb-text-secondary text-sm">{effectiveStatus === 'success' ? 'Tu compra se ha procesado correctamente.' : effectiveStatus === 'failure' ? 'No pudimos procesar tu pago.' : 'Te avisaremos cuando se complete.'}</p>
                        </div>
                    </div>
                )}

                {/* Header Section */}
                <div className="text-center space-y-8">
                    <div className="space-y-4">
                        <h1 className="text-4xl sm:text-7xl font-[1000] text-white tracking-tighter uppercase italic leading-none drop-shadow-2xl">
                            TIENDA <span className="bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">NITRO</span>
                        </h1>
                        <p className="text-zinc-400 text-sm sm:text-xl font-medium max-w-2xl mx-auto">
                            Únete a la élite de CampusLink y personaliza tu perfil con ventajas exclusivas.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <div className="bg-black/40 backdrop-blur-xl p-1.5 rounded-2xl border border-white/10 flex items-center shadow-2xl">
                            <button
                                onClick={() => setActiveView('items')}
                                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${activeView === 'items' ? 'bg-indigo-600 text-white shadow-[0_0_20px_rgba(79,70,229,0.4)]' : 'text-zinc-400 hover:text-white'}`}
                            >
                                <Package size={20} /> Artículos
                            </button>
                            <button
                                onClick={() => setActiveView('recharge')}
                                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${activeView === 'recharge' ? 'bg-indigo-600 text-white shadow-[0_0_20px_rgba(79,70,229,0.4)]' : 'text-zinc-400 hover:text-white'}`}
                            >
                                <Zap size={20} /> Monedas y VIP
                            </button>
                        </div>
                        {(profile?.role === 'admin' || profile?.role === 'superadmin') && (
                            <Link href="/admin/store-config">
                                <Button className="h-12 px-6 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold rounded-xl gap-2 backdrop-blur-md transition-all">
                                    <Settings size={20} /> Configurar
                                </Button>
                            </Link>
                        )}
                    </div>
                </div>

                {
                    activeView === 'recharge' ? (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                            {/* VIP Section - Nitro Inspired */}
                            {vipProduct && (
                                <div className="lg:col-span-12 relative group">
                                    <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-[2.5rem] blur opacity-25 group-hover:opacity-40 transition duration-1000" />
                                    <div className="relative bg-[#16161a] rounded-[2rem] border border-white/5 overflow-hidden p-6 sm:p-12 flex flex-col lg:flex-row items-center gap-12">
                                        {/* Mascot Origi - Left side on desktop, Top on mobile */}
                                        {mascotConfig?.is_visible !== false && (
                                            <div
                                                className="w-full lg:w-1/2 flex justify-center relative order-first"
                                                style={{
                                                    marginLeft: mascotConfig ? `${mascotConfig.x_pos}px` : '0',
                                                    marginTop: mascotConfig ? `${mascotConfig.y_pos}px` : '0',
                                                    transform: mascotConfig ? `scale(${mascotConfig.scale})` : 'none'
                                                }}
                                            >
                                                <div className="absolute inset-0 bg-indigo-500/20 blur-[80px] rounded-full" />
                                                <img
                                                    src="/tienda/origi (3).png"
                                                    alt="Origi Mascot"
                                                    className="w-[280px] sm:w-[450px] object-contain relative z-10 animate-float"
                                                />
                                            </div>
                                        )}

                                        <div className="w-full lg:w-1/2 space-y-8 text-center lg:text-left">
                                            <div className="space-y-4">
                                                <h2 className="text-4xl sm:text-6xl font-black text-white italic tracking-tighter uppercase leading-none">
                                                    CONVIÉRTETE EN <span className="text-yellow-400">VIP</span>
                                                </h2>
                                                <p className="text-zinc-400 text-lg sm:text-xl font-medium">
                                                    Acceso total, descargas ilimitadas y estilo absoluto. desbloquea el lado más potente de CampusLink.
                                                </p>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {[
                                                    { text: 'Descargas ilimitadas', icon: Check },
                                                    { text: 'Grupos exclusivos', icon: Check },
                                                    { text: 'Insignia dorada', icon: Check },
                                                    { text: 'Soporte prioritario', icon: Check }
                                                ].map((f, i) => (
                                                    <div key={i} className="flex items-center gap-3 bg-white/5 p-4 rounded-2xl border border-white/5">
                                                        <div className="p-1 bg-green-500/20 rounded-full"><Check className="text-green-500 w-4 h-4" /></div>
                                                        <span className="text-white font-bold">{f.text}</span>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="flex flex-col sm:flex-row items-center gap-6 pt-4">
                                                <div className="text-5xl font-[1000] text-white">S/ {vipProduct.price} <span className="text-sm text-zinc-500 font-bold uppercase tracking-widest">/ {vipProduct.amount} días</span></div>
                                                <Button
                                                    onClick={() => handlePurchase(vipProduct.id)}
                                                    className="w-full sm:w-auto h-16 px-12 bg-white text-black hover:bg-zinc-200 text-xl font-[900] rounded-2xl transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)] uppercase italic"
                                                >
                                                    SUSCRIBIRSE
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Coins Section */}
                            <div className="lg:col-span-12 space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-yellow-500/10 rounded-2xl border border-yellow-500/20">
                                        <Zap className="text-yellow-400" size={32} />
                                    </div>
                                    <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">Paquetes de Monedas</h2>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {coinPackages.map((pkg, idx) => {
                                        // Map specific images based on index or amount
                                        const coinImg = pkg.amount <= 100 ? '/tienda/ChatGPT Image 20 feb 2026, 12_02_20 (1) 1.png' :
                                            pkg.amount <= 500 ? '/tienda/ChatGPT Image 20 feb 2026, 12_02_20 (1)2.png' :
                                                '/tienda/ChatGPT Image 20 feb 2026, 12_02_20 (1) 4.png';

                                        return (
                                            <div
                                                key={pkg.id}
                                                onClick={() => handlePurchase(pkg.id)}
                                                className="group relative bg-[#16161a] border border-white/5 h-full rounded-[2rem] p-8 hover:bg-[#1a1a20] transition-all cursor-pointer hover:-translate-y-2 overflow-hidden shadow-2xl"
                                            >
                                                <div className="absolute top-0 right-0 p-4 font-black text-white/5 text-6xl italic pointer-events-none select-none">
                                                    {pkg.amount}
                                                </div>

                                                <div className="relative z-10 space-y-8 text-center">
                                                    <div className="h-32 flex items-center justify-center">
                                                        <img src={coinImg} alt="Monedas" className="h-full object-contain group-hover:scale-110 transition-transform duration-500 animate-float" style={{ animationDelay: `${idx * 0.2}s` }} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <h3 className="text-2xl font-black text-white uppercase italic">{pkg.name}</h3>
                                                        <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">{pkg.amount} Monedas de Oro</p>
                                                    </div>
                                                    <div className="pt-4 border-t border-white/5">
                                                        <div className="text-2xl font-black text-indigo-400">S/ {pkg.price}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="bg-indigo-500/10 border border-indigo-500/20 p-6 rounded-3xl flex gap-4 max-w-2xl mx-auto">
                                    <Info className="text-indigo-400 shrink-0" size={24} />
                                    <p className="text-sm text-indigo-200 font-medium">Las monedas se acreditan instantáneamente después de confirmar el pago a través de Mercado Pago.</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Shop Items Section */
                        <div className="space-y-16 animate-in fade-in slide-in-from-bottom-8 duration-700">
                            {shopCategories.map((category) => {
                                const categoryItems = shopItems.filter(item => item.category_id === category.id);
                                if (categoryItems.length === 0) return null;

                                return (
                                    <div key={category.id} className="space-y-10">
                                        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 border-b border-white/5 pb-8">
                                            <div className="space-y-4">
                                                <span className="text-indigo-400 font-black uppercase tracking-[0.4em] text-xs">Colección Limitada</span>
                                                <h2 className="text-4xl sm:text-5xl font-black text-white italic tracking-tighter uppercase">{category.name}</h2>
                                            </div>
                                            {(profile?.role === 'admin' || profile?.role === 'superadmin') && (
                                                <Link href="/admin/shop"><Button className="rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 h-11 px-6 font-bold shadow-2xl backdrop-blur-md">Gestionar {category.name}</Button></Link>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                                            {categoryItems.map((item) => {
                                                const isOwned = userInventory.includes(item.id);
                                                return (
                                                    <div
                                                        key={item.id}
                                                        className={`group relative bg-[#131317] border border-white/5 rounded-[2rem] p-6 hover:bg-[#16161c] transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] overflow-hidden ${isOwned ? 'opacity-70 grayscale-[0.5]' : ''}`}
                                                    >
                                                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent pointer-events-none" />

                                                        <div className="relative z-10 flex flex-col h-full space-y-6">
                                                            <div className="relative aspect-square flex items-center justify-center cursor-pointer" onClick={() => setPreviewItem(item)}>
                                                                <div className="absolute inset-0 bg-indigo-500/10 blur-[40px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                                                                <img src={item.image_url || ''} alt={item.name} className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-700 drop-shadow-[0_20px_30px_rgba(0,0,0,0.5)]" />
                                                            </div>

                                                            <div className="space-y-2">
                                                                <div className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em]">{item.type.replace('_', ' ')}</div>
                                                                <h3 className="text-lg font-black text-white uppercase italic leading-tight truncate">{item.name}</h3>
                                                                <p className="text-zinc-500 text-xs font-medium line-clamp-2 leading-relaxed min-h-[40px]">{item.description}</p>
                                                            </div>

                                                            <div className="pt-4 border-t border-white/5 flex items-center justify-between gap-4">
                                                                {!isOwned && (
                                                                    <div className="flex items-center gap-2 bg-black px-3 py-2 rounded-xl">
                                                                        <img src="/icons/moneda.png" alt="Coin" className="w-5 h-5 flex-shrink-0" />
                                                                        <span className="text-white font-black">{item.price_coins}</span>
                                                                    </div>
                                                                )}
                                                                {isOwned ? (
                                                                    <Button className="flex-1 rounded-xl bg-zinc-800 text-zinc-500 font-bold h-11" disabled>ADQUIRIDO</Button>
                                                                ) : (
                                                                    <Button onClick={() => setPreviewItem(item)} className="flex-1 rounded-xl bg-white text-black hover:bg-zinc-200 font-black h-11 italic shadow-xl">VISTA PREVIA</Button>
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

                            {/* Uncategorized Items (Profile Frames by default if no cat assigned yet) */}
                            {shopItems.filter(item => !item.category_id).length > 0 && (
                                <div className="space-y-10">
                                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 border-b border-white/5 pb-8">
                                        <div className="space-y-4">
                                            <span className="text-indigo-400 font-black uppercase tracking-[0.4em] text-xs">Colección Limitada</span>
                                            <h2 className="text-4xl sm:text-5xl font-black text-white italic tracking-tighter uppercase">Otros Artículos</h2>
                                        </div>
                                        {(profile?.role === 'admin' || profile?.role === 'superadmin') && (
                                            <Link href="/admin/shop"><Button className="rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 h-11 px-6 font-bold shadow-2xl backdrop-blur-md">Gestionar Artículos</Button></Link>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                                        {shopItems.filter(item => !item.category_id).map((item) => {
                                            const isOwned = userInventory.includes(item.id);

                                            return (
                                                <div
                                                    key={item.id}
                                                    className={`group relative bg-[#131317] border border-white/5 rounded-[2rem] p-6 hover:bg-[#16161c] transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] overflow-hidden ${isOwned ? 'opacity-70 grayscale-[0.5]' : ''}`}
                                                >
                                                    {/* Gradient Bg */}
                                                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent pointer-events-none" />

                                                    {/* Content Container */}
                                                    <div className="relative z-10 flex flex-col h-full space-y-6">

                                                        {/* Item Preview */}
                                                        <div
                                                            className="relative aspect-square flex items-center justify-center cursor-pointer"
                                                            onClick={() => setPreviewItem(item)}
                                                        >
                                                            {/* Sparkle effect on hover */}
                                                            <div className="absolute inset-0 bg-indigo-500/10 blur-[40px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />

                                                            <img
                                                                src={item.image_url || ''}
                                                                alt={item.name}
                                                                className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-110 drop-shadow-[0_20px_30px_rgba(0,0,0,0.5)]"
                                                            />
                                                        </div>

                                                        {/* Category Label */}
                                                        <div className="space-y-2">
                                                            <div className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em]">
                                                                {item.type.replace('_', ' ')}
                                                            </div>

                                                            {/* Title */}
                                                            <h3 className="text-lg font-black text-white uppercase italic leading-tight truncate">
                                                                {item.name}
                                                            </h3>

                                                            {/* Description */}
                                                            <p className="text-zinc-500 text-xs font-medium line-clamp-2 leading-relaxed min-h-[40px]">
                                                                {item.description}
                                                            </p>
                                                        </div>

                                                        <div className="pt-4 border-t border-white/5 flex items-center justify-between gap-4">
                                                            {/* Price */}
                                                            {!isOwned && (
                                                                <div className="flex items-center gap-2 bg-black px-3 py-2 rounded-xl">
                                                                    <img src="/icons/moneda.png" alt="Coin" className="w-5 h-5 flex-shrink-0" />
                                                                    <span className="text-white font-black">{item.price_coins}</span>
                                                                </div>
                                                            )}

                                                            {/* Action Button */}
                                                            {isOwned ? (
                                                                <Button
                                                                    className="flex-1 rounded-xl bg-zinc-800 text-zinc-500 font-bold h-11"
                                                                    disabled
                                                                >
                                                                    ADQUIRIDO
                                                                </Button>
                                                            ) : (
                                                                <Button
                                                                    onClick={() => setPreviewItem(item)}
                                                                    className="flex-1 rounded-xl bg-white text-black hover:bg-zinc-200 font-black h-11 italic shadow-xl"
                                                                >
                                                                    VISTA PREVIA
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                }
            </div>

            {/* Nitro Style Footer Badges */}
            <div className="max-w-6xl mx-auto pt-24 pb-12 opacity-20 hover:opacity-100 transition-all duration-1000">
                <div className="flex flex-wrap justify-center gap-12 grayscale hover:grayscale-0 transition-all">
                    <div className="flex items-center gap-3"><ShieldCheck className="text-indigo-400" /> <span className="text-white font-black italic uppercase tracking-wider text-sm">Transacción Encriptada</span></div>
                    <div className="flex items-center gap-3"><Star className="text-yellow-400" /> <span className="text-white font-black italic uppercase tracking-wider text-sm">Artículos Únicos</span></div>
                    <div className="flex items-center gap-3"><Zap className="text-blue-400" /> <span className="text-white font-black italic uppercase tracking-wider text-sm">Instante Nitro</span></div>
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
            <PaymentModal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} product={selectedProduct} onPaymentSuccess={handlePaymentSuccess} onPaymentError={handlePaymentError} />

            <style jsx global>{`
                @keyframes float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-20px); }
                }
                .animate-float {
                    animation: float 6s ease-in-out infinite;
                }
                body {
                    background-color: #0a0a0c;
                }
            `}</style>
        </div>
    );
}
