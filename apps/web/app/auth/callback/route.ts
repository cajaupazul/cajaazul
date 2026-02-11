import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const next = searchParams.get('next') ?? '/dashboard'
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
            const { data: profile } = await supabase
                .from('profiles')
                .select('nombre, carrera')
                .eq('id', user.id)
                .single()

            if (profile) {
                const isComplete = profile.nombre &&
                    profile.nombre.trim().length > 0 &&
                    profile.carrera &&
                    !['Estudiante', 'General', 'Carrera', ''].includes(profile.carrera)

                if (isComplete) {
                    return NextResponse.redirect(`${origin}${next}`)
                }
            }

            // If not complete, go to onboarding
            return NextResponse.redirect(`${origin}/auth/complete-profile`)
        }
    }

    // return the user to an error page with instructions
    return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent('Error de autenticación o código inválido')}`)
}
