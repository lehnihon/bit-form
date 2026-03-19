import { BitMask, BitMaskName } from "../../mask/types";

/**
 * BitMaskManager
 *
 * Manages input mask registration and resolution.
 * Decoupled from BitStore to reduce main class complexity.
 *
 * Responsibilities:
 * - Register/unregister masks
 * - Resolve masks by name
 * - Track mask version changes for reactive updates
 */
export class BitMaskManager {
  private masks: Record<string, BitMask> = {};
  private masksVersion = 0;

  /**
   * Register a new input mask
   *
   * @param name - Unique mask identifier
   * @param mask - Mask configuration/pattern
   */
  registerMask(name: BitMaskName, mask: BitMask): void {
    this.masks = {
      ...this.masks,
      [name]: mask,
    };
    this.masksVersion += 1;
  }

  /**
   * Unregister an existing mask
   *
   * @param name - Mask identifier to remove
   */
  unregisterMask(name: BitMaskName): void {
    if (!(name in this.masks)) {
      return; // Silently ignore non-existent masks
    }

    const { [name]: _, ...remaining } = this.masks;
    this.masks = remaining;
    this.masksVersion += 1;
  }

  /**
   * Get mask configuration by name
   *
   * @param name - Mask identifier
   * @returns Mask configuration or undefined if not found
   */
  resolveMask(name: BitMaskName): BitMask | undefined {
    return this.masks[name];
  }

  /**
   * Get all registered masks
   *
   * @returns Object map of all registered masks
   */
  getAllMasks(): Record<string, BitMask> {
    return this.masks;
  }

  /**
   * Get current mask version number
   * Used for change detection in React hooks via useSyncExternalStore
   *
   * @returns Version number that increments on each mask change
   */
  getMasksVersion(): number {
    return this.masksVersion;
  }

  /**
   * Clear all registered masks
   */
  clear(): void {
    this.masks = {};
  }
}
