const text = `Secc	Docentes
CURSOS ACADÉMICOS	
120266 - Antiguo Perú, Arqueología, Museos y Nuevas Tecnologías	
A	PARDO GRAU, Cecilia Maria Luisa
	
120253 - Antropología Filosófica	
A	DEL MASTRO PUCCIO, Cesare Anibal
	
	
	
120280 - Arte y diseño prehispánico. Naturaleza y legado	
A	PARDO GRAU, Cecilia Maria Luisa
	
120000 - Nivelación en Lenguaje	
A	CARRILLO PASTOR, Giuliana Maria
A	CARRILLO PASTOR, Giuliana Maria
B	MORILLO SOTOMAYOR, Alex`;

function testParse() {
    const lines = text.split('\n').map(l => l.trimRight());
    let currentCodigo = '';
    let currentCurso = '';

    const profMap = new Map<string, Map<string, string>>();

    for (const line of lines) {
        if (!line.trim()) continue;

        // Try course header: "120266 - Antiguo Perú..." or "123456 - Algo\t"
        const courseMatch = line.match(/^([A-Z0-9]{4,8})\s*[-–]\s*(.+?)(?:\t|$)/);
        if (courseMatch) {
            currentCodigo = courseMatch[1];
            currentCurso = courseMatch[2].trim();
            continue;
        }

        // Try professor line: "A\tPARDO GRAU, Cecilia Maria Luisa"
        // Also might have multiple tabs "A\tPROF_NAME\t\t\t"
        const parts = line.split('\t');
        if (parts.length >= 2) {
            const seccion = parts[0].trim();
            const profNamesStr = parts[1].trim();

            if (/^[A-Z]{1,3}$/.test(seccion) && profNamesStr.length > 3) {
                // Split multiple professors if there's a slash " / "
                const profs = profNamesStr.split('/').map(p => p.trim().toUpperCase());

                for (let name of profs) {
                    // Clean up "MERINO SILICANI DE ALVAREZ, Rosanna Maria\nVictoria Andrea" -> remove internal newlines
                    name = name.replace(/\n/g, ' ').replace(/\s+/g, ' ');

                    if (name && currentCodigo) {
                        if (!profMap.has(name)) profMap.set(name, new Map());
                        profMap.get(name)!.set(currentCodigo, currentCurso);
                    }
                }
            }
        }
    }

    console.log("Parsed Professors:");
    for (const [prof, courses] of profMap.entries()) {
        console.log(`${prof}: ${Array.from(courses.values()).join(', ')}`);
    }
}

testParse();
