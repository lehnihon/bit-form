import { expect, test } from "@playwright/test";

test.describe("browser benchmark compare", () => {
  test("runs realistic cross-library benchmark in browser", async ({
    page,
  }) => {
    await page.goto("/?bench=compare");

    await page.locator("[data-testid='run-browser-benchmark']").click();

    await expect(
      page.locator("[data-testid='browser-benchmark-result']"),
    ).toContainText('"status": "done"', { timeout: 240_000 });

    const text =
      (await page
        .locator("[data-testid='browser-benchmark-result']")
        .textContent()) ?? "{}";
    const payload = JSON.parse(text) as {
      status: string;
      scenarios: Array<{
        scenario: string;
        bitFormMedianMs: number;
        rhfMedianMs: number;
        formikMedianMs: number;
        tanstackMedianMs: number;
        bitVsRhf: number;
      }>;
    };

    expect(payload.status).toBe("done");
    expect(payload.scenarios).toHaveLength(2);

    for (const scenario of payload.scenarios) {
      expect(Number.isFinite(scenario.bitFormMedianMs)).toBe(true);
      expect(Number.isFinite(scenario.rhfMedianMs)).toBe(true);
      expect(Number.isFinite(scenario.formikMedianMs)).toBe(true);
      expect(Number.isFinite(scenario.tanstackMedianMs)).toBe(true);
      expect(scenario.bitFormMedianMs).toBeGreaterThan(0);
      expect(scenario.rhfMedianMs).toBeGreaterThan(0);
      expect(scenario.bitVsRhf).toBeLessThan(1.2);
    }
  });
});
