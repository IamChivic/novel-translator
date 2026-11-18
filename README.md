# Novel Translator

Translates web-novel chapters written in Chinese, Japanese or Korean into English. Each novel gets its own thread with its chapters, a glossary that keeps names consistent, and a reader.

Inspired by https://app.readomni.com

Built with [oss.new](https://oss.new) for [EveryApp](https://github.com/every-app/every-app).

## Features

- Paste a chapter link or its text, pick a model and a thread, and get an English translation.
- Keep a library of novels with status, tags and a private note; search, filter and sort it.
- Read chapters with the original alongside, in your own text size, width and font, and move through them in order.
- Keep a glossary per novel that fills itself from each translation and that you can edit, exclude from or reset.
- Set default terms and a default style instruction, and give any novel its own instruction.
- Share a read-only link to a novel's translated chapters, and revoke it.

Left out: accounts and sign-in, which your Gateway handles; mobile apps and the browser extension; plans and credits; batch translation, importing and EPUB export; a public novel catalogue; advanced glossary tools.

## Setup

```sh
pnpm install
pnpm dev            # run locally
pnpm test           # unit tests
pnpm run deploy     # deploy behind your EveryApp Gateway
```

The app has no secrets or settings of its own. Translation uses the Gateway's OpenRouter provider: add a key with `pnpm everyapp provider add openrouter` (keys at https://openrouter.ai/keys). Without one, everything except translating works. Locally, put `OPENROUTER_API_KEY` in `.dev.vars`.

The release checks in `checks/` run against a packaged build with a stand-in model.

## Limitations

- Each translation runs while you wait; long chapters can take a minute.
- Sites that block automated requests or need a login can't be read by link: paste the text instead.
- Only the four models in the model list can be picked.
- Translation through a real OpenRouter key was not exercised by the local checks.
