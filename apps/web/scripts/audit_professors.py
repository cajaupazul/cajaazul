import json
import re

with open('C:/Users/huama/.gemini/antigravity/brain/39f2b139-4ace-4a87-bd39-b1176155fd28/.system_generated/steps/2578/output.txt', 'r', encoding='utf-8') as f:
    raw = f.read()

# regex to find id, nombre, especialidad
pattern = r'{"id":"([^"]+)","nombre":"([^"]+)","especialidad":"([^"]+)"'
# taking into account some names might have backslashes \"
pattern = r'{"id":"([0-9a-f-]+)","nombre":"(.*?)(?<!\\)","especialidad":"(.*?)(?<!\\)"'
matches = re.findall(pattern, raw)

profs = []
for m in matches:
    profs.append({
        'id': m[0],
        'nombre': m[1].replace('\\"', ''),
        'especialidad': m[2]
    })

def get_words(name):
    # Remove accents, punctuation, etc.
    name = re.sub(r'[".,-]', ' ', name.lower())
    words = [w for w in name.split() if len(w) > 2 and w not in ['del', 'las', 'los', 'san', 'de']]
    return set(words)

duplicates = []
processed = set()

for i, p1 in enumerate(profs):
    if p1['id'] in processed: continue
    
    words1 = get_words(p1['nombre'])
    matches = [p1]

    for j, p2 in enumerate(profs[i+1:]):
        if p2['id'] in processed: continue
        
        words2 = get_words(p2['nombre'])
        intersect = words1.intersection(words2)
        
        if len(intersect) >= 2 and len(intersect) == len(words1) and len(intersect) == len(words2):
            matches.append(p2)
        elif len(intersect) >= 3 and (len(intersect) / len(words1.union(words2))) >= 0.75:
            matches.append(p2)
        elif len(intersect) == 3 and len(words1) == 3 and len(words2) == 3:
            matches.append(p2)

    if len(matches) > 1:
        duplicates.append(matches)
        for m in matches:
            processed.add(m['id'])

print(f"Found {len(duplicates)} potential duplicate groups.")
for i, group in enumerate(duplicates):
    print(f"\nGroup {i+1}:")
    for p in group:
        print(f"  - {p['nombre']} (ID: {p['id']}) [Esp: {p['especialidad']}]")
