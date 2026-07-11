"""
Script Python para procesar Oferta-Academica-2026-II-V2.xlsx
y subirlo directamente a Supabase.
"""

import openpyxl
import re
import json
import urllib.request
import urllib.error
import sys

# ── CONFIG ───────────────────────────────────────────────────────────────────
EXCEL_PATH   = r"c:\Users\huama\Downloads\bolt descomprimido\project-bolt-sb1-emsbaasg\project\horario\Oferta-Academica-2026-II-V2.xlsx"
SUPABASE_URL = "https://mevfhlhwrrkbhppgeyaj.supabase.co"
ANON_KEY     = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ldmZobGh3cnJrYmhwcGdleWFqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTk0ODIwMiwiZXhwIjoyMDc3NTI0MjAyfQ.yfwGSE1BBT7LLlJrZRzdnLarXh-nE2BGvPX9SqfonYA"
PERIODO      = "2026-II"

DIAS  = {"LUN","MAR","MIE","JUE","VIE","SAB","DOM"}
TIPOS = {"CLASE","FINAL","PARCIAL","PRACTICA","PRÁCTICA","PRACCALIFI","PRACDIRIGI","LABORATORIO","TALLER"}

# ── HELPERS ──────────────────────────────────────────────────────────────────
def norm(s):
    import unicodedata
    s = str(s or "").strip()
    nfkd = unicodedata.normalize("NFD", s)
    return "".join(c for c in nfkd if unicodedata.category(c) != "Mn").upper().strip()

def normalize_tipo(t):
    t = norm(t)
    if t in ("PRACTICA","PRÁCTICA","PRACDIRIGI"): return "PRACTICA"
    if t == "PRACCALIFI": return "PRACCALIFI"
    return t

def fmt_time(v):
    """Convert openpyxl time value to HH:MM string."""
    if v is None: return None
    import datetime
    if isinstance(v, datetime.time):
        return v.strftime("%H:%M")
    if isinstance(v, datetime.datetime):
        return v.strftime("%H:%M")
    s = str(v).strip()
    m = re.search(r"(\d{1,2}):(\d{2})", s)
    if m:
        return f"{int(m.group(1)):02d}:{m.group(2)}"
    return None

def supabase_request(method, path, body=None):
    url  = f"{SUPABASE_URL}/rest/v1/{path}"
    data = json.dumps(body).encode() if body else None
    headers = {
        "apikey":        ANON_KEY,
        "Authorization": f"Bearer {ANON_KEY}",
        "Content-Type":  "application/json",
        "Prefer":        "resolution=merge-duplicates,return=minimal",
    }
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

# ── PARSE EXCEL ───────────────────────────────────────────────────────────────
print(f"Leyendo {EXCEL_PATH} ...")
wb = openpyxl.load_workbook(EXCEL_PATH, data_only=True)
ws = wb.active

# Read all rows as lists of cell values
all_rows = []
for row in ws.iter_rows(values_only=True):
    all_rows.append(list(row))

print(f"Total filas: {len(all_rows)}")
print(f"Primeras 5 filas:")
for i, r in enumerate(all_rows[:5]):
    print(f"  Row {i}: {r}")

# ── AUTO-DETECT COLUMNS ───────────────────────────────────────────────────────
col_secc = col_doc = col_tipo = col_dia = col_start = col_end = col_aula = -1

# Step 1: find header row (has "SECC" and "DIA")
for ri, row in enumerate(all_rows[:20]):
    normed = [norm(c) for c in row]
    i_secc = next((i for i,c in enumerate(normed) if c in ("SECC","SECCION")), -1)
    i_dia  = next((i for i,c in enumerate(normed) if c == "DIA"), -1)
    i_hora = next((i for i,c in enumerate(normed) if c == "HORARIO"), -1)
    i_aula = next((i for i,c in enumerate(normed) if c == "AULA"), -1)
    if i_secc >= 0 and i_dia >= 0:
        col_secc  = i_secc
        col_doc   = i_secc + 1
        col_dia   = i_dia
        col_start = i_hora if i_hora >= 0 else i_dia + 1
        col_end   = col_start + 1
        col_aula  = i_aula if i_aula >= 0 else i_dia + 4
        print(f"Header detectado en fila {ri}: secc={col_secc} doc={col_doc} dia={col_dia} start={col_start} end={col_end} aula={col_aula}")
        break

# Step 2: calibrate tipo column from data
for ri, row in enumerate(all_rows[:80]):
    vals = [str(v or "").strip() for v in row]
    tipo_i = next((i for i,c in enumerate(vals) if norm(c) in TIPOS and norm(c) != "PRACCALIFI"), -1)
    if tipo_i < 0: continue
    dia_i  = next((i for i,c in enumerate(vals) if norm(c) in DIAS), -1)
    if dia_i < 0: continue
    time_is = [i for i,c in enumerate(vals) if re.match(r"^\d{1,2}:\d{2}", str(c).strip())]
    if len(time_is) < 2: continue
    col_tipo  = tipo_i
    col_dia   = dia_i
    col_start = time_is[0]
    col_end   = time_is[1]
    # find aula after end time
    for ai in range(time_is[1]+1, len(vals)):
        c = vals[ai]
        if re.match(r"^[A-Z]-", c) or norm(c) in ("A-PEND","POR ASIGNAR","VIRTUAL"):
            col_aula = ai
            break
    if col_aula < 0:
        col_aula = time_is[1] + 2
    if col_secc < 0:
        col_secc = 0; col_doc = 1
    print(f"Calibrado en fila {ri}: tipo={col_tipo} dia={col_dia} start={col_start} end={col_end} aula={col_aula}")
    break

if col_tipo < 0:
    col_secc=0; col_doc=1; col_tipo=2; col_dia=4; col_start=5; col_end=6; col_aula=9
    print("⚠ Usando defaults!")

print(f"\nColumnas finales: secc={col_secc} doc={col_doc} tipo={col_tipo} dia={col_dia} start={col_start} end={col_end} aula={col_aula}\n")

# ── EXTRACT DATA ──────────────────────────────────────────────────────────────
COURSE_RE = re.compile(r"^([A-Z0-9]{4,8})\s*[-–]\s*(.+)", re.I)

ofertas   = []
seen_keys = set()

cur_codigo  = ""
cur_nombre  = ""
cur_creditos = 0
cur_seccion = ""
cur_profesor = ""

for ri, raw_row in enumerate(all_rows):
    row = [str(v or "").strip() for v in raw_row]
    if all(not c for c in row): continue

    # ── Course header: scan first 4 columns ──────────────────────────────────
    found_course = False
    for ci in range(min(4, len(row))):
        m = COURSE_RE.match(row[ci])
        if m and re.search(r"\d{3,}", m.group(1)):
            cur_codigo   = m.group(1).upper()
            cur_nombre   = re.sub(r"\s+PREREQUISITO[:\s].*", "", m.group(2), flags=re.I).strip()
            cur_seccion  = ""
            cur_profesor = ""
            cur_creditos = 0
            # look for credits (like "4.00") anywhere in row
            for v in row:
                cm = re.match(r"^(\d+[.,]\d+)$", v)
                if cm:
                    cur_creditos = float(cm.group(1).replace(",","."))
                    break
            found_course = True
            break
    if found_course: continue
    if not cur_codigo: continue

    cell0 = row[col_secc] if col_secc < len(row) else ""

    # Skip noise rows
    if re.match(r"^(CURSOS|SECC|DIA|HORARIO)", norm(cell0)): continue

    # Forward-fill section
    if cell0 and re.match(r"^[A-Z0-9]{1,3}$", cell0, re.I):
        nu = norm(cell0)
        if nu not in TIPOS and nu not in DIAS:
            cur_seccion = nu

    # Forward-fill teacher
    cell_doc = row[col_doc] if col_doc < len(row) else ""
    first_tok = norm(cell_doc.split()[0]) if cell_doc.split() else ""
    if cell_doc and first_tok not in TIPOS and first_tok not in DIAS and len(cell_doc) > 2:
        cur_profesor = cell_doc

    # Extract tipo
    tipo_raw = norm(row[col_tipo] if col_tipo < len(row) else "")
    if not tipo_raw or tipo_raw not in TIPOS or tipo_raw == "PRACCALIFI": continue
    tipo = normalize_tipo(tipo_raw)

    # Extract day
    dia = norm(row[col_dia] if col_dia < len(row) else "")
    if dia not in DIAS: continue

    # Extract times
    raw_start = raw_row[col_start] if col_start < len(raw_row) else None
    raw_end   = raw_row[col_end]   if col_end   < len(raw_row) else None
    start = fmt_time(raw_start) or (lambda s: re.search(r"\d{1,2}:\d{2}", s).group() if re.search(r"\d{1,2}:\d{2}", s) else None)(str(raw_start or ""))
    end   = fmt_time(raw_end)   or (lambda s: re.search(r"\d{1,2}:\d{2}", s).group() if re.search(r"\d{1,2}:\d{2}", s) else None)(str(raw_end or ""))
    if not start or not end: continue

    # Extract aula
    aula = (row[col_aula] if col_aula < len(row) else "").strip() or "POR ASIGNAR"

    # Deduplicate
    key = f"{cur_codigo}-{cur_seccion}-{tipo}-{dia}-{start}-{end}"
    if key in seen_keys: continue
    seen_keys.add(key)

    h1,m1 = map(int, start.split(":"))
    h2,m2 = map(int, end.split(":"))

    ofertas.append({
        "codigo_curso": cur_codigo,
        "nombre_curso": cur_nombre,
        "seccion":      cur_seccion or "?",
        "profesor":     cur_profesor or "Sin profesor",
        "creditos":     cur_creditos,
        "tipo":         tipo,
        "dia":          dia,
        "hora_inicio":  start,
        "hora_fin":     end,
        "duracion":     max(0, (h2*60+m2)-(h1*60+m1)),
        "aula":         aula,
    })

print(f"✅ Extraídos: {len(ofertas)} bloques de horario")
print(f"   Cursos únicos: {len(set(o['codigo_curso'] for o in ofertas))}")
print(f"   Secciones únicas: {len(set(o['codigo_curso']+'-'+o['seccion'] for o in ofertas))}")

if not ofertas:
    print("❌ No se encontraron bloques. Revisa el Excel.")
    sys.exit(1)

# Print sample
print("\nMuestra de primeras 5 filas:")
for o in ofertas[:5]:
    print(f"  {o['codigo_curso']} {o['seccion']} {o['tipo']} {o['dia']} {o['hora_inicio']}-{o['hora_fin']} {o['aula']} [{o['profesor'][:30]}]")

# ── BUILD DB ROWS ─────────────────────────────────────────────────────────────
courses_map  = {}
sections_map = {}
blocks_map   = {}

for o in ofertas:
    # Courses
    if o["codigo_curso"] not in courses_map:
        courses_map[o["codigo_curso"]] = {
            "id":      o["codigo_curso"],
            "name":    o["nombre_curso"],
            "credits": o["creditos"],
        }
    # Sections
    sec_id = f"{PERIODO}-{o['codigo_curso']}-{o['seccion']}"
    if sec_id not in sections_map:
        sections_map[sec_id] = {
            "id":        sec_id,
            "course_id": o["codigo_curso"],
            "letter":    o["seccion"],
            "teacher":   o["profesor"],
            "periodo":   PERIODO,
        }
    # Blocks
    blk_key = f"{sec_id}-{o['tipo']}-{o['dia']}-{o['hora_inicio']}-{o['hora_fin']}"
    if blk_key not in blocks_map:
        blocks_map[blk_key] = {
            "section_id": sec_id,
            "type":       o["tipo"],
            "day":        o["dia"],
            "start_time": o["hora_inicio"],
            "end_time":   o["hora_fin"],
            "classroom":  o["aula"],
        }

course_rows  = list(courses_map.values())
section_rows = list(sections_map.values())
block_rows   = list(blocks_map.values())

print(f"\n📦 Filas a insertar: {len(course_rows)} cursos | {len(section_rows)} secciones | {len(block_rows)} bloques")

# ── UPLOAD TO SUPABASE ────────────────────────────────────────────────────────
print("\n🔄 Subiendo a Supabase...")

# 1. Upsert courses
print(f"  ▸ Cursos ({len(course_rows)})...", end=" ")
status, resp = supabase_request("POST", "sche_courses?on_conflict=id", course_rows)
print(f"{'✅' if status in (200,201) else '❌'} {status}")
if status not in (200,201): print("  ERR:", resp[:300])

# 2. Delete existing sections for PERIODO (cascades to blocks)
print(f"  ▸ Limpiando periodo {PERIODO}...", end=" ")
status, resp = supabase_request("DELETE", f"sche_sections?periodo=eq.{PERIODO}")
print(f"{'✅' if status in (200,204) else '❌'} {status}")
if status not in (200,204): print("  ERR:", resp[:300])

# 3. Insert sections
print(f"  ▸ Secciones ({len(section_rows)})...", end=" ")
status, resp = supabase_request("POST", "sche_sections", section_rows)
print(f"{'✅' if status in (200,201) else '❌'} {status}")
if status not in (200,201): print("  ERR:", resp[:300])

# 4. Insert blocks (batched 500)
print(f"  ▸ Bloques ({len(block_rows)}) en batches de 500...")
BATCH = 500
errors = 0
for i in range(0, len(block_rows), BATCH):
    batch = block_rows[i:i+BATCH]
    status, resp = supabase_request("POST", "sche_schedule_blocks", batch)
    ok = status in (200,201)
    print(f"    Batch {i//BATCH+1} ({len(batch)} filas): {'✅' if ok else '❌'} {status}")
    if not ok:
        print("    ERR:", resp[:200])
        errors += 1

print("\n" + ("✅ COMPLETADO SIN ERRORES" if errors == 0 else f"⚠ COMPLETADO CON {errors} ERRORES EN BLOQUES"))
print(f"Periodo: {PERIODO} | Cursos: {len(course_rows)} | Secciones: {len(section_rows)} | Bloques: {len(block_rows)}")
