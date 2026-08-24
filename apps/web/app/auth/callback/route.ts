import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isProfileComplete } from '@/lib/profile-completion'
import { verifyAccountAccess } from '@/lib/auth-access'

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

            const access = await verifyAccountAccess(session.access_token, email)
            if (!access.allowed) {
                console.warn(`[AUTH_GATE] Blocked unauthorized account: ${email}; reason=${access.reason}`)
                await supabase.auth.signOut()
                const errorCode = access.reason === 'unavailable' ? 'AUTH_ACCESS_UNAVAILABLE' : 'ACCESS_NOT_AUTHORIZED'
                return NextResponse.redirect(`${origin}/auth/login?error=${errorCode}`)
            }

            // AUTO-REDIRECT FOR REGISTERED USERS
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('nombre, carrera, onboarding_completed_at')
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
