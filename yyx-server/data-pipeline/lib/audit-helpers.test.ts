import { assertEquals } from 'std/assert/mod.ts';
import { auditEntities } from './audit-helpers.ts';
import type { AuditEntity, AuditIssue } from './audit-helpers.ts';

// ─── Test Data ──────────────────────────────────────────

function makeEntity(overrides: Partial<AuditEntity> & { id: string }): AuditEntity {
  return {
    name_en: 'Tomato',
    name_es: 'Tomate',
    image_url: 'https://example.com/tomato.png',
    ...overrides,
  };
}

// ─── auditEntities ──────────────────────────────────────

Deno.test('auditEntities returns no issues for complete entity', () => {
  const entities = [makeEntity({ id: 'e-1' })];
  const issues = auditEntities(entities, 'ingredient');
  assertEquals(issues.length, 0);
});

Deno.test('auditEntities flags missing image', () => {
  const entities = [makeEntity({ id: 'e-1', image_url: undefined })];
  const issues = auditEntities(entities, 'ingredient');

  assertEquals(issues.length, 1);
  assertEquals(issues[0].issue, 'missing_image');
  assertEquals(issues[0].id, 'e-1');
  assertEquals(issues[0].type, 'ingredient');
});

Deno.test('auditEntities flags empty string image_url as missing', () => {
  const entities = [makeEntity({ id: 'e-1', image_url: '' })];
  const issues = auditEntities(entities, 'recipe');

  const imageIssues = issues.filter((i) => i.issue === 'missing_image');
  assertEquals(imageIssues.length, 1);
});

Deno.test('auditEntities flags missing English name', () => {
  const entities = [makeEntity({ id: 'e-1', name_en: '' })];
  const issues = auditEntities(entities, 'ingredient');

  const enIssues = issues.filter((i) => i.issue === 'missing_english_name');
  assertEquals(enIssues.length, 1);
  assertEquals(enIssues[0].name, 'Tomate'); // Falls back to Spanish name
});

Deno.test('auditEntities flags missing Spanish name', () => {
  const entities = [makeEntity({ id: 'e-1', name_es: '' })];
  const issues = auditEntities(entities, 'kitchen_tool');

  const esIssues = issues.filter((i) => i.issue === 'missing_spanish_name');
  assertEquals(esIssues.length, 1);
  assertEquals(esIssues[0].name, 'Tomato'); // Falls back to English name
});

Deno.test('auditEntities uses (unknown) when both names are missing', () => {
  const entities = [makeEntity({ id: 'e-1', name_en: '', name_es: '' })];
  const issues = auditEntities(entities, 'ingredient');

  const enIssue = issues.find((i) => i.issue === 'missing_english_name');
  assertEquals(enIssue?.name, '(unknown)');
});

Deno.test('auditEntities reports multiple issues per entity', () => {
  const entities = [makeEntity({ id: 'e-1', image_url: undefined, name_en: '', name_es: '' })];
  const issues = auditEntities(entities, 'ingredient');

  // missing_image + missing_english_name + missing_spanish_name
  assertEquals(issues.length, 3);
});

Deno.test('auditEntities audits multiple entities', () => {
  const entities = [
    makeEntity({ id: 'e-1' }), // complete
    makeEntity({ id: 'e-2', image_url: undefined }), // missing image
    makeEntity({ id: 'e-3', name_en: '' }), // missing EN
  ];
  const issues = auditEntities(entities, 'recipe');

  assertEquals(issues.length, 2);
  assertEquals(issues[0].id, 'e-2');
  assertEquals(issues[1].id, 'e-3');
});

Deno.test('auditEntities calls extraChecks callback', () => {
  const entities = [makeEntity({ id: 'e-1' })];
  const extraChecks = (entity: AuditEntity): AuditIssue[] => [{
    type: 'ingredient',
    id: entity.id,
    name: entity.name_en,
    issue: 'missing_nutrition',
  }];

  const issues = auditEntities(entities, 'ingredient', extraChecks);

  assertEquals(issues.length, 1);
  assertEquals(issues[0].issue, 'missing_nutrition');
});

Deno.test('auditEntities combines base checks with extraChecks', () => {
  const entities = [makeEntity({ id: 'e-1', image_url: undefined })];
  const extraChecks = (entity: AuditEntity): AuditIssue[] => [{
    type: 'ingredient',
    id: entity.id,
    name: entity.name_en,
    issue: 'missing_nutrition',
  }];

  const issues = auditEntities(entities, 'ingredient', extraChecks);

  assertEquals(issues.length, 2);
  assertEquals(issues[0].issue, 'missing_image');
  assertEquals(issues[1].issue, 'missing_nutrition');
});

Deno.test('auditEntities returns empty array for empty input', () => {
  const issues = auditEntities([], 'recipe');
  assertEquals(issues.length, 0);
});

Deno.test('auditEntities preserves entity type in all issues', () => {
  const entities = [makeEntity({ id: 'e-1', image_url: undefined })];
  const issues = auditEntities(entities, 'kitchen_tool');

  assertEquals(issues.every((i) => i.type === 'kitchen_tool'), true);
});
