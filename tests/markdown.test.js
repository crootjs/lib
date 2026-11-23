import { describe, test, assert, wait } from "./runner.js";
import { markdownToHTML, renderMarkdown, getMarkdown } from "../markdown.js";

const md = (text, options) => markdownToHTML(text, options);

describe("markdown.js: sintaks", () => {
    test("judul ATX dan setext, id slug opsional", () => {
        assert.equal(md("# Satu\n## Dua ##\n###### Enam"), "<h1>Satu</h1>\n<h2>Dua</h2>\n<h6>Enam</h6>");
        assert.equal(md("#tanpa spasi"), "<p>#tanpa spasi</p>");
        assert.equal(md("Judul\n===\n\nSub\n---"), "<h1>Judul</h1>\n<h2>Sub</h2>");
        assert.equal(md("# Cara Pakai!\n# Cara Pakai\n# Café", { headingIds: true }),
            "<h1 id=\"cara-pakai\">Cara Pakai!</h1>\n<h1 id=\"cara-pakai-1\">Cara Pakai</h1>\n<h1 id=\"café\">Café</h1>");
        assert.equal(md("## A *b*", { headingIds: true, idPrefix: "md-" }), "<h2 id=\"md-a-b\">A <em>b</em></h2>");
    });

    test("paragraf, baris baru keras (dua spasi dan backslash)", () => {
        assert.equal(md("satu\ndua\n\ntiga"), "<p>satu\ndua</p>\n<p>tiga</p>");
        assert.equal(md("a  \nb\\\nc"), "<p>a<br>\nb<br>\nc</p>");
        assert.equal(md("akhir  "), "<p>akhir</p>");
    });

    test("tebal, miring, coret, bersarang", () => {
        assert.equal(md("**b** __b__ *i* _i_ ~~s~~"), "<p><strong>b</strong> <strong>b</strong> <em>i</em> <em>i</em> <del>s</del></p>");
        assert.equal(md("***bi*** *a **b** c*"), "<p><em><strong>bi</strong></em> <em>a <strong>b</strong> c</em></p>");
        assert.equal(md("*foo**bar**baz*"), "<p><em>foo<strong>bar</strong>baz</em></p>");
        assert.equal(md("snake_case_name a * b * ~satu~"), "<p>snake_case_name a * b * ~satu~</p>");
        assert.equal(md("**tidak tertutup"), "<p>**tidak tertutup</p>");
    });

    test("kode inline dan escape backslash", () => {
        assert.equal(md("`a <b> &amp;` `` x`y ``"), "<p><code>a &lt;b&gt; &amp;amp;</code> <code>x`y</code></p>");
        assert.equal(md("\\*bukan miring\\* \\# \\[x\\](y)"), "<p>*bukan miring* # [x](y)</p>");
        assert.equal(md("`tidak tertutup"), "<p>`tidak tertutup</p>");
    });

    test("blok kode berpagar dan indentasi", () => {
        assert.equal(md("```js\nif (a < b) {}\n```"), "<pre><code class=\"language-js\">if (a &lt; b) {}\n</code></pre>");
        assert.equal(md("~~~\n```\n~~~"), "<pre><code>```\n</code></pre>");
        assert.equal(md("```\nbelum ditutup"), "<pre><code>belum ditutup\n</code></pre>");
        assert.equal(md("    kode\n\n    lagi"), "<pre><code>kode\n\nlagi\n</code></pre>");
        assert.equal(md("```\"><script>\nx\n```"), "<pre><code class=\"language-&quot;&gt;&lt;script&gt;\">x\n</code></pre>");
    });

    test("kutipan bertingkat dan baris malas", () => {
        assert.equal(md("> a\nb\n>> c"), "<blockquote>\n<p>a\nb</p>\n<blockquote>\n<p>c</p>\n</blockquote>\n</blockquote>");
    });

    test("daftar tidak berurut, berurut, bertingkat, renggang", () => {
        assert.equal(md("- a\n- b\n  - c\n- d"), "<ul>\n<li>a</li>\n<li>b\n<ul>\n<li>c</li>\n</ul>\n</li>\n<li>d</li>\n</ul>");
        assert.equal(md("3. a\n4. b"), "<ol start=\"3\">\n<li>a</li>\n<li>b</li>\n</ol>");
        assert.equal(md("1) a\n2) b"), "<ol>\n<li>a</li>\n<li>b</li>\n</ol>");
        assert.equal(md("- a\n\n- b"), "<ul>\n<li>\n<p>a</p>\n</li>\n<li>\n<p>b</p>\n</li>\n</ul>");
        assert.equal(md("* a\n- b"), "<ul>\n<li>a</li>\n</ul>\n<ul>\n<li>b</li>\n</ul>");
        assert.equal(md("1. a\n\n   ```\n   x\n   ```"), "<ol>\n<li>\n<p>a</p>\n<pre><code>x\n</code></pre>\n</li>\n</ol>");
    });

    test("daftar tugas menjadi checkbox disabled", () => {
        assert.equal(md("- [ ] belum\n- [x] sudah\n- [] bukan"),
            "<ul>\n<li class=\"task-list-item\"><input type=\"checkbox\" disabled> belum</li>\n" +
            "<li class=\"task-list-item\"><input type=\"checkbox\" disabled checked> sudah</li>\n<li>[] bukan</li>\n</ul>");
    });

    test("garis horizontal", () => {
        assert.equal(md("---\n* * *\n___"), "<hr>\n<hr>\n<hr>");
    });

    test("tautan, autolink, email, gambar, judul", () => {
        assert.equal(md("[a](https://x.id \"T\") [b](/rel) [c](#top) [d](<a b>)"),
            "<p><a href=\"https://x.id\" title=\"T\">a</a> <a href=\"/rel\">b</a> <a href=\"#top\">c</a> <a href=\"a%20b\">d</a></p>");
        assert.equal(md("<https://x.id/?a=1&b=2> <saya@contoh.id>"),
            "<p><a href=\"https://x.id/?a=1&amp;b=2\">https://x.id/?a=1&amp;b=2</a> <a href=\"mailto:saya@contoh.id\">saya@contoh.id</a></p>");
        assert.equal(md("![logo *x*](img/a.png 'Logo')"), "<p><img src=\"img/a.png\" alt=\"logo x\" title=\"Logo\"></p>");
        assert.equal(md("[![g](a.png)](https://x.id)"), "<p><a href=\"https://x.id\"><img src=\"a.png\" alt=\"g\"></a></p>");
        assert.equal(md("[a [b](c) d](e)"), "<p>[a <a href=\"c\">b</a> d](e)</p>");
        assert.equal(md("[tanpa tujuan] [x](y"), "<p>[tanpa tujuan] [x](y</p>");
    });

    test("opsi linkTarget dan linkRel hanya untuk tautan http(s)", () => {
        assert.equal(md("[a](https://x.id) [b](/lokal) <http://y.id>", { linkTarget: "_blank" }),
            "<p><a href=\"https://x.id\" target=\"_blank\" rel=\"noopener noreferrer\">a</a> <a href=\"/lokal\">b</a> " +
            "<a href=\"http://y.id\" target=\"_blank\" rel=\"noopener noreferrer\">http://y.id</a></p>");
        assert.equal(md("[a](//x.id)", { linkRel: "nofollow" }), "<p><a href=\"//x.id\" rel=\"nofollow\">a</a></p>");
    });

    test("tabel GFM dengan perataan kolom", () => {
        assert.equal(md("| Nama | Nilai | Ket |\n|:--|--:|:-:|\n| a \\| b | **9** |\n\nsesudah"),
            "<table>\n<thead>\n<tr><th align=\"left\">Nama</th><th align=\"right\">Nilai</th><th align=\"center\">Ket</th></tr>\n</thead>\n" +
            "<tbody>\n<tr><td align=\"left\">a | b</td><td align=\"right\"><strong>9</strong></td><td align=\"center\"></td></tr>\n</tbody>\n</table>\n<p>sesudah</p>");
        assert.equal(md("a | b\n--|--"), "<table>\n<thead>\n<tr><th>a</th><th>b</th></tr>\n</thead>\n</table>");
        assert.equal(md("| a | b |\n|---|"), "<p>| a | b |\n|---|</p>", "jumlah kolom pemisah harus sama");
    });

    test("entitas HTML", () => {
        assert.equal(md("&copy; &#65; &#x42; &#0; &tidakada; AT&T"), "<p>&copy; A B � &tidakada; AT&amp;T</p>");
        assert.equal(md("[x](/a?b=1&amp;c=2)"), "<p><a href=\"/a?b=1&amp;c=2\">x</a></p>");
    });

    test("masukan bukan teks dan CRLF", () => {
        assert.equal(md(null), "");
        assert.equal(md(42), "<p>42</p>");
        assert.equal(md("a\r\nb\rc"), "<p>a\nb\nc</p>");
    });
});

const XSS = [
    "<script>window.__mdxss = 1</script>",
    "<img src=x onerror=\"window.__mdxss = 1\">",
    "<svg onload=window.__mdxss=1>",
    "<a href=\"javascript:window.__mdxss=1\">a</a>",
    "<iframe src=\"javascript:window.__mdxss=1\"></iframe>",
    "[a](javascript:window.__mdxss=1)",
    "[a](JaVaScRiPt:window.__mdxss=1)",
    "[a](<javascript:window.__mdxss=1>)",
    "[a](< javascript:window.__mdxss=1>)",
    "[a](<java\tscript:window.__mdxss=1>)",
    "[a](java&#9;script:window.__mdxss=1)",
    "[a](java&#x0A;script:window.__mdxss=1)",
    "[a](&#106;avascript:window.__mdxss=1)",
    "[a](&#x6A;&#x61;vascript:window.__mdxss=1)",
    "[a](javascript&colon;window.__mdxss=1)",
    "[a](javascript&#58;window.__mdxss=1)",
    "[a](java\\script:window.__mdxss=1)",
    "[a](\u0001javascript:window.__mdxss=1)",
    "[a](&#1;javascript:window.__mdxss=1)",
    "[a](vbscript:msgbox)",
    "[a](VBScript:msgbox)",
    "[a](data:text/html,<script>window.__mdxss=1</script>)",
    "[a](DATA:text/html;base64,PHNjcmlwdD53aW5kb3cuX19tZHhzcz0xPC9zY3JpcHQ+)",
    "[a](file:///etc/passwd)",
    "<javascript:window.__mdxss=1>",
    "<data:text/html,x>",
    "![a](javascript:window.__mdxss=1)",
    "![a](data:image/svg+xml,<svg onload=window.__mdxss=1>)",
    "![x\" onerror=\"window.__mdxss=1](a.png)",
    "![a](x \"\\\" onerror=window.__mdxss=1 x=\\\"\")",
    "[![a](x.png)](javascript:window.__mdxss=1)",
    "[a](https://x.id \"\\\" onmouseover=window.__mdxss=1 x=\\\"\")",
    "[a](https://x.id\"onmouseover=\"window.__mdxss=1)",
    "&lt;img src=x onerror=window.__mdxss=1&gt;",
    "&#60;img src=x onerror=window.__mdxss=1&#62;",
    "`<img src=x onerror=window.__mdxss=1>`",
    "```\"><img src=x onerror=window.__mdxss=1>\nx\n```",
    "# <img src=x onerror=window.__mdxss=1>",
    "| <img src=x onerror=window.__mdxss=1> |\n|---|\n| <script>window.__mdxss=1</script> |",
    "- [ ] <img src=x onerror=window.__mdxss=1>",
    "> <style>body{display:none}</style>",
    "<!-- komentar --> <![CDATA[x]]> <?php ?>",
];

describe("markdown.js: keamanan", () => {
    test("vektor XSS tidak menghasilkan tag, atribut on*, atau URL berbahaya", async () => {
        window.__mdxss = 0;
        const host = document.createElement("div");
        document.body.appendChild(host);
        for (const vector of XSS) {
            const html = md(vector, { headingIds: true, linkTarget: "_blank" });
            host.innerHTML = html;
            const bad = host.querySelectorAll("script, style, iframe, svg, object, embed, form, base, meta, link");
            assert.equal(bad.length, 0, `tag berbahaya dari ${JSON.stringify(vector)}:`);
            for (const el of host.querySelectorAll("*")) {
                for (const attr of el.attributes) {
                    assert.ok(!/^on/i.test(attr.name), `atribut ${attr.name} dari ${JSON.stringify(vector)}`);
                    if (attr.name === "href" || attr.name === "src") {
                        const protocol = new URL(attr.value, location.href).protocol;
                        assert.ok(["http:", "https:", "mailto:", "tel:"].includes(protocol), `${attr.name}=${attr.value} dari ${JSON.stringify(vector)}`);
                    }
                }
            }
        }
        await wait(100);
        host.remove();
        assert.equal(window.__mdxss, 0, "tidak ada skrip yang jalan");
        delete window.__mdxss;
    });

    test("URL terlarang: tautan menjadi teks, gambar menjadi alt", () => {
        assert.equal(md("[klik](javascript:alert(1)) ![gbr](data:image/png;base64,AA)"), "<p>klik gbr</p>");
        assert.equal(md("<javascript:alert(1)>"), "<p>&lt;javascript:alert(1)&gt;</p>");
    });

    test("URL yang diizinkan tetap utuh", () => {
        assert.equal(md("[a](mailto:a@b.id) [b](tel:+6281) [c](../x.md#y) [d](?q=1)"),
            "<p><a href=\"mailto:a@b.id\">a</a> <a href=\"tel:+6281\">b</a> <a href=\"../x.md#y\">c</a> <a href=\"?q=1\">d</a></p>");
    });
});

describe("markdown.js: kinerja masukan jahat", () => {
    const N = 50000;
    const cases = {
        "*": "*".repeat(N), "[": "[".repeat(N), "]": "]".repeat(N), "![": "![".repeat(N / 2),
        "[[[a]]]": "[".repeat(N / 2) + "a" + "]".repeat(N / 2),
        "*a ... a*": "*a ".repeat(N / 3) + " a*".repeat(N / 3),
        "a* ": "a* ".repeat(N / 3), "*a_ ": "*a_ ".repeat(N / 4), "[ a_": "[ a_".repeat(N / 4),
        "`": Array.from({ length: 300 }, (_, i) => "e" + "`".repeat(i)).join(""),
        "[a](<b": "[a](<b".repeat(N / 6), "[a](b": "[a](b".repeat(N / 5), "[a](b \"": "[a](b \"".repeat(N / 7),
        "[a](((": "[a](" + "(".repeat(N), "<": "<".repeat(N), "&#": "&#".repeat(N / 2), "\\": "\\".repeat(N),
        ">": ">".repeat(N), "- ": "- ".repeat(N / 2) + "a", "spasi": "a" + " ".repeat(N) + "\nb",
        "a  \\n": "a  \n".repeat(N / 4), "~~a ": "~~a ".repeat(N / 4),
        "tabel": "|" + "a|".repeat(5000) + "\n|" + "-|".repeat(5000) + "\n" + "a\n".repeat(20000),
    };
    for (const [name, input] of Object.entries(cases)) {
        test(`${JSON.stringify(name)} × ${input.length} karakter di bawah 1 detik`, () => {
            const started = performance.now();
            md(input);
            const elapsed = performance.now() - started;
            assert.ok(elapsed < 1000, `${Math.round(elapsed)} ms`);
        });
    }
});

describe("markdown.js: renderMarkdown dan getMarkdown", () => {
    test("renderMarkdown mengisi elemen dan mengembalikan HTML", () => {
        const el = document.createElement("div");
        el.id = "uji-markdown";
        document.body.appendChild(el);
        const html = renderMarkdown("uji-markdown", "## Hai\n\n[x](https://x.id)", { headingIds: true, linkTarget: "_blank" });
        assert.equal(el.innerHTML, html);
        assert.equal(el.querySelector("h2").id, "hai");
        assert.equal(el.querySelector("a").rel, "noopener noreferrer");
        el.remove();
        assert.equal(renderMarkdown("tidak-ada-elemen", "*x*"), "<p><em>x</em></p>");
    });

    test("getMarkdown: callback dan Promise, 404, jaringan gagal", async () => {
        let called = null;
        const ok = await getMarkdown("fixtures/README.md", result => { called = result; }, { headingIds: true });
        assert.equal(ok.status, 200);
        assert.equal(called, ok);
        assert.ok(ok.data.startsWith("<h1 id=\"test-fixtures\">Test fixtures</h1>"), ok.data.slice(0, 60));
        assert.ok(ok.markdown.startsWith("# Test fixtures"));
        assert.equal(ok.error, null);

        const missing = await getMarkdown("fixtures/tidak-ada.md", null);
        assert.equal(missing.status, 404);
        assert.equal(missing.data, "");

        const controller = new AbortController();
        controller.abort();
        const aborted = await getMarkdown("fixtures/README.md", null, { signal: controller.signal });
        assert.deepEqual([aborted.status, aborted.error, aborted.data], [0, "abort", ""]);

        const failed = await getMarkdown("http://127.0.0.1:1/x.md", null);
        assert.deepEqual([failed.status, failed.error], [0, "network"]);
    });
});
