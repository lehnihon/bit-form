import type { BitFrameworkConfig } from "./public-types";

export interface BitResolvedConfig<
  T extends object = any,
> extends BitFrameworkConfig<T> {}
