export const getAppBaseUrl = (): string => {
  const envUrl = process.env.EXPO_PUBLIC_APP_URL;
  if (envUrl && envUrl.trim().length > 0) {
    return envUrl.replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  return 'https://yummyyummix.com';
};
