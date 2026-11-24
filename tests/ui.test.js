import { describe, test, assert, nextFrame } from "./runner.js";
import { initTabs } from "../tabs.js";

const THEMES = ["kampus", "kertas", "kontras", "niaga"];

// CSS dimuat di iframe sendiri (lebar bisa diatur), supaya gayanya tidak mengubah halaman uji.
async function frameWith(sheets, html, { width = 1200, attrs = "" } = {}) {
    const frame = document.createElement("iframe");
    frame.className = "fixtures";
    frame.style.width = width + "px";
    frame.style.height = "600px";
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    doc.open();
    doc.write(`<!DOCTYPE html><html ${attrs}><head></head><body>${html}</body></html>`);
    doc.close();
    for (const name of sheets) {
        const link = doc.createElement("link");
        link.rel = "stylesheet";
        link.href = new URL(`../${name}`, location.href).href;
        await new Promise((resolve, reject) => {
            link.onload = resolve;
            link.onerror = () => reject(new Error(`${name} tidak termuat`));
            doc.head.appendChild(link);
        });
    }
    return { frame, doc, style: element => frame.contentWindow.getComputedStyle(element) };
}

// Kontras WCAG dari dua warna hasil getComputedStyle ("rgb(r, g, b)").
function contrast(a, b) {
    const luminance = color => {
        const [r, g, bl] = color.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map(v => {
            const c = v / 255;
            return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
    };
    const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (high + 0.05) / (low + 0.05);
}

// Membaca token warna lewat elemen sungguhan, supaya nilainya sudah diubah browser menjadi rgb().
function tokenColors(page) {
    const probe = page.doc.createElement("span");
    page.doc.body.appendChild(probe);
    const read = name => {
        probe.style.color = `var(--croot-${name})`;
        return page.style(probe).color;
    };
    const names = ["bg", "surface", "text", "muted", "accent", "accent-text", "danger", "warning", "success", "info", "focus"];
    const colors = Object.fromEntries(names.map(name => [name, read(name)]));
    probe.remove();
    return colors;
}

const ui = (html, options) => frameWith(["croot.css", "ui.css"], html, options);

const TABS = `
<div role="tablist" id="t" aria-label="Contoh">
  <button type="button" role="tab" id="t1" aria-controls="p1">Satu</button>
  <button type="button" role="tab" id="t2" aria-controls="p2" aria-selected="true">Dua</button>
  <button type="button" role="tab" id="t3" aria-controls="p3">Tiga</button>
</div>
<div role="tabpanel" id="p1" aria-labelledby="t1">A</div>
<div role="tabpanel" id="p2" aria-labelledby="t2">B</div>
<div role="tabpanel" id="p3" aria-labelledby="t3"><a href="#x">C</a></div>`;

function setupTabs() {
    const host = document.getElementById("fixtures");
    host.insertAdjacentHTML("beforeend", `<div id="tabs-host">${TABS}</div>`);
    return () => document.getElementById("tabs-host").remove();
}

const key = (element, name) => element.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true }));
const state = () => ["t1", "t2", "t3"].map(id => {
    const tab = document.getElementById(id);
    return `${tab.getAttribute("aria-selected")}/${tab.tabIndex}/${document.getElementById(tab.getAttribute("aria-controls")).hidden}`;
});

describe("ui.css", () => {
    test("kerangka aplikasi: sidebar kolom kiri di layar lebar, popover tertutup di ponsel", async () => {
        const html = `<div class="app">
            <header class="app-header"><button class="app-toggle" id="b" popovertarget="s">Menu</button><p id="w">${"panjang ".repeat(80)}</p></header>
            <nav class="app-sidebar" id="s" popover aria-label="Menu"><ul><li><a href="#" aria-current="page">Beranda</a></li></ul></nav>
            <main class="app-main"><table><tr>${"<td>sel</td>".repeat(3)}</tr></table></main></div>`;
        const wide = await ui(html, { width: 1200 });
        const sidebar = wide.doc.getElementById("s");
        assert.equal(wide.style(wide.doc.querySelector(".app")).display, "grid");
        assert.equal(wide.style(sidebar).display, "block");
        assert.equal(Math.round(sidebar.getBoundingClientRect().width), 240);
        assert.equal(wide.style(wide.doc.getElementById("b")).display, "none");
        assert.ok(wide.doc.documentElement.scrollWidth <= 1200, "tanpa gulir samping");
        wide.frame.remove();

        const phone = await ui(html, { width: 360 });
        const drawer = phone.doc.getElementById("s");
        assert.equal(phone.style(drawer).display, "none");
        assert.ok(phone.doc.documentElement.scrollWidth <= 360, "tanpa gulir samping di 360 px");
        if (drawer.showPopover) {
            drawer.showPopover();
            assert.equal(phone.style(drawer).display, "block");
            assert.equal(Math.round(drawer.getBoundingClientRect().left), 0);
            drawer.hidePopover();
        }
        phone.frame.remove();
    });

    test("tab: garis bawah aksen hanya pada tab terpilih; tombol tidak berwarna aksen", async () => {
        const page = await ui(TABS, { attrs: 'data-theme="light"' });
        const selected = page.style(page.doc.getElementById("t2"));
        const other = page.style(page.doc.getElementById("t1"));
        assert.equal(selected.borderBottomColor, "rgb(21, 128, 61)");
        assert.equal(other.backgroundColor, "rgba(0, 0, 0, 0)");
        assert.equal(other.borderBottomColor, "rgba(0, 0, 0, 0)");
        page.frame.remove();
    });

    test("sakelar role=switch: tetap checkbox, berwarna aksen saat aktif", async () => {
        const page = await ui('<label><input type="checkbox" role="switch" id="s"> Notifikasi</label>', { attrs: 'data-theme="light"' });
        const input = page.doc.getElementById("s");
        assert.equal(page.style(input).appearance, "none");
        assert.equal(page.style(input).borderColor, "rgb(100, 116, 139)");
        input.checked = true;
        assert.equal(page.style(input).backgroundColor, "rgb(21, 128, 61)");
        assert.ok(contrast(page.style(input).borderColor, "rgb(248, 250, 252)") >= 3, "tepi aktif >= 3:1");
        page.frame.remove();
    });

    test("langkah: langkah sebelum aria-current ditandai selesai", async () => {
        const page = await ui('<ol class="steps"><li id="a">A</li><li id="b" aria-current="step">B</li><li id="c">C</li></ol>', { attrs: 'data-theme="light"' });
        assert.equal(page.style(page.doc.getElementById("a")).borderTopColor, "rgb(21, 128, 61)");
        assert.equal(page.style(page.doc.getElementById("b")).borderTopColor, "rgb(21, 128, 61)");
        assert.equal(page.style(page.doc.getElementById("c")).borderTopColor, "rgb(212, 219, 227)");
        page.frame.remove();
    });

    test("akordeon <details name>: hanya satu terbuka", async () => {
        const page = await ui('<div class="accordion"><details name="g" id="a" open><summary>A</summary><p>a</p></details><details name="g" id="b"><summary>B</summary><p>b</p></details></div>');
        assert.equal(page.style(page.doc.querySelector(".accordion")).borderTopStyle, "solid");
        page.doc.getElementById("b").open = true;
        await nextFrame();
        // Firefox < 130 dan Safari < 17.2 belum mengenal name; bagian lain tetap terbuka di sana.
        if ("name" in HTMLDetailsElement.prototype) assert.equal(page.doc.getElementById("a").open, false);
        page.frame.remove();
    });

    test("skeleton beranimasi, kecuali prefers-reduced-motion", async () => {
        const page = await ui('<span class="skeleton" id="s"></span>');
        const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
        assert.equal(page.style(page.doc.getElementById("s")).animationName, reduced ? "none" : "croot-skeleton");
        page.frame.remove();
    });

    test("daftar .meta dua kolom di wadah lebar, satu kolom di wadah sempit", async () => {
        const html = '<dl class="meta" id="m"><div id="r"><dt>Status</dt><dd>Aktif</dd></div></dl>';
        const wide = await ui(html, { width: 800 });
        assert.equal(wide.style(wide.doc.getElementById("r")).gridTemplateColumns.split(" ").length, 2);
        wide.frame.remove();
        const narrow = await ui(html, { width: 360 });
        assert.equal(narrow.style(narrow.doc.getElementById("r")).gridTemplateColumns.split(" ").length, 1);
        narrow.frame.remove();
    });

    test("ui.css menang atas gaya tombol croot.css walaupun dimuat lebih dulu", async () => {
        const page = await frameWith(["ui.css", "croot.css"], '<div role="tablist"><button role="tab" id="t">A</button></div>');
        assert.equal(page.style(page.doc.getElementById("t")).backgroundColor, "rgba(0, 0, 0, 0)");
        page.frame.remove();
    });
});

describe("tabs.js", () => {
    test("tab awal dari aria-selected; panel lain hidden; tabindex bergilir", () => {
        const cleanup = setupTabs();
        const tabs = initTabs("t");
        assert.deepEqual(state(), ["false/-1/true", "true/0/false", "false/-1/true"]);
        // Panel tanpa tabindex bisa dicapai dengan Tab.
        assert.equal(document.getElementById("p1").tabIndex, 0);
        tabs.remove();
        cleanup();
    });

    test("panah, Home, End memindah tab dan fokus; berputar di ujung", () => {
        const cleanup = setupTabs();
        const tabs = initTabs("t");
        const t2 = document.getElementById("t2");
        t2.focus();
        key(t2, "ArrowRight");
        assert.equal(document.activeElement.id, "t3");
        assert.deepEqual(state(), ["false/-1/true", "false/-1/true", "true/0/false"]);
        key(document.activeElement, "ArrowRight");
        assert.equal(document.activeElement.id, "t1");
        key(document.activeElement, "ArrowLeft");
        assert.equal(document.activeElement.id, "t3");
        key(document.activeElement, "Home");
        assert.equal(document.activeElement.id, "t1");
        key(document.activeElement, "End");
        assert.equal(document.activeElement.id, "t3");
        tabs.remove();
        cleanup();
    });

    test("klik dan select(index); remove() melepas pendengar", () => {
        const cleanup = setupTabs();
        const tabs = initTabs("t");
        document.getElementById("t1").click();
        assert.equal(document.getElementById("t1").getAttribute("aria-selected"), "true");
        tabs.select(2);
        assert.equal(document.getElementById("p3").hidden, false);
        tabs.select(9);
        assert.equal(document.getElementById("p3").hidden, false, "indeks di luar rentang diabaikan");
        tabs.remove();
        document.getElementById("t1").click();
        assert.equal(document.getElementById("t1").getAttribute("aria-selected"), "false");
        cleanup();
    });

    test("RTL: panah kiri menuju tab berikutnya", () => {
        const cleanup = setupTabs();
        document.getElementById("t").dir = "rtl";
        const tabs = initTabs("t");
        const t2 = document.getElementById("t2");
        t2.focus();
        key(t2, "ArrowLeft");
        assert.equal(document.activeElement.id, "t3");
        tabs.remove();
        cleanup();
    });

    test("ID tidak ada: null", () => {
        assert.equal(initTabs("tidak-ada"), null);
    });
});

describe("themes.css", () => {
    for (const theme of THEMES) {
        for (const mode of ["light", "dark"]) {
            test(`${theme} ${mode}: pasangan warna utama >= 4,5:1`, async () => {
                const page = await frameWith(["croot.css", "themes.css"], "", { attrs: `data-croot-theme="${theme}" data-theme="${mode}"` });
                const c = tokenColors(page);
                const pairs = [];
                for (const fg of ["text", "muted", "accent", "danger", "warning", "success", "info"]) {
                    pairs.push([fg, "bg"], [fg, "surface"]);
                }
                for (const bg of ["accent", "danger", "warning", "success", "info"]) pairs.push(["accent-text", bg]);
                for (const [fg, bg] of pairs) {
                    const value = contrast(c[fg], c[bg]);
                    assert.ok(value >= 4.5, `${fg} di atas ${bg}: ${value.toFixed(2)}`);
                }
                // Cincin fokus tema kontras berbingkai warna teks; tema lain cukup >= 3:1.
                const ring = theme === "kontras" ? c.text : c.focus;
                assert.ok(contrast(ring, c.bg) >= 3, `fokus ${contrast(ring, c.bg).toFixed(2)}`);
                page.frame.remove();
            });
        }
    }

    test("tema mengganti token; data-theme=dark memaksa versi gelap tema", async () => {
        const plain = await frameWith(["croot.css", "themes.css"], "", { attrs: 'data-theme="light"' });
        const light = await frameWith(["croot.css", "themes.css"], "", { attrs: 'data-croot-theme="kampus" data-theme="light"' });
        const dark = await frameWith(["croot.css", "themes.css"], "", { attrs: 'data-croot-theme="kampus" data-theme="dark"' });
        assert.equal(plain.style(plain.doc.body).backgroundColor, "rgb(248, 250, 252)");
        assert.equal(light.style(light.doc.body).backgroundColor, "rgb(245, 245, 241)");
        assert.equal(dark.style(dark.doc.body).backgroundColor, "rgb(14, 22, 38)");
        assert.equal(dark.style(dark.doc.documentElement).colorScheme, "dark");
        plain.frame.remove();
        light.frame.remove();
        dark.frame.remove();
    });

    test("data-theme=light memaksa versi terang tema", async () => {
        const page = await frameWith(["croot.css", "themes.css"], "", { attrs: 'data-croot-theme="niaga" data-theme="light"' });
        assert.equal(page.style(page.doc.body).backgroundColor, "rgb(242, 244, 243)");
        page.frame.remove();
    });

    test("huruf judul tema dipakai h1-h4, isi tetap huruf sistem", async () => {
        const page = await frameWith(["croot.css", "themes.css"], '<h2 id="h">Judul</h2><p id="p">Isi</p>', { attrs: 'data-croot-theme="kampus"' });
        assert.ok(/Charter/.test(page.style(page.doc.getElementById("h")).fontFamily));
        assert.ok(/system-ui/.test(page.style(page.doc.getElementById("p")).fontFamily));
        page.frame.remove();
    });
});
