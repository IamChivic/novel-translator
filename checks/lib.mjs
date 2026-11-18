// Shared pieces of the release checks: a stand-in AI provider behind the
// Gateway binding, the sample chapters, and small page helpers.
import { expect } from "/home/user/oss-new/control/runtime/index.mjs";

export const CHAPTER_ONE =
  "第一章 青云宗\n\n晨钟响起时，林风站在青云宗的山门前。\n\n师兄在石阶上向他挥手。“你回来了。”林风只是点了点头。\n\n三年过去，青云宗一点也没有变。";
export const CHAPTER_TWO =
  "第二章 山上的灯笼\n\n那天夜里，灯笼照亮了山路。林风独自走向青云宗的藏经阁。";

const REPLIES = {
  one: {
    title: "Chapter 1: The Gate of the Azure Cloud Sect",
    translation:
      "Lin Feng stood before the gate of the Azure Cloud Sect as the morning bell rang.\n\nHis Senior Brother waved from the stone steps. \"You came back,\" he said. Lin Feng only nodded.\n\nThree years had passed, and the Azure Cloud Sect had not changed at all.",
    terms: [
      { original: "林风", translation: "Lin Feng", gender: "male", note: "The returning disciple" },
      { original: "青云宗", translation: "Azure Cloud Sect", gender: "none", note: "" },
      { original: "师兄", translation: "Elder Brother", gender: "male", note: "" },
    ],
  },
  two: {
    title: "Chapter 2: Lanterns on the Mountain",
    translation:
      "That night, lanterns lit the mountain path. Lin Feng climbed alone toward the Scripture Library of the Azure Cloud Sect.",
    terms: [{ original: "藏经阁", translation: "Scripture Library", gender: "none", note: "" }],
  },
};

// An OpenAI-compatible chat endpoint, reached the way the app reaches its
// provider: over the EVERY_APP_GATEWAY binding. It records each request.
const FAKE_GATEWAY = `const calls = [];
const replies = ${JSON.stringify(REPLIES)};
export default { async fetch(request) {
  const url = new URL(request.url);
  if (url.pathname === "/__calls") return Response.json(calls);
  if (request.method === "POST" && url.pathname.endsWith("/chat/completions")) {
    const body = await request.json();
    calls.push({ path: url.pathname, body });
    const text = body.messages.map((m) => m.content).join("\\n");
    const reply = text.includes("第二章") ? replies.two : replies.one;
    return Response.json({ id: "chat-1", object: "chat.completion", model: body.model,
      choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: JSON.stringify(reply) } }] });
  }
  return Response.json({ error: "not found" }, { status: 404 });
} };`;

export const withFakeAi = {
  bindings: { EVERY_APP_GATEWAY: { type: "worker", worker: "fake-gateway" } },
  workers: [
    {
      config: {
        name: "fake-gateway",
        compatibilityDate: "2025-01-01",
        manifest: { mainModule: "fake.mjs", modules: { "fake.mjs": { type: "esm", contents: FAKE_GATEWAY } } },
      },
    },
  ],
};

export async function aiCalls(runtime) {
  const worker = await runtime.mf.getWorker("fake-gateway");
  const response = await worker.fetch("http://fake-gateway/__calls");
  return response.json();
}

/** The prompt of a recorded call, every message joined. */
export function promptOf(call) {
  return call.body.messages.map((m) => m.content).join("\n");
}

/** Picks an option of a Base UI select by its trigger's test id. */
export async function choose(page, testId, optionName) {
  await page.getByTestId(testId).click();
  await page.getByRole("option", { name: optionName, exact: true }).click();
  await expect(page.getByTestId(testId)).toContainText(optionName);
}

/** Opens a row's actions menu and clicks one item. */
export async function rowAction(page, label, item) {
  await page.getByRole("button", { name: `Actions for ${label}`, exact: true }).click();
  await page.getByRole("menuitem", { name: item, exact: true }).click();
}
