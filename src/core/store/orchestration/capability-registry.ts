import type {
  BitValidationStorePort,
  BitLifecycleStorePort,
} from "../contracts/port-types";
import type { BitArrayStorePort } from "../managers/features/array-manager";

/**
 * Registry for store capabilities (ports).
 *
 * Supports dynamic registration of capabilities without requiring modifications
 * to multiple files. Each capability is created on-demand and cached.
 *
 * This pattern enables:
 * - Adding new capabilities without changing store bootstrap code
 * - Lazy initialization of capabilities
 * - Type-safe capability access
 * - Decoupling capability creation from store composition
 */
export class BitCapabilityRegistry {
  private readonly ports = new Map<string, unknown>();
  private readonly initializers = new Map<string, () => unknown>();

  /**
   * Register a capability port initializer.
   * The initializer function is called once on first access and cached.
   */
  registerPort<K extends string, P>(key: K, initializer: () => P): void {
    if (this.ports.has(key)) {
      throw new Error(`Capability port "${key}" is already registered`);
    }
    this.initializers.set(key, initializer);
  }

  /**
   * Get a capability port by key.
   * Returns cached instance if already initialized.
   */
  getPort<K extends string, P = unknown>(key: K): P {
    let port = this.ports.get(key);

    if (!port) {
      const initializer = this.initializers.get(key);
      if (!initializer) {
        throw new Error(`Capability port "${key}" is not registered`);
      }
      port = initializer();
      this.ports.set(key, port);
    }

    return port as P;
  }

  /**
   * Check if a capability port is registered.
   */
  hasPort(key: string): boolean {
    return this.initializers.has(key) || this.ports.has(key);
  }

  /**
   * Get all registered port keys.
   */
  getPortKeys(): string[] {
    return Array.from(
      new Set([...this.initializers.keys(), ...this.ports.keys()]),
    );
  }

  /**
   * Get all initialized ports.
   */
  getInitializedPorts(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, port] of this.ports) {
      result[key] = port;
    }
    return result;
  }
}

/**
 * Typed capability registry with specific port types.
 * Provides type-safe access to known capabilities.
 */
export class BitTypedCapabilityRegistry {
  constructor(private registry: BitCapabilityRegistry) {}

  registerValidationPort(initializer: () => BitValidationStorePort<any>): void {
    this.registry.registerPort("validation", initializer);
  }

  registerLifecyclePort(initializer: () => BitLifecycleStorePort<any>): void {
    this.registry.registerPort("lifecycle", initializer);
  }

  registerArrayPort(initializer: () => BitArrayStorePort<any>): void {
    this.registry.registerPort("array", initializer);
  }

  registerCustomPort<P>(key: string, initializer: () => P): void {
    this.registry.registerPort(key, initializer);
  }

  getValidationPort(): BitValidationStorePort<any> {
    return this.registry.getPort<"validation", BitValidationStorePort<any>>(
      "validation",
    );
  }

  getLifecyclePort(): BitLifecycleStorePort<any> {
    return this.registry.getPort<"lifecycle", BitLifecycleStorePort<any>>(
      "lifecycle",
    );
  }

  getArrayPort(): BitArrayStorePort<any> {
    return this.registry.getPort<"array", BitArrayStorePort<any>>("array");
  }

  getCustomPort<P = unknown>(key: string): P {
    return this.registry.getPort<string, P>(key);
  }

  getUnderlyingRegistry(): BitCapabilityRegistry {
    return this.registry;
  }
}
