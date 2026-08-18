'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type PaymentStatus = 'loading' | 'created' | 'pending' | 'paid' | 'failed' | 'cancelled' | 'error';

function PaymentResultContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order_id');
  const returnedStatus = searchParams.get('status');
  const [status, setStatus] = useState<PaymentStatus>(
    returnedStatus === 'error' || !orderId ? 'error' : 'loading',
  );
  const [timedOut, setTimedOut] = useState(false);

  const readOrder = useCallback(async () => {
    if (!orderId) return null;

    const { data, error } = await supabase
      .from('payment_orders')
      .select('status')
      .eq('id', orderId)
      .eq('provider', 'izipay')
      .single();

    if (error || !data) return null;
    const nextStatus = data.status as PaymentStatus;
    setStatus(nextStatus === 'created' ? 'pending' : nextStatus);
    return nextStatus;
  }, [orderId]);

  useEffect(() => {
    if (!orderId || status === 'error') return;

    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      const currentStatus = await readOrder();
      if (cancelled || ['paid', 'failed', 'cancelled'].includes(currentStatus ?? '')) return;

      attempts += 1;
      if (attempts >= 20) {
        setTimedOut(true);
        setStatus('pending');
        return;
      }
      timer = setTimeout(poll, 1500);
    }

    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [orderId, readOrder, status]);

  const paid = status === 'paid';
  const terminalError = ['failed', 'cancelled', 'error'].includes(status);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f2f0e8] px-4 py-10 text-[#102a24]">
      <section className="w-full max-w-lg overflow-hidden rounded-[28px] border border-[#d7d3c7] bg-[#fbfaf5]">
        <div className="border-b border-[#dedacf] px-6 py-5 sm:px-8">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-blue-700">
            <ShieldCheck size={17} />
            CampusLink · Pago seguro
          </div>
        </div>

        <div className="px-6 py-10 text-center sm:px-10 sm:py-12">
          {paid ? (
            <CheckCircle2 className="mx-auto text-emerald-600" size={64} strokeWidth={1.8} />
          ) : terminalError ? (
            <AlertCircle className="mx-auto text-red-600" size={64} strokeWidth={1.8} />
          ) : (
            <Loader2 className="mx-auto animate-spin text-blue-700" size={58} strokeWidth={1.8} />
          )}

          <h1 className="mt-6 text-3xl font-black tracking-tight sm:text-4xl">
            {paid
              ? 'Pago confirmado'
              : terminalError
                ? 'No pudimos confirmar el pago'
                : 'Confirmando tu compra'}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#60716d] sm:text-base">
            {paid
              ? 'Izipay confirmó la transacción y el beneficio ya fue acreditado una sola vez en tu cuenta.'
              : terminalError
                ? 'No se acreditó ningún beneficio. Puedes regresar a la tienda e intentarlo nuevamente.'
                : timedOut
                  ? 'Izipay todavía está procesando la confirmación. Puedes volver a la tienda; el sistema terminará la acreditación automáticamente.'
                  : 'Estamos validando la respuesta firmada de Izipay. Esto normalmente tarda solo unos segundos.'}
          </p>

          <div className="mt-8 rounded-2xl border border-[#dedacf] bg-white px-4 py-3 text-left text-xs leading-5 text-[#60716d]">
            <strong className="text-[#102a24]">Importante:</strong> CampusLink no recibe ni almacena los datos de tu tarjeta.
          </div>

          <Link
            href="/dashboard/store"
            className="mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#102a24] px-6 text-sm font-black text-white transition-colors hover:bg-[#183c34]"
          >
            Volver a la tienda
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </main>
  );
}

export default function PaymentResultPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f2f0e8]" />}>
      <PaymentResultContent />
    </Suspense>
  );
}
