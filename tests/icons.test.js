import { describe, test, assert } from "./runner.js";

// Daftar ini sama dengan daftar di docs/css.md; uji gagal kalau icons.css menambah atau
// membuang ikon tanpa docs ikut diperbarui.
const ICONS = [
    "menu", "close", "search", "home", "user", "users", "settings", "plus", "minus", "edit",
    "trash", "download", "upload", "arrow-up", "arrow-down", "arrow-left", "arrow-right",
    "chevron-up", "chevron-down", "chevron-left", "chevron-right", "check", "warning", "info",
    "login", "logout", "calendar", "clock", "bell", "mail", "phone", "pin", "map", "file",
    "folder", "chart", "table", "dashboard", "filter", "sort", "eye", "eye-off", "lock", "unlock",
    "link", "copy", "refresh", "star", "more",
];

// icons.css dimuat di iframe sendiri, supaya gayanya tidak mengubah halaman uji.
async function frameWithIcons(html) {
    const frame = document.createElement("iframe");
    frame.className = "fixtures";
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head></head><body>${html}</body></html>`);
    doc.close();
    const link = doc.createElement("link");
    link.rel = "stylesheet";
    link.href = new URL("../icons.css", location.href).href;
    await new Promise((resolve, reject) => {
        link.onload = resolve;
        link.onerror = () => reject(new Error("icons.css tidak termuat"));
        doc.head.appendChild(link);
    });
    return { frame, doc, style: element => frame.contentWindow.getComputedStyle(element) };
}

// Mengumpulkan nama ikon dari aturan .icon-* di dalam @layer.
function iconNames(sheet) {
    const names = [];
    const walk = rules => {
        for (const rule of rules) {
            if (rule.cssRules) walk(rule.cssRules);
            const match = /^\.icon-([a-z-]+)$/.exec(rule.selectorText || "");
            if (match) names.push(match[1]);
        }
    };
    walk(sheet.cssRules);
    return names;
}

describe("icons.css", () => {
    test("semua ikon yang didokumentasikan ada, tidak lebih", async () => {
        const page = await frameWithIcons("");
        assert.deepEqual(iconNames(page.doc.styleSheets[0]).sort(), [...ICONS].sort());
        page.frame.remove();
    });
    test("setiap ikon memasang mask-image SVG yang bisa dibaca browser", async () => {
        const page = await frameWithIcons(ICONS.map(name => `<span class="icon icon-${name}"></span>`).join(""));
        const spans = page.doc.querySelectorAll(".icon");
        for (const span of spans) {
            const mask = page.style(span).maskImage;
            const url = /url\("(data:image\/svg\+xml,[^"]+)"\)/.exec(mask);
            assert.ok(url, `${span.className}: mask-image ${mask}`);
            // SVG yang rusak gagal dimuat sebagai gambar; mask-nya akan kosong tanpa pesan.
            const image = new Image();
            image.src = url[1];
            await image.decode();
            assert.ok(image.naturalWidth > 0, span.className);
        }
        page.frame.remove();
    });
    test("warna mengikuti currentColor, ukuran mengikuti font-size", async () => {
        const page = await frameWithIcons('<p id="p"><span class="icon icon-home" id="i"></span> Beranda</p>');
        const paragraph = page.doc.getElementById("p");
        paragraph.style.color = "rgb(1, 2, 3)";
        paragraph.style.fontSize = "20px";
        const icon = page.style(page.doc.getElementById("i"));
        assert.equal(icon.backgroundColor, "rgb(1, 2, 3)");
        assert.equal(icon.width, "20px");
        assert.equal(icon.height, "20px");
        page.frame.remove();
    });
    test("CSS halaman tanpa layer selalu menang", async () => {
        const page = await frameWithIcons('<span class="icon icon-star" id="i"></span>');
        const own = page.doc.createElement("style");
        own.textContent = ".icon { width: 2rem; background-color: rgb(4, 5, 6); }";
        page.doc.head.appendChild(own);
        const icon = page.style(page.doc.getElementById("i"));
        assert.equal(icon.width, "32px");
        assert.equal(icon.backgroundColor, "rgb(4, 5, 6)");
        page.frame.remove();
    });
});
