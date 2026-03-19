import type { BitFormDevToolsUI } from "../ui";

/**
 * Interface for DevTools adapters (local, remote).
 * Provides type safety for adapter operations.
 */
export interface BitDevToolsAdapter {
  /**
   * The DevTools UI instance
   */
  ui: BitFormDevToolsUI;

  /**
   * Cleanup and destroy the adapter resources
   */
  destroy?(): void;
}
