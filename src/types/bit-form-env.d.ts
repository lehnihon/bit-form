export {};

import type { BitFormGlobal } from "../core/store/contracts/bus-types";

declare global {
  var __BIT_FORM__: BitFormGlobal | undefined;
}
