import { describe, test, assert } from "./runner.js";
import { parseYAML } from "../yaml.js";

const lineOf = text => {
    try {
        parseYAML(text);
    } catch (error) {
        assert.ok(error instanceof SyntaxError, "SyntaxError");
        return error.line;
    }
    throw new Error("tidak ada galat");
};

describe("yaml.js", () => {
    test("skalar skema core", () => {
        assert.deepEqual(parseYAML("a: 1\nb: -2.5\nc: 1e3\nd: 0x1F\ne: 0o17\nf: true\ng: False\nh: ~\ni: null\nj:\nk: 1.0.0\nl: '12'\nm: !!str 12"),
            { a: 1, b: -2.5, c: 1000, d: 31, e: 15, f: true, g: false, h: null, i: null, j: null, k: "1.0.0", l: "12", m: "12" });
        assert.equal(parseYAML("x: .inf").x, Infinity);
        assert.ok(Number.isNaN(parseYAML("x: .nan").x));
        assert.equal(parseYAML("teks saja"), "teks saja");
        assert.equal(parseYAML(""), null);
        assert.equal(parseYAML("url: http://contoh.id:8080/a#b").url, "http://contoh.id:8080/a#b");
    });

    test("kutip tunggal dan ganda, escape, lintas baris", () => {
        assert.deepEqual(parseYAML(`a: 'it''s # bukan komentar'\nb: "tab\\tbaris\\n\\u00e9\\x41\\U0001F600\\"\\\\"\n'200': ok\n"k: v": 1`),
            { a: "it's # bukan komentar", b: "tab\tbaris\né\u0041😀\"\\", 200: "ok", "k: v": 1 });
        assert.equal(parseYAML(`x: "satu\n  dua\n\n  tiga"`).x, "satu dua\ntiga");
        assert.equal(parseYAML(`x: "sam\\\n  bung"`).x, "sambung");
        assert.equal(parseYAML("x: 'a  \n  b'").x, "a b");
    });

    test("skalar polos lintas baris dan komentar", () => {
        assert.deepEqual(parseYAML("# awal\na: satu\n  dua # komentar\n\nb: x#y"), { a: "satu dua", b: "x#y" });
        assert.deepEqual(parseYAML("- satu\n  dua\n-   tiga"), ["satu dua", "tiga"]);
    });

    test("skalar blok | dan > dengan chomping dan indentasi", () => {
        const doc = parseYAML("a: |\n  satu\n    dua\n\n  tiga\n\nb: >\n  satu\n  dua\n\n  tiga\n    kode\n  akhir\nc: |-\n  x\n\nd: |+\n  x\n\ne: >-\n  x\n  y\nf: |2\n    menjorok\ng: |\nh: 1\n");
        assert.equal(doc.a, "satu\n  dua\n\ntiga\n");
        assert.equal(doc.b, "satu dua\ntiga\n  kode\nakhir\n");
        assert.equal(doc.c, "x");
        assert.equal(doc.d, "x\n\n");
        assert.equal(doc.e, "x y");
        assert.equal(doc.f, "  menjorok\n");
        assert.equal(doc.g, "");
        assert.equal(doc.h, 1);
        assert.equal(parseYAML("- |\n  # bukan komentar\n- b")[0], "# bukan komentar\n");
    });

    test("sequence ringkas, mapping bersarang, sequence sejajar kunci", () => {
        assert.deepEqual(parseYAML("daftar:\n- nama: a\n  tag:\n    - x\n    - y\n- nama: b\n- - 1\n  - 2\n-\n  z: 3\nlain: 1"),
            { daftar: [{ nama: "a", tag: ["x", "y"] }, { nama: "b" }, [1, 2], { z: 3 }], lain: 1 });
    });

    test("flow bersarang, lintas baris, koma di akhir", () => {
        assert.deepEqual(parseYAML("a: [1, 'dua', {b: [3, {c: d}]}, ]\ne: {\"f\":1, g: , h}\ni: [\n  x, # komentar\n  y\n]\nj: [k: v]\nl: []\nm: {}"),
            { a: [1, "dua", { b: [3, { c: "d" }] }], e: { f: 1, g: null, h: null }, i: ["x", "y"], j: [{ k: "v" }], l: [], m: {} });
        assert.deepEqual(parseYAML("[http://a.b/c, a:b]"), ["http://a.b/c", "a:b"]);
    });

    test("dokumen ---, ..., direktif, anchor dan alias", () => {
        assert.deepEqual(parseYAML("%YAML 1.2\n---\na: 1\n...\n"), { a: 1 });
        assert.equal(parseYAML("--- |\n  teks\n"), "teks\n");
        const doc = parseYAML("dasar: &d {x: 1}\nsalin: *d\ndaftar:\n  - &n 5\n  - *n\nblok: &b\n  y: 2\nlagi: *b");
        assert.equal(doc.salin, doc.dasar, "alias = node yang sama");
        assert.deepEqual(doc.daftar, [5, 5]);
        assert.deepEqual(doc.lagi, { y: 2 });
    });

    test("galat dengan nomor baris", () => {
        assert.equal(lineOf("a: 1\nb: c: d"), 2);
        assert.equal(lineOf("a: 1\na: 2"), 2);
        assert.equal(lineOf("a:\n  b: 1\n   c: 2"), 3);
        assert.equal(lineOf("a:\n\tb: 1"), 2);
        assert.equal(lineOf("a: 1\nb: 'tidak ditutup\nc: 2"), 2);
        assert.equal(lineOf("a: [1, 2"), 1);
        assert.equal(lineOf("x: \"\\q\""), 1);
        assert.equal(lineOf("x: *tidakada"), 1);
        assert.equal(lineOf("a: 1\n---\nb: 2"), 2);
        assert.equal(lineOf("a: &x {k: 1}\nb:\n  <<: *x"), 3);
        assert.equal(lineOf("x: !kustom 1"), 1);
        assert.equal(lineOf("? kompleks\n: v"), 1);
        assert.equal(lineOf("a: 1\n]"), 2);
    });

    test("masukan jahat: sarang dalam ditolak, tanpa polusi prototipe, waktu linear", () => {
        assert.throws(() => parseYAML("[".repeat(50000)), SyntaxError);
        assert.throws(() => parseYAML("- ".repeat(50000) + "x"), SyntaxError);
        assert.throws(() => parseYAML(Array.from({ length: 5000 }, (_, i) => " ".repeat(i) + "k:").join("\n")), SyntaxError);
        const doc = parseYAML("__proto__:\n  polluted: 1\nb: {__proto__: 2}");
        assert.equal(Object.getPrototypeOf(doc), Object.prototype);
        assert.deepEqual(Object.keys(doc), ["__proto__", "b"]);
        assert.equal(doc.polluted, undefined);
        assert.equal({}.polluted, undefined);
        const started = performance.now();
        parseYAML("a: " + "x ".repeat(200000) + "\n" + "b: '" + "y".repeat(200000) + "'\n" + "c: [" + "1,".repeat(50000) + "]");
        parseYAML(Array.from({ length: 20000 }, (_, i) => `k${i}: "v ${i}"`).join("\n"));
        assert.ok(performance.now() - started < 2000, "cepat");
    });

    test("spesifikasi OpenAPI contoh", async () => {
        const text = await (await fetch("fixtures/openapi.yaml")).text();
        const spec = parseYAML(text);
        assert.equal(spec.openapi, "3.0.3");
        assert.equal(spec.info.title, "Example Notes API");
        assert.ok(spec.info.description.startsWith("A minimal example backend used to show"));
        assert.ok(!spec.info.description.includes("\n"), "> dilipat jadi satu baris");
        assert.deepEqual(Object.keys(spec.paths), ["/notes", "/notes/{id}"]);
        assert.deepEqual(Object.keys(spec.paths["/notes/{id}"].put.responses), ["200", "404"]);
        assert.equal(spec.components.schemas.Note.allOf[0].$ref, "#/components/schemas/NoteInput");
        assert.equal(spec.components.schemas.Note.allOf[1].properties.id.example, "64f1a2b3c4d5e6f708192a3b");
        assert.deepEqual(spec.components.schemas.NoteInput.required, ["title"]);
    });
});
