import { describe, test, assert, wait } from "./runner.js";
import { newMap, tap } from "./maputil.js";
import { hasWebGL, makeGLB } from "./glb.js";
import { mapToPoint, getMapView, setMapView } from "../map.js";
import { openPMTiles, tileId } from "../mapoffline.js";
import { decodeMVT } from "../mapvector.js";
import { searchPlace, addSearchControl } from "../mapsearch.js";
import { addModel } from "../mapmodel.js";
import { cachedTiles } from "../mapcache.js";

// ---- PMTiles buatan: z0 dan z1 (lima tile PNG warna berbeda), tanpa kompresi, satu directory.
const varint = (out, value) => {
    while (value >= 0x80) {
        out.push((value & 0x7f) | 0x80);
        value = Math.floor(value / 128);
    }
    out.push(value);
};
// tiles (opsional): [{ z, x, y, data: Uint8Array }] dengan tileType sendiri, misalnya 1 = MVT.
async function makePMTiles(custom = null) {
    if (custom) return packPMTiles(custom.tiles.map(tile => ({ id: tileId(tile.z, tile.x, tile.y), data: tile.data })).sort((a, b) => a.id - b.id), custom.tileType, Math.max(...custom.tiles.map(tile => tile.z)));
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
    return packPMTiles(entries, 2, 1);
}

function packPMTiles(entries, tileType, maxZoom) {
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
    bytes[96] = 1; bytes[97] = 1; bytes[98] = 1; bytes[99] = tileType; bytes[100] = 0; bytes[101] = maxZoom;
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

// ---- MVT buatan: layer "water" berisi persegi menutup separuh kiri tile, "places" satu titik.
const pbVarint = (out, value) => varint(out, value);
const pbField = (out, number, bytes) => { varint(out, number * 8 + 2); varint(out, bytes.length); out.push(...bytes); };
const pbString = value => [...new TextEncoder().encode(value)];
const zig = n => (n < 0 ? -2 * n - 1 : 2 * n);
function mvtLayer(name, features, keys, values) {
    const out = [];
    pbVarint(out, 15 * 8); pbVarint(out, 2);
    pbField(out, 1, pbString(name));
    features.forEach(feature => {
        const body = [];
        if (feature.tags.length) { const tags = []; feature.tags.forEach(t => varint(tags, t)); pbField(body, 2, tags); }
        varint(body, 3 * 8); varint(body, feature.type);
        const geometry = []; feature.geometry.forEach(c => varint(geometry, c)); pbField(body, 4, geometry);
        pbField(out, 2, body);
    });
    keys.forEach(key => pbField(out, 3, pbString(key)));
    values.forEach(value => { const v = []; pbField(v, 1, pbString(value)); pbField(out, 4, v); });
    pbVarint(out, 5 * 8); pbVarint(out, 4096);
    return out;
}
function makeMVT() {
    // persegi (0,0)-(2048,4096): MoveTo 1, LineTo 3, ClosePath
    const square = [9, zig(0), zig(0), 26, zig(2048), zig(0), zig(0), zig(4096), zig(-2048), zig(0), 15];
    const water = mvtLayer("water", [{ type: 3, tags: [0, 0], geometry: square }], ["kind"], ["water"]);
    const places = mvtLayer("places", [{ type: 1, tags: [0, 0, 1, 1], geometry: [9, zig(3072), zig(2048)] }], ["kind", "name"], ["locality", "Bandung"]);
    const tile = [];
    pbField(tile, 3, water);
    pbField(tile, 3, places);
    return new Uint8Array(tile);
}

describe("mapvector.js", () => {
    test("decodeMVT membaca layer, atribut, dan geometri", () => {
        const layers = decodeMVT(makeMVT());
        assert.deepEqual(Object.keys(layers), ["water", "places"]);
        assert.equal(layers.water.extent, 4096);
        assert.deepEqual(layers.water.features[0].properties, { kind: "water" });
        assert.deepEqual(layers.water.features[0].geometry[0], [[0, 0], [2048, 0], [2048, 4096], [0, 4096], [0, 0]]);
        assert.deepEqual(layers.places.features[0].properties, { kind: "locality", name: "Bandung" });
        assert.deepEqual(layers.places.features[0].geometry, [[[3072, 2048]]]);
    });
});

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
    test("PMTiles vektor: digambar, termasuk di atas zoom terbesar file (overzoom)", async () => {
        const archive = await openPMTiles(new File([await makePMTiles({ tiles: [{ z: 0, x: 0, y: 0, data: makeMVT() }], tileType: 1 })], "vektor.pmtiles"));
        assert.equal(archive.tileType, "mvt");
        assert.equal(archive.fileMaxZoom, 0);
        assert.equal(archive.maxZoom, 4);
        const pixel = async (blob, x, y) => {
            const bitmap = await createImageBitmap(blob);
            const canvas = document.createElement("canvas");
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            const context = canvas.getContext("2d", { willReadFrequently: true });
            context.drawImage(bitmap, 0, 0);
            return [...context.getImageData(x, y, 1, 1).data];
        };
        const whole = await archive.getTile(0, 0, 0);
        assert.deepEqual((await pixel(whole, 100, 256)).slice(0, 3), [170, 211, 223], "separuh kiri air");
        assert.equal((await pixel(whole, 400, 100))[3], 0, "separuh kanan kosong");
        // z1 (1,0) = kuadran kanan atas: tidak ada air sama sekali; (0,0) = seluruhnya air.
        assert.equal((await pixel(await archive.getTile(1, 1, 0), 256, 256))[3], 0);
        assert.deepEqual((await pixel(await archive.getTile(1, 0, 0), 500, 500)).slice(0, 3), [170, 211, 223]);
        assert.equal(await archive.getTile(5, 0, 0), null, "di atas overzoom");
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

describe("mapcache.js", () => {
    test("tile disimpan, dipakai lagi tanpa request, dan tetap ada saat server gagal", async () => {
        const template = new URL("./fixtures/Box.bin?tile={z}-{x}-{y}", location.href).href;
        const tiles = cachedTiles(template, { name: "crootjs-uji-tiles", maxAge: 7, subdomains: [] });
        await tiles.clear();
        let requests = 0;
        const original = window.fetch;
        window.fetch = (...args) => {
            requests++;
            return original(...args);
        };
        try {
            const first = await tiles.getTile(3, 1, 2);
            assert.ok(first instanceof Blob && first.size > 0);
            await tiles.getTile(3, 1, 2);
            assert.equal(requests, 1, "tile kedua harus dari cache");
            assert.equal(await tiles.count(), 1);
            // Tile dianggap lama (maxAge 0) dan server tidak terjangkau: yang tersimpan dipakai.
            const stale = cachedTiles(template, { name: "crootjs-uji-tiles", maxAge: 0, subdomains: [] });
            window.fetch = () => Promise.reject(new TypeError("Failed to fetch"));
            const offline = await stale.getTile(3, 1, 2);
            assert.equal(offline.size, first.size);
            assert.equal(await stale.getTile(3, 0, 0), null, "tile yang belum pernah dilihat");
        } finally {
            window.fetch = original;
            await tiles.clear();
        }
    });
    test("downloadArea: server OSM ditolak, server sendiri diunduh", async () => {
        const osm = await cachedTiles().downloadArea([107.5, -7, 107.7, -6.8], 10, 12);
        assert.ok(osm.error && osm.error.includes("OpenStreetMap"));
        const tiles = cachedTiles(new URL("./fixtures/Box.bin?tile={z}-{x}-{y}", location.href).href, { name: "crootjs-uji-unduh", subdomains: [] });
        const progress = [];
        const result = await tiles.downloadArea([107.5, -7, 107.7, -6.8], 0, 2, (done, total) => progress.push([done, total]));
        assert.deepEqual([result.total, result.saved, result.failed, result.error], [3, 3, 0, null]);
        assert.deepEqual(progress[progress.length - 1], [3, 3]);
        assert.equal(await tiles.count(), 3);
        await tiles.clear();
    });
    test("atribusi OSM untuk sumber tile object dari server OSM", () => {
        const id = newMap({ tiles: { url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", getTile: () => null } });
        const text = document.getElementById(id).querySelector(".crootjs-map-attribution").textContent;
        assert.ok(text.includes("OpenStreetMap"), text);
    });
});
