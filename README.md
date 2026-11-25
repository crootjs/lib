# lib

[← croot.js.org](https://croot.js.org/) · [docs](https://croot.js.org/docs/) · [examples](https://croot.js.org/examples/)

Library CrootJS

## Usage (via jsDelivr)

Import any module straight from jsDelivr's GitHub CDN — no `npm install`, no build step:

```js
import { getJSON, postJSON } from "https://cdn.jsdelivr.net/gh/crootjs/lib@0.0.42/api.js";
```

- **Pin an exact version tag** (`@0.0.5`) — check current tags at https://github.com/crootjs/lib/tags. Never use `@latest` in committed code; it can change under you without warning.
- **Use `.min.js` in production**: `.../lib@0.0.42/api.min.js`. Since 0.0.38 every release tag contains `.min.js` files built by [`tools/build-min.py`](tools/build-min.py) (Terser, with source maps) whose imports point to the `.min.js` of their sibling modules; `main` itself holds only the source. **Don't mix `.js` and `.min.js` of the same version on one page**: `api.js` and `api.min.js` are different module URLs, so a page that imports `api.min.js` and `storage.js` loads two copies of `storage`, each with its own state. Up to 0.0.37 the `.min.js` files came from jsDelivr's own minifier, which kept imports like `"./storage.js"`, so `.min.js` pages still loaded some `.js` siblings.
- **Lock file contents (SRI):** since 0.0.42 every release has `integrity.json` with the sha384 hash of each `.js`, `.min.js`, `.css` and (since 0.0.43, built by us instead of jsDelivr) `.min.css`. Put them in an import map installed by a small classic `integrity.js` (Chromium, Firefox and Safari then refuse a changed module), and bump versions and hashes together with [`tools/bump-pins.py`](tools/bump-pins.py). See https://croot.js.org/docs/en/#locking-file-contents-with-integrity-sri.
- **Styling (optional):** `croot.css` gives plain HTML a finished look with no classes, plus a few layout classes and components, in about 2 KB: `<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/crootjs/lib@0.0.42/croot.min.css">`. See https://croot.js.org/docs/css. Optional icons: `icons.min.css` (49 hand-drawn icons, about 1.9 KB gzipped).
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

or online at https://croot.js.org/lib/tests/. CI runs the same page headless in Chromium, Firefox, and WebKit on every push and tag ([`.github/workflows/test.yml`](.github/workflows/test.yml)); to do that locally: `pip install playwright && python -m playwright install chromium && python tests/run.py` (add `firefox` or `webkit` to pick another browser). The 3D tests need WebGL, which headless Firefox doesn't provide without a GPU, so they show as skipped there; Chromium and WebKit run all of them.

Changes per version: [CHANGELOG.md](CHANGELOG.md).

## Editor autocomplete

Copy [`crootjs.d.ts`](crootjs.d.ts) into your project (next to a `jsconfig.json`). VS Code then knows every module imported straight from jsDelivr — any version, `.js` or `.min.js` — and shows parameter names, order, and the docs comment of each function. Since 0.0.38 the `api.js` options object is typed too (`getJSON(url, null, { cache: { key, ttl, staleIfError, select } })` autocompletes), and `getJSON<T>()` types `data`. It is generated from the source: `python3 tools/build-types.py`.

## Releasing

1. For a feature or anything worth explaining, add a section at the top of [CHANGELOG.md](CHANGELOG.md) yourself: `## [x.y.z](https://github.com/crootjs/lib/releases/tag/vx.y.z) - YYYY-MM-DD`, a bold title line, then the notes, and regenerate the type declarations (`python3 tools/build-types.py`). For a small fix you can skip this: when a push changes module code (`*.js`/`*.css` in the top folder) and the newest CHANGELOG version already has a tag, the workflow bumps the patch version itself ([`tools/auto-version.py`](tools/auto-version.py)), writes the CHANGELOG section from the commit subjects (so write clear ones), regenerates `crootjs.d.ts`, and commits both to `main`. Pushes that only touch docs, tests, tools or workflows never create a version.
2. A hand-written CHANGELOG section always wins over the automatic one.
3. Push to `main`. The workflow runs the tests; if they pass and the newest CHANGELOG version has no tag yet, it builds the `.min.js` and `.min.css` files and `integrity.json` ([`tools/build-min.py`](tools/build-min.py)) into a release commit on the `dist` branch (parents: this `main` commit and the previous `dist` tip), creates the tag `vx.y.z` on it, and creates the GitHub Release from that section ([`tools/release.py`](tools/release.py)). Pushes that don't add a version (docs, pin bumps) create nothing.
4. After a new release the workflow waits until jsDelivr serves `lib@x.y.z` (including `.min.js`), bumps the pins in this README, writes the version to [`version.json`](version.json) (served at https://croot.js.org/lib/version.json and shown on the landing page), and sends a `lib-released` repository dispatch to [docs](https://github.com/crootjs/docs), [examples](https://github.com/crootjs/examples) and [crootjs.github.io](https://github.com/crootjs/crootjs.github.io). Each of them bumps its own pins ([`tools/bump-pins.py`](tools/bump-pins.py), which also updates `integrity` hashes) and rebuilds GitHub Pages; the landing page then waits for docs and examples to go live, rebuilds `sitemap.xml` and `llms-full.txt`, runs the tests at https://croot.js.org/lib/tests/, and sends a Telegram notification.

Docs and example pages for a new feature can be pushed together with the lib change: their pins are raised automatically once the version is on jsDelivr.

One-time setup for step 4: a fine-grained personal access token (resource owner `crootjs`) with **Contents: read and write** on `crootjs/docs`, `crootjs/examples` and `crootjs/crootjs.github.io`, stored as the secret `CROOTJS_DISPATCH_TOKEN` in this repo; and, optionally, the secrets `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in `crootjs/crootjs.github.io`. Without the token, step 4 stops after `version.json` with a warning; then run `bump-pins` (docs, examples) and `release` (crootjs.github.io) from the Actions tab. Left empty, their version is read from `version.json`.

Tagging by hand (`git tag vx.y.z && git push origin vx.y.z`) also works; the workflow then only adds the missing release, without step 4.
