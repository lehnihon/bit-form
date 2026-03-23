export {};

import type { BitFormGlobal } from "../core/bus-types";

declare global {
  var __BIT_FORM__: BitFormGlobal | undefined;
}
