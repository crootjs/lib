// Modul tambahan untuk map.js: heatmap dan peta petak (grid) dari data titik.
//   addHeatmap   kepadatan titik sebagai gradasi warna halus (biru -> merah), boleh berbobot
//   addGridMap   titik dikelompokkan ke petak persegi atau heksagon, tiap petak diwarnai menurut
//                rata-rata (atau maks, min, jumlah, banyaknya) nilainya - seperti peta cakupan
//                sinyal nPerf
// Keduanya digambar di satu canvas di atas peta dasar dan di bawah lapisan data.
// Sengaja tidak mengimpor map.js - petanya dijangkau lewat antarmuka yang dititipkan
// createMap() di elemennya (element.crootjsMap), supaya map.js tidak termuat dua kali.
import { parseGeoJSON } from "./geo.js";

const TILE_SIZE = 256;
const EQUATOR = 40075016.686; // keliling bumi di khatulistiwa (meter)
const MAX_LEVEL = 22;
const KEY_FACTOR = 67108864;  // 2^26: nomor kolom dan baris petak digabung menjadi satu angka kunci
const REDRAW_DELAY_MS = 120;  // jeda setelah peta berhenti bergerak sebelum canvas digambar ulang

const HEAT_GRADIENT = { 0.4: "#2563eb", 0.6: "#06b6d4", 0.7: "#84cc16", 0.8: "#facc15", 1: "#dc2626" };
// Rendah -> tinggi: merah ke hijau, cocok untuk nilai yang makin tinggi makin baik (sinyal, kecepatan).
const GRID_COLORS = ["#d7191c", "#fdae61", "#ffffbf", "#a6d96a", "#1a9641"];
const AGGREGATE_NAMES = { mean: "Rata-rata", max: "Maksimum", min: "Minimum", sum: "Jumlah", count: "Banyak titik" };

function injectStyles() {
    if (document.getElementById("crootjs-mapheat-style")) return;
    const style = document.createElement("style");
    style.id = "crootjs-mapheat-style";
    style.textContent = `
.crootjs-heat-legend {
    box-sizing: border-box;
    min-width: 120px;
    max-width: 220px;
    padding: 6px 10px;
    border-radius: 6px;
    background-color: rgba(255, 255, 255, 0.92);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
    color: #1f2937;
    font: 12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.crootjs-heat-legend[hidden] { display: none; }
.crootjs-heat-legend-title { margin-bottom: 4px; font-weight: 600; }
.crootjs-heat-legend-row { display: flex; align-items: center; gap: 6px; }
.crootjs-heat-legend-swatch {
    flex: none;
    width: 14px;
    height: 14px;
    border-radius: 3px;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.15);
}
.crootjs-heat-legend-bar { height: 10px; border-radius: 3px; }
.crootjs-heat-legend-ends { display: flex; justify-content: space-between; color: #4b5563; }
`;
    // Di awal <head> (sesudah style CrootJS lain), bukan di akhir: CSS halaman yang ditautkan
    // sesudahnya menang tanpa !important, jadi tampilan bawaan ini mudah ditimpa.
    const previous = [...document.head.querySelectorAll('style[id^="crootjs-"]')].pop();
    if (previous) previous.after(style);
    else document.head.prepend(style);
}

function mapOf(id) {
    const container = document.getElementById(id);
    const map = container ? container.crootjsMap : null;
    if (!map) console.warn(`Peta dengan ID "${id}" belum dibuat. Panggil createMap("${id}") dari map.js lebih dulu.`);
    return map;
}

// Proyeksi Web Mercator yang sama dengan map.js: [lng, lat] <-> titik [x, y] dengan seluruh
// dunia dipetakan ke 0..1.
function project(position) {
    const sin = Math.sin(Math.max(-85.0511287798, Math.min(85.0511287798, position[1])) * Math.PI / 180);
    return [(position[0] + 180) / 360, 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)];
}

function unproject(point) {
    return [point[0] * 360 - 180, Math.atan(Math.sinh(Math.PI * (1 - 2 * point[1]))) * 180 / Math.PI];
}

// Panjang 1 satuan dunia (0..1) dalam meter di sebuah lintang.
function worldMeters(latitude) {
    return EQUATOR * Math.cos(latitude * Math.PI / 180);
}

function formatNumber(value) {
    return value.toLocaleString("id-ID", { maximumFractionDigits: Math.abs(value) < 10 ? 2 : 1 });
}

// Nilai sebuah titik: nama properti, function(feature), atau (untuk data array) elemen ketiga.
function reader(option, fallback) {
    if (typeof option === "function") return option;
    if (typeof option === "string") return feature => (feature && feature.properties ? feature.properties[option] : undefined);
    return item => (Array.isArray(item) ? (item.length > 2 ? item[2] : fallback) : fallback);
}

// Data titik -> { xs, ys, values, items }. Menerima GeoJSON apa pun yang diterima parseGeoJSON
// (hanya Point/MultiPoint yang dipakai), atau array [lng, lat] / [lng, lat, nilai].
function readPoints(data, readValue, requireValue) {
    const items = [];
    const coordinates = [];
    const values = [];
    const add = (position, item) => {
        if (!Array.isArray(position) || !Number.isFinite(position[0]) || !Number.isFinite(position[1])) return;
        const value = Number(readValue(item));
        if (requireValue && !Number.isFinite(value)) return;
        const point = project(position);
        coordinates.push(point[0], point[1]);
        values.push(value);
        items.push(item);
    };
    if (Array.isArray(data) && (data.length === 0 || Array.isArray(data[0]))) {
        data.forEach(item => add(item, item));
    } else {
        const collection = parseGeoJSON(data);
        if (!collection) {
            console.warn("mapheat.js: datanya bukan GeoJSON atau array [lng, lat], tidak ada yang digambar.");
        } else {
            collection.features.forEach(feature => {
                const geometry = feature.geometry;
                if (!geometry) return;
                if (geometry.type === "Point") add(geometry.coordinates, feature);
                else if (geometry.type === "MultiPoint") geometry.coordinates.forEach(position => add(position, feature));
            });
        }
    }
    const total = items.length;
    const xs = new Float64Array(total);
    const ys = new Float64Array(total);
    for (let i = 0; i < total; i++) {
        xs[i] = coordinates[2 * i];
        ys[i] = coordinates[2 * i + 1];
    }
    return { xs, ys, values: Float64Array.from(values), items, total };
}

// Satu canvas di underlay peta, sedikit lebih lebar dari layar. Selama peta digeser atau di-zoom
// canvas lama hanya dipindah dan diskalakan (murah); begitu peta berhenti sebentar, atau
// geserannya hampir melewati tepi cadangan, canvas digambar ulang lewat draw(context, frame).
// frame: { left, top, world, width, height, zoom, center } - titik dunia (x, y) ada di piksel
// ((x - left) * world, (y - top) * world).
function canvasLayer(map, draw, pixelRatio) {
    const canvas = document.createElement("canvas");
    canvas.className = "crootjs-heat-canvas";
    canvas.setAttribute("aria-hidden", "true");
    map.underlay.appendChild(canvas);
    let drawn = null;
    let timer = 0;
    let frame = 0;
    let hidden = false;

    const redraw = () => {
        clearTimeout(timer);
        cancelAnimationFrame(frame);
        if (hidden) return;
        const width = map.root.clientWidth;
        const height = map.root.clientHeight;
        const margin = Math.round(Math.max(width, height) / 4);
        const view = map.getView();
        const world = TILE_SIZE * Math.pow(2, view.zoom);
        const center = project(view.center);
        const full = { width: width + 2 * margin, height: height + 2 * margin };
        const ratio = pixelRatio();
        canvas.width = Math.max(1, Math.round(full.width * ratio));
        canvas.height = Math.max(1, Math.round(full.height * ratio));
        canvas.style.width = full.width + "px";
        canvas.style.height = full.height + "px";
        canvas.style.transform = `translate(${-margin}px, ${-margin}px)`;
        const context = canvas.getContext("2d");
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        context.clearRect(0, 0, full.width, full.height);
        drawn = {
            left: center[0] - (width / 2 + margin) / world,
            top: center[1] - (height / 2 + margin) / world,
            world, margin, zoom: view.zoom,
        };
        draw(context, { ...drawn, width: full.width, height: full.height, center: view.center, ratio });
    };

    const follow = view => {
        if (hidden) return;
        if (!drawn) {
            redraw();
            return;
        }
        const width = map.root.clientWidth;
        const height = map.root.clientHeight;
        const world = TILE_SIZE * Math.pow(2, view.zoom);
        const center = project(view.center);
        const scale = world / drawn.world;
        const x = (drawn.left - center[0]) * world + width / 2;
        const y = (drawn.top - center[1]) * world + height / 2;
        canvas.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
        clearTimeout(timer);
        timer = setTimeout(redraw, REDRAW_DELAY_MS);
        // Geseran panjang tanpa jeda (drag terus-menerus): gambar ulang sebelum tepinya terlihat.
        const shift = Math.max(Math.abs(x + drawn.margin), Math.abs(y + drawn.margin));
        if (scale === 1 && shift > drawn.margin * 0.75) {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(redraw);
        }
    };

    const stop = map.onMove(follow);
    redraw();
    return {
        redraw,
        setOpacity: opacity => { canvas.style.opacity = String(opacity); },
        setHidden: value => {
            hidden = value;
            canvas.hidden = value;
            if (!value) redraw();
        },
        remove() {
            stop();
            clearTimeout(timer);
            cancelAnimationFrame(frame);
            canvas.remove();
        },
    };
}

function legendBox(title) {
    const box = document.createElement("div");
    box.className = "crootjs-heat-legend";
    if (title) {
        const heading = document.createElement("div");
        heading.className = "crootjs-heat-legend-title";
        heading.textContent = title;
        box.appendChild(heading);
    }
    return box;
}

function legendOptions(option) {
    if (!option) return null;
    return typeof option === "object" ? option : {};
}

// Gradasi { posisi 0..1: warna } -> 256 warna RGB (Uint8ClampedArray 256 x 4).
function gradientPalette(gradient) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 1;
    const context = canvas.getContext("2d");
    const fill = context.createLinearGradient(0, 0, 256, 0);
    Object.keys(gradient).map(Number).sort((a, b) => a - b).forEach(stop => fill.addColorStop(Math.max(0, Math.min(1, stop)), gradient[stop]));
    context.fillStyle = fill;
    context.fillRect(0, 0, 256, 1);
    return context.getImageData(0, 0, 256, 1).data;
}

function gradientCSS(gradient) {
    const stops = Object.keys(gradient).map(Number).sort((a, b) => a - b);
    return `linear-gradient(to right, ${stops.map(stop => `${gradient[stop]} ${Math.round(stop * 100)}%`).join(", ")})`;
}

// Bobot pengaruh sebuah titik pada jarak d (kernel kuartik): 1 tepat di titiknya, turun halus
// sampai 0 di jarak radius. Ditabelkan sekali per radius, dalam satuan langkah kisi.
function heatKernel(radius, step) {
    const reach = radius / step;
    const span = Math.ceil(reach);
    const size = 2 * span + 1;
    const values = new Float32Array(size * size);
    for (let dy = -span; dy <= span; dy++) {
        for (let dx = -span; dx <= span; dx++) {
            const ratio = (dx * dx + dy * dy) / (reach * reach);
            if (ratio < 1) values[(dy + span) * size + dx + span] = (1 - ratio) * (1 - ratio);
        }
    }
    return { radius, step, span, size, values };
}

// Menggambar heatmap kepadatan titik di peta.
// data: GeoJSON berisi Point/MultiPoint, atau array [lng, lat] / [lng, lat, bobot].
// options (semua opsional):
//   weight        bobot tiap titik: nama properti atau function(feature) => angka. Bawaan 1
//                 (data array: elemen ketiga kalau ada). Titik berbobot <= 0 dilewati.
//   radius        jarak pengaruh tiap titik dalam piksel: panasnya memudar sampai habis di
//                 jarak ini. Bawaan 30.
//   radiusMeters  jarak pengaruh dalam meter (menggantikan radius): ikut membesar saat di-zoom.
//   max           kepadatan yang dianggap "paling panas" - jumlah bobot titik di sekitar sebuah
//                 tempat, tiap titik dihitung penuh di tempatnya dan memudar sampai radius.
//                 Bawaan: kepadatan tertinggi di layar, seperti heatmap Google Maps.
//   scale         "linear" (bawaan), "sqrt", atau "log": cara kepadatan dipetakan ke warna.
//                 "sqrt"/"log" menonjolkan tempat yang sepi kalau datanya menumpuk di beberapa
//                 titik saja (misalnya dekat BTS).
//   gradient      { posisi 0..1: warna }. Bawaan biru - sian - hijau - kuning - merah.
//   opacity       keburaman seluruh lapisan (0-1). Bawaan 0,8.
//   legend        true atau { title, corner, low, high } untuk menampilkan legenda gradasinya.
// Mengembalikan { setData(data), setOptions(options), show(), hide(), remove() }.
export function addHeatmap(id, data, options = {}) {
    const map = mapOf(id);
    const nothing = { setData() {}, setOptions() {}, show() {}, hide() {}, remove() {} };
    if (!map) return nothing;
    injectStyles();
    let settings = { ...options };
    let source = data;
    let points = null;
    let palette = null;
    let kernel = null;
    let legend = null;

    const load = value => {
        source = value;
        points = readPoints(value, reader(settings.weight, 1), false);
    };

    // Kepadatan dihitung dengan angka pecahan di kisi kasar (langkah radius/5 piksel), lalu
    // diwarnai dan diperbesar ke ukuran canvas dengan smoothing browser. Jauh lebih cepat
    // daripada per piksel, dan hasilnya tetap halus karena kepadatannya memang berubah pelan.
    const draw = (context, frame) => {
        if (!points || points.total === 0) return;
        let radius = Number.isFinite(settings.radius) && settings.radius > 0 ? settings.radius : 30;
        if (Number.isFinite(settings.radiusMeters) && settings.radiusMeters > 0) {
            const metersPerPixel = worldMeters(frame.center[1]) / frame.world;
            radius = Math.max(2, Math.min(300, settings.radiusMeters / metersPerPixel));
        }
        const step = Math.max(1, radius / 5);
        if (!kernel || kernel.radius !== radius) kernel = heatKernel(radius, step);
        const { span, size, values: weights } = kernel;
        const columns = Math.ceil(frame.width / step) + 1;
        const rows = Math.ceil(frame.height / step) + 1;

        // Titik dibulatkan ke simpul kisi terdekat; titik di luar canvas tapi masih dalam
        // jangkauan radius tetap dihitung, karena panasnya merembes masuk.
        const padded = columns + 2 * span;
        const bins = new Map();
        const { xs, ys, values, total } = points;
        for (let i = 0; i < total; i++) {
            const weight = values[i];
            if (!(weight > 0)) continue;
            const gx = Math.round((xs[i] - frame.left) * frame.world / step) + span;
            const gy = Math.round((ys[i] - frame.top) * frame.world / step) + span;
            if (gx < 0 || gy < 0 || gx >= padded || gy >= rows + 2 * span) continue;
            const key = gy * padded + gx;
            bins.set(key, (bins.get(key) || 0) + weight);
        }
        if (bins.size === 0) return;

        const density = new Float32Array(columns * rows);
        bins.forEach((weight, key) => {
            const bx = (key % padded) - 2 * span; // kiri-atas kernel, dalam koordinat kisi
            const by = Math.floor(key / padded) - 2 * span;
            for (let ky = 0; ky < size; ky++) {
                const y = by + ky;
                if (y < 0 || y >= rows) continue;
                for (let kx = 0; kx < size; kx++) {
                    const x = bx + kx;
                    if (x < 0 || x >= columns) continue;
                    const k = weights[ky * size + kx];
                    if (k) density[y * columns + x] += weight * k;
                }
            }
        });
        let max = settings.max;
        if (!(max > 0)) {
            max = 0;
            for (let i = 0; i < density.length; i++) if (density[i] > max) max = density[i];
        }
        if (!(max > 0)) return;
        const curve = settings.scale === "log" ? level => Math.log1p(level * 99) / Math.log(100)
            : (settings.scale === "sqrt" ? Math.sqrt : level => level);

        // Kepadatan -> warna gradasi. Keburaman ikut kepadatan (akar kuadrat, supaya titik yang
        // sepi tetap terlihat samar), jadi tepinya memudar ke peta di bawahnya.
        const small = document.createElement("canvas");
        small.width = columns;
        small.height = rows;
        const smallContext = small.getContext("2d");
        const image = smallContext.createImageData(columns, rows);
        const pixels = image.data;
        for (let i = 0; i < density.length; i++) {
            const level = curve(Math.min(1, density[i] / max));
            if (level <= 0) continue;
            const j = Math.round(level * 255) * 4;
            pixels[4 * i] = palette[j];
            pixels[4 * i + 1] = palette[j + 1];
            pixels[4 * i + 2] = palette[j + 2];
            pixels[4 * i + 3] = Math.round(Math.sqrt(level) * 255);
        }
        smallContext.putImageData(image, 0, 0);
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.drawImage(small, -step / 2, -step / 2, columns * step, rows * step);
    };

    const buildLegend = () => {
        if (legend) legend.remove();
        legend = null;
        const config = legendOptions(settings.legend);
        if (!config) return;
        const gradient = settings.gradient || HEAT_GRADIENT;
        const box = legendBox(config.title === undefined ? "Kepadatan" : config.title);
        const bar = document.createElement("div");
        bar.className = "crootjs-heat-legend-bar";
        bar.style.backgroundImage = gradientCSS(gradient);
        const ends = document.createElement("div");
        ends.className = "crootjs-heat-legend-ends";
        const low = document.createElement("span");
        low.textContent = config.low === undefined ? "Rendah" : config.low;
        const high = document.createElement("span");
        high.textContent = config.high === undefined ? "Tinggi" : config.high;
        ends.append(low, high);
        box.append(bar, ends);
        const removeControl = map.addControl(box, config.corner || "bottom-right");
        legend = { box, remove: removeControl };
    };

    const apply = () => {
        palette = gradientPalette(settings.gradient || HEAT_GRADIENT);
        kernel = null;
        layer.setOpacity(Number.isFinite(settings.opacity) ? settings.opacity : 0.8);
        buildLegend();
    };

    // Heatmap digambar dengan resolusi 1x: gradasinya memang halus, jadi layar retina tidak
    // menambah ketajaman, hanya empat kali lipat kerja.
    load(data);
    palette = gradientPalette(settings.gradient || HEAT_GRADIENT);
    const layer = canvasLayer(map, draw, () => 1);
    apply();

    return {
        setData(value) {
            load(value);
            layer.redraw();
        },
        setOptions(changes) {
            const reload = changes && "weight" in changes;
            settings = { ...settings, ...changes };
            if (reload) load(source);
            apply();
            layer.redraw();
        },
        show() {
            layer.setHidden(false);
            if (legend) legend.box.hidden = false;
        },
        hide() {
            layer.setHidden(true);
            if (legend) legend.box.hidden = true;
        },
        remove() {
            layer.remove();
            if (legend) legend.remove();
        },
    };
}

// Petak tempat sebuah titik dunia (x, y) jatuh, untuk kisi selebar `size`:
// persegi = kolom dan baris; heksagon (ujung runcing di atas) = koordinat aksial, dibulatkan
// ke heksagon terdekat.
function cellOf(shape, size, x, y) {
    if (shape !== "hex") return [Math.floor(x / size), Math.floor(y / size)];
    const radius = size / Math.sqrt(3);
    const q = (Math.sqrt(3) / 3 * x - y / 3) / radius;
    const r = (2 / 3 * y) / radius;
    let rq = Math.round(q);
    let rr = Math.round(r);
    const rs = Math.round(-q - r);
    const dq = Math.abs(rq - q);
    const dr = Math.abs(rr - r);
    const ds = Math.abs(rs + q + r);
    if (dq > dr && dq > ds) rq = -rr - rs;
    else if (dr > ds) rr = -rq - rs;
    return [rq, rr];
}

function cellCenter(shape, size, column, row) {
    if (shape !== "hex") return [(column + 0.5) * size, (row + 0.5) * size];
    const radius = size / Math.sqrt(3);
    return [radius * Math.sqrt(3) * (column + row / 2), radius * 1.5 * row];
}

function cellKey(column, row) {
    return (column + KEY_FACTOR / 2) * KEY_FACTOR + (row + KEY_FACTOR / 2);
}

// Batas warna otomatis: rentang nilai petak dibagi rata sebanyak warna yang ada.
function autoBreaks(cells, colors) {
    let min = Infinity;
    let max = -Infinity;
    cells.forEach(cell => {
        if (cell.value < min) min = cell.value;
        if (cell.value > max) max = cell.value;
    });
    if (!Number.isFinite(min)) return [];
    // Nilai bulat semua (misalnya banyak titik): batasnya ikut dibulatkan.
    let whole = true;
    cells.forEach(cell => { if (!Number.isInteger(cell.value)) whole = false; });
    const step = (max - min) / colors.length;
    return colors.map((color, index) => ({ value: whole ? Math.round(min + step * index) : min + step * index, color }));
}

function breakLabel(breaks, index) {
    const current = breaks[index];
    if (current.label !== undefined) return String(current.label);
    if (breaks.length === 1) return formatNumber(current.value);
    if (index === 0) return "< " + formatNumber(breaks[1].value);
    if (index === breaks.length - 1) return "≥ " + formatNumber(current.value);
    return formatNumber(current.value) + " – " + formatNumber(breaks[index + 1].value);
}

function breakIndex(breaks, value) {
    let index = 0;
    for (let i = 1; i < breaks.length; i++) {
        if (value >= breaks[i].value) index = i;
    }
    return index;
}

// Menggambar data titik sebagai petak berwarna (persegi atau heksagon). Titik-titik di satu
// petak digabung; warna petak ditentukan nilai gabungannya, seperti peta cakupan sinyal.
// data: GeoJSON berisi Point/MultiPoint, atau array [lng, lat] / [lng, lat, nilai].
// options (semua opsional):
//   value       nilai tiap titik: nama properti atau function(feature) => angka (data array:
//               elemen ketiga). Titik tanpa nilai angka dilewati. Tanpa value: petak dihitung
//               dari banyaknya titik.
//   aggregate   "mean" (bawaan kalau ada value), "max", "min", "sum", atau "count" (bawaan
//               tanpa value).
//   shape       "square" (bawaan) atau "hex".
//   cellSize    lebar petak dalam piksel layar. Bawaan 32. Petak dikelompokkan ulang tiap
//               level zoom, jadi ukurannya di layar tetap.
//   cellMeters  lebar petak dalam meter (menggantikan cellSize): petaknya tetap di lapangan,
//               ikut membesar saat di-zoom.
//   breaks      [{ value, color, label }] urut naik: petak bernilai >= value memakai color itu
//               (yang di bawah break pertama memakai warna pertama). Bawaan: rentang nilai
//               dibagi rata ke `colors`.
//   colors      warna untuk batas otomatis, rendah -> tinggi. Bawaan merah - kuning - hijau.
//   opacity     keburaman lapisan (0-1). Bawaan 0,7.
//   stroke      warna garis tepi petak. Bawaan tanpa garis.
//   popup       function(cell) => teks atau elemen saat petak diklik; false = tanpa popup.
//               Bawaan: nilai dan banyak titiknya.
//   onClick     function(cell) yang dipanggil saat petak diklik.
//   legend      true atau { title, corner } untuk menampilkan legenda warnanya.
// cell = { value, count, mean, min, max, sum, center: [lng, lat], color, label }.
// Mengembalikan { setData(data), setOptions(options), show(), hide(), remove() }.
export function addGridMap(id, data, options = {}) {
    const map = mapOf(id);
    const nothing = { setData() {}, setOptions() {}, show() {}, hide() {}, remove() {} };
    if (!map) return nothing;
    injectStyles();
    let settings = { ...options };
    let source = data;
    let points = null;
    let levels = new Map(); // level zoom (atau "m" untuk cellMeters) -> { size, cells, breaks }
    let shownLevel = null;
    let legend = null;
    let hidden = false;
    let popup = null;
    const closeOwnPopup = () => {
        if (popup && popup.isConnected) map.closePopup();
        popup = null;
    };

    // Data array [lng, lat, nilai] memakai elemen ketiganya sebagai nilai tanpa perlu opsi value.
    const arrayValues = value => Array.isArray(value) && value.length > 0 && Array.isArray(value[0]) && value[0].length > 2;
    const hasValue = () => settings.value !== undefined || arrayValues(source);
    const aggregate = () => {
        const name = settings.aggregate;
        if (name && AGGREGATE_NAMES[name] && (name === "count" || hasValue())) return name;
        return hasValue() ? "mean" : "count";
    };
    const shape = () => (settings.shape === "hex" ? "hex" : "square");

    const load = value => {
        source = value;
        points = readPoints(value, hasValue() ? reader(settings.value) : () => 1, hasValue());
        levels = new Map();
    };

    // Ukuran petak dalam satuan dunia (0..1). cellMeters memakai lintang rata-rata data.
    const levelKey = zoom => (Number.isFinite(settings.cellMeters) && settings.cellMeters > 0 ? "m" : Math.max(0, Math.min(MAX_LEVEL, Math.round(zoom))));
    const sizeFor = key => {
        if (key === "m") {
            let sum = 0;
            for (let i = 0; i < points.total; i++) sum += points.ys[i];
            const latitude = points.total ? unproject([0, sum / points.total])[1] : 0;
            // minimal 2 m: kunci petak (kolom x baris) harus tetap muat di angka bulat aman
            return Math.max(2, settings.cellMeters) / worldMeters(latitude);
        }
        const pixels = Number.isFinite(settings.cellSize) && settings.cellSize > 0 ? settings.cellSize : 32;
        return pixels / (TILE_SIZE * Math.pow(2, key));
    };

    // Pengelompokan sekali jalan per level, disimpan untuk dipakai lagi saat level itu kembali.
    const gridAt = key => {
        let grid = levels.get(key);
        if (grid) return grid;
        const size = sizeFor(key);
        const kind = shape();
        const cells = new Map();
        const { xs, ys, values, total } = points;
        for (let i = 0; i < total; i++) {
            const [column, row] = cellOf(kind, size, xs[i], ys[i]);
            const k = cellKey(column, row);
            const value = values[i];
            const cell = cells.get(k);
            if (cell) {
                cell.count++;
                cell.sum += value;
                if (value < cell.min) cell.min = value;
                if (value > cell.max) cell.max = value;
            } else {
                cells.set(k, { column, row, count: 1, sum: value, min: value, max: value });
            }
        }
        const mode = aggregate();
        cells.forEach(cell => {
            cell.mean = cell.sum / cell.count;
            cell.value = mode === "count" ? cell.count : cell[mode];
        });
        const breaks = Array.isArray(settings.breaks) && settings.breaks.length
            ? [...settings.breaks].sort((a, b) => a.value - b.value)
            : autoBreaks(cells, Array.isArray(settings.colors) && settings.colors.length ? settings.colors : GRID_COLORS);
        cells.forEach(cell => { cell.colorIndex = breakIndex(breaks, cell.value); });
        grid = { size, cells, breaks, kind };
        levels.set(key, grid);
        return grid;
    };

    const tracePath = (context, grid, cell, frame) => {
        const [cx, cy] = cellCenter(grid.kind, grid.size, cell.column, cell.row);
        const x = (cx - frame.left) * frame.world;
        const y = (cy - frame.top) * frame.world;
        const pixels = grid.size * frame.world;
        if (grid.kind !== "hex") {
            context.rect(x - pixels / 2, y - pixels / 2, pixels, pixels);
            return;
        }
        const radius = pixels / Math.sqrt(3);
        for (let corner = 0; corner < 6; corner++) {
            const angle = Math.PI / 180 * (60 * corner - 30);
            const px = x + radius * Math.cos(angle);
            const py = y + radius * Math.sin(angle);
            if (corner === 0) context.moveTo(px, py);
            else context.lineTo(px, py);
        }
        context.closePath();
    };

    const draw = (context, frame) => {
        if (!points || points.total === 0) return;
        const key = levelKey(frame.zoom);
        const grid = gridAt(key);
        if (key !== shownLevel) {
            shownLevel = key;
            buildLegend(grid);
        }
        const reach = grid.size; // petak yang sebagian masuk layar tetap digambar
        const minX = frame.left - reach;
        const minY = frame.top - reach;
        const maxX = frame.left + frame.width / frame.world + reach;
        const maxY = frame.top + frame.height / frame.world + reach;
        // Satu path per warna: jauh lebih cepat daripada fill() per petak.
        const paths = grid.breaks.map(() => []);
        grid.cells.forEach(cell => {
            const [cx, cy] = cellCenter(grid.kind, grid.size, cell.column, cell.row);
            if (cx < minX || cy < minY || cx > maxX || cy > maxY) return;
            paths[cell.colorIndex].push(cell);
        });
        const stroke = settings.stroke;
        paths.forEach((cells, index) => {
            if (!cells.length) return;
            context.beginPath();
            cells.forEach(cell => tracePath(context, grid, cell, frame));
            context.fillStyle = grid.breaks[index].color;
            context.fill();
            if (stroke) {
                context.strokeStyle = stroke;
                context.lineWidth = 1;
                context.stroke();
            }
        });
    };

    const buildLegend = grid => {
        if (legend) legend.remove();
        legend = null;
        const config = legendOptions(settings.legend);
        if (!config || !grid || !grid.breaks.length) return;
        const title = config.title === undefined
            ? (typeof settings.value === "string" ? settings.value : AGGREGATE_NAMES[aggregate()])
            : config.title;
        const box = legendBox(title);
        [...grid.breaks.keys()].reverse().forEach(index => {
            const row = document.createElement("div");
            row.className = "crootjs-heat-legend-row";
            const swatch = document.createElement("span");
            swatch.className = "crootjs-heat-legend-swatch";
            swatch.style.backgroundColor = grid.breaks[index].color;
            const text = document.createElement("span");
            text.textContent = breakLabel(grid.breaks, index);
            row.append(swatch, text);
            box.appendChild(row);
        });
        box.hidden = hidden;
        const removeControl = map.addControl(box, config.corner || "bottom-right");
        legend = { box, remove: removeControl };
    };

    const describeCell = (grid, cell) => {
        const [cx, cy] = cellCenter(grid.kind, grid.size, cell.column, cell.row);
        const color = grid.breaks[cell.colorIndex];
        return {
            value: cell.value, count: cell.count, mean: cell.mean, min: cell.min, max: cell.max, sum: cell.sum,
            center: unproject([cx, cy]),
            color: color ? color.color : null,
            label: color ? breakLabel(grid.breaks, cell.colorIndex) : "",
        };
    };

    const defaultPopup = info => {
        const box = document.createElement("div");
        const mode = aggregate();
        const lines = mode === "count"
            ? [`${formatNumber(info.count)} titik`]
            : [`${AGGREGATE_NAMES[mode]}: ${formatNumber(info.value)}`, `${formatNumber(info.count)} titik`];
        if (mode !== "count" && info.count > 1) lines.push(`Rentang: ${formatNumber(info.min)} – ${formatNumber(info.max)}`);
        lines.forEach((line, index) => {
            const row = document.createElement("div");
            if (index === 0) {
                const strong = document.createElement("b");
                strong.textContent = line;
                row.appendChild(strong);
            } else {
                row.textContent = line;
            }
            box.appendChild(row);
        });
        return box;
    };

    // Klik peta yang tidak mengenai fitur addGeoJSON: cari petaknya pada level yang tampil.
    const stopClick = map.onClick((position, feature) => {
        if (hidden || feature || !points || points.total === 0) return;
        const grid = gridAt(levelKey(map.getView().zoom));
        const [x, y] = project(position);
        const [column, row] = cellOf(grid.kind, grid.size, x, y);
        const cell = grid.cells.get(cellKey(column, row));
        if (!cell) return;
        const info = describeCell(grid, cell);
        if (settings.popup !== false) {
            const content = typeof settings.popup === "function" ? settings.popup(info) : defaultPopup(info);
            if (content !== null && content !== undefined && content !== "") {
                // dibungkus supaya hide()/remove() tahu popup yang terbuka masih milik lapisan ini
                popup = document.createElement("div");
                if (content instanceof Node) popup.appendChild(content);
                else popup.textContent = String(content);
                map.showPopup(info.center, popup);
            }
        }
        if (typeof settings.onClick === "function") settings.onClick(info);
    });

    load(data);
    const layer = canvasLayer(map, draw, () => Math.min(2, window.devicePixelRatio || 1));
    layer.setOpacity(Number.isFinite(settings.opacity) ? settings.opacity : 0.7);

    return {
        setData(value) {
            load(value);
            shownLevel = null;
            layer.redraw();
        },
        setOptions(changes) {
            settings = { ...settings, ...changes };
            load(source);
            shownLevel = null;
            layer.setOpacity(Number.isFinite(settings.opacity) ? settings.opacity : 0.7);
            layer.redraw();
        },
        show() {
            hidden = false;
            layer.setHidden(false);
            if (legend) legend.box.hidden = false;
        },
        hide() {
            hidden = true;
            layer.setHidden(true);
            closeOwnPopup();
            if (legend) legend.box.hidden = true;
        },
        remove() {
            stopClick();
            closeOwnPopup();
            layer.remove();
            if (legend) legend.remove();
        },
    };
}
