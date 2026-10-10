import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";

const password = "Password123";
test("complete workspace journey, downloads, authentication and responsive layout", async ({
  page,
}, testInfo) => {
  const email = `browser-${randomUUID()}@example.com`;
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const checkA11y = async () =>
    expect(
      (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
        .violations,
    ).toEqual([]);
  const checkWidth = async () =>
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Keep trade moving." }),
  ).toBeVisible();
  await checkWidth();
  await checkA11y();
  await page.screenshot({
    path: `/tmp/tradedocs-${testInfo.project.name}-landing.png`,
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Create an account", exact: true })
    .click();
  await page.getByLabel("Company name").fill("Browser Test Trading");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your trade workspace" }),
  ).toBeVisible();
  await checkWidth();
  await checkA11y();
  await page.screenshot({
    path: `/tmp/tradedocs-${testInfo.project.name}-overview.png`,
    fullPage: true,
  });
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Invoices", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Create invoice", exact: true })
    .first()
    .click();
  await page.getByLabel("Buyer name", { exact: true }).fill("Buyer & Partners");
  await page.getByLabel("Item name", { exact: true }).fill("Widget");
  await page.getByLabel("Unit price", { exact: true }).fill("10.50");
  await page.getByLabel("Quantity", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await page
    .getByLabel("Item name", { exact: true })
    .nth(1)
    .fill("Second item");
  await page.getByLabel("Unit price", { exact: true }).nth(1).fill("4");
  await page.getByLabel("Quantity", { exact: true }).nth(1).fill("1.5");
  await page
    .getByRole("combobox", { name: "Unit", exact: true })
    .nth(1)
    .selectOption("LTR");
  await page
    .getByRole("button", { name: "Create invoice", exact: true })
    .last()
    .click();
  await expect(page.getByRole("heading", { name: /Invoice #/ })).toBeVisible();
  await expect(page.getByText("1.5 LTR", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Edit invoice", exact: true }).click();
  await page.getByLabel("Payable amount", { exact: true }).fill("30.25");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("$30.25", { exact: true })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download XML", exact: true }).click();
  const download = await downloadPromise;
  const xml = await readFile(await download.path(), "utf8");
  expect(xml).toContain("30.25");
  expect(xml).toContain("Buyer &amp; Partners");
  await page.screenshot({
    path: `/tmp/tradedocs-${testInfo.project.name}-invoice.png`,
    fullPage: true,
  });
  await checkWidth();
  await checkA11y();
  await page.reload();
  await expect(page.getByRole("heading", { name: /Invoice #/ })).toBeVisible();
  await page.getByRole("link", { name: "All invoices" }).click();
  await page.getByRole("button", { name: "Validate XML", exact: true }).click();
  await page.getByLabel("Invoice XML", { exact: true }).fill(xml);
  await page
    .getByRole("button", { name: "Validate XML", exact: true })
    .last()
    .click();
  await expect(page.getByRole("status")).toContainText("Valid UBL 2.1 invoice");
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Despatches", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Create despatch", exact: true })
    .first()
    .click();
  await page.getByLabel("Order reference", { exact: true }).fill("BROWSER-42");
  await page.getByLabel("Customer name").fill("Buyer & Partners");
  await page.getByLabel("Delivery address").fill("1 Trade Street, Sydney");
  await page.getByLabel("Item reference", { exact: true }).fill("ITEM-1");
  await page.getByLabel("Description", { exact: true }).fill("Widget");
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await page
    .getByLabel("Item reference", { exact: true })
    .nth(1)
    .fill("ITEM-2");
  await page
    .getByLabel("Description", { exact: true })
    .nth(1)
    .fill("Second item");
  await page
    .getByRole("combobox", { name: "Unit", exact: true })
    .nth(1)
    .selectOption("LTR");
  await page
    .getByRole("button", { name: "Create despatch advice", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Despatch advice", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("ITEM-2", { exact: true })).toBeVisible();
  await checkWidth();
  await checkA11y();
  const despatchDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download XML", exact: true }).click();
  const despatchDownload = await despatchDownloadPromise;
  expect(await readFile(await despatchDownload.path(), "utf8")).toContain(
    "ITEM-2",
  );
  await page.getByRole("link", { name: "All despatches" }).click();
  await page
    .getByRole("button", { name: "Remove despatch for BROWSER-42" })
    .click();
  await page.getByRole("button", { name: "Confirm removal" }).click();
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "BROWSER-42", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Tracking", exact: true })
    .click();
  await page.getByLabel("Tracking number").fill("TEST-123");
  await page.getByLabel("Carrier").fill("ups");
  await page.getByRole("button", { name: "Save tracking reference" }).click();
  await expect(page.getByText("TEST-123", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Advance demo", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "Received (demo)", exact: true }),
  ).toBeVisible();
  await checkWidth();
  await checkA11y();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("incorrect");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("incorrect");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your trade workspace" }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Invoices", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "Buyer & Partners", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("protected routes, missing pages and network failures show useful recovery", async ({
  page,
}) => {
  await page.goto("/invoices");
  await expect(page).toHaveURL(/login/);
  await page.goto("/does-not-exist");
  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
  await page.goto("/login");
  await page.route("**/api/v1/admin/login", (route) => route.abort());
  await page.getByLabel("Email", { exact: true }).fill("offline@example.com");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Could not reach the server",
  );
});
