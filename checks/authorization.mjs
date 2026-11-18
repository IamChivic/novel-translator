// Authorization: private pages, one member's threads kept from another,
// share links exposing only what they should, and no sign-in of the app's own.
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { CHAPTER_ONE, choose, withFakeAi } from "./lib.mjs";

const runtime = await startRuntime(withFakeAi);
try {
  await runtime.assertPrivateAccess(["/", "/translate", "/defaults"]);

  // The owner translates a chapter into a private thread.
  const ownerPage = await (await runtime.context("owner")).newPage();
  await ownerPage.goto("/translate");
  await ownerPage.getByTestId("source-input").fill(CHAPTER_ONE);
  await choose(ownerPage, "destination-select", "New thread");
  await ownerPage.getByTestId("new-thread-name").fill("Owner's private novel");
  await Promise.all([ownerPage.waitForURL(/\/chapters\//), ownerPage.getByTestId("translate-button").click()]);
  const chapterPath = new URL(ownerPage.url()).pathname;
  const threadPath = chapterPath.replace(/\/chapters\/.*$/, "");
  const threadId = threadPath.split("/")[2];

  // Capture the owner's own rename call, to replay it as someone else.
  await ownerPage.goto(`${threadPath}?tab=settings`);
  await ownerPage.getByTestId("thread-name").fill("Owner's private novel");
  const [renameCall] = await Promise.all([
    ownerPage.waitForRequest((request) => request.method() === "POST" && request.url().includes("/_serverFn/")),
    ownerPage.getByTestId("thread-save").click(),
  ]);
  await expect(ownerPage.getByTestId("thread-saved")).toBeVisible();
  const serverFnPath = new URL(renameCall.url()).pathname + new URL(renameCall.url()).search;
  const forgedBody = renameCall.postData().replace("Owner's private novel", "Taken over");
  const headers = { ...renameCall.headers() };
  delete headers.cookie;

  // Another member sees none of it and can change none of it.
  const memberPage = await (await runtime.context("member")).newPage();
  await memberPage.goto("/");
  await expect(memberPage.getByText("Owner's private novel")).toHaveCount(0);
  await memberPage.goto(threadPath);
  await expect(memberPage.getByTestId("not-found")).toBeVisible();
  await expect(memberPage.getByText("Owner's private novel")).toHaveCount(0);
  await memberPage.goto(chapterPath);
  await expect(memberPage.getByTestId("not-found")).toBeVisible();
  await expect(memberPage.getByText("Lin Feng")).toHaveCount(0);
  await memberPage.goto("/translate");
  await memberPage.getByTestId("destination-select").click();
  await expect(memberPage.getByRole("option", { name: "Owner's private novel" })).toHaveCount(0);
  await memberPage.keyboard.press("Escape");

  const forged = await runtime.fetch(serverFnPath, { role: "member", method: "POST", headers, body: forgedBody });
  // Server functions answer 200 with the serialized error; the refusal is in the body.
  expect(await forged.text()).toContain("Thread not found");
  for (const role of [undefined, "outsider"]) {
    const refused = await runtime.fetch(serverFnPath, { role, method: "POST", headers, body: forgedBody });
    expect([401, 403, 404]).toContain(refused.status);
  }
  const db = await runtime.database();
  const row = await db.prepare("SELECT name FROM threads WHERE id = ?").bind(threadId).first();
  expect(row.name).toBe("Owner's private novel");
  await ownerPage.goto(threadPath);
  await expect(ownerPage.getByRole("heading", { level: 1 })).toHaveText("Owner's private novel");

  // Share links: unknown tokens are not found, and only the owner makes one.
  for (const path of ["/share-api/not-a-real-token", "/s/not-a-real-token"]) {
    expect((await runtime.fetch(path)).status).toBe(404);
  }
  await ownerPage.goto(`${threadPath}?tab=settings`);
  await ownerPage.getByTestId("share-create").click();
  const token = new URL(await ownerPage.getByTestId("share-url").inputValue()).pathname.split("/")[2];
  const shared = await runtime.fetch(`/share-api/${token}`);
  expect(shared.status).toBe(200);
  const body = await shared.json();
  expect(Object.keys(body).sort()).toEqual(["chapters", "name"]);
  for (const chapter of body.chapters) expect(Object.keys(chapter).sort()).toEqual(["id", "title"]);
  const one = await (await runtime.fetch(`/share-api/${token}/${body.chapters[0].id}`)).json();
  expect(Object.keys(one).sort()).toEqual(["nextId", "previousId", "title", "translation"]);
  // A chapter of another thread is not reachable through this token.
  expect((await runtime.fetch(`/share-api/${token}/${threadId}`)).status).toBe(404);
  // Anonymous visitors still can't reach the private pages behind it.
  expect([401, 403]).toContain((await runtime.fetch(threadPath)).status);
  expect([401, 403]).toContain((await runtime.fetch(chapterPath)).status);
  // Share routes take reads only.
  expect((await runtime.fetch(`/share-api/${token}`, { method: "POST", body: "{}" })).status).not.toBe(200);

  // No sign-in of the app's own.
  for (const path of ["/login", "/signin", "/signup", "/logout", "/register"]) {
    const response = await runtime.fetch(path, { role: "owner" });
    expect(response.status).toBe(404);
  }
  await ownerPage.goto("/");
  await expect(ownerPage.locator('input[type="password"]')).toHaveCount(0);
  // This app has no admin-only actions: the owner role sees only its own threads too.
  await memberPage.goto(`${threadPath}?tab=settings`);
  await expect(memberPage.getByTestId("not-found")).toBeVisible();
  console.log("authorization: ok");
} finally {
  await runtime.close();
}
