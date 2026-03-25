'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

interface AccordionProps {
  children: React.ReactNode;
  className?: string;
}

export function Accordion({ children, className = '' }: AccordionProps) {
  return <div className={`flex flex-col w-full gap-2 ${className}`}>{children}</div>;
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
    <div className={`border border-bb-border rounded-md overflow-hidden bg-bb-card transition-all ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex w-full items-center justify-between px-4 py-3.5 md:px-5 md:py-4 text-left transition-colors hover:bg-bb-hover group ${isOpen ? 'text-blue-400 font-bold' : 'text-bb-text font-medium'}`}
      >
        <span className="flex items-center gap-3 text-sm md:text-base tracking-tight select-none w-full">{title}</span>
        <div className="p-1">
            <ChevronDown 
            className={`h-4 w-4 md:h-5 md:w-5 transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-400' : 'text-bb-text-secondary group-hover:text-bb-text'}`} 
            />
        </div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.04, 0.62, 0.23, 0.98] }}
          >
            {/* The content container has a subtle top border to separate it from the header, and is indented with left padding */}
            <div className="pl-6 md:pl-10 pr-4 md:pr-6 pb-4 pt-2 border-t border-bb-border/50 bg-bb-darker/20">
              <div className="w-full">
                  {children}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
