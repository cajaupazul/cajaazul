'use client';

import { motion } from 'framer-motion';
import { FileText, FileImage, LayoutPanelLeft, FileSpreadsheet, FileBox, ExternalLink, MoreVertical, Calendar, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getStorageUrl, Material } from '@/lib/supabase';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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
                className="flex items-center justify-between p-3 bg-bb-darker/40 hover:bg-bb-card rounded-2xl border border-bb-border/50 hover:border-blue-500/30 transition-all cursor-pointer group active:scale-[0.99]"
            >
                <div className="flex items-center gap-4 min-w-0">
                    <div className={`p-2 rounded-xl ${config.bg} ${config.color} group-hover:scale-110 transition-transform flex-shrink-0`}>
                        {thumbnailUrl ? (
                            <img src={thumbnailUrl} alt={material.titulo} className="w-8 h-8 object-cover rounded-lg" />
                        ) : config.icon}
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-bold text-white truncate">
                            {material.titulo}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-bb-text-secondary font-medium">
                            <Badge variant="outline" className={`text-[8px] uppercase font-black py-0 px-1.5 ${config.color} border-current opacity-70`}>
                                {config.label}
                            </Badge>
                            {material.professors?.nombre && (
                                <span className="flex items-center gap-1 truncate">
                                    <User className="w-3 h-3" />
                                    {material.professors.nombre}
                                </span>
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
                            className="p-2 rounded-lg hover:bg-red-500/20 text-red-500 transition-all opacity-0 group-hover:opacity-100"
                        >
                            <LayoutPanelLeft className="w-4 h-4 rotate-45" />
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
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ y: -4, scale: 1.02 }}
            onClick={onClick}
            className="flex flex-col bg-bb-darker/40 rounded-3xl overflow-hidden border border-bb-border/50 hover:border-blue-500/40 hover:shadow-2xl hover:shadow-blue-500/10 transition-all cursor-pointer group active:scale-[0.98]"
        >
            {/* Thumbnail Area */}
            <div className={`h-32 md:h-40 relative flex items-center justify-center overflow-hidden ${config.bg}`}>
                {thumbnailUrl ? (
                    <img
                        src={thumbnailUrl}
                        alt={material.titulo}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        loading="lazy"
                    />
                ) : (
                    <div className={`${config.color} opacity-40 group-hover:scale-125 group-hover:opacity-80 transition-all duration-500 transform`}>
                        {config.icon}
                    </div>
                )}

                {/* Overlay with Gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />

                {/* Type Badge */}
                <div className="absolute top-3 left-3">
                    <Badge className={`${config.bg} ${config.color} border-${config.color.split('-')[1]}-500/30 backdrop-blur-md font-black text-[9px] uppercase tracking-widest`}>
                        {config.label}
                    </Badge>
                </div>
            </div>

            {/* Content Area */}
            <div className="p-4 bg-black/40 backdrop-blur-sm border-t border-white/5 space-y-3">
                <p className="text-xs md:text-[13px] font-bold text-white line-clamp-2 leading-snug min-h-[2.5rem] group-hover:text-blue-400 transition-colors">
                    {material.titulo}
                </p>

                <div className="flex flex-col gap-2 pt-1 border-t border-white/5">
                    {material.professors?.nombre && (
                        <div className="flex items-center gap-2 text-[10px] text-bb-text-secondary font-bold truncate">
                            <div className="w-5 h-5 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                                <User className="w-3 h-3" />
                            </div>
                            {material.professors.nombre}
                        </div>
                    )}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[10px] text-bb-text/40 font-bold uppercase tracking-tighter">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(material.created_at), 'd MMM, yyyy', { locale: es })}
                        </div>

                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="p-1 px-2 rounded-lg bg-blue-500/10 text-blue-400 text-[10px] font-black uppercase">
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
                    className="absolute top-2 right-2 p-2 rounded-xl bg-red-500/20 text-red-500 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all hover:scale-110 active:scale-90"
                >
                    <LayoutPanelLeft className="w-3.5 h-3.5 rotate-45" />
                </button>
            )}
        </motion.div>
    );
}
