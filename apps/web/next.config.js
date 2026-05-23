// @ts-check

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // IMPORTANTE: NO usar output: 'export' - OpenNext maneja SSR automáticamente
  // output: 'export' elimina todas las capacidades de servidor

  images: {
    unoptimized: true, // Cloudflare Pages compatibility
    remotePatterns: [
      { protocol: 'https', hostname: 'mevfhlhwrrkbhppgeyaj.supabase.co' },
      { protocol: 'https', hostname: 't2.gstatic.com' },
      { protocol: 'https', hostname: 'cajaazul.pages.dev' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' }, // For Google auth avatars
    ],
  },

  // Configuración experimental
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
