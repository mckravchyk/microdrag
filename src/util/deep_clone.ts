type IndexedObject = Record<string, unknown>;

const primitiveTypes = [
  'undefined',
  'boolean',
  'number',
  'string',
  'bigint',
  'symbol',
];

const isPrimitive = (value: unknown) => primitiveTypes.indexOf(typeof value) !== -1;

function isPlainObject(value: unknown) {
  return (
    typeof value === 'object'
    && value !== null
    && (value as IndexedObject).constructor === Object
    && Object.getPrototypeOf((value as IndexedObject)) === Object.prototype
  );
}

const isArray = (value: unknown): value is Array<unknown> => Array.isArray(value);

/**
 * Deeply clones following values: JS primitives, null, object literals, arrays, dates. Functions
 * and other objects are assigned by reference.
 */
export function deepClone<T>(value: T): T {
  if (
    value === null
    || isPrimitive(value) // Primitive types are assigned by copy automatically
    || typeof value === 'function' // Functions won't be cloned and are assigned by reference
  ) {
    return value;
  }

  if (isArray(value)) {
    const copy = [] as unknown as (T & Array<unknown>);

    value.forEach((val, i) => {
      copy[i] = deepClone(value[i]);
    });

    return copy;
  }

  if (typeof value === 'object' && value instanceof Date) {
    return new Date(value.getTime()) as unknown as T;
  }

  if (isPlainObject(value)) {
    const copy = { } as (T & IndexedObject);

    for (const i of Object.keys(value as object /* FIXME: quick fix after TS upgrade, the type is off */)) {
      (copy as IndexedObject)[i] = deepClone((value as IndexedObject)[i]);
    }

    return copy;
  }

  // Otherwise the value must be a non-plain object (i.e. class instance) - those are passed by
  // reference.
  return value;
}
