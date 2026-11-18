import { describe, expect, it } from "vitest";
import {
  buildMessages,
  extractChapter,
  parseReply,
  replaceWording,
  termsForPrompt,
  withCurrentWording,
} from "./text";

describe("extractChapter", () => {
  it("reads the title, the body and the next link", () => {
    const html = `<html><head><title>Site</title><script>var x = "第一";</script></head><body>
      <nav><a href="/">首页</a></nav>
      <h1>第一章 山门</h1>
      <div class="ads">广告</div>
      <div id="chapter-content"><p>晨钟响起。</p><p>林风站在山门前。&nbsp;</p><div><p>他笑了。</p></div></div>
      <div class="pager"><a href="/book/1">上一章</a><a href="/book/3">目录</a><a href="./2.html">下一章</a></div>
    </body></html>`;
    const chapter = extractChapter(html, "https://example.test/book/1.html");
    expect(chapter.title).toBe("第一章 山门");
    expect(chapter.text).toBe("晨钟响起。\n\n林风站在山门前。\n\n他笑了。");
    expect(chapter.nextUrl).toBe("https://example.test/book/2.html");
  });

  it("takes rel=next and br-separated text", () => {
    const html = `<body><h1>第3話</h1><div class="novel_body">朝が来た。<br>彼は歩いた。<br/></div>
      <a rel="next" href="https://example.test/n/4">→</a></body>`;
    const chapter = extractChapter(html, "https://example.test/n/3");
    expect(chapter.text).toBe("朝が来た。\n\n彼は歩いた。");
    expect(chapter.nextUrl).toBe("https://example.test/n/4");
  });

  it("finds nothing on a page without the languages", () => {
    const chapter = extractChapter("<body><p>Access denied</p></body>", "https://example.test/");
    expect(chapter.text).toBe("");
    expect(chapter.nextUrl).toBeNull();
  });

  it("finds a Korean next link", () => {
    const html = `<body><div class="content"><p>그는 웃었다.</p></div><a href="/ep/9">다음화</a></body>`;
    expect(extractChapter(html, "https://example.test/ep/8").nextUrl).toBe("https://example.test/ep/9");
  });
});

describe("prompt", () => {
  const terms = [
    { original: "林风", translation: "Lin Feng", gender: "male", note: "", alwaysUse: false, excluded: false },
    { original: "青云宗", translation: "Azure Cloud Sect", gender: "none", note: "A sect", alwaysUse: true, excluded: false },
    { original: "藏经阁", translation: "Library", gender: "none", note: "", alwaysUse: false, excluded: false },
    { original: "师兄", translation: "Senior Brother", gender: "none", note: "", alwaysUse: true, excluded: true },
  ];

  it("sends terms in the text and always-use ones, never excluded ones", () => {
    const chosen = termsForPrompt(terms, "林风来了。师兄也来了。");
    expect(chosen.map((term) => term.original)).toEqual(["林风", "青云宗"]);
    const [system] = buildMessages({ title: "", text: "林风", terms: chosen, instruction: "Be terse." });
    expect(system!.content).toContain("- 林风 → Lin Feng [male]");
    expect(system!.content).toContain("- 青云宗 → Azure Cloud Sect (mandatory) — A sect");
    expect(system!.content).toContain("Be terse.");
    expect(system!.content).not.toContain("师兄");
  });
});

describe("parseReply", () => {
  it("reads fenced JSON", () => {
    const reply = parseReply('```json\n{"title":"One","translation":"Hello.","terms":[{"original":"林风","translation":"Lin Feng","gender":"Male"},{"original":"","translation":"x"}]}\n```');
    expect(reply).toEqual({
      title: "One",
      translation: "Hello.",
      terms: [{ original: "林风", translation: "Lin Feng", gender: "male", note: "" }],
    });
  });

  it("keeps plain text as the translation", () => {
    expect(parseReply("Just text.")).toEqual({ title: "", translation: "Just text.", terms: [] });
  });
});

describe("glossary wording", () => {
  it("keeps the case each occurrence was written in", () => {
    expect(replaceWording("The Azure Sect. AZURE SECT! azure sect, Azure Sector", "Azure Sect", "Blue Sect")).toBe(
      "The Blue Sect. BLUE SECT! blue sect, Azure Sector",
    );
  });

  it("swaps only changed terms, longest first, in one pass", () => {
    const text = "Lin Feng met Lin at the Azure Cloud Sect.";
    const used = { 林风: "Lin Feng", 林: "Lin", 青云宗: "Azure Cloud Sect" };
    const current = [
      { original: "林风", translation: "Lin Wind" },
      { original: "林", translation: "Lynn" },
      { original: "青云宗", translation: "Azure Cloud Sect" },
    ];
    expect(withCurrentWording(text, used, current)).toBe("Lin Wind met Lynn at the Azure Cloud Sect.");
  });
});
