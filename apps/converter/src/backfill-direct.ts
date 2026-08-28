import { createClient } from '@supabase/supabase-js';
import { enqueueLegacyJob } from './queue';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function backfill() {
    console.log('🔄 Starting direct thumbnail backfill...');

    try {
        // 1. Fetch materials without thumbnails
        const { data: materials, error } = await supabase
            .from('materials')
            .select('*')
            .is('thumbnail_url', null);

        if (error) {
            console.error('❌ Error fetching materials:', error);
            return;
        }

        console.log(`Found ${materials.length} materials without thumbnails.`);

        const supportedExtensions = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png', '.webp'];

        for (const material of materials) {
            const url = material.url_archivo;
            if (!url) continue;

            let key = '';
            if (url.includes('path=')) {
                key = url.split('path=')[1].split('&')[0];
            } else if (url.includes('/course_materials/')) {
                key = url.split('/course_materials/')[1];
            }

            if (!key) {
                console.warn(`⚠️ Could not extract key for: ${url}`);
                continue;
            }

            key = decodeURIComponent(key);
            const keyPath = key.split('?')[0];
            const fileExt = path.extname(keyPath).toLowerCase();

            if (supportedExtensions.includes(fileExt)) {
                console.log(`Processing: ${material.titulo} (${fileExt}) - materialId: ${material.id}`);

                try {
                    await enqueueLegacyJob(key, 'course-materials');
                    console.log(`✅ Queued: ${material.titulo}`);
                } catch (e: any) {
                    console.error(`❌ Failed processing ${material.titulo}:`, e.message);
                }
            } else {
                console.log(`Skipping unsupported type: ${material.titulo} (${fileExt})`);
            }
        }

        console.log('✨ Direct backfill process completed!');
    } catch (globalError) {
        console.error('❌ Global error in backfill:', globalError);
    }
}

backfill();
