# lib

[← croot.js.org](https://croot.js.org/) · [docs](https://croot.js.org/docs/) · [examples](https://croot.js.org/examples/)

Library CrootJS

## Usage (via jsDelivr)

Import any module straight from jsDelivr's GitHub CDN — no `npm install`, no build step:

```js
import { getJSON, postJSON } from "https://cdn.jsdelivr.net/gh/crootjs/lib@0.0.28/api.js";
```

- **Pin an exact version tag** (`@0.0.5`) — check current tags at https://github.com/crootjs/lib/tags. Never use `@latest` in committed code; it can change under you without warning.
- **Use `.min.js` in production** — jsDelivr auto-minifies any file on request via Terser, even though no `.min.js` is committed to this repo: `.../lib@0.0.28/api.min.js`. Use the unminified `.js` only when actively reading/debugging.
- **Import only what you use** — each file is independent (`cookie.js`, `url.js`, `validate.js`, ...); there's no single "import everything" entry point, so your page only loads the code it needs.

Full per-module API reference: https://croot.js.org/docs/

## Coding Conventions (Mandatory)

Projects using CrootJS must keep HTML, CSS, and JS in separate files, and load JS as `<script type="module">` — no inline `<style>`/`<script>` blocks or `onclick`/`style=""` attributes. Full rules: https://croot.js.org/docs/conventions

Using an AI coding agent? Drop [`CLAUDE.md`](CLAUDE.md) (in this repo) into your project root — Claude Code picks it up automatically.

## Tests

[`tests/`](tests/) runs the modules in a real browser — no npm. Open it through any local server:

```sh
python3 -m http.server      # from this folder, then open http://localhost:8000/tests/
```

or online at https://croot.js.org/lib/tests/. CI runs the same page headless on every push and tag ([`.github/workflows/test.yml`](.github/workflows/test.yml)); to do that locally: `pip install playwright && python -m playwright install chromium && python tests/run.py`.

Changes per version: [CHANGELOG.md](CHANGELOG.md).

## Editor autocomplete

Copy [`crootjs.d.ts`](crootjs.d.ts) into your project (next to a `jsconfig.json`). VS Code then knows every module imported straight from jsDelivr — any version, `.js` or `.min.js` — and shows parameter names, order, and the docs comment of each function. It is generated from the source: `python3 tools/build-types.py`.

## Releasing

1. Add a section at the top of [CHANGELOG.md](CHANGELOG.md): `## [x.y.z](https://github.com/crootjs/lib/releases/tag/vx.y.z) - YYYY-MM-DD`, a bold title line, then the notes.
2. Regenerate the type declarations: `python3 tools/build-types.py`.
3. Push to `main`. The workflow runs the tests; if they pass and the newest CHANGELOG version has no tag yet, it creates the tag `vx.y.z` and the GitHub Release from that section ([`tools/release.py`](tools/release.py)). Pushes that don't add a version (docs, pin bumps) create nothing.

Tagging by hand (`git tag vx.y.z && git push origin vx.y.z`) also works; the workflow then only adds the missing release.
