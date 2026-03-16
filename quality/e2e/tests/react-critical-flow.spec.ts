import { expect, test } from "@playwright/test";

test.describe("React pilot critical flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.locator("[data-testid='clear-draft']").click();
  });

  test("async validation + arrays + persist + server 422", async ({ page }) => {
    await page.locator("[data-testid='name-input']").fill("Leandro");
    await page.locator("[data-testid='email-input']").fill("ok@demo.com");

    await page.locator("[data-testid='username-input']").fill("admin");
    await page.locator("[data-testid='username-input']").blur();
    await expect(page.locator("[data-testid='username-error']")).toContainText(
      "Username já está em uso",
    );

    await page.locator("[data-testid='username-input']").fill("leo123");
    await page.locator("[data-testid='username-input']").blur();
    await expect(page.locator("[data-testid='username-error']")).toHaveCount(0);

    await page.locator("[data-testid='tag-input']").fill("typescript");
    await page.locator("[data-testid='add-tag']").click();
    await expect(page.locator("[data-testid='tags-list']")).toContainText(
      "typescript",
    );

    await page.locator("[data-testid='save-draft']").click();
    await page.locator("[data-testid='name-input']").fill("Outro Nome");
    await page.locator("[data-testid='restore-draft']").click();
    await expect(page.locator("[data-testid='name-input']")).toHaveValue(
      "Leandro",
    );

    await page.locator("[data-testid='email-input']").fill("server@error.com");
    await page.locator("[data-testid='email-input']").blur();
    await page.locator("[data-testid='submit-button']").click();

    await expect(page.locator("[data-testid='email-error']")).toContainText(
      "Email rejeitado pelo servidor",
    );
  });
});
