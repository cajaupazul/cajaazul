'use client';

import { useMemo, useState } from 'react';
import {
    BookOpenCheck,
    CheckSquare,
    ChevronRight,
    ClipboardCheck,
    FileArchive,
    Link2,
    NotebookTabs,
    Presentation,
    Search,
    Trash2,
    X,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileTypeIcon } from '@/components/files/FileTypeIcon';

type MaterialCategory = 'all' | 'evaluations' | 'classes' | 'notes' | 'syllabus' | 'links' | 'resources';

type SmartCourseMaterialsProps = {
    materials: any[];
    cycles: any[];
    professors: any[];
    selectedProfessorId: string;
    onProfessorChange: (id: string) => void;
    isSelectionMode: boolean;
    selectedMaterialIds: string[];
    onToggleSelect: (id: string) => void;
    onOpen: (material: any) => void;
    canDelete: (material: any) => boolean;
    onDelete: (material: any) => void;
};

const CATEGORY_OPTIONS: Array<{
    id: MaterialCategory;
    label: string;
    description: string;
    Icon: typeof FileArchive;
}> = [
    { id: 'all', label: 'Todo', description: 'Todos los recursos', Icon: FileArchive },
    { id: 'evaluations', label: 'Evaluaciones', description: 'PC, parciales y finales', Icon: ClipboardCheck },
    { id: 'classes', label: 'Clases', description: 'PPT y material docente', Icon: Presentation },
    { id: 'notes', label: 'Apuntes', description: 'Resúmenes y guías', Icon: NotebookTabs },
    { id: 'syllabus', label: 'Sílabos', description: 'Sílabos y cronogramas', Icon: BookOpenCheck },
    { id: 'links', label: 'Enlaces', description: 'Recursos externos', Icon: Link2 },
    { id: 'resources', label: 'Otros', description: 'Sin categoría específica', Icon: FileArchive },
];

function normalize(value?: string | null) {
    return (value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function materialCategory(material: any): Exclude<MaterialCategory, 'all'> {
    const explicitCategory = material.material_category;
    if (['evaluations', 'classes', 'notes', 'syllabus', 'resources'].includes(explicitCategory)) {
        return explicitCategory;
    }

    // Para materiales normales, `tipo` lo elige quien sube el recurso. No se
    // usan títulos, extensiones ni nombres de carpeta para suponer la categoría.
    const type = normalize(material.tipo);
    if (type === 'enlace') return 'links';
    if (type.includes('silabo') || type.includes('syllabus') || type.includes('cronograma')) return 'syllabus';
    if (type.includes('examen') || type.includes('evaluacion')) return 'evaluations';
    if (type.includes('presentacion') || type.includes('diapositiva') || type.includes('clase')) return 'classes';
    if (type.includes('otros recurso')) return 'resources';
    if (type.includes('apunte') || type.includes('resumen') || type.includes('guia')) return 'notes';
    return 'resources';
}

function formatDate(value?: string | null) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

export default function SmartCourseMaterials({
    materials,
    cycles,
    professors,
    selectedProfessorId,
    onProfessorChange,
    isSelectionMode,
    selectedMaterialIds,
    onToggleSelect,
    onOpen,
    canDelete,
    onDelete,
}: SmartCourseMaterialsProps) {
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState<MaterialCategory>('all');
    const [cycleId, setCycleId] = useState('all');

    const cycleNameById = useMemo(
        () => new Map(cycles.map((cycle) => [cycle.id, cycle.ciclo_name])),
        [cycles]
    );

    const professorFiltered = useMemo(() => {
        if (selectedProfessorId === 'all') return materials;
        if (selectedProfessorId === 'none') return materials.filter((item) => !item.professor_id);
        return materials.filter((item) => item.professor_id === selectedProfessorId || !item.professor_id);
    }, [materials, selectedProfessorId]);

    const cycleFiltered = useMemo(() => {
        if (cycleId === 'all') return professorFiltered;
        if (cycleId === 'historical') return professorFiltered.filter((item) => !item.cycle_id);
        return professorFiltered.filter((item) => item.cycle_id === cycleId);
    }, [professorFiltered, cycleId]);

    const counts = useMemo(() => {
        const result = new Map<MaterialCategory, number>([['all', cycleFiltered.length]]);
        cycleFiltered.forEach((item) => {
            const itemCategory = materialCategory(item);
            result.set(itemCategory, (result.get(itemCategory) || 0) + 1);
        });
        return result;
    }, [cycleFiltered]);

    const filtered = useMemo(() => {
        const normalizedQuery = normalize(query.trim());
        return cycleFiltered
            .filter((item) => category === 'all' || materialCategory(item) === category)
            .filter((item) => {
                if (!normalizedQuery) return true;
                const cycleName = item.cycle_id ? cycleNameById.get(item.cycle_id) : 'historico';
                return normalize([
                    item.titulo,
                    item.name,
                    item.tipo,
                    item.relative_path,
                    item.professors?.nombre,
                    item.profiles?.nombre,
                    cycleName,
                ].filter(Boolean).join(' ')).includes(normalizedQuery);
            })
            .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    }, [category, cycleFiltered, cycleNameById, query]);

    const resetFilters = () => {
        setQuery('');
        setCategory('all');
        setCycleId('all');
        onProfessorChange('all');
    };

    const hasFilters = Boolean(query) || category !== 'all' || cycleId !== 'all' || selectedProfessorId !== 'all';

    return (
        <div className="space-y-5">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
                <label className="relative block">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-bb-text-secondary" />
                    <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Buscar por archivo, profesor, ciclo o tipo..."
                        className="h-12 w-full rounded-xl border border-bb-border bg-bb-card pl-11 pr-10 text-sm font-medium text-bb-text outline-none transition-colors placeholder:text-bb-text-secondary focus:border-blue-500"
                    />
                    {query && (
                        <button
                            type="button"
                            onClick={() => setQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-bb-text-secondary hover:bg-bb-hover hover:text-bb-text"
                            aria-label="Limpiar búsqueda"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </label>

                <Select value={selectedProfessorId} onValueChange={onProfessorChange}>
                    <SelectTrigger className="h-12 rounded-xl border-bb-border bg-bb-card px-4 text-bb-text shadow-none">
                        <SelectValue placeholder="Todos los profesores" />
                    </SelectTrigger>
                    <SelectContent className="border-bb-border bg-bb-card text-bb-text">
                        <SelectItem value="all">Todos los profesores</SelectItem>
                        <SelectItem value="none">Material general</SelectItem>
                        {professors.map((professor) => (
                            <SelectItem key={professor.id} value={professor.id}>{professor.nombre}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={cycleId} onValueChange={setCycleId}>
                    <SelectTrigger className="h-12 rounded-xl border-bb-border bg-bb-card px-4 text-bb-text shadow-none">
                        <SelectValue placeholder="Todos los ciclos" />
                    </SelectTrigger>
                    <SelectContent className="border-bb-border bg-bb-card text-bb-text">
                        <SelectItem value="all">Todos los ciclos</SelectItem>
                        {cycles.map((cycle) => (
                            <SelectItem key={cycle.id} value={cycle.id}>Ciclo {cycle.ciclo_name}</SelectItem>
                        ))}
                        <SelectItem value="historical">Sin ciclo / histórico</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0 xl:grid-cols-6">
                {CATEGORY_OPTIONS.map(({ id, label, description, Icon }) => {
                    const active = category === id;
                    return (
                        <button
                            key={id}
                            type="button"
                            onClick={() => setCategory(id)}
                            className={`min-w-[142px] rounded-xl border p-3 text-left transition-colors sm:min-w-0 ${active
                                ? 'border-blue-500 bg-blue-600 text-white'
                                : 'border-bb-border bg-bb-card text-bb-text hover:border-blue-500/60 hover:bg-bb-hover'
                            }`}
                        >
                            <div className="flex items-center justify-between gap-3">
                                <Icon className={`h-4 w-4 ${active ? 'text-white' : 'text-blue-400'}`} strokeWidth={2} />
                                <span className={`text-xs font-black ${active ? 'text-white' : 'text-bb-text-secondary'}`}>
                                    {counts.get(id) || 0}
                                </span>
                            </div>
                            <p className="mt-3 text-xs font-black">{label}</p>
                            <p className={`mt-0.5 line-clamp-1 text-[10px] ${active ? 'text-blue-100' : 'text-bb-text-secondary'}`}>{description}</p>
                        </button>
                    );
                })}
            </div>

            <div className="flex items-center justify-between gap-3 border-b border-bb-border pb-3">
                <div>
                    <p className="text-sm font-black text-bb-text">
                        {CATEGORY_OPTIONS.find((option) => option.id === category)?.label || 'Materiales'}
                    </p>
                    <p className="mt-0.5 text-[11px] text-bb-text-secondary">
                        {filtered.length} {filtered.length === 1 ? 'recurso encontrado' : 'recursos encontrados'}
                    </p>
                </div>
                {hasFilters && (
                    <button
                        type="button"
                        onClick={resetFilters}
                        className="rounded-lg border border-bb-border px-3 py-2 text-[11px] font-bold text-bb-text-secondary transition-colors hover:bg-bb-card hover:text-bb-text"
                    >
                        Limpiar filtros
                    </button>
                )}
            </div>

            {filtered.length > 0 ? (
                <div className="divide-y divide-bb-border overflow-hidden rounded-xl border border-bb-border bg-bb-card">
                    {filtered.map((material) => {
                        const isBlackboard = material.source === 'blackboard';
                        const title = material.titulo || material.name || 'Material sin título';
                        const cycleName = material.cycle_id ? cycleNameById.get(material.cycle_id) : null;
                        const selected = selectedMaterialIds.includes(material.id);
                        const categoryLabel = CATEGORY_OPTIONS.find((option) => option.id === materialCategory(material))?.label;

                        return (
                            <div key={material.id} className="group flex min-w-0 items-center gap-3 px-3 py-3 transition-colors hover:bg-bb-hover sm:px-4">
                                {isSelectionMode && !isBlackboard && (
                                    <button
                                        type="button"
                                        onClick={() => onToggleSelect(material.id)}
                                        className={`shrink-0 rounded-md p-1 ${selected ? 'text-blue-500' : 'text-bb-text-secondary hover:text-bb-text'}`}
                                        aria-label={selected ? 'Quitar de la selección' : 'Seleccionar archivo'}
                                    >
                                        <CheckSquare className="h-4 w-4" fill={selected ? 'currentColor' : 'none'} />
                                    </button>
                                )}

                                <button type="button" onClick={() => onOpen(material)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                                    <FileTypeIcon fileName={title} mimeType={material.mime_type} size="md" />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-bold text-bb-text transition-colors group-hover:text-blue-400">{title}</span>
                                        <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-bb-text-secondary">
                                            <span className="font-bold text-blue-400">{categoryLabel || 'Recurso'}</span>
                                            {material.professors?.nombre && <span className="max-w-[220px] truncate">{material.professors.nombre}</span>}
                                            <span>{cycleName ? `Ciclo ${cycleName}` : 'Sin ciclo'}</span>
                                            {isBlackboard && <span className="rounded bg-violet-500/10 px-1.5 py-0.5 font-bold text-violet-400">Importado</span>}
                                            {formatDate(material.created_at) && <span className="hidden md:inline">{formatDate(material.created_at)}</span>}
                                        </span>
                                    </span>
                                    <ChevronRight className="h-4 w-4 shrink-0 text-bb-text-secondary transition-transform group-hover:translate-x-0.5 group-hover:text-blue-400" />
                                </button>

                                {canDelete(material) && (
                                    <button
                                        type="button"
                                        onClick={() => onDelete(material)}
                                        className="shrink-0 rounded-lg p-2 text-red-400 opacity-100 transition-colors hover:bg-red-500/10 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                                        aria-label={`Eliminar ${title}`}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="rounded-xl border border-dashed border-bb-border bg-bb-card px-6 py-14 text-center">
                    <Search className="mx-auto h-7 w-7 text-bb-text-secondary" />
                    <p className="mt-3 text-sm font-black text-bb-text">No encontramos materiales con esos filtros</p>
                    <p className="mt-1 text-xs text-bb-text-secondary">Prueba otro término o vuelve a mostrar todos los recursos.</p>
                    {hasFilters && (
                        <button type="button" onClick={resetFilters} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700">
                            Ver todos
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
