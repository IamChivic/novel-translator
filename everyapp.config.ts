import { defineEveryApp } from "@every-app/sdk";

export default defineEveryApp({
  id: "novel-translator",
  name: "Novel Translator",
  description:
    "Translates Chinese, Japanese and Korean web-novel chapters into English, with a glossary per novel and a reader.",
  resources: {
    d1: ["DB"],
  },
  // Share links: anyone with a thread's link reads its finished chapters.
  // Each route checks the token itself and answers 404 for anything else.
  public: [
    { path: "/s/:token", methods: ["GET"] },
    { path: "/s/:token/:chapterId", methods: ["GET"] },
    { path: "/share-api/:token", methods: ["GET"] },
    { path: "/share-api/:token/:chapterId", methods: ["GET"] },
  ],
  // The scripts, styles and icon the share pages load.
  publicAssets: ["/assets/**", "/icon.svg"],
  providers: [
    {
      id: "openrouter",
      why: "Translates chapters with the model each person picks.",
      docs: "https://openrouter.ai/keys",
    },
  ],
  // The models a person can pick (src/shared/options.ts); the Gateway refuses others.
  ai: {
    models: [
      "deepseek/deepseek-chat-v3.1",
      "google/gemini-2.5-flash",
      "openai/gpt-4.1-mini",
      "anthropic/claude-sonnet-4.5",
    ],
  },
  features: {
    translation: {
      name: "Translation",
      why: "Without it the library, glossaries and reader work, but no new chapters are translated.",
      providers: ["openrouter"],
    },
  },
});
