import type { Adapter } from "./types";
import { shadcnReactAdapter } from "./shadcn-react";

const registry: Record<string, Adapter> = {
  shadcn: shadcnReactAdapter,
};

export function getAdapter(name: string): Adapter | undefined {
  return registry[name.toLowerCase()];
}

export function listAdapters(): string[] {
  return Object.keys(registry);
}
