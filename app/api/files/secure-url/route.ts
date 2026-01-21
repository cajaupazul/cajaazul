import { createClient } from '@/lib/supabase-server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { filePath } = await req.json();
        if (!filePath) {
            return NextResponse.json({ error: 'File path required' }, { status: 400 });
        }

        // Check user subscription tier
        const { data: profile } = await supabase
            .from('profiles')
            .select('subscription_tier')
            .eq('id', user.id)
            .single();

        const isPremium = profile?.subscription_tier === 'premium';
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        // TODO: In production, ensure this key is present. 
        // For now, if missing, we might fail or try anon key (which won't work for private buckets).
        if (!serviceRoleKey) {
            console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        // Create Admin Client for Storage Operations
        const supabaseAdmin = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            serviceRoleKey
        );

        let signedUrlData;

        // Extract the clean path from the URL if a full URL was passed
        // Supabase usually stores path like "123/module1.pdf"
        // But if we have "course_materials/123/module1.pdf", we need to be careful with bucket name.

        // Assuming the filePath passed is relative to the bucket 'course_materials'.
        // e.g., "user_id/filename.pdf"

        const bucketName = 'course_materials';

        if (isPremium) {
            // Premium: 1 hour access + download
            signedUrlData = await supabaseAdmin
                .storage
                .from(bucketName)
                .createSignedUrl(filePath, 3600, {
                    download: true,
                });
        } else {
            // Free: 60 seconds access
            signedUrlData = await supabaseAdmin
                .storage
                .from(bucketName)
                .createSignedUrl(filePath, 60);
        }

        if (signedUrlData.error) {
            console.error('Error generating signed URL:', signedUrlData.error);
            return NextResponse.json({ error: 'File not found or error generating URL' }, { status: 404 });
        }

        return NextResponse.json({
            url: signedUrlData.data.signedUrl,
            isPremium
        });

    } catch (error) {
        console.error('Server error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
