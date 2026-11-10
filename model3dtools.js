// Modul tambahan untuk model3d.js: label HTML yang menempel di titik 3D (hotspot), gizmo
// untuk menggeser/memutar/menskala sebuah bagian dengan mouse atau jari, dan ekspor model
// yang sudah diubah ke file .glb baru.
// Sengaja tidak mengimpor model3d.js - penampilnya dijangkau lewat antarmuka yang dititipkan
// createViewer() di elemennya (element.crootjs3d), supaya model3d.js tidak termuat dua kali.

const SVG_NS = "http://www.w3.org/2000/svg";
const GIZMO_SIZE = 90;       // piksel panjang sumbu gizmo di layar
const AXIS_NAMES = ["x", "y", "z"];
const ROTATE_SNAP = 15;      // derajat, saat Shift ditahan
const OCCLUSION_DELAY = 120; // ms setelah kamera diam sebelum hotspot di belakang model diredupkan

const gizmos = new WeakMap(); // antarmuka penampil -> gizmo yang sedang aktif (satu per penampil)

function injectStyles() {
    if (document.getElementById("crootjs-model3dtools-style")) return;
    const style = document.createElement("style");
    style.id = "crootjs-model3dtools-style";
    style.textContent = `
.crootjs-3d-hotspot {
    position: absolute;
    left: 0;
    top: 0;
    max-width: 220px;
    padding: 4px 8px;
    border-radius: 6px;
    background-color: rgba(255, 255, 255, 0.95);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
    color: #1f2937;
    font: 12px/1.35 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    white-space: nowrap;
    pointer-events: auto;
    transition: opacity 0.15s;
}
.crootjs-3d-hotspot::after {
    content: "";
    position: absolute;
    left: 50%;
    bottom: -8px;
    width: 8px;
    height: 8px;
    margin-left: -4px;
    border-radius: 50%;
    background-color: #2563eb;
    box-shadow: 0 0 0 2px #fff;
}
.crootjs-3d-hotspot-hidden { opacity: 0.25; }
.crootjs-3d-hotspot-clickable { cursor: pointer; }
svg.crootjs-3d-gizmo { position: absolute; left: 0; top: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
.crootjs-3d-gizmo .crootjs-3d-gizmo-hit { stroke: transparent; stroke-width: 16px; fill: none; pointer-events: stroke; cursor: pointer; }
.crootjs-3d-gizmo .crootjs-3d-gizmo-line { stroke: currentColor; stroke-width: 2.5px; fill: none; stroke-linecap: round; }
.crootjs-3d-gizmo .crootjs-3d-gizmo-knob { fill: currentColor; stroke: #fff; stroke-width: 1.5px; pointer-events: all; cursor: pointer; }
.crootjs-3d-gizmo .crootjs-3d-gizmo-x { color: #ef4444; }
.crootjs-3d-gizmo .crootjs-3d-gizmo-y { color: #22c55e; }
.crootjs-3d-gizmo .crootjs-3d-gizmo-z { color: #3b82f6; }
.crootjs-3d-gizmo .crootjs-3d-gizmo-all { color: #f59e0b; }
.crootjs-3d-gizmo-active .crootjs-3d-gizmo-line { stroke-width: 4px; }
@media (pointer: coarse) {
    .crootjs-3d-gizmo .crootjs-3d-gizmo-hit { stroke-width: 28px; }
}
`;
    // Di awal <head> (sesudah style CrootJS lain): CSS halaman yang ditautkan sesudahnya
    // menang tanpa !important.
    const previous = [...document.head.querySelectorAll('style[id^="crootjs-"]')].pop();
    if (previous) previous.after(style);
    else document.head.prepend(style);
}

function viewerOf(id) {
    const container = document.getElementById(id);
    const viewer = container ? container.crootjs3d : null;
    if (!viewer) console.warn(`Penampil 3D dengan ID "${id}" belum dibuat. Panggil createViewer("${id}") dari model3d.js lebih dulu.`);
    return viewer;
}

function svg(name, className) {
    const element = document.createElementNS(SVG_NS, name);
    if (className) element.setAttribute("class", className);
    return element;
}

// Klik dan geser di dalam elemen ini tidak ikut memutar kamera.
function isolate(element) {
    ["pointerdown", "dblclick", "wheel"].forEach(type => element.addEventListener(type, event => event.stopPropagation()));
}

// ---- Quaternion [x, y, z, w]

function multiplyQuaternion(a, b) {
    return [
        a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
        a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
        a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
        a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]
    ];
}

function axisQuaternion(axis, radians) {
    const s = Math.sin(radians / 2);
    const q = [0, 0, 0, Math.cos(radians / 2)];
    q[axis] = s;
    return q;
}

const column = (m, i) => [m[i * 4], m[i * 4 + 1], m[i * 4 + 2]];
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

// ---- Hotspot

// Menempelkan elemen HTML (atau teks) ke sebuah titik pada model; posisinya ikut saat model
// diputar, di-zoom, atau bagiannya digeser.
// anchor: nama bagian (menempel di tengah bagian itu dan ikut kalau bagiannya dipindah),
//         atau [x, y, z] koordinat model.
// content: elemen DOM (dipindah ke atas penampil) atau teks.
// options (semua opsional):
//   at       "center" (bawaan) atau "top": titik tengah, atau tengah sisi atas bagian itu.
//   offset   [x, y, z] tambahan dalam satuan model, misalnya [0, 0.5, 0].
//   occlude  false = tetap jelas walau titiknya tertutup model. Bawaan: diredupkan
//            (kelas crootjs-3d-hotspot-hidden).
//   onClick  function () saat hotspot diklik.
//   className kelas CSS tambahan.
// Mengembalikan function remove().
export function addHotspot(id, anchor, content, options = {}) {
    const viewer = viewerOf(id);
    if (!viewer) return () => {};
    injectStyles();

    const element = document.createElement("div");
    element.className = "crootjs-3d-hotspot" + (options.className ? " " + options.className : "");
    if (content instanceof Node) element.appendChild(content);
    else element.textContent = content === null || content === undefined ? "" : String(content);
    if (typeof options.onClick === "function") {
        element.classList.add("crootjs-3d-hotspot-clickable");
        element.addEventListener("click", () => options.onClick());
    }
    isolate(element);
    viewer.overlay.appendChild(element);

    const { add, subtract, scale } = viewer.math;
    const offset = Array.isArray(options.offset) ? options.offset : [0, 0, 0];
    let parts = [];
    let occlusionTimer = 0;
    let world = null;

    const resolve = () => {
        parts = typeof anchor === "string" ? viewer.findParts(anchor) : [];
    };
    // Titik dunia hotspot sekarang, atau null kalau bagiannya tidak ada/tersembunyi.
    const locate = () => {
        if (Array.isArray(anchor)) return viewer.getModel() ? add(anchor, offset) : null;
        const shown = parts.filter(viewer.isShown);
        const bounds = shown.length ? viewer.boundsOf(shown) : null;
        if (!bounds) return null;
        const point = options.at === "top" ? [bounds.center[0], bounds.max[1], bounds.center[2]] : bounds.center;
        return add(point, offset);
    };
    // Tertutup = ada permukaan lain di antara kamera dan titiknya. Bagian pemilik hotspot
    // sendiri dilewati, karena titik tengahnya memang di dalam bagian itu.
    const own = new Set();
    const checkOcclusion = () => {
        if (!world || options.occlude === false) return;
        own.clear();
        const collect = node => {
            own.add(node);
            node.children.forEach(collect);
        };
        parts.forEach(collect);
        const eye = viewer.camera().eye;
        const hit = viewer.raycast(eye, subtract(world, eye), node => own.has(node));
        element.classList.toggle("crootjs-3d-hotspot-hidden", Boolean(hit && hit.t < 0.99));
    };
    const place = () => {
        world = locate();
        const point = world ? viewer.toScreen(world) : null;
        if (!point) {
            element.hidden = true;
            return;
        }
        element.hidden = false;
        element.style.transform = `translate(${point[0]}px, ${point[1]}px) translate(-50%, calc(-100% - 10px))`;
        clearTimeout(occlusionTimer);
        occlusionTimer = setTimeout(checkOcclusion, OCCLUSION_DELAY);
    };

    resolve();
    const stopModel = viewer.onModel(() => {
        resolve();
        viewer.requestRender();
    });
    const stopRender = viewer.onRender(place);
    viewer.requestRender();

    return function remove() {
        clearTimeout(occlusionTimer);
        stopModel();
        stopRender();
        element.remove();
    };
}

// ---- Gizmo

// Menampilkan gizmo di sebuah bagian supaya bisa digeser, diputar, atau diskala langsung di
// layar. Hanya satu gizmo per penampil: memanggil lagi memindahkan gizmo ke bagian lain.
// mode: "translate" (panah sumbu), "rotate" (cincin; tahan Shift = kelipatan 15 derajat),
//       atau "scale" (sumbu, plus titik tengah untuk skala seragam).
// onChange(info) dipanggil selama digeser dan sekali lagi saat dilepas:
//   info = { part, position, rotation, quaternion, scale, dragging } - sama dengan
//   getPartTransform, dragging = false pada panggilan terakhir.
// Sumbu geser dan putar mengikuti sumbu induk bagiannya (sama dengan nilai position dan
// rotation-nya); sumbu skala mengikuti bagian itu sendiri.
// Mengembalikan { setMode(mode), remove() }.
export function enableTransform(id, name, mode = "translate", onChange) {
    const viewer = viewerOf(id);
    const none = { setMode() {}, remove() {} };
    if (!viewer) return none;
    injectStyles();
    const previous = gizmos.get(viewer);
    if (previous) previous.remove();

    const node = viewer.findParts(name)[0];
    if (!node) {
        console.warn(`Bagian "${name}" tidak ada di model${viewer.getModel() ? "" : " (model belum dimuat)"}.`);
        return none;
    }
    const { add, subtract, scale, dot, cross, normalize, length } = viewer.math;
    const root = svg("svg", "crootjs-3d-gizmo");
    root.setAttribute("aria-hidden", "true");
    viewer.overlay.appendChild(root);
    let current = ["translate", "rotate", "scale"].includes(mode) ? mode : "translate";
    let handles = [];   // { axis, line, hit, knob }
    let geometry = null; // posisi layar terakhir untuk menghitung geseran
    let drag = null;

    const report = dragging => {
        if (typeof onChange === "function") onChange(Object.assign({ part: node.name, dragging }, viewer.getTransform(node)));
    };

    const build = () => {
        root.textContent = "";
        handles = [];
        const axes = current === "scale" ? [0, 1, 2, 3] : [0, 1, 2];
        axes.forEach(axis => {
            const colorClass = axis === 3 ? "crootjs-3d-gizmo-all" : "crootjs-3d-gizmo-" + AXIS_NAMES[axis];
            const group = svg("g");
            const line = svg("path", "crootjs-3d-gizmo-line " + colorClass);
            const hit = svg("path", "crootjs-3d-gizmo-hit " + colorClass);
            let knob = null;
            if (current === "translate") knob = svg("circle", "crootjs-3d-gizmo-knob " + colorClass);
            if (current === "scale") knob = svg("rect", "crootjs-3d-gizmo-knob " + colorClass);
            group.append(line, hit);
            if (knob) group.appendChild(knob);
            root.appendChild(group);
            const handle = { axis, group, line, hit, knob };
            [hit, knob].filter(Boolean).forEach(element => {
                element.addEventListener("pointerdown", event => startDrag(event, handle));
            });
            handles.push(handle);
        });
        viewer.requestRender();
    };

    // Sumbu dunia ke-i: kolom matriks induk (geser/putar) atau bagian itu sendiri (skala).
    const axisOf = (axis, own) => {
        const matrix = own ? node.world : node.parent ? node.parent.world : IDENTITY;
        const vector = column(matrix, axis);
        return { direction: normalize(vector), length: length(vector) || 1 };
    };

    const draw = () => {
        if (!viewer.isShown(node) || !viewer.getModel()) {
            root.hidden = true;
            return;
        }
        const camera = viewer.camera();
        const origin = [node.world[12], node.world[13], node.world[14]];
        const center = viewer.toScreen(origin);
        if (!center) {
            root.hidden = true;
            return;
        }
        root.hidden = false;
        // Panjang sumbu di dunia supaya di layar tetap sekitar GIZMO_SIZE piksel.
        const depth = Math.max(dot(subtract(origin, camera.eye), camera.forward), 1e-6);
        const size = GIZMO_SIZE * 2 * depth * Math.tan(camera.fov / 2) / camera.height;
        geometry = { origin, center, size, ends: [], eye: camera.eye };
        handles.forEach(handle => {
            if (handle.axis === 3) {
                handle.knob.setAttribute("x", center[0] - 7);
                handle.knob.setAttribute("y", center[1] - 7);
                handle.knob.setAttribute("width", 14);
                handle.knob.setAttribute("height", 14);
                handle.line.setAttribute("d", "");
                handle.hit.setAttribute("d", "");
                return;
            }
            const { direction } = axisOf(handle.axis, current === "scale");
            let d;
            if (current === "rotate") {
                const u = normalize(cross(direction, Math.abs(direction[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
                const v = cross(direction, u);
                const points = [];
                for (let k = 0; k <= 64; k++) {
                    const angle = k / 64 * Math.PI * 2;
                    const p = viewer.toScreen(add(origin, add(scale(u, Math.cos(angle) * size), scale(v, Math.sin(angle) * size))));
                    if (p) points.push(p[0].toFixed(1) + " " + p[1].toFixed(1));
                }
                d = points.length ? "M" + points.join("L") : "";
            } else {
                const end = viewer.toScreen(add(origin, scale(direction, size)));
                geometry.ends[handle.axis] = end;
                // Sumbu yang mengarah ke kamera terlalu pendek untuk dipegang: disembunyikan.
                const hidden = !end || Math.hypot(end[0] - center[0], end[1] - center[1]) < 12;
                handle.group.style.display = hidden ? "none" : "";
                if (hidden) return;
                d = `M${center[0]} ${center[1]}L${end[0]} ${end[1]}`;
                if (current === "translate") {
                    handle.knob.setAttribute("cx", end[0]);
                    handle.knob.setAttribute("cy", end[1]);
                    handle.knob.setAttribute("r", 6);
                } else {
                    handle.knob.setAttribute("x", end[0] - 5);
                    handle.knob.setAttribute("y", end[1] - 5);
                    handle.knob.setAttribute("width", 10);
                    handle.knob.setAttribute("height", 10);
                }
            }
            handle.line.setAttribute("d", d);
            handle.hit.setAttribute("d", d);
        });
    };

    const pointOf = event => {
        const rect = viewer.canvas.getBoundingClientRect();
        return [event.clientX - rect.left, event.clientY - rect.top];
    };

    function startDrag(event, handle) {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        event.stopPropagation();
        event.preventDefault();
        if (!geometry) return;
        const transform = viewer.getTransform(node);
        const start = pointOf(event);
        drag = { handle, start, transform, geometry: Object.assign({}, geometry, { ends: geometry.ends.slice() }) };
        if (handle.axis !== 3) {
            const axis = axisOf(handle.axis, current === "scale");
            drag.axis = axis;
            if (current === "rotate") {
                drag.angle = Math.atan2(start[1] - geometry.center[1], start[0] - geometry.center[0]);
                // Putaran positif tampak berlawanan arah jarum jam kalau sumbunya mengarah ke kamera.
                drag.sign = dot(axis.direction, subtract(geometry.eye, geometry.origin)) > 0 ? -1 : 1;
            }
        }
        handle.group.classList.add("crootjs-3d-gizmo-active");
        const target = event.currentTarget;
        try {
            target.setPointerCapture(event.pointerId);
        } catch (captureError) {
            // pointer sudah tidak aktif
        }
        const move = moveEvent => dragTo(pointOf(moveEvent), moveEvent.shiftKey);
        const end = () => {
            target.removeEventListener("pointermove", move);
            target.removeEventListener("pointerup", end);
            target.removeEventListener("pointercancel", end);
            handle.group.classList.remove("crootjs-3d-gizmo-active");
            drag = null;
            report(false);
        };
        target.addEventListener("pointermove", move);
        target.addEventListener("pointerup", end);
        target.addEventListener("pointercancel", end);
    }

    function dragTo(point, snap) {
        if (!drag) return;
        const { handle, start, transform, geometry: g } = drag;
        const dx = point[0] - start[0];
        const dy = point[1] - start[1];
        if (current === "translate") {
            // Geseran mouse diproyeksikan ke arah sumbu di layar, lalu diubah ke satuan model.
            const end = g.ends[handle.axis];
            const sx = end[0] - g.center[0];
            const sy = end[1] - g.center[1];
            const amount = (dx * sx + dy * sy) / (sx * sx + sy * sy) * g.size / drag.axis.length;
            const position = transform.position.slice();
            position[handle.axis] += amount;
            viewer.setTransform(node, { position });
        } else if (current === "rotate") {
            let delta = Math.atan2(point[1] - g.center[1], point[0] - g.center[0]) - drag.angle;
            delta = Math.atan2(Math.sin(delta), Math.cos(delta));
            let angle = delta * drag.sign;
            if (snap) angle = Math.round(angle * 180 / Math.PI / ROTATE_SNAP) * ROTATE_SNAP * Math.PI / 180;
            // Putaran di sumbu induk: dikalikan dari kiri.
            const rotation = multiplyQuaternion(axisQuaternion(handle.axis, angle), transform.quaternion);
            viewer.setTransform(node, { rotation });
        } else {
            const values = transform.scale.slice();
            if (handle.axis === 3) {
                const factor = Math.exp((dx - dy) / 150);
                viewer.setTransform(node, { scale: values.map(value => value * factor) });
            } else {
                const end = g.ends[handle.axis];
                const sx = end[0] - g.center[0];
                const sy = end[1] - g.center[1];
                const factor = Math.max(0.01, 1 + (dx * sx + dy * sy) / (sx * sx + sy * sy));
                values[handle.axis] *= factor;
                viewer.setTransform(node, { scale: values });
            }
        }
        report(true);
    }

    isolate(root);
    build();
    const stopRender = viewer.onRender(draw);
    const stopModel = viewer.onModel(() => gizmo.remove()); // model diganti: bagiannya sudah tidak ada

    const gizmo = {
        setMode(value) {
            if (!["translate", "rotate", "scale"].includes(value) || value === current) return;
            current = value;
            build();
        },
        remove() {
            stopRender();
            stopModel();
            root.remove();
            if (gizmos.get(viewer) === gizmo) gizmos.delete(viewer);
        }
    };
    gizmos.set(viewer, gizmo);
    return gizmo;
}

// ---- Ekspor GLB

function pad4(value) {
    return (4 - value % 4) % 4;
}

// Warna efektif sebuah node: warnanya sendiri, atau warna induk terdekat yang diganti.
function colorOf(node) {
    for (let current = node; current; current = current.parent) {
        if (current.color) return current.color;
    }
    return null;
}

// Menyusun ulang model yang tampil - dengan posisi, rotasi, skala, warna, dan bagian yang
// disembunyikan - menjadi satu file .glb (tekstur dan buffer eksternal ikut dibungkus).
function buildGLB(model) {
    const { buffers, images } = model.source;
    const json = JSON.parse(JSON.stringify(model.source.json));

    // Semua buffer digabung jadi satu chunk BIN.
    const pieces = [];
    let total = 0;
    const append = bytes => {
        const padding = pad4(total);
        if (padding) pieces.push(new Uint8Array(padding));
        total += padding;
        const offset = total;
        pieces.push(bytes);
        total += bytes.byteLength;
        return offset;
    };
    const offsets = buffers.map(buffer => append(new Uint8Array(buffer)));
    json.bufferViews = (json.bufferViews || []).map(view => Object.assign({}, view, { buffer: 0, byteOffset: (view.byteOffset || 0) + offsets[view.buffer] }));
    (json.images || []).forEach((image, index) => {
        if (image.uri === undefined || !images[index]) return;
        const bytes = images[index].bytes;
        json.bufferViews.push({ buffer: 0, byteOffset: append(bytes), byteLength: bytes.byteLength });
        image.bufferView = json.bufferViews.length - 1;
        image.mimeType = images[index].mimeType;
        delete image.uri;
    });
    if (!json.bufferViews.length) delete json.bufferViews;
    total += pad4(total);
    if (total) json.buffers = [{ byteLength: total }];
    else delete json.buffers;

    // Posisi, rotasi, dan skala yang sekarang.
    model.nodes.forEach(node => {
        const definition = json.nodes[node.index];
        delete definition.matrix;
        definition.translation = node.translation.slice();
        definition.rotation = node.rotation.slice();
        definition.scale = node.scale.slice();
    });

    // Bagian yang disembunyikan dikeluarkan dari scene.
    const hidden = new Set(model.nodes.filter(node => !node.visible).map(node => node.index));
    if (hidden.size) {
        (json.nodes || []).forEach(definition => {
            if (!definition.children) return;
            definition.children = definition.children.filter(index => !hidden.has(index));
            if (!definition.children.length) delete definition.children;
        });
        (json.scenes || []).forEach(scene => {
            scene.nodes = (scene.nodes || []).filter(index => !hidden.has(index));
        });
    }

    // Warna yang diganti: mesh-nya disalin dengan material baru, supaya node lain yang
    // memakai mesh atau material yang sama tidak ikut berubah.
    const materialCache = new Map();
    model.nodes.forEach(node => {
        const color = colorOf(node);
        const definition = json.nodes[node.index];
        if (!color || definition.mesh === undefined) return;
        const mesh = JSON.parse(JSON.stringify(json.meshes[definition.mesh]));
        mesh.primitives.forEach(primitive => {
            const key = primitive.material + "|" + color.join(",");
            if (!materialCache.has(key)) {
                const base = primitive.material === undefined
                    ? { name: "material", pbrMetallicRoughness: { metallicFactor: 0, roughnessFactor: 0.8 } }
                    : JSON.parse(JSON.stringify(json.materials[primitive.material]));
                base.name = (base.name || "material") + "_" + node.name;
                base.pbrMetallicRoughness = Object.assign({}, base.pbrMetallicRoughness, { baseColorFactor: color.slice() });
                delete base.pbrMetallicRoughness.baseColorTexture;
                if (color[3] < 1) base.alphaMode = "BLEND";
                else if (base.alphaMode === "BLEND") delete base.alphaMode;
                json.materials = json.materials || [];
                json.materials.push(base);
                materialCache.set(key, json.materials.length - 1);
            }
            primitive.material = materialCache.get(key);
        });
        json.meshes.push(mesh);
        definition.mesh = json.meshes.length - 1;
    });
    json.asset = Object.assign({}, json.asset, { generator: "CrootJS model3dtools.js" });

    const text = new TextEncoder().encode(JSON.stringify(json));
    const jsonLength = text.byteLength + pad4(text.byteLength);
    const byteLength = 12 + 8 + jsonLength + (total ? 8 + total : 0);
    const output = new Uint8Array(byteLength);
    const view = new DataView(output.buffer);
    view.setUint32(0, 0x46546C67, true); // "glTF"
    view.setUint32(4, 2, true);
    view.setUint32(8, byteLength, true);
    view.setUint32(12, jsonLength, true);
    view.setUint32(16, 0x4E4F534A, true); // "JSON"
    output.set(text, 20);
    output.fill(0x20, 20 + text.byteLength, 20 + jsonLength); // JSON diisi spasi
    if (total) {
        let offset = 20 + jsonLength;
        view.setUint32(offset, total, true);
        view.setUint32(offset + 4, 0x004E4942, true); // "BIN"
        offset += 8;
        let position = 0;
        pieces.forEach(piece => {
            output.set(piece, offset + position);
            position += piece.byteLength;
        });
    }
    return new Blob([output], { type: "model/gltf-binary" });
}

// Mengekspor model yang sedang tampil, beserta semua perubahannya (posisi, rotasi, skala,
// warna, bagian yang disembunyikan), sebagai file .glb.
// responseFunction(blob) - blob = Blob .glb, atau null kalau belum ada model. Juga
// mengembalikan Promise berisi blob yang sama.
export function exportGLB(id, responseFunction) {
    const viewer = viewerOf(id);
    const model = viewer ? viewer.getModel() : null;
    let blob = null;
    if (!model) {
        if (viewer) console.warn("Belum ada model yang bisa diekspor. Muat dulu dengan loadModel.");
    } else {
        blob = buildGLB(model);
    }
    if (typeof responseFunction === "function") responseFunction(blob);
    return Promise.resolve(blob);
}

// exportGLB lalu langsung mengunduhnya sebagai filename.
export function downloadGLB(id, filename = "model.glb", responseFunction) {
    return exportGLB(id, blob => {
        if (blob) {
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(link.href), 1000);
        }
        if (typeof responseFunction === "function") responseFunction(blob);
    });
}
