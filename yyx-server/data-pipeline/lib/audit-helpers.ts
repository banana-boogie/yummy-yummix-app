/**
 * Audit Helpers
 *
 * Pure functions extracted from audit-data.ts for testability.
 */

export interface AuditIssue {
  type: 'recipe' | 'ingredient' | 'kitchen_tool';
  id: string;
  name: string;
  issue: string;
}

export interface AuditEntity {
  id: string;
  name_en: string;
  name_es: string;
  image_url?: string;
}

/**
 * Audit a list of entities for missing data (image, EN name, ES name).
 * Accepts optional extraChecks callback for entity-type-specific validations.
 */
export function auditEntities(
  entities: AuditEntity[],
  type: AuditIssue['type'],
  extraChecks?: (entity: AuditEntity) => AuditIssue[],
): AuditIssue[] {
  const issues: AuditIssue[] = [];
  for (const entity of entities) {
    if (!entity.image_url) {
      issues.push({
        type,
        id: entity.id,
        name: entity.name_en || entity.name_es,
        issue: 'missing_image',
      });
    }
    if (!entity.name_en) {
      issues.push({
        type,
        id: entity.id,
        name: entity.name_es || '(unknown)',
        issue: 'missing_english_name',
      });
    }
    if (!entity.name_es) {
      issues.push({
        type,
        id: entity.id,
        name: entity.name_en || '(unknown)',
        issue: 'missing_spanish_name',
      });
    }
    if (extraChecks) {
      issues.push(...extraChecks(entity));
    }
  }
  return issues;
}
