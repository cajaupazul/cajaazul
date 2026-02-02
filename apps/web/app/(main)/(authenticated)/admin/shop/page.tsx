'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from '@/lib/theme-context';
import { useProfile } from '@/lib/profile-context';
import { supabase, ShopItem } from '@/lib/supabase';
import {
    Plus,
    Trash2,
    Image as ImageIcon,
    ShieldCheck,
    Search,
    RefreshCw,
    Pencil,
    ChevronRight,
    ExternalLink,
    LayoutGrid
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from '@/components/ui/dialog';
import { PLACEHOLDERS } from '@/lib/constants';
import Link from 'next/link';

export default function AdminShopPage() {
    const { colors } = useTheme();
    const { profile } = useProfile();
    const [items, setItems] = useState<ShopItem[]>([]);
    const [categories, setCategories] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deletingItem, setDeletingItem] = useState<ShopItem | null>(null);

    useEffect(() => {
        fetchItems();
    }, []);

    const fetchItems = async () => {
        setLoading(true);
        // Fetch categories first
        const { data: catData } = await supabase.from('shop_categories').select('id, name');
        if (catData) {
            const catMap = catData.reduce((acc: any, cat: any) => ({ ...acc, [cat.id]: cat.name }), {});
            setCategories(catMap);
        }

        const { data, error } = await supabase
            .from('shop_items')
            .select('*')
            .order('created_at', { ascending: false });

        if (!error && data) setItems(data);
        setLoading(false);
    };

    const toggleStatus = async (item: ShopItem) => {
        const { error } = await supabase
            .from('shop_items')
            .update({ is_active: !item.is_active })
            .eq('id', item.id);

        if (!error) fetchItems();
    };

    const deleteItem = async (id: string) => {
        setIsDeleting(true);
        try {
            // 1. Get detailed item info first to check for frame_key
            const { data: itemToDelete, error: fetchError } = await supabase
                .from('shop_items')
                .select('*')
                .eq('id', id)
                .single();

            if (fetchError || !itemToDelete) throw new Error('Item no encontrado');

            console.log('[DELETE] Iniciando borrado nuclear de:', itemToDelete.name);

            // 2. Si es un MARCO (tiene frame_key), desequiparlo de TODOS los usuarios
            if (itemToDelete.frame_key) {
                console.log('[DELETE] Desequipando marco:', itemToDelete.frame_key);
                const { error: profileError } = await supabase
                    .from('profiles')
                    .update({ active_frame_key: null })
                    .eq('active_frame_key', itemToDelete.frame_key);

                if (profileError) console.error('Error desequipando marcos:', profileError);
            }

            // 3. Eliminar inventarios de usuarios (Cascade manual por seguridad)
            console.log('[DELETE] Eliminando inventarios...');
            const { error: invError } = await supabase
                .from('user_inventory')
                .delete()
                .eq('item_id', id);

            if (invError) console.error('Error limpiando inventarios:', invError);

            // 4. Eliminar el item de la tienda
            console.log('[DELETE] Eliminando item de tienda...');
            const { error } = await supabase
                .from('shop_items')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setDeletingItem(null);
            fetchItems();
            alert('Elemento eliminado correctamente y retirado de todos los usuarios.');
        } catch (error: any) {
            console.error('Error eliminando:', error);
            alert(`Error crítico al eliminar: ${error.message}`);
        } finally {
            setIsDeleting(false);
        }
    };

    if (profile?.role !== 'admin' && profile?.role !== 'superadmin') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-center p-4">
                <ShieldCheck className="w-16 h-16 text-red-500 opacity-50" />
                <h1 className="text-2xl font-bold text-bb-text">Acceso Restringido</h1>
                <p className="text-bb-text-secondary">No tienes permisos para acceder a esta sección.</p>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="text-center md:text-left">
                    <h1 className="text-3xl sm:text-4xl font-extrabold text-bb-text tracking-tight">
                        Administrar Tienda
                    </h1>
                    <p className="text-bb-text-secondary mt-1">Gestión de marcos y artículos de la tienda</p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                    <Link href="/admin/shop/categories" className="w-full sm:w-auto">
                        <Button variant="outline" className="font-bold rounded-xl border-bb-border bg-bb-sidebar/30 h-12 w-full px-6">
                            <LayoutGrid className="mr-2 h-5 w-5" /> Categorías
                        </Button>
                    </Link>
                    <Link href="/admin/shop/new" className="w-full sm:w-auto">
                        <Button className="font-bold rounded-xl shadow-lg w-full px-8 h-12" style={{ backgroundColor: colors?.primary }}>
                            <Plus className="mr-2 h-5 w-5" /> Nuevo Item
                        </Button>
                    </Link>
                </div>
            </div>

            {/* List Container */}
            <div className="bg-bb-card border border-bb-border rounded-3xl overflow-hidden shadow-xl">
                <div className="p-4 sm:p-6 border-b border-bb-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-bb-sidebar/20">
                    <h2 className="font-bold text-xl flex items-center gap-2">
                        Lista de Artículos <span className="text-xs bg-bb-darker px-2 py-1 rounded-full text-bb-text-secondary font-mono">{items.length}</span>
                    </h2>
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-bb-text-secondary w-4 h-4" />
                        <Input className="bg-bb-sidebar/30 border-bb-border pl-10 h-10 rounded-xl text-sm" placeholder="Buscar por nombre..." />
                    </div>
                </div>

                {/* Items View */}
                <div className="overflow-hidden">
                    {/* Desktop View */}
                    <div className="hidden md:block">
                        <table className="w-full text-left">
                            <thead className="text-[10px] font-bold text-bb-text-secondary border-b border-bb-border bg-bb-sidebar/50 uppercase tracking-widest">
                                <tr>
                                    <th className="px-6 py-4">Preview</th>
                                    <th className="px-6 py-4">Nombre / Key</th>
                                    <th className="px-6 py-4">Categoría</th>
                                    <th className="px-6 py-4">Precio</th>
                                    <th className="px-6 py-4">Estado</th>
                                    <th className="px-6 py-4 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-bb-border/50">
                                {loading ? (
                                    Array(3).fill(0).map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan={5} className="px-6 py-8 bg-bb-darker/5 text-center">Cargando...</td>
                                        </tr>
                                    ))
                                ) : items.map((item) => (
                                    <tr key={item.id} className="hover:bg-bb-sidebar/10 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="w-12 h-12 rounded-lg bg-bb-darker flex items-center justify-center overflow-hidden border border-bb-border shadow-inner">
                                                {item.image_url ? (
                                                    <img src={item.image_url || PLACEHOLDERS.ITEM} alt={item.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <ImageIcon className="text-bb-text-secondary w-5 h-5" />
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-bb-text leading-tight">{item.name}</div>
                                            <div className="text-[10px] text-bb-text-secondary font-mono mt-0.5 truncate max-w-[150px]">{item.frame_key || 'N/A'}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-xs font-medium text-bb-text-secondary">
                                                {item.category_id ? categories[item.category_id] : (
                                                    <span className="opacity-40 italic">Sin categoría</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1.5 font-bold text-bb-text">
                                                <img src="/icons/moneda.png" className="w-4 h-4" alt="coins" />
                                                {item.price_coins}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => toggleStatus(item)}
                                                className={`px-3 py-1 rounded-full text-[10px] font-black uppercase transition-all active:scale-95 ${item.is_active
                                                    ? 'bg-green-500/10 text-green-500 border border-green-500/20 hover:bg-green-500/20 shadow-[0_0_10px_rgba(34,197,94,0.1)]'
                                                    : 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20'
                                                    }`}
                                            >
                                                {item.is_active ? 'Activo' : 'Inactivo'}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <Link href={`/admin/shop/edit?id=${item.id}`}>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-9 px-3 text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 rounded-lg gap-2"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                        Editar
                                                    </Button>
                                                </Link>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-9 w-9 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg"
                                                    onClick={() => setDeletingItem(item)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile View */}
                    <div className="md:hidden grid grid-cols-1 gap-4 p-4">
                        {loading ? (
                            Array(3).fill(0).map((_, i) => (
                                <div key={i} className="h-24 bg-bb-darker/10 animate-pulse rounded-2xl" />
                            ))
                        ) : items.map((item) => (
                            <div key={item.id} className="bg-bb-sidebar/10 rounded-2xl p-4 border border-bb-border/50 space-y-4 shadow-sm hover:border-bb-border transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-xl bg-bb-darker flex items-center justify-center overflow-hidden border border-bb-border shrink-0 shadow-inner">
                                        {item.image_url ? (
                                            <img src={item.image_url || PLACEHOLDERS.ITEM} alt={item.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <ImageIcon className="text-bb-text-secondary w-6 h-6" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-bb-text truncate text-base">{item.name}</h3>
                                        <p className="text-[10px] text-bb-text-secondary font-mono truncate">{item.frame_key}</p>
                                        <div className="flex items-center gap-1.5 font-bold text-bb-text mt-1 text-sm bg-bb-darker/50 w-fit px-2 py-0.5 rounded-lg border border-bb-border/30">
                                            <img src="/icons/moneda.png" className="w-3.5 h-3.5" alt="coins" />
                                            {item.price_coins}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => toggleStatus(item)}
                                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase ${item.is_active
                                            ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                                            : 'bg-red-500/10 text-red-500 border border-red-500/20'
                                            }`}
                                    >
                                        {item.is_active ? 'ON' : 'OFF'}
                                    </button>
                                </div>
                                <div className="flex gap-2">
                                    <Link href={`/admin/shop/edit?id=${item.id}`} className="flex-1">
                                        <Button
                                            variant="outline"
                                            className="w-full h-11 text-xs border-bb-border bg-bb-card rounded-xl gap-2 font-bold"
                                        >
                                            <Pencil className="w-3.5 h-3.5" /> Editar
                                        </Button>
                                    </Link>
                                    <Button
                                        variant="outline"
                                        className="w-full sm:w-auto h-11 text-xs border-bb-border bg-bb-card text-red-400 rounded-xl font-bold gap-2 px-4"
                                        onClick={() => setDeletingItem(item)}
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {!loading && items.length === 0 && (
                    <div className="p-12 text-center text-bb-text-secondary flex flex-col items-center gap-3">
                        <ImageIcon className="w-12 h-12 opacity-20" />
                        <p>No hay artículos en la tienda.</p>
                        <Link href="/admin/shop/new">
                            <Button variant="link" className="text-blue-400 font-bold">Crear el primero ahora</Button>
                        </Link>
                    </div>
                )}
            </div>

            {/* Deletion Confirm Modal */}
            <Dialog open={!!deletingItem} onOpenChange={(open) => !open && setDeletingItem(null)}>
                <DialogContent className="bg-bb-card border-bb-border text-bb-text w-[90vw] max-w-md p-6 rounded-3xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3 text-red-400 text-xl font-bold">
                            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                                <Trash2 className="w-5 h-5" />
                            </div>
                            ¿Eliminar Artículo?
                        </DialogTitle>
                        <DialogDescription className="text-bb-text-secondary pt-4 text-sm leading-relaxed">
                            Estás a punto de borrar definitivamente <strong>{deletingItem?.name}</strong>.
                            <br /><br />
                            <span className="text-[11px] text-bb-text-secondary/70">Nota: Los usuarios que ya compraron este artículo mantendrán su propiedad a menos que limpies sus inventarios manualmente.</span>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col sm:flex-row justify-end gap-3 mt-8">
                        <Button variant="ghost" onClick={() => setDeletingItem(null)} className="rounded-xl font-bold h-12 sm:h-10 order-2 sm:order-1">Cancelar</Button>
                        <Button
                            className="bg-red-500 hover:bg-red-600 text-white border-0 rounded-xl font-bold h-12 sm:h-10 order-1 sm:order-2"
                            onClick={() => deletingItem && deleteItem(deletingItem.id)}
                            disabled={isDeleting}
                        >
                            {isDeleting ? 'Eliminando...' : 'Eliminar Definitivamente'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
