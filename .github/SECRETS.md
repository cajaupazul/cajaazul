# Configuración de Secrets en GitHub

Para que el workflow automático funcione, necesitas configurar el siguiente secret en GitHub:

## CLOUDFLARE_API_TOKEN

1. Ve a Cloudflare Dashboard → My Profile → API Tokens
2. Crea un nuevo token con permisos:
   - Account: Workers Scripts (Edit)
   - Zone: Workers Routes (Edit)
3. Copia el token
4. Ve a tu repositorio en GitHub → Settings → Secrets and variables → Actions
5. Crea un nuevo secret llamado `CLOUDFLARE_API_TOKEN`
6. Pega el token

## Verificación

Una vez configurado, cada push a `main` que modifique archivos en `apps/api/` desplegará automáticamente el Worker.

También puedes ejecutar el deploy manualmente desde la pestaña "Actions" en GitHub.
