'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

interface AccordionProps {
  children: React.ReactNode;
  className?: string;
}

export function Accordion({ children, className = '' }: AccordionProps) {
  return <div className={`space-y-4 ${className}`}>{children}</div>;
}

interface AccordionItemProps {
  title: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export function AccordionItem({ title, children, defaultOpen = false, className = '' }: AccordionItemProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <div className={`overflow-hidden rounded-2xl border ${isOpen ? 'border-bb-border/50 bg-bb-darker shadow-sm' : 'border-bb-border bg-bb-card shadow-transparent'} transition-all ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex w-full items-center justify-between px-5 py-4 md:px-6 md:py-5 text-left font-bold transition-colors hover:bg-bb-hover group ${isOpen ? 'text-blue-400' : 'text-bb-text'}`}
      >
        <span className="flex items-center gap-3 text-base md:text-lg tracking-tight select-none">{title}</span>
        <div className={`p-1 rounded-full transition-colors ${isOpen ? 'bg-blue-500/10' : 'group-hover:bg-bb-darker'}`}>
            <ChevronDown 
            className={`h-5 w-5 md:h-6 md:w-6 transition-transform duration-300 ${isOpen ? 'rotate-180 text-blue-400' : 'text-bb-text-secondary group-hover:text-blue-400'}`} 
            />
        </div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.04, 0.62, 0.23, 0.98] }}
          >
            <div className="px-3 pb-4 pt-1 md:px-6 md:pb-6 md:pt-2">
              <div className="border hover:border-blue-500/20 rounded-2xl p-4 md:p-6 bg-bb-card shadow-inner w-full border-bb-border transition-colors">
                  {children}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
