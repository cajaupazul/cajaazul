'use client';

import Image, { type ImageProps } from 'next/image';
import { ImageIcon, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface ImageWithLoaderProps extends Omit<ImageProps, 'fill' | 'onLoad' | 'onError'> {
  containerClassName?: string;
}

export function ImageWithLoader({
  src,
  alt,
  sizes,
  className,
  containerClassName,
  ...props
}: ImageWithLoaderProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [src]);

  return (
    <span
      className={cn('absolute inset-0 block overflow-hidden bg-zinc-900/40', containerClassName)}
      aria-busy={!loaded && !failed}
    >
      {!loaded && !failed && (
        <span className="absolute inset-0 z-10 grid place-items-center overflow-hidden bg-gradient-to-br from-zinc-800 via-zinc-700 to-zinc-800 animate-pulse">
          <Loader2 className="h-5 w-5 animate-spin text-white/60" aria-hidden="true" />
          <span className="sr-only">Cargando imagen</span>
        </span>
      )}

      {failed ? (
        <span className="absolute inset-0 grid place-items-center bg-gradient-to-br from-zinc-800 to-zinc-900 text-white/35">
          <ImageIcon className="h-7 w-7" aria-hidden="true" />
          <span className="sr-only">No se pudo cargar la imagen</span>
        </span>
      ) : (
        <Image
          {...props}
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          onLoad={(event) => {
            const decode = event.currentTarget.decode?.();
            if (decode) {
              void decode.catch(() => undefined).finally(() => setLoaded(true));
            } else {
              setLoaded(true);
            }
          }}
          onError={() => setFailed(true)}
          className={cn(
            'opacity-0 transition-[opacity,transform] duration-300',
            loaded && 'opacity-100',
            className,
          )}
        />
      )}
    </span>
  );
}
