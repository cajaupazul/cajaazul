# Extensión de Blackboard de CampusLink

Este directorio agrupa los archivos propios del cliente de la extensión y sus
herramientas auxiliares. La extensión no forma parte del frontend de
CampusLink y el frontend no necesita la extensión para funcionar.

## Arquitectura

- `client/`: ubicación del código fuente Chromium y del futuro ZIP.
- `tools/doro_doro_descargas.py`: cliente auxiliar para descargar desde R2.
- `apps/api/src/extension.ts`: contrato HTTP aislado que atiende a extensiones.
- `apps/api/wrangler.toml`: binding `BLACKBOARD_DOWNLOADS` del único Worker.

El backend se publica junto con `campuslink-api`, pero su router está separado
del resto de la API. Los clientes solo dependen del contrato HTTP y no importan
código de la web ni de otra extensión. Por ello, una extensión diferente puede
usar la misma API y R2 si dispone de autorización.

## URL y endpoints

URL estable:

`https://campuslink-api.cajaupazul.workers.dev`

- `GET /check-domain`
- `POST /save-snapshot`
- `POST /upload-from-extension`
- `GET /list-downloads`
- `GET /download-file`
- `DELETE /delete-file`

Los nombres de rutas y el bucket `blackboard-downloads` se conservaron para no
romper las extensiones ya instaladas.

## Portal de distribución

La tarjeta y la página `/dashboard/herramientas/extension` pertenecen a
CampusLink únicamente como portal de distribución. El administrador podrá
guardar el ZIP y el tutorial en el bucket `library`; los usuarios podrán
descargarlos desde allí. Esto no crea una dependencia de ejecución entre la
plataforma y la extensión.

## Código cliente pendiente

El ZIP `extension/campuslink-extension.zip` todavía no está versionado ni
cargado en `library`. Cuando esté listo, coloca el código descomprimido en
`client/` y conserva la URL estable de la API indicada arriba.

## Aviso de seguridad

La reorganización mantiene la lógica original para no cambiar su contrato. La
autenticación y cualquier tratamiento de cookies o almacenamiento web deben
revisarse por separado antes de distribuir la extensión a terceros.
