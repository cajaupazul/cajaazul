'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function ForgotPasswordPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [error, setError] = useState('');

    const handleResetRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
                redirectTo: `${window.location.origin}/auth/callback?next=/auth/complete-profile`,
            });

            if (resetError) {
                setError(resetError.message);
                setLoading(false);
                return;
            }

            setIsSubmitted(true);
        } catch (err: any) {
            console.error('[RESET_PASSWORD_EXCEPTION]', err);
            setError('Ocurrió un error inesperado al intentar procesar tu solicitud.');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
            <div className="w-full max-w-md bg-white rounded-[2.5rem] p-8 sm:p-12 shadow-2xl border border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <Link
                    href="/auth/login"
                    className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold text-sm transition-colors mb-8 group"
                >
                    <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                    Volver al Inicio de Sesión
                </Link>

                <div className="mb-8">
                    <h1 className="text-3xl font-black text-slate-900 mb-2 italic uppercase">Recuperar Clave</h1>
                    <p className="text-slate-500 font-medium">Ingresa tu correo institucional y te enviaremos las instrucciones de recuperación.</p>
                </div>

                {isSubmitted ? (
                    <div className="text-center space-y-6 py-4 animate-in fade-in zoom-in duration-500">
                        <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle2 size={40} strokeWidth={2.5} />
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 italic uppercase">¡Enlace Enviado!</h2>
                        <p className="text-slate-600 font-medium text-balance">
                            Si tu correo <span className="text-indigo-600 font-bold">{email}</span> está registrado, recibirás un enlace para cambiar tu contraseña en unos momentos.
                        </p>
                        <Button
                            onClick={() => router.push('/auth/login')}
                            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold h-13 py-3 rounded-2xl shadow-xl transition-all hover:scale-[1.01] active:scale-[0.98] italic uppercase"
                        >
                            Cerrar y Volver
                        </Button>
                    </div>
                ) : (
                    <form onSubmit={handleResetRequest} className="space-y-6">
                        {error && (
                            <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-top-2">
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-slate-700 font-black text-xs uppercase tracking-widest ml-1">
                                Correo Institucional
                            </Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="tu@universidad.edu.pe"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="h-14 border-slate-200 focus:border-indigo-500 focus:ring-indigo-500 rounded-2xl transition-all font-medium px-5"
                                required
                            />
                        </div>

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black h-14 py-3 rounded-2xl shadow-xl shadow-indigo-100 transition-all hover:scale-[1.01] active:scale-[0.98] italic uppercase tracking-wider"
                        >
                            {loading ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    <span>Procesando...</span>
                                </div>
                            ) : (
                                'Enviar Instrucciones'
                            )}
                        </Button>
                    </form>
                )}
            </div>
        </div>
    );
}
