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
    Settings,
    Plus,
    Trash2,
    Calendar,
    Clock,
    Image as ImageIcon,
    Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useProfile } from '@/lib/profile-context';
import { apiFetch } from '@/lib/api';
import { useSearchParams } from 'next/navigation';
import { supabase, ShopItem, ShopCategory } from '@/lib/supabase';
import PaymentModal from '@/components/store/PaymentModal';
import PreviewModal from '@/components/store/PreviewModal';
import { motion } from 'framer-motion';

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
    expires_at: string;
    is_active: boolean;
    scale_factor: number;
    offset_x: number;
    offset_y: number;
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
    const [purchaseLoading, setPurchaseLoading] = useState(false);
    const [userInventory, setUserInventory] = useState<string[]>([]); // Just store item IDs
    const [shopItems, setShopItems] = useState<ShopItem[]>([]);
    const [previewItem, setPreviewItem] = useState<ShopItem | null>(null);
    const [purchaseMessage, setPurchaseMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [activeView, setActiveView] = useState<'items' | 'recharge'>('items');
    const [adminMode, setAdminMode] = useState<Record<string, boolean>>({});
    const [editingPrices, setEditingPrices] = useState<Record<string, number>>({});
    const [isUpdating, setIsUpdating] = useState<Record<string, boolean>>({});
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [isCreatingCategory, setIsCreatingCategory] = useState(false);

    const status = searchParams.get('status');
    const paymentStatus = searchParams.get('payment');
    const statusDetail = searchParams.get('status_detail');
    const effectiveStatus = paymentStatus || status;

    React.useEffect(() => {
        if (effectiveStatus === 'success' || effectiveStatus === 'approved') {
            refreshProfile();
        }
    }, [effectiveStatus, refreshProfile]);

    const [shopCategories, setShopCategories] = useState<ShopCategory[]>([]);

    const [coinPackages, setCoinPackages] = useState<StoreProduct[]>([]);
    const [vipProduct, setVipProduct] = useState<StoreProduct | null>(null);

    // VIP Frame State
    const [activeFrame, setActiveFrame] = useState<VipExclusiveFrame | null>(null);

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

            // 4. Fetch Active VIP Frame
            const { data: frameData } = await supabase
                .from('vip_exclusive_frames')
                .select('*')
                .eq('is_active', true)
                .single();
            if (frameData) setActiveFrame(frameData);
        };

        fetchData();
    }, [supabase]);

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

    const handleUpdateItem = async (itemId: string, updates: Partial<ShopItem>) => {
        try {
            setIsUpdating(prev => ({ ...prev, [itemId]: true }));
            const { error } = await supabase
                .from('shop_items')
                .update(updates)
                .eq('id', itemId);

            if (error) throw error;

            setShopItems(prev => prev.map(item => item.id === itemId ? { ...item, ...updates } : item));
        } catch (error: any) {
            console.error('Error updating item:', error);
            alert('Error al actualizar: ' + error.message);
        } finally {
            setIsUpdating(prev => ({ ...prev, [itemId]: false }));
        }
    };

    const handleDeleteItem = async (itemId: string) => {
        if (!confirm('¿Estás seguro de que deseas eliminar este artículo permanentemente?')) return;
        try {
            const { error } = await supabase
                .from('shop_items')
                .delete()
                .eq('id', itemId);

            if (error) throw error;
            setShopItems(prev => prev.filter(item => item.id !== itemId));
        } catch (error: any) {
            console.error('Error deleting item:', error);
            alert('Error al eliminar: ' + error.message);
        }
    };

    const handleCreateCategory = () => {
        setNewCategoryName('');
        setIsCategoryModalOpen(true);
    };

    const submitCreateCategory = async () => {
        if (!newCategoryName.trim()) return;
        try {
            setIsCreatingCategory(true);
            const { data, error } = await supabase
                .from('shop_categories')
                .insert([{ name: newCategoryName, is_active: true, display_order: shopCategories.length }])
                .select()
                .single();

            if (error) throw error;
            setShopCategories(prev => [...prev, data]);
            setIsCategoryModalOpen(false);
        } catch (error: any) {
            console.error('Error creating category:', error);
            alert('Error al crear categoría: ' + error.message);
        } finally {
            setIsCreatingCategory(false);
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
                console.log('[StorePage] Optimistically setting VIP status and frame');
                // For VIP we mark it true immediately and automatically equip the VIP frame
                updateProfile({
                    ...profile,
                    es_vip: true,
                    active_frame_key: 'vip_exclusive'
                });
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

    const bannerConfig = null;
    const mascotConfig = null;

    return (
        <div className="relative min-h-screen bg-[#0a0a0c] overflow-hidden px-4 sm:px-8 py-8 sm:py-16">
            {/* Nitro Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/20 blur-[120px] rounded-full animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[100px] rounded-full" />
            </div>

            <div className="max-w-6xl mx-auto space-y-16 relative z-10">
                {/* Alert Messages */}
                {effectiveStatus && (
                    <div className={`p-6 rounded-3xl flex items-center gap-4 animate-in fade-in slide-in-from-top-4 border ${(effectiveStatus === 'success' || effectiveStatus === 'approved')
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
                            <h3 className="text-xl font-bold text-white">
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
                <div className="max-w-4xl mx-auto pt-10 pb-6 sm:pt-14 sm:pb-8 relative">
                    <div className="space-y-4 lg:space-y-6">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
                            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em]">Exclusivo CampusLink</span>
                        </div>
                        <h1 className="text-5xl sm:text-8xl lg:text-9xl font-[1000] text-white italic tracking-tighter uppercase leading-none">
                            TIENDA <span className="bg-gradient-to-r from-indigo-400 to-purple-600 bg-clip-text text-transparent">NITRO</span>
                        </h1>
                        <p className="text-zinc-500 text-sm sm:text-xl lg:text-2xl font-black uppercase tracking-[0.2em] max-w-2xl mx-auto">
                            Únete a la élite de CampusLink y personaliza tu perfil con ventajas exclusivas.
                        </p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                    <div className="bg-black/40 backdrop-blur-2xl p-2 rounded-2xl border border-white/10 flex items-center shadow-2xl">
                        <button
                            onClick={() => setActiveView('items')}
                            className={`flex items-center gap-3 px-8 py-4 rounded-xl font-black transition-all uppercase italic tracking-wider ${activeView === 'items' ? 'bg-indigo-600 text-white shadow-[0_0_30px_rgba(79,70,229,0.5)]' : 'text-zinc-500 hover:text-white'}`}
                        >
                            <Package size={22} /> Artículos
                        </button>
                        <button
                            onClick={() => setActiveView('recharge')}
                            className={`flex items-center gap-3 px-8 py-4 rounded-xl font-black transition-all uppercase italic tracking-wider ${activeView === 'recharge' ? 'bg-indigo-600 text-white shadow-[0_0_30px_rgba(79,70,229,0.5)]' : 'text-zinc-500 hover:text-white'}`}
                        >
                            <Zap size={22} /> Monedas y VIP
                        </button>
                    </div>
                    {(profile?.role === 'admin' || profile?.role === 'superadmin') && (
                        <div className="flex gap-4">
                            <Button
                                onClick={handleCreateCategory}
                                className="h-16 px-6 sm:px-8 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-black uppercase italic rounded-2xl gap-3 backdrop-blur-md transition-all shadow-xl text-xs sm:text-base"
                            >
                                <Plus size={22} /> <span className="hidden sm:inline">Nueva Categoría</span>
                            </Button>
                            <Link href="/admin/store-config">
                                <Button className="h-16 px-6 sm:px-8 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-black uppercase italic rounded-2xl gap-3 backdrop-blur-md transition-all shadow-xl text-xs sm:text-base">
                                    <Settings size={22} /> <span className="hidden sm:inline">Configuración</span>
                                </Button>
                            </Link>
                        </div>
                    )}
                </div>

                {
                    activeView === 'recharge' ? (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
                            {/* VIP Section - Nitro Inspired */}
                            {vipProduct && (
                                <div className="lg:col-span-12 relative group">
                                    <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-[3rem] blur opacity-25 group-hover:opacity-40 transition duration-1000" />
                                    <div className="relative bg-[#111114] rounded-[2.5rem] border border-white/5 overflow-visible p-4 sm:p-16 flex flex-col lg:flex-row items-center gap-8 lg:gap-16 backdrop-blur-3xl">
                                        {/* Mascot Origi + Frame Component */}
                                        <div className="w-full lg:w-1/2 flex flex-col justify-center items-center relative order-first z-10 gap-8">
                                            <div className="absolute top-0 bottom-1/2 left-0 right-0 bg-indigo-500/25 blur-[100px] rounded-full pointer-events-none" />
                                            <img
                                                src="/tienda/orivipp.png"
                                                alt="Origi Mascot"
                                                className="w-[180px] sm:w-[400px] object-contain relative z-10 animate-float pointer-events-none select-none drop-shadow-2xl"
                                            />

                                            {/* VIP Exclusive Frame Showcase */}
                                            {activeFrame && new Date(activeFrame.expires_at) > new Date() && (
                                                <div className="relative w-full max-w-[320px] bg-black/40 border border-white/10 rounded-3xl p-5 backdrop-blur-md shadow-2xl overflow-hidden group/frame">
                                                    {(profile?.role === 'admin' || profile?.role === 'superadmin') && (
                                                        <Link
                                                            href="/admin/shop/vip-frame"
                                                            className="absolute top-3 right-3 z-20 p-2 bg-black/50 hover:bg-white/10 rounded-full transition-colors text-zinc-400 hover:text-white"
                                                            title="Editar marco"
                                                        >
                                                            <Settings size={14} />
                                                        </Link>
                                                    )}
                                                    <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 to-purple-500/10 opacity-50 pointer-events-none" />
                                                    <div className="flex flex-col items-center text-center gap-3 relative z-10">
                                                        <div className="px-3 py-1 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full flex items-center gap-1.5 shadow-[0_0_15px_rgba(245,158,11,0.4)]">
                                                            <Clock size={12} className="text-white animate-pulse" />
                                                            <span className="text-[9px] font-black text-white uppercase tracking-wider">Por tiempo limitado</span>
                                                        </div>
                                                        <div className="relative w-28 h-28 my-2">
                                                            <div className="absolute inset-0 bg-zinc-800 rounded-full flex items-center justify-center animate-pulse border-2 border-zinc-700">
                                                                <ImageIcon size={24} className="text-zinc-600" />
                                                            </div>
                                                            <div className="absolute inset-0 z-10 animate-float" style={{ animationDuration: '4s' }}>
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
                                                            <h4 className="text-white font-black italic uppercase text-lg leading-tight">{activeFrame.label}</h4>
                                                            {activeFrame.description && <p className="text-zinc-400 text-xs mt-1">{activeFrame.description}</p>}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            {(!activeFrame || new Date(activeFrame.expires_at) < new Date()) && (profile?.role === 'admin' || profile?.role === 'superadmin') && (
                                                <Link href="/admin/shop/vip-frame">
                                                    <Button
                                                        variant="ghost"
                                                        className="border border-white/10 bg-black/30 text-zinc-400 hover:text-white hover:bg-white/5 rounded-full text-xs font-bold gap-2"
                                                    >
                                                        <Plus size={14} /> Activar Marco Exclusivo
                                                    </Button>
                                                </Link>
                                            )}
                                        </div>

                                        <div className="w-full lg:w-1/2 space-y-6 lg:space-y-10 text-center lg:text-left">
                                            <div className="space-y-4 lg:space-y-8">
                                                <div className="space-y-2 lg:space-y-6">
                                                    <h2 className="text-3xl sm:text-7xl font-[1000] text-white italic tracking-tight uppercase leading-[1.1] pb-1 lg:pb-2">
                                                        CONVIÉRTETE EN <span className="bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent px-1 lg:px-2">VIP</span>
                                                    </h2>
                                                    <p className="text-zinc-400 text-sm sm:text-2xl font-medium leading-relaxed max-w-xl mx-auto lg:mx-0">
                                                        Acceso total, descargas ilimitadas y estilo absoluto. Desbloquea el lado más potente de CampusLink.
                                                    </p>
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-5">
                                                    {[
                                                        { text: 'Descargas ilimitadas', icon: Check },
                                                        { text: 'Grupos exclusivos', icon: Check },
                                                        { text: 'Insignia dorada', icon: Check },
                                                        { text: 'Soporte prioritario', icon: Check }
                                                    ].map((f, i) => (
                                                        <div key={i} className="flex items-center gap-3 lg:gap-4 bg-white/5 p-3 lg:p-5 rounded-xl lg:rounded-3xl border border-white/5 backdrop-blur-md">
                                                            <div className="p-1 lg:p-1.5 bg-green-500/20 rounded-full shadow-[0_0_15px_rgba(34,197,94,0.3)]"><Check className="text-green-500 w-3.5 h-3.5 lg:w-5 lg:h-5" /></div>
                                                            <span className="text-white font-black uppercase text-[10px] lg:text-sm italic">{f.text}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="flex flex-col sm:flex-row items-center gap-4 lg:gap-8 pt-2 lg:pt-6">
                                                <div className="text-4xl lg:text-6xl font-[1000] text-white tracking-tighter italic">S/ {vipProduct.price} <span className="text-xs text-zinc-500 font-bold uppercase tracking-[0.3em] block sm:inline mt-1 sm:mt-0">/ {vipProduct.amount} días</span></div>
                                                <Button
                                                    onClick={() => handlePurchase(vipProduct.id)}
                                                    className="w-full sm:w-auto h-14 lg:h-20 px-10 lg:px-16 bg-white text-black hover:bg-zinc-200 text-lg lg:text-2xl font-[1000] rounded-xl lg:rounded-[1.5rem] transition-all shadow-[0_0_50px_rgba(255,255,255,0.3)] uppercase italic tracking-tighter hover:scale-105"
                                                >
                                                    SUSCRIBIRSE
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Coins Section */}
                            <div className="lg:col-span-12 space-y-8 lg:space-y-12 animate-in fade-in slide-in-from-bottom-12 duration-1000">
                                <div className="flex items-center gap-4 lg:gap-6">
                                    <div className="p-3 lg:p-4 bg-yellow-500/10 rounded-2xl lg:rounded-3xl border border-yellow-500/20 shadow-xl backdrop-blur-md">
                                        <Zap className="text-yellow-400 w-7 h-7 lg:w-9 lg:h-9" />
                                    </div>
                                    <h2 className="text-2xl sm:text-5xl font-[1000] text-white italic uppercase tracking-tighter">Paquetes de Monedas</h2>
                                </div>

                                <div className="grid grid-cols-2 lg:grid-cols-12 gap-3 sm:gap-8 auto-rows-fr">
                                    {coinPackages.map((pkg, idx) => {
                                        // Map specific images based on index or amount
                                        const coinImg = pkg.amount <= 100 ? '/tienda/ChatGPT Image 20 feb 2026, 12_02_20 (1) 1.png' :
                                            pkg.amount <= 500 ? '/tienda/ChatGPT Image 20 feb 2026, 12_02_20 (1)2.png' :
                                                '/tienda/ChatGPT Image 20 feb 2026, 12_02_20 (1) 4.png';

                                        const isLarge = pkg.amount >= 1000;

                                        return (
                                            <div
                                                key={pkg.id}
                                                onClick={() => handlePurchase(pkg.id)}
                                                className={`group relative bg-[#131317] border border-white/5 rounded-[1.5rem] sm:rounded-[2.5rem] p-4 sm:p-10 hover:bg-[#18181f] transition-all cursor-pointer hover:-translate-y-3 overflow-hidden shadow-2xl flex flex-col justify-between
                                                    ${isLarge ? 'col-span-2 lg:col-span-6' : 'col-span-1 lg:col-span-3'}`}
                                            >
                                                <div className="absolute top-0 right-0 p-4 sm:p-6 font-[1000] text-white/[0.03] text-5xl sm:text-9xl italic pointer-events-none select-none">
                                                    {pkg.amount}
                                                </div>

                                                <div className="relative z-10 space-y-4 sm:space-y-10 text-center">
                                                    <div className={`${isLarge ? 'h-24 sm:h-56' : 'h-16 sm:h-40'} flex items-center justify-center`}>
                                                        <img src={coinImg} alt="Monedas" className="h-full object-contain group-hover:scale-110 transition-transform duration-700 animate-float drop-shadow-[0_20px_40px_rgba(255,191,0,0.2)]" style={{ animationDelay: `${idx * 0.2}s` }} />
                                                    </div>
                                                    <div className="space-y-1 sm:space-y-3">
                                                        <h3 className={`${isLarge ? 'text-xl sm:text-4xl' : 'text-xs sm:text-2xl'} font-[1000] text-white uppercase italic tracking-tighter`}>{pkg.name}</h3>
                                                        <p className="text-zinc-500 font-black uppercase tracking-[0.1em] text-[8px] sm:text-xs">{pkg.amount} Monedas</p>
                                                    </div>
                                                    <div className="pt-3 sm:pt-6 border-t border-white/5">
                                                        <div className={`${isLarge ? 'text-2xl sm:text-4xl' : 'text-sm sm:text-2xl'} font-[1000] text-indigo-400 italic`}>S/ {pkg.price}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="bg-indigo-500/10 border border-indigo-500/20 p-8 rounded-[2rem] flex items-center gap-6 max-w-3xl mx-auto backdrop-blur-3xl shadow-2xl">
                                    <div className="p-3 bg-indigo-500/20 rounded-2xl"><Info className="text-indigo-400" size={28} /></div>
                                    <p className="text-base text-indigo-100 font-bold italic">Las monedas se acreditan instantáneamente después de confirmar el pago a través de Mercado Pago.</p>
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
                                                <div className="flex items-center gap-2 sm:gap-4">
                                                    <Button
                                                        onClick={() => setAdminMode(prev => ({ ...prev, [category.id]: !prev[category.id] }))}
                                                        className={`rounded-xl h-11 px-4 sm:px-6 font-bold shadow-2xl backdrop-blur-md transition-all ${adminMode[category.id] ? 'bg-indigo-600 text-white' : 'bg-white/5 border border-white/10 hover:bg-white/10'}`}
                                                    >
                                                        {adminMode[category.id] ? 'Finalizar' : 'Gestionar'}
                                                    </Button>
                                                    <Link href={`/admin/shop/new?category_id=${category.id}`}>
                                                        <Button className="rounded-xl bg-indigo-600 hover:bg-indigo-700 h-11 w-11 sm:w-auto sm:px-6 font-bold shadow-2xl p-0 sm:p-2">
                                                            <Plus size={20} /><span className="hidden sm:inline ml-2">Añadir</span>
                                                        </Button>
                                                    </Link>
                                                </div>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                                            {categoryItems.map((item) => {
                                                const isOwned = userInventory.includes(item.id);
                                                return (
                                                    <div
                                                        key={item.id}
                                                        className={`group relative bg-[#131317] border border-white/5 rounded-[2rem] p-4 sm:p-6 hover:bg-[#16161c] transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] overflow-hidden ${isOwned ? 'opacity-70 grayscale-[0.5]' : ''}`}
                                                    >
                                                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent pointer-events-none" />

                                                        <div className="relative z-10 flex flex-col h-full space-y-4 sm:space-y-6">
                                                            <div className="relative aspect-square flex items-center justify-center cursor-pointer" onClick={() => setPreviewItem(item)}>
                                                                <div className="absolute inset-0 bg-indigo-500/10 blur-[40px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                                                                <img src={item.image_url || ''} alt={item.name} className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-700 drop-shadow-[0_20px_30px_rgba(0,0,0,0.5)]" />

                                                                {item.max_uses !== null && (
                                                                    <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[9px] font-black px-2 py-1 rounded-bl-xl rounded-tr-lg shadow-lg z-20">
                                                                        {item.max_uses} USOS
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className="space-y-1 sm:space-y-2">
                                                                <div className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em]">{item.type.replace('_', ' ')}</div>
                                                                <h3 className="text-sm sm:text-lg font-black text-white uppercase italic leading-tight truncate tracking-tight">{item.name}</h3>
                                                                <p className="text-zinc-500 text-[10px] sm:text-xs font-medium line-clamp-2 leading-relaxed min-h-[30px] sm:min-h-[40px]">{item.description}</p>
                                                            </div>

                                                            <div className="pt-3 sm:pt-4 border-t border-white/5 flex items-center justify-between gap-1 sm:gap-4">
                                                                {adminMode[category.id] ? (
                                                                    <div className="flex flex-col w-full gap-3">
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="flex-1 relative">
                                                                                <img src="/icons/moneda.png" alt="Coin" className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2" />
                                                                                <input
                                                                                    type="number"
                                                                                    min="0"
                                                                                    step="1"
                                                                                    defaultValue={item.price_coins}
                                                                                    onBlur={(e) => {
                                                                                        const val = parseInt(e.target.value);
                                                                                        if (!isNaN(val) && val !== item.price_coins) {
                                                                                            handleUpdateItem(item.id, { price_coins: val });
                                                                                        }
                                                                                    }}
                                                                                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-8 pr-2 py-2 text-white font-bold text-sm outline-none focus:border-indigo-500 transition-colors"
                                                                                />
                                                                            </div>
                                                                            <Button
                                                                                onClick={() => handleUpdateItem(item.id, { is_active: !item.is_active })}
                                                                                className={`flex-shrink-0 h-10 px-3 rounded-xl text-[10px] font-black uppercase transition-all ${item.is_active ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}
                                                                            >
                                                                                {item.is_active ? 'ON' : 'OFF'}
                                                                            </Button>
                                                                        </div>
                                                                        <div className="flex gap-2">
                                                                            <Link href={`/admin/shop/edit?id=${item.id}`} className="flex-1">
                                                                                <Button className="w-full h-9 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-[10px] uppercase">Detalles</Button>
                                                                            </Link>
                                                                            <Button
                                                                                onClick={() => handleDeleteItem(item.id)}
                                                                                className="h-9 w-9 p-0 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20"
                                                                            >
                                                                                <Trash2 size={14} />
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <>
                                                                        {!isOwned && (
                                                                            <div className="flex-shrink-0 flex items-center gap-1 sm:gap-2 bg-black px-1.5 py-1 sm:px-3 sm:py-2 rounded-xl">
                                                                                <img src="/icons/moneda.png" alt="Coin" className="w-3.5 h-3.5 sm:w-5 sm:h-5 flex-shrink-0" />
                                                                                <span className="text-white font-black text-[10px] sm:text-base tracking-tighter">{item.price_coins}</span>
                                                                            </div>
                                                                        )}
                                                                        {isOwned ? (
                                                                            <Button className="flex-1 rounded-xl bg-zinc-800 text-zinc-500 font-bold h-9 sm:h-11 text-[9px] sm:text-sm px-1" disabled>ADQUIRIDO</Button>
                                                                        ) : (
                                                                            <Button onClick={() => setPreviewItem(item)} className="flex-1 rounded-xl bg-white text-black hover:bg-zinc-200 font-black h-9 sm:h-11 text-[9px] sm:text-sm italic shadow-xl tracking-tighter px-1">VISTA PREVIA</Button>
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
                    <div className={`fixed bottom-8 right-8 p-6 rounded-2xl shadow-2xl z-50 animate-in slide-in-from-right-8 ${purchaseMessage.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                        <div className="flex items-center gap-3 font-bold italic uppercase tracking-wider">
                            {purchaseMessage.type === 'success' ? <CheckCircle2 size={24} /> : <XCircle size={24} />}
                            {purchaseMessage.text}
                        </div>
                    </div>
                )}

                {/* Nitro Style Footer Badges */}
                <div className="max-w-6xl mx-auto pt-24 pb-12 opacity-20 hover:opacity-100 transition-all duration-1000">
                    <div className="flex flex-wrap justify-center gap-12 grayscale hover:grayscale-0 transition-all">
                        <div className="flex items-center gap-3"><ShieldCheck className="text-indigo-400" /> <span className="text-white font-black italic uppercase tracking-wider text-sm">Transacción Encriptada</span></div>
                        <div className="flex items-center gap-3"><Star className="text-yellow-400" /> <span className="text-white font-black italic uppercase tracking-wider text-sm">Artículos Únicos</span></div>
                        <div className="flex items-center gap-3"><Zap className="text-blue-400" /> <span className="text-white font-black italic uppercase tracking-wider text-sm">Instante Nitro</span></div>
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



            {/* Modal de Nueva Categoría */}
            {isCategoryModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsCategoryModalOpen(false)}
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="relative w-full max-w-md bg-[#131317] border border-white/10 rounded-[2.5rem] p-8 sm:p-10 shadow-2xl overflow-hidden"
                    >
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-600" />

                        <div className="space-y-8">
                            <div className="text-center space-y-2">
                                <h2 className="text-3xl font-[1000] text-white italic tracking-tighter uppercase">Nueva Categoría</h2>
                                <p className="text-zinc-500 text-xs font-black uppercase tracking-widest">Organiza tu tienda nitro</p>
                            </div>

                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block ml-1">Nombre</label>
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="Ej: MARCOS EXCLUSIVOS"
                                    value={newCategoryName}
                                    onChange={(e) => setNewCategoryName(e.target.value.toUpperCase())}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') submitCreateCategory();
                                        if (e.key === 'Escape') setIsCategoryModalOpen(false);
                                    }}
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:border-indigo-500/50 transition-all placeholder:text-zinc-700"
                                />
                            </div>

                            <div className="flex gap-4">
                                <Button
                                    onClick={() => setIsCategoryModalOpen(false)}
                                    className="flex-1 h-14 bg-white/5 hover:bg-white/10 text-zinc-400 font-black uppercase italic rounded-xl border border-white/5"
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    onClick={submitCreateCategory}
                                    disabled={!newCategoryName.trim() || isCreatingCategory}
                                    className="flex-1 h-14 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase italic rounded-xl shadow-[0_0_30px_rgba(79,70,229,0.3)] disabled:opacity-50"
                                >
                                    {isCreatingCategory ? 'Creando...' : 'Confirmar'}
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}

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
