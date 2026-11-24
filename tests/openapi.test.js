import { describe, test, assert, wait } from "./runner.js";
import { renderOpenAPI, loadOpenAPI, openAPIExample } from "../openapi.js";

function makeBox() {
    document.getElementById("uji-openapi")?.remove();
    const box = document.createElement("div");
    box.id = "uji-openapi";
    document.body.appendChild(box);
    return box;
}

const loadJSON = async () => (await fetch("fixtures/openapi.json")).json();
const op = (box, id) => box.querySelector(`details#${CSS.escape(id)}`);
const openOp = (box, id) => {
    const details = op(box, id);
    details.querySelector("summary").click();
    return details;
};
const snippetOf = (box, id) => openOp(box, id).querySelector(".crootjs-openapi-snippet").textContent;

// fetch palsu untuk "Coba"; handler(url, init) mengembalikan Response atau melempar.
async function withFetch(handler, run) {
    const original = window.fetch;
    const calls = [];
    window.fetch = (url, init = {}) => {
        calls.push({ url: String(url), init });
        return handler(String(url), init);
    };
    try {
        await run(calls);
    } finally {
        window.fetch = original;
    }
}

async function until(check, ms = 2000) {
    const end = performance.now() + ms;
    while (!check()) {
        if (performance.now() > end) throw new Error("menunggu terlalu lama");
        await wait(10);
    }
}

describe("openapi.js", () => {
    test("elemen tidak ada → null; Swagger 2.0 dan bukan OpenAPI → pesan", async () => {
        assert.equal(await renderOpenAPI("tidak-ada-elemen", { openapi: "3.0.0" }), null);
        const box = makeBox();
        let reported = null;
        assert.equal(await renderOpenAPI("uji-openapi", { swagger: "2.0", paths: {} }, { onError: result => { reported = result; } }), null);
        assert.equal(reported.error, "swagger2");
        assert.ok(box.querySelector('[role="alert"]').textContent.includes("Swagger 2.0"));
        assert.equal((await loadOpenAPI({ openapi: "2.5" })).error, "version");
        assert.equal((await loadOpenAPI(null)).error, "version");
        box.remove();
    });

    test("loadOpenAPI: URL YAML, JSON, 404, YAML rusak", async () => {
        const yaml = await loadOpenAPI("fixtures/openapi.yaml");
        assert.equal(yaml.error, null);
        assert.equal(yaml.spec.info.title, "Example Notes API");
        const json = await loadOpenAPI("fixtures/openapi.json");
        assert.equal(json.spec.openapi, "3.1.0");
        const missing = await loadOpenAPI("fixtures/tidak-ada.yaml");
        assert.equal(missing.error, "http");
        assert.ok(missing.message.includes("404"));
        await withFetch(() => Promise.resolve(new Response("a: 1\n  b: c: d")), async () => {
            const broken = await loadOpenAPI("rusak.yaml");
            assert.equal(broken.error, "parse");
            assert.ok(broken.message.includes("baris 2"), broken.message);
        });
        await withFetch(() => Promise.reject(new TypeError("Failed to fetch")), async () => {
            const offline = await loadOpenAPI("https://contoh.invalid/spec.json");
            assert.equal(offline.error, "network");
            assert.ok(offline.message.includes("CORS"));
        });
    });

    test("render dari URL YAML: judul, server, operasi, deskripsi Markdown", async () => {
        const box = makeBox();
        const viewer = await renderOpenAPI("uji-openapi", "fixtures/openapi.yaml");
        assert.equal(viewer.spec.info.version, "1.0.0");
        assert.equal(viewer.element.parentNode, box);
        assert.ok(box.querySelector("h2").textContent.startsWith("Example Notes API"));
        assert.ok(box.querySelector(".crootjs-openapi-md").textContent.includes("A minimal example"));
        assert.equal(box.querySelector(".crootjs-openapi-server code").textContent, "https://api.example.com");
        assert.equal(box.querySelector(".crootjs-openapi-links a").getAttribute("href"), "https://croot.js.org/docs/api/");
        assert.deepEqual([...box.querySelectorAll("details.crootjs-openapi-op")].map(d => d.id), ["listNotes", "createNote", "updateNote", "deleteNote"]);
        const summary = op(box, "updateNote").querySelector("summary");
        assert.equal(summary.querySelector(".crootjs-openapi-method").textContent, "PUT");
        assert.equal(summary.querySelector(".crootjs-openapi-path").textContent, "/notes/{id}");
        assert.ok(document.getElementById("crootjs-openapi-style"));
        assert.equal(op(box, "listNotes").querySelector(".crootjs-openapi-body"), null, "isi dibuat saat dibuka");
        viewer.remove();
        assert.equal(box.childElementCount, 0);
        box.remove();
    });

    test("grup tag: urutan spesifikasi, tag kosong dilewati, tanpa tag di akhir", async () => {
        const box = makeBox();
        const viewer = await renderOpenAPI("uji-openapi", await loadJSON());
        const sections = [...box.querySelectorAll(".crootjs-openapi-tag")];
        assert.deepEqual(sections.map(s => s.querySelector("h3").textContent), ["buku", "Lainnya"]);
        assert.deepEqual([...sections[0].querySelectorAll("details")].map(d => d.id), ["daftarBuku", "tambahBuku", "hapusBuku", "ubahBuku"]);
        assert.equal(sections[1].querySelector("details").id, "unggahSampul");
        const patch = op(box, "ubahBuku");
        assert.ok(patch.classList.contains("crootjs-openapi-gone"));
        assert.equal(patch.querySelector(".crootjs-openapi-flag").textContent, "usang");
        // Server: variabel diganti default, URL relatif dihitung dari lokasi spesifikasi.
        const options = [...box.querySelectorAll(".crootjs-openapi-tools select option")].map(o => o.value);
        assert.deepEqual(options, ["https://api.example.com/v1", new URL("/lokal", location.href).href]);
        // Tautan javascript: dari contact.url dibuang; email jadi mailto.
        assert.deepEqual([...box.querySelectorAll(".crootjs-openapi-links a")].map(a => a.protocol), ["mailto:", "https:"]);
        viewer.remove();
        box.remove();
    });

    test("$ref (termasuk ~0 ~1), siklus, allOf, oneOf, eksternal", async () => {
        const box = makeBox();
        const viewer = await renderOpenAPI("uji-openapi", await loadJSON(), { tryIt: false });
        const post = openOp(box, "tambahBuku");
        const tree = post.querySelector(".crootjs-openapi-tree").textContent;
        assert.ok(tree.includes("Buku · object"));
        assert.ok(tree.includes("Penulis · object"));
        assert.ok(tree.includes("↻ Buku"), "siklus Buku → Penulis → Buku");
        assert.ok(tree.includes("a~b/c · boolean"), "JSON pointer ~0 ~1");
        assert.ok(tree.includes("string | null (email)"));
        assert.ok(tree.includes("Salah satu dari:"));
        assert.ok(post.querySelector(".crootjs-openapi-req").textContent === "wajib");
        assert.equal(post.querySelector(".crootjs-openapi-tree em").textContent, "lengkap", "deskripsi properti lewat Markdown");
        assert.ok(post.textContent.includes("$ref tidak ditemukan: lain.yaml#/Galat"));
        assert.ok(post.textContent.includes("Buku dibuat"), "respons lewat $ref");
        assert.ok(post.textContent.includes("\"id\": \"b1\""), "contoh dari examples");
        viewer.remove();

        const notes = await renderOpenAPI("uji-openapi", "fixtures/openapi.yaml", { tryIt: false });
        const list = openOp(box, "listNotes").querySelector(".crootjs-openapi-tree").textContent;
        assert.ok(list.includes("array<Note>"));
        for (const name of ["title", "done", "id"]) assert.ok(list.includes(name), `allOf memuat ${name}`);
        notes.remove();
        box.remove();
    });

    test("openAPIExample: format, enum, readOnly, siklus, allOf", async () => {
        const spec = await loadJSON();
        const buku = { $ref: "#/components/schemas/Buku" };
        const response = openAPIExample(buku, spec);
        assert.equal(response.id, "3fa85f64-5717-4562-b3fc-2c963f66afa6");
        assert.equal(response.terbit, "2024-01-31T09:00:00Z");
        assert.equal(response.format, "cetak");
        assert.equal(response.penulis.email, "user@example.com");
        assert.deepEqual(response.penulis.buku, [null], "siklus berhenti");
        assert.equal(response["a~b/c"], true);
        assert.equal("id" in openAPIExample(buku, spec, "request"), false, "readOnly tidak ada di permintaan");
        assert.deepEqual(openAPIExample({ type: "array", items: { type: "integer", minimum: 5 } }), [5]);
        assert.deepEqual(openAPIExample({ type: "object", additionalProperties: { type: "boolean" } }), { key: true });
        const yaml = (await loadOpenAPI("fixtures/openapi.yaml")).spec;
        assert.deepEqual(openAPIExample({ $ref: "#/components/schemas/Note" }, yaml), { title: "Buy groceries", done: false, id: "64f1a2b3c4d5e6f708192a3b" });
        const loop = { components: { schemas: { A: { allOf: [{ $ref: "#/components/schemas/A" }] } } } };
        assert.equal(openAPIExample({ $ref: "#/components/schemas/A" }, loop), null);
    });

    test("kode contoh memanggil api.js dengan benar", async () => {
        const box = makeBox();
        const viewer = await renderOpenAPI("uji-openapi", await loadJSON(), { tryIt: false });
        const list = snippetOf(box, "daftarBuku");
        assert.ok(list.startsWith('import { getJSON } from "./api.js";'), list);
        assert.ok(list.includes('const API_URL = "https://api.example.com/v1";'));
        assert.ok(list.includes('const query = new URLSearchParams({ halaman: "2", urut: "judul" });'), list);
        assert.ok(list.includes("getJSON(`${API_URL}/buku?${query}`, responseFunction);"), list);
        assert.ok(!list.includes("token"), "security: [] berarti tanpa token");

        const post = snippetOf(box, "tambahBuku");
        assert.ok(post.includes('import { postJSON } from "./api.js";'));
        assert.ok(post.includes("postJSON(`${API_URL}/buku`, body, responseFunction, { headers: { Authorization: \"Bearer \" + token } });"), post);
        assert.ok(post.includes('    "judul": "string",'));
        assert.ok(!post.includes('"id"'), "readOnly tidak dikirim");

        const del = snippetOf(box, "hapusBuku");
        assert.ok(del.includes('const bukuId = "3fa85f64-5717-4562-b3fc-2c963f66afa6";'), del);
        assert.ok(del.includes("deleteJSON(`${API_URL}/buku/${bukuId}`, undefined, responseFunction, { headers: { \"X-API-Key\": token } });"), del);

        const patch = snippetOf(box, "ubahBuku");
        assert.ok(!patch.includes("import"), "PATCH tanpa api.js");
        assert.ok(patch.includes('method: "PATCH"') && patch.includes("body: JSON.stringify(body)") && patch.includes("fetch(`${API_URL}/buku/${bukuId}`"), patch);

        const upload = snippetOf(box, "unggahSampul");
        assert.ok(upload.includes('uploadFile(`${API_URL}/sampul`, "file", responseFunction, { field: "gambar", headers: { Authorization: "Bearer " + token } });'), upload);

        // Kode contoh harus JavaScript yang valid.
        for (const code of [list, post, del, patch, upload]) new Function(code.replace(/^import .*$/m, ""));

        // Ganti server: kode yang sudah tampil ikut berubah.
        const select = box.querySelector(".crootjs-openapi-tools select");
        select.value = select.options[1].value;
        select.dispatchEvent(new Event("change"));
        assert.ok(op(box, "daftarBuku").querySelector(".crootjs-openapi-snippet").textContent.includes(`const API_URL = "${select.options[1].value}";`));
        viewer.remove();
        box.remove();
    });

    test("saring operasi", async () => {
        const box = makeBox();
        const viewer = await renderOpenAPI("uji-openapi", await loadJSON());
        const input = box.querySelector('input[type="search"]');
        assert.equal(box.querySelector(`label[for="${input.id}"]`).textContent, "Saring operasi");
        const visible = () => [...box.querySelectorAll("details.crootjs-openapi-op")].filter(d => !d.hidden).map(d => d.id);
        input.value = "HAPUS";
        input.dispatchEvent(new Event("input"));
        assert.deepEqual(visible(), ["hapusBuku"]);
        assert.equal(box.querySelectorAll(".crootjs-openapi-tag")[1].hidden, true, "grup tanpa hasil disembunyikan");
        input.value = "/sampul";
        input.dispatchEvent(new Event("input"));
        assert.deepEqual(visible(), ["unggahSampul"]);
        input.value = "tidak ada apa-apa";
        input.dispatchEvent(new Event("input"));
        assert.deepEqual(visible(), []);
        assert.equal(box.querySelector(".crootjs-openapi > p.crootjs-openapi-message").hidden, false);
        input.value = "";
        input.dispatchEvent(new Event("input"));
        assert.equal(visible().length, 5);
        viewer.remove();
        box.remove();
    });

    test("tautan dalam: hash membuka operasi, klik mengubah hash", async () => {
        const box = makeBox();
        const before = location.pathname + location.search;
        history.replaceState(history.state, "", "#tambahBuku");
        try {
            const viewer = await renderOpenAPI("uji-openapi", await loadJSON(), { tryIt: false });
            assert.equal(op(box, "tambahBuku").open, true);
            assert.ok(op(box, "tambahBuku").querySelector(".crootjs-openapi-body"));
            op(box, "hapusBuku").querySelector("summary").click();
            assert.equal(location.hash, "#hapusBuku");
            op(box, "hapusBuku").querySelector("summary").click();
            assert.equal(location.hash, "");
            location.hash = "#unggahSampul";
            await until(() => op(box, "unggahSampul").open);
            viewer.remove();
        } finally {
            history.replaceState(history.state, "", before);
        }
        box.remove();
    });

    test("Coba: fetch dengan parameter, token, body; pesan CORS dan waktu habis", async () => {
        const box = makeBox();
        const viewer = await renderOpenAPI("uji-openapi", await loadJSON(), { timeout: 50 });
        const tokenInput = [...box.querySelectorAll(".crootjs-openapi-tools input")].find(input => input.type === "password");
        assert.ok(box.querySelector(`label[for="${tokenInput.id}"]`).textContent.includes("Bearer"));
        tokenInput.value = "rahasia";
        tokenInput.dispatchEvent(new Event("input"));

        const post = openOp(box, "tambahBuku");
        const form = post.querySelector("form");
        const textarea = form.querySelector("textarea");
        assert.ok(JSON.parse(textarea.value).judul === "string");
        await withFetch(() => Promise.resolve(new Response('{"id":"b9"}', { status: 201, headers: { "Content-Type": "application/json", "X-Uji": "1" } })), async calls => {
            textarea.value = '{"judul": "Laskar"}';
            form.requestSubmit();
            await until(() => form.querySelector(".crootjs-openapi-result pre"));
            assert.equal(calls[0].url, "https://api.example.com/v1/buku");
            assert.equal(calls[0].init.method, "POST");
            assert.equal(calls[0].init.headers.get("Authorization"), "Bearer rahasia");
            assert.equal(calls[0].init.headers.get("Content-Type"), "application/json");
            assert.equal(calls[0].init.body, '{"judul": "Laskar"}');
            const result = form.querySelector(".crootjs-openapi-result");
            assert.ok(result.textContent.includes("Status 201"));
            assert.ok(result.querySelector("details").textContent.includes("x-uji: 1"));
            assert.equal(result.querySelectorAll("pre")[1].textContent, '{\n  "id": "b9"\n}');
            textarea.value = "{bukan json";
            form.requestSubmit();
            assert.equal(calls.length, 1, "JSON rusak tidak dikirim");
            assert.equal(textarea.getAttribute("aria-invalid"), "true");
        });

        const list = openOp(box, "daftarBuku").querySelector("form");
        assert.equal(list.querySelector("input").value, "2", "contoh parameter mengisi input");
        await withFetch(() => Promise.reject(new TypeError("Failed to fetch")), async calls => {
            list.querySelector("select").value = "tahun";
            list.requestSubmit();
            await until(() => list.querySelector(".crootjs-openapi-error"));
            assert.equal(calls[0].url, "https://api.example.com/v1/buku?halaman=2&urut=tahun");
            assert.equal(calls[0].init.headers.has("Authorization"), false, "security: [] tanpa token");
            assert.ok(list.querySelector(".crootjs-openapi-error").textContent.includes("CORS"));
        });

        const del = openOp(box, "hapusBuku").querySelector("form");
        const idInput = del.querySelector("input");
        assert.ok(idInput.required);
        await withFetch((url, init) => new Promise((resolve, reject) => {
            init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }), async calls => {
            idInput.value = "a/b c";
            del.requestSubmit();
            assert.equal(del.querySelector("button").disabled, true);
            await until(() => del.querySelector(".crootjs-openapi-error"));
            assert.equal(calls[0].url, "https://api.example.com/v1/buku/a%2Fb%20c");
            assert.equal(calls[0].init.method, "DELETE");
            assert.ok(del.querySelector(".crootjs-openapi-error").textContent.includes("tidak ada jawaban"));
            assert.equal(del.querySelector("button").disabled, false);
        });
        assert.ok(openOp(box, "unggahSampul").textContent.includes("tidak bisa dicoba di sini"));
        viewer.remove();
        box.remove();
    });

    test("XSS: teks spesifikasi tidak pernah menjadi elemen", async () => {
        const box = makeBox();
        const bad = "<img src=x onerror=\"window.__xss=1\">";
        const spec = {
            openapi: "3.0.0",
            info: { title: bad, version: bad, description: bad, contact: { name: bad, url: "javascript:alert(1)" } },
            servers: [{ url: bad }],
            tags: [{ name: bad, description: bad }],
            paths: {
                [`/x/${bad}`]: {
                    post: {
                        tags: [bad], summary: bad, description: bad, operationId: bad,
                        parameters: [{ name: bad, in: "query", description: bad, schema: { type: bad, enum: [bad] } }],
                        requestBody: { content: { "application/json": { schema: { type: "object", properties: { [bad]: { type: "string", description: bad } } }, example: { [bad]: bad } } } },
                        responses: { [bad]: { description: bad } }
                    }
                }
            }
        };
        const viewer = await renderOpenAPI("uji-openapi", spec, { expand: true });
        assert.equal(box.querySelector("img, script, [onerror]"), null);
        assert.ok(box.querySelector("h2").textContent.includes(bad));
        assert.ok(box.querySelector(".crootjs-openapi-summary").textContent === bad);
        assert.ok(box.querySelector(".crootjs-openapi-snippet").textContent.includes(bad));
        assert.equal(box.querySelector('a[href^="javascript"]'), null);
        await wait(20);
        assert.equal(window.__xss, undefined);
        viewer.remove();
        box.remove();
    });

    test("expand, tryIt: false, snippets: false, texts", async () => {
        const box = makeBox();
        const viewer = await renderOpenAPI("uji-openapi", "fixtures/openapi.yaml", {
            expand: true, tryIt: false, snippets: false, texts: { filter: "Filter", responses: "Responses" }
        });
        const all = [...box.querySelectorAll("details.crootjs-openapi-op")];
        assert.ok(all.every(d => d.open && d.querySelector(".crootjs-openapi-body")));
        assert.equal(box.querySelector("form, .crootjs-openapi-snippet"), null);
        assert.equal(box.querySelector(`label[for="${box.querySelector('input[type="search"]').id}"]`).textContent, "Filter");
        assert.ok([...box.querySelectorAll("h4")].some(h => h.textContent === "Responses"));
        viewer.remove();
        box.remove();
    });
});
