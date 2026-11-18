// Persistence: what a member writes survives a restart. Runs with the
// Gateway stand-in, which has no AI provider: translation shows as off while
// the rest of the app works.
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { choose } from "./lib.mjs";

const runtime = await startRuntime();
try {
  const page = await (await runtime.context("member")).newPage();
  await page.goto("/translate");
  await expect(page.getByTestId("ai-off")).toBeVisible();
  await expect(page.getByTestId("translate-button")).toBeDisabled();

  await page.goto("/");
  await page.getByTestId("new-thread").click();
  await page.getByTestId("create-thread-name").fill("Winter Harbor Letters");
  await Promise.all([page.waitForURL(/\/threads\//), page.getByTestId("create-thread-save").click()]);
  const threadPath = new URL(page.url()).pathname;
  await page.goto(`${threadPath}?tab=settings`);
  await choose(page, "thread-status", "Dropped");
  await page.getByTestId("thread-tags").fill("letters, slow burn");
  await page.getByTestId("thread-note").fill("Stopped at the storm arc.");
  await page.getByTestId("thread-save").click();
  await expect(page.getByTestId("thread-saved")).toBeVisible();
  await page.goto(`${threadPath}?tab=glossary`);
  await page.getByTestId("add-term").click();
  await page.getByTestId("term-original").fill("冬港");
  await page.getByTestId("term-translation").fill("Winter Harbor");
  await page.getByTestId("term-save").click();
  await expect(page.getByTestId("term-row")).toContainText("Winter Harbor");
  await page.goto("/defaults");
  await page.getByTestId("default-instruction").fill("Short sentences.");
  await page.getByTestId("default-instruction-save").click();
  await expect(page.getByTestId("default-instruction-saved")).toBeVisible();

  await runtime.restart();

  const again = await (await runtime.context("member")).newPage();
  await again.goto("/");
  await again.getByTestId("status-dropped").click();
  await expect(again.getByTestId("thread-row")).toContainText("Winter Harbor Letters");
  await again.goto(`${threadPath}?tab=settings`);
  await expect(again.getByTestId("thread-tags")).toHaveValue("letters, slow burn");
  await expect(again.getByTestId("thread-note")).toHaveValue("Stopped at the storm arc.");
  await again.goto(`${threadPath}?tab=glossary`);
  await expect(again.getByTestId("term-row")).toContainText("Winter Harbor");
  await again.goto("/defaults");
  await expect(again.getByTestId("default-instruction")).toHaveValue("Short sentences.");
  console.log("persistence: ok");
} finally {
  await runtime.close();
}
