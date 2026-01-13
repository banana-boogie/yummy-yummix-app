type CamelCase<S extends string> = S extends `${infer P}_${infer Q}`
  ? `${P}${Capitalize<CamelCase<Q>>}`
  : S;

type KeysToCamelCase<T> = {
  [K in keyof T as CamelCase<string & K>]: T[K] extends object
    ? KeysToCamelCase<T[K]>
    : T[K];
};

export const toCamelCase = <T extends object>(obj: T): KeysToCamelCase<T> => {
  // Return early if obj is null, undefined, or a primitive type
  if (obj === null || typeof obj !== 'object' || typeof obj === 'string') {
    return obj as any;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => 
      typeof item === 'object' ? toCamelCase(item) : item
    ) as any;
  }

  const camelCaseObj = {} as any;
  
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      const value = obj[key];
      
      camelCaseObj[camelKey] = value && typeof value === 'object' 
        ? toCamelCase(value)
        : value;
    }
  }
  
  return camelCaseObj;
}; 