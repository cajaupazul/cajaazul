import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export const runtime = 'edge'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    // if "next" is in search params, use it as the redirection URL
    const nextParam = searchParams.get('next')

    if (code) {
        const supabase = await createClient()
        const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code)

        if (!error && session) {
            const user = session.user
            const email = user.email || ''

            // STRICT DOMAIN ENFORCEMENT
            if (!email.toLowerCase().endsWith('@alum.up.edu.pe')) {
                console.warn(`[AUTH_GATE] Blocked unauthorized domain: ${email}`);
                await supabase.auth.signOut();
                return NextResponse.redirect(`${origin}/auth/login?error=DOMAIN_RESTRICTED`)
            }

            // AUTO-REDIRECT FOR REGISTERED USERS
            // If the user already has a personalized profile, skip onboarding.
            const { data: profile } = await supabase
                .from('profiles')
                .select('nombre, carrera, google_full_name, email')
                .eq('id', user.id)
                .single();

            if (profile) {
                const isComplete = profile.nombre &&
                    profile.nombre !== profile.google_full_name &&
                    profile.nombre !== profile.email?.split('@')[0] &&
                    profile.carrera &&
                    !['Estudiante', 'General', 'Carrera', ''].includes(profile.carrera);

                if (isComplete) {
                    // User is already registered, go to dashboard or the intended 'next' destination
                    return NextResponse.redirect(`${origin}${nextParam || '/dashboard'}`)
                }
            }

            // If not complete, go to onboarding unless specifically told otherwise
            return NextResponse.redirect(`${origin}${nextParam ?? '/auth/complete-profile'}`)
        }

        // Handle Auth Error (e.g. Domain restriction violation)
        console.error('Auth callback error:', error?.message)
        const errorMessage = searchParams.get('error_description') || error?.message || 'Error de autenticación'
        const errorDescription = encodeURIComponent(errorMessage)
        return NextResponse.redirect(`${origin}/auth/login?error=${errorDescription}`)
    }

    // Check if there's an error in search params even without a code
    const errorParam = searchParams.get('error_description') || searchParams.get('error')
    if (errorParam) {
        return NextResponse.redirect(`${origin}${nextParam || '/auth/login'}?error=${encodeURIComponent(errorParam)}`)
    }

    // return the user to an error page with instructions
    return NextResponse.redirect(`${origin}/auth/login?error=Invalid%20auth%20code`)
}
