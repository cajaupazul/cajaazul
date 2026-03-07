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
}: Omit<MaterialCardProps, 'size'>) {
    const size = 'normal';
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
                label: 'Presentación'
            };
        }
        if (materialType.includes('examen')) {
            return {
                icon: <FileText className="w-8 h-8" />,
                color: 'text-red-400',
                bg: 'bg-red-500/10',
                border: 'border-red-500/20',
                label: 'Examen'
            };
        }
        if (materialType.includes('syllabus')) {
            return {
                icon: <FileText className="w-8 h-8" />,
                color: 'text-teal-400',
                bg: 'bg-teal-500/10',
                border: 'border-teal-500/20',
                label: 'Sílabo'
            };
        }
        if (isEnlace) {
            return {
                icon: <ExternalLink className="w-8 h-8" />,
                color: 'text-blue-400',
                bg: 'bg-blue-500/10',
                border: 'border-blue-500/20',
                label: 'Enlace'
            };
        }
        if (materialType.includes('xls') || materialType.includes('excel')) {
            return {
                icon: <FileSpreadsheet className="w-8 h-8" />,
                color: 'text-green-400',
                bg: 'bg-green-500/10',
                border: 'border-green-500/20',
                label: 'Excel'
            };
        }
        return {
            icon: <FileBox className="w-8 h-8" />,
            color: 'text-blue-400',
            bg: 'bg-blue-500/10',
            border: 'border-blue-500/20',
            label: 'Material'
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
            {/* Thumbnail Area */}
            <div className={`${size === 'compact' ? 'aspect-square sm:aspect-video' : 'aspect-video'} w-full relative flex items-center justify-center overflow-hidden shrink-0 ${config.bg}`}>
                {thumbnailUrl ? (
                    <img
                        src={thumbnailUrl}
                        alt={material.titulo}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                    />
                ) : (
                    <div className={`${config.color} opacity-30 group-hover:scale-110 group-hover:opacity-60 transition-all duration-500 transform`}>
                        {React.cloneElement(config.icon as React.ReactElement<any>, { className: size === 'compact' ? 'w-6 h-6' : 'w-8 h-8' })}
                    </div>
                )}

                {/* Overlay with Gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-40" />

                {/* Type Badge */}
                <div className={`absolute ${size === 'compact' ? 'top-1.5 right-1.5' : 'top-3 right-3'} z-10 flex gap-2`}>
                    <Badge className={`${config.bg} ${config.color} border-current/20 backdrop-blur-md font-bold ${size === 'compact' ? 'text-[7px] px-1 py-0' : 'text-[9px]'} uppercase tracking-wider`}>
                        {config.label}
                    </Badge>
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
            {canDelete && onDelete && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                    }}
                    className="absolute top-2 right-2 p-2 rounded-xl bg-red-500/10 text-red-500 backdrop-blur-sm transition-all hover:bg-red-500/20 shadow-sm border border-red-500/20 z-20"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            )}
        </motion.div>
    );
}
