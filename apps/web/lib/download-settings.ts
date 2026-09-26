export const DOWNLOAD_SETTING_KEYS = [
  'pdf_downloads_enabled',
  'excel_downloads_enabled',
  'powerpoint_downloads_enabled',
  'word_downloads_enabled',
  'image_downloads_enabled',
  'archive_downloads_enabled',
  'other_downloads_enabled',
] as const;

export type DownloadSettingKey = typeof DOWNLOAD_SETTING_KEYS[number];

export type DownloadSettings = Record<DownloadSettingKey, boolean>;

export type PlatformDownloadSettings = DownloadSettings & {
  updated_at: string;
  updated_by: string | null;
};

export const DOWNLOAD_SETTINGS_SELECT = 'pdf_downloads_enabled, excel_downloads_enabled, powerpoint_downloads_enabled, word_downloads_enabled, image_downloads_enabled, archive_downloads_enabled, other_downloads_enabled, updated_at, updated_by' as const;

export const CLOSED_DOWNLOAD_SETTINGS: DownloadSettings = {
  pdf_downloads_enabled: false,
  excel_downloads_enabled: false,
  powerpoint_downloads_enabled: false,
  word_downloads_enabled: false,
  image_downloads_enabled: false,
  archive_downloads_enabled: false,
  other_downloads_enabled: false,
};

const EXTENSION_GROUPS: ReadonlyArray<{
  key: DownloadSettingKey;
  extensions: ReadonlySet<string>;
}> = [
  { key: 'pdf_downloads_enabled', extensions: new Set(['pdf']) },
  {
    key: 'excel_downloads_enabled',
    extensions: new Set(['xls', 'xlsx', 'xlsm', 'xlsb', 'xlt', 'xltx', 'xltm', 'csv', 'ods']),
  },
  {
    key: 'powerpoint_downloads_enabled',
    extensions: new Set(['ppt', 'pptx', 'pptm', 'pps', 'ppsx', 'ppsm', 'pot', 'potx', 'potm', 'odp']),
  },
  {
    key: 'word_downloads_enabled',
    extensions: new Set(['doc', 'docx', 'docm', 'dot', 'dotx', 'dotm', 'odt', 'rtf', 'txt']),
  },
  {
    key: 'image_downloads_enabled',
    extensions: new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg', 'tif', 'tiff', 'heic', 'heif', 'avif']),
  },
  {
    key: 'archive_downloads_enabled',
    extensions: new Set(['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz']),
  },
];

function extensionFromValue(value: string | null | undefined): string {
  if (!value) return '';
  let candidate = value.trim();

  try {
    const parsed = new URL(candidate, 'https://local.invalid');
    candidate = parsed.searchParams.get('path') || parsed.pathname || candidate;
  } catch {
    candidate = candidate.split(/[?#]/, 1)[0];
  }

  try {
    candidate = decodeURIComponent(candidate);
  } catch {
    // Keep the original value when it contains malformed percent encoding.
  }

  const fileName = candidate.replace(/\\/g, '/').split('/').pop() || '';
  const match = fileName.toLowerCase().match(/\.([a-z0-9]{1,10})$/);
  return match?.[1] || '';
}

export function downloadSettingForFile(
  filePath: string | null | undefined,
  fileName?: string | null,
): DownloadSettingKey {
  const extension = extensionFromValue(filePath) || extensionFromValue(fileName);
  return EXTENSION_GROUPS.find(group => group.extensions.has(extension))?.key
    || 'other_downloads_enabled';
}

export function downloadFamilyLabel(key: DownloadSettingKey): string {
  const labels: Record<DownloadSettingKey, string> = {
    pdf_downloads_enabled: 'PDF',
    excel_downloads_enabled: 'Excel y hojas de cálculo',
    powerpoint_downloads_enabled: 'PowerPoint y presentaciones',
    word_downloads_enabled: 'Word y documentos',
    image_downloads_enabled: 'imágenes',
    archive_downloads_enabled: 'archivos comprimidos',
    other_downloads_enabled: 'otros archivos',
  };
  return labels[key];
}
