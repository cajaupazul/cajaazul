'use server'

import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { isProfileComplete } from '@/lib/profile-completion'

export async function login(formData: FormData) {
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const supabase = await createClient()

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    })

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/', 'layout')

    const { data: profile } = await supabase
        .from('profiles')
        .select('nombre, carrera')
        .eq('id', data.user.id)
        .maybeSingle()

    redirect(isProfileComplete(profile) ? '/dashboard' : '/auth/complete-profile')
}

export async function register(formData: FormData) {
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const nombre = formData.get('nombre') as string
    const universidad = formData.get('universidad') as string
    const carrera = formData.get('carrera') as string

    const supabase = await createClient()

    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                nombre,
                universidad,
                carrera,
            },
        },
    })

    if (authError) {
        return { error: authError.message }
    }

    if (authData.user) {
        // Map faculty to logo
        const facultyLogos: { [key: string]: string } = {
            'Facultad de Ciencias Empresariales': '/logo/fce.png',
            'Facultad de Derecho': '/logo/fd.png',
            'Facultad de Economía y Finanzas': '/logo/fef.png',
            'Facultad de Ingeniería': '/logo/fi.png'
        }
        const defaultAvatar = facultyLogos[carrera] || '/logo/fce.png'
        const officialNameUpper = nombre.toUpperCase()

        // Create or update profile (handle trigger conflicts)
        const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
                id: authData.user.id,
                email,
                google_full_name: officialNameUpper,
                nombre: officialNameUpper, // Initially nickname is the full name to avoid NOT NULL error
                universidad,
                carrera,
                avatar_url: defaultAvatar,
                puntos: 0,
            })

        if (profileError) {
            return { error: profileError.message }
        }
    }

    revalidatePath('/', 'layout')
    redirect('/auth/complete-profile')
}

export async function logout() {
    const supabase = await createClient()
    const cookieStore = await cookies()

    // 1. Sign out from Supabase (clears basic state)
    await supabase.auth.signOut()

    // 2. Aggressively clear Supabase-related cookies
    // This handles cases where signOut might not purge everything in the edge environment
    const allCookies = cookieStore.getAll()
    allCookies.forEach((cookie: { name: string }) => {
        if (cookie.name.includes('sb-') || cookie.name.includes('supabase')) {
            cookieStore.delete(cookie.name)
        }
    })

    revalidatePath('/', 'layout')
    redirect('/auth/login')
}

export async function completeUserProfile(data: {
    nombre: string,
    carrera: string,
    instagram?: string
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'No autenticado' }

    const facultyLogos: { [key: string]: string } = {
        'Facultad de Ciencias Empresariales': '/logo/fce.png',
        'Facultad de Derecho': '/logo/fd.png',
        'Facultad de Economía y Finanzas': '/logo/fef.png',
        'Facultad de Ingeniería': '/logo/fi.png'
    }
    const avatarUrl = facultyLogos[data.carrera] || '/logo/fce.png'

    const { error } = await supabase
        .from('profiles')
        .update({
            nombre: data.nombre.trim(),
            carrera: data.carrera,
            avatar_url: avatarUrl,
            link_instagram: data.instagram?.trim() || null,
            universidad: 'Universidad del Pacífico'
        })
        .eq('id', user.id)

    if (error) {
        console.error('Error in completeUserProfile:', error)
        return { error: error.message }
    }

    revalidatePath('/', 'layout')
    return { success: true }
}
