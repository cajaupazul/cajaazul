'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme-context';
import { useProfile } from '@/lib/profile-context';
import {
    Save,
    Plus,
    Trash2,
    AlertCircle,
    CheckCircle2,
    Info,
    RefreshCw,
    ToggleLeft,
    ToggleRight,
    Maximize,
    Download,
    ShieldCheck,
    CreditCard, // Added
    Settings // Added
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface StoreProduct {
    id: string;
    name: string;
    type: 'vip' | 'coins';
    price: number;
    amount: number;
    active: boolean;
    created_at?: string;
}

interface StoreLayoutConfig {
    id: string;
    asset_key: string;
    x_pos: number;
    y_pos: number;
    scale: number;
    is_visible: boolean;
}

export default function StoreConfigPage() {
    const { colors } = useTheme();
    const { profile } = useProfile();
    const [products, setProducts] = useState<StoreProduct[]>([]);
    const [layoutConfigs, setLayoutConfigs] = useState<StoreLayoutConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        fetchProducts();
        fetchLayoutConfigs();
    }, []);

    const fetchProducts = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('store_products')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) {
            setError('Error al cargar productos: ' + error.message);
        } else {
            setProducts(data || []);
        }
        setLoading(false);
    };

    const fetchLayoutConfigs = async () => {
        const { data, error } = await supabase
            .from('store_layout_config')
            .select('*');

        if (!error && data) {
            setLayoutConfigs(data);
        }
    };

    const handleUpdateChange = (id: string, field: keyof StoreProduct, value: any) => {
        setProducts(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
    };

    const handleLayoutChange = (id: string, field: keyof StoreLayoutConfig, value: any) => {
        setLayoutConfigs(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
    };

    const handleSave = async (product: StoreProduct) => {
        setSaving(product.id);
        setError(null);
        setSuccess(null);

        const { error } = await supabase
            .from('store_products')
            .update({
                name: product.name,
                price: product.price,
                amount: product.amount,
                active: product.active
            })
            .eq('id', product.id);

        if (error) {
            setError(`Error al guardar ${product.name}: ${error.message}`);
        } else {
            setSuccess(`Producto ${product.name} actualizado con éxito`);
            setTimeout(() => setSuccess(null), 3000);
        }
        setSaving(null);
    };

    const handleSaveLayout = async (config: StoreLayoutConfig) => {
        setSaving(config.id);
        setError(null);
        setSuccess(null);

        const { error } = await supabase
            .from('store_layout_config')
            .update({
                x_pos: config.x_pos,
                y_pos: config.y_pos,
                scale: config.scale,
                is_visible: config.is_visible
            })
            .eq('id', config.id);

        if (error) {
            setError(`Error al guardar diseño: ${error.message}`);
        } else {
            setSuccess(`Diseño de ${config.asset_key} actualizado`);
            setTimeout(() => setSuccess(null), 3000);
        }
        setSaving(null);
    };

    const toggleActive = async (product: StoreProduct) => {
        const newStatus = !product.active;
        handleUpdateChange(product.id, 'active', newStatus);

        const { error } = await supabase
            .from('store_products')
            .update({ active: newStatus })
            .eq('id', product.id);

        if (error) {
            setError(`Error al cambiar estado: ${error.message}`);
            handleUpdateChange(product.id, 'active', product.active); // Rollback
        }
    };

    if (profile?.role !== 'admin' && profile?.role !== 'superadmin') {
        return (
            <div className="p-8 text-center text-bb-text">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h1 className="text-2xl font-bold mb-2">Acceso Denegado</h1>
                <p>No tienes permisos para ver esta página.</p>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-bb-text uppercase tracking-tight italic">
                        Configuración <span className="text-indigo-500">Tienda</span>
                    </h1>
                    <p className="text-bb-text-secondary mt-1 font-medium">Gestiona precios y el diseño visual de la tienda.</p>
                </div>
                <Button
                    onClick={() => { fetchProducts(); fetchLayoutConfigs(); }}
                    variant="outline"
                    className="border-bb-border"
                >
                    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Actualizar Todo
                </Button>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-xl flex items-center gap-3 text-red-500">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p className="text-sm font-medium">{error}</p>
                </div>
            )}

            {success && (
                <div className="bg-green-500/10 border border-green-500/50 p-4 rounded-xl flex items-center gap-3 text-green-500">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <p className="text-sm font-medium">{success}</p>
                </div>
            )}

            <div className="space-y-12">
                {/* Visual Layout Management Section */}
                <section className="space-y-6">
                    <div className="flex items-center gap-3 border-b border-bb-border pb-4">
                        <Maximize className="text-indigo-500" size={24} />
                        <h2 className="text-2xl font-bold text-bb-text">Diseño Visual y Mascotas</h2>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {layoutConfigs.map((config) => (
                            <Card key={config.id} className="bg-bb-card border-bb-border overflow-hidden">
                                <CardHeader className="bg-bb-sidebar/30 py-4">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-lg text-bb-text uppercase italic tracking-wider">
                                            🎨 Layout: {config.asset_key.replace(/_/g, ' ')}
                                        </CardTitle>
                                        <button
                                            onClick={() => handleLayoutChange(config.id, 'is_visible', !config.is_visible)}
                                            className={`flex items-center gap-2 transition-colors ${config.is_visible ? 'text-green-500' : 'text-zinc-500'}`}
                                        >
                                            {config.is_visible ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
                                            <span className="text-xs font-bold uppercase">{config.is_visible ? 'Visible' : 'Oculto'}</span>
                                        </button>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-6 space-y-6">
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-3">
                                            <label className="text-sm font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                                                Eje X (Horizontal) <span className="text-indigo-400">({config.x_pos}px)</span>
                                            </label>
                                            <input
                                                type="range" min="-200" max="200" step="1"
                                                value={config.x_pos}
                                                onChange={(e) => handleLayoutChange(config.id, 'x_pos', parseInt(e.target.value))}
                                                className="w-full accent-indigo-500"
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-sm font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                                                Eje Y (Vertical) <span className="text-indigo-400">({config.y_pos}px)</span>
                                            </label>
                                            <input
                                                type="range" min="-200" max="200" step="1"
                                                value={config.y_pos}
                                                onChange={(e) => handleLayoutChange(config.id, 'y_pos', parseInt(e.target.value))}
                                                className="w-full accent-indigo-500"
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-sm font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                                                Escala (Tamaño) <span className="text-indigo-400">({config.scale})</span>
                                            </label>
                                            <input
                                                type="range" min="0.5" max="2.5" step="0.1"
                                                value={config.scale}
                                                onChange={(e) => handleLayoutChange(config.id, 'scale', parseFloat(e.target.value))}
                                                className="w-full accent-indigo-500"
                                            />
                                        </div>
                                    </div>

                                    <Button
                                        onClick={() => handleSaveLayout(config)}
                                        disabled={saving === config.id}
                                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black italic rounded-xl h-12"
                                    >
                                        {saving === config.id ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'APLICAR CAMBIOS DE DISEÑO'}
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </section>

                <hr className="border-bb-border" />

                {/* Price Management Section */}
                <section className="space-y-6">
                    <div className="flex items-center gap-3 border-b border-bb-border pb-4">
                        <CreditCard className="text-indigo-500" size={24} />
                        <h2 className="text-2xl font-bold text-bb-text">Gestión de Precios (VIP y Monedas)</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {products.map((product) => (
                            <Card key={product.id} className="bg-bb-card border-bb-border overflow-hidden">
                                <CardHeader className="bg-bb-sidebar/30 py-4">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-lg text-bb-text italic">
                                            {product.type === 'vip' ? '👑 Membresía VIP' : '💰 Paquete de Monedas'}
                                        </CardTitle>
                                        <button
                                            onClick={() => toggleActive(product)}
                                            className={`flex items-center gap-2 transition-colors ${product.active ? 'text-green-500' : 'text-zinc-500'}`}
                                        >
                                            {product.active ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
                                            <span className="text-xs font-bold uppercase">{product.active ? 'Activo' : 'Inactivo'}</span>
                                        </button>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-6 space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-zinc-500 uppercase">Nombre</label>
                                        <Input
                                            value={product.name}
                                            onChange={(e) => handleUpdateChange(product.id, 'name', e.target.value)}
                                            className="bg-black/20 border-bb-border text-bb-text font-bold"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-zinc-500 uppercase">Precio (PEN)</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-bb-text-secondary text-sm">S/</span>
                                                <Input
                                                    type="number"
                                                    value={product.price}
                                                    onChange={(e) => handleUpdateChange(product.id, 'price', parseFloat(e.target.value))}
                                                    className="bg-black/20 border-bb-border text-bb-text pl-8 transition-colors focus:border-indigo-500"
                                                    step="0.01"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-zinc-500 uppercase">
                                                {product.type === 'vip' ? 'Días' : 'Cantidad'}
                                            </label>
                                            <Input
                                                type="number"
                                                value={product.amount}
                                                onChange={(e) => handleUpdateChange(product.id, 'amount', parseInt(e.target.value))}
                                                className="bg-black/20 border-bb-border text-bb-text transition-colors focus:border-indigo-500"
                                            />
                                        </div>
                                    </div>

                                    <Button
                                        onClick={() => handleSave(product)}
                                        disabled={saving === product.id}
                                        className="w-full bg-white/5 border border-white/5 hover:bg-white/10 text-bb-text font-bold rounded-xl h-11"
                                    >
                                        {saving === product.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                        GUARDAR CAMBIOS
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </section>
            </div>

            {/* Security Info Card */}
            <div className="bg-indigo-600/5 border border-indigo-500/20 rounded-2xl p-6 flex items-start gap-4 backdrop-blur-md">
                <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-500">
                    <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="text-bb-text font-bold uppercase italic">Seguridad del Sistema Nitro</h3>
                    <p className="text-bb-text-secondary text-sm mt-1 leading-relaxed">
                        Este sistema utiliza seguridad a nivel de base de datos (RLS). Los usuarios finales
                        <strong> NO pueden</strong> alterar los precios desde el navegador. El servidor siempre
                        obtiene el precio real de la tabla antes de procesar cualquier pago.
                    </p>
                </div>
            </div>
        </div>
    );
}

