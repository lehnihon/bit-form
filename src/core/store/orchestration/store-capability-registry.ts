import type { BitStoreCapabilities } from "./capabilities";

export class BitStoreCapabilityRegistry<T extends object> {
  private readonly entries = new Map<
    keyof BitStoreCapabilities<T>,
    BitStoreCapabilities<T>[keyof BitStoreCapabilities<T>]
  >();

  register<K extends keyof BitStoreCapabilities<T>>(
    key: K,
    capability: BitStoreCapabilities<T>[K],
  ): void {
    this.entries.set(key, capability);
  }

  resolve<K extends keyof BitStoreCapabilities<T>>(
    key: K,
  ): BitStoreCapabilities<T>[K] {
    const capability = this.entries.get(key);

    if (!capability) {
      throw new Error(
        `BitStore capability "${String(key)}" não foi registrada.`,
      );
    }

    return capability as BitStoreCapabilities<T>[K];
  }

  toCapabilities(): BitStoreCapabilities<T> {
    return {
      validation: this.resolve("validation"),
      lifecycle: this.resolve("lifecycle"),
      history: this.resolve("history"),
      arrays: this.resolve("arrays"),
      scope: this.resolve("scope"),
      query: this.resolve("query"),
      error: this.resolve("error"),
    };
  }
}

export function createStoreCapabilityRegistry<T extends object>() {
  return new BitStoreCapabilityRegistry<T>();
}
