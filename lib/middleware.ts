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

    // IMPORTANT: Avoid infinite loops by excluding auth routes from searching/validation
    const { pathname } = request.nextUrl

    // 1. Completely skip session validation for auth-related public paths
    if (pathname.startsWith('/auth') || pathname.startsWith('/_next') || pathname.startsWith('/api/auth')) {
        return response
    }

    // 2. For protected routes, verify session
    const { data: { user }, error } = await supabase.auth.getUser()

    // 3. Define Protected Routes logic
    const isProtectedRoute = pathname.startsWith('/dashboard') ||
        pathname.startsWith('/admin') ||
        pathname.startsWith('/protected')

    // 4. Handle Auth Errors or Missing Session on Protected Routes
    if (isProtectedRoute) {
        if (error || !user) {
            console.log(`[MIDDLEWARE] Access denied to ${pathname}, redirecting to login.`)
            const url = request.nextUrl.clone()
            url.pathname = '/auth/login'
            // Avoid adding error params to keep URL clean, or add generic message
            return NextResponse.redirect(url)
        }
    }

    return response
}
