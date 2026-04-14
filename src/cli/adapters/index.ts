import { htmlReactAdapter } from "./html-react";
import { shadcnReactAdapter } from "./shadcn-react";
import type { Adapter } from "./types";

const registry: Record<string, Adapter> = {
  shadcn: shadcnReactAdapter,
  html: htmlReactAdapter,
};

export function getAdapter(name: string): Adapter | undefined {
  return registry[name.toLowerCase()];
}

export function listAdapters(): string[] {
  return Object.keys(registry);
}
