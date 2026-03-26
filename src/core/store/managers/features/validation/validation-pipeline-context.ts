import type { BitErrors } from "../../../contracts/types";
import type { BitValidationOptions } from "../../../contracts/public/meta-types";
import type { BitPipelineContext } from "../../../shared/pipeline";
import type { BitValidationStorePort } from "../../../contracts/port-types";

export interface ValidationPipelineContext<
  T extends object,
> extends BitPipelineContext {
  options?: BitValidationOptions;
  validationId: number;
  currentState: ReturnType<BitValidationStorePort<T>["getState"]>;
  targetFields?: string[];
  allErrors: Record<string, string | undefined>;
  committedErrors: BitErrors<T>;
  isValid: boolean;
  result: boolean;
  aborted: boolean;
}
