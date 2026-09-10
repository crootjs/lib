# lib

[← croot.js.org](https://croot.js.org/) · [docs](https://croot.js.org/docs/) · [examples](https://croot.js.org/examples/)

Library CrootJS

## Usage (via jsDelivr)

Import any module straight from jsDelivr's GitHub CDN — no `npm install`, no build step:

```js
import { getJSON, postJSON } from "https://cdn.jsdelivr.net/gh/crootjs/lib@0.0.5/api.js";
```

- **Pin an exact version tag** (`@0.0.5`) — check current tags at https://github.com/crootjs/lib/tags. Never use `@latest` in committed code; it can change under you without warning.
- **Use `.min.js` in production** — jsDelivr auto-minifies any file on request via Terser, even though no `.min.js` is committed to this repo: `.../lib@0.0.5/api.min.js`. Use the unminified `.js` only when actively reading/debugging.
- **Import only what you use** — each file is independent (`cookie.js`, `url.js`, `validate.js`, ...); there's no single "import everything" entry point, so your page only loads the code it needs.

Full per-module API reference: https://croot.js.org/docs/

## Coding Conventions (Mandatory)

Projects using CrootJS must keep HTML, CSS, and JS in separate files, and load JS as `<script type="module">` — no inline `<style>`/`<script>` blocks or `onclick`/`style=""` attributes. Full rules: https://croot.js.org/docs/conventions

Using an AI coding agent? Drop [`CLAUDE.md`](CLAUDE.md) (in this repo) into your project root — Claude Code picks it up automatically.

## Release Tag
```sh
git tag                                 #check current version
git tag v0.0.3                          #set tag version
git push origin --tags                  #push tag version to repo
```
