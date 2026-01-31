
'use client';

import React, { useEffect, useState, useRef } from 'react';

interface CoinCounterProps {
    value: number;
    className?: string;
}

export function CoinCounter({ value, className = '' }: CoinCounterProps) {
    const [displayValue, setDisplayValue] = useState(value);
    const startTimestamp = useRef<number | null>(null);
    const startValue = useRef(value);
    const duration = 1000; // ms

    useEffect(() => {
        if (value === displayValue) return;

        startValue.current = displayValue;
        startTimestamp.current = null;

        // Use requestAnimationFrame for smooth animation
        const step = (timestamp: number) => {
            if (!startTimestamp.current) startTimestamp.current = timestamp;
            const progress = Math.min((timestamp - startTimestamp.current) / duration, 1);

            // Ease out cubic
            const easeProgress = 1 - Math.pow(1 - progress, 3);

            const nextValue = Math.floor(startValue.current + (value - startValue.current) * easeProgress);
            setDisplayValue(nextValue);

            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                setDisplayValue(value);
            }
        };

        window.requestAnimationFrame(step);

    }, [value]);

    return (
        <span className={`tabular-nums transition-colors duration-300 ${className}`}>
            {displayValue.toLocaleString()}
        </span>
    );
}
