import { assertThrows } from 'std/assert/mod.ts';
import { assertRequiredApiKey } from './cli-validations.ts';

Deno.test('assertRequiredApiKey accepts configured key', () => {
  assertRequiredApiKey('OPENAI_API_KEY', 'sk-test-123');
});

Deno.test('assertRequiredApiKey rejects missing key', () => {
  assertThrows(
    () => assertRequiredApiKey('OPENAI_API_KEY', ''),
    Error,
    'OPENAI_API_KEY not configured',
  );
});

Deno.test('assertRequiredApiKey rejects whitespace-only key', () => {
  assertThrows(
    () => assertRequiredApiKey('OPENAI_API_KEY', '   '),
    Error,
    'OPENAI_API_KEY not configured',
  );
});
