import { createClient } from '@/lib/supabase-server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

/**
 * Proxy API Route for serving PDF files securely.
 * Fetches the file from Supabase Storage and returns it as a blob.
 * This hides the original Supabase URL from the client.
 */
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const filePath = searchParams.get('path');

        if (!filePath) {
            return new Response('File path required', { status: 400 });
        }

        // 1. Verify Authentication
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return new Response('Unauthorized', { status: 401 });
        }

        // 2. Fetch file using Admin Client (for private bucket access)
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!serviceRoleKey) {
            console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
            return new Response('Server configuration error', { status: 500 });
        }

        const supabaseAdmin = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            serviceRoleKey
        );

        const bucketName = 'course_materials';
        const { data, error: downloadError } = await supabaseAdmin
            .storage
            .from(bucketName)
            .download(filePath);

        if (downloadError || !data) {
            console.error('Download error:', downloadError);
            return new Response('File not found', { status: 404 });
        }

        // 3. Return the file with correct headers
        // Headers specifically to ensure inline viewing and discourage "Save As"
        const headers = new Headers();
        headers.set('Content-Type', 'application/pdf');
        headers.set('Content-Disposition', 'inline; filename="document.pdf"');
        // Prevent caching for sensitive files
        headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        headers.set('Pragma', 'no-cache');
        headers.set('Expires', '0');

        return new Response(data, {
            status: 200,
            headers,
        });

    } catch (error) {
        console.error('Server error in file proxy:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}
