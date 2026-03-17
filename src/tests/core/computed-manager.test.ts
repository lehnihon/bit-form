import { describe, expect, it } from "vitest";
import {
  BitComputedManager,
  type BitComputedEntry,
} from "../../core/store/managers/core/computed-manager";

describe("BitComputedManager", () => {
  it("should run only affected computed entries for explicit changed paths", () => {
    const entries: BitComputedEntry<any>[] = [
      {
        path: "a",
        dependsOn: ["x"],
        compute: (values) => values.x * 2,
      },
      {
        path: "b",
        dependsOn: ["a"],
        compute: (values) => values.a + 1,
      },
    ];

    const manager = new BitComputedManager(() => entries);

    const unchanged = manager.apply({ x: 1, y: 2, a: 2, b: 3 }, ["y"]);
    expect(unchanged).toEqual({ x: 1, y: 2, a: 2, b: 3 });

    const changed = manager.apply({ x: 3, y: 2, a: 0, b: 0 }, ["x"]);
    expect(changed.a).toBe(6);
    expect(changed.b).toBe(7);
  });

  it("should throw for cyclic computed dependencies", () => {
    const entries: BitComputedEntry<any>[] = [
      {
        path: "a",
        dependsOn: ["b"],
        compute: (values) => values.b,
      },
      {
        path: "b",
        dependsOn: ["a"],
        compute: (values) => values.a,
      },
    ];

    const manager = new BitComputedManager(() => entries);

    expect(() => manager.apply({ a: 1, b: 2 }, ["a"])).toThrow(
      "cyclic computed dependencies detected",
    );
  });
});
