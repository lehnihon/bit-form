import { describe, expect, it } from "vitest";
import { analyzeCyclicDependencies } from "../../core/store/managers/core/computed-dependency-analyzer";

describe("analyzeCyclicDependencies", () => {
  it("should detect a cycle in disconnected computed graphs", () => {
    const cycles = analyzeCyclicDependencies<any>([
      { path: "a", dependsOn: ["b"] },
      { path: "b", dependsOn: ["c"] },
      { path: "c", dependsOn: [] },
      { path: "x", dependsOn: ["y"] },
      { path: "y", dependsOn: ["x"] },
    ]);

    expect(cycles).toHaveLength(1);
    expect(cycles[0]?.message).toContain("Circular dependency detected");
    expect(cycles[0]?.cycle).toEqual(["x", "y", "x"]);
  });

  it("should ignore dependencies that are not computed fields", () => {
    const cycles = analyzeCyclicDependencies<any>([
      { path: "total", dependsOn: ["price", "quantity"] },
      { path: "discounted", dependsOn: ["total", "coupon"] },
    ]);

    expect(cycles).toEqual([]);
  });
});
