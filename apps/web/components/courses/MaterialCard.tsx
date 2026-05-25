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
    const fileName = material.url_archivo?.toLowerCase() || '';
    const isEnlace = materialType === 'enlace';

    const isPDF = fileName.endsWith('.pdf') || materialType.includes('pdf');
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || materialType.includes('xls') || materialType.includes('excel');
    const isWord = fileName.endsWith('.docx') || fileName.endsWith('.doc') || materialType.includes('doc') || materialType.includes('word');
    const isPPT = fileName.endsWith('.pptx') || fileName.endsWith('.ppt') || materialType.includes('ppt') || materialType.includes('presentacion');
    const isImage = fileName.endsWith('.jpg') || fileName.endsWith('.png') || fileName.endsWith('.jpeg') || fileName.endsWith('.webp') || fileName.endsWith('.gif');

    // Icon and Color Selection based on type
    const getTypeConfig = () => {
        if (isPDF) {
            return {
                icon: <FileText className="w-8 h-8" />,
                color: 'text-red-500',
                bg: 'bg-red-500/10',
                border: 'border-red-500/20',
                label: 'PDF',
                headerGradient: 'from-[#5C0000] via-[#7A0000] to-[#3A0000]',
                circleColor: 'bg-red-900/60',
            };
        }
        if (isExcel) {
            return {
                icon: <FileSpreadsheet className="w-8 h-8" />,
                color: 'text-green-500',
                bg: 'bg-green-500/10',
                border: 'border-green-500/20',
                label: 'Excel',
                headerGradient: 'from-[#003A00] via-[#004E00] to-[#002000]',
                circleColor: 'bg-green-900/60',
            };
        }
        if (isWord) {
            return {
                icon: <FileText className="w-8 h-8" />,
                color: 'text-blue-500',
                bg: 'bg-blue-500/10',
                border: 'border-blue-500/20',
                label: 'Word',
                headerGradient: 'from-[#001A5C] via-[#002A7A] to-[#000E3A]',
                circleColor: 'bg-blue-900/60',
            };
        }
        if (isPPT) {
            return {
                icon: <LayoutPanelLeft className="w-8 h-8" />,
                color: 'text-orange-500',
                bg: 'bg-orange-500/10',
                border: 'border-orange-500/20',
                label: 'PPT',
                headerGradient: 'from-[#5C2A00] via-[#7A3800] to-[#3A1800]',
                circleColor: 'bg-orange-800/60',
            };
        }
        if (isImage) {
            return {
                icon: <FileImage className="w-8 h-8" />,
                color: 'text-purple-500',
                bg: 'bg-purple-500/10',
                border: 'border-purple-500/20',
                label: 'Imagen',
                headerGradient: 'from-[#3A005C] via-[#4E007A] to-[#20003A]',
                circleColor: 'bg-purple-900/60',
            };
        }
        if (isEnlace) {
            return {
                icon: <ExternalLink className="w-8 h-8" />,
                color: 'text-cyan-500',
                bg: 'bg-cyan-500/10',
                border: 'border-cyan-500/20',
                label: 'Enlace',
                headerGradient: 'from-[#003A5C] via-[#004E7A] to-[#00203A]',
                circleColor: 'bg-cyan-900/60',
            };
        }

        // Fallbacks for category if no specific file extension matched
        if (materialType.includes('examen')) {
            return {
                icon: <FileText className="w-8 h-8" />,
                color: 'text-rose-400',
                bg: 'bg-rose-500/10',
                border: 'border-rose-500/20',
                label: 'Examen',
                headerGradient: 'from-[#5C001A] via-[#7A002A] to-[#3A000E]',
                circleColor: 'bg-rose-900/60',
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
            <div className={`aspect-[4/3] sm:aspect-video w-full relative overflow-hidden shrink-0 ${isSelectionMode && isSelected ? 'opacity-80' : ''}`}>
                {thumbnailUrl ? (
                    <img
                        src={thumbnailUrl}
                        alt={material.titulo}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                    />
                ) : (
                    <div className={`w-full h-full relative flex items-center justify-center bg-gradient-to-br ${config.headerGradient} group-hover:scale-105 transition-transform duration-500`}>
                        {/* Minimalist Icon */}
                        <div className={`p-4 sm:p-5 rounded-2xl ${config.circleColor} backdrop-blur-md border border-white/10 shadow-xl transform group-hover:-translate-y-1 transition-transform duration-300`}>
                            {React.cloneElement(config.icon as React.ReactElement<any>, { className: "w-8 h-8 sm:w-12 sm:h-12 text-white opacity-90" })}
                        </div>
                    </div>
                )}

                {/* Overlays */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20 opacity-60" />

                {/* Type Badge — Top Left */}
                <div className="absolute top-2 left-2 sm:top-3 sm:left-3 z-20">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border ${config.color} border-current/30 bg-black/40 backdrop-blur-md font-bold text-[8px] sm:text-[9px] uppercase tracking-wider`}>
                        {config.label}
                    </span>
                </div>
                
                {/* Actions (Floating Delete) — Top Right inside the thumbnail area for cleaner look */}
                {canDelete && onDelete && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete();
                        }}
                        className="absolute top-2 right-2 sm:top-3 sm:right-3 p-1.5 rounded-md bg-red-500/20 text-red-100 hover:text-white backdrop-blur-md transition-all hover:bg-red-500/80 shadow-sm border border-red-500/30 z-30 opacity-80 hover:opacity-100"
                        title="Eliminar material"
                    >
                        <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                )}
            </div>

            {/* Content Area */}
            <div className="p-3 sm:p-4 flex flex-col flex-grow bg-bb-card border-t border-bb-border/20 group-hover:bg-bb-card-hover transition-colors">
                <h3 className="text-xs sm:text-sm font-bold text-bb-text line-clamp-2 leading-snug group-hover:text-blue-400 transition-colors mb-2">
                    {material.titulo}
                </h3>

                <div className="mt-auto flex flex-col gap-2 pt-2 border-t border-bb-border/10">
                    {/* User info */}
                    <div className="flex items-center gap-2">
                        {material.professors?.nombre && (
                            <div className="flex items-center gap-1.5 text-[10px] text-bb-text-secondary font-medium truncate bg-bb-darker/20 px-2 py-1 rounded-md max-w-[50%]" onClick={(e) => e.stopPropagation()}>
                                <User className="w-3 h-3 shrink-0 opacity-70" />
                                <span className="truncate">{material.professors.nombre}</span>
                            </div>
                        )}
                        {material.profiles?.nombre && (
                            <div className="flex items-center gap-1.5 text-[10px] text-bb-text-secondary font-medium truncate bg-bb-darker/20 px-2 py-1 rounded-md flex-1" onClick={(e) => e.stopPropagation()}>
                                <UploadCloud className="w-3 h-3 shrink-0 opacity-70" />
                                <UserHoverCard profile={material.profiles}>
                                    <span className="truncate hover:text-blue-400 transition-colors cursor-pointer">{material.profiles.nombre}</span>
                                </UserHoverCard>
                            </div>
                        )}
                    </div>

                    {/* Footer row: Date and Tags */}
                    <div className="flex items-center justify-between mt-1">
                        <div className="flex items-center gap-1.5 text-[9px] sm:text-[10px] text-bb-text-secondary opacity-70 font-medium tracking-tight">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(material.created_at), 'd MMM, yyyy', { locale: es })}
                        </div>

                        <div className="flex items-center gap-1.5">
                            {material.use_advanced_viewer && (
                                <div className="flex items-center gap-1 text-[8px] sm:text-[9px] font-black text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-md border border-amber-500/20">
                                    <Zap className="w-2.5 h-2.5 fill-current" />
                                    PRO
                                </div>
                            )}

                            {isAdmin && (
                                <button
                                    onClick={toggleAdvancedViewer}
                                    disabled={isUpdatingViewer}
                                    className={`p-1.5 rounded-md transition-all shadow-sm z-30 ${material.use_advanced_viewer
                                        ? 'bg-amber-500/20 text-amber-500 hover:bg-amber-500/30'
                                        : 'bg-zinc-800/20 text-zinc-400 hover:bg-zinc-800/40 hover:text-white'
                                        }`}
                                    title={material.use_advanced_viewer ? "Desactivar Motor Pro" : "Activar Motor Pro"}
                                >
                                    {isUpdatingViewer ? <Loader2 className="w-3 h-3 animate-spin" /> : (material.use_advanced_viewer ? <Zap className="w-3 h-3 fill-current" /> : <ZapOff className="w-3 h-3" />)}
                                </button>
                            )}
                        </div>
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
