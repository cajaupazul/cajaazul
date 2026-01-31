'use client';
import React, { useState, useEffect } from 'react';
import { useProfile } from '@/lib/profile-context';
import { supabase, ShopItem, getStorageUrl } from '@/lib/supabase';
import { AvatarWithFrame } from '@/components/ui/AvatarWithFrame';
import PixelCanvas from '@/components/pixel-art/pixel-canvas';

export default function EventosPixelArtPage() {
  const { profile } = useProfile();
  const [equippedFrame, setEquippedFrame] = useState<ShopItem | null>(null);

  useEffect(() => {
    const fetchEquippedFrame = async () => {
      if (!profile?.active_frame_key) {
        setEquippedFrame(null);
        return;
      }
      const { data } = await supabase
        .from('shop_items')
        .select('*')
        .eq('frame_key', profile.active_frame_key)
        .single();
      if (data) setEquippedFrame(data);
    };
    fetchEquippedFrame();
  }, [profile?.active_frame_key]);

  return (
    <div className="min-h-screen bg-bb-dark p-8">
      <div className="max-w-6xl mx-auto flex flex-col h-[calc(100vh-4rem)]">
        {/* Header with Glass Profile Pill */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8 shrink-0">
          <div>
            <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 mb-2">
              Pixel Art
            </h1>
            <p className="text-gray-400 font-medium">
              ¡Deja tu huella! Colabora en tiempo real con la comunidad.
            </p>
          </div>

          {/* Glass Profile Pill */}
          {profile && (
            <div className="flex items-center gap-4 px-5 py-3 rounded-full bg-white/5 backdrop-blur-md border border-white/10 shadow-2xl relative group overflow-hidden">
              {/* Glow Effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="flex flex-col items-end">
                <span className="font-bold text-white tracking-wide">{profile.nombre}</span>
                <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  ONLINE
                </span>
              </div>

              <div className="relative">
                <AvatarWithFrame
                  size={52}
                  avatarUrl={getStorageUrl(profile?.avatar_url)}
                  frameUrl={equippedFrame?.image_url}
                  frameScale={equippedFrame?.frame_settings?.navbar?.scale || 1}
                  offsetX={equippedFrame?.frame_settings?.navbar?.x || 0}
                  offsetY={equippedFrame?.frame_settings?.navbar?.y || 0}
                  name={profile?.nombre}
                />
              </div>
            </div>
          )}
        </div>

        {/* Pixel Canvas Component */}
        <div className="flex-1 w-full bg-bb-card rounded-2xl overflow-hidden border border-white/5 shadow-2xl relative">
          <PixelCanvas
            eventId="pixel-art-2025"
            onClose={() => { }} // No-op since we are embedded
            userProfile={profile}
          />
        </div>
      </div>
    </div>
  );
}
