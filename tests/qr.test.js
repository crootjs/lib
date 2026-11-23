import { describe, test, assert } from "./runner.js";
import { qrMatrix, qrSVG, renderQR } from "../qr.js";

// Pembanding dihitung dengan pustaka python-qrcode (mask yang sama), jadi uji ini
// memeriksa hasil terhadap encoder lain, bukan terhadap dirinya sendiri.
const rows = matrix => matrix.map(row => row.map(dark => (dark ? "1" : "0")).join(""));

function fnv(text) {
    let hash = 0x811c9dc5;
    for (const byte of new TextEncoder().encode(text)) hash = Math.imul(hash ^ byte, 0x01000193) >>> 0;
    return hash;
}

describe("qr.js", () => {
    test("HELLO WORLD level M sama dengan encoder pembanding", () => {
        assert.deepEqual(rows(qrMatrix("HELLO WORLD")), [
            "111111101100101111111", "100000100001001000001", "101110100101001011101", "101110101001001011101",
            "101110101110101011101", "100000101001001000001", "111111101010101111111", "000000001001100000000",
            "100010111111011111001", "000100001011100001111", "001111110011011010010", "111110001100010000000",
            "111110101010101100110", "000000001010111101011", "111111101110101011010", "100000100101110110011",
            "101110101101011000110", "101110100100100011011", "101110100111000111000", "100000100001010000000",
            "111111101111111110101",
        ]);
    });
    test("versi 11 (dengan blok versi) dan teks UTF-8 sama dengan pembanding", () => {
        const big = qrMatrix("x".repeat(300), { ecc: "L" });
        assert.equal(big.length, 61);
        assert.equal(fnv(rows(big).join("")), 0xbf019a0f);
        const utf8 = qrMatrix("Halo Bandung 🌄 ünïcödé", { ecc: "h" });
        assert.equal(utf8.length, 33);
        assert.equal(fnv(rows(utf8).join("")), 0x43b53d8a);
    });
    test("teks terlalu panjang dan ecc salah ditolak", () => {
        assert.throws(() => qrMatrix("z".repeat(2954), { ecc: "H" }), RangeError);
        assert.throws(() => qrMatrix("a", { ecc: "X" }), RangeError);
        assert.equal(qrMatrix("z".repeat(2953), { ecc: "L" }).length, 177);
    });
    test("qrSVG: margin, warna, label di-escape; renderQR mengisi elemen", () => {
        const svg = qrSVG("a<b", { margin: 2, color: "#123", background: "transparent" });
        assert.ok(svg.includes('viewBox="0 0 25 25"'));
        assert.ok(svg.includes('aria-label="a&lt;b"'));
        assert.ok(svg.includes('fill="#123"'));
        assert.ok(!svg.includes("<rect"));
        const holder = document.createElement("div");
        holder.id = "qr-test";
        document.body.appendChild(holder);
        const element = renderQR("qr-test", "https://croot.js.org", { label: "Situs CrootJS" });
        assert.equal(element.tagName.toLowerCase(), "svg");
        assert.equal(element.getAttribute("aria-label"), "Situs CrootJS");
        assert.equal(element.getAttribute("viewBox"), "0 0 33 33");
        holder.remove();
    });
});
