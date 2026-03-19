/**
 * Computed Dependency Analyzer
 *
 * Detects cyclic dependencies in computed fields at initialization time.
 * Prevents runtime errors where computed fields don't stabilize.
 *
 * This replaces the runtime "did not stabilize" error with early, clear feedback during setup.
 */

import type { BitComputedFn } from "../../contracts/types";
import type { BitComputedEntry } from "./computed-manager";

export interface CyclicDependencyError {
  cycle: string[];
  paths: string[];
  message: string;
}

/**
 * Analyzes a set of computed field definitions for cyclic dependencies.
 *
 * @param entries - Computed field entries with their dependency information
 * @returns Array of detected cycles, empty if no cycles found
 *
 * @example
 * ```typescript
 * const entries = [
 *   { path: 'total', compute: ..., dependsOn: ['price', 'quantity'] },
 *   { path: 'price', compute: ..., dependsOn: ['total'] }, // CYCLE!
 * ];
 * const cycles = analyzeCyclicDependencies(entries);
 * if (cycles.length > 0) {
 *   throw new Error(`Cyclic dependencies: ${cycles[0].message}`);
 * }
 * ```
 */
export function analyzeCyclicDependencies<T extends object>(
  entries: Array<{
    path: string;
    dependsOn?: readonly string[];
  }>,
): CyclicDependencyError[] {
  const cycles: CyclicDependencyError[] = [];

  // Build adjacency list from dependencies
  const graph = new Map<string, Set<string>>();

  for (const entry of entries) {
    if (!graph.has(entry.path)) {
      graph.set(entry.path, new Set());
    }

    if (entry.dependsOn) {
      for (const dep of entry.dependsOn) {
        // Only track dependencies between computed fields
        // Ignore dependencies on form values (not computed fields)
        const depEntry = entries.find((e) => e.path === dep);
        if (depEntry) {
          graph.get(entry.path)!.add(dep);
        }
      }
    }
  }

  // DFS to find cycles
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  const hasCycle = (
    node: string,
    path: string[],
  ): CyclicDependencyError | null => {
    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    const neighbors = graph.get(node) || new Set();

    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        const cycle = hasCycle(neighbor, [...path]);
        if (cycle) return cycle;
      } else if (recursionStack.has(neighbor)) {
        // Found a cycle
        const cycleStart = path.indexOf(neighbor);
        const cyclePath = [...path.slice(cycleStart), neighbor];

        return {
          cycle: cyclePath,
          paths: Array.from(graph.keys()).filter((p) => cyclePath.includes(p)),
          message: `Circular dependency detected: ${cyclePath.join(
            " → ",
          )}. Check your computed field definitions.`,
        };
      }
    }

    recursionStack.delete(node);
    return null;
  };

  // Check each node for cycles
  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      const cycle = hasCycle(node, []);
      if (cycle && !cycles.some((c) => c.message === cycle.message)) {
        cycles.push(cycle);
      }
    }
  }

  return cycles;
}

/**
 * Higher-order function that returns a validator for computed entries.
 * Useful for decorating BitStore initialization.
 *
 * @example
 * ```typescript
 * const validateComputeds = createComputedValidator();
 * const entries = getComputedEntries();
 * const errors = validateComputeds(entries);
 * if (errors.length > 0) {
 *   console.error('Cyclic computeds:', errors);
 *   throw new Error('Invalid computed field configuration');
 * }
 * ```
 */
export function createComputedValidator() {
  return function validate<T extends object>(
    entries: Array<{
      path: string;
      dependsOn?: readonly string[];
    }>,
  ): CyclicDependencyError[] {
    return analyzeCyclicDependencies(entries);
  };
}
