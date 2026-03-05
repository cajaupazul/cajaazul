const text = `Secc	Docentes
CURSOS ACADÉMICOS	
120266 - Antiguo Perú, Arqueología, Museos y Nuevas Tecnologías	
A	PARDO GRAU, Cecilia Maria Luisa
	
120253 - Antropología Filosófica	
A	DEL MASTRO PUCCIO, Cesare Anibal
	
	
	
120280 - Arte y diseño prehispánico. Naturaleza y legado	
A	PARDO GRAU, Cecilia Maria Luisa
	
120270 - Comunicación Digital	
A	ESPINOSA WINDER, Francisco
`;

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
            console.log("Found course:", currentCodigo, currentCurso);
            continue;
        }

        // Try professor line: "A\tPARDO GRAU, Cecilia" or "A   DE VEGA DE UNCETA..."
        const profMatch = line.match(/^([A-Z0-9]{1,3})(?:\t|\s{2,})(.*)$/);

        if (profMatch) {
            const seccion = profMatch[1].trim();
            const profNamesStr = profMatch[2].trim();
            console.log("Found potential prof:", seccion, profNamesStr);

            if (profNamesStr.length > 3) {
                // Split multiple professors if there's a slash " / "
                const profs = profNamesStr.split('/').map(p => p.trim().toUpperCase());

                for (let name of profs) {
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
