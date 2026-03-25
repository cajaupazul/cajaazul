'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { FileText, FileImage, LayoutPanelLeft, FileSpreadsheet, FileBox, ExternalLink, MoreVertical, Calendar, User, UploadCloud } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase, getStorageUrl, Material } from '@/lib/supabase';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { UserHoverCard } from '@/components/ui/UserHoverCard';
import { Trash2, Zap, ZapOff, Loader2, CheckSquare, Square } from 'lucide-react';
import { useProfile } from '@/lib/profile-context';

interface MaterialCardProps {
    material: Material;
    onClick: () => void;
    onDelete?: () => void;
    canDelete?: boolean;
    viewMode?: 'grid' | 'list';
    isSelectionMode?: boolean;
    isSelected?: boolean;
    onSelect?: () => void;
}

export default function MaterialCard({
    material,
    onClick,
    onDelete,
    canDelete = false,
    viewMode = 'grid',
    isSelectionMode = false,
    isSelected = false,
    onSelect
}: MaterialCardProps) {
    const { profile } = useProfile();
    const [isUpdatingViewer, setIsUpdatingViewer] = React.useState(false);
    const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin';

    const toggleAdvancedViewer = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isAdmin || isUpdatingViewer) return;

        setIsUpdatingViewer(true);
        try {
            const { error } = await supabase
                .from('materials')
                .update({ use_advanced_viewer: !material.use_advanced_viewer })
                .eq('id', material.id);

            if (error) throw error;
            // No necesitamos refrescar manual si hay realtime o si el componente padre maneja el estado
            // Pero como es un cambio estructural, el usuario lo verá al re-abrir o vía realtime
            material.use_advanced_viewer = !material.use_advanced_viewer;
        } catch (err) {
            console.error('Error updating viewer mode:', err);
        } finally {
            setIsUpdatingViewer(false);
        }
    };

    const materialType = material.tipo?.toLowerCase() || '';
    const isEnlace = materialType === 'enlace';

    // Icon and Color Selection based on type
    const getTypeConfig = () => {
        if (materialType.includes('ppt') || materialType.includes('presentacion')) {
            return {
                icon: <LayoutPanelLeft className="w-8 h-8" />,
                color: 'text-orange-400',
                bg: 'bg-orange-500/10',
                border: 'border-orange-500/20',
                label: 'Presentación',
                // Old card header design colors
                headerGradient: 'from-[#5C2A00] via-[#7A3800] to-[#3A1800]',
                circleColor: 'bg-orange-800/60',
            };
        }
        if (materialType.includes('examen')) {
            return {
                icon: <FileText className="w-8 h-8" />,
                color: 'text-red-400',
                bg: 'bg-red-500/10',
                border: 'border-red-500/20',
                label: 'Examen',
                headerGradient: 'from-[#5C0000] via-[#7A1000] to-[#3A0000]',
                circleColor: 'bg-red-900/60',
            };
        }
        if (materialType.includes('syllabus')) {
            return {
                icon: <FileText className="w-8 h-8" />,
                color: 'text-teal-400',
                bg: 'bg-teal-500/10',
                border: 'border-teal-500/20',
                label: 'Sílabo',
                headerGradient: 'from-[#003C38] via-[#00524C] to-[#002420]',
                circleColor: 'bg-teal-900/60',
            };
        }
        if (isEnlace) {
            return {
                icon: <ExternalLink className="w-8 h-8" />,
                color: 'text-blue-400',
                bg: 'bg-blue-500/10',
                border: 'border-blue-500/20',
                label: 'Enlace',
                headerGradient: 'from-[#001A3C] via-[#002A5C] to-[#000E24]',
                circleColor: 'bg-blue-900/60',
            };
        }
        if (materialType.includes('xls') || materialType.includes('excel')) {
            return {
                icon: <FileSpreadsheet className="w-8 h-8" />,
                color: 'text-green-400',
                bg: 'bg-green-500/10',
                border: 'border-green-500/20',
                label: 'Excel',
                headerGradient: 'from-[#003A00] via-[#004E00] to-[#002000]',
                circleColor: 'bg-green-900/60',
            };
        }
        return {
            icon: <FileBox className="w-8 h-8" />,
            color: 'text-blue-400',
            bg: 'bg-blue-500/10',
            border: 'border-blue-500/20',
            label: 'Material',
            headerGradient: 'from-[#001A3C] via-[#002A5C] to-[#000E24]',
            circleColor: 'bg-blue-900/60',
        };
    };

    const config = getTypeConfig();
    const thumbnailUrl = material.thumbnail_url ? getStorageUrl(material.thumbnail_url, 'thumbnails') : null;

    if (viewMode === 'list') {
        const handleCardClick = (e: React.MouseEvent) => {
            if (isSelectionMode && onSelect) {
                e.stopPropagation();
                onSelect();
            } else {
                onClick();
            }
        };

        return (
            <motion.div
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={handleCardClick}
                className={`flex items-center justify-between p-1.5 sm:p-3 rounded-lg sm:rounded-xl border transition-all cursor-pointer group active:scale-[0.99] ${
                    isSelectionMode && isSelected 
                    ? 'bg-blue-500/10 border-blue-500 shadow-sm shadow-blue-500/20' 
                    : 'bg-bb-darker/10 hover:bg-bb-card border-bb-border/30 hover:border-bb-border/60'
                }`}
            >
                <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
                    {/* Checkbox overlay for List Mode */}
                    {isSelectionMode && (
                        <div className={`mr-0.5 sm:mr-1 transition-colors ${isSelected ? 'text-blue-500' : 'text-bb-border hover:text-bb-text-secondary'}`}>
                            {isSelected ? <CheckSquare className="w-4 h-4 sm:w-5 sm:h-5 fill-current" /> : <Square className="w-4 h-4 sm:w-5 sm:h-5" />}
                        </div>
                    )}
                    <div className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl ${config.bg} ${config.color} group-hover:scale-110 transition-transform flex-shrink-0 w-8 h-8 sm:w-12 sm:h-12 flex items-center justify-center`}>
                        {thumbnailUrl ? (
                            <img src={thumbnailUrl} alt={material.titulo} className="w-full h-full object-cover rounded-md sm:rounded-lg" />
                        ) : (
                            <div className="w-5 h-5 sm:w-8 sm:h-8">
                                {React.cloneElement(config.icon as React.ReactElement<any>, { className: "w-full h-full" })}
                            </div>
                        )}
                    </div>
                    <div className="min-w-0">
                        <p className="text-[13px] sm:text-sm font-bold text-bb-text truncate leading-tight">
                            {material.titulo}
                        </p>
                        <div className="flex items-center gap-2 sm:gap-3 mt-0.5 sm:mt-1 text-[9px] sm:text-[10px] text-bb-text-secondary font-medium overflow-hidden">
                            <Badge variant="outline" className={`text-[7px] sm:text-[8px] uppercase font-black py-0 px-1 sm:px-1.5 ${config.color} border-current opacity-70 flex-shrink-0`}>
                                {config.label}
                            </Badge>
                            {material.professors?.nombre && (
                                <span className="hidden sm:flex items-center gap-1 truncate max-w-[80px] md:max-w-[100px]" onClick={(e) => e.stopPropagation()}>
                                    <User className="w-3 h-3" />
                                    {material.professors.nombre}
                                </span>
                            )}
                            {material.profiles?.nombre && (
                                <div onClick={(e) => e.stopPropagation()} className="hidden sm:block">
                                    <UserHoverCard profile={material.profiles}>
                                        <span className="flex items-center gap-1 truncate max-w-[80px] md:max-w-[100px] hover:text-blue-400 transition-colors">
                                            <UploadCloud className="w-3 h-3" />
                                            {material.profiles.nombre}
                                        </span>
                                    </UserHoverCard>
                                </div>
                            )}
                            <span className="flex items-center gap-1 flex-shrink-0">
                                <Calendar className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                {format(new Date(material.created_at), 'd MMM', { locale: es })}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1 sm:gap-2 px-1 sm:px-2">
                    {canDelete && onDelete && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete();
                            }}
                            className="p-1.5 sm:p-2 rounded-lg hover:bg-red-500/20 text-red-500 transition-all bg-red-500/10"
                        >
                            <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                    )}
                    <MoreVertical className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-bb-text-secondary group-hover:text-blue-400 opacity-50 group-hover:opacity-100 transition-all" />
                </div>
            </motion.div>
        );
    }

    const handleCardClick = (e: React.MouseEvent) => {
        if (isSelectionMode && onSelect) {
            e.stopPropagation();
            onSelect();
        } else {
            onClick();
        }
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ y: -4 }}
            onClick={handleCardClick}
            className={`flex flex-col rounded-xl sm:rounded-2xl overflow-hidden border shadow-sm transition-all cursor-pointer group active:scale-[0.98] relative ${
                isSelectionMode && isSelected 
                ? 'bg-blue-500/10 border-blue-500 ring-2 ring-blue-500/50 shadow-blue-500/20' 
                : 'bg-bb-darker/5 hover:bg-bb-card border-bb-border/30 hover:border-blue-500/20'
            }`}
        >
            {/* Checkbox Overlay for Grid Mode */}
            {isSelectionMode && (
                <div className="absolute top-2 left-2 sm:top-3 sm:left-3 z-[40]">
                    <div className={`p-1 rounded-md backdrop-blur-md border shadow-sm transition-all ${
                        isSelected 
                        ? 'bg-blue-500 text-white border-blue-400' 
                        : 'bg-black/50 text-white/50 border-white/20 hover:bg-black/80 hover:text-white'
                    }`}>
                        {isSelected ? <CheckSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" /> : <Square className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                    </div>
                </div>
            )}

            {/* Thumbnail Area */}
            <div className={`aspect-video w-full relative overflow-hidden shrink-0 ${isSelectionMode && isSelected ? 'opacity-80' : ''}`}>
                {thumbnailUrl ? (
                    <img
                        src={thumbnailUrl}
                        alt={material.titulo}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                    />
                ) : (
                    <>
                        {/* Background gradient — orange/brown */}
                        <div className={`absolute inset-0 bg-gradient-to-br ${config.headerGradient}`} />

                        {/* Decorative circle — top-right (large) */}
                        <div className={`absolute -top-10 -right-8 w-48 h-48 rounded-full ${config.circleColor} opacity-80`} />

                        {/* Decorative circle — bottom-left (medium) */}
                        <div className={`absolute -bottom-8 -left-4 w-32 h-32 rounded-full ${config.circleColor} opacity-60`} />

                        {/* Yellow/orange left stripe — exact replica of PPT template */}
                        <div className="absolute left-0 top-0 bottom-0 w-[5px] bg-amber-400 z-10" />

                        {/* Title — vertically centered, left-aligned with padding after stripe */}
                        <div className="absolute inset-0 flex items-center pl-4 sm:pl-5 pr-3 z-10">
                            <p className="text-sm sm:text-base font-black text-white leading-tight line-clamp-3 drop-shadow-lg uppercase tracking-tighter">
                                {material.titulo}
                            </p>
                        </div>
                    </>
                )}

                {/* Overlay for thumbnail images */}
                {thumbnailUrl && <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-30" />}

                {/* Type Badge — centered at top */}
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20">
                    <span className={`inline-block px-3 py-0.5 rounded-full border ${config.color} border-current/60 bg-black/30 backdrop-blur-sm font-black text-[9px] uppercase tracking-widest`}>
                        {config.label}
                    </span>
                </div>
            </div>

            {/* Content Area */}
            <div className="p-2.5 sm:p-4 space-y-2 sm:space-y-3 bg-bb-card border-t border-bb-border/30">
                <p className="text-[11px] sm:text-sm font-black text-bb-text line-clamp-2 leading-tight min-h-[2rem] sm:min-h-[2.5rem] group-hover:text-blue-400 transition-colors">
                    {material.titulo}
                </p>

                <div className="flex flex-col gap-2 pt-1 border-t border-bb-border/30 mt-1">
                    {material.professors?.nombre && (
                        <div className="flex items-center gap-2 text-[10px] text-bb-text-secondary font-medium truncate" onClick={(e) => e.stopPropagation()}>
                            <User className="w-3 h-3 shrink-0" />
                            <span className="truncate">{material.professors.nombre}</span>
                        </div>
                    )}
                    {material.profiles?.nombre && (
                        <div className="flex items-center gap-2 text-[10px] text-bb-text-secondary font-medium truncate" onClick={(e) => e.stopPropagation()}>
                            <UploadCloud className="w-3 h-3 shrink-0" />
                            <UserHoverCard profile={material.profiles}>
                                <span className="truncate hover:text-blue-400 transition-colors">{material.profiles.nombre}</span>
                            </UserHoverCard>
                        </div>
                    )}
                    <div className="flex items-center justify-between mt-0.5 sm:mt-1 pt-1 border-t border-bb-border/20">
                        <div className="flex items-center gap-1.5 sm:gap-2 text-[8px] sm:text-[10px] text-bb-text-secondary opacity-60 font-medium uppercase truncate">
                            <Calendar className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                            {format(new Date(material.created_at), 'd MMM, yyyy', { locale: es })}
                        </div>

                        <div className="flex items-center gap-2">
                            {material.use_advanced_viewer && (
                                <div className="flex items-center gap-1 text-[8px] sm:text-[9px] font-black text-amber-500 bg-amber-500/10 px-1 sm:px-1.5 py-0.5 rounded-full border border-amber-500/20 animate-pulse">
                                    <Zap className="w-2 h-2 sm:w-2.5 sm:h-2.5 fill-current" />
                                    PRO
                                </div>
                            )}
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="p-1 px-2 rounded-lg bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase">
                                    Ver
                                </div>
                            </div>
                        </div>

                        {isAdmin && (
                            <button
                                onClick={toggleAdvancedViewer}
                                disabled={isUpdatingViewer}
                                className={`p-2 rounded-xl transition-all shadow-sm border z-30 ${material.use_advanced_viewer
                                    ? 'bg-amber-500/20 text-amber-500 border-amber-500/30'
                                    : 'bg-zinc-800/10 text-zinc-400 border-zinc-500/10 hover:bg-zinc-800/20'
                                    }`}
                                title={material.use_advanced_viewer ? "Desactivar Motor Pro" : "Activar Motor Pro (Paging/Virtualizado)"}
                            >
                                {isUpdatingViewer ? <Loader2 className="w-4 h-4 animate-spin" /> : (material.use_advanced_viewer ? <Zap className="w-4 h-4 fill-current" /> : <ZapOff className="w-4 h-4" />)}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Actions (Floating Delete) */}
            {
                canDelete && onDelete && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete();
                        }}
                        className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-red-500/10 text-red-500 backdrop-blur-sm transition-all hover:bg-red-500/20 shadow-sm border border-red-500/20 z-20"
                    >
                        <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                )
            }
        </motion.div >
    );
}
