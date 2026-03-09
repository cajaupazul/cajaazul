# Script para limpiar el bucket course-materials de R2
# Ejecutar desde el directorio del proyecto

$apiDir = "apps\api"

Write-Host "Listando objetos del bucket course-materials..." -ForegroundColor Cyan

# Listar todos los objetos y guardar sus keys
$objects = npx wrangler r2 object list course-materials --json 2>$null | ConvertFrom-Json

if (-not $objects -or $objects.Count -eq 0) {
    Write-Host "No se encontraron objetos o error al listar. Intentando con wrangler desde api/..." -ForegroundColor Yellow
    Push-Location $apiDir
    $rawOutput = npx wrangler r2 object list course-materials 2>&1
    Pop-Location
    Write-Host $rawOutput
}
else {
    Write-Host "Encontrados $($objects.Count) objetos. Eliminando..." -ForegroundColor Yellow
    
    foreach ($obj in $objects) {
        $key = $obj.key
        Write-Host "Eliminando: $key" -ForegroundColor Gray
        Push-Location $apiDir
        npx wrangler r2 object delete "course-materials/$key" 2>&1 | Out-Null
        Pop-Location
    }
    
    Write-Host "Limpieza completada." -ForegroundColor Green
}
