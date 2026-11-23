// Tile vektor Mapbox Vector Tile (MVT) digambar menjadi gambar PNG di browser, supaya bisa
// ditampilkan map.js seperti tile raster biasa. Dipakai mapoffline.js untuk file PMTiles berisi
// tile vektor; bisa juga dipakai langsung untuk sumber MVT lain.
// Gaya bawaannya untuk skema Protomaps Basemap (https://docs.protomaps.com/basemaps/layers),
// versi lama (pmap:kind) maupun baru (kind). Skema lain digambar dengan gaya umum: area abu-abu,
// garis gelap, dan titik bernama sebagai label.
// Keterbatasan: label hanya untuk titik (nama tempat, POI), tidak mengikuti garis jalan; label
// yang terpotong tepi tile tidak digambar.

// ---- Membaca MVT (protobuf)

function reader(bytes) {
    let offset = 0;
    const varint = () => {
        let result = 0;
        let shift = 1;
        for (;;) {
            const byte = bytes[offset++];
            result += (byte & 0x7f) * shift;
            if (byte < 0x80) return result;
            shift *= 128;
        }
    };
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return {
        get done() { return offset >= bytes.length; },
        // Satu field: [nomor, jenis kabel, nilai]. Jenis 2 (panjang tertentu) berupa Uint8Array.
        field() {
            const key = varint();
            const wire = key & 7;
            let value;
            if (wire === 0) value = varint();
            else if (wire === 1) { value = view.getFloat64(offset, true); offset += 8; }
            else if (wire === 2) { const length = varint(); value = bytes.subarray(offset, offset + length); offset += length; }
            else if (wire === 5) { value = view.getFloat32(offset, true); offset += 4; }
            else throw new Error(`jenis protobuf ${wire} tidak dikenal`);
            return [Math.floor(key / 8), wire, value];
        },
        varint
    };
}

const text = bytes => new TextDecoder().decode(bytes);
const zigzag = n => (n % 2 === 1 ? -(n + 1) / 2 : n / 2);

function packed(bytes) {
    const read = reader(bytes);
    const values = [];
    while (!read.done) values.push(read.varint());
    return values;
}

function decodeValue(bytes) {
    const read = reader(bytes);
    let value = null;
    while (!read.done) {
        const [number, , raw] = read.field();
        if (number === 1) value = text(raw);
        else if (number === 2 || number === 3 || number === 4 || number === 5) value = raw;
        else if (number === 6) value = zigzag(raw);
        else if (number === 7) value = Boolean(raw);
    }
    return value;
}

// Perintah geometri MVT -> daftar garis/cincin, masing-masing array [x, y] dalam koordinat tile.
function decodeGeometry(commands) {
    const parts = [];
    let part = null;
    let x = 0;
    let y = 0;
    for (let i = 0; i < commands.length;) {
        const command = commands[i] & 7;
        const count = commands[i] >> 3;
        i++;
        if (command === 7) {
            if (part && part.length) part.push(part[0]);
            continue;
        }
        for (let k = 0; k < count; k++) {
            x += zigzag(commands[i++]);
            y += zigzag(commands[i++]);
            if (command === 1) {
                part = [];
                parts.push(part);
            }
            part.push([x, y]);
        }
    }
    return parts;
}

// Uint8Array berisi satu tile MVT (sudah tidak terkompresi) ->
// { namaLayer: { extent, features: [{ type: 1|2|3, properties, geometry }] } }.
// type 1 = titik, 2 = garis, 3 = poligon; geometry dari decodeGeometry.
export function decodeMVT(bytes) {
    const layers = {};
    const tile = reader(bytes);
    while (!tile.done) {
        const [number, , layerBytes] = tile.field();
        if (number !== 3) continue;
        const read = reader(layerBytes);
        const keys = [];
        const values = [];
        const raw = [];
        let name = "";
        let extent = 4096;
        while (!read.done) {
            const [field, , value] = read.field();
            if (field === 1) name = text(value);
            else if (field === 2) raw.push(value);
            else if (field === 3) keys.push(text(value));
            else if (field === 4) values.push(decodeValue(value));
            else if (field === 5) extent = value;
        }
        const features = raw.map(featureBytes => {
            const feature = reader(featureBytes);
            const result = { type: 0, properties: {}, geometry: [] };
            while (!feature.done) {
                const [field, , value] = feature.field();
                if (field === 2) {
                    const tags = packed(value);
                    for (let i = 0; i + 1 < tags.length; i += 2) result.properties[keys[tags[i]]] = values[tags[i + 1]];
                } else if (field === 3) {
                    result.type = value;
                } else if (field === 4) {
                    result.geometry = decodeGeometry(packed(value));
                }
            }
            return result;
        });
        layers[name] = { extent, features };
    }
    return layers;
}

// ---- Gaya

const kindOf = properties => properties.kind !== undefined ? properties.kind : properties["pmap:kind"];
const minZoomOf = properties => {
    const value = properties.min_zoom !== undefined ? properties.min_zoom : properties["pmap:min_zoom"];
    return typeof value === "number" ? value : 0;
};
const is = (...kinds) => properties => kinds.includes(kindOf(properties));
const roadWidth = (base, grow) => zoom => Math.max(0.5, base * Math.pow(grow, Math.max(0, zoom - 12)));

// Aturan digambar berurutan (yang belakangan di atas). Setiap aturan:
//   layer    nama layer MVT; type "fill" (poligon), "line", atau "label" (titik bernama)
//   filter   function (properties, zoom) => boolean (opsional)
//   minZoom, maxZoom (opsional)
//   color, width (piksel pada tile 256 px; boleh function (zoom)), casing dan dash (line),
//   outline (fill), size, bold, dan halo (label; teksnya dari nama fitur)
// Warna mengikuti peta OpenStreetMap supaya terasa akrab.
export const DEFAULT_VECTOR_STYLE = [
    { layer: "earth", type: "fill", color: "#f2efe9" },
    { layer: "landcover", type: "fill", filter: is("forest"), color: "#c9dfb5" },
    { layer: "landcover", type: "fill", filter: is("grassland", "scrub"), color: "#dcebc5" },
    { layer: "landcover", type: "fill", filter: is("farmland"), color: "#eef0d5" },
    { layer: "landcover", type: "fill", filter: is("urban_area"), color: "#e6e1db" },
    { layer: "landcover", type: "fill", filter: is("glacier"), color: "#ddecec" },
    { layer: "landcover", type: "fill", filter: is("barren"), color: "#ece6dc" },
    { layer: "landuse", type: "fill", filter: is("residential"), color: "#e8e2da" },
    { layer: "landuse", type: "fill", filter: is("industrial", "railway", "military"), color: "#ebdbe8" },
    { layer: "landuse", type: "fill", filter: is("commercial", "retail", "marketplace"), color: "#f2dad9" },
    { layer: "landuse", type: "fill", filter: is("farmland", "allotments", "greenfield"), color: "#eef0d5" },
    { layer: "landuse", type: "fill", filter: is("park", "grass", "garden", "playground", "dog_park", "recreation_ground", "golf_course", "nature_reserve", "national_park", "protected_area"), color: "#cdebb0" },
    { layer: "landuse", type: "fill", filter: is("forest", "wood"), color: "#add19e" },
    { layer: "landuse", type: "fill", filter: is("school", "university", "college", "kindergarten"), color: "#f0f0d8" },
    { layer: "landuse", type: "fill", filter: is("hospital"), color: "#f8dede" },
    { layer: "landuse", type: "fill", filter: is("cemetery"), color: "#aacbaf" },
    { layer: "landuse", type: "fill", filter: is("pitch"), color: "#aae0cb" },
    { layer: "landuse", type: "fill", filter: is("pedestrian"), color: "#ededed" },
    { layer: "landuse", type: "fill", filter: is("aerodrome"), color: "#e9e7e2" },
    { layer: "natural", type: "fill", filter: is("wood", "forest"), color: "#add19e" },
    { layer: "natural", type: "fill", filter: is("grass", "grassland", "meadow", "scrub", "fell"), color: "#cdebb0" },
    { layer: "natural", type: "fill", filter: is("sand", "beach", "bare_rock"), color: "#f5e9c6" },
    { layer: "natural", type: "fill", filter: is("wetland"), color: "#d6e8e0" },
    { layer: "natural", type: "fill", filter: is("glacier"), color: "#ddecec" },
    { layer: "water", type: "fill", color: "#aad3df" },
    { layer: "physical_line", type: "line", filter: is("river", "canal"), color: "#aad3df", width: z => Math.max(1, (z - 9) * 0.8) },
    { layer: "physical_line", type: "line", filter: is("stream", "drain", "ditch"), minZoom: 13, color: "#aad3df", width: 1 },
    { layer: "buildings", type: "fill", minZoom: 13, color: "#d9d0c9", outline: "#c4b6ab" },
    { layer: "boundaries", type: "line", filter: is("country"), color: "#9e9cab", width: 1.2, dash: [6, 3] },
    { layer: "boundaries", type: "line", filter: is("region"), color: "#b5b3c1", width: 0.8, dash: [4, 3] },
    { layer: "transit", type: "line", filter: is("rail"), minZoom: 10, color: "#999999", width: 1, dash: [4, 3] },
    { layer: "roads", type: "line", filter: is("path"), minZoom: 14, color: "#fa8072", width: 0.8, dash: [2, 2] },
    { layer: "roads", type: "line", filter: is("other"), minZoom: 14, color: "#ffffff", width: roadWidth(1, 1.3) },
    { layer: "roads", type: "line", filter: is("minor_road"), minZoom: 12, color: "#ffffff", width: roadWidth(1, 1.4), casing: "#cfc8bf" },
    { layer: "roads", type: "line", filter: is("medium_road"), color: "#f7fabf", width: roadWidth(1.6, 1.35), casing: "#c6c48a" },
    { layer: "roads", type: "line", filter: is("major_road"), color: "#fcd6a4", width: roadWidth(2, 1.35), casing: "#c99e6b" },
    { layer: "roads", type: "line", filter: is("highway"), color: "#e892a2", width: roadWidth(2.4, 1.35), casing: "#c66b7c" },
    { layer: "pois", type: "label", minZoom: 15, filter: (properties, zoom) => minZoomOf(properties) <= zoom, color: "#55513f", size: 10 },
    { layer: "places", type: "label", filter: (properties, zoom) => is("neighbourhood")(properties) && minZoomOf(properties) <= zoom, color: "#555555", size: 11 },
    { layer: "places", type: "label", filter: (properties, zoom) => is("locality")(properties) && minZoomOf(properties) <= zoom, color: "#222222", size: z => (z < 10 ? 11 : 13), bold: true },
    { layer: "places", type: "label", filter: is("region"), maxZoom: 8, color: "#7a6f86", size: 11 },
    { layer: "places", type: "label", filter: is("country"), maxZoom: 7, color: "#4b4458", size: 12, bold: true }
];

// Gaya untuk skema yang tidak dikenal: semua layer, apa adanya.
const GENERIC_STYLE = [
    { type: "fill", color: "#e4e1dc", outline: "#d2cec7" },
    { type: "line", color: "#8a8a8a", width: 1 },
    { type: "label", color: "#333333", size: 11 }
];

// ---- Menggambar

const valueAt = (value, zoom) => (typeof value === "function" ? value(zoom) : value);

function nameOf(properties, language) {
    if (language && typeof properties["name:" + language] === "string") return properties["name:" + language];
    return typeof properties.name === "string" ? properties.name : null;
}

function makeCanvas(size) {
    if (typeof OffscreenCanvas === "function") return new OffscreenCanvas(size, size);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    return canvas;
}

function toBlob(canvas) {
    if (canvas.convertToBlob) return canvas.convertToBlob({ type: "image/png" });
    return new Promise(resolve => canvas.toBlob(resolve, "image/png"));
}

// Menggambar tile MVT (hasil decodeMVT) menjadi Blob PNG.
// zoom: zoom tile yang ditampilkan (untuk gaya). area (opsional) = { scale, dx, dy } untuk
// menggambar sebagian tile yang lebih rendah saat zoom melebihi isi file (overzoom): bagian
// [dx, dy] dari kisi scale x scale, jadi garisnya tetap tajam.
// options: style (array aturan, bawaan DEFAULT_VECTOR_STYLE), size (piksel, bawaan 512),
// language (misalnya "id": pakai name:id kalau ada), background.
export async function renderVectorTile(layers, zoom, area = null, options = {}) {
    const size = options.size || 512;
    const canvas = makeCanvas(size);
    const context = canvas.getContext("2d");
    const ratio = size / 256; // ketebalan dan ukuran di gaya dihitung untuk tile 256 px
    const scale = area ? area.scale : 1;
    const dx = area ? area.dx : 0;
    const dy = area ? area.dy : 0;
    if (options.background) {
        context.fillStyle = options.background;
        context.fillRect(0, 0, size, size);
    }
    const known = Object.keys(layers).some(name => DEFAULT_VECTOR_STYLE.some(rule => rule.layer === name));
    const style = options.style || (known ? DEFAULT_VECTOR_STYLE : GENERIC_STYLE);
    const placed = []; // kotak label yang sudah digambar, supaya tidak bertumpuk

    for (const rule of style) {
        if (rule.minZoom !== undefined && zoom < rule.minZoom) continue;
        if (rule.maxZoom !== undefined && zoom > rule.maxZoom) continue;
        const names = rule.layer ? [rule.layer] : Object.keys(layers);
        for (const name of names) {
            const layer = layers[name];
            if (!layer) continue;
            const factor = size * scale / layer.extent;
            const project = ([x, y]) => [x * factor - dx * size, y * factor - dy * size];
            const wanted = rule.type === "fill" ? 3 : rule.type === "line" ? 2 : 1;
            const features = layer.features.filter(feature => feature.type === wanted
                && (!rule.filter || rule.filter(feature.properties, zoom)));
            if (!features.length) continue;
            if (rule.type === "label") {
                drawLabels(context, features, project, rule, zoom, ratio, size, placed, options.language);
                continue;
            }
            context.beginPath();
            for (const feature of features) {
                for (const part of feature.geometry) {
                    part.forEach((point, index) => {
                        const [x, y] = project(point);
                        if (index) context.lineTo(x, y);
                        else context.moveTo(x, y);
                    });
                }
            }
            if (rule.type === "fill") {
                context.fillStyle = rule.color;
                context.fill("evenodd");
                if (rule.outline) {
                    context.strokeStyle = rule.outline;
                    context.lineWidth = 0.5 * ratio;
                    context.stroke();
                }
            } else if (rule.type === "line") {
                const width = valueAt(rule.width || 1, zoom) * ratio;
                context.lineCap = "round";
                context.lineJoin = "round";
                context.setLineDash((rule.dash || []).map(value => value * ratio));
                if (rule.casing) {
                    context.strokeStyle = rule.casing;
                    context.lineWidth = width + 1.5 * ratio;
                    context.stroke();
                }
                context.strokeStyle = rule.color;
                context.lineWidth = width;
                context.stroke();
                context.setLineDash([]);
            }
        }
    }
    return toBlob(canvas);
}

function drawLabels(context, features, project, rule, zoom, ratio, size, placed, language) {
    const fontSize = valueAt(rule.size || 11, zoom) * ratio;
    context.font = `${rule.bold ? "600 " : ""}${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.lineJoin = "round";
    for (const feature of features) {
        const label = nameOf(feature.properties, language);
        const point = feature.geometry[0] && feature.geometry[0][0];
        if (!label || !point) continue;
        const [x, y] = project(point);
        const width = context.measureText(label).width;
        const box = [x - width / 2 - 2, y - fontSize / 2 - 2, x + width / 2 + 2, y + fontSize / 2 + 2];
        // Label yang melewati tepi tile akan terpotong di tile tetangga: lebih baik tidak digambar.
        if (box[0] < 0 || box[1] < 0 || box[2] > size || box[3] > size) continue;
        if (placed.some(other => box[0] < other[2] && box[2] > other[0] && box[1] < other[3] && box[3] > other[1])) continue;
        placed.push(box);
        context.strokeStyle = rule.halo || "rgba(255, 255, 255, 0.9)";
        context.lineWidth = 3 * ratio;
        context.strokeText(label, x, y);
        context.fillStyle = rule.color;
        context.fillText(label, x, y);
    }
}
