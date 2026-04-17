import type { BitMask, BitMaskName } from "../../../mask/types";
import type { BitErrors } from "./state-types";

type BitBivariantFn<TArgs extends unknown[], TResult> = {
  bivarianceHack(...args: TArgs): TResult;
}["bivarianceHack"];

export type BitComputedFn<T> = (values: T, path?: string) => unknown;

export type BitNormalizeFn<T> = BitBivariantFn<
  [value: unknown, allValues: T, path?: string],
  unknown
>;

export type BitTransformFn<T> = BitBivariantFn<
  [value: unknown, allValues: T, path?: string],
  unknown
>;

export type ValidatorFn<T extends object> = (
  values: T,
  options?: { scopeFields?: string[] },
) => Promise<BitErrors<T>> | BitErrors<T>;

/** Conditional logic: visibility and dynamic required. */
export interface BitFieldConditional<
  T extends object = Record<string, unknown>,
> {
  dependsOn?: string[];
  showIf?: (values: T) => boolean;
  requiredIf?: (values: T) => boolean;
  requiredMessage?: string;
}

/** Field-level validation: async validation only. */
export interface BitFieldValidation<
  T extends object = Record<string, unknown>,
> {
  asyncValidateOn?: "change" | "blur";
  asyncValidate?: BitBivariantFn<
    [value: unknown, values: T],
    Promise<string | null | undefined>
  >;
  asyncValidateDelay?: number;
  asyncValidateTimeout?: number;
}

interface BitFieldDefinitionBase<T extends object = Record<string, unknown>> {
  conditional?: BitFieldConditional<T>;
  validation?: BitFieldValidation<T>;
  normalize?: BitNormalizeFn<T>;
  normalizeDependsOn?: string[];
  transform?: BitTransformFn<T>;
  mask?: BitMask | BitMaskName;
  scope?: string;
}

/** Full field definition: conditional, validation, transform, computed, mask, scope. */
export type BitFieldDefinition<T extends object = Record<string, unknown>> =
  | (BitFieldDefinitionBase<T> & {
      computed?: undefined;
      computedDependsOn?: never;
    })
  | (BitFieldDefinitionBase<T> & {
      computed: BitComputedFn<T>;
      computedDependsOn: string[];
    });
