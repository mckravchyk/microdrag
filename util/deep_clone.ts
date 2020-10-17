interface IndexedObject {
  [key: string]: any
}

const primitiveTypes = [
  'undefined',
  'boolean',
  'number',
  'string',
  'bigint',
  'symbol',
];

const isPrimitive = (value: any) => primitiveTypes.indexOf(typeof value) !== -1;

function isObjectLiteral(value: any) {
  return (
    typeof value === 'object'
    && value !== null
    && (value as IndexedObject).constructor === Object
    && Object.getPrototypeOf((value as IndexedObject)) === Object.prototype
  );
}

const isArray = (value: any): value is Array<any> => Array.isArray(value);

/**
 * Deeply clones following values: JS primitives, null, object literals, arrays, dates. Functions
 * and other objects are assigned by reference.
 */
 export function deepClone<T>(value: T): T {
  if (
    // Null is a special case
    value === null
    // Primitive types are assigned by copy automatically
    || isPrimitive(value)
    // Functions won't be cloned and are assigned by reference
    || typeof value === 'function'
  ) {
    return value;
  }

  if (isArray(value)) {
    const copy = [] as unknown as (T & Array<any>);

    value.forEach((val, i) => {
      copy[i] = deepClone(value[i]);
    });

    return copy;
  }

  if (typeof value === 'object' && value instanceof Date) {
    return new Date(value.getTime()) as unknown as T;
  }

  if (isObjectLiteral(value)) {
    const copy = { } as (T & IndexedObject);

    for (const i of Object.keys(value)) {
      (copy as IndexedObject)[i] = deepClone((value as IndexedObject)[i]);
    }

    return copy;
  }

  // If this point is reached, the value must be a custom object
  // Custom objects, similarly to functions - are assigned a reference
  return value;
}