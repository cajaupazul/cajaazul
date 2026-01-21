# CampusLink - Red Académica Colaborativa

Una plataforma web moderna para estudiantes universitarios que buscan acceder a materiales académicos, calificar profesores, descubrir eventos y compartir recursos con otros compañeros.

## Características

### 🎓 Gestión de Cursos y Materiales
- Explora cursos organizados por carrera, ciclo y facultad
- Sube y comparte apuntes, PDFs, videos y exámenes resueltos
- Sistema de categorización por tipo de material
- Contador de descargas para cada recurso
- Gana puntos por compartir materiales

### ⭐ Sistema de Calificación de Profesores
- Califica a tus profesores en escala de 1-5 estrellas
- Deja comentarios sobre tu experiencia
- Evalúa facilidad del curso y claridad de enseñanza
- Promedio de calificaciones visible para cada profesor
- Sistema similar a RateMyProfessor

### 📅 Eventos Universitarios
- Descubre conferencias, talleres y actividades extracurriculares
- Filtra eventos por tipo (académico, cultural, deportivo)
- Regístrate e indica tu interés en eventos
- Calendario interactivo de próximos eventos
- Crea eventos para tu comunidad

### 👥 Comunidad y Foro
- Comparte publicaciones con otros estudiantes
- Sistema de likes en publicaciones
- Comenta y discute con compañeros
- Utiliza hashtags para organizar temas (#estudio, #examenfinal)
- Muro estilo Twitter/Threads

### 🎮 Gamificación
- Gana puntos por contribuir materiales
- Acumula puntos por calificaciones y publicaciones
- Sistema de insignias (Colaborador, Estrella, Tutor, Líder)
- Ranking de contribuidores

### 👤 Perfil de Usuario
- Información personal completa
- Avatar personalizado
- Biografía y datos académicos
- Historial de actividad
- Insignias y logros desbloqueados
- Contador de puntos

## Tecnologías

- **Frontend**: Next.js 14, React 18, TypeScript
- **Base de Datos**: Supabase PostgreSQL
- **Autenticación**: Supabase Auth
- **Estilos**: Tailwind CSS + shadcn/ui
- **Componentes**: Radix UI
- **Iconos**: Lucide React

## Requisitos Previos

- Node.js 18+
- npm o yarn
- Cuenta de Supabase

## Instalación

### 1. Clonar el repositorio
```bash
git clone <repo-url>
cd campuslink
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar variables de entorno
Crea un archivo `.env.local` en la raíz del proyecto:
```bash
cp .env.local.example .env.local
```

Llena las variables con tus credenciales de Supabase:
```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 4. Configurar la base de datos

Las tablas se crean automáticamente en Supabase. Necesitas:

1. Ir a tu proyecto en Supabase
2. Ir a SQL Editor
3. Ejecutar las migraciones proporcionadas en `migrations/`
4. Las políticas de RLS se aplicarán automáticamente

### 5. Ejecutar la aplicación
```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`

## Scripts Disponibles

- `npm run dev` - Inicia el servidor de desarrollo
- `npm run build` - Construye la aplicación para producción
- `npm run start` - Inicia el servidor de producción
- `npm run lint` - Ejecuta linter

## Estructura del Proyecto

```
├── app/
│   ├── auth/
│   │   ├── login/
│   │   └── register/
│   ├── dashboard/
│   │   ├── courses/
│   │   ├── professors/
│   │   ├── events/
│   │   ├── community/
│   │   └── profile/
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── layout/
│   │   └── navbar.tsx
│   └── ui/
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       └── ...
├── lib/
│   ├── supabase.ts
│   └── utils.ts
└── public/
```

## Modelos de Datos

### profiles
Información del usuario con puntos y logros

### courses
Cursos disponibles organizados por carrera y ciclo

### materials
Recursos académicos subidos por estudiantes

### professors
Docentes registrados en la plataforma

### ratings
Calificaciones y comentarios sobre profesores

### events
Eventos universitarios

### posts
Publicaciones en la comunidad

### likes
Sistema de likes en publicaciones

### comments
Comentarios en publicaciones

## Autenticación

- Email/Contraseña
- Google OAuth (configurable)
- GitHub OAuth (configurable)

## Seguridad

- Todas las tablas tienen RLS (Row Level Security) habilitado
- Los usuarios solo pueden ver/editar sus propios datos
- Datos públicos (cursos, profesores, eventos, posts) visibles para todos
- Autenticación requerida para modificar datos

## Roles

- **Estudiante**: Por defecto, puede subir materiales, calificar y publicar
- **Moderador**: (futuro) Aprueba materiales reportados
- **Administrador**: (futuro) Control total de usuarios y contenido

## Contribuir

Las contribuciones son bienvenidas. Por favor:

1. Fork el repositorio
2. Crea una rama para tu feature (`git checkout -b feature/amazing-feature`)
3. Commit tus cambios (`git commit -m 'Add amazing feature'`)
4. Push a la rama (`git push origin feature/amazing-feature`)
5. Abre un Pull Request

## Hoja de Ruta

- [ ] Chat en tiempo real entre estudiantes
- [ ] Integración con IA para resúmenes de materiales
- [ ] Búsqueda inteligente por palabras clave
- [ ] Ranking de cursos populares
- [ ] Modo "Examen" con temporizador
- [ ] Notificaciones en tiempo real
- [ ] Modo oscuro completo
- [ ] Soporte para múltiples idiomas
- [ ] Integración con plataformas académicas

## Licencia

Este proyecto está bajo licencia MIT.

## Soporte

Para reportar bugs o sugerir features, abre un issue en el repositorio.

## Créditos

Desarrollado con ❤️ para la comunidad académica.
