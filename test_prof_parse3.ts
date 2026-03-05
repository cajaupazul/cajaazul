const text = `B   CARBONELL ROSSO, María De Las Mercedes

1MN710 - Storytelling: Cómo conectar emocionalmente con los consumidores a través de las historias
A   DE VEGA DE UNCETA, Alejandro

1MN358 - Tecnologías Aplicadas a la Distribución Física Internacional
A   ANTIONA SUAREZ, Erick Olson`;

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
        // Splitting by tabs might fail if it's spaces.
        // Let's use a regex that looks for 1-3 uppercase letters, followed by whitespace (tabs or at least 2 spaces), followed by text.
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
