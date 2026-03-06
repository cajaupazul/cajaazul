"use client";

import { useState, useRef, useEffect } from 'react';
import { Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AutocompleteProps {
    items: string[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    label?: string;
    className?: string;
}

export function Autocomplete({
    items,
    value,
    onChange,
    placeholder = "Buscar...",
    label,
    className = ""
}: AutocompleteProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState(value);
    const [filteredItems, setFilteredItems] = useState<string[]>([]);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setSearchTerm(value);
    }, [value]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const normalizeString = (str: string) =>
        str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const term = e.target.value;
        setSearchTerm(term);
        onChange(term);

        if (term.length > 0) {
            const normalizedTerm = normalizeString(term);
            const filtered = items.filter(item =>
                normalizeString(item).includes(normalizedTerm)
            );
            setFilteredItems(filtered);
            setIsOpen(true);
        } else {
            setFilteredItems([]);
            setIsOpen(false);
        }
    };

    const handleSelect = (item: string) => {
        setSearchTerm(item);
        onChange(item);
        setIsOpen(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            if (isOpen && filteredItems.length > 0) {
                e.preventDefault();
                handleSelect(filteredItems[0]);
            }
        }
    };

    const handleFocus = () => {
        if (searchTerm.length > 0) {
            const normalizedTerm = normalizeString(searchTerm);
            const filtered = items.filter(item =>
                normalizeString(item).includes(normalizedTerm)
            );
            setFilteredItems(filtered);
            setIsOpen(true);
        }
    };

    return (
        <div className={`relative ${className}`} ref={wrapperRef}>
            {label && (
                <label className="block text-sm font-medium text-gray-400 mb-2">
                    {label}
                </label>
            )}
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={searchTerm}
                    onChange={handleInputChange}
                    onFocus={handleFocus}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    className="w-full bg-bb-card border border-bb-border rounded-xl px-4 py-3 pl-11 text-bb-text placeholder:text-bb-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium"
                />
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute z-50 w-full mt-2 bg-bb-card border border-bb-border rounded-xl shadow-2xl max-h-60 overflow-y-auto custom-scrollbar"
                    >
                        {filteredItems.length > 0 ? (
                            <div className="py-2">
                                <div className="px-4 py-2 text-xs font-medium text-[#0088CC] uppercase tracking-wider">
                                    Coincidencias encontradas
                                </div>
                                {filteredItems.map((item, index) => (
                                    <button
                                        key={index}
                                        type="button"
                                        onClick={() => handleSelect(item)}
                                        className="w-full text-left px-4 py-3 min-h-[48px] text-sm text-bb-text-secondary hover:bg-bb-hover hover:text-bb-text transition-colors flex items-center gap-3 border-b border-bb-border/10 last:border-none"
                                    >
                                        <span>{item}</span>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="px-4 py-3 text-sm text-gray-500 text-center">
                                No se encontraron resultados
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
