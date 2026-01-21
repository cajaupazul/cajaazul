import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return request.cookies.get(name)?.value
                },
                set(name: string, value: string, options: CookieOptions) {
                    request.cookies.set({ name, value, ...options })
                    response = NextResponse.next({
                        request: { headers: request.headers },
                    })
                    response.cookies.set({ name, value, ...options })
                },
                remove(name: string, options: CookieOptions) {
                    request.cookies.set({ name, value: '', ...options })
                    response = NextResponse.next({
                        request: { headers: request.headers },
                    })
                    response.cookies.set({ name, value: '', ...options })
                },
            },
        }
    )

    try {
        // Attempt to get user to trigger token refresh
        const { error } = await supabase.auth.getUser()

        // RECOVERY: If we detect 400 or auth conflict, force redirect to login
        if (error && (error.status === 400 || error.message.includes('Mismatched'))) {
            console.error('[MIDDLEWARE_ERROR] Auth conflict detected, redirecting to login:', error.message);
            const url = request.nextUrl.clone()
            url.pathname = '/auth/login'
            url.searchParams.set('error', 'Session conflicted. Please login again.')
            return NextResponse.redirect(url)
        }
    } catch (err) {
        console.error('[MIDDLEWARE_EXCEPTION] Recovery redirect:', err);
        const url = request.nextUrl.clone()
        url.pathname = '/auth/login'
        return NextResponse.redirect(url)
    }

    return response
}
