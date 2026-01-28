// @ts-check

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Cloudflare Pages specific configuration
  output: 'export', // Required for standard static site deployment on Pages
  images: {
    unoptimized: true, // Required because Pages doesn't support the Next.js Image Optimization API
  },
};

// Configuración segura para Cloudflare Pages
// setupDevPlatform solo se debe ejecutar en desarrollo local
if (process.env.NODE_ENV === 'development') {
  try {
    const { setupDevPlatform } = require('@cloudflare/next-on-pages/next-dev');
    module.exports = setupDevPlatform(nextConfig);
  } catch (e) {
    console.warn(
      'Cloudflare Pages: Failed to load @cloudflare/next-on-pages/next-dev. Skipping setupDevPlatform.',
      e
    );
    module.exports = nextConfig;
  }
} else {
  // En producción (Cloudflare Pages), no necesitamos setupDevPlatform
  module.exports = nextConfig;
}
