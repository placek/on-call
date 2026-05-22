# Contributing

Thanks for thinking about contributing to **on-call**. This is a small hobby project, but bug reports, balance ideas, and PRs are all welcome.

## Ground rules

- By submitting a contribution you agree it is licensed under the project's [MIT License](LICENSE).
- Be kind. Assume good intent.
- One change per PR. Smaller PRs land faster.

## Getting set up

Prerequisites: Node 20+ and npm.

```bash
git clone <your-fork-url>
cd oncall
npm install
npm run dev          # serves on http://localhost:5173
```

Other useful scripts:

```bash
npm run build        # production build into dist/
npm run preview      # serves the production build locally
```

The project is a single-page React app built with Vite. There is no test suite — the build (`npm run build`) is the only check that runs in CI.

## Project layout

```
src/
  on_call.jsx    Main game component (state, gameplay, UI)
  content.js    Generated content: tickets, fix variants, hostname tokens
  main.jsx      React entry point
index.html       App shell + theme bootstrap script
vite.config.js   Build + dev-server config (BASE_PATH-aware for GitHub Pages)
.github/workflows/deploy.yml   Auto-deploys to GitHub Pages on push to main/master
README.md        Mirror of the in-game readme — keep both in sync if you change rules
```

## Reporting bugs

Open an issue with:

- What you expected.
- What happened instead.
- Steps to reproduce — even rough ones.
- Browser + OS if it looks rendering-related.
- A screenshot helps.

## Suggesting changes

Game-balance and rule changes are welcome but please open an issue first so we can talk through it before you write code. Pure flavor additions (new ticket lines, fix descriptions, hostname tokens in `src/content.js`) can go straight to a PR — adding variety is always good.

## Pull requests

1. Fork and branch off `master` (or `main`).
2. Make your change. Keep the diff focused.
3. Run `npm run build` locally and make sure it passes.
4. If you changed gameplay rules, update **both** the in-game readme in `src/on_call.jsx` (the `IntroScreen` component) **and** `README.md`. The two are intentionally identical.
5. Open the PR with a short description of what changed and why. Screenshots for UI changes are appreciated.

## Code style

- No formal linter is configured. Match the surrounding style.
- Prefer editing existing files over creating new ones unless there's a clear separation.
- Comments are sparse on purpose — add one only when the *why* is non-obvious. Don't narrate *what* the code does.
- The color palette is exposed as CSS variables via the `C` object. Use `C.foo` instead of raw hex so theming keeps working.

## Questions

Open a GitHub Discussion or a draft issue. There's no chat room.
