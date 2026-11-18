// Behavior: every frozen feature's main path, through the packaged release.
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { CHAPTER_ONE, CHAPTER_TWO, aiCalls, choose, promptOf, rowAction, withFakeAi } from "./lib.mjs";

const runtime = await startRuntime(withFakeAi);
const THREAD = "The Azure Sky Chronicle";
const INSTRUCTION = "Keep a calm, literary tone and use American spelling.";
try {
  const owner = await runtime.context("owner");
  const page = await owner.newPage();

  // F005: a default instruction and a default term.
  await page.goto("/defaults");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Defaults");
  await page.getByTestId("default-instruction").fill(INSTRUCTION);
  await page.getByTestId("default-instruction-save").click();
  await expect(page.getByTestId("default-instruction-saved")).toBeVisible();
  await page.getByTestId("add-default-term").click();
  await page.getByTestId("term-original").fill("师兄");
  await page.getByTestId("term-translation").fill("Senior Brother");
  await page.getByTestId("term-save").click();
  await expect(page.getByTestId("default-term-row").filter({ hasText: "师兄" })).toContainText("Senior Brother");

  // F001: paste text into a new thread with a chosen model.
  await page.goto("/translate");
  await expect(page.getByTestId("ai-off")).toHaveCount(0);
  await page.getByTestId("source-input").fill(CHAPTER_ONE);
  await choose(page, "destination-select", "New thread");
  await page.getByTestId("new-thread-name").fill(THREAD);
  await choose(page, "model-select", "Gemini 2.5 Flash");
  await Promise.all([
    page.waitForURL(/\/threads\/[^/]+\/chapters\/[^/?]+/),
    page.getByTestId("translate-button").click(),
  ]);
  const chapterOneUrl = new URL(page.url()).pathname;
  const threadPath = chapterOneUrl.replace(/\/chapters\/.*$/, "");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Chapter 1: The Gate of the Azure Cloud Sect");
  await expect(page.getByTestId("chapter-translation")).toContainText("Lin Feng stood before the gate");
  let calls = await aiCalls(runtime);
  expect(calls).toHaveLength(1);
  expect(calls[0].body.model).toBe("google/gemini-2.5-flash");
  expect(promptOf(calls[0])).toContain("师兄 → Senior Brother");
  expect(promptOf(calls[0])).toContain(INSTRUCTION);
  expect(promptOf(calls[0])).toContain("晨钟响起时");

  // F003: original alongside, reading preferences saved per user.
  await page.getByTestId("toggle-original").click();
  await expect(page.getByTestId("chapter-original")).toContainText("林风站在青云宗的山门前");
  await page.getByTestId("reading-settings").click();
  await page.getByRole("button", { name: "Large", exact: true }).click();
  await expect(page.getByTestId("chapter-translation")).toHaveAttribute("data-size", "lg");
  await page.getByRole("button", { name: "Serif", exact: true }).click();
  await expect(page.getByTestId("chapter-translation")).toHaveAttribute("data-font", "serif");
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(page.getByTestId("chapter-translation")).toHaveAttribute("data-size", "lg");
  await expect(page.getByTestId("chapter-translation")).toHaveAttribute("data-font", "serif");
  await expect(page.getByTestId("download-translation")).toBeVisible();
  await expect(page.getByTestId("copy-translation")).toBeVisible();

  // F004: the glossary the translation filled in; the default wins over auto.
  await page.goto(`${threadPath}?tab=glossary`);
  const termRow = (original) => page.getByTestId("term-row").filter({ hasText: original });
  await expect(page.getByTestId("term-row")).toHaveCount(3);
  await expect(termRow("师兄")).toContainText("Senior Brother");
  await expect(termRow("师兄")).toContainText("Your default");
  await expect(termRow("林风")).toContainText("Auto");
  await page.getByTestId("term-filter-male").click();
  await expect(termRow("林风")).toBeVisible();
  await expect(termRow("青云宗")).toHaveCount(0);
  await page.getByTestId("term-filter-all").click();
  await page.getByTestId("term-search").fill("returning disciple");
  await expect(page.getByTestId("term-row")).toHaveCount(1);
  await page.getByTestId("term-search").fill("");

  await rowAction(page, "青云宗", "Edit");
  await page.getByTestId("term-translation").fill("Blue Cloud Sect");
  await page.getByTestId("term-always").click();
  await page.getByTestId("term-save").click();
  await expect(termRow("青云宗")).toContainText("Blue Cloud Sect");
  await expect(termRow("青云宗")).toContainText("Set by you");
  await rowAction(page, "林风", "Exclude");
  await page.getByTestId("term-filter-excluded").click();
  await expect(page.getByTestId("term-row")).toHaveCount(1);
  await expect(termRow("林风")).toBeVisible();
  await page.getByTestId("term-filter-always").click();
  await expect(page.getByTestId("term-row")).toHaveCount(1);
  await expect(termRow("青云宗")).toBeVisible();

  // The new wording shows in the translated chapter; off when the preference is off.
  await page.goto(chapterOneUrl);
  await expect(page.getByTestId("chapter-translation")).toContainText("gate of the Blue Cloud Sect");
  await expect(page.getByTestId("chapter-translation")).not.toContainText("Azure Cloud Sect");
  await page.goto("/defaults");
  await page.getByTestId("pref-live-terms").click();
  await expect(page.getByTestId("pref-live-terms")).toHaveAttribute("aria-checked", "false");
  await page.goto(chapterOneUrl);
  await expect(page.getByTestId("chapter-translation")).toContainText("gate of the Azure Cloud Sect");
  await page.goto("/defaults");
  await page.getByTestId("pref-live-terms").click();
  await expect(page.getByTestId("pref-live-terms")).toHaveAttribute("aria-checked", "true");

  // F001: a link the server can't read fails with the reason; paste the text instead.
  await page.goto("/translate");
  await page.getByTestId("source-input").fill("https://chapters.invalid/book/2");
  await choose(page, "destination-select", THREAD);
  await Promise.all([
    page.waitForURL(/\/chapters\/(?!.*chapters)/),
    page.getByTestId("translate-button").click(),
  ]);
  await expect(page.getByTestId("chapter-failure")).toBeVisible();
  await expect(page.getByTestId("chapter-status")).toHaveText("Failed");
  await page.getByTestId("paste-instead").click();
  await page.getByTestId("paste-text").fill(CHAPTER_TWO);
  await page.getByTestId("paste-submit").click();
  await expect(page.getByTestId("chapter-translation")).toContainText("lanterns lit the mountain path");
  const chapterTwoUrl = new URL(page.url()).pathname;
  calls = await aiCalls(runtime);
  expect(calls).toHaveLength(2);
  const second = promptOf(calls[1]);
  expect(second).toContain("青云宗 → Blue Cloud Sect");
  expect(second).toContain("(mandatory)");
  expect(second).not.toContain("林风 →");

  // F001: a source over the cap is refused before any model call.
  await page.goto("/translate");
  await page.getByTestId("source-input").fill("字".repeat(20001));
  await expect(page.getByTestId("translate-button")).toBeDisabled();
  await expect(page.getByTestId("source-count")).toContainText("20,001");

  // F004: the new term was added; reset to auto restores the model's wording.
  await page.goto(`${threadPath}?tab=glossary`);
  await expect(termRow("藏经阁")).toContainText("Scripture Library");
  await rowAction(page, "青云宗", "Reset to auto");
  await expect(termRow("青云宗")).toContainText("Azure Cloud Sect");
  await expect(termRow("青云宗")).toContainText("Auto");
  // F005: a thread term saved to the defaults.
  await rowAction(page, "林风", "Add to your defaults");
  await page.goto("/defaults");
  await expect(page.getByTestId("default-term-row").filter({ hasText: "林风" })).toContainText("Lin Feng");

  // F003: chapter list, filters, flags, order, bulk actions.
  await page.goto(threadPath);
  const rows = page.getByTestId("chapter-row");
  await expect(rows).toHaveCount(2);
  await expect(page.getByTestId("chapter-filter-unread")).toContainText("2");
  await expect(rows.nth(1).getByTestId("last-read")).toBeVisible();
  await rowAction(page, "Chapter 1: The Gate of the Azure Cloud Sect", "Mark read");
  await expect(page.getByTestId("chapter-filter-unread")).toContainText("1");
  await rowAction(page, "Chapter 2: Lanterns on the Mountain", "Bookmark");
  await page.getByTestId("chapter-filter-bookmarked").click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("Lanterns");
  await page.getByTestId("chapter-filter-all").click();
  await rowAction(page, "Chapter 1: The Gate of the Azure Cloud Sect", "Rename");
  await page.getByTestId("rename-input").fill("Chapter 1: The Sect Gate");
  await page.getByTestId("rename-save").click();
  await expect(rows.first()).toContainText("Chapter 1: The Sect Gate");
  await page.getByTestId("chapter-search").fill("lanterns");
  await expect(rows).toHaveCount(1);
  await page.getByTestId("chapter-search").fill("");
  await rowAction(page, "Chapter 2: Lanterns on the Mountain", "Move");
  await choose(page, "move-target", "Chapter 1: The Sect Gate");
  await choose(page, "move-position", "Before");
  await page.getByTestId("move-save").click();
  await expect(rows.first()).toContainText("Lanterns");
  await page.getByRole("checkbox", { name: "Select Chapter 1: The Sect Gate" }).click();
  await page.getByRole("checkbox", { name: "Select Chapter 2: Lanterns on the Mountain" }).click();
  await page.getByTestId("bulk-bar").getByRole("button", { name: "Mark read" }).click();
  await expect(page.getByTestId("chapter-filter-unread")).toContainText("0");

  // Next chapter follows the thread's order.
  await page.goto(chapterTwoUrl);
  await Promise.all([page.waitForURL((url) => url.pathname === chapterOneUrl), page.getByTestId("next-chapter").click()]);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Chapter 1: The Sect Gate");

  // A failed chapter: counted, retried, deleted.
  await page.goto("/translate");
  await page.getByTestId("source-input").fill("https://chapters.invalid/book/3");
  await choose(page, "destination-select", THREAD);
  await Promise.all([page.waitForURL(/\/chapters\//), page.getByTestId("translate-button").click()]);
  await expect(page.getByTestId("chapter-failure")).toBeVisible();
  await page.getByTestId("retry-chapter").click();
  await expect(page.getByTestId("chapter-failure")).toBeVisible();
  await page.goto(threadPath);
  await expect(page.getByTestId("chapter-filter-failed")).toContainText("1");

  // F002: thread details.
  await page.goto(`${threadPath}?tab=settings`);
  await choose(page, "thread-status", "Completed");
  await page.getByTestId("thread-tags").fill("cultivation, sect life");
  await page.getByTestId("thread-note").fill("Recommended by Mira. Read slowly.");
  await page.getByTestId("thread-save").click();
  await expect(page.getByTestId("thread-saved")).toBeVisible();
  // F005: a thread's own instruction, then back to the default.
  await expect(page.getByTestId("thread-instruction")).toHaveValue(INSTRUCTION);
  await page.getByTestId("thread-instruction").fill("Plain modern English.");
  await page.getByTestId("instruction-save").click();
  await expect(page.getByTestId("instruction-custom")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("thread-instruction")).toHaveValue("Plain modern English.");
  await page.getByTestId("instruction-use-default").click();
  await expect(page.getByTestId("instruction-custom")).toHaveCount(0);
  await expect(page.getByTestId("thread-instruction")).toHaveValue(INSTRUCTION);

  // F006: share link.
  await page.getByTestId("share-create").click();
  const shareUrl = await page.getByTestId("share-url").inputValue();
  expect(new URL(shareUrl).hostname).toBe(runtime.hostname);
  expect(new URL(shareUrl).pathname).toMatch(/^\/s\/[A-Za-z0-9_-]{16,}$/);
  const token = new URL(shareUrl).pathname.split("/")[2];
  const shared = await runtime.fetch(`/share-api/${token}`);
  expect(shared.status).toBe(200);
  const sharedJson = await shared.text();
  expect(JSON.parse(sharedJson).chapters).toHaveLength(2);
  for (const hidden of ["sect life", "Mira", "owner@example.test", "晨钟", "Plain", "chapters.invalid", INSTRUCTION]) {
    expect(sharedJson).not.toContain(hidden);
  }
  const visitor = await (await runtime.context(null)).newPage();
  await visitor.goto(new URL(shareUrl).pathname);
  await expect(visitor.getByRole("heading", { level: 1 })).toHaveText(THREAD);
  await expect(visitor.getByTestId("share-chapter")).toHaveCount(2);
  await expect(visitor.getByText("Mira")).toHaveCount(0);
  await visitor.getByTestId("share-chapter").first().click();
  await expect(visitor.getByTestId("share-translation")).toContainText("lanterns lit the mountain path");
  await visitor.getByTestId("share-next").click();
  await expect(visitor.getByTestId("share-translation")).toContainText("Lin Feng stood before the gate");
  await expect(visitor.locator("textarea, input")).toHaveCount(0);

  // F002: the library.
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Library");
  await page.getByTestId("new-thread").click();
  await page.getByTestId("create-thread-name").fill("Moonlit Blade");
  await page.getByTestId("create-thread-save").click();
  await page.goto("/");
  const threads = page.getByTestId("thread-row");
  await expect(threads).toHaveCount(2);
  await page.getByTestId("library-search").fill("sect life");
  await expect(threads).toHaveCount(1);
  await expect(threads.first()).toContainText(THREAD);
  await page.getByTestId("library-search").fill("");
  await page.getByTestId("status-completed").click();
  await expect(threads).toHaveCount(1);
  await page.getByTestId("status-reading").click();
  await expect(threads).toHaveCount(1);
  await expect(threads.first()).toContainText("Moonlit Blade");
  await page.getByTestId("status-all").click();
  await choose(page, "tag-filter", "cultivation");
  await expect(threads).toHaveCount(1);
  await choose(page, "tag-filter", "All tags");
  await choose(page, "library-sort", "Name");
  await expect(threads.first()).toContainText("Moonlit Blade");

  // Revoke: the link is gone.
  await page.goto(`${threadPath}?tab=settings`);
  await page.getByTestId("share-revoke").click();
  await expect(page.getByTestId("share-create")).toBeVisible();
  expect((await runtime.fetch(`/share-api/${token}`)).status).toBe(404);

  // Delete the empty thread.
  await page.goto("/");
  await threads.filter({ hasText: "Moonlit Blade" }).getByRole("link").click();
  await page.getByRole("tab", { name: "Settings" }).click();
  await page.getByTestId("thread-delete").click();
  await Promise.all([page.waitForURL((url) => url.pathname === "/"), page.getByRole("button", { name: "Delete thread" }).click()]);
  await expect(threads).toHaveCount(1);

  // Phone-sized smoke.
  const phone = await (await runtime.context("member", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  await phone.goto("/");
  await expect(phone.getByRole("heading", { level: 1 })).toHaveText("Library");
  await expect(phone.getByTestId("new-thread")).toBeVisible();

  // The reader with a finished chapter, for the public picture.
  await page.goto(chapterOneUrl);
  await expect(page.getByTestId("chapter-translation")).toContainText("Lin Feng stood before the gate");
  await runtime.assertBackLink(page);
  await runtime.screenshot(page);
  console.log("behavior: ok");
} finally {
  await runtime.close();
}
