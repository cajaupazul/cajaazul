import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { verifyAccountAccess } from '@/lib/auth-access';

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request });

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
                    supabaseResponse = NextResponse.next({ request });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set({ name, value, ...options })
                    );
                },
            },
        }
    );

    const { data: { user } } = await supabase.auth.getUser();
    const path = request.nextUrl.pathname;
    const isProtectedRoute = path.startsWith('/dashboard')
        || path.startsWith('/inventory')
        || path.startsWith('/admin')
        || path.startsWith('/profile');
    const isAuthEntryRoute = path === '/' || path === '/auth/login' || path === '/auth/register';

    // Validate exceptional external accounts on every private navigation. Institutional
    // accounts are accepted locally, so a temporary Worker outage cannot block students.
    if (user && !user.is_anonymous && (isProtectedRoute || isAuthEntryRoute)) {
        const { data: { session } } = await supabase.auth.getSession();
        const access = session?.access_token
            ? await verifyAccountAccess(session.access_token, user.email)
            : { allowed: false, reason: 'unavailable' as const };

        if (!access.allowed) {
            await supabase.auth.signOut();
            const loginUrl = request.nextUrl.clone();
            loginUrl.pathname = '/auth/login';
            loginUrl.search = '';
            loginUrl.searchParams.set(
                'error',
                access.reason === 'unavailable' ? 'AUTH_ACCESS_UNAVAILABLE' : 'ACCESS_NOT_AUTHORIZED',
            );
            return NextResponse.redirect(loginUrl);
        }
    }

    if (user && isAuthEntryRoute) {
        const dashboardUrl = request.nextUrl.clone();
        dashboardUrl.pathname = '/dashboard';
        return NextResponse.redirect(dashboardUrl);
    }

    if (!user && isProtectedRoute) {
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = '/auth/login';
        return NextResponse.redirect(loginUrl);
    }

    return supabaseResponse;
}

export async function middleware(request: NextRequest) {
    return updateSession(request);
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
