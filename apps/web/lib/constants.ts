/**
 * Centralización de constantes para placeholders y valores por defecto.
 * Ayuda a evitar errores de compilación con valores null en etiquetas <img>.
 */
export const PLACEHOLDERS = {
    // Dicebear es excelente para avatares por defecto dinámicos
    AVATAR: 'https://api.dicebear.com/7.x/avataaars/svg?seed=placeholder',

    // Un placeholder genérico para items de la tienda (transparente por defecto o silueta)
    ITEM: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDUxMiA1MTIiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdG09IjUxMiIgaGVpZ2h0PSI1MTIiIGZpbGw9IiMzMzMiIGZpbGwtb3BhY2l0eT0iMC4xIi8+PHBhdGggZD0iTTI1NiAxNDRMMTU2IDIwNlYzMDZMMjU2IDM2OEwzNTYgMzA2VjIwNkwyNTYgMTQ0WiIgc3Ryb2tlPSIjNjY2IiBzdHJva2Utd2lkdG09IjIwIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PC9zdmc+',

    // Imagen de fondo por defecto
    BACKGROUND: '/backgrounds/default_background.d35fbf.png'
};

export const PROFESSOR_NATURE_BGS = [
    'photo-1441974231531-c6227db76b6e', 'photo-1470074184345-d97a063efcf9', 'photo-1472214103451-9374bd1c798e', 'photo-1501785888041-af3ef285b470',
    'photo-1500382017468-9049fed747ef', 'photo-1469474968028-56623f02e42e', 'photo-1447752875215-b2761acb3c5d', 'photo-1433086966358-54859d0ed716',
    'photo-1464822759023-fed622ff2c3b', 'photo-1501854140801-50d01698950b', 'photo-1511497584788-8767ef7299b2', 'photo-1518173946687-a4c8a9ba332f',
    'photo-1506744038136-46273834b3fb', 'photo-1426604966848-d7adac402bff', 'photo-1414235077428-338989a2e8c0', 'photo-1470770841072-f978cf4d019e',
    'photo-1465146344425-f00d5f5c8f07', 'photo-1475924156735-5a1ec18b8352', 'photo-1505765050516-f72ca413f4c3', 'photo-1501908734255-16579c18c25f',
    'photo-1502082553048-f009c37129b9', 'photo-1504646702315-992224168c1a', 'photo-1507525428034-b723cf961d3e', 'photo-1508739773434-c26b3d09e071',
    'photo-1510784722466-f2aa9c52dee6', 'photo-1513836279014-a89f7a76ae86', 'photo-1516026672322-bc52d61a55d5', 'photo-1523712999610-f77fbcfc3843',
    'photo-1532274402911-5a3b114c5d76', 'photo-1534067783941-51c9c23ceff3', 'photo-1540206351-d6465b3ac5c1', 'photo-1546587348-d12660c30c50',
    'photo-1552083375-1447ce886485', 'photo-1559128010-7c1ad6e1b6a5', 'photo-1565118531796-763e5082d113', 'photo-1572449043416-55f4685c9bb7',
    'photo-1588392382834-a8af9fce4a6c', 'photo-1604537466158-719b1972feb8', 'photo-1610812384504-2070494f6cda', 'photo-1611095771285-d3e5cdfb9bbd',
    'photo-1615716175402-274197c72477', 'photo-1618005182384-a83a8bd57fbe', 'photo-1621849400072-f554417f7051', 'photo-1623018035782-b269248df916',
    'photo-1627483262268-9c2b5b2834b5', 'photo-1635202685817-f584e0306798', 'photo-1647891938250-954adede9c51', 'photo-1650383794689-54898fd65598',
    'photo-1673240228394-0f2c73045610', 'photo-1682687442117-5f926578a871', 'photo-1493246507139-91e8bef99c02', 'photo-1477346611705-65d1883cee1e',
    'photo-1434725039720-abb26e22ebe1', 'photo-1501183638710-841dd1904471', 'photo-1500627760128-7e447604d70d', 'photo-1513146122818-bc159d88e66f',
    'photo-1473448912268-2022ce9509d8', 'photo-1473448912268-2022ce9509d8', 'photo-1470770903676-69b98201ea1c', 'photo-1505118380757-91f5f45d8de8',
    'photo-1500375592092-40eb2168fd21', 'photo-1511512578047-dfb367046420', 'photo-1506905925346-21bda4d32df4', 'photo-1542332213-9b5a5a3fab35',
];

export const getStringHash = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
};

export const getDiversifiedProfessorBackground = (name: string, specialty?: string | null, url?: string | null): string => {
    // If we have a custom URL and it's not a placeholder/source unsplash, use it
    if (url && !url.includes('picsum.photos') && !url.includes('source.unsplash.com') && !url.includes('unsplash.com/featured')) {
        if (url.includes('images.unsplash.com') && !url.includes('auto=format')) {
            return `${url}${url.includes('?') ? '&' : '?'}auto=format&fit=crop&q=80&w=1600&h=900`;
        }
        return url;
    }

    // Combine name and specialty for a more unique seed
    const fullKey = `${name}-${specialty || ''}`;
    const hash = getStringHash(fullKey);

    // If hash exceeds our pool, or as a secondary variety strategy, use LoremFlickr with nature tags
    // This virtually guarantees 200+ unique images because LoremFlickr has a massive library indexed by lock
    if (hash % 10 > 7) { // 20% of the time use LoremFlickr for extra variety
        return `https://loremflickr.com/1600/900/nature,landscape,forest,mountain/all?lock=${hash}`;
    }

    // Primary premium pool (80% of the time)
    const randomId = PROFESSOR_NATURE_BGS[hash % PROFESSOR_NATURE_BGS.length];
    return `https://images.unsplash.com/${randomId}?auto=format&fit=crop&q=80&w=1600&h=900`;
};
