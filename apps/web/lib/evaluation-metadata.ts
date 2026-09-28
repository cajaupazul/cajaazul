export type EvaluationScope = 'cycle' | 'course_bank';

export type EvaluationType =
    | 'pc1'
    | 'pc2'
    | 'pc3'
    | 'pc4'
    | 'pc5'
    | 'midterm'
    | 'final'
    | 'makeup'
    | 'other';

export const EVALUATION_TYPE_OPTIONS: Array<{
    value: EvaluationType;
    label: string;
    materialType: string;
}> = [
    { value: 'pc1', label: 'PC 1', materialType: 'PC 1' },
    { value: 'pc2', label: 'PC 2', materialType: 'PC 2' },
    { value: 'pc3', label: 'PC 3', materialType: 'PC 3' },
    { value: 'pc4', label: 'PC 4', materialType: 'PC 4' },
    { value: 'pc5', label: 'PC 5', materialType: 'PC 5' },
    { value: 'midterm', label: 'Examen parcial', materialType: 'Examen Parcial' },
    { value: 'final', label: 'Examen final', materialType: 'Examen Final' },
    { value: 'makeup', label: 'Examen sustitutorio', materialType: 'Examen Sustitutorio' },
    { value: 'other', label: 'Otra evaluación', materialType: '📝 Exámenes' },
];

const optionByType = new Map(EVALUATION_TYPE_OPTIONS.map((option) => [option.value, option]));

function normalizedTerm(value: string) {
    const term = value.toUpperCase();
    if (term === '0') return '0';
    if (term === 'I' || term === '1') return '1';
    if (term === 'II' || term === '2') return '2';
    return null;
}

/**
 * Finds an academic period anywhere in a filename or folder path.
 * Accepted examples: 2019-I, PC1_2019_1, 2021-0, 2019 II and I-2019.
 */
export function extractAcademicPeriod(value?: string | null): string | null {
    if (!value) return null;
    const text = value.normalize('NFKC');
    const separators = String.raw`[\s._\-/]*`;
    const yearFirst = new RegExp(String.raw`(?:^|[^0-9A-Za-z])((?:19|20)\d{2})${separators}(II|I|[012])(?=$|[^0-9A-Za-z])`, 'i');
    const termFirst = new RegExp(String.raw`(?:^|[^0-9A-Za-z])(II|I|[012])${separators}((?:19|20)\d{2})(?=$|[^0-9A-Za-z])`, 'i');

    const direct = text.match(yearFirst);
    if (direct) {
        const term = normalizedTerm(direct[2]);
        return term ? `${direct[1]}-${term}` : null;
    }

    const reverse = text.match(termFirst);
    if (reverse) {
        const term = normalizedTerm(reverse[1]);
        return term ? `${reverse[2]}-${term}` : null;
    }

    return null;
}

export function normalizeAcademicPeriod(value?: string | null): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    const exact = trimmed.match(/^((?:19|20)\d{2})\s*[-._/]?\s*(II|I|[012])$/i);
    if (!exact) return null;
    const term = normalizedTerm(exact[2]);
    return term ? `${exact[1]}-${term}` : null;
}

export function formatAcademicPeriod(value?: string | null) {
    const normalized = normalizeAcademicPeriod(value);
    if (!normalized) return value || '';
    const [year, term] = normalized.split('-');
    return `${year}-${term === '0' ? '0' : term === '1' ? 'I' : 'II'}`;
}

export function evaluationTypeLabel(value?: string | null) {
    return optionByType.get(value as EvaluationType)?.label || 'Evaluaciones';
}

export function isEvaluationMaterialType(value?: string | null) {
    const normalized = (value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    return normalized.includes('examen')
        || normalized.includes('evaluacion')
        || normalized.includes('parcial')
        || normalized.includes('final')
        || normalized.includes('sustitutorio')
        || /^pc\s*[1-5]$/.test(normalized);
}
