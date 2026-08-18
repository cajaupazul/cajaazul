'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type CheckoutConfig = {
  order_id: string;
  form_token: string;
  public_key: string;
  js_url: string;
  css_url: string;
  theme_url: string;
  post_url_success: string;
  environment: 'test' | 'production';
};

interface IzipayCheckoutProps {
  productId: string;
  onError: (error: Error) => void;
}

function removeIzipayAssets() {
  document.querySelectorAll('[data-campuslink-izipay="true"]').forEach((node) => node.remove());
}

export default function IzipayCheckout({ productId, onError }: IzipayCheckoutProps) {
  const formContainer = useRef<HTMLDivElement>(null);
  const [config, setConfig] = useState<CheckoutConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function createPaymentOrder() {
      setLoading(true);
      setError(null);
      setConfig(null);

      const { data, error: functionError } = await supabase.functions.invoke('izipay-create-payment', {
        body: { product_id: productId },
      });

      if (cancelled) return;
      if (functionError || !data?.form_token) {
        const nextError = new Error(data?.error || functionError?.message || 'No se pudo abrir Izipay.');
        setError(nextError.message);
        setLoading(false);
        onError(nextError);
        return;
      }

      setConfig(data as CheckoutConfig);
    }

    createPaymentOrder();
    return () => {
      cancelled = true;
    };
  }, [productId, onError]);

  useEffect(() => {
    if (!config || !formContainer.current) return;

    removeIzipayAssets();
    const container = formContainer.current;
    container.replaceChildren();

    const paymentForm = document.createElement('div');
    paymentForm.className = 'kr-embedded';
    paymentForm.setAttribute('kr-form-token', config.form_token);
    container.appendChild(paymentForm);

    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = config.css_url;
    stylesheet.dataset.campuslinkIzipay = 'true';
    document.head.appendChild(stylesheet);

    const paymentScript = document.createElement('script');
    paymentScript.src = config.js_url;
    paymentScript.type = 'text/javascript';
    paymentScript.setAttribute('kr-public-key', config.public_key);
    paymentScript.setAttribute('kr-post-url-success', config.post_url_success);
    paymentScript.dataset.campuslinkIzipay = 'true';
    paymentScript.onload = () => setLoading(false);
    paymentScript.onerror = () => {
      const nextError = new Error('No se pudo cargar el formulario seguro de Izipay.');
      setError(nextError.message);
      setLoading(false);
      onError(nextError);
    };
    document.head.appendChild(paymentScript);

    const themeScript = document.createElement('script');
    themeScript.src = config.theme_url;
    themeScript.type = 'text/javascript';
    themeScript.dataset.campuslinkIzipay = 'true';
    document.head.appendChild(themeScript);

    return () => {
      container.replaceChildren();
      removeIzipayAssets();
    };
  }, [config, onError]);

  return (
    <div className="space-y-4 p-4 sm:p-5">
      <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <ShieldCheck className="mt-0.5 shrink-0 text-blue-400" size={18} />
        <div>
          <p className="text-sm font-bold text-white">Pago protegido por Izipay</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">
            Verás únicamente los métodos habilitados para CampusLink. Los datos de pago no pasan por nuestros servidores.
          </p>
        </div>
      </div>

      {config?.environment === 'test' && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-200">
          Entorno de prueba: no se realizará ningún cobro real.
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
          <AlertCircle className="mt-0.5 shrink-0" size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="relative min-h-[250px] overflow-hidden rounded-xl bg-white p-2 sm:p-3">
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white text-zinc-700">
            <Loader2 className="animate-spin text-blue-600" size={26} />
            <p className="text-xs font-semibold">Preparando el pago seguro…</p>
          </div>
        )}
        <div ref={formContainer} id="campuslink-izipay-form" className="min-h-[230px] w-full" />
      </div>

      <p className="text-center text-[11px] leading-relaxed text-zinc-500">
        La compra se acredita solo después de validar la confirmación firmada de Izipay.
      </p>
    </div>
  );
}
