import {
    Archive,
    File,
    FileCode2,
    FileImage,
    FileSpreadsheet,
    FileText,
    Film,
    Link2,
    Music2,
    Presentation,
} from 'lucide-react';

type FileKind = {
    label: string;
    className: string;
    Icon: typeof File;
};

function getExtension(name?: string) {
    return name?.split('.').pop()?.toLowerCase() || '';
}

function resolveFileKind(name?: string, mimeType?: string | null): FileKind {
    const extension = getExtension(name);
    const mime = mimeType?.toLowerCase() || '';

    if (mime === 'application/pdf' || extension === 'pdf') {
        return { label: 'PDF', className: 'bg-red-500/10 text-red-400 border-red-500/25', Icon: FileText };
    }
    if (mime.includes('word') || ['doc', 'docx'].includes(extension)) {
        return { label: 'W', className: 'bg-blue-500/10 text-blue-400 border-blue-500/25', Icon: FileText };
    }
    if (mime.includes('presentation') || mime.includes('powerpoint') || ['ppt', 'pptx'].includes(extension)) {
        return { label: 'P', className: 'bg-orange-500/10 text-orange-400 border-orange-500/25', Icon: Presentation };
    }
    if (mime.includes('spreadsheet') || mime.includes('excel') || ['xls', 'xlsx', 'csv'].includes(extension)) {
        return { label: 'X', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25', Icon: FileSpreadsheet };
    }
    if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(extension)) {
        return { label: 'IMG', className: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/25', Icon: FileImage };
    }
    if (mime.startsWith('video/') || ['mp4', 'webm', 'mov', 'mkv'].includes(extension)) {
        return { label: 'VID', className: 'bg-purple-500/10 text-purple-400 border-purple-500/25', Icon: Film };
    }
    if (mime.startsWith('audio/') || ['mp3', 'wav', 'm4a', 'ogg'].includes(extension)) {
        return { label: 'AUD', className: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25', Icon: Music2 };
    }
    if (mime.includes('zip') || ['zip', 'rar', '7z'].includes(extension)) {
        return { label: 'ZIP', className: 'bg-amber-500/10 text-amber-400 border-amber-500/25', Icon: Archive };
    }
    if (mime === 'text/uri-list' || extension === 'url') {
        return { label: 'URL', className: 'bg-sky-500/10 text-sky-400 border-sky-500/25', Icon: Link2 };
    }
    if (mime.includes('json') || mime.includes('javascript') || ['js', 'ts', 'tsx', 'html', 'css', 'json'].includes(extension)) {
        return { label: 'CODE', className: 'bg-slate-500/10 text-slate-300 border-slate-500/25', Icon: FileCode2 };
    }

    return {
        label: extension ? extension.slice(0, 4).toUpperCase() : 'FILE',
        className: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
        Icon: File,
    };
}

export function FileTypeIcon({
    fileName,
    mimeType,
    size = 'md',
}: {
    fileName?: string;
    mimeType?: string | null;
    size?: 'sm' | 'md' | 'lg';
}) {
    const kind = resolveFileKind(fileName, mimeType);
    const Icon = kind.Icon;
    const dimensions = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-12 w-12' : 'h-10 w-10';
    const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';

    return (
        <span
            className={`${dimensions} ${kind.className} relative inline-flex shrink-0 items-center justify-center rounded-lg border`}
            aria-hidden="true"
        >
            <Icon className={iconSize} strokeWidth={1.9} />
            <span className="absolute -bottom-1 rounded-sm bg-bb-dark px-1 text-[7px] font-black tracking-wide text-current ring-1 ring-bb-border">
                {kind.label}
            </span>
        </span>
    );
}
