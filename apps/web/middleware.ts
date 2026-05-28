import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => request.cookies.set({ name, value, ...options }));
                    supabaseResponse = NextResponse.next({
                        request,
                    });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set({ name, value, ...options })
                    );
                },
            },
        }
    );

    // refreshing the auth token and checking user session
    const { data: { user } } = await supabase.auth.getUser();

    const path = request.nextUrl.pathname;

    // 1. Auto-Login: Si el usuario ya está logueado y va al inicio o al login, lo mandamos directo al dashboard
    if (user && (path === '/' || path === '/auth/login' || path === '/auth/register')) {
        const dashboardUrl = request.nextUrl.clone();
        dashboardUrl.pathname = '/dashboard';
        return NextResponse.redirect(dashboardUrl);
    }

    // 2. Proteger Rutas: Si no está logueado y trata de entrar a páginas privadas, lo mandamos al login
    const isProtectedRoute = path.startsWith('/dashboard') || path.startsWith('/inventory') || path.startsWith('/admin') || path.startsWith('/profile');
    
    if (!user && isProtectedRoute) {
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = '/auth/login';
        return NextResponse.redirect(loginUrl);
    }

    return supabaseResponse;
}

export async function middleware(request: NextRequest) {
    return await updateSession(request);
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * Feel free to modify this pattern to include more paths.
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
