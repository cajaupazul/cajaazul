# Guía de Configuración Inicial de CampusLink

## 1. Configurar Supabase

### Crear un Proyecto
1. Ir a [Supabase](https://supabase.com)
2. Crear una nueva organización
3. Crear un nuevo proyecto
4. Esperar a que la base de datos esté lista

### Obtener Credenciales
1. Ir a Settings → API
2. Copiar:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 2. Ejecutar Migraciones

### Via SQL Editor de Supabase:
1. Ir a SQL Editor
2. Crear una nueva query
3. Copiar el contenido de las migraciones
4. Ejecutar

Todas las tablas, políticas de RLS e índices se crearán automáticamente.

## 3. Configurar Autenticación (Opcional)

### Google OAuth
1. Ir a Supabase Dashboard → Authentication → Providers
2. Activar "Google"
3. Crear credenciales en Google Cloud Console
4. Copiar Client ID y Secret
5. Pegar en Supabase

### GitHub OAuth
1. Ir a GitHub Settings → Developer settings → OAuth Apps
2. Crear nueva OAuth App
3. Copiar Client ID y Secret
4. Pegar en Supabase

## 4. Variables de Entorno

Crear `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

## 5. Datos de Ejemplo (Opcional)

Para poblar la base de datos con datos de ejemplo, ejecuta estos comandos SQL en Supabase:

### Cursos de Ejemplo
```sql
INSERT INTO courses (nombre, codigo, facultad, carrera, ciclo, descripcion) VALUES
('Algoritmos y Estructuras de Datos', 'CS101', 'Ingeniería', 'Ingeniería de Sistemas', 1, 'Fundamentos de programación'),
('Cálculo Diferencial', 'MATH101', 'Ciencias', 'Ingeniería de Sistemas', 1, 'Introducción al cálculo'),
('Bases de Datos', 'CS201', 'Ingeniería', 'Ingeniería de Sistemas', 2, 'Diseño y gestión de bases de datos'),
('Desarrollo Web', 'CS301', 'Ingeniería', 'Ingeniería de Sistemas', 3, 'Frontend y Backend'),
('Machine Learning', 'CS401', 'Ingeniería', 'Ingeniería de Sistemas', 4, 'Introducción a ML');
```

### Profesores de Ejemplo
```sql
INSERT INTO professors (nombre, universidad, facultad, especialidad) VALUES
('Dr. Juan García', 'Universidad Nacional', 'Ingeniería', 'Programación'),
('Dra. María López', 'Universidad Nacional', 'Ingeniería', 'Bases de Datos'),
('Prof. Carlos Rodríguez', 'Universidad Nacional', 'Ciencias', 'Matemáticas'),
('Prof. Ana Martínez', 'Universidad Nacional', 'Ingeniería', 'Redes');
```

### Eventos de Ejemplo
```sql
INSERT INTO events (titulo, descripcion, fecha_inicio, lugar, tipo) VALUES
('Conferencia de IA', 'Charla sobre inteligencia artificial y machine learning', NOW() + INTERVAL '7 days', 'Auditorio A', 'academic'),
('Hackathon 2025', 'Competencia de programación de 24 horas', NOW() + INTERVAL '14 days', 'Campus Principal', 'academic'),
('Fiesta de Bienvenida', 'Evento de integración estudiantil', NOW() + INTERVAL '3 days', 'Patio Central', 'cultural'),
('Torneo de Fútbol', 'Campeonato inter-carreras', NOW() + INTERVAL '21 days', 'Cancha 1', 'sports');
```

## 6. Instalar y Ejecutar

```bash
# Instalar dependencias
npm install

# Ejecutar en desarrollo
npm run dev

# O compilar para producción
npm run build
npm start
```

## 7. Problemas Comunes

### "supabaseUrl is required"
- Verificar que `.env.local` tiene las variables correctas
- Reiniciar el servidor: `npm run dev`

### "Module not found"
- Ejecutar: `npm install`
- Limpiar cache: `rm -rf .next && npm run build`

### "RLS Policy Violation"
- Verificar que el usuario está autenticado
- Revisar que las políticas se crearon correctamente en Supabase

### Migraciones no se ejecutan
- Asegurarse de ejecutarlas como usuario con rol `admin`
- Verificar la sintaxis SQL
- Revisar los logs de Supabase

## 8. Características Iniciales Habilitadas

✅ Landing page
✅ Autenticación (Email/Contraseña)
✅ Dashboard principal
✅ Gestión de cursos y materiales
✅ Sistema de calificación de profesores
✅ Calendario de eventos
✅ Comunidad y foro
✅ Perfil de usuario
✅ Sistema de puntos
✅ Navbar con navegación

## 9. Próximos Pasos

1. Personalizar colores en `tailwind.config.ts`
2. Agregar logo en navbar
3. Configurar Google OAuth
4. Implementar búsqueda avanzada
5. Agregar notificaciones
6. Implementar chat en tiempo real

## 10. Desplegar a Producción

### Vercel (Recomendado)
1. Hacer push a GitHub
2. Conectar repositorio en Vercel
3. Configurar variables de entorno
4. Deploy automático

### Otros Hosting
- Asegurarse de usar `npm run build` antes de desplegar
- Configurar variables de entorno en el hosting
- Usar `npm start` para iniciar en producción

## Contacto y Soporte

Para dudas sobre la configuración, consulta la documentación de Supabase:
https://supabase.com/docs
