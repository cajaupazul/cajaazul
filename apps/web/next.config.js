// @ts-check

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // IMPORTANTE: NO usar output: 'export' - OpenNext maneja SSR automáticamente
  // output: 'export' elimina todas las capacidades de servidor

  images: {
    unoptimized: true, // Cloudflare Pages no soporta Next.js Image Optimization API
  },

  // Configuración experimental para Server Actions
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  // Headers de seguridad
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
