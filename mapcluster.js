// Modul tambahan untuk map.js: pengelompokan titik (clustering) untuk data titik yang sangat
// banyak. Titik-titik yang berdekatan di layar digabung menjadi satu gelembung berangka;
// makin di-zoom, gelembungnya pecah menjadi kelompok yang lebih kecil sampai titik satuan.
// Sengaja tidak mengimpor map.js - petanya dijangkau lewat antarmuka yang dititipkan
// createMap() di elemennya (element.crootjsMap), supaya map.js tidak termuat dua kali.
import { parseGeoJSON } from "./geo.js";

const TILE_SIZE = 256;
const MAX_LEVEL = 22;        // level zoom terdalam yang diperiksa saat mencari kapan sebuah kelompok pecah
const KEY_FACTOR = 67108864; // 2^26: menggabungkan nomor kolom dan baris sel menjadi satu angka kunci
const LIST_LIMIT = 5;        // jumlah titik yang dirinci di popup kelompok yang tidak bisa dipecah lagi

function injectStyles() {
    if (document.getElementById("crootjs-mapcluster-style")) return;
    const style = document.createElement("style");
    style.id = "crootjs-mapcluster-style";
    style.textContent = `
.crootjs-cluster,
.crootjs-cluster-point {
    position: absolute;
    left: 0;
    top: 0;
    box-sizing: border-box;
    border-radius: 50%;
    background-color: #2563eb;
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
}
.crootjs-cluster {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border: 3px solid rgba(255, 255, 255, 0.85);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
    color: #fff;
    font: 600 12px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.crootjs-cluster-medium { width: 42px; height: 42px; font-size: 13px; }
.crootjs-cluster-large { width: 52px; height: 52px; font-size: 14px; }
.crootjs-cluster-point {
    width: 18px;
    height: 18px;
    border: 2px solid #fff;
    box-shadow: 0 0 3px rgba(0, 0, 0, 0.4);
}
.crootjs-cluster:focus-visible,
.crootjs-cluster-point:focus-visible { outline: 2px solid #111827; outline-offset: 2px; }
.crootjs-cluster-list > div + div { margin-top: 4px; padding-top: 4px; border-top: 1px solid #e5e7eb; }
`;
    document.head.appendChild(style);
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

// 1234 -> "1,2rb", 15400 -> "15rb", 2300000 -> "2,3jt"
function formatCount(count) {
    const short = (value, unit) => (value < 10 ? value.toFixed(1).replace(".", ",").replace(",0", "") : Math.round(value)) + unit;
    if (count >= 1000000) return short(count / 1000000, "jt");
    if (count >= 1000) return short(count / 1000, "rb");
    return String(count);
}

function formatValue(value) {
    if (value === undefined || value === null) return "";
    return typeof value === "object" ? JSON.stringify(value) : String(value);
}

// Daftar "nama: nilai" dari properties sebuah fitur, dipasang sebagai teks (bukan HTML).
function describe(feature) {
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

// Menggambar fitur-fitur titik (Point/MultiPoint) di dalam `geojson` sebagai kelompok.
// Fitur yang bukan titik dilewati - gambar dengan addGeoJSON() dari map.js.
// options (semua opsional):
//   radius  jarak pengelompokan dalam piksel: titik-titik dalam satu kotak selebar ini
//           digabung. Bawaan 60. Makin besar, makin sedikit gelembung di layar.
//   color   warna gelembung dan titik. Bawaan biru.
//   popup   function (feature) => teks atau elemen DOM yang ditampilkan saat sebuah titik
//           satuan diklik (null = tanpa popup untuk titik itu). Bawaan: daftar
//           properties-nya. false = tanpa popup sama sekali.
//   onClick function (feature) yang dipanggil saat sebuah titik satuan diklik
// Mengembalikan function remove() untuk menghapus semuanya dari peta.
export function addCluster(id, geojson, options = {}) {
    const map = mapOf(id);
    if (!map) return () => {};
    const collection = parseGeoJSON(geojson);
    if (!collection) {
        console.warn("addCluster: datanya bukan GeoJSON, tidak ada yang digambar.");
        return () => {};
    }
    injectStyles();

    // Setiap titik diproyeksikan sekali di sini; pengelompokan sesudahnya hanya berhitung
    // dengan angka-angka ini.
    const features = [];
    const coordinates = [];
    collection.features.forEach(feature => {
        const geometry = feature.geometry;
        if (!geometry) return;
        const list = geometry.type === "Point" ? [geometry.coordinates]
            : (geometry.type === "MultiPoint" ? geometry.coordinates : []);
        list.forEach(position => {
            const point = project(position);
            features.push(feature);
            coordinates.push(point[0], point[1]);
        });
    });
    const total = features.length;
    const xs = new Float64Array(total);
    const ys = new Float64Array(total);
    for (let i = 0; i < total; i++) {
        xs[i] = coordinates[2 * i];
        ys[i] = coordinates[2 * i + 1];
    }

    const radius = Number.isFinite(options.radius) && options.radius > 0 ? options.radius : 60;
    const cellSize = level => radius / (TILE_SIZE * Math.pow(2, level));
    const levels = new Map();   // level zoom -> Map(kunci sel -> kelompok)
    const elements = new Map(); // "level:kunci sel" -> elemen yang sedang tampil

    // Pengelompokan dengan kisi: pada tiap level zoom dunia dibagi menjadi kotak selebar
    // `radius` piksel, dan semua titik di satu kotak menjadi satu kelompok yang digambar di
    // titik tengah anggotanya. Sekali jalan per level (dihitung saat level itu pertama kali
    // dibutuhkan), tanpa membandingkan titik satu per satu - itu yang membuatnya tetap cepat
    // untuk ratusan ribu titik.
    const clustersAt = level => {
        let clusters = levels.get(level);
        if (clusters) return clusters;
        clusters = new Map();
        const cell = cellSize(level);
        for (let i = 0; i < total; i++) {
            const key = Math.floor(xs[i] / cell) * KEY_FACTOR + Math.floor(ys[i] / cell);
            const cluster = clusters.get(key);
            if (cluster) {
                cluster.count++;
                cluster.sumX += xs[i];
                cluster.sumY += ys[i];
                if (xs[i] < cluster.minX) cluster.minX = xs[i];
                if (xs[i] > cluster.maxX) cluster.maxX = xs[i];
                if (ys[i] < cluster.minY) cluster.minY = ys[i];
                if (ys[i] > cluster.maxY) cluster.maxY = ys[i];
            } else {
                clusters.set(key, { key, level, count: 1, first: i, sumX: xs[i], sumY: ys[i], minX: xs[i], maxX: xs[i], minY: ys[i], maxY: ys[i] });
            }
        }
        levels.set(level, clusters);
        return clusters;
    };

    // Kelompok yang seluruh anggotanya di posisi yang sama (atau peta sudah di zoom terdekat)
    // tidak bisa dipecah lagi: isinya dirinci di popup.
    const showMembers = cluster => {
        const cell = cellSize(cluster.level);
        const list = document.createElement("div");
        list.className = "crootjs-cluster-list";
        const heading = document.createElement("b");
        heading.textContent = `${cluster.count} titik di lokasi ini`;
        list.appendChild(heading);
        let shown = 0;
        for (let i = cluster.first; i < total && shown < LIST_LIMIT; i++) {
            if (Math.floor(xs[i] / cell) * KEY_FACTOR + Math.floor(ys[i] / cell) !== cluster.key) continue;
            const item = describe(features[i]);
            if (item) list.appendChild(item);
            shown++;
        }
        if (cluster.count > shown) {
            const more = document.createElement("div");
            more.textContent = `dan ${cluster.count - shown} lainnya`;
            list.appendChild(more);
        }
        map.showPopup(unproject([cluster.sumX / cluster.count, cluster.sumY / cluster.count]), list, 20);
    };

    const tap = cluster => {
        const center = unproject([cluster.sumX / cluster.count, cluster.sumY / cluster.count]);
        if (cluster.count === 1) {
            const feature = features[cluster.first];
            if (options.popup !== false) {
                const content = typeof options.popup === "function" ? options.popup(feature) : describe(feature);
                if (content !== null && content !== undefined && content !== "") map.showPopup(center, content, 11);
            }
            if (typeof options.onClick === "function") options.onClick(feature);
            return;
        }
        // Zoom secukupnya: ke level pertama tempat anggota kelompok ini tidak lagi berada di
        // satu kotak yang sama.
        let level = cluster.level + 1;
        while (level <= MAX_LEVEL) {
            const cell = cellSize(level);
            if (Math.floor(cluster.minX / cell) !== Math.floor(cluster.maxX / cell)
                || Math.floor(cluster.minY / cell) !== Math.floor(cluster.maxY / cell)) break;
            level++;
        }
        const before = map.getView().zoom;
        if (level <= MAX_LEVEL) map.setView(center, level);
        if (map.getView().zoom <= before) showMembers(cluster);
    };

    const createElement = cluster => {
        const element = document.createElement("div");
        if (cluster.count === 1) {
            element.className = "crootjs-cluster-point";
        } else {
            element.className = "crootjs-cluster" + (cluster.count >= 1000 ? " crootjs-cluster-large" : (cluster.count >= 100 ? " crootjs-cluster-medium" : ""));
            element.textContent = formatCount(cluster.count);
            element.setAttribute("aria-label", `${cluster.count} titik, klik untuk memperbesar`);
        }
        if (options.color) element.style.backgroundColor = options.color;
        element.tabIndex = 0;
        element.setAttribute("role", "button");
        map.onTap(element, () => tap(cluster));
        element.addEventListener("keydown", event => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            event.stopPropagation();
            tap(cluster);
        });
        return element;
    };

    // Hanya kelompok yang berada di area tampak yang punya elemen di halaman, jadi jumlah
    // elemennya dibatasi ukuran layar, bukan jumlah data.
    const render = view => {
        const level = Math.max(0, Math.min(MAX_LEVEL, Math.round(view.zoom)));
        const clusters = clustersAt(level);
        const cell = cellSize(level);
        const world = TILE_SIZE * Math.pow(2, view.zoom);
        const center = project(view.center);
        const width = map.overlay.clientWidth;
        const height = map.overlay.clientHeight;
        const left = center[0] - width / 2 / world;
        const top = center[1] - height / 2 / world;

        const visible = new Set();
        const lastColumn = Math.floor((left + width / world) / cell) + 1;
        const lastRow = Math.floor((top + height / world) / cell) + 1;
        for (let column = Math.floor(left / cell) - 1; column <= lastColumn; column++) {
            for (let row = Math.floor(top / cell) - 1; row <= lastRow; row++) {
                const cluster = clusters.get(column * KEY_FACTOR + row);
                if (!cluster) continue;
                const name = level + ":" + cluster.key;
                visible.add(name);
                let element = elements.get(name);
                if (!element) {
                    element = createElement(cluster);
                    elements.set(name, element);
                    map.overlay.appendChild(element);
                }
                const x = (cluster.sumX / cluster.count - center[0]) * world + width / 2;
                const y = (cluster.sumY / cluster.count - center[1]) * world + height / 2;
                element.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -50%)`;
            }
        }
        elements.forEach((element, name) => {
            if (visible.has(name)) return;
            element.remove();
            elements.delete(name);
        });
    };

    render(map.getView());
    const stopFollowing = map.onMove(render);

    return function remove() {
        stopFollowing();
        elements.forEach(element => element.remove());
        elements.clear();
    };
}
