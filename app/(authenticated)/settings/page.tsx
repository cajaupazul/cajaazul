'use client';

import React, { useState } from 'react';
import { useProfile } from '@/lib/profile-context';
import { supabase } from '@/lib/supabase';
import {
    User,
    Mail,
    MapPin,
    Camera,
    Save,
    Settings as SettingsIcon,
    LogOut,
    Bell,
    Lock,
    Smartphone
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function SettingsPage() {
    const { profile, refreshProfile } = useProfile();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        nombre: profile?.nombre || '',
        carrera: profile?.carrera || '',
        universidad: profile?.universidad || '',
        bio: profile?.bio || '',
    });

    const handleSave = async () => {
        if (!profile?.id) return;
        setLoading(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update(formData)
                .eq('id', profile.id);

            if (error) throw error;
            await refreshProfile();
            alert('Perfil actualizado con éxito');
        } catch (error) {
            console.error('Error actualizando perfil:', error);
            alert('Ocurrió un error al actualizar');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-bb-dark p-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center gap-4 mb-10">
                    <div className="p-3 bg-blue-600/20 rounded-2xl">
                        <SettingsIcon className="w-8 h-8 text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-bb-text tracking-tight">Configuración</h1>
                        <p className="text-bb-text-secondary">Gestiona tu perfil y preferencias de cuenta</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Sidebar Navigation */}
                    <div className="space-y-2">
                        {[
                            { label: 'Perfil Público', icon: User, active: true },
                            { label: 'Notificaciones', icon: Bell },
                            { label: 'Seguridad', icon: Lock },
                            { label: 'Dispositivos', icon: Smartphone },
                        ].map((item, i) => (
                            <button
                                key={i}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${item.active
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                                        : 'text-bb-text-secondary hover:bg-white/5 hover:text-bb-text'
                                    }`}
                            >
                                <item.icon className="w-5 h-5" />
                                {item.label}
                            </button>
                        ))}
                    </div>

                    {/* Settings Form */}
                    <div className="md:col-span-2 space-y-6">
                        <div className="bg-bb-card border border-bb-border rounded-3xl p-8 shadow-xl">
                            <h3 className="text-xl font-bold text-bb-text mb-6">Información del Perfil</h3>

                            <div className="space-y-6">
                                <div className="flex items-center gap-6 mb-8 p-4 bg-white/5 rounded-2xl">
                                    <div className="relative group">
                                        <div className="w-20 h-20 rounded-2xl bg-blue-600 flex items-center justify-center text-3xl font-bold text-white overflow-hidden border-4 border-bb-card shadow-lg">
                                            {profile?.avatar_url ? (
                                                <img src={profile.avatar_url} className="w-full h-full object-cover" alt="Profile" />
                                            ) : (
                                                profile?.nombre?.charAt(0)
                                            )}
                                        </div>
                                        <button className="absolute -bottom-2 -right-2 p-2 bg-blue-500 rounded-lg text-white shadow-lg hover:scale-110 transition-transform">
                                            <Camera className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-bb-text text-lg">{profile?.nombre}</h4>
                                        <p className="text-bb-text-secondary text-sm">{profile?.carrera}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-bold text-bb-text-secondary uppercase tracking-widest mb-2">Nombre Completo</label>
                                        <input
                                            type="text"
                                            value={formData.nombre}
                                            onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl bg-bb-darker border border-bb-border text-bb-text focus:border-blue-500/50 transition-all outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-bb-text-secondary uppercase tracking-widest mb-2">Carrera</label>
                                        <input
                                            type="text"
                                            value={formData.carrera}
                                            onChange={(e) => setFormData({ ...formData, carrera: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl bg-bb-darker border border-bb-border text-bb-text focus:border-blue-500/50 transition-all outline-none"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-bb-text-secondary uppercase tracking-widest mb-2">Universidad</label>
                                    <input
                                        type="text"
                                        value={formData.universidad}
                                        onChange={(e) => setFormData({ ...formData, universidad: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl bg-bb-darker border border-bb-border text-bb-text focus:border-blue-500/50 transition-all outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-bb-text-secondary uppercase tracking-widest mb-2">Biografía</label>
                                    <textarea
                                        rows={4}
                                        value={formData.bio}
                                        onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                                        placeholder="Cuéntanos algo sobre ti..."
                                        className="w-full px-4 py-3 rounded-xl bg-bb-darker border border-bb-border text-bb-text focus:border-blue-500/50 transition-all outline-none resize-none"
                                    />
                                </div>

                                <div className="pt-6 border-t border-bb-border flex justify-end">
                                    <button
                                        onClick={handleSave}
                                        disabled={loading}
                                        className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50"
                                    >
                                        {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white animate-spin rounded-full" /> : <Save className="w-5 h-5" />}
                                        Guardar Cambios
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="bg-red-500/10 border border-red-500/20 rounded-3xl p-8">
                            <h3 className="text-xl font-bold text-red-500 mb-2">Zona de Peligro</h3>
                            <p className="text-bb-text-secondary text-sm mb-6">Ten cuidado, estas acciones son irreversibles.</p>
                            <button className="flex items-center gap-2 px-6 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-500 font-bold rounded-xl border border-red-500/30 transition-all">
                                <LogOut className="w-5 h-5" />
                                Cerrar Sesión en otros dispositivos
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
