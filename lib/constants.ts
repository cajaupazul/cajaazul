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
    BACKGROUND: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTkyMCIgaGVpZ2h0PSIxMDgwIiB2aWV3Qm94PSIwIDAgMTkyMCAxMDgwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxOTIwIiBoZWlnaHQ9IjEwODAiIGZpbGw9InVybCgjZ3JhZCkiLz48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImdyYWQiIHgxPSIwIiB5MT0iMCIgeDI9IjE5MjAiIHkyPSIxMDgwIiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHN0b3Agc3RvcC1jb2xvcj0iIzE2MWIxZSIvPjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iIzA5MDkwYiIvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjwvc3ZnPg=='
};
