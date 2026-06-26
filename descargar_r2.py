import os
import urllib.request
import urllib.parse
import json

# Configuración de la API del Worker
API_URL = "https://campuslink-api.cajaupazul.workers.dev"
SECRET_KEY = "CampusLink-Ext-2026-SuperSecreta"

# Carpeta de descarga: se guardará por defecto en Descargas/Blackboard_Descargas de tu PC
DOWNLOAD_DIR = os.path.join(os.path.expanduser("~"), "Downloads", "Blackboard_Descargas")

def list_files():
    req = urllib.request.Request(
        f"{API_URL}/list-downloads",
        headers={"Authorization": f"Bearer {SECRET_KEY}"}
    )
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            return data.get("files", [])
    except Exception as e:
        print(f"Error listando archivos: {e}")
        return []

def download_file(path, local_path):
    # Asegurar que el directorio local existe
    os.makedirs(os.path.dirname(local_path), exist_ok=True)
    
    encoded_path = urllib.parse.quote(path)
    url = f"{API_URL}/download-file?path={encoded_path}"
    
    req = urllib.request.Request(
        url,
        headers={"Authorization": f"Bearer {SECRET_KEY}"}
    )
    
    try:
        print(f"Descargando: {path} ...")
        with urllib.request.urlopen(req) as response:
            with open(local_path, 'wb') as f:
                f.write(response.read())
        print(f"✓ Guardado en: {local_path}")
        return True
    except Exception as e:
        print(f"✗ Error descargando {path}: {e}")
        return False

def delete_file(path):
    encoded_path = urllib.parse.quote(path)
    url = f"{API_URL}/delete-file?path={encoded_path}"
    
    req = urllib.request.Request(
        url,
        headers={"Authorization": f"Bearer {SECRET_KEY}"},
        method="DELETE"
    )
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            if data.get("success"):
                print(f"✓ Eliminado de R2: {path}")
                return True
            else:
                print(f"✗ Error eliminando de R2 {path}: {data.get('error')}")
                return False
    except Exception as e:
        print(f"✗ Error de conexión al eliminar {path}: {e}")
        return False

def format_size(size_bytes):
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.2f} KB"
    else:
        return f"{size_bytes / (1024 * 1024):.2f} MB"

def main():
    print("====================================================")
    print("   DESCARGADOR ORDENADO DE BLACKBOARD (R2) 🚀   ")
    print("====================================================")
    print(f"Conectándose a: {API_URL} ...")
    
    files = list_files()
    if not files:
        print("\nNo se encontraron archivos en R2 para descargar.")
        input("\nPresiona Enter para salir...")
        return
        
    total_size = sum(f.get("size", 0) for f in files)
    print(f"\nSe encontraron {len(files)} archivos (Tamaño total: {format_size(total_size)}).")
    
    # Preguntar si se deben eliminar los archivos después de descargar
    delete_after = input("\n¿Deseas eliminar los archivos de R2 después de descargarlos con éxito? (s/n): ").strip().lower() == 's'
    
    print("\nIniciando descargas...")
    success_count = 0
    for f in files:
        path = f["key"]
        # El path viene como "Curso/Subcarpeta/archivo.pdf"
        local_path = os.path.join(DOWNLOAD_DIR, path.replace("/", os.sep))
        
        if download_file(path, local_path):
            success_count += 1
            if delete_after:
                delete_file(path)
                
    print("\n====================================================")
    print("   ¡PROCESO FINALIZADO CON ÉXITO! 🎉")
    print("====================================================")
    print(f"Descargados con éxito: {success_count}/{len(files)}")
    print(f"Los archivos se guardaron en: {DOWNLOAD_DIR}")
    print("====================================================")
    input("\nPresiona Enter para cerrar...")

if __name__ == "__main__":
    main()
