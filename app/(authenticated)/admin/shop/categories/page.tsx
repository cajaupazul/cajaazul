'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from '@/lib/theme-context';
import { useProfile } from '@/lib/profile-context';
import { supabase, ShopCategory } from '@/lib/supabase';
import {
    Plus,
    Trash2,
    ShieldCheck,
    Search,
    RefreshCw,
    Pencil,
    ChevronLeft,
    LayoutGrid,
    Save,
    X
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
import { Label } from '@/components/ui/label';
import Link from 'next/link';

export default function AdminCategoriesPage() {
    const { colors } = useTheme();
    const { profile } = useProfile();
    const [categories, setCategories] = useState<ShopCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Partial<ShopCategory> | null>(null);
    const [deletingCategory, setDeletingCategory] = useState<ShopCategory | null>(null);

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('shop_categories')
            .select('*')
            .order('display_order', { ascending: true });

        if (!error && data) setCategories(data);
        setLoading(false);
    };

    const handleSave = async () => {
        if (!editingCategory?.name) return;

        setIsSaving(true);
        const { id, ...data } = editingCategory;

        let error;
        if (id) {
            const { error: updateError } = await supabase
                .from('shop_categories')
                .update(data)
                .eq('id', id);
            error = updateError;
        } else {
            const { error: insertError } = await supabase
                .from('shop_categories')
                .insert([data]);
            error = insertError;
        }

        setIsSaving(false);
        if (!error) {
            setEditingCategory(null);
            fetchCategories();
        } else {
            alert(`Error al guardar: ${error.message}`);
        }
    };

    const deleteCategory = async (id: string) => {
        const { error } = await supabase
            .from('shop_categories')
            .delete()
            .eq('id', id);

        if (!error) {
            setDeletingCategory(null);
            fetchCategories();
        } else {
            alert(`Error al eliminar: ${error.message}`);
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
                <div className="flex items-center gap-4">
                    <Link href="/admin/shop">
                        <Button variant="ghost" size="icon" className="rounded-full bg-bb-sidebar/50 hover:bg-bb-sidebar">
                            <ChevronLeft className="w-6 h-6" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl sm:text-4xl font-extrabold text-bb-text tracking-tight flex items-center gap-3">
                            <LayoutGrid className="text-blue-400" /> Categorías de Tienda
                        </h1>
                        <p className="text-bb-text-secondary mt-1">Gestiona las secciones de la tienda virtual</p>
                    </div>
                </div>

                <Button
                    onClick={() => setEditingCategory({ name: '', icon: 'Package', display_order: 0, is_active: true })}
                    className="font-bold rounded-xl shadow-lg w-full md:w-auto px-8 h-12"
                    style={{ backgroundColor: colors?.primary }}
                >
                    <Plus className="mr-2 h-5 w-5" /> Nueva Categoría
                </Button>
            </div>

            <div className="bg-bb-card border border-bb-border rounded-3xl overflow-hidden shadow-xl">
                <div className="p-6 border-b border-bb-border bg-bb-sidebar/20">
                    <h2 className="font-bold text-xl flex items-center gap-2">
                        Secciones Activas <span className="text-xs bg-bb-darker px-2 py-1 rounded-full text-bb-text-secondary font-mono">{categories.length}</span>
                    </h2>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="text-[10px] font-bold text-bb-text-secondary border-b border-bb-border bg-bb-sidebar/50 uppercase tracking-widest">
                            <tr>
                                <th className="px-6 py-4">Orden</th>
                                <th className="px-6 py-4">Nombre</th>
                                <th className="px-6 py-4">Icono</th>
                                <th className="px-6 py-4">Estado</th>
                                <th className="px-6 py-4 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-bb-border/50">
                            {loading ? (
                                Array(3).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={5} className="px-6 py-8 text-center text-bb-text-secondary">Cargando...</td>
                                    </tr>
                                ))
                            ) : categories.map((cat) => (
                                <tr key={cat.id} className="hover:bg-bb-sidebar/10 transition-colors">
                                    <td className="px-6 py-4 font-mono font-bold text-blue-400">{cat.display_order}</td>
                                    <td className="px-6 py-4 font-bold text-bb-text">{cat.name}</td>
                                    <td className="px-6 py-4">
                                        <div className="bg-bb-darker px-3 py-1 rounded-lg border border-bb-border text-xs font-mono inline-block">
                                            {cat.icon || '---'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${cat.is_active ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                            {cat.is_active ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-blue-400 hover:text-blue-300 rounded-xl"
                                                onClick={() => setEditingCategory(cat)}
                                            >
                                                <Pencil className="h-4 w-4 mr-1" /> Editar
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-red-400 hover:text-red-300 rounded-xl"
                                                onClick={() => setDeletingCategory(cat)}
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

                {!loading && categories.length === 0 && (
                    <div className="p-12 text-center text-bb-text-secondary flex flex-col items-center gap-3">
                        <LayoutGrid className="w-12 h-12 opacity-20" />
                        <p>No hay categorías creadas aún.</p>
                    </div>
                )}
            </div>

            {/* Modal de Crear/Editar */}
            <Dialog open={!!editingCategory} onOpenChange={(open) => !open && setEditingCategory(null)}>
                <DialogContent className="bg-bb-card border-bb-border text-bb-text max-w-md rounded-3xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            {editingCategory?.id ? <Pencil size={20} /> : <Plus size={20} />}
                            {editingCategory?.id ? 'Editar Categoría' : 'Nueva Categoría'}
                        </DialogTitle>
                        <DialogDescription className="text-bb-text-secondary">
                            Define el nombre y orden de aparición de la sección.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Nombre</Label>
                            <Input
                                value={editingCategory?.name}
                                onChange={e => setEditingCategory({ ...editingCategory!, name: e.target.value })}
                                className="bg-bb-sidebar/30 border-bb-border h-11"
                                placeholder="Ej: Stickers, Fondos de Perfil..."
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Orden de Visualización</Label>
                                <Input
                                    type="number"
                                    value={editingCategory?.display_order}
                                    onChange={e => setEditingCategory({ ...editingCategory!, display_order: parseInt(e.target.value) })}
                                    className="bg-bb-sidebar/30 border-bb-border h-11"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Icono (Lucide Name)</Label>
                                <Input
                                    value={editingCategory?.icon || ''}
                                    onChange={e => setEditingCategory({ ...editingCategory!, icon: e.target.value })}
                                    className="bg-bb-sidebar/30 border-bb-border h-11"
                                    placeholder="Package, Star, etc."
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-2 pt-2">
                            <input
                                type="checkbox"
                                checked={editingCategory?.is_active}
                                onChange={e => setEditingCategory({ ...editingCategory!, is_active: e.target.checked })}
                                className="w-5 h-5 accent-blue-500 rounded-lg cursor-pointer"
                            />
                            <Label className="cursor-pointer">¿Sección Activa?</Label>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <Button variant="ghost" onClick={() => setEditingCategory(null)} className="flex-1 rounded-xl h-11">Cancelar</Button>
                        <Button
                            className="flex-1 rounded-xl h-11 font-bold text-white shadow-lg"
                            style={{ backgroundColor: colors?.primary }}
                            onClick={handleSave}
                            disabled={isSaving}
                        >
                            {isSaving ? <RefreshCw className="animate-spin" /> : <Save className="mr-2 w-4 h-4" />}
                            Guardar
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Modal Eliminar */}
            <Dialog open={!!deletingCategory} onOpenChange={(open) => !open && setDeletingCategory(null)}>
                <DialogContent className="bg-bb-card border-bb-border text-bb-text max-w-sm rounded-3xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-red-400 font-bold flex items-center gap-2">
                            <Trash2 size={20} /> ¿Eliminar Categoría?
                        </DialogTitle>
                        <DialogDescription className="text-bb-text-secondary pt-2">
                            Estás por eliminar <strong>{deletingCategory?.name}</strong>. Esto quitará la categoría de los artículos, pero los artículos seguirán existiendo como "Sin categoría".
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex gap-3 mt-6">
                        <Button variant="ghost" onClick={() => setDeletingCategory(null)} className="flex-1 rounded-xl">Cancelar</Button>
                        <Button variant="destructive" onClick={() => deletingCategory && deleteCategory(deletingCategory.id)} className="flex-1 rounded-xl font-bold">Eliminar</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
