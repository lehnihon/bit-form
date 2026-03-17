import { describe, expect, it } from "vitest";
import { BitDirtyManager } from "../../core/store/managers/core/dirty-manager";

describe("BitDirtyManager", () => {
  it("should clear child dirty paths when parent path changes", () => {
    const manager = new BitDirtyManager<any>();
    const initial = { user: { name: "A", age: 10 } };

    manager.updateForPath(
      "user.name",
      { user: { name: "B", age: 10 } },
      initial,
    );
    manager.updateForPath(
      "user.age",
      { user: { name: "B", age: 11 } },
      initial,
    );

    expect(manager.getDirtyPaths()).toEqual(new Set(["user.name", "user.age"]));

    manager.updateForPath("user", { user: { name: "C", age: 12 } }, initial);

    expect(manager.getDirtyPaths()).toEqual(new Set(["user"]));
    expect(manager.isPathDirty("user.name")).toBe(true);
  });

  it("should rebuild and clear indexes consistently", () => {
    const manager = new BitDirtyManager<any>();
    const initial = { a: 1, nested: { x: 1 } };

    expect(manager.rebuild({ a: 2, nested: { x: 2 } }, initial)).toBe(true);
    expect(manager.isPathDirty("a")).toBe(true);
    expect(manager.isPathDirty("nested.x")).toBe(true);

    manager.clear();

    expect(manager.isDirty).toBe(false);
    expect(manager.getDirtyPaths().size).toBe(0);
    expect(manager.isPathDirty("nested.x")).toBe(false);
  });
});
