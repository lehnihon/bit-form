import { bitMasks } from "../../../mask/built-ins";
import { BitMask, BitMaskName } from "../../../mask/types";

/**
 * BitMaskManager
 *
 * Manages input mask registration and resolution.
 * Decoupled from BitStore to reduce main class complexity.
 *
 * Responsibilities:
 * - Register/unregister masks
 * - Resolve masks by name
 */
export class BitMaskManager {
  private masks: Map<string, BitMask> = new Map();

  constructor() {
    Object.entries(bitMasks).forEach(([name, mask]) => {
      this.masks.set(name, mask);
    });
  }

  /**
   * Register a new input mask
   *
   * @param name - Unique mask identifier
   * @param mask - Mask configuration/pattern
   */
  registerMask(name: BitMaskName, mask: BitMask): void {
    this.masks.set(name, mask);
  }

  /**
   * Unregister an existing mask
   *
   * @param name - Mask identifier to remove
   */
  unregisterMask(name: BitMaskName): void {
    if (!this.masks.has(name)) {
      return; // Silently ignore non-existent masks
    }

    this.masks.delete(name);
  }

  /**
   * Get mask configuration by name
   *
   * @param name - Mask identifier
   * @returns Mask configuration or undefined if not found
   */
  resolveMask(name: BitMaskName): BitMask | undefined {
    return this.masks.get(name);
  }

  /**
   * Get all registered masks
   *
   * @returns Object map of all registered masks
   */
  getAllMasks(): Record<string, BitMask> {
    return Object.fromEntries(this.masks.entries());
  }

  /**
   * Clear all registered masks
   */
  clear(): void {
    this.masks.clear();
  }
}
