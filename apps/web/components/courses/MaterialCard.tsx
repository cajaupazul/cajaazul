'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { FileText, FileImage, LayoutPanelLeft, FileSpreadsheet, FileBox, ExternalLink, MoreVertical, Calendar, User, UploadCloud } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getStorageUrl, Material } from '@/lib/supabase';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { UserHoverCard } from '@/components/ui/UserHoverCard';
import { Trash2 } from 'lucide-react';

interface MaterialCardProps {
    material: Material;
    onClick: () => void;
    onDelete?: () => void;
    canDelete?: boolean;
    viewMode?: 'grid' | 'list';
}

export default function MaterialCard({
    material,
    onClick,
    onDelete,
    canDelete = false,
    viewMode = 'grid'
}: MaterialCardProps) {
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
        return (
            <motion.div
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={onClick}
                className="flex items-center justify-between p-3 bg-bb-darker/20 hover:bg-bb-card rounded-xl border border-bb-border/50 transition-all cursor-pointer group active:scale-[0.99]"
            >
                <div className="flex items-center gap-4 min-w-0">
                    <div className={`p-2 rounded-xl ${config.bg} ${config.color} group-hover:scale-110 transition-transform flex-shrink-0`}>
                        {thumbnailUrl ? (
                            <img src={thumbnailUrl} alt={material.titulo} className="w-8 h-8 object-cover rounded-lg" />
                        ) : config.icon}
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-bold text-bb-text truncate">
                            {material.titulo}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-bb-text-secondary font-medium">
                            <Badge variant="outline" className={`text-[8px] uppercase font-black py-0 px-1.5 ${config.color} border-current opacity-70`}>
                                {config.label}
                            </Badge>
                            {material.professors?.nombre && (
                                <span className="flex items-center gap-1 truncate max-w-[100px]" onClick={(e) => e.stopPropagation()}>
                                    <User className="w-3 h-3" />
                                    {material.professors.nombre}
                                </span>
                            )}
                            {material.profiles?.nombre && (
                                <div onClick={(e) => e.stopPropagation()}>
                                    <UserHoverCard profile={material.profiles}>
                                        <span className="flex items-center gap-1 truncate max-w-[100px] hover:text-blue-400 transition-colors">
                                            <UploadCloud className="w-3 h-3" />
                                            {material.profiles.nombre}
                                        </span>
                                    </UserHoverCard>
                                </div>
                            )}
                            <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {format(new Date(material.created_at), 'd MMM', { locale: es })}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 px-2">
                    {canDelete && onDelete && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete();
                            }}
                            className="p-2 rounded-lg hover:bg-red-500/20 text-red-500 transition-all bg-red-500/10"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                    <MoreVertical className="w-4 h-4 text-bb-text-secondary group-hover:text-blue-400 opacity-50 group-hover:opacity-100 transition-all" />
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ y: -4 }}
            onClick={onClick}
            className="flex flex-col bg-bb-darker/20 rounded-2xl overflow-hidden border border-bb-border/50 hover:border-blue-500/20 shadow-sm transition-all cursor-pointer group active:scale-[0.98]"
        >
            {/* Thumbnail Area — old card style */}
            <div className={`aspect-video w-full relative overflow-hidden shrink-0 ${!thumbnailUrl ? 'border-b-2 border-orange-600/70' : ''}`}>
                {thumbnailUrl ? (
                    <img
                        src={thumbnailUrl}
                        alt={material.titulo}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                    />
                ) : (
                    <>
                        {/* Solid warm gradient background */}
                        <div className={`absolute inset-0 bg-gradient-to-br ${config.headerGradient}`} />

                        {/* Decorative circle — bottom-right (large, very visible) */}
                        <div
                            className={`absolute -bottom-10 -right-10 w-44 h-44 rounded-full ${config.circleColor} opacity-90`}
                        />
                        {/* Decorative circle — top-right (medium, visible) */}
                        <div
                            className={`absolute -top-8 -right-4 w-32 h-32 rounded-full ${config.circleColor} opacity-75`}
                        />

                        {/* Title — center-left (vertically centered) */}
                        <div className="absolute inset-0 flex items-center px-4 z-10">
                            <p className="text-base font-black text-white leading-tight line-clamp-3 drop-shadow-lg">
                                {material.titulo}
                            </p>
                        </div>
                    </>
                )}

                {/* Overlay with Gradient for thumbnails */}
                {thumbnailUrl && <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-40" />}

                {/* Type Badge — centered at top */}
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
                    <span className={`inline-block px-3 py-0.5 rounded-full border ${config.color} border-current/60 bg-black/30 backdrop-blur-sm font-black text-[9px] uppercase tracking-widest`}>
                        {config.label}
                    </span>
                </div>
            </div>

            {/* Content Area */}
            <div className="p-4 space-y-3 bg-bb-card border-t border-bb-border/50">
                <p className="text-sm font-black text-bb-text line-clamp-2 leading-tight min-h-[2.5rem] group-hover:text-blue-400 transition-colors">
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
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[10px] text-bb-text-secondary opacity-60 font-medium uppercase">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(material.created_at), 'd MMM, yyyy', { locale: es })}
                        </div>

                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="p-1 px-2 rounded-lg bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase">
                                Ver
                            </div>
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
                        className="absolute top-2 right-2 p-2 rounded-xl bg-red-500/10 text-red-500 backdrop-blur-sm transition-all hover:bg-red-500/20 shadow-sm border border-red-500/20 z-20"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                )
            }
        </motion.div >
    );
}
