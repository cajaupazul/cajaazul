'use client';

import React from 'react';
import { Bot, Sparkles, MessageSquare, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

export default function CampusLinkAIPage() {
  return (
    <div className="w-full h-full min-h-[calc(100vh-80px)] flex flex-col items-center justify-center bg-[#0a0b0d] p-6 text-center relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 flex flex-col items-center max-w-2xl"
      >
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center mb-8 shadow-[0_0_40px_rgba(37,99,235,0.3)]">
          <Bot className="w-10 h-10 text-white" />
        </div>

        <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tighter mb-4">
          CAMPUS<span className="text-blue-500">LINK</span> <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">AI</span>
        </h1>
        
        <p className="text-lg text-white/60 font-medium mb-12 max-w-lg">
          Estamos entrenando a nuestro asistente virtual para ofrecerte la mejor experiencia de aprendizaje. ¡Próximamente disponible!
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
          <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.05] flex flex-col items-center gap-3">
            <Sparkles className="w-6 h-6 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">Inteligente</h3>
            <p className="text-xs text-white/50">Respuestas precisas y contextuales</p>
          </div>
          <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.05] flex flex-col items-center gap-3">
            <Zap className="w-6 h-6 text-blue-400" />
            <h3 className="text-sm font-bold text-white">Rápido</h3>
            <p className="text-xs text-white/50">Resolución de dudas al instante</p>
          </div>
          <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.05] flex flex-col items-center gap-3">
            <MessageSquare className="w-6 h-6 text-purple-400" />
            <h3 className="text-sm font-bold text-white">24/7</h3>
            <p className="text-xs text-white/50">Siempre disponible para ayudarte</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
