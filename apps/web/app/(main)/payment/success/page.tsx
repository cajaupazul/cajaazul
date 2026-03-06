'use client';
import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * SUCCESS BRIDGE PAGE (Public)
 * This page serves as a high-performance entry point from Mercado Pago.
 * It strictly avoids SSR, Auth, and Heavy Logic to prevent Error 522.
 */
function SuccessBridgeContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        // Capture status and all params from Mercado Pago to forward them
        const query = searchParams.toString();

        // Immediate internal redirect using router.replace
        // We include all original params to ensure status_detail etc are preserved
        router.replace(`/dashboard/store?${query}`);
    }, [router, searchParams]);

    return (
        <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-4">
            <div className="text-center space-y-6 animate-pulse">
                {/* Minimalist Tailwind Loader */}
                <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
                <div className="space-y-2">
                    <h1 className="text-2xl font-black text-white uppercase tracking-widest italic">Confirmando Pago</h1>
                    <p className="text-slate-400 text-sm font-medium">Redirigiendo a tu tienda segura...</p>
                </div>
            </div>
        </div>
    );
}

export default function PaymentSuccessPage() {
    return (
        <Suspense fallback={null}>
            <SuccessBridgeContent />
        </Suspense>
    );
}
