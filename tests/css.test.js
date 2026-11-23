import { describe, test, assert } from "./runner.js";

// croot.css dimuat di iframe sendiri, supaya gayanya tidak mengubah halaman uji.
async function frameWithCSS(html, theme) {
    const frame = document.createElement("iframe");
    frame.className = "fixtures";
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    doc.open();
    doc.write(`<!DOCTYPE html><html${theme ? ` data-theme="${theme}"` : ""}><head></head><body>${html}</body></html>`);
    doc.close();
    const link = doc.createElement("link");
    link.rel = "stylesheet";
    link.href = new URL("../croot.css", location.href).href;
    await new Promise((resolve, reject) => {
        link.onload = resolve;
        link.onerror = () => reject(new Error("croot.css tidak termuat"));
        doc.head.appendChild(link);
    });
    return { frame, doc, style: element => frame.contentWindow.getComputedStyle(element) };
}

describe("croot.css", () => {
    test("tombol memakai warna aksen; data-theme=dark mengganti warna", async () => {
        const light = await frameWithCSS('<button id="b">OK</button>', "light");
        const dark = await frameWithCSS('<button id="b">OK</button>', "dark");
        assert.equal(light.style(light.doc.getElementById("b")).backgroundColor, "rgb(21, 128, 61)");
        assert.equal(dark.style(dark.doc.body).backgroundColor, "rgb(15, 23, 42)");
        light.frame.remove();
        dark.frame.remove();
    });
    test("CSS halaman tanpa layer selalu menang", async () => {
        const page = await frameWithCSS('<button id="b">OK</button>', "light");
        const own = page.doc.createElement("style");
        own.textContent = "button { background-color: rgb(1, 2, 3); }";
        page.doc.head.appendChild(own);
        assert.equal(page.style(page.doc.getElementById("b")).backgroundColor, "rgb(1, 2, 3)");
        page.frame.remove();
    });
    test("--croot-gap tidak diwariskan ke .grid di dalamnya", async () => {
        const page = await frameWithCSS('<div class="stack" id="s"><div class="grid" id="g"><p>a</p><p>b</p></div></div>', "light");
        page.doc.getElementById("s").style.setProperty("--croot-gap", "48px");
        assert.equal(page.style(page.doc.getElementById("s")).rowGap, "48px");
        assert.equal(page.style(page.doc.getElementById("g")).rowGap, "16px");
        page.frame.remove();
    });
});
