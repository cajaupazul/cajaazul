// @ts-check

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  // Cloudflare Pages with Edge Runtime checks
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
