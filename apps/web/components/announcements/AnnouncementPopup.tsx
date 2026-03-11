'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink } from 'lucide-react';

interface Announcement {
    id: string;
    title: string;
    image_url: string;
    link_url: string;
    is_active: boolean;
    show_once: boolean;
}

export default function AnnouncementPopup() {
    const [announcement, setAnnouncement] = useState<Announcement | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const checkAnnouncement = async () => {
            // Priority 1: Check if already seen in this session
            const hasSeen = sessionStorage.getItem('campuslink_ad_seen');
            if (hasSeen) return;

            // Fetch the most recent active announcement with highest priority
            const { data, error } = await supabase
                .from('announcements')
                .select('*')
                .eq('is_active', true)
                .order('priority', { ascending: false })
                .limit(1)
                .single();

            if (data && !error) {
                setAnnouncement(data);
                // Pre-load image before showing
                const img = new Image();
                img.src = data.image_url;
                img.onload = () => {
                    setIsVisible(true);
                    setIsLoaded(true);
                };
            }
        };

        checkAnnouncement();
    }, []);

    const handleClose = () => {
        setIsVisible(false);
        if (announcement?.show_once) {
            sessionStorage.setItem('campuslink_ad_seen', 'true');
        }
    };

    const handleAction = () => {
        if (announcement?.link_url) {
            window.open(announcement.link_url, '_blank');
        }
        handleClose();
    };

    if (!announcement || !isLoaded) return null;

    return (
        <AnimatePresence>
            {isVisible && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 md:p-12 overflow-hidden">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleClose}
                        className="absolute inset-0 bg-black/80 backdrop-blur-md"
                    />

                    {/* Pop-up Container */}
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 30 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 30 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="relative max-w-full max-h-full flex flex-col items-center"
                    >
                        {/* The Image Wrapper with Solid Borders */}
                        <div className="relative group overflow-hidden rounded-2xl border-4 border-white/10 shadow-2xl bg-black">
                            
                            {/* Close Button (Matching user image style) */}
                            <button
                                onClick={handleClose}
                                className="absolute top-4 right-4 z-50 p-2 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors shadow-lg active:scale-95"
                            >
                                <X className="w-6 h-6" strokeWidth={3} />
                            </button>

                            {/* "PUBLICIDAD" Label (Top overlay) */}
                            <div className="absolute top-4 left-4 z-40 px-2 py-0.5 bg-black/60 backdrop-blur-md border border-white/20 rounded text-[10px] font-bold text-white/70 tracking-widest uppercase">
                                Publicidad
                            </div>

                            {/* Main Image */}
                            <img 
                                src={announcement.image_url} 
                                alt={announcement.title}
                                className="max-w-[90vw] md:max-w-[500px] lg:max-w-[600px] max-h-[70vh] object-contain block cursor-pointer"
                                onClick={handleAction}
                            />

                            {/* Action Button (Optional Overlay at bottom) */}
                            {announcement.link_url && (
                                <div className="absolute bottom-6 left-0 right-0 px-8 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={handleAction}
                                        className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-8 rounded-full shadow-xl flex items-center gap-2 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300"
                                    >
                                        Ir al sitio <ExternalLink className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Title Underneath (Optional, helpful for context) */}
                        <motion.p 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1, transition: { delay: 0.3 } }}
                            className="mt-4 text-white/50 text-xs font-medium tracking-wide uppercase"
                        >
                            Haz clic en la imagen para ver más
                        </motion.p>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
