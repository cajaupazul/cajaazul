'use client';

import React from 'react';
import {
    Instagram,
    Linkedin,
    Youtube,
    Twitter,
    Facebook,
    Music2,
    Phone
} from 'lucide-react';

const SOCIAL_LINKS = [
    { icon: Phone, color: 'hover:text-green-400', href: '#' },
    { icon: Facebook, color: 'hover:text-blue-400', href: '#' },
    { icon: Twitter, color: 'hover:text-sky-400', href: '#' },
    { icon: Youtube, color: 'hover:text-red-400', href: '#' },
    { icon: Linkedin, color: 'hover:text-blue-300', href: '#' },
    { icon: Instagram, color: 'hover:text-pink-400', href: '#' },
    { icon: Music2, color: 'hover:text-emerald-400', href: '#' },
];

export default function SocialSidebar() {
    return (
        <div className="fixed left-0 top-0 bottom-0 w-[40px] md:w-[50px] z-[110] hidden xl:flex flex-col items-center justify-center bg-[#002d5a] border-r border-white/10">
            <div className="flex flex-col gap-6">
                {SOCIAL_LINKS.map((social, idx) => (
                    <a
                        key={idx}
                        href={social.href}
                        className={`text-white/70 transition-all duration-300 group ${social.color}`}
                    >
                        <social.icon size={18} className="transition-transform group-hover:scale-110" />
                    </a>
                ))}
            </div>

            {/* Decorative bottom part */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 transform -rotate-90 origin-center">
                <span className="text-[9px] font-black text-white/20 tracking-[0.25em] uppercase whitespace-nowrap">
                    CAMPUSLINK
                </span>
            </div>
        </div>
    );
}
