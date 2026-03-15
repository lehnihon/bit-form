export class BitCapabilityRegistry<
  TCapabilities extends Record<string, unknown>,
> {
  private readonly capabilities = new Map<
    keyof TCapabilities,
    TCapabilities[keyof TCapabilities]
  >();

  register<TKey extends keyof TCapabilities>(
    key: TKey,
    capability: TCapabilities[TKey],
  ): void {
    this.capabilities.set(key, capability);
  }

  get<TKey extends keyof TCapabilities>(key: TKey): TCapabilities[TKey] {
    const capability = this.capabilities.get(key);

    if (!capability) {
      throw new Error(`Capability \"${String(key)}\" is not registered`);
    }

    return capability as TCapabilities[TKey];
  }

  has<TKey extends keyof TCapabilities>(key: TKey): boolean {
    return this.capabilities.has(key);
  }

  clear(): void {
    this.capabilities.clear();
  }
}
