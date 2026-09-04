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
    PencilLine,
    Search,
    Trash2,
    X,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileTypeIcon } from '@/components/files/FileTypeIcon';
import { UserHoverCard } from '@/components/ui/UserHoverCard';

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
    isAdmin?: boolean;
    onReclassify?: (material: any, value: string, cycleId?: string) => Promise<void>;
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

const BLACKBOARD_CATEGORY_OPTIONS = CATEGORY_OPTIONS
    .filter((option) => ['evaluations', 'classes', 'notes', 'syllabus', 'resources'].includes(option.id))
    .map(({ id, label }) => ({ value: id, label }));

const NORMAL_LOCATION_OPTIONS = [
    { value: 'PC 1', label: 'PC 1' },
    { value: 'PC 2', label: 'PC 2' },
    { value: 'PC 3', label: 'PC 3' },
    { value: 'PC 4', label: 'PC 4' },
    { value: 'PC 5', label: 'PC 5' },
    { value: 'Examen Parcial', label: 'Examen parcial' },
    { value: 'Examen Final', label: 'Examen final' },
    { value: 'Examen Sustitutorio', label: 'Examen sustitutorio' },
    { value: '📝 Exámenes', label: 'Evaluaciones (general)' },
    { value: '📊 Presentaciones y Diapositivas', label: 'Clases y diapositivas' },
    { value: '📚 Apuntes y Recursos', label: 'Apuntes (compartidos)' },
    { value: '📖 Sílabo y Cronograma', label: 'Sílabo y cronograma' },
    { value: '🔗 Enlaces Útiles', label: 'Enlaces útiles (compartidos)' },
    { value: '📦 Otros Recursos', label: 'Otros recursos (compartidos)' },
];

const SHARED_LOCATIONS = new Set(['📚 Apuntes y Recursos', '🔗 Enlaces Útiles', '📦 Otros Recursos']);
const isSharedLocation = (value?: string | null) => !!value && SHARED_LOCATIONS.has(value);

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
    if (type.includes('examen') || type.includes('evaluacion') || /^pc\s*\d+$/.test(type)) return 'evaluations';
    if (type.includes('presentacion') || type.includes('diapositiva') || type.includes('clase')) return 'classes';
    if (type.includes('otros recurso')) return 'notes';
    if (type.includes('apunte') || type.includes('resumen') || type.includes('guia')) return 'notes';
    return 'resources';
}

function formatDate(value?: string | null) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function cycleSortKey(cycleName?: string | null) {
    const match = (cycleName || '').match(/(\d{4})\D+(\d+)/);
    if (!match) return -1;
    return Number(match[1]) * 10 + Number(match[2]);
}

function evaluationSortKey(material: any) {
    const type = normalize(material.tipo);
    const pc = type.match(/^pc\s*([1-5])$/);
    if (pc) return Number(pc[1]);
    if (type.includes('parcial')) return 20;
    if (type.includes('final')) return 30;
    if (type.includes('sustitutorio')) return 40;
    return 15;
}

function materialSortKey(material: any) {
    const category = materialCategory(material);
    const categoryOrder: Record<Exclude<MaterialCategory, 'all'>, number> = {
        syllabus: 0,
        classes: 1,
        notes: 2,
        evaluations: 3,
        links: 4,
        resources: 5,
    };

    return {
        category: categoryOrder[category],
        evaluation: category === 'evaluations' ? evaluationSortKey(material) : 0,
        date: new Date(material.created_at || 0).getTime(),
    };
}

function uploaderName(material: any) {
    const profile = material.profiles;
    return profile?.nombre || profile?.apodo || profile?.username || profile?.display_name || 'Comunidad CampusLink';
}

function fileNameForIcon(material: any, title: string) {
    return material.relative_path || material.storage_path || material.url_archivo || material.name || title;
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
    isAdmin = false,
    onReclassify,
}: SmartCourseMaterialsProps) {
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState<MaterialCategory>('all');
    const [cycleId, setCycleId] = useState('all');
    const [organizeMode, setOrganizeMode] = useState(false);
    const [savingMaterialId, setSavingMaterialId] = useState<string | null>(null);
    const [organizeCycleByMaterial, setOrganizeCycleByMaterial] = useState<Record<string, string>>({});

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
        if (cycleId === 'shared') return professorFiltered.filter((item) => !item.cycle_id && ['notes', 'links', 'resources'].includes(materialCategory(item)));
        if (cycleId === 'historical') return professorFiltered.filter((item) => !item.cycle_id && !['notes', 'links', 'resources'].includes(materialCategory(item)));
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
            .sort((a, b) => {
                const aKey = materialSortKey(a);
                const bKey = materialSortKey(b);
                if (aKey.category !== bKey.category) return aKey.category - bKey.category;
                if (aKey.evaluation !== bKey.evaluation) return aKey.evaluation - bKey.evaluation;
                return bKey.date - aKey.date;
            });
    }, [category, cycleFiltered, cycleNameById, query]);

    const groupedMaterials = useMemo(() => {
        const groups = new Map<string, { id: string; name: string; materials: any[]; sortKey: number }>();

        filtered.forEach((material) => {
            const category = materialCategory(material);
            const shared = !material.cycle_id && ['notes', 'links', 'resources'].includes(category);
            const id = shared ? 'shared' : (material.cycle_id || 'historical');
            const cycleName = material.cycle_id ? cycleNameById.get(material.cycle_id) : null;
            const existing = groups.get(id);
            if (existing) {
                existing.materials.push(material);
                return;
            }
            groups.set(id, {
                id,
                name: shared ? 'Material compartido del curso' : (cycleName ? `Ciclo ${cycleName}` : 'Archivo histórico'),
                materials: [material],
                sortKey: shared ? 0 : (cycleName ? cycleSortKey(cycleName) : -1),
            });
        });

        return Array.from(groups.values()).sort((a, b) => b.sortKey - a.sortKey);
    }, [cycleNameById, filtered]);

    const resetFilters = () => {
        setQuery('');
        setCategory('all');
        setCycleId('all');
        onProfessorChange('all');
    };

    const hasFilters = Boolean(query) || category !== 'all' || cycleId !== 'all' || selectedProfessorId !== 'all';

    const handleReclassify = async (material: any, value: string, destinationCycleId?: string) => {
        if (!onReclassify) return;
        setSavingMaterialId(material.id);
        try {
            await onReclassify(material, value, destinationCycleId);
        } finally {
            setSavingMaterialId(null);
        }
    };

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
                        <SelectItem value="shared">Material compartido</SelectItem>
                        <SelectItem value="historical">Archivo histórico / sin clasificar</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                    type="button"
                    onClick={() => setCategory('all')}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-black transition-colors ${category === 'all' ? 'bg-blue-600 text-white' : 'border border-bb-border bg-bb-card text-bb-text-secondary hover:text-bb-text'}`}
                >
                    Todos <span className={category === 'all' ? 'text-blue-100' : 'text-bb-text-secondary'}>{counts.get('all') || 0}</span>
                </button>
                {isAdmin && onReclassify && (
                    <button
                        type="button"
                        onClick={() => setOrganizeMode((current) => !current)}
                        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${organizeMode ? 'border-blue-500 bg-blue-600 text-white' : 'border-bb-border bg-bb-card text-bb-text-secondary hover:border-blue-500/60 hover:text-bb-text'}`}
                    >
                        <PencilLine className="h-3.5 w-3.5" />
                        {organizeMode ? 'Terminar organización' : 'Organizar archivos'}
                    </button>
                )}
            </div>

            {organizeMode && (
                <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-xs text-bb-text-secondary">
                    <span className="font-black text-blue-400">Modo de organización.</span> Elige la ubicación exacta de cada archivo. Las PC conservan su número; las carpetas Blackboard mantienen su estructura y reciben una categoría manual.
                </div>
            )}

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {CATEGORY_OPTIONS.filter(({ id }) => id !== 'all').map(({ id, label, description, Icon }) => {
                    const active = category === id;
                    return (
                        <button
                            key={id}
                            type="button"
                            onClick={() => setCategory(id)}
                            className={`min-w-0 rounded-xl border p-3 text-left transition-colors ${active
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
                            <p className={`mt-0.5 truncate text-[10px] ${active ? 'text-blue-100' : 'text-bb-text-secondary'}`}>{description}</p>
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
                <div className="space-y-5">
                    {groupedMaterials.map((group) => (
                        <section key={group.id} className="overflow-hidden rounded-xl border border-bb-border bg-bb-card">
                            <header className="flex items-center justify-between gap-3 border-b border-bb-border bg-bb-dark/40 px-4 py-3">
                                <div className="min-w-0 border-l-2 border-blue-500 pl-3">
                                    <h3 className="truncate text-sm font-black text-bb-text">{group.name}</h3>
                                    <p className="mt-0.5 text-[11px] text-bb-text-secondary">
                                        {group.materials.length} {group.materials.length === 1 ? 'recurso' : 'recursos'} · orden académico
                                    </p>
                                </div>
                                <span className="shrink-0 rounded-md border border-bb-border px-2 py-1 text-[10px] font-bold text-bb-text-secondary">
                                    {group.id === 'shared' ? 'Todo el curso' : group.id === 'historical' ? 'Sin clasificar' : 'Periodo académico'}
                                </span>
                            </header>
                            <div className="divide-y divide-bb-border">
                    {group.materials.map((material) => {
                        const isBlackboard = material.source === 'blackboard';
                        const title = material.titulo || material.name || 'Material sin título';
                        const selected = selectedMaterialIds.includes(material.id);
                        const categoryLabel = CATEGORY_OPTIONS.find((option) => option.id === materialCategory(material))?.label;
                        const uploader = uploaderName(material);

                        return (
                            <div key={material.id} className={`group flex min-w-0 gap-3 px-3 py-3 transition-colors hover:bg-bb-hover sm:px-4 ${organizeMode ? 'flex-wrap' : 'items-center'}`}>
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
                                    <FileTypeIcon fileName={fileNameForIcon(material, title)} mimeType={material.mime_type} size="md" />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-bold text-bb-text transition-colors group-hover:text-blue-400">{title}</span>
                                        <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-bb-text-secondary">
                                            <span className="font-bold text-blue-400">{categoryLabel || 'Recurso'}</span>
                                            {material.professors?.nombre && <span className="max-w-[220px] truncate">{material.professors.nombre}</span>}
                                            <UserHoverCard profile={material.profiles || {
                                                id: material.user_id || material.uploaded_by,
                                                nombre: uploader,
                                                role: 'user',
                                            }}>
                                                <span className="max-w-[220px] cursor-pointer truncate font-medium text-bb-text-secondary transition-colors hover:text-blue-400">
                                                    Aportó: {uploader}
                                                </span>
                                            </UserHoverCard>
                                            {isBlackboard && <span className="rounded bg-violet-500/10 px-1.5 py-0.5 font-bold text-violet-400">Importado</span>}
                                            {formatDate(material.created_at) && <span className="hidden md:inline">{formatDate(material.created_at)}</span>}
                                        </span>
                                    </span>
                                    <ChevronRight className="h-4 w-4 shrink-0 text-bb-text-secondary transition-transform group-hover:translate-x-0.5 group-hover:text-blue-400" />
                                </button>

                                {isAdmin && organizeMode && onReclassify && (
                                    <div className="grid w-full shrink-0 gap-2 sm:ml-auto sm:w-[430px] sm:grid-cols-2">
                                        <Select
                                            value={isBlackboard ? material.material_category || 'resources' : material.tipo || '📦 Otros Recursos'}
                                            onValueChange={(value) => {
                                                if (isBlackboard || isSharedLocation(value)) {
                                                    void handleReclassify(material, value);
                                                    return;
                                                }
                                                const destination = material.cycle_id || cycles[0]?.id;
                                                setOrganizeCycleByMaterial((current) => ({ ...current, [material.id]: destination || '' }));
                                                void handleReclassify(material, value, destination);
                                            }}
                                            disabled={savingMaterialId === material.id}
                                        >
                                            <SelectTrigger className="h-9 border-bb-border bg-bb-dark text-xs font-bold text-bb-text shadow-none">
                                                <SelectValue placeholder="Elegir ubicación" />
                                            </SelectTrigger>
                                            <SelectContent className="border-bb-border bg-bb-card text-bb-text">
                                                {(isBlackboard ? BLACKBOARD_CATEGORY_OPTIONS : NORMAL_LOCATION_OPTIONS).map((option) => (
                                                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {!isBlackboard && !isSharedLocation(material.tipo) && (
                                            <Select
                                                value={organizeCycleByMaterial[material.id] || material.cycle_id || ''}
                                                onValueChange={(value) => {
                                                    setOrganizeCycleByMaterial((current) => ({ ...current, [material.id]: value }));
                                                    void handleReclassify(material, material.tipo, value);
                                                }}
                                                disabled={savingMaterialId === material.id}
                                            >
                                                <SelectTrigger className="h-9 border-bb-border bg-bb-dark text-xs font-bold text-bb-text shadow-none"><SelectValue placeholder="Ciclo de destino" /></SelectTrigger>
                                                <SelectContent className="border-bb-border bg-bb-card text-bb-text">
                                                    {cycles.map((cycle) => <SelectItem key={cycle.id} value={cycle.id}>Ciclo {cycle.ciclo_name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    </div>
                                )}

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
                        </section>
                    ))}
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
