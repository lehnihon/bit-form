import { describe, expect, it } from "vitest";
import {
  BitSyncPipelineRunner,
  type BitPipelineContext,
} from "../../core/store/shared/pipeline";

describe("BitSyncPipelineRunner", () => {
  it("deve lançar erro quando um step sync retorna Promise", () => {
    const runner = new BitSyncPipelineRunner<BitPipelineContext>([
      {
        name: "async-step",
        run: (() => Promise.resolve()) as unknown as () => void,
      },
    ]);

    expect(() => runner.run({})).toThrow(
      /BitSyncPipelineRunner: step "async-step" returned a Promise/i,
    );
  });
});
