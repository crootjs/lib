# CrootJS Project Instructions

This project uses [CrootJS](https://github.com/crootjs/lib) — vanilla ES6+ JavaScript modules imported straight from jsDelivr, no npm, no bundler. Follow these rules whenever you write, edit, or generate code in this project.

## Mandatory: separate HTML, CSS, and JS

- **No inline `<style>` blocks.** CSS goes in its own `.css` file, linked with `<link rel="stylesheet" href="...">`.
- **No inline `<script>` blocks with logic.** JS goes in its own `.js` file.
- **No inline `style="..."` attributes.** Use a class defined in the CSS file instead.
- **No inline event handler attributes** (`onclick`, `onchange`, `oninput`, etc). Attach listeners in JS with `addEventListener`, or with CrootJS's own helpers (`onClick`, `onChange`, `onInput` from `element.js`).
- **Every JS file must be loaded as an ES module**: `<script type="module" src="script.js"></script>` — never a plain classic script with inline logic.

Exception: a third-party library's own CDN `<script src="...">` tag (e.g. Lucide, SweetAlert2) is fine — that's an external dependency, not inline application code.

## Importing CrootJS

- Always import from a pinned version tag: `https://cdn.jsdelivr.net/gh/crootjs/lib@<version>/<module>.js`. Never `@latest` in committed code.
- Import only the specific module file(s) you use (e.g. `cookie.js`, `api.js`), not the whole library.
- For production, import the `.min.js` variant instead of `.js` — jsDelivr auto-minifies any file on request (via Terser), even though no `.min.js` is committed to this repo: `https://cdn.jsdelivr.net/gh/crootjs/lib@<version>/cookie.min.js`. Use the unminified `.js` only when actively reading/debugging the source.
- `api.js` callback functions are NOT `(url, ..., responseFunction)` uniformly — check the exact parameter position per function (`getJSON(url, responseFunction, tokenkey?, tokenvalue?)` vs `postJSON(url, data, responseFunction, tokenkey?, tokenvalue?)`) before writing a call.
- `websocket.js`'s `openWebSocketSetId` is Promise-based (asynchronous) — it does not return a `WebSocket` synchronously.

## Reference

- Full API reference (per module): https://croot.js.org/docs/
- Coding conventions & rationale: https://croot.js.org/docs/conventions
- Source: https://github.com/crootjs/lib (rendered README: https://croot.js.org/lib/)
- Working examples: https://github.com/crootjs/examples (live: https://croot.js.org/examples/)
- Machine-readable module summary: https://croot.js.org/llms.txt
