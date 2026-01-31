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

export default function StorePage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-bb-text-secondary animate-pulse">Cargando tienda...</div>}>
            <StoreContent />
        </Suspense>
    );
}

function StoreContent() {
    const { colors } = useTheme();
    const { profile, refreshProfile } = useProfile();
    const searchParams = useSearchParams();
    const [itemsLoading, setItemsLoading] = useState<Record<string, boolean>>({});
    const [shopItems, setShopItems] = useState<ShopItem[]>([]);
    const [previewItem, setPreviewItem] = useState<ShopItem | null>(null);
    const [userInventory, setUserInventory] = useState<string[]>([]); // Just store item IDs
    const [purchaseMessage, setPurchaseMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [activeView, setActiveView] = useState<'items' | 'recharge'>('items');

    const status = searchParams.get('status');

    React.useEffect(() => {
        if (status === 'success') {
            refreshProfile();
        }
    }, [status, refreshProfile]);

    const [shopCategories, setShopCategories] = useState<ShopCategory[]>([]);

    const [coinPackages, setCoinPackages] = useState<StoreProduct[]>([]);
    const [vipProduct, setVipProduct] = useState<StoreProduct | null>(null);

    // Fetch shop items, categories, and recharge products (VIP/Coins)
    useEffect(() => {
        const fetchData = async () => {
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
    } | null>(null);

    const handlePurchase = (productId: string) => {
        const selectedPackage = coinPackages.find(p => p.id === productId) || vipProduct;
        if (!selectedPackage) return;

        setSelectedProduct({
            id: selectedPackage.id,
            name: selectedPackage.name,
            price: selectedPackage.price,
            type: selectedPackage.type,
        });
        setIsPaymentModalOpen(true);
    };

    const handlePaymentSuccess = async (result: any) => {
        // The modal now handles the "Success View" and will be closed by the user.
        // We ensure data is refreshed immediately.
        console.log('Payment successful, refreshing profile...');
        await refreshProfile();
        // Option: show a detailed toast if needed, but the modal has a big success screen now.
    };

    const handlePaymentError = (error: any) => {
        console.error('Payment Error:', error);
        // Do not close modal automatically on error, let user try again or see error in Brick
        // But for generic API errors we might want to show a toast
        setPurchaseMessage({ type: 'error', text: 'Error al procesar el pago. Intenta nuevamente.' });
    };

    return (
        <div className="p-3 sm:p-8 max-w-6xl mx-auto space-y-8 sm:space-y-12">
            {/* Alert Messages for Payment Status */}
            {status === 'success' && (
                <div className="bg-green-500/10 border border-green-500/20 p-6 rounded-3xl flex items-center gap-4 animate-in fade-in slide-in-from-top-4">
                    <CheckCircle2 className="text-green-500 flex-shrink-0" size={32} />
                    <div>
                        <h3 className="text-xl font-bold text-bb-text">¡Pago Exitoso!</h3>
                        <p className="text-bb-text-secondary">Tu compra se ha procesado correctamente. Los beneficios se verán reflejados en breve.</p>
                    </div>
                </div>
            )}

            {status === 'failure' && (
                <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-3xl flex items-center gap-4 animate-in fade-in slide-in-from-top-4">
                    <XCircle className="text-red-500 flex-shrink-0" size={32} />
                    <div>
                        <h3 className="text-xl font-bold text-bb-text">Hubo un error</h3>
                        <p className="text-bb-text-secondary">No pudimos procesar tu pago. Por favor, intenta de nuevo o contacta a soporte.</p>
                    </div>
                </div>
            )}

            {status === 'pending' && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 p-6 rounded-3xl flex items-center gap-4 animate-in fade-in slide-in-from-top-4">
                    <AlertCircle className="text-yellow-500 flex-shrink-0" size={32} />
                    <div>
                        <h3 className="text-xl font-bold text-bb-text">Pago Pendiente</h3>
                        <p className="text-bb-text-secondary">Tu pago está siendo procesado por Mercado Pago. Te avisaremos cuando se complete.</p>
                    </div>
                </div>
            )}

            {/* Header Section */}
            <div className="flex flex-col items-center space-y-8 text-center">
                <div className="space-y-2 sm:space-y-4">
                    <h1 className="text-3xl sm:text-5xl font-black text-bb-text tracking-tight uppercase italic">
                        Tienda <span className="text-blue-500">CampusLink</span>
                    </h1>
                    <p className="text-bb-text-secondary text-sm sm:text-lg max-w-xl mx-auto">
                        Personaliza tu presencia digital y desbloquea el máximo potencial de tu perfil.
                    </p>
                </div>

                {/* View Toggle */}
                <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="bg-bb-sidebar/50 p-1 rounded-2xl border border-bb-border flex items-center shadow-xl w-full sm:w-auto">
                        <button
                            onClick={() => setActiveView('items')}
                            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold transition-all text-sm sm:text-base ${activeView === 'items'
                                ? 'bg-blue-600 text-white shadow-lg'
                                : 'text-bb-text-secondary hover:text-bb-text hover:bg-bb-hover'
                                }`}
                        >
                            <Package size={18} className="sm:w-5 sm:h-5" />
                            Artículos
                        </button>
                        <button
                            onClick={() => setActiveView('recharge')}
                            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold transition-all text-sm sm:text-base ${activeView === 'recharge'
                                ? 'bg-blue-600 text-white shadow-lg'
                                : 'text-bb-text-secondary hover:text-bb-text hover:bg-bb-hover'
                                }`}
                        >
                            <Zap size={18} className="sm:w-5 sm:h-5" />
                            Monedas y VIP
                        </button>
                    </div>

                    {(profile?.role === 'admin' || profile?.role === 'superadmin') && (
                        <Link href="/admin/store-config">
                            <Button
                                className="w-full sm:w-auto font-bold rounded-xl gap-2 shadow-lg h-10 sm:h-12 text-xs sm:text-sm bg-bb-sidebar border border-bb-border hover:bg-bb-hover"
                                style={{ borderColor: colors?.primary + '40' }}
                            >
                                <Settings size={18} className="sm:w-5 sm:h-5" />
                                Configurar Precios
                            </Button>
                        </Link>
                    )}
                </div>
            </div>

            {
                activeView === 'recharge' ? (
                    /* VIP and Coins Content */
                    <div key="recharge-view" className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 focus-visible:outline-none">

                        {/* VIP Section */}
                        {vipProduct && (
                            <div
                                className="relative overflow-hidden rounded-3xl border bg-bb-card p-5 sm:p-8 shadow-2xl transition-all hover:scale-[1.01]"
                                style={{ borderColor: colors?.primary + '40' }}
                            >
                                <div
                                    className="absolute top-0 right-0 p-4 opacity-10 hidden sm:block"
                                    style={{ color: colors?.primary }}
                                >
                                    <Zap size={120} />
                                </div>

                                <div className="space-y-4 sm:space-y-6 relative z-10">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="p-2 sm:p-3 rounded-2xl"
                                            style={{ backgroundColor: colors?.primary + '20', color: colors?.primary }}
                                        >
                                            <CreditCard size={24} className="sm:w-8 sm:h-8" />
                                        </div>
                                        <h2 className="text-xl sm:text-3xl font-bold text-bb-text">{vipProduct.name}</h2>
                                    </div>

                                    <p className="text-bb-text-secondary">
                                        Accede a contenido premium, descarga material ilimitado y obtén una insignia exclusiva en tu perfil.
                                    </p>

                                    <ul className="grid grid-cols-1 sm:grid-cols-1 gap-2 sm:gap-4">
                                        {[
                                            'Descargas ilimitadas de material',
                                            'Acceso a grupos exclusivos',
                                            'Insignia VIP dorada en el perfil',
                                            'Soporte prioritario 24/7'
                                        ].map((feature, i) => (
                                            <li key={i} className="flex items-center gap-2 sm:gap-3 text-bb-text text-sm sm:text-base">
                                                <CheckCircle2 className="text-green-500 flex-shrink-0" size={18} />
                                                <span>{feature}</span>
                                            </li>
                                        ))}
                                    </ul>

                                    <div className="pt-2 sm:pt-6">
                                        <div className="flex items-end gap-2 mb-4 sm:mb-6">
                                            <span className="text-3xl sm:text-5xl font-black text-bb-text">S/ {vipProduct.price}</span>
                                            <span className="text-bb-text-secondary text-sm mb-1 sm:mb-2">/ {vipProduct.amount} días</span>
                                        </div>

                                        <Button
                                            className="w-full h-12 sm:h-14 text-base sm:text-lg font-bold rounded-2xl transition-all shadow-lg active:scale-95"
                                            style={{ backgroundColor: colors?.primary, color: 'white' }}
                                            onClick={() => handlePurchase(vipProduct.id)}
                                            disabled={itemsLoading[vipProduct.id]}
                                        >
                                            {itemsLoading[vipProduct.id] ? 'Procesando...' : 'Convertirme en VIP'}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Coins Section */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-3">
                                <div
                                    className="p-2 sm:p-3 rounded-2xl"
                                    style={{ backgroundColor: '#FFD70020', color: '#FFD700' }}
                                >
                                    <img src="/icons/moneda.png" alt="Coins" className="w-6 h-6 sm:w-8 sm:h-8 object-contain" />
                                </div>
                                <h2 className="text-xl sm:text-3xl font-bold text-bb-text">Paquetes de Monedas</h2>
                            </div>

                            <p className="text-bb-text-secondary text-sm sm:text-base">
                                Usa monedas para comprar artículos de personalización, marcos para fotos y más.
                            </p>

                            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                                {coinPackages.map((pkg) => {
                                    // Definir configuración visual según el monto
                                    const getStackLayout = (amount: number) => {
                                        if (amount <= 100) {
                                            return (
                                                <div className="relative w-16 h-16 animate-float">
                                                    <img src="/icons/moneda.png" alt="Coin" className="w-12 h-12 object-contain absolute top-0 left-0 drop-shadow-lg" />
                                                    <img src="/icons/moneda.png" alt="Coin" className="w-12 h-12 object-contain absolute bottom-0 right-0 z-10 drop-shadow-lg" />
                                                </div>
                                            );
                                        }
                                        if (amount <= 500) {
                                            return (
                                                <div className="relative w-20 h-16 animate-float" style={{ animationDelay: '0.5s' }}>
                                                    <img src="/icons/moneda.png" alt="Coin" className="w-12 h-12 object-contain absolute top-0 left-0 opacity-80" />
                                                    <img src="/icons/moneda.png" alt="Coin" className="w-12 h-12 object-contain absolute top-2 left-4 scale-105 z-10" />
                                                    <img src="/icons/moneda.png" alt="Coin" className="w-12 h-12 object-contain absolute bottom-0 right-0 z-20 drop-shadow-lg" />
                                                </div>
                                            );
                                        }
                                        return (
                                            <div className="relative w-24 h-20 animate-float" style={{ animationDelay: '1s' }}>
                                                <img src="/icons/moneda.png" alt="Coin" className="w-12 h-12 object-contain absolute top-0 left-0 opacity-60" />
                                                <img src="/icons/moneda.png" alt="Coin" className="w-12 h-12 object-contain absolute top-0 right-4 opacity-80" />
                                                <img src="/icons/moneda.png" alt="Coin" className="w-12 h-12 object-contain absolute bottom-0 left-4 scale-110 z-20" />
                                                <img src="/icons/moneda.png" alt="Coin" className="w-12 h-12 object-contain absolute bottom-1 right-2 scale-105 z-10" />
                                                <img src="/icons/moneda.png" alt="Coin" className="w-12 h-12 object-contain absolute top-4 left-1/2 -translate-x-1/2 scale-125 z-30 drop-shadow-xl" />
                                            </div>
                                        );
                                    };

                                    return (
                                        <div
                                            key={pkg.id}
                                            className={`p-4 sm:p-8 rounded-3xl border bg-bb-sidebar hover:bg-bb-hover transition-all duration-300 cursor-pointer group hover:shadow-[0_0_20px_rgba(255,215,0,0.15)] flex flex-col items-center text-center ${itemsLoading[pkg.id] ? 'opacity-70 pointer-events-none' : ''}`}
                                            style={{ borderColor: colors?.primary + '20' }}
                                            onClick={() => handlePurchase(pkg.id)}
                                        >
                                            <div className="h-16 sm:h-28 flex items-center justify-center mb-4 sm:mb-6">
                                                {itemsLoading[pkg.id] ? (
                                                    <div className="flex flex-col items-center gap-2">
                                                        <div className="w-8 h-8 border-4 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin" />
                                                        <span className="text-xs font-bold text-yellow-500">Cargando...</span>
                                                    </div>
                                                ) : (
                                                    getStackLayout(pkg.amount)
                                                )}
                                            </div>

                                            <div className="space-y-1 sm:space-y-2">
                                                <span className="bg-bb-card px-2 py-0.5 sm:px-3 sm:py-1 rounded-lg text-[10px] sm:text-xs font-bold text-bb-text border border-bb-border">
                                                    S/ {Number(pkg.price).toFixed(2)}
                                                </span>
                                                <h3 className="text-sm sm:text-2xl font-black text-bb-text line-clamp-1">{pkg.name}</h3>
                                                <p className="text-[10px] sm:text-sm text-bb-text-secondary">{pkg.amount} Monedas</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl flex gap-3">
                                <Info className="text-blue-400 flex-shrink-0" size={20} />
                                <p className="text-sm text-blue-200">
                                    Las monedas se acreditan instantáneamente después de confirmar el pago.
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Shop Items Content */
                    <div key="items-view" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Purchase Feedback Message */}
                        {purchaseMessage && (
                            <div className={`p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 ${purchaseMessage.type === 'success'
                                ? 'bg-green-500/10 border border-green-500/20'
                                : 'bg-red-500/ red-500/10 border border-red-500/20'
                                }`}>
                                {purchaseMessage.type === 'success' ? (
                                    <CheckCircle2 className="text-green-500" size={24} />
                                ) : (
                                    <XCircle className="text-red-500" size={24} />
                                )}
                                <p className="text-bb-text font-medium">{purchaseMessage.text}</p>
                            </div>
                        )}

                        {/* Grouped Content */}
                        <div className="space-y-12 sm:space-y-16">
                            {shopCategories.map((category) => {
                                const categoryItems = shopItems.filter(item => item.category_id === category.id);
                                if (categoryItems.length === 0) return null;

                                return (
                                    <div key={category.id} className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="p-2 sm:p-3 rounded-2xl"
                                                    style={{ backgroundColor: colors?.primary + '20', color: colors?.primary }}
                                                >
                                                    {/* In a real app we'd map category.icon to a Lucide component */}
                                                    <Package size={24} className="sm:w-8 sm:h-8" />
                                                </div>
                                                <div>
                                                    <h2 className="text-xl sm:text-3xl font-bold text-bb-text">{category.name}</h2>
                                                    <p className="text-bb-text-secondary text-sm sm:text-base">Colección de {category.name.toLowerCase()}</p>
                                                </div>
                                            </div>
                                            {(profile?.role === 'admin' || profile?.role === 'superadmin') && (
                                                <Link href="/admin/shop">
                                                    <Button
                                                        className="w-full sm:w-auto font-bold rounded-xl gap-2 shadow-lg h-10 sm:h-11 text-xs sm:text-sm"
                                                        style={{ backgroundColor: colors?.primary }}
                                                    >
                                                        <ShieldCheck size={18} className="sm:w-5 sm:h-5" />
                                                        Administrar Tienda
                                                    </Button>
                                                </Link>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
                                            {categoryItems.map((item) => {
                                                const isOwned = userInventory.includes(item.id);

                                                return (
                                                    <div
                                                        key={item.id}
                                                        className={`group relative rounded-3xl bg-[#1e1f22] border border-[#2b2d31] overflow-hidden hover:-translate-y-1 transition-all duration-300 hover:shadow-2xl hover:shadow-black/50 ${isOwned ? 'opacity-80' : ''}`}
                                                    >
                                                        {/* Gradient Bg */}
                                                        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#2b2d31] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                                                        {/* Content Container */}
                                                        <div className="p-6 flex flex-col h-full relative z-10">

                                                            {/* Item Preview */}
                                                            <div
                                                                className="relative w-full aspect-square mb-6 flex items-center justify-center cursor-pointer"
                                                                onClick={() => setPreviewItem(item)}
                                                            >
                                                                {/* Sparkle effect on hover */}
                                                                <div className="absolute inset-0 bg-blue-500/5 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />

                                                                <img
                                                                    src={item.image_url || ''}
                                                                    alt={item.name}
                                                                    className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-110 drop-shadow-2xl"
                                                                />
                                                            </div>

                                                            {/* Category Label */}
                                                            <div className="text-xs font-bold text-[#949ba4] uppercase tracking-wider mb-2">
                                                                {item.type === 'profile_frame' ? 'Avatar Decoration' : 'Item'}
                                                            </div>

                                                            {/* Title */}
                                                            <h3 className="text-white font-bold text-lg leading-tight mb-2 truncate">
                                                                {item.name}
                                                            </h3>

                                                            {/* Description */}
                                                            <p className="text-[#949ba4] text-xs line-clamp-2 mb-4 leading-relaxed h-8">
                                                                {item.description}
                                                            </p>

                                                            <div className="mt-auto pt-4 border-t border-[#2b2d31]/50 flex items-center justify-between gap-4">
                                                                {/* Price */}
                                                                {!isOwned && (
                                                                    <div className="flex items-center gap-2 bg-black/20 px-3 py-1.5 rounded-lg">
                                                                        <img src="/icons/moneda.png" alt="Coin" className="w-5 h-5 object-contain" />
                                                                        <span className="text-[#f2f3f5] font-bold text-lg">{item.price_coins}</span>
                                                                    </div>
                                                                )}

                                                                {/* Action Button */}
                                                                {isOwned ? (
                                                                    <Button
                                                                        className="w-full bg-[#2b2d31] text-[#949ba4] hover:bg-[#313338] font-bold rounded-xl"
                                                                        disabled
                                                                    >
                                                                        Adquirido
                                                                    </Button>
                                                                ) : (
                                                                    <Button
                                                                        onClick={() => setPreviewItem(item)}
                                                                        className="w-full bg-[#4e5058] hover:bg-[#6d6f78] text-white font-bold rounded-xl transition-all"
                                                                    >
                                                                        Vista Previa
                                                                    </Button>
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
                                <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 sm:p-3 rounded-2xl bg-gray-500/10 text-gray-400">
                                            <Package size={24} className="sm:w-8 sm:h-8" />
                                        </div>
                                        <h2 className="text-xl sm:text-3xl font-bold text-bb-text">Otros Artículos</h2>
                                    </div>
                                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
                                        {shopItems.filter(item => !item.category_id).map((item) => {
                                            const isOwned = userInventory.includes(item.id);

                                            return (
                                                <div
                                                    key={item.id}
                                                    className={`group relative rounded-3xl bg-[#1e1f22] border border-[#2b2d31] overflow-hidden hover:-translate-y-1 transition-all duration-300 hover:shadow-2xl hover:shadow-black/50 ${isOwned ? 'opacity-80' : ''}`}
                                                >
                                                    {/* Gradient Bg */}
                                                    <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#2b2d31] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                                                    {/* Content Container */}
                                                    <div className="p-6 flex flex-col h-full relative z-10">

                                                        {/* Item Preview */}
                                                        <div
                                                            className="relative w-full aspect-square mb-6 flex items-center justify-center cursor-pointer"
                                                            onClick={() => setPreviewItem(item)}
                                                        >
                                                            {/* Sparkle effect on hover */}
                                                            <div className="absolute inset-0 bg-blue-500/5 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />

                                                            <img
                                                                src={item.image_url || ''}
                                                                alt={item.name}
                                                                className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-110 drop-shadow-2xl"
                                                            />
                                                        </div>

                                                        {/* Category Label */}
                                                        <div className="text-xs font-bold text-[#949ba4] uppercase tracking-wider mb-2">
                                                            {item.type === 'profile_frame' ? 'Avatar Decoration' : 'Item'}
                                                        </div>

                                                        {/* Title */}
                                                        <h3 className="text-white font-bold text-lg leading-tight mb-2 truncate">
                                                            {item.name}
                                                        </h3>

                                                        {/* Description */}
                                                        <p className="text-[#949ba4] text-xs line-clamp-2 mb-4 leading-relaxed h-8">
                                                            {item.description}
                                                        </p>

                                                        <div className="mt-auto pt-4 border-t border-[#2b2d31]/50 flex items-center justify-between gap-4">
                                                            {/* Price */}
                                                            {!isOwned && (
                                                                <div className="flex items-center gap-2 bg-black/20 px-3 py-1.5 rounded-lg">
                                                                    <img src="/icons/moneda.png" alt="Coin" className="w-5 h-5 object-contain" />
                                                                    <span className="text-[#f2f3f5] font-bold text-lg">{item.price_coins}</span>
                                                                </div>
                                                            )}

                                                            {/* Action Button */}
                                                            {isOwned ? (
                                                                <Button
                                                                    className="w-full bg-[#2b2d31] text-[#949ba4] hover:bg-[#313338] font-bold rounded-xl"
                                                                    disabled
                                                                >
                                                                    Adquirido
                                                                </Button>
                                                            ) : (
                                                                <Button
                                                                    onClick={() => setPreviewItem(item)}
                                                                    className="w-full bg-[#4e5058] hover:bg-[#6d6f78] text-white font-bold rounded-xl transition-all"
                                                                >
                                                                    Vista Previa
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

                        {/* Empty State */}
                        {shopItems.length === 0 && (
                            <div className="text-center py-12">
                                <Package className="w-16 h-16 mx-auto text-bb-text-secondary/50 mb-4" />
                                <h3 className="text-xl font-bold text-bb-text mb-2">No hay artículos disponibles</h3>
                                <p className="text-bb-text-secondary">Pronto agregaremos más artículos exclusivos</p>
                            </div>
                        )}
                    </div>
                )
            }

            {/* Trust Badges */}
            <div className="pt-12 border-t border-bb-border flex flex-wrap justify-center gap-8 opacity-50 grayscale hover:grayscale-0 transition-all">
                <div className="flex items-center gap-2">
                    <ShieldCheck size={20} />
                    <span className="text-sm font-medium">Pago Seguro</span>
                </div>
                <div className="flex items-center gap-2">
                    <Star size={20} />
                    <span className="text-sm font-medium">Garantía CampusLink</span>
                </div>
                <div className="flex items-center gap-2">
                    <Zap size={20} />
                    <span className="text-sm font-medium">Activación Instantánea</span>
                </div>
            </div>

            {/* Preview Modal */}
            <PreviewModal
                isOpen={!!previewItem}
                onClose={() => setPreviewItem(null)}
                item={previewItem}
                profile={profile}
                onBuy={(item) => {
                    handleBuyItem(item);
                    setPreviewItem(null);
                }}
                isOwned={previewItem ? userInventory.includes(previewItem.id) : false}
                loading={previewItem ? itemsLoading[previewItem.id] : false}
                canAfford={previewItem ? (profile?.monedas ?? 0) >= previewItem.price_coins : false}
            />

            {/* Payment Modal */}
            <PaymentModal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                product={selectedProduct}
                onPaymentSuccess={handlePaymentSuccess}
                onPaymentError={handlePaymentError}
            />
        </div>
    );
}
