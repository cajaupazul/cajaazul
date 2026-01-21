'use client';

import React, { useState } from 'react';
import { AvatarWithFrame } from '@/components/ui/AvatarWithFrame';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface FrameSettings {
    scale: number;
    x: number;
    y: number;
}

interface FrameEditorProps {
    frameImageUrl: string;
    onSave: (settings: Record<string, FrameSettings>) => void;
    initialSettings?: Record<string, FrameSettings>;
}

const CONTEXTS = [
    { key: 'profile', label: 'Perfil (Grande)', size: 140 as const },
    { key: 'card', label: 'Card (Mediano)', size: 96 as const },
    { key: 'navbar', label: 'Navbar (Pequeño)', size: 56 as const },
];

const DEMO_AVATAR = 'https://api.dicebear.com/7.x/avataaars/svg?seed=Demo';

export function FrameEditor({ frameImageUrl, onSave, initialSettings }: FrameEditorProps) {
    const [settings, setSettings] = useState<Record<string, FrameSettings>>(
        initialSettings || {
            profile: { scale: 1.0, x: 0, y: 0 },
            card: { scale: 1.0, x: 0, y: 0 },
            navbar: { scale: 1.0, x: 0, y: 0 },
        }
    );

    const updateSetting = (context: string, field: keyof FrameSettings, value: number) => {
        setSettings({
            ...settings,
            [context]: { ...settings[context], [field]: value },
        });
    };

    return (
        <div className="space-y-8">
            {/* Live Previews */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {CONTEXTS.map((ctx) => (
                    <div key={ctx.key} className="flex flex-col items-center gap-4 p-6 bg-bb-sidebar/30 rounded-2xl border border-bb-border">
                        <h3 className="text-sm font-bold text-bb-text uppercase tracking-wider">{ctx.label}</h3>

                        {/* Preview */}
                        <div className="flex items-center justify-center h-40">
                            <AvatarWithFrame
                                size={ctx.size}
                                avatarUrl={DEMO_AVATAR}
                                frameUrl={frameImageUrl}
                                frameScale={settings[ctx.key].scale}
                                offsetX={settings[ctx.key].x}
                                offsetY={settings[ctx.key].y}
                            />
                        </div>

                        {/* Controls */}
                        <div className="w-full space-y-3">
                            <div className="space-y-1">
                                <Label className="text-xs text-bb-text-secondary">Escala: {settings[ctx.key].scale.toFixed(2)}</Label>
                                <Input
                                    type="range"
                                    min="0.5"
                                    max="1.5"
                                    step="0.01"
                                    value={settings[ctx.key].scale}
                                    onChange={(e) => updateSetting(ctx.key, 'scale', parseFloat(e.target.value))}
                                    className="w-full"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <Label className="text-xs text-bb-text-secondary">X: {settings[ctx.key].x}px</Label>
                                    <Input
                                        type="range"
                                        min="-20"
                                        max="20"
                                        step="1"
                                        value={settings[ctx.key].x}
                                        onChange={(e) => updateSetting(ctx.key, 'x', parseFloat(e.target.value))}
                                        className="w-full"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-bb-text-secondary">Y: {settings[ctx.key].y}px</Label>
                                    <Input
                                        type="range"
                                        min="-20"
                                        max="20"
                                        step="1"
                                        value={settings[ctx.key].y}
                                        onChange={(e) => updateSetting(ctx.key, 'y', parseFloat(e.target.value))}
                                        className="w-full"
                                    />
                                </div>
                            </div>

                            {/* Reset button */}
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={() => setSettings({ ...settings, [ctx.key]: { scale: 1.0, x: 0, y: 0 } })}
                            >
                                Resetear
                            </Button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Save Button */}
            <div className="flex justify-end gap-3">
                <Button
                    variant="outline"
                    onClick={() => {
                        setSettings({
                            profile: { scale: 1.0, x: 0, y: 0 },
                            card: { scale: 1.0, x: 0, y: 0 },
                            navbar: { scale: 1.0, x: 0, y: 0 },
                        });
                    }}
                >
                    Resetear Todo
                </Button>
                <Button onClick={() => onSave(settings)} className="bg-blue-600 hover:bg-blue-700">
                    Guardar Ajustes
                </Button>
            </div>

            {/* JSON Preview (for debugging) */}
            <details className="bg-bb-darker p-4 rounded-xl">
                <summary className="text-xs font-mono text-bb-text-secondary cursor-pointer">Ver JSON (Debug)</summary>
                <pre className="text-xs mt-2 text-bb-text-secondary overflow-x-auto">
                    {JSON.stringify(settings, null, 2)}
                </pre>
            </details>
        </div>
    );
}
