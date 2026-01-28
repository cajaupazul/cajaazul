'use client';

import { useEffect } from 'react';

/**
 * useSecurity hook
 * Implements a deterrent layer to prevent easy downloading, inspecting, and screenshotting of content.
 * 
 * Includes:
 * - Context menu blocking (Right-click)
 * - Keyboard shortcut blocking (F12, Ctrl+S, Ctrl+P, Ctrl+U, etc.)
 * - Focus loss protection (Blur when multitasking or leaving the tab)
 */
export const useSecurity = (isEnabled: boolean = true) => {
    useEffect(() => {
        if (!isEnabled) return;

        // 1. Prevent Context Menu (Right-click)
        const handleContextMenu = (e: MouseEvent) => {
            e.preventDefault();
            // Optional: Show a subtle toast or alert if needed
        };

        // 2. Prevent Keyboard Shortcuts
        const handleKeyDown = (e: KeyboardEvent) => {
            // Chrome/Edge/Firefox common shortcuts
            const isCtrl = e.ctrlKey || e.metaKey; // Command for Mac, Ctrl for Windows
            const isShift = e.shiftKey;
            const key = e.key.toLowerCase();

            // Blocking shortcuts
            if (
                // F12 (DevTools)
                e.key === 'F12' ||
                // PrintScreen (Screenshot attempt)
                key === 'printscreen' ||
                // Ctrl+S (Save)
                (isCtrl && key === 's') ||
                // Ctrl+P (Print)
                (isCtrl && key === 'p') ||
                // Ctrl+U (View Source)
                (isCtrl && key === 'u') ||
                // Ctrl+Shift+I (DevTools)
                (isCtrl && isShift && key === 'i') ||
                // Ctrl+Shift+J (Console)
                (isCtrl && isShift && key === 'j') ||
                // Ctrl+Shift+C (Inspect Element)
                (isCtrl && isShift && key === 'c') ||
                // Ctrl+C (Copy)
                (isCtrl && key === 'c') ||
                // Ctrl+V (Paste)
                (isCtrl && key === 'v')
            ) {
                if (key === 'printscreen') {
                    // Force blur and copy a blank space to clipboard if possible
                    document.body.classList.add('page-blurred-security');
                }
                e.preventDefault();
                e.stopPropagation();
            }
        };

        // 3. Focus Protection (Visual Deterrent for Screenshots/Multitasking)
        const handleBlur = () => {
            document.body.classList.add('page-blurred-security');
        };

        const handleFocus = () => {
            document.body.classList.remove('page-blurred-security');
        };

        // Detect PrintScreen via keyup as well (some browsers)
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() === 'printscreen') {
                document.body.classList.add('page-blurred-security');
                setTimeout(() => {
                    document.body.classList.remove('page-blurred-security');
                }, 2000);
            }
        };

        // Attach listeners
        window.addEventListener('contextmenu', handleContextMenu);
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', handleBlur);
        window.addEventListener('focus', handleFocus);

        // Initial check (case where tab starts out of focus)
        if (!document.hasFocus()) {
            handleBlur();
        }

        return () => {
            // Cleanup listeners
            window.removeEventListener('contextmenu', handleContextMenu);
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('blur', handleBlur);
            window.removeEventListener('focus', handleFocus);
            document.body.classList.remove('page-blurred-security');
        };
    }, [isEnabled]);
};
