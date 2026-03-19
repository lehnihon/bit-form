/**
 * Interface for DevTools adapters (local, remote).
 * Provides type safety for adapter operations.
 */
export interface BitDevToolsAdapter {
  /**
   * Initialize the adapter with a configuration object
   */
  initialize(config: unknown): void;

  /**
   * Send a message/event to the DevTools
   */
  sendMessage(event: unknown): void;

  /**
   * Cleanup and destroy the adapter resources
   */
  destroy?(): void;
}
