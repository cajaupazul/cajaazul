import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: 'apps/web/.env.utf8' });

const supabaseUrl = process.env.SUPABASE_URL || 'https://mevfhlhwrrkbhppgeyaj.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Faltan variables de entorno");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const PERIODO = '2026-I';

async function sync() {
    const data = JSON.parse(fs.readFileSync('parsed_offer.json', 'utf-8'));
    console.log(`Iniciando sincronización...`);

    // 1. Fetch existing professors to avoid duplicates
    const { data: existingProfs } = await supabase.from('professors').select('id, nombre');
    const profMap = new Map(existingProfs?.map(p => [p.nombre.toLowerCase().trim(), p.id]));

    // 2. Fetch existing courses to avoid duplicates
    const { data: existingCourses } = await supabase.from('courses').select('id, codigo');
    const courseMap = new Map(existingCourses?.map(c => [c.codigo, c.id]));

    console.log(`Cargados ${profMap.size} profesores y ${courseMap.size} cursos existentes.`);

    for (const course of data) {
        const credits = parseFloat(course.creditos.replace(',', '.'));
        
        // Ensure course exists in main catalog
        let mainCourseId = courseMap.get(course.codigo);
        if (!mainCourseId) {
            const { data: newCourse, error } = await supabase.from('courses').insert({
                codigo: course.codigo,
                nombre: course.nombre,
                creditos: credits
            }).select().single();
            if (newCourse) {
                mainCourseId = newCourse.id;
                courseMap.set(course.codigo, mainCourseId);
            }
        }

        // Ensure course exists in sche_courses
        await supabase.from('sche_courses').upsert({
            id: course.codigo,
            name: course.nombre,
            credits: credits
        });

        // 4. Upsert Sections and Blocks in parallel for this course
        const sectionPromises = course.sections.map(async (section: any) => {
            // Clean professor name
            let profName = (section.profesor || 'POR ASIGNAR')
                .replace(/Es parte del bloque.*/i, '')
                .replace(/Curso dirigido.*/i, '')
                .trim();
            
            if (profName !== 'POR ASIGNAR') {
                let profId = profMap.get(profName.toLowerCase());
                if (!profId) {
                    const { data: newProf } = await supabase.from('professors').insert({
                        nombre: profName,
                        universidad: 'Universidad del Pacífico'
                    }).select().single();
                    if (newProf) {
                        profId = newProf.id;
                        profMap.set(profName.toLowerCase(), profId);
                    }
                }
            }

            const sectionId = `${PERIODO}-${course.codigo}-${section.letra}`;
            
            const { error: upsertErr } = await supabase.from('sche_sections').upsert({
                id: sectionId,
                course_id: course.codigo,
                letter: section.letra,
                teacher: profName,
                periodo: PERIODO
            });
            if (upsertErr) console.error(`Error section ${sectionId}: ${upsertErr.message}`);

            await supabase.from('sche_schedule_blocks').delete().eq('section_id', sectionId);


            const blocks = section.schedules.map((sch: any) => ({
                section_id: sectionId,
                type: mapType(sch.tipo),
                day: sch.dia,
                start_time: sch.inicio,
                end_time: sch.fin,
                classroom: sch.aula
            }));

            if (blocks.length > 0) {
                await supabase.from('sche_schedule_blocks').insert(blocks);
            }
        });

        // 5. Populate legacy oferta_academica table for immediate UI visibility
        const legacyRecords = course.sections.flatMap((section: any) => {
            return section.schedules.map((sch: any) => ({
                periodo: PERIODO,
                codigo_curso: course.codigo,
                nombre_curso: course.nombre,
                seccion: section.letra,
                profesor: section.profesor,
                dia: sch.dia,
                horario: `${sch.inicio} - ${sch.fin}`,
                aula: sch.aula,
                tipo: sch.tipo
            }));
        });

        if (legacyRecords.length > 0) {
            const { error: legacyError } = await supabase.from('oferta_academica').insert(legacyRecords);
            if (legacyError) console.error(`\nError en legacyRecords (${course.codigo}): ${legacyError.message}`);
        }

        await Promise.all(sectionPromises);
        process.stdout.write('.');
    }

    console.log(`\nSincronización finalizada con éxito.`);
}

function mapType(raw: string) {
    if (raw.includes('CLASE')) return 'CLASE';
    if (raw.includes('PARCIAL')) return 'PARCIAL';
    if (raw.includes('FINAL')) return 'FINAL';
    if (raw.includes('PRÁCTICA') || raw.includes('PRACCALIFI') || raw.includes('PRACDIRIGI')) return 'PRACTICA';
    return 'CLASE';
}

sync();
