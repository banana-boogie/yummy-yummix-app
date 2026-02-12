import { getAppBaseUrl } from '../urls';

describe('getAppBaseUrl', () => {
  const originalEnv = process.env.EXPO_PUBLIC_APP_URL;
  const originalWindow = global.window;

  afterEach(() => {
    process.env.EXPO_PUBLIC_APP_URL = originalEnv;
    if (originalWindow) {
      global.window = originalWindow;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete (global as any).window;
    }
  });

  it('returns env URL without trailing slash', () => {
    process.env.EXPO_PUBLIC_APP_URL = 'https://staging.yummyyummix.com/';

    expect(getAppBaseUrl()).toBe('https://staging.yummyyummix.com');
  });

  it('falls back to window origin when env is missing', () => {
    process.env.EXPO_PUBLIC_APP_URL = '';
    global.window = { location: { origin: 'http://localhost:19006' } } as any;

    expect(getAppBaseUrl()).toBe('http://localhost:19006');
  });

  it('falls back to production URL when env and window are missing', () => {
    process.env.EXPO_PUBLIC_APP_URL = '';
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete (global as any).window;

    expect(getAppBaseUrl()).toBe('https://yummyyummix.com');
  });
});
