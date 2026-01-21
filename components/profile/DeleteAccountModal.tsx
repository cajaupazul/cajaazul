'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { handleDeepLogout } from '@/lib/auth-helpers';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface DeleteAccountModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function DeleteAccountModal({ isOpen, onClose }: DeleteAccountModalProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleDelete = async () => {
        setError('');
        setLoading(true);

        try {
            const { error: rpcError } = await supabase.rpc('delete_user_account');
            if (rpcError) throw new Error(rpcError.message);

            await handleDeepLogout('Tu cuenta ha sido eliminada permanentemente.');
        } catch (err: any) {
            setError(err.message || 'Error al eliminar la cuenta.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px] bg-bb-sidebar border-bb-border text-bb-text">
                <DialogHeader>
                    <div className="flex items-center gap-3 text-red-500 mb-2">
                        <AlertTriangle className="w-6 h-6" />
                        <DialogTitle className="text-xl font-bold">Eliminar Cuenta</DialogTitle>
                    </div>
                    <DialogDescription className="text-bb-text-secondary">
                        Esta acción es **permanente**. Se eliminará tu perfil, puntos y acceso.
                    </DialogDescription>
                </DialogHeader>

                {error && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm italic">
                        {error}
                    </div>
                )}

                <DialogFooter className="gap-2">
                    <Button variant="ghost" onClick={onClose} disabled={loading}>
                        Cancelar
                    </Button>
                    <Button onClick={handleDelete} disabled={loading} className="bg-red-600 hover:bg-red-700 text-white">
                        {loading ? <Loader2 className="animate-spin" /> : 'Eliminar Permanentemente'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
