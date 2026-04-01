/**
 * @group contract
 * Contrato público do store em modo namespaced-only (read/observe/write/feature).
 */
import { describe, expect, it, vi } from "vitest";
import { createBitStore } from "../../../core";

describe("Store Contract (namespaced-only)", () => {
  it("deve expor read/observe/write/feature", () => {
    const store = createBitStore({ initialValues: { name: "Leo", age: 30 } });

    expect(store.read).toBeDefined();
    expect(store.observe).toBeDefined();
    expect(store.write).toBeDefined();
    expect(store.feature).toBeDefined();
  });

  it("read.getState e read.getFieldState retornam snapshots coerentes", () => {
    const store = createBitStore({ initialValues: { name: "Leo" } });

    store.write.setField("name", "Ana");

    expect(store.read.getState().values.name).toBe("Ana");
    expect(store.read.getFieldState("name").value).toBe("Ana");
    expect(store.read.getFieldState("name").isDirty).toBe(true);
  });

  it("write.setValues partial preserva campos não enviados", () => {
    const store = createBitStore({ initialValues: { a: 1, b: 2 } });

    store.write.setValues({ a: 99 }, { partial: true });

    expect(store.read.getState().values).toEqual({ a: 99, b: 2 });
  });

  it("write.submit retorna status e chama callback com dirtyValues", async () => {
    const store = createBitStore({ initialValues: { name: "Leo" } });
    const onSuccess = vi.fn();

    const result = await store.write.submit(onSuccess);

    expect(result.status).toBe("submitted");
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith({ name: "Leo" }, {});
  });

  it("observe.subscribe notifica em mutação", () => {
    const store = createBitStore({ initialValues: { count: 0 } });
    const listener = vi.fn();

    const unsub = store.observe.subscribe(listener);
    store.write.setField("count", 1);

    expect(listener).toHaveBeenCalledTimes(1);
    unsub();
  });

  it("observe.subscribePath filtra por path", () => {
    const store = createBitStore({
      initialValues: { user: { name: "Leo" }, age: 30 },
    });
    const listener = vi.fn();

    const unsub = store.observe.subscribePath("user.name", listener);

    store.write.setField("age", 31);
    expect(listener).not.toHaveBeenCalled();

    store.write.setField("user.name", "Ana");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith("Ana");

    unsub();
  });

  it("observe.subscribeSelector respeita paths e equalityFn", () => {
    const store = createBitStore({ initialValues: { tags: ["a", "b"] } });
    const listener = vi.fn();

    store.observe.subscribeSelector((state) => state.values.tags, listener, {
      paths: ["tags"],
      equalityFn: (a, b) => a.length === b.length,
    });

    store.write.setField("tags", ["x", "y"]);
    expect(listener).not.toHaveBeenCalled();

    store.write.setField("tags", ["x"]);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("feature de array mantém valores e índices", () => {
    const store = createBitStore({ initialValues: { items: ["A", "B"] } });

    store.feature.pushItem("items", "C");
    store.feature.removeItem("items", 0);

    expect(store.read.getState().values.items).toEqual(["B", "C"]);
  });

  it("feature.getArrayItemIds mantém identidade ao mover itens", () => {
    const store = createBitStore({ initialValues: { items: ["A", "B"] } });

    const initialIds = store.feature.getArrayItemIds("items");
    store.feature.moveItem("items", 0, 1);
    const movedIds = store.feature.getArrayItemIds("items");

    expect(initialIds).toHaveLength(2);
    expect(movedIds[0]).toBe(initialIds[1]);
    expect(movedIds[1]).toBe(initialIds[0]);
  });

  it("feature de histórico expõe canUndo/canRedo e opera undo/redo", () => {
    const store = createBitStore({
      initialValues: { name: "Leo" },
      history: { enabled: true },
    });

    store.write.setField("name", "Ana");

    expect(store.feature.canUndo).toBe(true);
    store.feature.undo();
    expect(store.read.getState().values.name).toBe("Leo");

    expect(store.feature.canRedo).toBe(true);
    store.feature.redo();
    expect(store.read.getState().values.name).toBe("Ana");
  });

  it("não deve expor métodos flat legados no root", () => {
    const store = createBitStore({
      initialValues: { name: "Leo" },
    }) as unknown as Record<string, unknown>;

    expect("setField" in store).toBe(false);
    expect("getState" in store).toBe(false);
    expect("submit" in store).toBe(false);
    expect("subscribe" in store).toBe(false);
    expect("registerField" in store).toBe(false);
  });
});
