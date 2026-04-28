/**
 * Helpers for manual image generation manifests.
 */

export type ImageEntityType = 'ingredient' | 'recipe' | 'kitchen_tool';

export interface ImageManifestItem {
  entityType: ImageEntityType;
  id: string;
  nameEn: string;
  nameEs: string;
  displayName: string;
  storageBucket: string;
  imagePath: string;
  suggestedFileName: string;
  manualPromptHint: string;
}

const PROMPT_HINTS: Record<ImageEntityType, string> = {
  ingredient:
    'Studio food product shot on white background. Ingredient only, no extra objects, high detail.',
  recipe:
    'Overhead plated dish photo, warm natural light, appetizing, realistic food photography style.',
  kitchen_tool:
    'Clean product photo of a kitchen tool on white background, isolated object, no clutter.',
};

export function getImageBucket(entityType: ImageEntityType): string {
  if (entityType === 'ingredient') return 'ingredients';
  if (entityType === 'recipe') return 'recipes';
  return 'kitchen-tools';
}

export function normalizeFileName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function escapeCsv(value: string): string {
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

function escapeMarkdown(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

export function createImageManifestItem(
  entityType: ImageEntityType,
  id: string,
  nameEn: string,
  nameEs: string,
): ImageManifestItem {
  const resolvedNameEn = (nameEn || '').trim();
  const resolvedNameEs = (nameEs || '').trim();
  const displayName = resolvedNameEn && resolvedNameEs
    ? `${resolvedNameEn} / ${resolvedNameEs}`
    : (resolvedNameEn || resolvedNameEs || id);
  const normalizedName = normalizeFileName(resolvedNameEn || resolvedNameEs || id) || id;
  const suggestedFileName = `${entityType}_${normalizedName}.png`;
  const imagePath = `images/${suggestedFileName}`;

  return {
    entityType,
    id,
    nameEn: resolvedNameEn,
    nameEs: resolvedNameEs,
    displayName,
    storageBucket: getImageBucket(entityType),
    imagePath,
    suggestedFileName,
    manualPromptHint: PROMPT_HINTS[entityType],
  };
}

export function imageManifestToCsv(items: ImageManifestItem[]): string {
  const header = [
    'entity_type',
    'id',
    'name_en',
    'name_es',
    'display_name',
    'storage_bucket',
    'image_path',
    'suggested_file_name',
    'manual_prompt_hint',
  ].join(',');

  const rows = items.map((item) =>
    [
      escapeCsv(item.entityType),
      escapeCsv(item.id),
      escapeCsv(item.nameEn),
      escapeCsv(item.nameEs),
      escapeCsv(item.displayName),
      escapeCsv(item.storageBucket),
      escapeCsv(item.imagePath),
      escapeCsv(item.suggestedFileName),
      escapeCsv(item.manualPromptHint),
    ].join(',')
  );

  return `${header}\n${rows.join('\n')}\n`;
}

export function imageManifestToMarkdown(items: ImageManifestItem[]): string {
  const header = [
    '# Missing Images Manifest',
    '',
    `Total items: ${items.length}`,
    '',
    '| Type | ID | Display Name | Bucket | Image Path | Suggested Filename |',
    '|------|----|--------------|--------|------------|--------------------|',
  ];

  const rows = items.map((item) =>
    `| ${escapeMarkdown(item.entityType)} | ${escapeMarkdown(item.id)} | ${
      escapeMarkdown(item.displayName)
    } | ${escapeMarkdown(item.storageBucket)} | ${escapeMarkdown(item.imagePath)} | ${
      escapeMarkdown(item.suggestedFileName)
    } |`
  );

  return `${[...header, ...rows].join('\n')}\n`;
}
