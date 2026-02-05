'use client';

import React from 'react';
import { X, Pencil } from 'lucide-react';
import { AvatarWithFrame } from '@/components/ui/AvatarWithFrame';
import { getStorageUrl, ShopItem } from '@/lib/supabase';

interface ProfileStatsPanelProps {
    show: boolean;
    onToggle: (show: boolean) => void;
    userProfile: any;
    equippedFrame: ShopItem | null | undefined;
    pixelsPainted: number;
}

export const ProfileStatsPanel: React.FC<ProfileStatsPanelProps> = ({
    show,
    onToggle,
    userProfile,
    equippedFrame,
    pixelsPainted
}) => {
    if (!show) {
        return (
            <button
                onClick={() => onToggle(true)}
                className="w-12 h-12 bg-white rounded-full shadow-xl border-2 border-slate-100 overflow-hidden hover:scale-110 active:scale-95 transition-all flex items-center justify-center"
                title="Ver Estadísticas"
            >
                {userProfile && (
                    <AvatarWithFrame
                        size={44}
                        avatarUrl={getStorageUrl(userProfile.avatar_url)}
                        frameUrl={equippedFrame?.image_url}
                        frameScale={equippedFrame?.frame_settings?.navbar?.scale || 1}
                        offsetX={equippedFrame?.frame_settings?.navbar?.x || 0}
                        offsetY={equippedFrame?.frame_settings?.navbar?.y || 0}
                        name={userProfile.nombre}
                    />
                )}
            </button>
        );
    }

    return (
        <div className="bg-white rounded-3xl shadow-2xl p-5 border border-slate-100 w-72 animate-in slide-in-from-top-4">
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full overflow-hidden shadow-md">
                        {userProfile && (
                            <AvatarWithFrame
                                size={48}
                                avatarUrl={getStorageUrl(userProfile.avatar_url)}
                                frameUrl={equippedFrame?.image_url}
                                frameScale={equippedFrame?.frame_settings?.navbar?.scale || 1}
                                offsetX={equippedFrame?.frame_settings?.navbar?.x || 0}
                                offsetY={equippedFrame?.frame_settings?.navbar?.y || 0}
                                name={userProfile.nombre}
                            />
                        )}
                    </div>
                    <div>
                        <h5 className="font-bold text-slate-800 text-sm whitespace-nowrap overflow-hidden text-ellipsis max-w-[120px]">
                            {userProfile?.nombre || 'Usuario'}
                        </h5>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide">
                            Nivel {userProfile?.es_vip ? 'VIP' : '3'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => onToggle(false)}
                    className="bg-slate-50 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            <div className="space-y-3 border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                            <Pencil className="w-4 h-4 text-blue-600" />
                        </div>
                        <span className="text-xs font-medium text-slate-600">Píxeles Pintados</span>
                    </div>
                    <span className="font-bold text-blue-600 text-sm">{pixelsPainted.toLocaleString()}</span>
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
                            <span className="text-amber-600 font-bold text-xs">💰</span>
                        </div>
                        <span className="text-xs font-medium text-slate-600">Monedas</span>
                    </div>
                    <span className="font-bold text-amber-600 text-sm">
                        {userProfile?.monedas?.toLocaleString() || 0}
                    </span>
                </div>
            </div>
        </div>
    );
};
