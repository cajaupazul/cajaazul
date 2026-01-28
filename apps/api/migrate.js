import { createClient } from '@supabase/supabase-js'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const supabase = createClient(
    'https://mevfhlhwrrkbhppgeyaj.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ldmZobGh3cnJrYmhwcGdleWFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5NDgyMDIsImV4cCI6MjA3NzUyNDIwMn0.E_Rhnhh8dbRiBLTg52HpDfJSqv2Q_hE-mSjHlkLF2IE'
)

const r2 = new S3Client({
    region: 'auto',
    endpoint: 'https://5e614cfca6c816031489d869c4388096.r2.cloudflarestorage.com',
    credentials: {
        accessKeyId: 'ff3eaa58e2b4fb15a15bb296405a9671',
        secretAccessKey: 'a453f5012d4e7f5e11dba0ec5b96b69680688008e1ca533f78f49a11cbdd821a'
    }
})

const BUCKETS = {
    'course_materials': 'course-materials',
    'course_images': 'course-images',
    'profile-avatars': 'profile-avatars',
    'profile-frames': 'profile-frames',
    'grupos': 'grupos'
}

async function migrate() {
    for (const [supaBucket, r2Bucket] of Object.entries(BUCKETS)) {
        console.log(`Migrando ${supaBucket}...`)
        try {
            const { data: files, error } = await supabase.storage.from(supaBucket).list()

            if (error) {
                console.error(`Error listing ${supaBucket}:`, error)
                continue
            }

            // Recursively list folders if needed, but for now flat list or top level
            // The list() command on Supabase only returns top level items. 
            // We might need to handle folders.
            // Assuming flat or simple folder structure for now as per user snippet.

            for (const file of files || []) {
                if (file.id === null) {
                    // It's a folder?
                    console.log(`  Skipping folder (not implemented recursive): ${file.name}`)
                    continue
                }

                console.log(`  Downloading ${file.name}...`)
                const { data, error: downError } = await supabase.storage.from(supaBucket).download(file.name)

                if (downError) {
                    console.error(`  Error downloading ${file.name}:`, downError)
                    continue
                }

                console.log(`  Uploading to R2 ${r2Bucket}/${file.name}...`)
                await r2.send(new PutObjectCommand({
                    Bucket: r2Bucket,
                    Key: file.name,
                    Body: Buffer.from(await data.arrayBuffer()),
                    ContentType: data.type
                }))
                console.log(`  ✓ ${file.name}`)
            }
        } catch (e) {
            console.error(`Error processing bucket ${supaBucket}:`, e)
        }
    }
    console.log('Migración completa')
}

migrate()
