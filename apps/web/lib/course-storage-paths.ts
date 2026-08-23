const MAX_SEGMENT_LENGTH = 120;

function normalizeSegment(value: string, fallback: string): string {
    const normalized = value
        .normalize('NFKC')
        .replace(/[\\/\u0000-\u001f\u007f]/g, '-')
        .replace(/^\.+$/, '')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\s/g, '-')
        .replace(/-+/g, '-')
        .slice(0, MAX_SEGMENT_LENGTH);

    return normalized || fallback;
}

export function sanitizeRelativePath(relativePath: string): string {
    return relativePath
        .replace(/\\/g, '/')
        .split('/')
        .filter((segment) => segment && segment !== '.' && segment !== '..')
        .map((segment, index) => normalizeSegment(segment, `elemento-${index + 1}`))
        .join('/');
}

export function buildCourseMaterialPath({
    courseId,
    cycleId,
    section,
    fileName,
}: {
    courseId: string;
    cycleId: string | null;
    section: string;
    fileName: string;
}): string {
    const safeFileName = normalizeSegment(fileName, 'archivo');
    const safeSection = normalizeSegment(section, 'general');
    const cycleSegment = cycleId ? normalizeSegment(cycleId, 'historical') : 'historical';

    return [
        'courses',
        normalizeSegment(courseId, 'unknown-course'),
        'cycles',
        cycleSegment,
        'materials',
        safeSection,
        `${crypto.randomUUID()}-${safeFileName}`,
    ].join('/');
}

export function buildBlackboardStoragePath({
    courseId,
    cycleId,
    professorId,
    setId,
    relativePath,
}: {
    courseId: string;
    cycleId: string | null;
    professorId: string;
    setId: string;
    relativePath: string;
}): string {
    const cycleSegment = cycleId ? normalizeSegment(cycleId, 'historical') : 'historical';
    const safeRelativePath = sanitizeRelativePath(relativePath);

    return [
        'courses',
        normalizeSegment(courseId, 'unknown-course'),
        'cycles',
        cycleSegment,
        'professors',
        normalizeSegment(professorId, 'unknown-professor'),
        'blackboard',
        normalizeSegment(setId, 'unknown-import'),
        safeRelativePath,
    ].join('/');
}

