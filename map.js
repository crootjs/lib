import { parseGeoJSON, getBBox } from "./geo.js";

// Halaman yang menampilkan peta hampir selalu juga membaca datanya. Fungsi geo.js diekspor
// ulang dari sini supaya cukup satu import - dan supaya geo.js tidak terunduh dua kali
// (sekali sebagai geo.min.js oleh halaman, sekali sebagai ./geo.js oleh modul ini).
export * from "./geo.js";

const TILE_SIZE = 256;
const MAX_LATITUDE = 85.0511287798; // batas lintang proyeksi Web Mercator
const DEFAULT_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIBUTION = Symbol("osm"); // penanda atribusi bawaan untuk DEFAULT_TILES
const SVG_NS = "http://www.w3.org/2000/svg";
const DRAG_THRESHOLD = 4;       // piksel gerakan sebelum sebuah tekanan dianggap geser, bukan klik
const LONG_PRESS_MS = 500;      // lama jari ditahan diam sebelum dianggap "klik kanan" di layar sentuh
const REBUILD_DISTANCE = 4096;  // piksel geser sebelum path SVG dihitung ulang
const SINGLE_POINT_ZOOM = 17;   // zoom fitMap untuk data yang hanya berupa satu titik
const ZOOM_DURATION = 200;      // ms

// Opsi style -> properti CSS SVG-nya.
const STYLE_PROPERTIES = {
    stroke: "stroke",
    strokeWidth: "stroke-width",
    strokeOpacity: "stroke-opacity",
    fill: "fill",
    fillOpacity: "fill-opacity",
    strokeDasharray: "stroke-dasharray",
    lineCap: "stroke-linecap",
    lineJoin: "stroke-linejoin"
};
const LABEL_CELL = 64;          // piksel; ukuran sel grid pencari tabrakan label
const HIT_TOLERANCE = 10;       // piksel; jarak klik dari garis di canvas yang masih dihitung kena

// Gaya bawaan bentuk yang digambar di canvas - sama dengan kelas CSS bentuk SVG di bawah.
const CANVAS_DEFAULTS = {
    polygon: { stroke: "#2563eb", strokeWidth: 2, strokeOpacity: 1, fill: "#2563eb", fillOpacity: 0.25, lineCap: "butt", lineJoin: "round" },
    line: { stroke: "#2563eb", strokeWidth: 3, strokeOpacity: 1, lineCap: "round", lineJoin: "round" },
    point: { stroke: "#fff", strokeWidth: 2, strokeOpacity: 1, fill: "#2563eb", fillOpacity: 1, lineCap: "butt", lineJoin: "miter" }
};

const maps = new Map();        // id elemen -> state peta
const records = new WeakMap(); // elemen SVG -> { feature, layer, shape } pemiliknya
const taps = new WeakMap();    // elemen milik modul tambahan -> function yang menangani tap padanya

const CORNERS = ["top-left", "top-right", "bottom-left", "bottom-right"];

function injectStyles() {
    if (document.getElementById("crootjs-map-style")) return;
    const style = document.createElement("style");
    style.id = "crootjs-map-style";
    style.textContent = `
.crootjs-map {
    position: absolute;
    inset: 0;
    z-index: 0;
    overflow: hidden;
    background-color: #e5e3df;
    cursor: grab;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 13px;
    line-height: 1.4;
    color: #1f2937;
}
.crootjs-map:focus-visible { outline: 2px solid #2563eb; outline-offset: -2px; }
.crootjs-map-dragging { cursor: grabbing; }
.crootjs-map-tiles,
.crootjs-map svg.crootjs-map-vectors {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    max-width: none;
}
/* z-index di sini membuat tiap lapisan punya urutan tumpuk sendiri: z-index gambar tile
   hanya berlaku di antara sesama tile, tidak sampai menutupi lapisan data di atasnya. */
.crootjs-map-tiles { z-index: 0; }
/* Gambar bergeoreferensi (image overlay): di atas tile, di bawah data. */
.crootjs-map-underlay {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    z-index: 0;
    pointer-events: none;
}
.crootjs-map-underlay > * { position: absolute; left: 0; top: 0; transform-origin: 0 0; max-width: none; max-height: none; }
/* Lapisan ber-renderer canvas: di bawah lapisan SVG. Klik dan hover-nya dihitung sendiri. */
.crootjs-map canvas.crootjs-map-canvas {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    z-index: 1;
    pointer-events: none;
}
.crootjs-map svg.crootjs-map-vectors { z-index: 1; }
.crootjs-map-pointer { cursor: pointer; }
.crootjs-map-capturing, .crootjs-map-capturing .crootjs-map-vectors path, .crootjs-map-capturing .crootjs-map-vectors circle { cursor: crosshair; }
/* Label fitur: z-index sama dengan data, tapi letaknya sesudah SVG jadi tampil di atasnya. */
.crootjs-map-labels {
    position: absolute;
    left: 0;
    top: 0;
    z-index: 1;
    pointer-events: none;
}
.crootjs-map-label {
    position: absolute;
    left: 0;
    top: 0;
    white-space: nowrap;
    font-size: 12px;
    font-weight: 600;
    color: #1f2937;
    text-shadow: 0 0 2px #fff, 0 0 2px #fff, 0 0 3px #fff, 0 0 3px #fff;
}
.crootjs-map-tooltip {
    position: absolute;
    left: 0;
    top: 0;
    z-index: 3;
    max-width: 240px;
    padding: 3px 7px;
    border-radius: 4px;
    background-color: rgba(17, 24, 39, 0.9);
    color: #fff;
    font-size: 12px;
    pointer-events: none;
    overflow-wrap: anywhere;
}
/* Tempat modul tambahan (marker, penanda lokasi) menaruh elemen HTML-nya: di atas data,
   di bawah popup. Lapisannya sendiri tembus klik; hanya elemen di dalamnya yang bisa diklik. */
.crootjs-map-overlay {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    z-index: 2;
    pointer-events: none;
}
.crootjs-map-overlay > * { pointer-events: auto; }
.crootjs-map-corner {
    position: absolute;
    z-index: 4;
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 10px;
    pointer-events: none;
}
.crootjs-map-corner > * { pointer-events: auto; cursor: auto; }
.crootjs-map-top-left { left: 0; top: 0; align-items: flex-start; }
.crootjs-map-top-right { right: 0; top: 0; align-items: flex-end; }
.crootjs-map-bottom-left { left: 0; bottom: 0; align-items: flex-start; flex-direction: column-reverse; }
/* naik sedikit supaya tidak menimpa atribusi peta dasar di pojok ini */
.crootjs-map-bottom-right { right: 0; bottom: 14px; align-items: flex-end; flex-direction: column-reverse; }
.crootjs-map img.crootjs-map-tile {
    position: absolute;
    max-width: none;
    max-height: none;
    margin: 0;
    padding: 0;
    border: 0;
    opacity: 0;
    transition: opacity 150ms linear;
    pointer-events: none;
}
.crootjs-map img.crootjs-map-tile-loaded { opacity: 1; }
.crootjs-map-vectors path,
.crootjs-map-vectors circle { vector-effect: non-scaling-stroke; cursor: pointer; }
.crootjs-map-polygon { fill: #2563eb; fill-opacity: 0.25; fill-rule: evenodd; stroke: #2563eb; stroke-width: 2; stroke-linejoin: round; }
.crootjs-map-line { fill: none; stroke: #2563eb; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
.crootjs-map-hit { fill: none; stroke: transparent; stroke-width: 20; pointer-events: stroke; }
.crootjs-map-point { fill: #2563eb; stroke: #fff; stroke-width: 2; }
.crootjs-map-popup {
    position: absolute;
    left: 0;
    top: 0;
    z-index: 3;
    box-sizing: border-box;
    max-width: 260px;
    padding: 10px 30px 10px 12px;
    border-radius: 8px;
    background-color: #fff;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
    cursor: auto;
    user-select: text;
    -webkit-user-select: text;
    overflow-wrap: anywhere;
}
.crootjs-map-popup::after {
    content: "";
    position: absolute;
    left: 50%;
    top: 100%;
    margin-left: -8px;
    border: 8px solid transparent;
    border-top-color: #fff;
    pointer-events: none;
}
.crootjs-map button.crootjs-map-popup-close {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 26px;
    height: 26px;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 4px;
    background: none;
    color: #6b7280;
    font: inherit;
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
}
.crootjs-map button.crootjs-map-popup-close:hover { background-color: #f3f4f6; color: #111827; }
.crootjs-map-zoom {
    display: flex;
    flex-direction: column;
    border-radius: 6px;
    overflow: hidden;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
}
.crootjs-map-zoom button {
    width: 32px;
    min-width: 0;
    height: 32px;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 0;
    background-color: #fff;
    color: #1f2937;
    font: inherit;
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
}
.crootjs-map-zoom button + button { border-top: 1px solid #d1d5db; }
.crootjs-map-zoom button:hover { background-color: #f3f4f6; }
.crootjs-map-zoom button:disabled { color: #9ca3af; cursor: default; }
.crootjs-map-attribution {
    position: absolute;
    right: 0;
    bottom: 0;
    z-index: 4;
    padding: 1px 6px;
    background-color: rgba(255, 255, 255, 0.8);
    font-size: 11px;
    cursor: auto;
}
.crootjs-map-attribution a { color: #1d4ed8; text-decoration: none; }
.crootjs-map-attribution[hidden] { display: none; }
`;
    // Di awal <head> (sesudah style CrootJS lain), bukan di akhir: CSS halaman yang ditautkan
    // sesudahnya menang tanpa !important, jadi tampilan bawaan ini mudah ditimpa.
    const previous = [...document.head.querySelectorAll('style[id^="crootjs-"]')].pop();
    if (previous) previous.after(style);
    else document.head.prepend(style);
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

// Proyeksi Web Mercator: posisi GeoJSON [lng, lat] <-> titik [x, y] dengan seluruh dunia
// dipetakan ke rentang 0..1 (x ke timur, y ke selatan). Dikalikan ukuran dunia dalam
// piksel pada sebuah zoom, hasilnya koordinat piksel.
function project(position) {
    const sin = Math.sin(clamp(position[1], -MAX_LATITUDE, MAX_LATITUDE) * Math.PI / 180);
    return [
        (position[0] + 180) / 360,
        0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)
    ];
}

function unproject(point) {
    return [
        point[0] * 360 - 180,
        Math.atan(Math.sinh(Math.PI * (1 - 2 * point[1]))) * 180 / Math.PI
    ];
}

function worldSize(zoom) {
    return TILE_SIZE * Math.pow(2, zoom);
}

function getMap(id) {
    const state = maps.get(id);
    if (!state) console.warn(`Peta dengan ID "${id}" belum dibuat. Panggil createMap("${id}") lebih dulu.`);
    return state;
}

// Pusat tampilan disimpan sebagai titik proyeksi (state.x, state.y), bukan [lng, lat],
// supaya geser dan zoom tidak bolak-balik lewat proyeksi.
function setView(state, x, y, zoom) {
    if (Number.isFinite(zoom)) state.zoom = clamp(zoom, state.minZoom, state.maxZoom);
    if (Number.isFinite(x)) state.x = clamp(x, 0, 1);
    if (Number.isFinite(y)) state.y = clamp(y, 0, 1);
}

// Menggeser isi peta sejauh dx, dy piksel layar (mengikuti arah jari).
function panBy(state, dx, dy) {
    const world = worldSize(state.zoom);
    setView(state, state.x - dx / world, state.y - dy / world, state.zoom);
}

// Mengubah zoom dengan posisi di bawah `point` tetap berada di bawah `point`.
function zoomAround(state, zoom, point) {
    const before = worldSize(state.zoom);
    const after = worldSize(clamp(zoom, state.minZoom, state.maxZoom));
    const dx = point[0] - state.width / 2;
    const dy = point[1] - state.height / 2;
    setView(state, state.x + dx / before - dx / after, state.y + dy / before - dy / after, zoom);
}

function toPoint(state, position) {
    const world = worldSize(state.zoom);
    const point = project(position);
    return [
        (point[0] - state.x) * world + state.width / 2,
        (point[1] - state.y) * world + state.height / 2
    ];
}

function toPosition(state, point) {
    const world = worldSize(state.zoom);
    return unproject([
        state.x + (point[0] - state.width / 2) / world,
        state.y + (point[1] - state.height / 2) / world
    ]);
}

function requestRender(state) {
    if (state.renderFrame || state.removed) return;
    state.renderFrame = requestAnimationFrame(() => {
        state.renderFrame = 0;
        render(state);
    });
}

function render(state) {
    if (state.removed) return;
    state.width = state.root.clientWidth;
    state.height = state.root.clientHeight;
    renderTiles(state);
    renderLayerVisibility(state);
    renderVectors(state);
    renderCanvas(state);
    renderLabels(state);
    renderPopup(state);
    if (state.zoomIn) {
        state.zoomIn.disabled = state.zoom >= state.maxZoom;
        state.zoomOut.disabled = state.zoom <= state.minZoom;
    }

    // Pendengar onMapMove dipanggil di frame yang sama dengan gambar barunya, supaya elemen
    // yang mengikuti peta (marker) tidak tertinggal. Hanya kalau tampilannya memang berubah:
    // render juga terpicu oleh hal lain, misalnya tile yang selesai dimuat.
    const signature = [state.x, state.y, state.zoom, state.width, state.height].join(",");
    if (signature !== state.signature) {
        state.signature = signature;
        const view = currentView(state);
        state.moveHandlers.slice().forEach(runFunction => runFunction(view));
    }
}

function currentView(state) {
    return { center: unproject([state.x, state.y]), zoom: state.zoom };
}

function subscribeMove(state, runFunction) {
    state.moveHandlers.push(runFunction);
    return function stop() {
        const index = state.moveHandlers.indexOf(runFunction);
        if (index !== -1) state.moveHandlers.splice(index, 1);
    };
}

// Menaruh sebuah elemen di salah satu pojok peta. Elemennya dibungkus supaya klik dan
// geser di dalamnya tidak ikut menggeser peta.
function addControl(state, element, corner) {
    const name = CORNERS.includes(corner) ? corner : "top-right";
    if (!state.corners[name]) {
        const box = document.createElement("div");
        box.className = "crootjs-map-corner crootjs-map-" + name;
        state.root.appendChild(box);
        state.corners[name] = box;
    }
    const slot = document.createElement("div");
    slot.appendChild(element);
    isolate(slot);
    state.corners[name].appendChild(slot);
    return function remove() {
        slot.remove();
    };
}

// Pola URL tile -> URL satu tile. {s} subdomain (bergiliran supaya beban server tersebar),
// {r} "@2x" di layar retina, {-y} nomor baris skema TMS (dihitung dari bawah).
function tileSource(state, template, z, x, y) {
    const subdomains = state.subdomains;
    return template
        .replace(/\{s\}/g, subdomains.length ? subdomains[Math.abs(x + y) % subdomains.length] : "")
        .replace(/\{r\}/g, window.devicePixelRatio > 1 ? "@2x" : "")
        .replace(/\{z\}/g, z)
        .replace(/\{x\}/g, x)
        .replace(/\{-y\}/g, Math.pow(2, z) - 1 - y)
        .replace(/\{y\}/g, y);
}

// Mengisi gambar tile dari sumbernya: pola URL (teks), atau object { getTile(z, x, y) } yang
// mengembalikan Promise berisi Blob, URL, atau null (tidak ada tile) - misalnya file PMTiles
// dari mapoffline.js. Blob ditampilkan lewat object URL yang dilepas saat tile dihapus.
function loadTile(state, img, source, z, x, y) {
    if (typeof source === "string") {
        img.src = tileSource(state, source, z, x, y);
        return;
    }
    Promise.resolve()
        .then(() => source.getTile(z, x, y))
        .then(result => {
            if (img.crootjsRemoved) return;
            if (result instanceof Blob) {
                img.crootjsObjectURL = URL.createObjectURL(result);
                img.src = img.crootjsObjectURL;
            } else if (typeof result === "string") {
                img.src = result;
            } else if (img.onerror) {
                img.onerror();
            }
        })
        .catch(error => {
            console.warn(`Tile ${z}/${x}/${y} gagal dibaca: ${error.message}`);
            if (!img.crootjsRemoved && img.onerror) img.onerror();
        });
}

function tileImage(onload) {
    const img = document.createElement("img");
    img.className = "crootjs-map-tile";
    img.alt = "";
    img.draggable = false;
    img.onload = () => {
        img.classList.add("crootjs-map-tile-loaded");
        if (onload) onload();
    };
    return img;
}

function addTile(state, z, x, y, key) {
    const tile = { z, x, y, loaded: false, labels: [] };
    const done = () => {
        tile.loaded = true;
        requestRender(state);
    };
    const img = tile.img = tileImage(done);
    // Tile yang gagal dimuat diganti errorTiles kalau ada, atau dibiarkan kosong. Keduanya
    // tetap dihitung selesai supaya tidak menahan pembersihan tile lama di renderTiles.
    img.onerror = () => {
        if (state.errorTileURL && img.getAttribute("src") !== state.errorTileURL) {
            img.src = state.errorTileURL;
        } else {
            img.onerror = null;
            done();
        }
    };
    loadTile(state, img, state.tileURL, z, x, y);
    state.tilePane.appendChild(img);
    // Tile label (transparan) menumpang posisi tile dasarnya. Yang gagal dimuat dibiarkan kosong.
    tile.labels = state.labelURLs.map(template => {
        const label = tileImage();
        loadTile(state, label, template, z, x, y);
        state.tilePane.appendChild(label);
        return label;
    });
    state.tiles.set(key, tile);
}

function removeTile(state, key) {
    const tile = state.tiles.get(key);
    [tile.img, ...tile.labels].forEach(img => {
        img.onload = null;
        img.onerror = null;
        img.crootjsRemoved = true;
        if (img.crootjsObjectURL) URL.revokeObjectURL(img.crootjsObjectURL);
        img.remove();
    });
    state.tiles.delete(key);
}

// Mengubah rentang zoom yang diizinkan; nilai yang bukan angka membiarkan batas itu. Zoom
// sekarang dipotong ke rentang baru.
function applyZoomRange(state, minZoom, maxZoom) {
    if (Number.isFinite(minZoom)) state.minZoom = minZoom;
    if (Number.isFinite(maxZoom)) state.maxZoom = maxZoom;
    if (state.minZoom > state.maxZoom) state.minZoom = state.maxZoom;
    setView(state, NaN, NaN, state.zoom);
}

// Memasang (atau mengganti) peta dasar. Tile dari peta dasar lama dibiarkan sampai tile
// baru selesai dimuat - kuncinya diberi nomor generasi, jadi renderTiles menganggapnya
// tile "lama" seperti saat zoom berubah - supaya peta tidak berkedip kosong.
function configureTiles(state, tiles, options) {
    const useDefault = tiles === undefined || tiles === true;
    state.tileURL = useDefault ? DEFAULT_TILES : (tiles || null);
    state.labelURLs = state.tileURL ? [].concat(options.labels || []) : [];
    state.maxNativeZoom = Number.isFinite(options.maxNativeZoom) ? options.maxNativeZoom : Infinity;
    state.subdomains = [].concat(options.subdomains === undefined ? ["a", "b", "c"] : options.subdomains);
    if (typeof options.subdomains === "string") state.subdomains = options.subdomains.split("");
    state.errorTileURL = options.errorTiles || null;
    // Berbeda dari opsi tile lain, minZoom/maxZoom hanya berubah kalau disebut.
    applyZoomRange(state, options.minZoom, options.maxZoom);
    state.tileGeneration = (state.tileGeneration || 0) + 1;
    if (!state.tileURL) [...state.tiles.keys()].forEach(key => removeTile(state, key));
    state.baseAttribution = options.attribution || (useDefault ? OSM_ATTRIBUTION : null);
    renderAttribution(state);
}

function renderTiles(state) {
    if (!state.tileURL) return;

    // Zoom boleh pecahan (saat pinch atau animasi); tile diambil dari level bulat terdekat
    // lalu diskalakan. Di atas maxNativeZoom server tidak punya tile lagi, jadi tile level
    // itu yang diperbesar (overzoom).
    const tileZoom = clamp(Math.round(state.zoom), 0, Math.floor(Math.min(state.maxZoom, state.maxNativeZoom)));
    const count = Math.pow(2, tileZoom);
    const world = worldSize(state.zoom);
    const left = state.x * world - state.width / 2;  // tepi kiri-atas tampilan, dalam piksel dunia
    const top = state.y * world - state.height / 2;
    const size = world / count;

    const needed = new Set();
    const xEnd = Math.min(count - 1, Math.floor((left + state.width) / size));
    const yEnd = Math.min(count - 1, Math.floor((top + state.height) / size));
    for (let x = Math.max(0, Math.floor(left / size)); x <= xEnd; x++) {
        for (let y = Math.max(0, Math.floor(top / size)); y <= yEnd; y++) {
            const key = `${state.tileGeneration}:${tileZoom}/${x}/${y}`;
            needed.add(key);
            if (!state.tiles.has(key)) addTile(state, tileZoom, x, y, key);
        }
    }

    let loading = false;
    needed.forEach(key => {
        if (!state.tiles.get(key).loaded) loading = true;
    });

    state.tiles.forEach((tile, key) => {
        const tileSize = world / Math.pow(2, tile.z);
        const x = tile.x * tileSize - left;
        const y = tile.y * tileSize - top;
        const visible = x < state.width && y < state.height && x + tileSize > 0 && y + tileSize > 0;
        // Tile dari level zoom sebelumnya (atau peta dasar sebelumnya) dipertahankan
        // (diskalakan) sampai tile sekarang selesai dimuat, supaya peta tidak berkedip kosong
        // setiap kali zoom atau peta dasarnya berubah.
        const keep = needed.has(key) || (loading && tile.loaded && visible && Math.abs(tile.z - tileZoom) <= 2);
        if (!keep) {
            removeTile(state, key);
            return;
        }
        const current = tile.z === tileZoom && key.startsWith(state.tileGeneration + ":");
        // Tepi kiri dan kanan dibulatkan sendiri-sendiri supaya tile bersebelahan tidak
        // menyisakan garis celah pada zoom pecahan.
        const px = Math.round(x);
        const py = Math.round(y);
        tile.img.style.left = px + "px";
        tile.img.style.top = py + "px";
        tile.img.style.width = (Math.round(x + tileSize) - px) + "px";
        tile.img.style.height = (Math.round(y + tileSize) - py) + "px";
        tile.img.style.zIndex = current ? 1 : 0;
        // Label selalu di atas semua tile dasar, termasuk tile dasar lama yang masih dipertahankan.
        tile.labels.forEach(label => {
            label.style.cssText = tile.img.style.cssText;
            label.style.zIndex = current ? 3 : 2;
        });
    });
}

// Geometri GeoJSON -> daftar bentuk siap gambar, dengan koordinat sudah diproyeksikan
// sekali di sini (bukan di setiap frame).
function shapesOf(geometry) {
    if (!geometry) return [];
    const ring = positions => positions.map(project);
    const coordinates = geometry.coordinates;
    switch (geometry.type) {
        case "Point": return [{ kind: "point", point: project(coordinates) }];
        case "MultiPoint": return coordinates.map(position => ({ kind: "point", point: project(position) }));
        case "LineString": return [{ kind: "line", rings: [ring(coordinates)] }];
        case "MultiLineString": return [{ kind: "line", rings: coordinates.map(ring) }];
        case "Polygon": return [{ kind: "polygon", rings: coordinates.map(ring) }];
        case "MultiPolygon": return [{ kind: "polygon", rings: coordinates.flat().map(ring) }];
        case "GeometryCollection": return geometry.geometries.flatMap(shapesOf);
        default: return [];
    }
}

// Douglas-Peucker: titik yang menyimpang kurang dari `tolerance` dari garis lurus di antara
// tetangganya dibuang. Koordinat dan tolerance dalam satuan proyeksi (0..1).
function simplifyRing(points, tolerance) {
    if (points.length < 3) return points;
    const keep = new Uint8Array(points.length);
    keep[0] = keep[points.length - 1] = 1;
    const limit = tolerance * tolerance;
    const stack = [[0, points.length - 1]];
    while (stack.length) {
        const [first, last] = stack.pop();
        const [ax, ay] = points[first];
        const dx = points[last][0] - ax;
        const dy = points[last][1] - ay;
        const length = dx * dx + dy * dy;
        let farthest = 0;
        let index = 0;
        for (let i = first + 1; i < last; i++) {
            let t = length ? ((points[i][0] - ax) * dx + (points[i][1] - ay) * dy) / length : 0;
            t = clamp(t, 0, 1);
            const ex = points[i][0] - ax - t * dx;
            const ey = points[i][1] - ay - t * dy;
            const distance = ex * ex + ey * ey;
            if (distance > farthest) {
                farthest = distance;
                index = i;
            }
        }
        if (farthest > limit) {
            keep[index] = 1;
            stack.push([first, index], [index, last]);
        }
    }
    return points.filter((point, i) => keep[i]);
}

// Ring sebuah bentuk untuk digambar pada `zoom`. Dengan opsi simplify, ring disederhanakan
// per level zoom bulat (dibulatkan ke atas, jadi tetap cukup halus sampai zoom berikutnya)
// dan hasilnya disimpan.
function ringsAt(layer, shape, zoom) {
    if (!layer.simplify || shape.kind === "point") return shape.rings;
    const level = Math.ceil(zoom);
    shape.simplified = shape.simplified || {};
    if (!shape.simplified[level]) {
        const tolerance = layer.simplify / worldSize(level);
        shape.simplified[level] = shape.rings.map(ring => simplifyRing(ring, tolerance));
    }
    return shape.simplified[level];
}

// Menulis koordinat sebuah bentuk dalam piksel relatif terhadap titik acuan `built`.
function drawShape(layer, shape, built, size) {
    const local = value => Math.round(value * size * 10) / 10;
    if (shape.kind === "point") {
        shape.element.setAttribute("cx", local(shape.point[0] - built.x));
        shape.element.setAttribute("cy", local(shape.point[1] - built.y));
        return;
    }
    const d = ringsAt(layer, shape, built.zoom)
        .filter(ring => ring.length > 0)
        .map(ring => "M" + ring.map(point => local(point[0] - built.x) + " " + local(point[1] - built.y)).join("L") + (shape.kind === "polygon" ? "Z" : ""))
        .join("");
    shape.element.setAttribute("d", d);
    if (shape.hit) shape.hit.setAttribute("d", d);
}

function renderVectors(state) {
    const world = worldSize(state.zoom);
    let built = state.built;

    // Path SVG ditulis sekali dalam piksel relatif terhadap pusat tampilan saat itu; geser
    // dan zoom sesudahnya cukup mengubah transform grupnya. Path baru dihitung ulang kalau
    // tampilan sudah menjauh dari titik acuan itu: SVG menghitung dengan presisi tunggal,
    // jadi koordinat piksel yang terlalu besar (atau skala yang terlalu jauh) membuat
    // bentuk bergeser beberapa piksel pada zoom tinggi.
    if (!built
        || Math.abs(state.zoom - built.zoom) > 1
        || Math.abs(state.x - built.x) * world > REBUILD_DISTANCE
        || Math.abs(state.y - built.y) * world > REBUILD_DISTANCE) {
        built = state.built = { x: state.x, y: state.y, zoom: state.zoom, scale: 0 };
        state.layers.forEach(layer => {
            if (!layer.canvas) layer.shapes.forEach(shape => drawShape(layer, shape, built, world));
        });
    }

    const scale = Math.pow(2, state.zoom - built.zoom);
    const tx = (built.x - state.x) * world + state.width / 2;
    const ty = (built.y - state.y) * world + state.height / 2;
    state.group.setAttribute("transform", `translate(${tx} ${ty}) scale(${scale})`);

    if (scale !== built.scale) {
        built.scale = scale;
        // Lingkaran ikut diskalakan bersama grupnya; jari-jarinya dibagi skala supaya
        // ukurannya di layar tetap.
        state.layers.forEach(layer => layer.shapes.forEach(shape => {
            if (shape.kind === "point" && shape.element) shape.element.setAttribute("r", shape.radius / scale);
        }));
    }
}

function canvasDash(value) {
    if (value === undefined || value === null || value === "none") return [];
    const parts = Array.isArray(value) ? value : String(value).split(/[\s,]+/);
    return parts.map(Number).filter(Number.isFinite);
}

// Lapisan ber-renderer canvas digambar ulang seluruhnya di setiap frame, langsung dalam
// piksel layar. Ribuan garis tetap ringan karena tidak ada elemen DOM per bentuk.
function renderCanvas(state) {
    const canvas = state.canvas;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(state.width * ratio);
    const height = Math.round(state.height * ratio);
    if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
    }
    const context = canvas.getContext("2d");
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, width, height);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    const world = worldSize(state.zoom);
    const left = state.x - state.width / 2 / world;   // tepi tampilan, dalam satuan proyeksi
    const top = state.y - state.height / 2 / world;
    const right = state.x + state.width / 2 / world;
    const bottom = state.y + state.height / 2 / world;
    const margin = 20 / world;
    const sx = value => (value - left) * world;
    const sy = value => (value - top) * world;

    state.layers.forEach(layer => {
        if (!layer.canvas || !layer.shown) return;
        // Titik digambar paling atas dalam satu lapisan, sama seperti di SVG.
        ["polygon", "line", "point"].forEach(kind => layer.shapes.forEach(shape => {
            if (shape.kind !== kind) return;
            const box = shape.bbox;
            if (box[2] < left - margin || box[0] > right + margin || box[3] < top - margin || box[1] > bottom + margin) return;
            const style = Object.assign({}, CANVAS_DEFAULTS[kind], shape.style);
            context.beginPath();
            if (kind === "point") {
                context.arc(sx(shape.point[0]), sy(shape.point[1]), shape.radius, 0, 2 * Math.PI);
            } else {
                ringsAt(layer, shape, state.zoom).forEach(ring => {
                    ring.forEach((point, index) => {
                        if (index === 0) context.moveTo(sx(point[0]), sy(point[1]));
                        else context.lineTo(sx(point[0]), sy(point[1]));
                    });
                    if (kind === "polygon") context.closePath();
                });
            }
            if (kind !== "line" && style.fill !== "none") {
                context.globalAlpha = Number(style.fillOpacity);
                context.fillStyle = style.fill;
                context.fill("evenodd");
            }
            if (style.stroke !== "none" && Number(style.strokeWidth) > 0) {
                context.globalAlpha = Number(style.strokeOpacity);
                context.strokeStyle = style.stroke;
                context.lineWidth = Number(style.strokeWidth);
                context.lineCap = style.lineCap;
                context.lineJoin = style.lineJoin;
                context.setLineDash(canvasDash(style.strokeDasharray));
                context.stroke();
            }
            context.globalAlpha = 1;
        }));
    });
}

function segmentDistance(point, from, to) {
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const length = dx * dx + dy * dy;
    const t = length ? clamp(((point[0] - from[0]) * dx + (point[1] - from[1]) * dy) / length, 0, 1) : 0;
    return Math.hypot(point[0] - from[0] - t * dx, point[1] - from[1] - t * dy);
}

// Bentuk canvas yang berada di bawah titik layar `point`: lapisan teratas dulu, lalu bentuk
// yang digambar belakangan. Hasilnya { feature, layer, shape } seperti records, atau undefined.
function canvasHit(state, point) {
    if (!state.canvas) return undefined;
    const world = worldSize(state.zoom);
    const at = [state.x + (point[0] - state.width / 2) / world, state.y + (point[1] - state.height / 2) / world];
    const toScreen = p => [(p[0] - at[0]) * world, (p[1] - at[1]) * world]; // relatif terhadap `point`
    for (let l = state.layers.length - 1; l >= 0; l--) {
        const layer = state.layers[l];
        if (!layer.canvas || !layer.shown) continue;
        for (const kind of ["point", "line", "polygon"]) {
            for (let s = layer.shapes.length - 1; s >= 0; s--) {
                const shape = layer.shapes[s];
                if (shape.kind !== kind) continue;
                const reach = (HIT_TOLERANCE + (shape.radius || 0)) / world;
                const box = shape.bbox;
                if (at[0] < box[0] - reach || at[0] > box[2] + reach || at[1] < box[1] - reach || at[1] > box[3] + reach) continue;
                const width = Number((shape.style || {}).strokeWidth) || CANVAS_DEFAULTS[kind].strokeWidth;
                let hit = false;
                if (kind === "point") {
                    const p = toScreen(shape.point);
                    hit = Math.hypot(p[0], p[1]) <= shape.radius + width / 2 + 2;
                } else {
                    const rings = ringsAt(layer, shape, state.zoom).map(ring => ring.map(toScreen));
                    const limit = kind === "line" ? Math.max(HIT_TOLERANCE, width / 2) : width / 2 + 3;
                    hit = rings.some(ring => ring.some((p, i) => i > 0 && segmentDistance([0, 0], ring[i - 1], p) <= limit));
                    if (!hit && kind === "polygon") {
                        // Ganjil-genap: titik di dalam lubang polygon tidak dihitung kena.
                        let inside = false;
                        rings.forEach(ring => {
                            for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
                                if ((ring[i][1] > 0) !== (ring[j][1] > 0)
                                    && 0 < (ring[j][0] - ring[i][0]) * (0 - ring[i][1]) / (ring[j][1] - ring[i][1]) + ring[i][0]) inside = !inside;
                            }
                        });
                        hit = inside;
                    }
                }
                if (hit) return { feature: shape.feature, layer, shape };
            }
        }
    }
    return undefined;
}

// Fitur di bawah titik layar `point`: bentuk SVG yang jadi target event, atau bentuk canvas.
function featureAt(state, target, point) {
    return records.get(target) || canvasHit(state, point);
}

function inZoomRange(zoom, range) {
    return zoom >= range.minZoom && zoom <= range.maxZoom;
}

// Lapisan tampil kalau tidak disembunyikan dan zoom sekarang di dalam minZoom..maxZoom-nya.
function layerShown(state, layer) {
    return layer.visible && inZoomRange(state.zoom, layer);
}

function renderLayerVisibility(state) {
    state.layers.forEach(layer => {
        const shown = layerShown(state, layer);
        if (shown === layer.shown) return;
        layer.shown = shown;
        layer.group.style.display = shown ? "" : "none";
        if (!shown && state.hover && state.hover.layer === layer) clearHover(state);
        if (!shown && state.popup && state.popup.layer === layer) hidePopup(state);
    });
}

// Menulis gaya sebuah bentuk dari awal: gaya lapisan, lalu gaya hover di atasnya.
function applyStyle(layer, shape, hovered) {
    const base = (typeof layer.style === "function" ? layer.style(shape.feature) : layer.style) || {};
    const style = hovered ? Object.assign({}, base, layer.hoverStyle) : base;
    if (layer.canvas) {
        // Bentuk canvas tidak punya elemen: gayanya disimpan dan dipakai renderCanvas.
        shape.style = {};
        Object.keys(STYLE_PROPERTIES).forEach(key => {
            if (style[key] !== undefined && style[key] !== null) shape.style[key] = style[key];
        });
        shape.radius = Number.isFinite(style.radius) ? style.radius : 7;
        requestRender(layer.state);
        return;
    }
    const element = shape.element;
    element.removeAttribute("style");
    Object.keys(STYLE_PROPERTIES).forEach(key => {
        // Garis tidak pernah diisi, walaupun style yang sama dipakai untuk polygon.
        if (style[key] === undefined || style[key] === null || (shape.kind === "line" && key.startsWith("fill"))) return;
        const value = Array.isArray(style[key]) ? style[key].join(" ") : style[key];
        element.style.setProperty(STYLE_PROPERTIES[key], value);
    });
    if (shape.kind === "point") {
        const radius = Number.isFinite(style.radius) ? style.radius : 7;
        if (radius !== shape.radius) {
            shape.radius = radius;
            // renderVectors menulis ulang jari-jari semua titik kalau skalanya dianggap berubah.
            if (layer.state.built) layer.state.built.scale = 0;
            requestRender(layer.state);
        }
    }
}

function setHover(state, layer, feature) {
    if (state.hover && state.hover.layer === layer && state.hover.feature === feature) return;
    clearHover(state);
    state.hover = { layer, feature };
    if (layer.hoverStyle) layer.shapes.forEach(shape => {
        if (shape.feature === feature) applyStyle(layer, shape, true);
    });
    const content = layer.tooltip ? layer.tooltip(feature) : null;
    if (content === null || content === undefined || content === "") return;
    if (!state.tooltipElement) {
        state.tooltipElement = document.createElement("div");
        state.tooltipElement.className = "crootjs-map-tooltip";
        state.tooltipElement.setAttribute("role", "tooltip");
        state.root.appendChild(state.tooltipElement);
    }
    if (content instanceof Node) {
        state.tooltipElement.replaceChildren(content);
    } else {
        state.tooltipElement.textContent = String(content);
    }
    state.tooltipElement.hidden = false;
    state.hover.tooltip = true;
}

function clearHover(state) {
    const hover = state.hover;
    if (!hover) return;
    state.hover = null;
    if (hover.layer.hoverStyle) hover.layer.shapes.forEach(shape => {
        if (shape.feature === hover.feature) applyStyle(hover.layer, shape, false);
    });
    if (state.tooltipElement) state.tooltipElement.hidden = true;
}

function moveTooltip(state, point) {
    if (!state.hover || !state.hover.tooltip) return;
    const element = state.tooltipElement;
    // Di kanan-bawah kursor, atau di kirinya kalau sudah mepet tepi kanan peta.
    const flip = point[0] + 14 + element.offsetWidth > state.width;
    const x = flip ? point[0] - 10 - element.offsetWidth : point[0] + 14;
    element.style.transform = `translate(${Math.round(x)}px, ${Math.round(point[1] + 14)}px)`;
}

// Titik tempat label sebuah geometri ditaruh, dalam koordinat proyeksi: titiknya sendiri,
// tengah panjang garis (bagian terpanjang), atau titik berat polygon (yang terluas).
function labelAnchor(geometry) {
    if (!geometry) return null;
    const coordinates = geometry.coordinates;
    const lineMiddle = positions => {
        const points = positions.map(project);
        const lengths = points.slice(1).map((point, index) => Math.hypot(point[0] - points[index][0], point[1] - points[index][1]));
        let rest = lengths.reduce((sum, length) => sum + length, 0) / 2;
        for (let index = 0; index < lengths.length; index++) {
            if (rest <= lengths[index]) {
                const t = lengths[index] ? rest / lengths[index] : 0;
                const from = points[index];
                const to = points[index + 1];
                return { point: [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t], size: rest * 2 };
            }
            rest -= lengths[index];
        }
        return points.length ? { point: points[0], size: 0 } : null;
    };
    const centroid = rings => {
        const points = (rings[0] || []).map(project);
        let area = 0;
        let x = 0;
        let y = 0;
        for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
            const cross = points[previous][0] * points[index][1] - points[index][0] * points[previous][1];
            area += cross;
            x += (points[previous][0] + points[index][0]) * cross;
            y += (points[previous][1] + points[index][1]) * cross;
        }
        if (area === 0) return points.length ? { point: points[0], size: 0 } : null;
        return { point: [x / (3 * area), y / (3 * area)], size: Math.abs(area) / 2 };
    };
    const largest = candidates => candidates.filter(Boolean).reduce((best, item) => (!best || item.size > best.size ? item : best), null);
    switch (geometry.type) {
        case "Point": return project(coordinates);
        case "MultiPoint": return coordinates.length ? project(coordinates[0]) : null;
        case "LineString": return (lineMiddle(coordinates) || {}).point || null;
        case "MultiLineString": return (largest(coordinates.map(lineMiddle)) || {}).point || null;
        case "Polygon": return (centroid(coordinates) || {}).point || null;
        case "MultiPolygon": return (largest(coordinates.map(centroid)) || {}).point || null;
        case "GeometryCollection": return geometry.geometries.map(labelAnchor).find(Boolean) || null;
        default: return null;
    }
}

// Menaruh label semua lapisan. Label yang menabrak label lain yang sudah ditaruh lebih dulu
// disembunyikan; lapisan yang tampil di atas didahulukan, lalu urutan fitur di datanya.
function renderLabels(state) {
    const world = worldSize(state.zoom);
    const grid = new Map(); // "kolom,baris" -> kotak label yang sudah ditaruh di sel itu
    const collides = box => {
        for (let column = Math.floor(box[0] / LABEL_CELL); column <= Math.floor(box[2] / LABEL_CELL); column++) {
            for (let row = Math.floor(box[1] / LABEL_CELL); row <= Math.floor(box[3] / LABEL_CELL); row++) {
                const placed = grid.get(column + "," + row);
                if (placed && placed.some(other => box[0] < other[2] && box[2] > other[0] && box[1] < other[3] && box[3] > other[1])) return true;
            }
        }
        return false;
    };
    const occupy = box => {
        for (let column = Math.floor(box[0] / LABEL_CELL); column <= Math.floor(box[2] / LABEL_CELL); column++) {
            for (let row = Math.floor(box[1] / LABEL_CELL); row <= Math.floor(box[3] / LABEL_CELL); row++) {
                const key = column + "," + row;
                if (!grid.has(key)) grid.set(key, []);
                grid.get(key).push(box);
            }
        }
    };

    for (let index = state.layers.length - 1; index >= 0; index--) {
        const layer = state.layers[index];
        if (layer.labels.length === 0) continue;
        const active = layerShown(state, layer) && inZoomRange(state.zoom, layer.labelRange);
        layer.labels.forEach(label => {
            let show = false;
            if (active) {
                const x = (label.anchor[0] - state.x) * world + state.width / 2;
                const y = (label.anchor[1] - state.y) * world + state.height / 2;
                if (!label.width) {
                    label.width = label.element.offsetWidth;
                    label.height = label.element.offsetHeight;
                }
                const box = [x - label.width / 2 - 2, y - label.height / 2 - 2, x + label.width / 2 + 2, y + label.height / 2 + 2];
                const onScreen = box[2] > 0 && box[0] < state.width && box[3] > 0 && box[1] < state.height;
                if (onScreen && label.width && (layer.labelOverlap || !collides(box))) {
                    if (!layer.labelOverlap) occupy(box);
                    show = true;
                    const transform = `translate(${Math.round(box[0] + 2)}px, ${Math.round(box[1] + 2)}px)`;
                    if (transform !== label.transform) {
                        label.transform = transform;
                        label.element.style.transform = transform;
                    }
                }
            }
            if (show !== label.shown) {
                label.shown = show;
                label.element.style.visibility = show ? "" : "hidden";
            }
        });
    }
}

function renderPopup(state) {
    if (!state.popup) return;
    const world = worldSize(state.zoom);
    const x = (state.popup.x - state.x) * world + state.width / 2;
    const y = (state.popup.y - state.y) * world + state.height / 2 - state.popup.offset - 10;
    state.popupElement.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -100%)`;
}

function formatValue(value) {
    if (value === undefined || value === null) return "";
    return typeof value === "object" ? JSON.stringify(value) : String(value);
}

// Isi popup bawaan: daftar "nama: nilai" dari properties. Dipasang sebagai teks, bukan
// HTML - datanya bisa berasal dari URL atau file sembarang.
function defaultPopupContent(feature) {
    const entries = Object.entries(feature.properties || {});
    if (entries.length === 0) return null;
    const list = document.createElement("div");
    entries.forEach(([key, value]) => {
        const row = document.createElement("div");
        const name = document.createElement("b");
        name.textContent = key + ": ";
        row.append(name, formatValue(value));
        list.appendChild(row);
    });
    return list;
}

function openPopup(state, point, content, offset = 0) {
    if (content === null || content === undefined || content === "") {
        hidePopup(state);
        return;
    }
    if (!state.popupElement) {
        const element = document.createElement("div");
        element.className = "crootjs-map-popup";
        const close = document.createElement("button");
        close.type = "button";
        close.className = "crootjs-map-popup-close";
        close.setAttribute("aria-label", "Tutup");
        close.textContent = "×";
        close.addEventListener("click", () => hidePopup(state));
        const body = document.createElement("div");
        element.append(close, body);
        isolate(element);
        state.root.appendChild(element);
        state.popupElement = element;
        state.popupBody = body;
    }
    if (content instanceof Node) {
        state.popupBody.replaceChildren(content);
    } else {
        state.popupBody.textContent = String(content);
    }
    state.popupElement.hidden = false;
    state.popup = { x: point[0], y: point[1], offset };
    renderPopup(state);

    // Popup yang terpotong tepi peta dibawa masuk dengan menggeser petanya. Hanya kalau
    // titik jangkarnya sendiri sedang terlihat: showPopup() di tempat yang jauh tidak
    // boleh membuat peta melompat ke sana.
    const world = worldSize(state.zoom);
    const anchorX = (point[0] - state.x) * world + state.width / 2;
    const anchorY = (point[1] - state.y) * world + state.height / 2;
    if (anchorX < 0 || anchorX > state.width || anchorY < 0 || anchorY > state.height) return;
    const bounds = state.root.getBoundingClientRect();
    const rect = state.popupElement.getBoundingClientRect();
    const margin = 8;
    let dx = 0;
    if (rect.left < bounds.left + margin) dx = bounds.left + margin - rect.left;
    else if (rect.right > bounds.right - margin) dx = bounds.right - margin - rect.right;
    const dy = Math.max(0, bounds.top + margin - rect.top);
    if (dx !== 0 || dy !== 0) {
        panBy(state, dx, dy);
        render(state);
    }
}

function hidePopup(state) {
    state.popup = null;
    if (state.popupElement) state.popupElement.hidden = true;
}

// Klik atau geser di dalam kontrol dan popup tidak boleh ikut menggeser/men-zoom peta.
function isolate(element) {
    ["pointerdown", "dblclick"].forEach(type => element.addEventListener(type, event => event.stopPropagation()));
}

function stopAnimation(state) {
    cancelAnimationFrame(state.zoomFrame);
    clearTimeout(state.snapTimer);
    state.zoomFrame = 0;
}

function animateZoom(state, zoom, point) {
    stopAnimation(state);
    const from = state.zoom;
    const to = clamp(zoom, state.minZoom, state.maxZoom);
    if (to === from) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        zoomAround(state, to, point);
        render(state);
        return;
    }
    const start = performance.now();
    const step = now => {
        const t = clamp((now - start) / ZOOM_DURATION, 0, 1);
        zoomAround(state, from + (to - from) * t * (2 - t), point);
        render(state);
        state.zoomFrame = t < 1 ? requestAnimationFrame(step) : 0;
    };
    state.zoomFrame = requestAnimationFrame(step);
}

// Tile raster hanya tajam pada zoom bulat, jadi setelah sebuah gestur selesai zoom
// dirapikan ke level bulat: searah gesturnya (direction 1 atau -1), atau ke yang terdekat.
// Peta tanpa tile dibiarkan di zoom pecahan.
function snapZoom(state, point, direction = 0) {
    if (!state.tileURL) return;
    let zoom = Math.round(state.zoom);
    if (direction > 0) zoom = Math.ceil(state.zoom - 0.02);
    if (direction < 0) zoom = Math.floor(state.zoom + 0.02);
    animateZoom(state, zoom, point);
}

function handleTap(state, target, point) {
    const world = worldSize(state.zoom);
    const tapped = [
        state.x + (point[0] - state.width / 2) / world,
        state.y + (point[1] - state.height / 2) / world
    ];
    // Modul tambahan yang sedang "meminjam" klik peta (misalnya alat ukur): klik tidak membuka
    // popup dan tidak diteruskan ke onMapClick.
    if (state.clickCapture) {
        state.clickCapture(unproject(tapped), "click");
        return;
    }

    // Elemen modul tambahan yang mendaftar lewat onTap() menangani tap-nya sendiri: peta tidak
    // menganggapnya klik peta, dan popup yang sedang terbuka tidak ditutup.
    for (let element = target; element && element !== state.root; element = element.parentElement) {
        const runFunction = taps.get(element);
        if (runFunction) {
            runFunction();
            return;
        }
    }

    const record = featureAt(state, target, point);

    if (record && record.layer.popup !== false) {
        const content = typeof record.layer.popup === "function" ? record.layer.popup(record.feature) : defaultPopupContent(record.feature);
        // Popup sebuah titik menempel di titiknya; untuk garis dan polygon, di tempat yang diklik.
        if (record.shape.kind === "point") {
            openPopup(state, record.shape.point, content, record.shape.radius);
        } else {
            openPopup(state, tapped, content);
        }
        // Popup ikut tertutup kalau lapisannya disembunyikan atau dihapus.
        if (state.popup) state.popup.layer = record.layer;
    } else {
        hidePopup(state);
    }

    const position = unproject(tapped);
    state.clickHandlers.forEach(runFunction => runFunction(position, record ? record.feature : null));
}

// Klik kanan, tekan-lama, atau tombol Menu di keyboard: pendengar onContextMenu menerima
// (position, feature, detail). detail.point = titik di dalam peta (piksel), detail.keyboard =
// true kalau dibuka dari keyboard (menu sebaiknya langsung memfokus item pertamanya).
function openContextMenu(state, target, point, keyboard) {
    clearHover(state);
    const record = keyboard ? null : featureAt(state, target, point);
    const position = toPosition(state, point);
    const detail = { point: point.slice(), keyboard };
    state.contextHandlers.slice().forEach(runFunction => runFunction(position, record ? record.feature : null, detail));
}

function bindGestures(state) {
    const root = state.root;
    const pointers = new Map(); // pointerId -> titik terakhirnya di dalam peta
    let start = null;
    let moved = false;
    let pressTimer = 0;    // tekan-lama di layar sentuh yang sedang ditunggu
    let menuOpenedAt = -Infinity; // kapan menu konteks terakhir dibuka oleh tekan-lama atau keyboard,
    let echoPending = false;      // ... dan contextmenu susulannya dari browser belum datang
    let longPressed = false;      // tekanan terakhir berakhir sebagai tekan-lama (menu konteks)

    const cancelPress = () => {
        clearTimeout(pressTimer);
        pressTimer = 0;
    };

    const pointOf = event => {
        const rect = root.getBoundingClientRect();
        return [event.clientX - rect.left, event.clientY - rect.top];
    };

    // Titik tengah semua jari yang menempel, dan jarak antara dua jari pertama.
    const gesture = () => {
        const points = [...pointers.values()];
        return {
            center: [
                points.reduce((sum, point) => sum + point[0], 0) / points.length,
                points.reduce((sum, point) => sum + point[1], 0) / points.length
            ],
            distance: points.length > 1 ? Math.hypot(points[0][0] - points[1][0], points[0][1] - points[1][1]) : 0
        };
    };

    const capture = pointerId => {
        try {
            root.setPointerCapture(pointerId);
        } catch (captureError) {
            // pointer sudah tidak aktif; geser tetap jalan selama pointer masih di dalam peta
        }
    };

    root.addEventListener("pointerdown", event => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        stopAnimation(state);
        cancelPress();
        if (pointers.size === 0) {
            start = pointOf(event);
            moved = false;
            longPressed = false;
            // Layar sentuh tidak punya klik kanan: penggantinya tekan-lama tanpa bergeser.
            // Safari di iPhone tidak mengirim event contextmenu, jadi waktunya dihitung sendiri.
            if (event.pointerType !== "mouse" && state.contextHandlers.length > 0) {
                const target = event.target;
                pressTimer = setTimeout(() => {
                    pressTimer = 0;
                    moved = true; // jari yang diangkat sesudahnya bukan tap
                    longPressed = true;
                    menuOpenedAt = performance.now();
                    echoPending = true;
                    openContextMenu(state, target, start, false);
                }, LONG_PRESS_MS);
            }
        }
        pointers.set(event.pointerId, pointOf(event));
        if (pointers.size > 1) {
            // Dua jari tidak pernah dihitung sebagai klik.
            moved = true;
            cancelPress();
            pointers.forEach((point, pointerId) => capture(pointerId));
        }
    });

    root.addEventListener("contextmenu", event => {
        // Tanpa pendengar, menu bawaan browser dibiarkan. Di dalam popup dan kontrol juga,
        // supaya teksnya tetap bisa disalin lewat menu browser.
        if (state.contextHandlers.length === 0) return;
        if (event.target.closest && event.target.closest(".crootjs-map-corner, .crootjs-map-popup")) return;
        event.preventDefault();
        // Android mengirim contextmenu sendiri saat tekan-lama, dan keyboard (tombol Menu,
        // Shift+F10) juga: menunya sudah atau segera dibuka di bawah, jangan dua kali.
        if (echoPending && performance.now() - menuOpenedAt < 1000) {
            echoPending = false;
            return;
        }
        echoPending = false;
        if (pressTimer) {
            cancelPress();
            moved = true;
            longPressed = true;
            openContextMenu(state, event.target, start, false);
            return;
        }
        openContextMenu(state, event.target, pointOf(event), false);
    });

    root.addEventListener("pointermove", event => {
        if (!pointers.has(event.pointerId)) {
            // Kursor yang melayang (tanpa tombol ditekan): hover dan tooltip. Hanya mouse; di
            // layar sentuh tidak ada "melayang".
            if (pointers.size === 0 && event.pointerType === "mouse") {
                const point = pointOf(event);
                const record = state.clickCapture ? undefined : featureAt(state, event.target, point);
                // Fitur canvas tidak punya elemen untuk diberi cursor: pointer lewat CSS.
                root.classList.toggle("crootjs-map-pointer", Boolean(record && record.layer.canvas));
                if (record && (record.layer.hoverStyle || record.layer.tooltip)) {
                    setHover(state, record.layer, record.feature);
                } else {
                    clearHover(state);
                }
                moveTooltip(state, point);
            }
            return;
        }
        const point = pointOf(event);
        if (!moved) {
            if (Math.hypot(point[0] - start[0], point[1] - start[1]) < DRAG_THRESHOLD) return;
            moved = true;
            cancelPress();
            clearHover(state);
            root.classList.remove("crootjs-map-pointer");
            // Pointer baru ditangkap setelah jelas ini geseran: kalau ditangkap sejak
            // pointerdown, target pointerup selalu peta dan fitur yang diklik tidak diketahui.
            capture(event.pointerId);
            root.classList.add("crootjs-map-dragging");
        }
        const before = gesture();
        pointers.set(event.pointerId, point);
        const after = gesture();
        panBy(state, after.center[0] - before.center[0], after.center[1] - before.center[1]);
        if (before.distance > 0 && after.distance > 0) {
            zoomAround(state, state.zoom + Math.log2(after.distance / before.distance), after.center);
        }
        requestRender(state);
    });

    const release = event => {
        if (!pointers.has(event.pointerId)) return;
        const center = gesture().center;
        const pinching = pointers.size > 1;
        pointers.delete(event.pointerId);
        cancelPress();
        // Pinch berakhir begitu jari tinggal satu: zoom dirapikan di titik tengah kedua jari
        // tadi, bukan di jari yang kebetulan diangkat terakhir.
        if (pinching && pointers.size < 2) snapZoom(state, center);
        if (pointers.size > 0) return;
        root.classList.remove("crootjs-map-dragging");
        if (!moved && event.type === "pointerup") handleTap(state, event.target, pointOf(event));
    };
    root.addEventListener("pointerup", release);
    root.addEventListener("pointercancel", release);
    root.addEventListener("pointerleave", () => clearHover(state));

    root.addEventListener("dblclick", event => {
        // Tap lalu tekan-lama di titik yang sama dihitung browser sebagai klik ganda.
        if (longPressed) return;
        if (state.clickCapture) {
            state.clickCapture(toPosition(state, pointOf(event)), "dblclick");
            return;
        }
        animateZoom(state, Math.round(state.zoom) + 1, pointOf(event));
    });

    if (state.scrollZoom) {
        root.addEventListener("wheel", event => {
            event.preventDefault();
            stopAnimation(state);
            const point = pointOf(event);
            const lines = event.deltaMode === 1 ? 33 : 1; // Firefox melaporkan baris, bukan piksel
            // ctrlKey = pinch di trackpad, yang deltanya jauh lebih kecil daripada scroll biasa.
            const delta = clamp(-event.deltaY * lines * (event.ctrlKey ? 0.01 : 0.003), -1, 1);
            zoomAround(state, state.zoom + delta, point);
            requestRender(state);
            state.snapTimer = setTimeout(() => snapZoom(state, point, delta), 100);
        }, { passive: false });
    }

    root.addEventListener("keydown", event => {
        if (event.target !== root) return;
        const center = [state.width / 2, state.height / 2];
        const pans = { ArrowLeft: [80, 0], ArrowRight: [-80, 0], ArrowUp: [0, 80], ArrowDown: [0, -80] };
        if (pans[event.key]) {
            panBy(state, pans[event.key][0], pans[event.key][1]);
            requestRender(state);
        } else if (event.key === "+" || event.key === "=") {
            animateZoom(state, Math.round(state.zoom) + 1, center);
        } else if (event.key === "-") {
            animateZoom(state, Math.round(state.zoom) - 1, center);
        } else if ((event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) && state.contextHandlers.length > 0) {
            // Dari keyboard, menunya dibuka di tengah peta.
            menuOpenedAt = performance.now();
            echoPending = true;
            openContextMenu(state, root, center, true);
        } else {
            return;
        }
        event.preventDefault();
    });
}

function addZoomControl(state) {
    const control = document.createElement("div");
    control.className = "crootjs-map-zoom";
    const button = (label, text, step) => {
        const element = document.createElement("button");
        element.type = "button";
        element.setAttribute("aria-label", label);
        element.textContent = text;
        element.addEventListener("click", () => {
            animateZoom(state, Math.round(state.zoom) + step, [state.width / 2, state.height / 2]);
        });
        control.appendChild(element);
        return element;
    };
    state.zoomIn = button("Perbesar", "+", 1);
    state.zoomOut = button("Perkecil", "−", -1);
    addControl(state, control, "top-left");
}

function externalLink(href, text) {
    const link = document.createElement("a");
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = text;
    return link;
}

// Satu sumber atribusi -> daftar node. Teks dipasang sebagai teks (bukan HTML); untuk
// tautan, berikan elemen DOM.
function attributionNodes(source) {
    if (source === OSM_ATTRIBUTION) {
        // Lisensi data OpenStreetMap mewajibkan atribusi ini selama tile-nya dipakai.
        return ["© ", externalLink("https://www.openstreetmap.org/copyright", "OpenStreetMap"), " contributors"];
    }
    if (source instanceof Node) return [source];
    return source === null || source === undefined || source === "" ? [] : [String(source)];
}

// Atribusi = "CrootJS | sumber peta dasar | sumber tiap lapisan data", diperbarui setiap kali
// peta dasar diganti atau lapisan ber-attribution ditambah/dihapus.
function renderAttribution(state) {
    if (!state.attributionElement) {
        const element = document.createElement("div");
        element.className = "crootjs-map-attribution";
        isolate(element);
        state.root.appendChild(element);
        state.attributionElement = element;
    }
    const sources = [].concat(state.baseAttribution || [], ...state.layers.map(layer => layer.attribution || []));
    const parts = [];
    if (state.attributionPrefix) parts.push([externalLink("https://croot.js.org/", "CrootJS")]);
    // Sumber yang sama (misalnya dua lapisan dari dataset yang sama) cukup ditulis sekali.
    const seen = new Set();
    sources.forEach(source => {
        const nodes = attributionNodes(source);
        const key = source instanceof Node ? source : String(source);
        if (nodes.length === 0 || seen.has(key)) return;
        seen.add(key);
        parts.push(nodes);
    });
    state.attributionElement.replaceChildren(...parts.flatMap((nodes, index) => index ? [" | ", ...nodes] : nodes));
    state.attributionElement.hidden = parts.length === 0;
}

// Membuat peta di dalam elemen ber-ID `id`. Elemen itu harus sudah punya tinggi dari CSS.
// options (semua opsional):
//   center      [lng, lat] - urutan GeoJSON. Default: Indonesia.
//   zoom        default 4
//   minZoom     default 1
//   maxZoom     default 19
//   tiles       pola URL tile raster dengan {z}, {x}, {y}. Boleh juga memakai {s} (subdomain),
//               {r} ("@2x" di layar retina), dan {-y} (baris skema TMS). Default: OpenStreetMap.
//               false = tanpa peta dasar, hanya data yang digambar. Boleh juga object
//               { getTile(z, x, y) } yang mengembalikan Promise berisi Blob, URL, atau null,
//               misalnya file PMTiles dari mapoffline.js.
//   attribution atribusi untuk `tiles` buatan sendiri: teks, elemen DOM (untuk tautan), atau
//               array-nya kalau sumbernya lebih dari satu
//   attributionPrefix  false = tanpa tautan "CrootJS" di depan atribusi
//   maxNativeZoom  level tile tertinggi yang tersedia di server. Di atasnya tile level itu
//               diperbesar (overzoom), jadi maxZoom boleh lebih tinggi. Default: maxZoom.
//   labels      pola URL (atau array pola) tile label transparan yang digambar di atas
//               `tiles`, misalnya nama tempat dan jalan di atas citra satelit (hybrid)
//   subdomains  pengganti {s}: string ("abc") atau array. Default "abc".
//   errorTiles  URL gambar pengganti tile yang gagal dimuat
//   zoomControl false = tanpa tombol +/-
//   scrollZoom  false = roda mouse tetap menggulung halaman, tidak men-zoom peta
export function createMap(id, options = {}) {
    const container = document.getElementById(id);
    if (!container) {
        console.warn(`Elemen dengan ID "${id}" tidak ditemukan.`);
        return;
    }
    removeMap(id);
    injectStyles();

    const root = document.createElement("div");
    root.className = "crootjs-map";
    root.tabIndex = 0;
    root.setAttribute("role", "application");
    root.setAttribute("aria-label", "Peta");

    const tilePane = document.createElement("div");
    tilePane.className = "crootjs-map-tiles";
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "crootjs-map-vectors");
    const group = document.createElementNS(SVG_NS, "g");
    svg.appendChild(group);
    const underlay = document.createElement("div");
    underlay.className = "crootjs-map-underlay";
    const labelPane = document.createElement("div");
    labelPane.className = "crootjs-map-labels";
    const overlay = document.createElement("div");
    overlay.className = "crootjs-map-overlay";
    root.append(tilePane, underlay, svg, labelPane, overlay);

    const state = {
        container,
        root,
        tilePane,
        group,
        svg,
        canvas: null,
        clickCapture: null,
        labelPane,
        overlay,
        corners: {},
        moveHandlers: [],
        signature: "",
        x: 0.5,
        y: 0.5,
        zoom: 0,
        width: 0,
        height: 0,
        minZoom: Number.isFinite(options.minZoom) ? options.minZoom : 1,
        maxZoom: Number.isFinite(options.maxZoom) ? options.maxZoom : 19,
        scrollZoom: options.scrollZoom !== false,
        attributionPrefix: options.attributionPrefix !== false,
        tiles: new Map(),
        layers: [],
        layerCount: 0,
        built: null,
        popup: null,
        popupElement: null,
        hover: null,
        tooltipElement: null,
        clickHandlers: [],
        contextHandlers: [],
        renderFrame: 0,
        zoomFrame: 0,
        snapTimer: 0,
        removed: false,
        // Lapisan peta diposisikan absolut terhadap elemen ini.
        restorePosition: getComputedStyle(container).position === "static"
    };

    if (state.restorePosition) container.style.position = "relative";
    container.appendChild(root);
    // Elemen yang sedang display: none (misalnya tab yang belum dibuka) tidak diperingatkan:
    // petanya menyesuaikan diri begitu elemennya ditampilkan.
    if (container.clientHeight === 0 && container.getClientRects().length > 0) {
        console.warn(`Elemen "${id}" tingginya 0, jadi petanya tidak akan terlihat. Beri tinggi lewat CSS, misalnya height: 360px.`);
    }

    const center = project(Array.isArray(options.center) ? options.center : [118, -2.5]);
    setView(state, center[0], center[1], Number.isFinite(options.zoom) ? options.zoom : 4);

    if (options.zoomControl !== false) addZoomControl(state);
    configureTiles(state, options.tiles, options);
    bindGestures(state);

    state.resizeObserver = new ResizeObserver(() => requestRender(state));
    state.resizeObserver.observe(root);

    // Antarmuka untuk modul tambahan (mapmarker.js, mapcontrol.js, atau buatanmu sendiri).
    // Dititipkan di elemennya, bukan diekspor, karena modul tambahan tidak boleh mengimpor
    // map.js: halaman biasanya memuat map.min.js, sedangkan import "./map.js" dari modul lain
    // memuat salinan kedua dengan daftar peta yang terpisah - dan petanya tidak akan ketemu.
    container.crootjsMap = {
        root,
        overlay,
        // Tempat gambar bergeoreferensi: di atas peta dasar, di bawah data. Isinya diposisikan
        // sendiri oleh modul tambahan (lihat addImageOverlay di maptools.js).
        underlay,
        toPoint: position => toPoint(state, position),
        toPosition: point => toPosition(state, point),
        getView: () => currentView(state),
        setView: (center, zoom) => {
            stopAnimation(state);
            const point = project(center);
            setView(state, point[0], point[1], zoom);
            render(state);
        },
        panBy: (dx, dy) => {
            panBy(state, dx, dy);
            requestRender(state);
        },
        onMove: runFunction => subscribeMove(state, runFunction),
        // Tap (klik tanpa geser) pada sebuah elemen di overlay. Geseran yang berawal di elemen
        // itu tetap menggeser peta, karena gesturnya tetap ditangani peta.
        onTap: (element, runFunction) => taps.set(element, runFunction),
        addControl: (element, corner) => addControl(state, element, corner),
        showPopup: (position, content, offset) => openPopup(state, project(position), content, offset),
        closePopup: () => hidePopup(state),
        setTiles: (tiles, tileOptions) => {
            configureTiles(state, tiles, tileOptions || {});
            render(state);
        },
        getLayers: () => listLayers(state),
        setZoomRange: (minZoom, maxZoom) => {
            stopAnimation(state);
            applyZoomRange(state, minZoom, maxZoom);
            render(state);
        },
        // runFunction(position, feature) setiap kali peta diklik, sama seperti onMapClick.
        onClick: runFunction => {
            state.clickHandlers.push(runFunction);
            return function stop() {
                const index = state.clickHandlers.indexOf(runFunction);
                if (index !== -1) state.clickHandlers.splice(index, 1);
            };
        },
        // runFunction(position, feature, detail) saat klik kanan atau tekan-lama di peta (lihat
        // openContextMenu). Selama ada pendengar, menu bawaan browser di peta tidak muncul.
        onContextMenu: runFunction => {
            state.contextHandlers.push(runFunction);
            return function stop() {
                const index = state.contextHandlers.indexOf(runFunction);
                if (index !== -1) state.contextHandlers.splice(index, 1);
            };
        },
        // Meminjam klik peta: selama aktif, klik dan klik ganda diteruskan ke
        // runFunction(position, "click" | "dblclick") saja - tanpa popup, tanpa zoom klik
        // ganda, tanpa onMapClick, tanpa hover. Mengembalikan release(). Hanya satu peminjam.
        captureClick: runFunction => {
            state.clickCapture = runFunction;
            hidePopup(state);
            clearHover(state);
            root.classList.add("crootjs-map-capturing");
            return function release() {
                if (state.clickCapture !== runFunction) return;
                state.clickCapture = null;
                root.classList.remove("crootjs-map-capturing");
            };
        },
        setLayerVisible: (name, visible) => setLayerVisible(state, name, visible)
    };

    maps.set(id, state);
    render(state);
}

// Menghapus peta dari elemennya dan menghentikan semua listener-nya.
export function removeMap(id) {
    const state = maps.get(id);
    if (!state) return;
    state.removed = true;
    stopAnimation(state);
    cancelAnimationFrame(state.renderFrame);
    state.resizeObserver.disconnect();
    state.root.remove();
    if (state.restorePosition) state.container.style.position = "";
    delete state.container.crootjsMap;
    maps.delete(id);
}

// Memindahkan tampilan ke center [lng, lat]. zoom opsional; tanpa zoom, level sekarang dipertahankan.
export function setMapView(id, center, zoom) {
    const state = getMap(id);
    if (!state) return;
    stopAnimation(state);
    const point = project(center);
    setView(state, point[0], point[1], zoom);
    render(state);
}

// Tampilan sekarang: { center: [lng, lat], zoom }.
export function getMapView(id) {
    const state = getMap(id);
    if (!state) return null;
    return { center: unproject([state.x, state.y]), zoom: state.zoom };
}

// Bagian dunia yang sedang terlihat, sebagai bbox [minLng, minLat, maxLng, maxLat].
// Berguna untuk meminta ke backend hanya data di area yang tampak.
export function getMapBounds(id) {
    const state = getMap(id);
    if (!state) return null;
    const world = worldSize(state.zoom);
    const halfWidth = state.width / 2 / world;
    const halfHeight = state.height / 2 / world;
    const southWest = unproject([clamp(state.x - halfWidth, 0, 1), clamp(state.y + halfHeight, 0, 1)]);
    const northEast = unproject([clamp(state.x + halfWidth, 0, 1), clamp(state.y - halfHeight, 0, 1)]);
    return [southWest[0], southWest[1], northEast[0], northEast[1]];
}

// Posisi [lng, lat] -> titik [x, y] dalam piksel, dihitung dari pojok kiri-atas peta.
// Hasilnya bisa di luar ukuran peta kalau posisinya sedang tidak terlihat.
export function mapToPoint(id, position) {
    const state = getMap(id);
    if (!state) return null;
    return toPoint(state, position);
}

// Kebalikannya: titik [x, y] piksel dari pojok kiri-atas peta -> posisi [lng, lat].
export function pointToPosition(id, point) {
    const state = getMap(id);
    if (!state) return null;
    return toPosition(state, point);
}

// runFunction({ center, zoom }) dipanggil setiap kali tampilan berubah: digeser, di-zoom,
// atau ukuran petanya berubah - termasuk di setiap frame selama gestur berlangsung.
// Mengembalikan function stop() untuk berhenti mendengarkan.
export function onMapMove(id, runFunction) {
    const state = getMap(id);
    if (!state) return () => {};
    return subscribeMove(state, runFunction);
}

// Menaruh elemen buatanmu (tombol, legenda, dsb) di pojok peta: "top-left", "top-right"
// (bawaan), "bottom-left", atau "bottom-right". Klik di dalamnya tidak menggeser peta.
// Mengembalikan function remove() untuk mencabutnya lagi.
export function addMapControl(id, element, corner = "top-right") {
    const state = getMap(id);
    if (!state) return () => {};
    return addControl(state, element, corner);
}

// Memaskan tampilan ke seluruh data. `geojson` boleh GeoJSON apa pun yang diterima
// parseGeoJSON, atau langsung sebuah bbox [minLng, minLat, maxLng, maxLat].
// padding: jarak kosong (piksel) antara data dan tepi peta. Boleh per sisi,
// { top, right, bottom, left }, misalnya supaya data tidak tertutup panel di kiri; sisi
// yang tidak disebut tetap 24.
export function fitMap(id, geojson, padding = 24) {
    const state = getMap(id);
    if (!state) return;
    const isBBox = Array.isArray(geojson) && geojson.length === 4 && geojson.every(Number.isFinite);
    const bbox = isBBox ? geojson : getBBox(geojson);
    if (!bbox) return;

    stopAnimation(state);
    state.width = state.root.clientWidth;
    state.height = state.root.clientHeight;
    const southWest = project([bbox[0], bbox[1]]);
    const northEast = project([bbox[2], bbox[3]]);
    const spanX = Math.abs(northEast[0] - southWest[0]);
    const spanY = Math.abs(southWest[1] - northEast[1]);

    const side = name => {
        const value = typeof padding === "object" && padding !== null ? padding[name] : padding;
        return Number.isFinite(value) ? value : 24;
    };
    const top = side("top");
    const right = side("right");
    const bottom = side("bottom");
    const left = side("left");

    let zoom = SINGLE_POINT_ZOOM;
    if (spanX > 0 || spanY > 0) {
        zoom = Math.log2(Math.min(
            (state.width - left - right) / (spanX * TILE_SIZE),
            (state.height - top - bottom) / (spanY * TILE_SIZE)
        ));
        // Peta yang belum punya ukuran (misalnya masih display: none) tidak bisa dipaskan.
        if (!Number.isFinite(zoom)) zoom = state.minZoom;
        // Dibulatkan ke bawah supaya tile raster tetap tajam dan datanya tetap muat.
        if (state.tileURL) zoom = Math.floor(zoom);
    }
    setView(state, NaN, NaN, zoom);
    // Tengah data jatuh di tengah area yang tersisa setelah padding, bukan di tengah peta.
    const world = worldSize(state.zoom);
    setView(state,
        (southWest[0] + northEast[0]) / 2 - (left - right) / 2 / world,
        (southWest[1] + northEast[1]) / 2 - (top - bottom) / 2 / world);
    render(state);
}

// Menggambar GeoJSON di atas peta. `geojson` boleh apa pun yang diterima parseGeoJSON:
// FeatureCollection, satu Feature, satu geometri, atau array-nya.
// options (semua opsional):
//   name   nama lapisan, untuk showLayer/hideLayer/setLayerStyle/setLayerOrder/removeLayer.
//          Lapisan baru dengan nama yang sudah dipakai menggantikan lapisan lama itu.
//   style  object { stroke, strokeWidth, strokeOpacity, strokeDasharray, lineCap, lineJoin,
//          fill, fillOpacity, radius }, atau function (feature) => object untuk membedakan
//          tiap fitur. strokeDasharray: "6 4" atau [6, 4] untuk garis putus-putus (piksel).
//   popup  function (feature) => teks atau elemen DOM yang ditampilkan saat fitur diklik
//          (null = tanpa popup untuk fitur itu). Default: daftar properties-nya.
//          false = tanpa popup sama sekali.
//   hoverStyle  object gaya yang ditimpakan selama kursor berada di atas sebuah fitur
//   tooltip     function (feature) => teks atau elemen DOM yang mengikuti kursor di atas fitur
//   label  nama properti yang ditulis sebagai label fitur, atau function (feature) => teks
//          (null = tanpa label). Label ditaruh di titiknya, di tengah garis, atau di titik
//          berat polygon; label yang bertabrakan dengan label lain disembunyikan.
//   labelOptions  { minZoom, maxZoom, className, overlap } - overlap: true = tanpa
//          penghindaran tabrakan
//   minZoom, maxZoom  lapisan hanya tampil di rentang zoom ini
//   order  urutan tumpuk: makin besar makin di atas. Default 0; yang sama urut ditambahkan.
//   visible  false = ditambahkan dalam keadaan tersembunyi
//   attribution  sumber data lapisan ini, ditambahkan ke atribusi peta selama lapisannya ada
//   renderer  "canvas" = digambar di satu canvas, bukan satu elemen SVG per bentuk: jauh
//          lebih ringan untuk ribuan garis, terutama di ponsel. Lapisan canvas selalu berada
//          di bawah lapisan SVG. Gaya, popup, hover, tooltip, dan label tetap berlaku.
//   simplify  toleransi penyederhanaan geometri per level zoom, dalam piksel (misalnya 1):
//          titik yang menyimpang kurang dari itu dibuang. Default 0 = tidak disederhanakan.
// Mengembalikan function remove() untuk menghapus lapisan ini dari peta. Function itu juga
// punya remove.show(), remove.hide(), remove.setStyle(style), dan remove.setOrder(order),
// untuk lapisan yang tidak diberi nama.
export function addGeoJSON(id, geojson, options = {}) {
    const state = getMap(id);
    if (!state) return () => {};
    const collection = parseGeoJSON(geojson);
    if (!collection) {
        console.warn("addGeoJSON: datanya bukan GeoJSON, tidak ada yang digambar.");
        return () => {};
    }

    const name = options.name === undefined || options.name === null ? null : String(options.name);
    if (name !== null) {
        const existing = findLayer(state, name, true);
        if (existing) detachLayer(state, existing);
    }
    const labelOptions = options.labelOptions || {};
    const labelText = typeof options.label === "function" ? options.label
        : (typeof options.label === "string" ? feature => (feature.properties || {})[options.label] : null);
    const layer = {
        state,
        name,
        group: document.createElementNS(SVG_NS, "g"),
        shapes: [],
        labels: [],
        popup: options.popup,
        style: options.style,
        hoverStyle: options.hoverStyle || null,
        tooltip: typeof options.tooltip === "function" ? options.tooltip : null,
        visible: options.visible !== false,
        shown: null, // belum pernah ditulis; renderLayerVisibility selalu menulisnya sekali
        minZoom: Number.isFinite(options.minZoom) ? options.minZoom : -Infinity,
        maxZoom: Number.isFinite(options.maxZoom) ? options.maxZoom : Infinity,
        labelRange: {
            minZoom: Number.isFinite(labelOptions.minZoom) ? labelOptions.minZoom : -Infinity,
            maxZoom: Number.isFinite(labelOptions.maxZoom) ? labelOptions.maxZoom : Infinity
        },
        labelOverlap: labelOptions.overlap === true,
        order: Number.isFinite(options.order) ? options.order : 0,
        canvas: options.renderer === "canvas",
        simplify: Number.isFinite(options.simplify) && options.simplify > 0 ? options.simplify : 0,
        sequence: state.layerCount++,
        attribution: options.attribution || null
    };
    const markers = [];

    if (layer.canvas && !state.canvas) {
        state.canvas = document.createElement("canvas");
        state.canvas.className = "crootjs-map-canvas";
        state.svg.before(state.canvas);
    }

    collection.features.forEach(feature => {
        shapesOf(feature.geometry).forEach(shape => {
            if (layer.canvas) {
                // Kotak pembatas (satuan proyeksi) untuk melewati bentuk di luar layar dengan cepat.
                const box = shape.bbox = [Infinity, Infinity, -Infinity, -Infinity];
                (shape.kind === "point" ? [[shape.point]] : shape.rings).forEach(ring => ring.forEach(point => {
                    box[0] = Math.min(box[0], point[0]);
                    box[1] = Math.min(box[1], point[1]);
                    box[2] = Math.max(box[2], point[0]);
                    box[3] = Math.max(box[3], point[1]);
                }));
                shape.feature = feature;
                applyStyle(layer, shape, false);
                layer.shapes.push(shape);
                return;
            }
            const element = document.createElementNS(SVG_NS, shape.kind === "point" ? "circle" : "path");
            element.setAttribute("class", "crootjs-map-" + shape.kind);
            shape.element = element;
            shape.feature = feature;
            applyStyle(layer, shape, false);
            records.set(element, { feature, layer, shape });
            layer.shapes.push(shape);
            if (shape.kind === "point") {
                markers.push(element);
                return;
            }
            layer.group.appendChild(element);
            if (shape.kind === "line") {
                // Garis tipis sulit diklik, apalagi dengan jari: path transparan yang lebih
                // lebar menjadi area kliknya. Ditaruh paling bawah supaya tidak merebut klik
                // dari bentuk lain yang terlihat.
                shape.hit = document.createElementNS(SVG_NS, "path");
                shape.hit.setAttribute("class", "crootjs-map-hit");
                records.set(shape.hit, { feature, layer, shape });
                layer.group.prepend(shape.hit);
            }
        });
    });
    // Titik digambar paling atas, apa pun urutannya di data: kalau tidak, polygon yang
    // datang belakangan menutupi marker di dalamnya.
    markers.forEach(element => layer.group.appendChild(element));

    if (labelText) {
        collection.features.forEach(feature => {
            const text = labelText(feature);
            const anchor = text === null || text === undefined || text === "" ? null : labelAnchor(feature.geometry);
            if (!anchor) return;
            const element = document.createElement("div");
            element.className = "crootjs-map-label" + (labelOptions.className ? " " + labelOptions.className : "");
            element.textContent = String(text);
            element.style.visibility = "hidden";
            layer.labels.push({ element, anchor, shown: false });
        });
        state.labelPane.append(...layer.labels.map(label => label.element));
    }

    state.layers.push(layer);
    sortLayers(state);
    state.built = null; // paksa renderVectors menulis koordinat lapisan baru ini
    if (layer.attribution) renderAttribution(state);
    render(state);

    const remove = function remove() {
        if (state.layers.includes(layer)) detachLayer(state, layer);
    };
    remove.show = () => updateLayer(state, layer, () => { layer.visible = true; });
    remove.hide = () => updateLayer(state, layer, () => { layer.visible = false; });
    remove.setStyle = style => restyleLayer(state, layer, style);
    remove.setOrder = order => updateLayer(state, layer, () => {
        layer.order = Number.isFinite(order) ? order : 0;
        sortLayers(state);
    });
    return remove;
}

// Urutan state.layers = urutan tumpuk (bawah ke atas). Grup SVG dan label ikut diurutkan.
function sortLayers(state) {
    state.layers.sort((a, b) => a.order - b.order || a.sequence - b.sequence);
    state.layers.forEach(layer => {
        state.group.appendChild(layer.group);
        layer.labels.forEach(label => state.labelPane.appendChild(label.element));
    });
}

function findLayer(state, name, quiet) {
    const layer = state.layers.find(item => item.name === String(name));
    if (!layer && !quiet) console.warn(`Lapisan "${name}" tidak ditemukan. Beri nama lewat addGeoJSON(id, data, { name: "${name}" }).`);
    return layer;
}

function detachLayer(state, layer) {
    state.layers.splice(state.layers.indexOf(layer), 1);
    layer.group.remove();
    layer.labels.forEach(label => label.element.remove());
    if (state.hover && state.hover.layer === layer) clearHover(state);
    if (state.popup && state.popup.layer === layer) hidePopup(state);
    if (layer.attribution) renderAttribution(state);
    if (layer.canvas) requestRender(state);
}

function updateLayer(state, layer, change) {
    if (!state.layers.includes(layer)) return;
    change();
    render(state);
}

function restyleLayer(state, layer, style) {
    if (!state.layers.includes(layer)) return;
    layer.style = style;
    const hovered = state.hover && state.hover.layer === layer ? state.hover.feature : null;
    layer.shapes.forEach(shape => applyStyle(layer, shape, shape.feature === hovered));
}

function setLayerVisible(state, name, visible) {
    const layer = findLayer(state, name);
    if (layer) updateLayer(state, layer, () => { layer.visible = Boolean(visible); });
}

function listLayers(state) {
    return state.layers
        .filter(layer => layer.name !== null)
        .map(layer => ({ name: layer.name, visible: layer.visible, order: layer.order }));
}

// Menampilkan lagi lapisan bernama `name` yang disembunyikan hideLayer().
export function showLayer(id, name) {
    const state = getMap(id);
    if (state) setLayerVisible(state, name, true);
}

// Menyembunyikan lapisan tanpa menghapusnya; popup dan hover miliknya ikut ditutup.
export function hideLayer(id, name) {
    const state = getMap(id);
    if (state) setLayerVisible(state, name, false);
}

// Mengganti gaya seluruh lapisan. style: object atau function (feature) => object, sama
// seperti opsi style di addGeoJSON.
export function setLayerStyle(id, name, style) {
    const state = getMap(id);
    const layer = state && findLayer(state, name);
    if (layer) restyleLayer(state, layer, style);
}

// Mengubah urutan tumpuk lapisan: makin besar makin di atas.
export function setLayerOrder(id, name, order) {
    const state = getMap(id);
    const layer = state && findLayer(state, name);
    if (!layer) return;
    updateLayer(state, layer, () => {
        layer.order = Number.isFinite(order) ? order : 0;
        sortLayers(state);
    });
}

export function removeLayer(id, name) {
    const state = getMap(id);
    const layer = state && findLayer(state, name);
    if (layer) detachLayer(state, layer);
}

// Daftar lapisan bernama, dari bawah ke atas: [{ name, visible, order }].
export function getLayers(id) {
    const state = getMap(id);
    return state ? listLayers(state) : [];
}

// Mengganti peta dasar tanpa membuat ulang peta: lapisan, marker, dan popup tetap.
// tiles: sama seperti opsi tiles di createMap (false = tanpa peta dasar).
// options: labels, maxNativeZoom, subdomains, errorTiles, attribution - sama seperti di
// createMap, dan semuanya kembali ke bawaan kalau tidak disebut. minZoom/maxZoom juga
// boleh disebut (misalnya peta dasar yang tidak boleh di-zoom lewat level tertentu); yang
// tidak disebut tetap seperti sebelumnya.
export function setTiles(id, tiles, options = {}) {
    const state = getMap(id);
    if (!state) return;
    configureTiles(state, tiles, options);
    render(state);
}

// Mengubah rentang zoom yang diizinkan tanpa membuat ulang peta. minZoom atau maxZoom yang
// tidak diisi (undefined/null) dibiarkan. Kalau zoom sekarang di luar rentang baru, peta
// langsung di-zoom ke batas terdekat; tombol +/- ikut menyesuaikan.
export function setZoomRange(id, minZoom, maxZoom) {
    const state = getMap(id);
    if (!state) return;
    stopAnimation(state);
    applyZoomRange(state, minZoom, maxZoom);
    render(state);
}

// Menghapus semua lapisan GeoJSON dan menutup popup. Peta dasarnya tetap.
export function clearMap(id) {
    const state = getMap(id);
    if (!state) return;
    state.layers.slice().forEach(layer => detachLayer(state, layer));
    hidePopup(state);
}

// Menampilkan popup di position [lng, lat]. content: teks, atau elemen DOM.
export function showPopup(id, position, content) {
    const state = getMap(id);
    if (!state) return;
    openPopup(state, project(position), content);
}

export function closePopup(id) {
    const state = getMap(id);
    if (!state) return;
    hidePopup(state);
}

// runFunction(position, feature) dipanggil setiap kali peta diklik atau di-tap (bukan
// digeser). position = [lng, lat] titik yang diklik; feature = fitur GeoJSON yang kena
// klik, atau null kalau yang diklik peta dasarnya.
export function onMapClick(id, runFunction) {
    const state = getMap(id);
    if (!state) return;
    state.clickHandlers.push(runFunction);
}

// runFunction(position, feature, detail) dipanggil saat peta diklik kanan, ditekan lama di
// layar sentuh (sekitar 0,5 detik tanpa bergeser), atau tombol Menu/Shift+F10 ditekan saat
// peta difokus. feature = fitur GeoJSON di titik itu, atau null. detail = { point, keyboard }.
// Selama ada pendengar, menu bawaan browser tidak muncul di peta. Untuk menu siap pakai,
// lihat addContextMenu di mapcontrol.js. Mengembalikan function stop().
export function onMapContextMenu(id, runFunction) {
    const state = getMap(id);
    if (!state) return () => {};
    state.contextHandlers.push(runFunction);
    return function stop() {
        const index = state.contextHandlers.indexOf(runFunction);
        if (index !== -1) state.contextHandlers.splice(index, 1);
    };
}
