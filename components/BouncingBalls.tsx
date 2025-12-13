'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '@/lib/theme-context';

export default function BouncingBalls() {
  const { colors, themeMode } = useTheme();
  // Ensure we have an array for balls to prevent hydration mismatch
  const [balls, setBalls] = useState<any[]>([]);

  useEffect(() => {
    // Only generate balls on client-side
    const initialBalls = Array.from({ length: 6 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100, // %
      y: Math.random() * 100, // %
      size: Math.random() * 300 + 100, // px
      duration: Math.random() * 20 + 20, // s slower for background
      delay: Math.random() * 5,
    }));
    setBalls(initialBalls);
  }, []);

  // Don't render in dark mode for a cleaner look
  if (themeMode === 'dark') {
    return null;
  }

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {balls.map((ball) => (
        <motion.div
          key={ball.id}
          className="absolute rounded-full opacity-30 blur-3xl mix-blend-multiply filter"
          style={{
            backgroundColor: ball.id % 2 === 0 ? (colors?.primary || '#3b82f6') : (colors?.secondary || '#6366f1'),
            width: ball.size,
            height: ball.size,
            left: `${ball.x}%`,
            top: `${ball.y}%`,
          }}
          animate={{
            x: [0, Math.random() * 200 - 100, 0],
            y: [0, Math.random() * 200 - 100, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: ball.duration,
            repeat: Infinity,
            repeatType: 'reverse',
            ease: 'easeInOut',
            delay: ball.delay,
          }}
        />
      ))}
    </div>
  );
}