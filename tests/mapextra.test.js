import { describe, test, assert, wait } from "./runner.js";
import { newMap, tap } from "./maputil.js";
import { hasWebGL, makeGLB } from "./glb.js";
import { mapToPoint, getMapView, setMapView } from "../map.js";
import { openPMTiles, tileId } from "../mapoffline.js";
import { searchPlace, addSearchControl } from "../mapsearch.js";
import { addModel } from "../mapmodel.js";

// ---- PMTiles buatan: z0 dan z1 (lima tile PNG warna berbeda), tanpa kompresi, satu directory.
const varint = (out, value) => {
    while (value >= 0x80) {
        out.push((value & 0x7f) | 0x80);
        value = Math.floor(value / 128);
    }
    out.push(value);
};
async function makePMTiles() {
    const colors = ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#00ffff"];
    const tiles = [[0, 0, 0], [1, 0, 0], [1, 0, 1], [1, 1, 1], [1, 1, 0]];
    const blobs = await Promise.all(colors.map(color => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 256;
        const context = canvas.getContext("2d");
        context.fillStyle = color;
        context.fillRect(0, 0, 256, 256);
        return new Promise(resolve => canvas.toBlob(resolve, "image/png"));
    }));
    const datas = await Promise.all(blobs.map(blob => blob.arrayBuffer().then(buffer => new Uint8Array(buffer))));
    // entri urut menurut tileId: z1 (0,0)=1, (0,1)=2, (1,1)=3, (1,0)=4
    const entries = tiles.map((tile, i) => ({ id: tileId(...tile), data: datas[i] })).sort((a, b) => a.id - b.id);
    const directory = [];
    varint(directory, entries.length);
    let previous = 0;
    entries.forEach(entry => { varint(directory, entry.id - previous); previous = entry.id; });
    entries.forEach(() => varint(directory, 1));
    entries.forEach(entry => varint(directory, entry.data.length));
    entries.forEach((entry, i) => varint(directory, i === 0 ? 1 : 0)); // offset 0 (+1), lalu berurutan
    const dataOffset = 127 + directory.length;
    const total = dataOffset + entries.reduce((sum, entry) => sum + entry.data.length, 0);
    const bytes = new Uint8Array(total);
    const view = new DataView(bytes.buffer);
    bytes.set([..."PMTiles"].map(c => c.charCodeAt(0)), 0);
    bytes[7] = 3;
    const u64 = (offset, value) => view.setBigUint64(offset, BigInt(value), true);
    u64(8, 127); u64(16, directory.length); u64(24, 0); u64(32, 0); u64(40, 0); u64(48, 0);
    u64(56, dataOffset); u64(64, total - dataOffset); u64(72, 5); u64(80, 5); u64(88, 5);
    bytes[96] = 1; bytes[97] = 1; bytes[98] = 1; bytes[99] = 2; bytes[100] = 0; bytes[101] = 1;
    view.setInt32(102, -1800000000, true); view.setInt32(106, -850000000, true);
    view.setInt32(110, 1800000000, true); view.setInt32(114, 850000000, true);
    bytes[118] = 0;
    bytes.set(directory, 127);
    let offset = dataOffset;
    entries.forEach(entry => { bytes.set(entry.data, offset); offset += entry.data.length; });
    return new Blob([bytes]);
}

async function colorOf(blob) {
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d");
    context.drawImage(bitmap, 0, 0, 1, 1);
    return [...context.getImageData(0, 0, 1, 1).data.slice(0, 3)];
}

describe("mapoffline.js", () => {
    test("tileId sesuai contoh di spesifikasi PMTiles", () => {
        assert.deepEqual([[0, 0, 0], [1, 0, 0], [1, 0, 1], [1, 1, 1], [1, 1, 0], [2, 0, 0]].map(t => tileId(...t)), [0, 1, 2, 3, 4, 5]);
    });
    test("membaca tile dari File/Blob, tanpa jaringan", async () => {
        const archive = await openPMTiles(new File([await makePMTiles()], "uji.pmtiles"));
        assert.equal(archive.minZoom, 0);
        assert.equal(archive.maxZoom, 1);
        assert.equal(archive.tileType, "image/png");
        assert.deepEqual(await colorOf(await archive.getTile(0, 0, 0)), [255, 0, 0]);
        assert.deepEqual(await colorOf(await archive.getTile(1, 1, 0)), [0, 255, 255]);
        assert.equal(await archive.getTile(1, 1, 1).then(colorOf).then(String), "255,255,0");
        assert.equal(await archive.getTile(2, 0, 0), null);
    });
    test("server yang merusak Range: seluruh file diunduh sekali", async () => {
        const blob = await makePMTiles();
        const url = URL.createObjectURL(blob);
        const original = window.fetch;
        let ranged = 0;
        let full = 0;
        // Tiruan GitHub Pages: permintaan Range gagal di tingkat jaringan, permintaan biasa berhasil.
        window.fetch = (input, init = {}) => {
            if (init.headers && init.headers.Range) {
                ranged++;
                return Promise.reject(new TypeError("Failed to fetch"));
            }
            full++;
            return original(input, init);
        };
        try {
            const archive = await openPMTiles(url);
            assert.deepEqual(await colorOf(await archive.getTile(1, 0, 1)), [0, 0, 255]);
            await archive.getTile(0, 0, 0);
            assert.equal(ranged, 1, "Range dicoba sekali saja");
            assert.equal(full, 1, "seluruh file diunduh sekali");
        } finally {
            window.fetch = original;
            URL.revokeObjectURL(url);
        }
    });
    test("bukan PMTiles: null dengan alasan", async () => {
        let error = null;
        const archive = await openPMTiles(new Blob(["bukan pmtiles sama sekali, hanya teks biasa yang cukup panjang untuk header 127 byte ............................................................"]), (value, message) => { error = message; });
        assert.equal(archive, null);
        assert.ok(/bukan file PMTiles/.test(error), error);
    });
    test("dipakai sebagai peta dasar", async () => {
        const archive = await openPMTiles(await makePMTiles());
        const id = newMap({ tiles: archive, maxNativeZoom: 1, center: [0, 0], zoom: 1 });
        await wait(300);
        const images = [...document.querySelectorAll(`#${id} img.crootjs-map-tile-loaded`)];
        assert.ok(images.length >= 2, "tile tampil");
        assert.ok(images.every(image => image.src.startsWith("blob:")));
    });
});

describe("mapsearch.js", () => {
    const fake = query => Promise.resolve(query === "kosong" ? [] : [
        { name: "Gedung Sate", position: [107.6188, -6.9025], bbox: [107.6178, -6.9035, 107.6198, -6.9015], type: "office", address: null, raw: null },
        { name: "Taman Lansia", position: [107.6205, -6.9033], bbox: null, type: "park", address: null, raw: null }
    ]);
    test("searchPlace dengan penyedia sendiri", async () => {
        const results = await searchPlace("gedung sate", null, { provider: fake });
        assert.equal(results.length, 2);
        assert.deepEqual(await searchPlace("   "), []);
    });
    test("kotak pencarian: Enter, panah, pilih - peta pindah dan diberi tanda", async () => {
        const id = newMap({ center: [106.8, -6.2], zoom: 10 });
        let selected = null;
        const control = addSearchControl(id, { provider: fake, onSelect: result => { selected = result.name; } });
        await control.search("gedung sate");
        const items = document.querySelectorAll(`#${id} .crootjs-map-search-results li[role=option]`);
        assert.equal(items.length, 2);
        assert.equal(document.querySelector(`#${id} .crootjs-map-search-credit`), null, "tanpa atribusi OSM untuk penyedia sendiri");
        const input = document.querySelector(`#${id} .crootjs-map-search input`);
        input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
        input.form.requestSubmit();
        assert.equal(selected, "Gedung Sate");
        assert.close(getMapView(id).center, [107.6188, -6.9025], 1e-3);
        assert.ok(document.querySelector(`#${id} .crootjs-map-search-pin`));
        await control.search("kosong");
        assert.equal(document.querySelector(`#${id} .crootjs-map-search-results li`).textContent, "Tidak ditemukan.");
        control.remove();
        assert.equal(document.querySelector(`#${id} .crootjs-map-search`), null);
    });
});

describe("mapmodel.js", () => {
    test("model di titiknya, ukuran mengikuti zoom, tersembunyi di bawah minZoom", async () => {
        const id = newMap({ center: [107.6, -6.9], zoom: 19 });
        const model = addModel(id, [107.6, -6.9], makeGLB(), { scale: 10 });
        await model.loaded;
        const box = document.getElementById(model.viewerId);
        const big = parseInt(box.style.width, 10);
        setMapView(id, [107.6, -6.9], 18);
        assert.equal(parseInt(box.style.width, 10), Math.ceil(big / 2), "zoom keluar satu level = setengah ukuran");
        setMapView(id, [107.6, -6.9], 12);
        assert.equal(box.hidden, true);
        model.remove();
        assert.equal(document.getElementById(model.viewerId), null);
    }, { skip: hasWebGL() ? null : "WebGL tidak tersedia di browser ini" });
});
