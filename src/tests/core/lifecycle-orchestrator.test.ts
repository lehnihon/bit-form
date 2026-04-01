import { describe, expect, it } from "vitest";
import {
  BitLifecycleOrchestrator,
  BitLifecyclePhase,
} from "../../core/store/managers/features/lifecycle/lifecycle-orchestrator";

describe("BitLifecycleOrchestrator", () => {
  it("deve executar em ordem de fase independente da ordem de registro", async () => {
    const orchestrator = new BitLifecycleOrchestrator<{
      kind: "updateField";
    }>();
    const trace: string[] = [];

    orchestrator.register("updateField", {
      phase: BitLifecyclePhase.UPDATE_VALUES,
      execute: () => {
        trace.push("values");
      },
    });

    orchestrator.register("updateField", {
      phase: BitLifecyclePhase.PREPARE,
      execute: () => {
        trace.push("prepare");
      },
    });

    orchestrator.register("updateField", {
      phase: BitLifecyclePhase.UPDATE_FIELD,
      execute: () => {
        trace.push("field");
      },
    });

    await orchestrator.execute({ kind: "updateField" });

    expect(trace).toEqual(["prepare", "field", "values"]);
  });

  it("deve falhar quando executor async roda em executeSync", () => {
    const orchestrator = new BitLifecycleOrchestrator<{ kind: "reset" }>();

    orchestrator.register("reset", {
      phase: BitLifecyclePhase.RESET,
      execute: async () => {},
    });

    expect(() => orchestrator.executeSync({ kind: "reset" })).toThrow(
      /executor async em modo sync/,
    );
  });
});
