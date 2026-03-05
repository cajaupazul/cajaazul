import { parseOfertaText } from './apps/web/lib/pdf-schedule-parser';

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

async function run() {
    const res = await parseOfertaText(text);
    console.log(JSON.stringify(res.ofertas, null, 2));
}
run();
