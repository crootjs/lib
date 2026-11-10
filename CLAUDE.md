# CrootJS Project Instructions

This project uses [CrootJS](https://github.com/crootjs/lib) — vanilla ES6+ JavaScript modules imported straight from jsDelivr, no npm, no bundler. Follow these rules whenever you write, edit, or generate code in this project.

## Mandatory: separate HTML, CSS, and JS

- **No inline `<style>` blocks.** CSS goes in its own `.css` file, linked with `<link rel="stylesheet" href="...">`.
- **No inline `<script>` blocks with logic.** JS goes in its own `.js` file.
- **No inline `style="..."` attributes.** Use a class defined in the CSS file instead.
- **No inline event handler attributes** (`onclick`, `onchange`, `oninput`, etc). Attach listeners in JS with `addEventListener`, or with CrootJS's own helpers (`onClick`, `onChange`, `onInput` from `element.js`).
- **Every JS file must be loaded as an ES module**: `<script type="module" src="script.js"></script>` — never a plain classic script with inline logic.

Exception: a third-party library's own CDN `<script src="...">` tag (e.g. Lucide, SweetAlert2) is fine — that's an external dependency, not inline application code.

## Mandatory: no AI slop

- **Never invent an API.** Check every CrootJS function name, parameter order, and option against https://croot.js.org/llms.txt (or the module's docs page) for the pinned version before using it. If it doesn't exist, write the code explicitly instead of guessing.
- **Use CrootJS instead of re-implementing it** (`api.js` requests, `element.js` DOM helpers, `map.js` maps, `model3d.js` 3D, `toast.js` notifications), and don't add libraries that duplicate it (Leaflet, Three.js, axios, jQuery).
- **No dead weight:** no unused imports/variables/functions, commented-out code, `TODO` stubs, or files that aren't needed.
- **Comments explain why, not what** — no line-by-line narration.
- **No fake content:** no lorem ipsum, invented statistics, testimonials, or marketing claims; label sample data as sample.
- **Handle only errors that can happen**, following each function's contract (`api.js` reports network failure as `status: 0`); no `try/catch` that swallows errors.
- **Stay in scope:** don't rename, reformat, or restyle code the task doesn't touch.
- **Real HTML:** `<button>` for buttons, `<label>` for inputs, keyboard- and phone-friendly; no decoration nobody asked for.
- **Verify before saying "done":** run the page through a local server, check the console for errors, try the feature at phone width; say what you did not test.
- For editor autocomplete on CDN imports, copy [`crootjs.d.ts`](https://github.com/crootjs/lib/blob/main/crootjs.d.ts) next to your `jsconfig.json`.

## Importing CrootJS

- Always import from a pinned version tag: `https://cdn.jsdelivr.net/gh/crootjs/lib@<version>/<module>.js`. Never `@latest` in committed code.
- Import only the specific module file(s) you use (e.g. `cookie.js`, `api.js`), not the whole library.
- For production, import the `.min.js` variant instead of `.js` — jsDelivr auto-minifies any file on request (via Terser), even though no `.min.js` is committed to this repo: `https://cdn.jsdelivr.net/gh/crootjs/lib@<version>/cookie.min.js`. Use the unminified `.js` only when actively reading/debugging the source.
- `api.js` callback functions are NOT `(url, ..., responseFunction)` uniformly — check the exact parameter position per function (`getJSON(url, responseFunction, tokenkey?, tokenvalue?)` vs `postJSON(url, data, responseFunction, tokenkey?, tokenvalue?)`) before writing a call. `getJSON`/`postJSON`/`putJSON`/`deleteJSON` also return a Promise of the same `{ status, data }`, so `responseFunction` may be `null` with `await`; the Promise never rejects (network failure = `status: 0`).
- `websocket.js`'s `openWebSocketSetId` is Promise-based (asynchronous) — it does not return a `WebSocket` synchronously.

## Reference

- Full API reference (per module): https://croot.js.org/docs/
- Coding conventions & rationale: https://croot.js.org/docs/conventions
- Source: https://github.com/crootjs/lib (rendered README: https://croot.js.org/lib/)
- Working examples: https://github.com/crootjs/examples (live: https://croot.js.org/examples/)
- Machine-readable module summary: https://croot.js.org/llms.txt
