// Modul tambahan untuk map.js: alat ukur jarak dan luas, gambar bergeoreferensi (image
// overlay), dan ekspor tampilan peta ke PNG.
// Sengaja tidak mengimpor map.js - petanya dijangkau lewat antarmuka yang dititipkan
// createMap() di elemennya (element.crootjsMap), supaya map.js tidak termuat dua kali.
// geomeasure.js boleh diimpor: isinya fungsi hitungan murni tanpa keadaan, jadi termuat dua
// kali pun tidak apa-apa.
import { getLength, getArea } from "./geomeasure.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const SAME_POINT = 3; // piksel; klik sedekat ini dengan titik terakhir dianggap klik yang sama

const RULER_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true">'
    + '<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/></svg>';

const AREA_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true">'
    + '<path d="M4 7l7-4 9 6-3 11H6z"/></svg>';

function injectStyles() {
    if (document.getElementById("crootjs-maptools-style")) return;
    const style = document.createElement("style");
    style.id = "crootjs-maptools-style";
    style.textContent = `
.crootjs-map-overlay > svg.crootjs-measure {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
    pointer-events: none;
}
.crootjs-measure path { fill: #f97316; fill-opacity: 0.15; stroke: #f97316; stroke-width: 2.5; stroke-dasharray: 6 4; stroke-linejoin: round; }
.crootjs-measure circle { fill: #fff; stroke: #f97316; stroke-width: 2; }
.crootjs-measure text {
    font: 600 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    fill: #9a3412;
    stroke: #fff;
    stroke-width: 3px;
    paint-order: stroke;
}
.crootjs-map-measure {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
}
.crootjs-map-measure-buttons { display: flex; gap: 6px; }
.crootjs-map button.crootjs-map-button.crootjs-map-button-active { color: #ea580c; }
.crootjs-map-measure-result {
    padding: 6px 8px;
    border-radius: 6px;
    background-color: #fff;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
    color: #1f2937;
    font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    user-select: text;
    -webkit-user-select: text;
}
.crootjs-map-measure-result[hidden] { display: none; }
.crootjs-map-measure-actions { display: flex; gap: 6px; margin-top: 4px; }
.crootjs-map-measure-actions button {
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
.crootjs-map-measure-actions button:hover { background-color: #f3f4f6; }
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

function formatNumber(value, digits) {
    return value.toLocaleString("id-ID", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

// Panjang dalam meter -> teks: "85,4 m", "640 m", "12,35 km".
export function formatLength(meters) {
    if (meters >= 1000) return formatNumber(meters / 1000, 2) + " km";
    return formatNumber(meters, meters < 100 ? 1 : 0) + " m";
}

// Luas dalam meter persegi -> teks: "850 m²", "2,45 ha", "12,30 km²".
export function formatArea(squareMeters) {
    if (squareMeters >= 1e6) return formatNumber(squareMeters / 1e6, 2) + " km²";
    if (squareMeters >= 1e4) return formatNumber(squareMeters / 1e4, 2) + " ha";
    return formatNumber(squareMeters, 0) + " m²";
}

// Hasil ukur dari daftar titik: { type, feature, length, area, text }.
function measurement(type, points) {
    if (type === "area") {
        const ring = points.length >= 3 ? [...points, points[0]] : points;
        const feature = { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } };
        const area = points.length >= 3 ? getArea(feature) : 0;
        const length = points.length >= 2 ? getLength(points.length >= 3 ? feature : { type: "LineString", coordinates: points }) : 0;
        return { type, feature, length, area, text: formatArea(area) + " · keliling " + formatLength(length) };
    }
    const feature = { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: points } };
    const length = points.length >= 2 ? getLength(feature) : 0;
    return { type, feature, length, area: 0, text: formatLength(length) };
}

// Mengukur jarak (type "distance") atau luas (type "area") dengan mengklik titik-titik di
// peta. Selama mengukur, klik peta tidak membuka popup dan tidak diteruskan ke onMapClick.
// Selesai dengan klik ganda, Enter, atau finish(); Backspace menghapus titik terakhir; Esc
// membatalkan. Di layar sentuh tidak ada klik ganda: pakai finish() (tombol Selesai di
// addMeasureControl).
// responseFunction (opsional) dipanggil sekali saat selesai dengan
// { type, feature, length, area, text } - feature berupa Feature LineString atau Polygon,
// length (jarak atau keliling) dalam meter, area dalam meter persegi, text siap tampil -
// atau null kalau dibatalkan.
// options.onChange (opsional) dipanggil dengan hasil yang sama setiap kali titiknya berubah.
// Bentuk hasil ukur tetap tergambar sampai stop() dipanggil atau pengukuran baru dimulai.
// Mengembalikan { finish(), undo(), stop() } - stop() membatalkan dan menghapus gambarnya.
export function measure(id, type, responseFunction, options = {}) {
    const map = mapOf(id);
    const noop = { finish: () => {}, undo: () => {}, stop: () => {} };
    if (!map) return noop;
    injectStyles();
    if (map.root.crootjsMeasure) map.root.crootjsMeasure.stop();

    const kind = type === "area" ? "area" : "distance";
    const points = [];
    let cursor = null;     // posisi kursor untuk garis bantu ke titik berikutnya (mouse saja)
    let finished = false;

    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "crootjs-measure");
    const path = document.createElementNS(SVG_NS, "path");
    const vertices = document.createElementNS(SVG_NS, "g");
    const label = document.createElementNS(SVG_NS, "text");
    svg.append(path, vertices, label);
    map.overlay.appendChild(svg);

    const draw = () => {
        const drawn = finished || !cursor ? points : [...points, cursor];
        const screen = drawn.map(map.toPoint);
        let d = screen.map((point, index) => (index ? "L" : "M") + point[0].toFixed(1) + " " + point[1].toFixed(1)).join("");
        if (kind === "area" && screen.length >= 3) d += "Z";
        path.setAttribute("d", d);
        // Area hanya diisi warna kalau polygon-nya sudah terbentuk.
        path.style.fillOpacity = kind === "area" ? "" : "0";
        while (vertices.childNodes.length > points.length) vertices.lastChild.remove();
        points.forEach((position, index) => {
            let circle = vertices.childNodes[index];
            if (!circle) {
                circle = document.createElementNS(SVG_NS, "circle");
                circle.setAttribute("r", "4");
                vertices.appendChild(circle);
            }
            circle.setAttribute("cx", screen[index][0].toFixed(1));
            circle.setAttribute("cy", screen[index][1].toFixed(1));
        });
        const result = measurement(kind, drawn);
        const last = screen[screen.length - 1];
        label.textContent = drawn.length >= 2 ? result.text : "";
        if (last) {
            label.setAttribute("x", (last[0] + 10).toFixed(1));
            label.setAttribute("y", (last[1] - 10).toFixed(1));
        }
    };
    const changed = () => {
        draw();
        if (typeof options.onChange === "function") options.onChange(measurement(kind, points));
    };

    const add = position => {
        if (finished) return;
        const last = points[points.length - 1];
        if (last) {
            const a = map.toPoint(last);
            const b = map.toPoint(position);
            if (Math.hypot(a[0] - b[0], a[1] - b[1]) < SAME_POINT) return;
        }
        points.push(position);
        changed();
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

    const detach = () => {
        release();
        release = () => {};
        map.root.removeEventListener("pointermove", move);
        map.root.removeEventListener("pointerleave", leave);
        document.removeEventListener("keydown", keys);
    };
    const respond = result => {
        if (typeof responseFunction === "function") responseFunction(result);
    };
    function finish() {
        if (finished) return;
        if (points.length < (kind === "area" ? 3 : 2)) return; // belum cukup titik untuk diukur
        finished = true;
        cursor = null;
        detach();
        draw();
        respond(measurement(kind, points));
    }
    const undo = () => {
        if (finished || points.length === 0) return;
        points.pop();
        changed();
    };
    const stop = () => {
        const running = !finished;
        finished = true;
        detach();
        stopFollowing();
        svg.remove();
        if (map.root.crootjsMeasure === controller) delete map.root.crootjsMeasure;
        if (running) respond(null);
    };
    function keys(event) {
        // Tombol di dalam kotak teks halaman bukan perintah untuk alat ukur.
        if (event.target.closest && event.target.closest("input, textarea, select, [contenteditable]")) return;
        if (event.key === "Escape") stop();
        else if (event.key === "Enter") finish();
        else if (event.key === "Backspace") undo();
        else return;
        event.preventDefault();
    }
    document.addEventListener("keydown", keys);

    const controller = { finish, undo, stop };
    map.root.crootjsMeasure = controller;
    draw();
    return controller;
}

// Menambahkan tombol ukur jarak dan ukur luas ke peta, beserta kotak hasilnya (dengan tombol
// Selesai, Hapus titik, dan Tutup - wajib untuk layar sentuh yang tidak punya klik ganda).
// options (semua opsional):
//   corner    pojok peta. Default "top-left".
//   onResult  function (result) yang dipanggil setiap kali pengukuran selesai; result sama
//             seperti di measure()
// Mengembalikan function remove().
export function addMeasureControl(id, options = {}) {
    const map = mapOf(id);
    if (!map) return () => {};
    injectStyles();

    const box = document.createElement("div");
    box.className = "crootjs-map-measure";
    const buttons = document.createElement("div");
    buttons.className = "crootjs-map-measure-buttons";
    const panel = document.createElement("div");
    panel.className = "crootjs-map-measure-result";
    panel.hidden = true;
    panel.setAttribute("aria-live", "polite");
    const text = document.createElement("div");
    const actions = document.createElement("div");
    actions.className = "crootjs-map-measure-actions";
    panel.append(text, actions);
    box.append(buttons, panel);

    let current = null;
    let currentType = null;
    const action = (label, runFunction) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.addEventListener("click", runFunction);
        actions.appendChild(button);
        return button;
    };
    const finishButton = action("Selesai", () => current && current.finish());
    const undoButton = action("Hapus titik", () => current && current.undo());
    action("Tutup", () => end());

    const tools = {};
    const setActive = type => {
        Object.keys(tools).forEach(key => {
            tools[key].classList.toggle("crootjs-map-button-active", key === type);
            tools[key].setAttribute("aria-pressed", String(key === type));
        });
    };
    function end() {
        if (current) current.stop();
        current = null;
        currentType = null;
        panel.hidden = true;
        setActive(null);
    }
    const hint = type => (type === "area" ? "Klik titik-titik batas area." : "Klik titik-titik di sepanjang jalur.");
    const start = type => {
        if (currentType === type) {
            end();
            return;
        }
        end();
        currentType = type;
        setActive(type);
        panel.hidden = false;
        finishButton.hidden = false;
        undoButton.hidden = false;
        text.textContent = hint(type);
        current = measure(id, type, result => {
            if (result === null) {
                // Dibatalkan dari luar (Esc atau pengukuran lain dimulai).
                if (currentType === type) {
                    current = null;
                    currentType = null;
                    panel.hidden = true;
                    setActive(null);
                }
                return;
            }
            text.textContent = result.text;
            finishButton.hidden = true;
            undoButton.hidden = true;
            if (typeof options.onResult === "function") options.onResult(result);
        }, {
            onChange: result => {
                text.textContent = result.length > 0 ? result.text : hint(type);
            }
        });
    };
    const tool = (type, label, icon) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "crootjs-map-button";
        button.title = label;
        button.setAttribute("aria-label", label);
        button.setAttribute("aria-pressed", "false");
        button.innerHTML = icon;
        button.addEventListener("click", () => start(type));
        buttons.appendChild(button);
        tools[type] = button;
    };
    tool("distance", "Ukur jarak", RULER_ICON);
    tool("area", "Ukur luas", AREA_ICON);
    const removeControl = map.addControl(box, options.corner || "top-left");

    return function remove() {
        end();
        removeControl();
    };
}

// Menempelkan gambar (PNG, JPG, SVG - misalnya master plan atau hasil scan denah) di peta,
// di atas peta dasar dan di bawah data. Gambar ikut bergeser dan di-zoom bersama peta.
// Letaknya ditentukan salah satu dari:
//   options.corners   [kiri-atas, kanan-atas, kiri-bawah] gambar, masing-masing [lng, lat].
//                     Tiga titik ini cukup untuk rotasi, skala, dan miring sekaligus.
//   options.bounds    [minLng, minLat, maxLng, maxLat], ditambah options.rotation (derajat,
//                     searah jarum jam, berputar di tengah gambar)
// Untuk menggeoreferensikan dari titik kontrol (piksel gambar <-> [lng, lat]), buat
// transformasinya dengan createAffineTransform dari geomeasure.js lalu hitung ketiga sudutnya.
// options lainnya: opacity (0..1, default 1), crossOrigin (true kalau gambarnya dari domain
// lain dan ingin ikut di exportMapImage; servernya harus mengizinkan CORS), alt.
// Mengembalikan { setCorners(corners), setBounds(bounds, rotation), setOpacity(opacity), remove() }.
export function addImageOverlay(id, url, options = {}) {
    const map = mapOf(id);
    const noop = { setCorners: () => {}, setBounds: () => {}, setOpacity: () => {}, remove: () => {} };
    if (!map) return noop;

    let corners = null;
    let bounds = null;
    let rotation = 0;
    const img = document.createElement("img");
    img.className = "crootjs-map-image";
    img.alt = options.alt || "";
    img.draggable = false;
    if (options.crossOrigin) img.crossOrigin = "anonymous";
    img.style.opacity = Number.isFinite(options.opacity) ? options.opacity : 1;
    img.style.visibility = "hidden"; // sampai ukurannya diketahui

    // Titik layar ketiga sudut: kiri-atas, kanan-atas, kiri-bawah.
    const screenCorners = () => {
        if (corners) return corners.map(map.toPoint);
        const topLeft = map.toPoint([bounds[0], bounds[3]]);
        const topRight = map.toPoint([bounds[2], bounds[3]]);
        const bottomLeft = map.toPoint([bounds[0], bounds[1]]);
        if (!rotation) return [topLeft, topRight, bottomLeft];
        // Diputar di layar, mengelilingi titik tengah gambar.
        const center = [(topRight[0] + bottomLeft[0]) / 2, (topRight[1] + bottomLeft[1]) / 2];
        const cos = Math.cos(rotation * Math.PI / 180);
        const sin = Math.sin(rotation * Math.PI / 180);
        return [topLeft, topRight, bottomLeft].map(point => {
            const x = point[0] - center[0];
            const y = point[1] - center[1];
            return [center[0] + x * cos - y * sin, center[1] + x * sin + y * cos];
        });
    };
    // Matriks CSS yang memetakan pojok-pojok gambar (0,0), (lebar,0), (0,tinggi) ke ketiga sudut.
    const place = () => {
        const width = img.naturalWidth;
        const height = img.naturalHeight;
        if (!width || !height || (!corners && !bounds)) return;
        const [p0, p1, p2] = screenCorners();
        img.style.transform = `matrix(${(p1[0] - p0[0]) / width}, ${(p1[1] - p0[1]) / width}, ${(p2[0] - p0[0]) / height}, ${(p2[1] - p0[1]) / height}, ${p0[0]}, ${p0[1]})`;
        img.style.visibility = "";
    };

    const setCorners = next => {
        corners = Array.isArray(next) && next.length >= 3 ? next.slice(0, 3) : null;
        bounds = null;
        place();
    };
    const setBounds = (next, degrees = 0) => {
        bounds = Array.isArray(next) && next.length === 4 ? next : null;
        rotation = Number(degrees) || 0;
        corners = null;
        place();
    };
    if (options.corners) setCorners(options.corners);
    else setBounds(options.bounds, options.rotation);

    img.onload = place;
    img.onerror = () => console.warn(`addImageOverlay: gambar "${url}" gagal dimuat.`);
    img.src = url;
    map.underlay.appendChild(img);
    const stopFollowing = map.onMove(place);

    return {
        setCorners,
        setBounds,
        setOpacity: opacity => {
            img.style.opacity = opacity;
        },
        remove: () => {
            stopFollowing();
            img.remove();
        }
    };
}

// Memuat ulang gambar dengan CORS supaya boleh digambar ke canvas yang akan diekspor.
// Selesai dengan gambarnya, atau null kalau servernya tidak mengizinkan.
function loadImage(src) {
    return new Promise(resolve => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
    });
}

// Elemen SVG -> gambar, dengan gaya hasil hitungan CSS ditulis langsung di elemennya
// (stylesheet halaman tidak ikut ketika SVG dijadikan gambar terpisah).
function svgImage(svg, width, height, color) {
    const clone = svg.cloneNode(true);
    const properties = ["fill", "fill-opacity", "fill-rule", "stroke", "stroke-width", "stroke-opacity", "stroke-dasharray",
        "stroke-linecap", "stroke-linejoin", "opacity", "display", "visibility", "vector-effect", "font", "paint-order"];
    const originals = [svg, ...svg.querySelectorAll("*")];
    [clone, ...clone.querySelectorAll("*")].forEach((element, index) => {
        const computed = getComputedStyle(originals[index]);
        element.setAttribute("style", properties.map(name => `${name}:${computed.getPropertyValue(name)}`).join(";"));
    });
    clone.setAttribute("xmlns", SVG_NS);
    clone.setAttribute("width", width);
    clone.setAttribute("height", height);
    if (!clone.getAttribute("viewBox") && svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width) {
        const box = svg.viewBox.baseVal;
        clone.setAttribute("viewBox", `${box.x} ${box.y} ${box.width} ${box.height}`);
    }
    if (color) clone.style.color = color;
    const source = new XMLSerializer().serializeToString(clone);
    return loadImage("data:image/svg+xml;charset=utf-8," + encodeURIComponent(source));
}

function cssPixels(value, size) {
    if (!value) return 0;
    return value.endsWith("%") ? parseFloat(value) / 100 * size : parseFloat(value) || 0;
}

function transparent(color) {
    return !color || color === "transparent" || /rgba\([^)]*,\s*0\)$/.test(color);
}

// Kotak elemen (latar, garis tepi, sudut membulat) seperti di layar.
function drawBox(context, computed, rect, origin) {
    const x = rect.left - origin.left;
    const y = rect.top - origin.top;
    const radius = Math.min(cssPixels(computed.borderTopLeftRadius, Math.min(rect.width, rect.height)), rect.width / 2, rect.height / 2);
    const shape = inset => {
        context.beginPath();
        context.roundRect(x + inset, y + inset, rect.width - 2 * inset, rect.height - 2 * inset, Math.max(0, radius - inset));
    };
    if (!transparent(computed.backgroundColor)) {
        shape(0);
        context.fillStyle = computed.backgroundColor;
        context.fill();
    }
    const border = parseFloat(computed.borderTopWidth) || 0;
    if (border > 0 && computed.borderTopStyle !== "none" && !transparent(computed.borderTopColor)) {
        shape(border / 2);
        context.lineWidth = border;
        context.strokeStyle = computed.borderTopColor;
        context.stroke();
    }
}

// Kecerahan relatif warna CSS "rgb(...)"/"rgba(...)" (0 gelap .. 1 terang), null kalau bukan rgb.
function luminance(color) {
    const parts = String(color).match(/[\d.]+/g);
    if (!/^rgba?\(/.test(String(color)) || !parts || parts.length < 3) return null;
    const channel = value => {
        const c = Number(value) / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(parts[0]) + 0.7152 * channel(parts[1]) + 0.0722 * channel(parts[2]);
}

// Halo teks dari text-shadow elemennya: warna bayangan pertama, setebal blur-nya.
// text-shadow: none = tanpa halo. Halo yang hampir sewarna dengan teksnya (misalnya teks putih
// dengan bayangan putih) tidak menolong keterbacaan, jadi diganti warna yang kontras.
function textHalo(computed) {
    const shadow = computed.textShadow;
    if (!shadow || shadow === "none") return null;
    let color = (shadow.match(/rgba?\([^)]*\)|#[0-9a-f]{3,8}|[a-z]+/i) || [])[0];
    const lengths = shadow.replace(/rgba?\([^)]*\)/g, "").match(/-?[\d.]+px/g) || [];
    const blur = lengths.length >= 3 ? parseFloat(lengths[2]) : 2;
    const text = luminance(computed.color);
    const halo = luminance(color);
    if (text !== null && halo !== null && (Math.max(text, halo) + 0.05) / (Math.min(text, halo) + 0.05) < 3) {
        color = text > 0.4 ? "rgba(0, 0, 0, 0.85)" : "rgba(255, 255, 255, 0.9)";
    }
    return { color, width: Math.max(2, Math.min(6, blur * 1.5)) };
}

function fillText(context, text, x, y, computed) {
    context.font = `${computed.fontStyle} ${computed.fontWeight} ${computed.fontSize} ${computed.fontFamily}`;
    context.textBaseline = "middle";
    const halo = textHalo(computed);
    if (halo) {
        context.lineJoin = "round";
        context.lineWidth = halo.width;
        context.strokeStyle = halo.color;
        context.strokeText(text, x, y);
    }
    context.fillStyle = computed.color;
    context.fillText(text, x, y);
}

// Isi ::before / ::after, misalnya ikon yang ditambahkan lewat CSS.
function pseudoContent(element, which) {
    const content = getComputedStyle(element, which).content;
    if (!content || content === "none" || content === "normal") return "";
    const match = content.match(/^"(.*)"$/s);
    return match ? match[1] : "";
}

// Menggambar elemen HTML seperti tampilannya di layar: kotaknya, lalu isinya - teks diletakkan
// per kata di posisi yang dihitung browser (jadi padding, perataan, dan baris ganda ikut
// tepat), gambar dan SVG di dalamnya digambar sebagai gambar.
async function drawElement(context, element, origin, state) {
    const computed = getComputedStyle(element);
    if (computed.display === "none" || computed.visibility === "hidden" || Number(computed.opacity) === 0) return;
    const rect = element.getBoundingClientRect();
    const tag = element.tagName.toLowerCase();
    context.save();
    context.globalAlpha *= Number(computed.opacity);

    if (tag === "svg" || tag === "img") {
        const image = tag === "svg"
            ? await svgImage(element, rect.width, rect.height, computed.color)
            : await loadImage(element.src);
        if (image) context.drawImage(image, rect.left - origin.left, rect.top - origin.top, rect.width, rect.height);
        else state.missing++;
        context.restore();
        return;
    }

    drawBox(context, computed, rect, origin);
    const before = pseudoContent(element, "::before");
    const after = pseudoContent(element, "::after");
    let first = null;
    let last = null;
    for (const node of element.childNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
            await drawElement(context, node, origin, state);
        } else if (node.nodeType === Node.TEXT_NODE) {
            const pattern = /\S+/g;
            let match;
            while ((match = pattern.exec(node.data))) {
                const range = document.createRange();
                range.setStart(node, match.index);
                range.setEnd(node, match.index + match[0].length);
                const box = range.getBoundingClientRect();
                if (!box.width) continue;
                first = first || box;
                last = box;
                fillText(context, match[0], box.left - origin.left, box.top - origin.top + box.height / 2, computed);
            }
        }
    }
    // Isi ::before diletakkan tepat sebelum kata pertama, ::after sesudah kata terakhir.
    if (before && first) {
        const pseudo = getComputedStyle(element, "::before");
        context.font = `${pseudo.fontStyle} ${pseudo.fontWeight} ${pseudo.fontSize} ${pseudo.fontFamily}`;
        const width = context.measureText(before).width;
        fillText(context, before, first.left - origin.left - width, first.top - origin.top + first.height / 2, pseudo);
    }
    if (after && last) {
        fillText(context, after, last.right - origin.left, last.top - origin.top + last.height / 2, getComputedStyle(element, "::after"));
    }
    context.restore();
}

// Mengekspor tampilan peta saat ini menjadi gambar PNG, misalnya untuk laporan.
// Yang ikut: peta dasar, gambar overlay, semua lapisan GeoJSON (SVG dan canvas), label fitur,
// marker, gelembung mapcluster.js, penanda lokasi, hasil alat ukur, garis skala, dan teks
// atribusi. Label dan elemen HTML digambar dari CSS-nya: latar, garis tepi, sudut membulat,
// padding, isi ::before/::after, dan text-shadow sebagai halo. Bayangan kotak (box-shadow),
// gradien, dan transform berputar tidak ikut. Popup dan tombol kontrol juga tidak ikut.
// Tile peta dasar dimuat ulang dengan CORS; tile dari server yang tidak mengizinkan CORS
// dilewati (OpenStreetMap dan Esri mengizinkan).
// responseFunction(blob, info) dipanggil sekali: blob PNG (atau null kalau gagal) dan
// info { width, height, missingImages } - missingImages = jumlah gambar yang dilewati.
// options (semua opsional):
//   scale        kelipatan resolusi. Default devicePixelRatio layar (2 di layar retina).
//   attribution  false = tanpa teks atribusi (wajib ada untuk OpenStreetMap - jangan dibuang
//                kalau gambarnya dipublikasikan)
export function exportMapImage(id, responseFunction, options = {}) {
    const map = mapOf(id);
    const respond = (blob, info) => {
        if (typeof responseFunction === "function") responseFunction(blob, info);
    };
    if (!map) {
        respond(null, null);
        return;
    }
    renderImage(map, options).then(
        result => result.canvas.toBlob(blob => respond(blob, result.info), "image/png"),
        error => {
            console.log("error", error);
            respond(null, null);
        }
    );
}

async function renderImage(map, options) {
    const root = map.root;
    const origin = root.getBoundingClientRect();
    const width = root.clientWidth;
    const height = root.clientHeight;
    const scale = Number.isFinite(options.scale) && options.scale > 0 ? options.scale : (window.devicePixelRatio || 1);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext("2d");
    context.scale(scale, scale);
    context.fillStyle = getComputedStyle(root).backgroundColor;
    context.fillRect(0, 0, width, height);
    let missing = 0;

    // Peta dasar: tile lama di bawah, tile level sekarang, lalu tile label (z-index-nya).
    const tiles = [...root.querySelectorAll(".crootjs-map-tiles img.crootjs-map-tile-loaded")]
        .map((img, order) => ({ img, order, z: Number(img.style.zIndex) || 0 }))
        .sort((a, b) => a.z - b.z || a.order - b.order);
    const tileImages = await Promise.all(tiles.map(tile => loadImage(tile.img.src)));
    tiles.forEach((tile, index) => {
        if (!tileImages[index]) {
            missing++;
            return;
        }
        const style = tile.img.style;
        context.drawImage(tileImages[index], parseFloat(style.left), parseFloat(style.top), parseFloat(style.width), parseFloat(style.height));
    });

    // Gambar overlay dan canvas heatmap (mapheat.js), urut seperti di layar, dengan matriks
    // transform yang sama.
    for (const element of root.querySelectorAll(".crootjs-map-underlay > *")) {
        if (element instanceof HTMLCanvasElement) {
            if (element.hidden || !element.width) continue;
            const matrix = new DOMMatrix(getComputedStyle(element).transform);
            context.save();
            context.globalAlpha = Number(getComputedStyle(element).opacity);
            context.transform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
            context.drawImage(element, 0, 0, parseFloat(element.style.width), parseFloat(element.style.height));
            context.restore();
            continue;
        }
        const img = element;
        if (!(img instanceof HTMLImageElement) || img.style.visibility === "hidden" || !img.naturalWidth) continue;
        const loaded = await loadImage(img.src);
        if (!loaded) {
            missing++;
            continue;
        }
        const matrix = new DOMMatrix(getComputedStyle(img).transform);
        context.save();
        context.globalAlpha = Number(getComputedStyle(img).opacity);
        context.transform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
        context.drawImage(loaded, 0, 0, img.naturalWidth, img.naturalHeight);
        context.restore();
    }

    // Data: canvas (selalu di bawah), lalu SVG.
    const layerCanvas = root.querySelector("canvas.crootjs-map-canvas");
    if (layerCanvas) context.drawImage(layerCanvas, 0, 0, width, height);
    const vectors = root.querySelector("svg.crootjs-map-vectors");
    if (vectors) {
        const image = await svgImage(vectors, width, height);
        if (image) context.drawImage(image, 0, 0, width, height);
    }

    // Label fitur yang sedang tampil, lalu isi overlay (hasil alat ukur, marker, gelembung
    // mapcluster.js, penanda lokasi) - semuanya digambar dari CSS hasil hitungan browser.
    const state = { missing: 0 };
    for (const label of root.querySelectorAll(".crootjs-map-label")) {
        await drawElement(context, label, origin, state);
    }
    for (const element of root.querySelectorAll(".crootjs-map-overlay > *")) {
        if (element.matches("svg.crootjs-measure")) {
            const image = await svgImage(element, width, height);
            if (image) context.drawImage(image, 0, 0, width, height);
        } else {
            await drawElement(context, element, origin, state);
        }
    }
    missing += state.missing;

    // Garis skala.
    const bar = root.querySelector(".crootjs-map-scale");
    if (bar) {
        const rect = bar.getBoundingClientRect();
        const x = rect.left - origin.left;
        const y = rect.top - origin.top;
        context.fillStyle = "rgba(255, 255, 255, 0.75)";
        context.fillRect(x, y, rect.width, rect.height);
        context.strokeStyle = "#374151";
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(x + 1, y);
        context.lineTo(x + 1, y + rect.height - 1);
        context.lineTo(x + rect.width - 1, y + rect.height - 1);
        context.lineTo(x + rect.width - 1, y);
        context.stroke();
        context.font = "11px sans-serif";
        context.fillStyle = "#1f2937";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(bar.textContent, x + rect.width / 2, y + rect.height / 2);
        context.textAlign = "start";
    }

    // Atribusi di pojok kanan bawah, seperti di layar.
    const attribution = root.querySelector(".crootjs-map-attribution");
    if (options.attribution !== false && attribution && !attribution.hidden && attribution.textContent) {
        context.font = "11px sans-serif";
        const textWidth = context.measureText(attribution.textContent).width;
        context.fillStyle = "rgba(255, 255, 255, 0.8)";
        context.fillRect(width - textWidth - 12, height - 17, textWidth + 12, 17);
        context.fillStyle = "#1f2937";
        context.textBaseline = "middle";
        context.fillText(attribution.textContent, width - textWidth - 6, height - 8.5);
    }

    return { canvas, info: { width: canvas.width, height: canvas.height, missingImages: missing } };
}

// Mengekspor tampilan peta (seperti exportMapImage) lalu langsung mengunduhnya sebagai file.
// filename default "peta.png". responseFunction (opsional) menerima hasil yang sama dengan
// exportMapImage.
export function downloadMapImage(id, filename = "peta.png", responseFunction, options = {}) {
    exportMapImage(id, (blob, info) => {
        if (blob) {
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(link.href), 1000);
        }
        if (typeof responseFunction === "function") responseFunction(blob, info);
    }, options);
}
