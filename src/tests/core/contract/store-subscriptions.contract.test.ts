/**
 * @group contract
 * Testes de contrato para todas as APIs de subscription do store.
 * Importa APENAS via entrypoint público - nunca caminhos internos.
 */
import { describe, it, expect, vi } from "vitest";
import { createBitStore as createBitStoreRuntime } from "../../../core";

const createBitStore = ((config?: any) => createBitStoreRuntime(config)) as any;

describe("Store Subscriptions Contract", () => {
  describe("subscribe (global)", () => {
    it("deve notificar listener global em qualquer mudança", () => {
      const store = createBitStore({ initialValues: { name: "Leo", age: 30 } });
      const listener = vi.fn();

      const unsub = store.observe.subscribe(listener);
      store.write.setField("name" as any, "Ana" as any);
      expect(listener).toHaveBeenCalledTimes(1);

      unsub();
      store.write.setField("name" as any, "Carl" as any);
      expect(listener).toHaveBeenCalledTimes(1); // não notificado após unsub
    });

    it("deve permitir múltiplos listeners globais", () => {
      const store = createBitStore({ initialValues: { x: 0 } });
      const a = vi.fn();
      const b = vi.fn();

      store.observe.subscribe(a);
      store.observe.subscribe(b);
      store.write.setField("x" as any, 1 as any);

      expect(a).toHaveBeenCalledTimes(1);
      expect(b).toHaveBeenCalledTimes(1);
    });
  });

  describe("subscribePath", () => {
    it("deve notificar somente ao mudar o path registrado", () => {
      const store = createBitStore({
        initialValues: { name: "Leo", age: 30 },
      });
      const listener = vi.fn();

      const unsub = store.observe.subscribePath("name" as any, listener);

      store.write.setField("age" as any, 31 as any);
      expect(listener).not.toHaveBeenCalled();

      store.write.setField("name" as any, "Ana" as any);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith("Ana");

      unsub();
    });

    it("deve chamar listener com valor inicial ao montar se equalityFn for sempre falsa", () => {
      // subscribePath tem getInitial behavior opcional — aqui testamos valor correto notificado após mudança
      const store = createBitStore({ initialValues: { count: 0 } });
      const values: number[] = [];

      store.observe.subscribePath("count" as any, (v) => values.push(v as any));
      store.write.setField("count" as any, 1 as any);
      store.write.setField("count" as any, 2 as any);
      store.write.setField("count" as any, 1 as any); // volta ao 1
      store.write.setField("count" as any, 1 as any); // sem mudança — não deve notificar

      expect(values).toEqual([1, 2, 1]);
    });

    it("deve cancelar subscription via unsub", () => {
      const store = createBitStore({ initialValues: { x: 0 } });
      const listener = vi.fn();

      const unsub = store.observe.subscribePath("x" as any, listener);
      unsub();

      store.write.setField("x" as any, 99 as any);
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("subscribeSelector", () => {
    it("deve notificar somente quando selector muda", () => {
      const store = createBitStore({
        initialValues: { name: "Leo", age: 30 },
      });
      const listener = vi.fn();

      store.observe.subscribeSelector(
        (state) => (state.values as any).name,
        listener,
        {
          paths: ["name"],
        },
      );

      store.write.setField("age" as any, 31 as any);
      expect(listener).not.toHaveBeenCalled();

      store.write.setField("name" as any, "Ana" as any);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith("Ana");
    });

    it("deve usar equalityFn customizada para evitar notificações desnecessárias", () => {
      const store = createBitStore({ initialValues: { tags: ["a", "b"] } });
      const listener = vi.fn();

      store.observe.subscribeSelector(
        (state) => (state.values as any).tags,
        listener,
        {
          paths: ["tags"],
          equalityFn: (a: any, b: any) => a.length === b.length,
        },
      );

      // mesmo tamanho, não deve notificar
      store.write.setField("tags" as any, ["x", "y"] as any);
      expect(listener).not.toHaveBeenCalled();

      // tamanho diferente, deve notificar
      store.write.setField("tags" as any, ["x"] as any);
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe("subscribeSelector (mode: tracked)", () => {
    it("deve rastrear paths acessados automaticamente", () => {
      const store = createBitStore({
        initialValues: { user: { name: "Leo", age: 30 }, title: "Dr" },
      });
      const listener = vi.fn();

      store.observe.subscribeSelector(
        (state) => ({ name: (state.values as any).user.name }),
        listener,
        { mode: "tracked" },
      );

      // mudança em campo não acessado - não deve notificar
      store.write.setField("title" as any, "Mr" as any);
      expect(listener).not.toHaveBeenCalled();

      // mudança em campo acessado - deve notificar
      store.write.setField("user.name" as any, "Ana" as any);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith({ name: "Ana" });
    });
  });

  describe("subscribeFormMeta", () => {
    it("deve notificar ao mudar isValid/isSubmitting/isDirty", async () => {
      const store = createBitStore({ initialValues: { name: "" } });
      const metaValues: any[] = [];

      store.observe.subscribeFormMeta((meta) => metaValues.push({ ...meta }));

      store.write.setField("name" as any, "Leo" as any);
      // isDirty deve ter mudado
      expect(metaValues.length).toBeGreaterThan(0);
      expect(metaValues[metaValues.length - 1].isDirty).toBe(true);
    });
  });

  describe("subscribeFieldState", () => {
    it("deve notificar com o snapshot completo do campo ao mudar valor", () => {
      const store = createBitStore({ initialValues: { email: "" } });
      const snapshots: any[] = [];

      store.observe.subscribeFieldState("email" as any, (s) =>
        snapshots.push(s),
      );

      store.write.setField("email" as any, "leo@test.com" as any);
      expect(snapshots.length).toBeGreaterThan(0);
      expect(snapshots[0].value).toBe("leo@test.com");
    });

    it("deve indicar isDirty true após mudança de valor", () => {
      const store = createBitStore({ initialValues: { email: "" } });
      const snapshots: any[] = [];

      store.observe.subscribeFieldState("email" as any, (s) =>
        snapshots.push(s),
      );

      store.write.setField("email" as any, "x@test.com" as any);
      const last = snapshots[snapshots.length - 1];
      expect(last.isDirty).toBe(true);
    });
  });
});
