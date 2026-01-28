# Cloudflare Pages Deployment Guide

This guide details the exact configuration required to deploy the application as a **100% static site** on Cloudflare Pages.

## Project Verification
- **Output Mode:** `export` (Static HTML export)
- **Directory:** `/apps/web`
- **Adapters:** None (No `next-on-pages` or `@cloudflare/next-on-pages` required for runtime)

## Step-by-Step Configuration

1. **Log in to Cloudflare Dashboard** and navigate to **Workers & Pages**.
2. Click **Create Application** > **Pages** > **Connect to Git**.
3. Select the repository `cajaazul`.

### Build Settings (CRITICAL)

Configure the build settings exactly as follows:

| Setting | Value | Notes |
| :--- | :--- | :--- |
| **Framework Preset** | `None` | Do **not** select Next.js. We are deploying a static export. |
| **Build Command** | `npm run build` | This runs `next build` which generates the `out` folder. |
| **Build Output Directory** | `out` | This is where Next.js places static files when `output: 'export'` is set. |
| **Root Directory** | `apps/web` | The Next.js application lives in this subdirectory. |

### 4. Verify `wrangler.toml` (CRITICAL)
Ensure `apps/web/wrangler.toml` points to the correct output directory:
```toml
pages_build_output_dir = "out"
```
If it points to `.vercel/output/static`, the deployment **will fail**.

### Environment Variables
Ensure the following environment variables are set in **Settings > Environment variables**:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY`

> [!NOTE]
> `NEXT_PUBLIC_` variables are baked into the static files at **build time**. If you change these variables in Cloudflare, you must **re-deploy** the site for them to take effect.

## Why "None" Preset?
We are using `output: 'export'` in `next.config.js`. This creates a standard folder of HTML, CSS, and JS files. Cloudflare Pages simply hosts these files. Using the "Next.js" preset often tries to apply the `next-on-pages` adapter or Vercel-specific build output (`.vercel/output`), which can conflict with a pure static export strategy.

## Verification
After deployment, verify:
1. **Routes:** Check `/dashboard`, `/profile`, and importantly `/admin/shop/edit?id=...`.
2. **Reloads:** Refresh the page on a sub-route (e.g., `/dashboard`) to ensure Cloudflare correctly serves the HTML (Cloudflare Pages handles SPA routing automatically for static sites).
