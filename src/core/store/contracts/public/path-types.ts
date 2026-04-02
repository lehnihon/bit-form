/**
 * Type-safe path utilities for form structures.
 */

type Primitive = string | number | boolean | bigint | symbol | null | undefined;

// Builds a union of all possible dot-separated paths for a given object/array type.
export type BitPath<T, Prefix extends string = ""> = T extends Primitive
  ? never
  : T extends readonly (infer U)[]
    ? Prefix extends ""
      ? `${number}` | `${number}.${BitPath<U>}`
      : `${Prefix}.${number}` | `${Prefix}.${number}.${BitPath<U>}`
    : {
        [K in keyof T & (string | number)]: T[K] extends Primitive
          ? Prefix extends ""
            ? `${K & (string | number)}`
            : `${Prefix}.${K & (string | number)}`
          : Prefix extends ""
            ?
                | `${K & (string | number)}`
                | `${K & (string | number)}.${BitPath<T[K]>}`
            :
                | `${Prefix}.${K & (string | number)}`
                | `${Prefix}.${K & (string | number)}.${BitPath<T[K]>}`;
      }[keyof T & (string | number)];

// Resolves the value type at a given dot-separated path.
export type BitPathValue<
  T,
  P extends string,
> = P extends `${infer K}.${infer Rest}`
  ? K extends `${number}`
    ? T extends readonly (infer U)[]
      ? BitPathValue<U, Rest>
      : never
    : K extends keyof T
      ? BitPathValue<T[K], Rest>
      : never
  : P extends `${number}`
    ? T extends readonly (infer U)[]
      ? U
      : never
    : P extends keyof T
      ? T[P]
      : never;

// Filters BitPath<T> to only those paths that resolve to array types.
// Distributive over union so each path is checked individually.
export type BitArrayPath<T> =
  BitPath<T> extends infer P
    ? P extends string
      ? BitPathValue<T, P> extends readonly unknown[]
        ? P
        : never
      : never
    : never;

// Extracts the element type of an array.
export type BitArrayItem<A> = A extends readonly (infer U)[]
  ? U
  : A extends (infer U)[]
    ? U
    : never;
