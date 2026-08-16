import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isProfileComplete } from '@/lib/profile-completion'

function getSafeDestination(value: string | null) {
    if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/auth')) {
        return '/dashboard'
    }

    return value
}

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const next = getSafeDestination(searchParams.get('next'))
    const errorMsg = searchParams.get('error_description') || searchParams.get('error')

    if (errorMsg) {
        return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(errorMsg)}`)
    }

    if (code) {
        const supabase = await createClient()
        const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code)

        if (!error && session) {
            const user = session.user
            const email = user.email || ''

            // STRICT DOMAIN ENFORCEMENT
            if (!email.toLowerCase().endsWith('@alum.up.edu.pe')) {
                console.warn(`[AUTH_GATE] Blocked unauthorized domain: ${email}`)
                await supabase.auth.signOut()
                return NextResponse.redirect(`${origin}/auth/login?error=DOMAIN_RESTRICTED`)
            }

            // AUTO-REDIRECT FOR REGISTERED USERS
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('nombre, carrera')
                .eq('id', user.id)
                .maybeSingle()

            if (profileError) {
                console.error('[AUTH_CALLBACK_PROFILE_CHECK]', profileError.code, profileError.message)
                return NextResponse.redirect(`${origin}/auth/complete-profile?check=retry`)
            }

            if (isProfileComplete(profile)) {
                return NextResponse.redirect(new URL(next, origin))
            }

            // If not complete, go to onboarding
            return NextResponse.redirect(`${origin}/auth/complete-profile`)
        }
    }

    // return the user to an error page with instructions
    return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent('Error de autenticación o código inválido')}`)
}
