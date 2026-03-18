import { assertEquals, assertThrows } from 'std/assert/mod.ts';
import { resolveEnvironment } from './config.ts';

Deno.test('resolveEnvironment resolves --local', () => {
  assertEquals(resolveEnvironment(['--local']), 'local');
});

Deno.test('resolveEnvironment resolves --production', () => {
  assertEquals(resolveEnvironment(['--production']), 'production');
});

Deno.test('resolveEnvironment rejects conflicting flags', () => {
  assertThrows(
    () => resolveEnvironment(['--local', '--production']),
    Error,
    'Cannot specify both --local and --production',
  );
});

Deno.test('resolveEnvironment rejects missing environment flags', () => {
  assertThrows(
    () => resolveEnvironment([]),
    Error,
    'Must specify --local or --production',
  );
});
