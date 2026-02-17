/**
 * Recipe Preview API Tests
 *
 * Tests security-related behavior for the preview endpoint.
 */

import handler from '../recipe-preview/[id]';
import { createClient } from '@supabase/supabase-js';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

function createMockRes() {
  const headers = {};
  const res = {
    headers,
    statusCode: 200,
    body: null,
    setHeader: jest.fn((key, value) => {
      headers[key] = value;
    }),
    status: jest.fn((code) => {
      res.statusCode = code;
      return res;
    }),
    send: jest.fn((body) => {
      res.body = body;
      return res;
    }),
    end: jest.fn(),
  };
  return res;
}

describe('recipe-preview API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
  });

  it('rejects invalid recipe IDs', async () => {
    const req = {
      query: { id: 'not-a-uuid', lang: 'en' },
      headers: { 'user-agent': 'facebookbot' },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toBe('Recipe ID is invalid');
    expect(createClient).not.toHaveBeenCalled();
  });

  it('escapes user-controlled content and strips unsafe image URLs', async () => {
    const maliciousName = '<script>alert("x")</script>';
    const recipe = {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      name_en: maliciousName,
      name_es: null,
      image_url: 'javascript:alert(1)',
    };

    const query = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: recipe, error: null }),
    };
    createClient.mockReturnValue({
      from: jest.fn().mockReturnValue(query),
    });

    const req = {
      query: { id: recipe.id, lang: 'en' },
      headers: { 'user-agent': 'facebookbot' },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).not.toContain(maliciousName);
    expect(res.body).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    expect(res.body).not.toContain('javascript:alert(1)');
    expect(res.body).not.toContain('og:image');
    expect(res.body).not.toContain('<img');
  });
});
