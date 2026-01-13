type CaseTransformer = (str: string) => string;

export const toSnakeCase = (str: string): string =>
  str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

export const toCamelCase = (str: string): string =>
  str.replace(/_([a-z])/g, g => g[1].toUpperCase());

export const transformKeys = (
  obj: Record<string, any>,
  transformer: CaseTransformer
): Record<string, any> => {
  if (Array.isArray(obj)) {
    return obj.map(v => transformKeys(v, transformer));
  }
  
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((result, key) => {
      const value = obj[key];
      const transformedKey = transformer(key);
      result[transformedKey] = transformKeys(value, transformer);
      return result;
    }, {} as Record<string, any>);
  }
  
  return obj;
};

export const toSnakeCaseKeys = (obj: Record<string, any>): Record<string, any> =>
  transformKeys(obj, toSnakeCase);

export const toCamelCaseKeys = (obj: Record<string, any>): Record<string, any> =>
  transformKeys(obj, toCamelCase); 