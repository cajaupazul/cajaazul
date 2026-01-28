# Comenzando con CampusLink

Bienvenido a CampusLink, tu plataforma académica colaborativa. Esta guía te ayudará a empezar en minutos.

## Pasos Rápidos

### 1. Clonar o Descargar el Proyecto

```bash
git clone <url-del-repositorio>
cd campuslink
```

### 2. Instalar Dependencias

```bash
npm install
```

### 3. Crear Cuenta en Supabase

1. Ir a https://supabase.com
2. Crear una nueva cuenta
3. Crear un nuevo proyecto
4. Ir a Settings → API
5. Copiar las credenciales

### 4. Configurar Variables de Entorno

Crear archivo `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

### 5. Ejecutar Migraciones

#### Opción A: Vía SQL Editor de Supabase
1. Abrir Supabase Dashboard
2. Ir a SQL Editor
3. Crear nueva query
4. Ejecutar el contenido del archivo de migración en `migrations/`

#### Opción B: Script Automático (si lo implementas)
```bash
npm run migrate
```

### 6. Iniciar Servidor de Desarrollo

```bash
npm run dev
```

Visita `http://localhost:3000` en tu navegador.

## Primeros Pasos en la App

### Crear tu Cuenta

1. Haz clic en "Registrarse"
2. Completa:
   - Nombre completo
   - Email universitario
   - Contraseña (mínimo 6 caracteres)
   - Universidad
   - Carrera
3. Haz clic en "Crear Cuenta"
4. Serás redirigido al dashboard

### Explorar el Dashboard

En tu primer acceso verás:
- **Panel de Control**: Tus estadísticas
- **Acceso Rápido**: Botones a todas las secciones
- **Próximos Eventos**: Eventos que puedes filtrar
- **Materiales Recientes**: Recursos compartidos por otros

### Navegar por Secciones

#### 🎓 Cursos y Materiales
- Ve a "Cursos" en el menú
- Busca cursos de tu carrera
- Haz clic en uno para ver materiales
- Sube tus propios apuntes
- Gana 10 puntos por cada material subido

#### ⭐ Califica Profesores
- Ve a "Profesores"
- Busca a tu profesor
- Haz clic en "Calificar"
- Deja tu reseña (1-5 estrellas)
- Ayuda a otros estudiantes a elegir

#### 📅 Eventos
- Ve a "Eventos"
- Explora por tipo (Académico, Cultural, Deportivo)
- Regístrate en eventos que te interesen
- Crea eventos para tu comunidad

#### 👥 Comunidad
- Ve a "Comunidad"
- Comparte tips y preguntas
- Dale likes a publicaciones útiles
- Comenta y ayuda a otros

#### 👤 Tu Perfil
- Ve a "Mi Perfil" (dropdown usuario)
- Edita tu información
- Agrega una biografía
- Visualiza tus logros

## Consejos de Uso

### Para Estudiar Mejor
- Comparte apuntes de tus cursos
- Descarga materiales de otros
- Pide recomendaciones en comunidad
- Participa en eventos académicos

### Para Calificar Profesores
- Sé honesto y constructivo
- Especifica qué te gustó o no
- Ayuda a futuros estudiantes

### Para Crear Comunidad
- Usa hashtags (#estudio, #examenfinal)
- Comparte recursos útiles
- Ayuda a compañeros
- Crea eventos colaborativos

## Troubleshooting

### No puedo iniciar sesión
- Verifica que el email sea correcto
- Asegúrate que la contraseña es exacta
- Si olvidaste la contraseña, usa "Recuperar contraseña"

### No veo los datos que subí
- Recarga la página (F5)
- Verifica tener internet conectado
- Comprueba que has iniciado sesión

### Los materiales no se descargan
- Verifica el enlace en el navegador
- Intenta con otro navegador
- Contacta al administrador

### Tengo un error de "supabaseUrl is required"
- Verifica las variables en `.env.local`
- Reinicia el servidor: `npm run dev`
- Recarga la página

## Características Principales

| Característica | Descripción |
|---|---|
| **Cursos** | Accede a materiales académicos organizados |
| **Profesores** | Califica y lee reseñas de docentes |
| **Eventos** | Descubre actividades universitarias |
| **Comunidad** | Comparte knowledge con otros estudiantes |
| **Perfil** | Personaliza tu información |
| **Puntos** | Gana puntos por contribuir |

## Permisos y Privacidad

- Solo TÚ ves tu información personal
- Los materiales son públicos para tu universidad
- Las calificaciones de profesores son anónimas
- Puedes eliminar tus publicaciones
- Los datos se protegen con RLS (Row Level Security)

## Contacto y Soporte

¿Necesitas ayuda?
- Lee el archivo `README.md`
- Consulta `SETUP.md` para configuración
- Revisa `PROJECT_SUMMARY.md` para detalles técnicos

## Siguientes Pasos

1. Configura tu perfil con tu foto
2. Explora cursos de tu carrera
3. Sube tu primer material
4. Califica a un profesor
5. Comparte una publicación en comunidad
6. Regístrate en un evento

¡Bienvenido a CampusLink! 🎓✨

---

**Versión**: 1.0
**Última actualización**: 2025
**Desarrollado con ❤️ para estudiantes**
