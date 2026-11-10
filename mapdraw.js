// Modul tambahan untuk map.js: menggambar titik, garis, dan poligon langsung di peta, lalu
// mengubahnya (geser simpul, tambah simpul di tengah ruas, hapus simpul). Hasilnya GeoJSON.
// Sengaja tidak mengimpor map.js - petanya dijangkau lewat antarmuka yang dititipkan
// createMap() di elemennya (element.crootjsMap), supaya map.js tidak termuat dua kali.
// geo.js boleh diimpor: isinya fungsi tanpa keadaan.
import { parseGeoJSON } from "./geo.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const SAME_POINT = 3;       // piksel; klik sedekat ini dengan titik terakhir dianggap klik yang sama
const CLOSE_DISTANCE = 12;  // piksel; klik sedekat ini dengan titik pertama menutup poligon
const LONG_PRESS_MS = 500;  // tekan lama pada simpul (layar sentuh) = hapus simpul
const PRECISION = 7;        // angka di belakang koma koordinat hasil (sekitar 1 cm)
const KINDS = { point: "point", Point: "point", line: "line", LineString: "line", polygon: "polygon", Polygon: "polygon" };
const MINIMUM = { point: 1, line: 2, polygon: 3 };

const POINT_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>';
const LINE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M4 19l6-9 4 5 6-11"/><circle cx="4" cy="19" r="1.5"/><circle cx="20" cy="4" r="1.5"/></svg>';
const POLYGON_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M5 8l7-5 7 6-2 11H7z"/></svg>';
const EDIT_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/></svg>';
const DELETE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';

function injectStyles() {
    if (document.getElementById("crootjs-mapdraw-style")) return;
    const style = document.createElement("style");
    style.id = "crootjs-mapdraw-style";
    style.textContent = `
.crootjs-map-overlay > svg.crootjs-draw {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
    pointer-events: none;
}
.crootjs-draw .crootjs-draw-shape { fill: #2563eb; fill-opacity: 0.2; stroke: #2563eb; stroke-width: 2.5; stroke-linejoin: round; stroke-linecap: round; }
.crootjs-draw .crootjs-draw-line { fill: none; }
.crootjs-draw .crootjs-draw-preview { fill: none; stroke: #2563eb; stroke-width: 2; stroke-dasharray: 6 4; }
.crootjs-draw .crootjs-draw-editing { stroke: #f97316; fill: #f97316; stroke-dasharray: 6 4; }
.crootjs-draw circle.crootjs-draw-point { fill: #2563eb; stroke: #fff; stroke-width: 2; }
.crootjs-draw circle.crootjs-draw-vertex { fill: #fff; stroke: #f97316; stroke-width: 2; pointer-events: all; cursor: move; touch-action: none; }
.crootjs-draw circle.crootjs-draw-vertex-first { fill: #f97316; }
.crootjs-draw circle.crootjs-draw-midpoint { fill: #f97316; fill-opacity: 0.6; stroke: #fff; stroke-width: 1.5; pointer-events: all; cursor: copy; touch-action: none; }
.crootjs-draw .crootjs-draw-feature { pointer-events: visiblePainted; cursor: pointer; }
.crootjs-draw-deleting .crootjs-draw-feature:hover { stroke: #dc2626; fill: #dc2626; }
.crootjs-map-draw {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.crootjs-map-draw-buttons { display: flex; flex-wrap: wrap; gap: 6px; }
.crootjs-map button.crootjs-map-draw-tool {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    min-width: 0;
    height: 32px;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 6px;
    background-color: #fff;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
    color: #1f2937;
    cursor: pointer;
}
.crootjs-map button.crootjs-map-draw-tool:hover { background-color: #f3f4f6; }
.crootjs-map button.crootjs-map-draw-tool[aria-pressed="true"] { color: #ea580c; }
.crootjs-map-draw-panel {
    max-width: 240px;
    padding: 6px 8px;
    border-radius: 6px;
    background-color: #fff;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
    color: #1f2937;
}
.crootjs-map-draw-panel[hidden] { display: none; }
.crootjs-map-draw-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.crootjs-map-draw-actions button {
    margin: 0;
    padding: 2px 8px;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    background-color: #fff;
    color: #1f2937;
    font: inherit;
    font-size: 12px;
    cursor: pointer;
}
.crootjs-map-draw-actions button:hover { background-color: #f3f4f6; }
.crootjs-map-draw-actions button[hidden] { display: none; }
@media (pointer: coarse) {
    .crootjs-draw circle.crootjs-draw-vertex { r: 9px; }
    .crootjs-draw circle.crootjs-draw-midpoint { r: 7px; }
}
`;
    // Di awal <head> (sesudah style CrootJS lain): CSS halaman yang ditautkan sesudahnya
    // menang tanpa !important.
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

function svgElement(name, className) {
    const element = document.createElementNS(SVG_NS, name);
    if (className) element.setAttribute("class", className);
    return element;
}

const round = position => position.map(value => Number(value.toFixed(PRECISION)));
const copy = value => JSON.parse(JSON.stringify(value));

// Daftar titik layar -> atribut d path SVG.
function pathData(points, closed) {
    if (!points.length) return "";
    return points.map((point, index) => (index ? "L" : "M") + point[0].toFixed(1) + " " + point[1].toFixed(1)).join("") + (closed && points.length > 2 ? "Z" : "");
}

function geometryOf(kind, points) {
    if (kind === "point") return { type: "Point", coordinates: round(points[0]) };
    if (kind === "line") return { type: "LineString", coordinates: points.map(round) };
    const ring = points.map(round);
    return { type: "Polygon", coordinates: [[...ring, ring[0].slice()]] };
}

function propertiesFor(options, kind) {
    const value = typeof options.properties === "function" ? options.properties(kind) : options.properties;
    return value && typeof value === "object" ? copy(value) : {};
}

// ---- Menggambar

// Mulai menggambar satu geometri. type: "point", "line", atau "polygon" (atau "Point",
// "LineString", "Polygon"). Klik peta menambah titik; klik ganda, Enter, atau klik titik
// pertama poligon = selesai; Backspace = hapus titik terakhir; Esc = batal. Titik selesai
// dengan satu klik.
// responseFunction(feature) dipanggil sekali: Feature GeoJSON hasilnya, atau null kalau
// dibatalkan. options (semua opsional):
//   properties  object, atau function (type) => object, untuk properties Feature hasilnya.
//   onChange    function (feature) setiap titik ditambah/dihapus, untuk menampilkan progres
//               (feature null kalau titiknya belum cukup).
// Mengembalikan { finish(), undo(), stop() } - finish untuk tombol "Selesai" di layar sentuh,
// yang tidak punya klik ganda.
export function startDrawing(id, type, responseFunction, options = {}) {
    const map = mapOf(id);
    const noop = { finish: () => {}, undo: () => {}, stop: () => {} };
    const kind = KINDS[type];
    if (!map) return noop;
    if (!kind) {
        console.warn(`Jenis gambar "${type}" tidak dikenal. Pakai "point", "line", atau "polygon".`);
        return noop;
    }
    injectStyles();
    if (map.root.crootjsDraw) map.root.crootjsDraw.stop();

    const points = [];
    let cursor = null; // posisi kursor mouse, untuk garis bantu ke titik berikutnya
    let finished = false;
    const svg = svgElement("svg", "crootjs-draw");
    const shape = svgElement("path", "crootjs-draw-shape" + (kind === "line" ? " crootjs-draw-line" : ""));
    const preview = svgElement("path", "crootjs-draw-preview");
    const vertices = svgElement("g");
    svg.append(shape, preview, vertices);
    map.overlay.appendChild(svg);

    const featureOf = () => points.length >= MINIMUM[kind]
        ? { type: "Feature", properties: propertiesFor(options, kind), geometry: geometryOf(kind, points) }
        : null;

    const draw = () => {
        const screen = points.map(map.toPoint);
        shape.setAttribute("d", pathData(screen, kind === "polygon"));
        const tip = cursor && !finished ? map.toPoint(cursor) : null;
        let guide = "";
        if (tip && screen.length) {
            guide = pathData([screen[screen.length - 1], tip]);
            if (kind === "polygon" && screen.length >= 2) guide += pathData([tip, screen[0]]);
        }
        preview.setAttribute("d", guide);
        while (vertices.childNodes.length > screen.length) vertices.lastChild.remove();
        screen.forEach((point, index) => {
            let circle = vertices.childNodes[index];
            if (!circle) {
                circle = svgElement("circle", "crootjs-draw-vertex");
                circle.setAttribute("r", "5");
                vertices.appendChild(circle);
            }
            // Titik pertama poligon ditandai: klik di sana menutup poligon.
            circle.classList.toggle("crootjs-draw-vertex-first", kind === "polygon" && index === 0 && screen.length >= 3);
            circle.setAttribute("cx", point[0].toFixed(1));
            circle.setAttribute("cy", point[1].toFixed(1));
        });
    };
    const changed = () => {
        draw();
        if (typeof options.onChange === "function") options.onChange(featureOf());
    };

    const add = position => {
        if (finished) return;
        const point = map.toPoint(position);
        if (points.length) {
            const last = map.toPoint(points[points.length - 1]);
            if (Math.hypot(point[0] - last[0], point[1] - last[1]) < SAME_POINT) return;
        }
        if (kind === "polygon" && points.length >= 3) {
            const first = map.toPoint(points[0]);
            if (Math.hypot(point[0] - first[0], point[1] - first[1]) < CLOSE_DISTANCE) {
                finish();
                return;
            }
        }
        points.push(position);
        changed();
        if (kind === "point") finish();
    };
    const move = event => {
        if (finished || event.pointerType !== "mouse") return;
        const rect = map.root.getBoundingClientRect();
        cursor = map.toPosition([event.clientX - rect.left, event.clientY - rect.top]);
        draw();
    };
    const leave = () => {
        cursor = null;
        draw();
    };

    let release = map.captureClick((position, eventType) => {
        if (eventType === "dblclick") finish();
        else add(position);
    });
    const stopFollowing = map.onMove(draw);
    map.root.addEventListener("pointermove", move);
    map.root.addEventListener("pointerleave", leave);

    const end = () => {
        finished = true;
        release();
        release = () => {};
        stopFollowing();
        map.root.removeEventListener("pointermove", move);
        map.root.removeEventListener("pointerleave", leave);
        document.removeEventListener("keydown", keys);
        svg.remove();
        if (map.root.crootjsDraw === controller) delete map.root.crootjsDraw;
    };
    const respond = feature => {
        if (typeof responseFunction === "function") responseFunction(feature);
    };
    function finish() {
        if (finished) return;
        const feature = featureOf();
        if (!feature) return; // belum cukup titik
        end();
        respond(feature);
    }
    const undo = () => {
        if (finished || !points.length) return;
        points.pop();
        changed();
    };
    const stop = () => {
        if (finished) return;
        end();
        respond(null);
    };
    function keys(event) {
        // Tombol di dalam kotak teks halaman bukan perintah menggambar.
        if (event.target.closest && event.target.closest("input, textarea, select, [contenteditable]")) return;
        if (event.key === "Escape") stop();
        else if (event.key === "Enter") finish();
        else if (event.key === "Backspace") undo();
        else return;
        event.preventDefault();
    }
    document.addEventListener("keydown", keys);

    const controller = { finish, undo, stop };
    map.root.crootjsDraw = controller;
    draw();
    return controller;
}

// ---- Mengubah

// Geometri -> daftar jalur yang bisa diubah: { coords, closed } per garis atau cincin poligon.
// Cincin poligon disimpan tanpa titik penutup (yang sama dengan titik pertama).
function pathsOf(geometry) {
    const open = coords => ({ coords: coords.map(position => position.slice(0, 2)), closed: false });
    const ring = coords => {
        const list = coords.map(position => position.slice(0, 2));
        const first = list[0];
        const last = list[list.length - 1];
        if (list.length > 1 && first[0] === last[0] && first[1] === last[1]) list.pop();
        return { coords: list, closed: true };
    };
    switch (geometry.type) {
    case "Point": return [{ coords: [geometry.coordinates.slice(0, 2)], closed: false, point: true }];
    case "MultiPoint": return geometry.coordinates.map(position => ({ coords: [position.slice(0, 2)], closed: false, point: true }));
    case "LineString": return [open(geometry.coordinates)];
    case "MultiLineString": return geometry.coordinates.map(open);
    case "Polygon": return geometry.coordinates.map(ring);
    case "MultiPolygon": return geometry.coordinates.flatMap(polygon => polygon.map(ring));
    default: return null;
    }
}

function geometryFrom(original, paths) {
    const closedRing = path => {
        const list = path.coords.map(round);
        return [...list, list[0].slice()];
    };
    let index = 0;
    const next = () => paths[index++];
    switch (original.type) {
    case "Point": return { type: "Point", coordinates: round(paths[0].coords[0]) };
    case "MultiPoint": return { type: "MultiPoint", coordinates: paths.map(path => round(path.coords[0])) };
    case "LineString": return { type: "LineString", coordinates: paths[0].coords.map(round) };
    case "MultiLineString": return { type: "MultiLineString", coordinates: paths.map(path => path.coords.map(round)) };
    case "Polygon": return { type: "Polygon", coordinates: paths.map(closedRing) };
    default: return { type: "MultiPolygon", coordinates: original.coordinates.map(polygon => polygon.map(() => closedRing(next()))) };
    }
}

// Menampilkan pegangan untuk mengubah sebuah geometri: geser simpul (bulat putih) untuk
// memindahkannya, geser titik tengah ruas (bulat kecil oranye) untuk menambah simpul, klik
// ganda simpul (atau tekan lama di layar sentuh) untuk menghapusnya.
// feature: Feature atau geometri GeoJSON (Point, LineString, Polygon, atau Multi-nya). Data
// aslinya tidak diubah; hasilnya dari getFeature() atau onChange.
// options (semua opsional):
//   onChange  function (feature) setiap selesai menggeser/menambah/menghapus simpul.
// Mengembalikan { getFeature(), stop() }.
export function editFeature(id, feature, options = {}) {
    const map = mapOf(id);
    const none = { getFeature: () => null, stop: () => {} };
    if (!map || !feature) return none;
    const isFeature = feature.type === "Feature";
    const source = isFeature ? feature.geometry : feature;
    const paths = source ? pathsOf(source) : null;
    if (!paths) {
        console.warn("editFeature hanya bisa mengubah Point, LineString, Polygon, dan versi Multi-nya.");
        return none;
    }
    injectStyles();
    if (map.root.crootjsEdit) map.root.crootjsEdit.stop();

    const svg = svgElement("svg", "crootjs-draw");
    const shapes = svgElement("g");
    const handles = svgElement("g");
    svg.append(shapes, handles);
    map.overlay.appendChild(svg);
    let pressTimer = 0;

    const result = () => {
        const geometry = geometryFrom(source, paths);
        return isFeature ? Object.assign(copy(feature), { geometry }) : geometry;
    };
    const changed = () => {
        draw();
        if (typeof options.onChange === "function") options.onChange(result());
    };

    // Menggeser sebuah simpul mengikuti pointer; dipakai juga untuk simpul baru dari titik tengah.
    // Gerakan didengarkan di window, bukan di pegangannya: pegangan digambar ulang setiap
    // gerakan, dan pointer capture hilang begitu elemennya diganti.
    const drag = (event, path, index) => {
        event.stopPropagation(); // jangan ikut menggeser peta
        event.preventDefault();
        const pointerId = event.pointerId;
        const startX = event.clientX;
        const startY = event.clientY;
        let moved = false;
        clearTimeout(pressTimer);
        if (event.pointerType !== "mouse" && !path.point) {
            pressTimer = setTimeout(() => remove(path, index), LONG_PRESS_MS);
        }
        const move = moveEvent => {
            if (moveEvent.pointerId !== pointerId) return;
            if (!moved && Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < SAME_POINT) return;
            moved = true;
            clearTimeout(pressTimer);
            moveEvent.preventDefault();
            const rect = map.root.getBoundingClientRect();
            path.coords[index] = map.toPosition([moveEvent.clientX - rect.left, moveEvent.clientY - rect.top]);
            draw();
        };
        const up = upEvent => {
            if (upEvent.pointerId !== pointerId) return;
            clearTimeout(pressTimer);
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
            window.removeEventListener("pointercancel", up);
            if (moved) changed();
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
        window.addEventListener("pointercancel", up);
    };
    // Simpul tidak dihapus kalau sisanya terlalu sedikit untuk garis (2) atau cincin (3).
    const remove = (path, index) => {
        if (path.point || path.coords.length <= (path.closed ? 3 : 2)) return;
        path.coords.splice(index, 1);
        changed();
    };

    function draw() {
        shapes.textContent = "";
        handles.textContent = "";
        paths.forEach(path => {
            const screen = path.coords.map(map.toPoint);
            if (!path.point) {
                const outline = svgElement("path", "crootjs-draw-shape crootjs-draw-editing" + (path.closed ? "" : " crootjs-draw-line"));
                outline.setAttribute("d", pathData(screen, path.closed));
                shapes.appendChild(outline);
                // Titik tengah tiap ruas: digeser = simpul baru di sana.
                const segments = path.closed ? screen.length : screen.length - 1;
                for (let i = 0; i < segments; i++) {
                    const a = screen[i];
                    const b = screen[(i + 1) % screen.length];
                    const middle = svgElement("circle", "crootjs-draw-midpoint");
                    middle.setAttribute("cx", ((a[0] + b[0]) / 2).toFixed(1));
                    middle.setAttribute("cy", ((a[1] + b[1]) / 2).toFixed(1));
                    middle.setAttribute("r", "4");
                    middle.addEventListener("pointerdown", event => {
                        const from = path.coords[i];
                        const to = path.coords[(i + 1) % path.coords.length];
                        path.coords.splice(i + 1, 0, [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2]);
                        drag(event, path, i + 1);
                    });
                    handles.appendChild(middle);
                }
            }
            screen.forEach((point, index) => {
                const vertex = svgElement("circle", "crootjs-draw-vertex");
                vertex.setAttribute("cx", point[0].toFixed(1));
                vertex.setAttribute("cy", point[1].toFixed(1));
                vertex.setAttribute("r", "6");
                vertex.addEventListener("pointerdown", event => drag(event, path, index));
                vertex.addEventListener("dblclick", event => {
                    event.stopPropagation(); // jangan ikut zoom peta
                    remove(path, index);
                });
                handles.appendChild(vertex);
            });
        });
    }

    const stopFollowing = map.onMove(draw);
    const controller = {
        getFeature: result,
        stop() {
            clearTimeout(pressTimer);
            stopFollowing();
            svg.remove();
            if (map.root.crootjsEdit === controller) delete map.root.crootjsEdit;
        }
    };
    map.root.crootjsEdit = controller;
    draw();
    return controller;
}

// ---- Kontrol siap pakai

// Menambahkan tombol gambar titik, garis, poligon, ubah, dan hapus ke peta, beserta lapisan
// yang menampilkan hasilnya. Data dikelola sendiri sebagai FeatureCollection.
// options (semua opsional):
//   data        GeoJSON awal yang bisa diubah/dihapus.
//   tools       daftar tombol, bawaan ["point", "line", "polygon", "edit", "delete"].
//   properties  object, atau function (type) => object, untuk fitur baru.
//   corner      pojok peta. Bawaan "top-left".
//   onChange    function (featureCollection) setiap data berubah (tambah, ubah, hapus).
// Mengembalikan { getData(), setData(geojson), clear(), remove() }.
export function addDrawControl(id, options = {}) {
    const map = mapOf(id);
    const none = { getData: () => ({ type: "FeatureCollection", features: [] }), setData() {}, clear() {}, remove() {} };
    if (!map) return none;
    injectStyles();

    let features = [];
    let mode = null;      // "point" | "line" | "polygon" | "edit" | "delete" | null
    let drawing = null;   // controller startDrawing yang sedang berjalan
    let editing = null;   // { index, controller } fitur yang sedang diubah

    // Lapisan hasil gambar.
    const layer = svgElement("svg", "crootjs-draw");
    map.overlay.appendChild(layer);

    // Kotak tombol dan panel petunjuk.
    const box = document.createElement("div");
    box.className = "crootjs-map-draw";
    const buttons = document.createElement("div");
    buttons.className = "crootjs-map-draw-buttons";
    buttons.setAttribute("role", "toolbar");
    buttons.setAttribute("aria-label", "Alat gambar");
    const panel = document.createElement("div");
    panel.className = "crootjs-map-draw-panel";
    panel.hidden = true;
    panel.setAttribute("aria-live", "polite");
    const hint = document.createElement("div");
    const actions = document.createElement("div");
    actions.className = "crootjs-map-draw-actions";
    panel.append(hint, actions);
    box.append(buttons, panel);

    const emit = () => {
        render();
        if (typeof options.onChange === "function") options.onChange(getData());
    };
    const getData = () => ({ type: "FeatureCollection", features: copy(features) });

    function render() {
        layer.textContent = "";
        layer.classList.toggle("crootjs-draw-deleting", mode === "delete");
        features.forEach((feature, index) => {
            if (editing && editing.index === index) return; // sedang tampil sebagai pegangan
            const paths = pathsOf(feature.geometry) || [];
            paths.forEach(path => {
                const screen = path.coords.map(map.toPoint);
                let element;
                if (path.point) {
                    element = svgElement("circle", "crootjs-draw-point crootjs-draw-feature");
                    element.setAttribute("cx", screen[0][0].toFixed(1));
                    element.setAttribute("cy", screen[0][1].toFixed(1));
                    element.setAttribute("r", "6");
                } else {
                    element = svgElement("path", "crootjs-draw-shape crootjs-draw-feature" + (path.closed ? "" : " crootjs-draw-line"));
                    element.setAttribute("d", pathData(screen, path.closed));
                }
                // Tap pada fitur: dipilih untuk diubah atau dihapus, bukan klik peta.
                map.onTap(element, () => tapFeature(index));
                layer.appendChild(element);
            });
        });
    }

    function tapFeature(index) {
        if (mode === "delete") {
            features.splice(index, 1);
            emit();
        } else if (mode === "edit") {
            stopEditing();
            editing = {
                index,
                controller: editFeature(id, features[index], {
                    onChange: feature => {
                        features[index] = feature;
                        if (typeof options.onChange === "function") options.onChange(getData());
                    }
                })
            };
            hint.textContent = "Geser simpul untuk memindahkan, geser titik tengah untuk menambah, klik ganda (atau tekan lama) simpul untuk menghapus.";
            render();
        }
    }
    function stopEditing() {
        if (!editing) return;
        editing.controller.stop();
        editing = null;
        render();
    }

    const actionButton = (label, runFunction) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.addEventListener("click", runFunction);
        actions.appendChild(button);
        return button;
    };
    const finishButton = actionButton("Selesai", () => {
        if (drawing) drawing.finish();
        else setMode(null);
    });
    const undoButton = actionButton("Hapus titik", () => drawing && drawing.undo());
    const cancelButton = actionButton("Batal", () => setMode(null));

    const HINTS = {
        point: "Klik peta untuk menaruh titik.",
        line: "Klik titik-titik garis. Klik ganda atau Selesai untuk mengakhiri.",
        polygon: "Klik titik-titik batas area. Klik titik pertama, klik ganda, atau Selesai untuk mengakhiri.",
        edit: "Klik fitur yang ingin diubah.",
        delete: "Klik fitur yang ingin dihapus."
    };
    const tools = {};
    function setMode(next) {
        if (drawing) {
            const running = drawing;
            drawing = null;
            running.stop();
        }
        stopEditing();
        mode = mode === next ? null : next;
        Object.keys(tools).forEach(key => tools[key].setAttribute("aria-pressed", String(key === mode)));
        panel.hidden = !mode;
        hint.textContent = mode ? HINTS[mode] : "";
        const drawingMode = mode === "point" || mode === "line" || mode === "polygon";
        undoButton.hidden = !(mode === "line" || mode === "polygon");
        cancelButton.hidden = !drawingMode;
        finishButton.hidden = mode === "point";
        render();
        if (drawingMode) {
            const kind = mode;
            const controller = startDrawing(id, kind, feature => {
                if (drawing !== controller) return; // dihentikan oleh setMode sendiri
                drawing = null;
                if (feature) {
                    features.push(feature);
                    emit();
                }
                // Langsung siap menggambar fitur berikutnya dengan alat yang sama.
                if (feature && mode === kind) {
                    mode = null;
                    setMode(kind);
                } else if (mode === kind) {
                    setMode(kind);
                }
            }, { properties: options.properties });
            drawing = controller;
        }
    }

    const ICONS = { point: [POINT_ICON, "Gambar titik"], line: [LINE_ICON, "Gambar garis"], polygon: [POLYGON_ICON, "Gambar area"], edit: [EDIT_ICON, "Ubah bentuk"], delete: [DELETE_ICON, "Hapus fitur"] };
    (Array.isArray(options.tools) ? options.tools : Object.keys(ICONS)).forEach(name => {
        if (!ICONS[name]) return;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "crootjs-map-draw-tool";
        button.innerHTML = ICONS[name][0];
        button.title = ICONS[name][1];
        button.setAttribute("aria-label", ICONS[name][1]);
        button.setAttribute("aria-pressed", "false");
        button.addEventListener("click", () => setMode(name));
        buttons.appendChild(button);
        tools[name] = button;
    });

    // Esc keluar dari mode ubah/hapus (saat menggambar, Esc sudah ditangani startDrawing).
    const keys = event => {
        if (event.key !== "Escape" || !mode || drawing) return;
        if (event.target.closest && event.target.closest("input, textarea, select, [contenteditable]")) return;
        setMode(null);
    };
    document.addEventListener("keydown", keys);

    const setData = geojson => {
        stopEditing();
        const collection = geojson ? parseGeoJSON(geojson) : null;
        features = collection ? collection.features.filter(feature => feature.geometry && pathsOf(feature.geometry)) : [];
        render();
    };
    setData(options.data);
    const stopFollowing = map.onMove(render);
    const removeControl = map.addControl(box, options.corner || "top-left");

    return {
        getData,
        setData,
        clear() {
            setData(null);
            emit();
        },
        remove() {
            setMode(null);
            document.removeEventListener("keydown", keys);
            stopFollowing();
            removeControl();
            layer.remove();
        }
    };
}
