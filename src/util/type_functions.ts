/**
 * Converts each value in the object into an array of its type.
 */
export type ArraifyObjectValues<T extends object> = { // eslint-disable-line @typescript-eslint/ban-types, max-len
  [P in keyof T]: T[P][]
}
