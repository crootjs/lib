// Modul tambahan untuk map.js: model 3D glTF/GLB di lokasinya di peta - misalnya menara BTS
// di koordinatnya - dengan ukuran sesuai meter di lapangan, dilihat miring dari selatan.
// Peta CrootJS dilihat tegak dari atas, jadi model digambar di kanvasnya sendiri lalu
// ditempel di titiknya; ukurannya ikut berubah saat peta di-zoom.
// Tidak mengimpor map.js (petanya dijangkau lewat element.crootjsMap). Penampil 3D-nya dari
// model3d.js, yang fungsinya diekspor ulang dari sini: setPartColor, highlightPart, dan
// lainnya untuk model di peta harus diimpor dari mapmodel.js juga, karena model3d.min.js yang
// diimpor terpisah adalah salinan lain dengan daftar penampil sendiri.
import { createViewer, loadModel, setCameraView, removeViewer } from "./model3d.js";

export * from "./model3d.js";

const EQUATOR = 40075016.686; // keliling bumi di khatulistiwa (meter)
const FOV = 12;               // derajat; sudut sempit supaya hampir tanpa perspektif, seperti peta
const MAX_SIZE = 1024;        // piksel; sisi kanvas terbesar per model
const MAX_MODELS = 8;         // browser membatasi jumlah konteks WebGL per halaman

let count = 0;

function injectStyles() {
    if (document.getElementById("crootjs-mapmodel-style")) return;
    const style = document.createElement("style");
    style.id = "crootjs-mapmodel-style";
    style.textContent = `
.crootjs-map-model { position: absolute; left: 0; top: 0; pointer-events: none; }
.crootjs-map-model .crootjs-3d { pointer-events: none; background: none; }
`;
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

// Menaruh model 3D di position [lng, lat]. source: URL .glb/.gltf, File/Blob, atau ArrayBuffer
// (sama dengan loadModel). Titik asal model (0, 0, 0) - biasanya tengah dasarnya - jatuh tepat
// di position. Sumbu model mengikuti glTF: +Y ke atas, -Z menghadap utara, +X ke timur.
// options (semua opsional):
//   heading      putaran model searah jarum jam dari utara, derajat. Bawaan 0.
//   pitch        sudut pandang dari atas cakrawala, derajat (90 = tegak dari atas). Bawaan 50.
//   scale        meter per satuan model. Bawaan 1 (glTF memakai meter).
//   minZoom      di bawah zoom ini model disembunyikan (terlalu kecil). Bawaan 13.
//   onClick      function (hit) saat model diklik; hit sama dengan onModelClick model3d.js.
//                Klik sampai 8 piksel dari model masih dihitung, karena model di peta kecil.
//   responseFunction  function (info, error) setelah model dimuat, sama dengan loadModel.
// Mengembalikan { setPosition(position), setHeading(degrees), viewerId, loaded, remove() }:
// viewerId bisa dipakai fungsi model3d.js yang diekspor ulang modul ini, misalnya
// setPartColor(viewerId, "Antena_1", "red"); loaded = Promise hasil loadModel.
export function addModel(id, position, source, options = {}) {
    const map = mapOf(id);
    const none = { setPosition() {}, setHeading() {}, viewerId: null, remove() {} };
    if (!map) return none;
    injectStyles();
    if (++count > MAX_MODELS) console.warn(`Lebih dari ${MAX_MODELS} model di satu halaman: browser bisa menutup konteks WebGL yang lama.`);

    const box = document.createElement("div");
    box.className = "crootjs-map-model";
    box.id = "crootjs-map-model-" + Math.random().toString(36).slice(2);
    box.style.width = box.style.height = "64px"; // ukuran awal; disesuaikan begitu model dimuat
    map.overlay.appendChild(box);
    createViewer(box.id, { controls: false, background: "transparent", fov: FOV });

    let current = position.slice();
    let heading = Number(options.heading) || 0;
    const pitch = Number.isFinite(options.pitch) ? options.pitch : 50;
    const scale = Number(options.scale) || 1;
    const minZoom = Number.isFinite(options.minZoom) ? options.minZoom : 13;
    let bounds = null; // kotak model dalam satuan model, dari loadModel
    let side = 0;

    const place = () => {
        if (!bounds) return;
        const view = map.getView();
        if (view.zoom < minZoom) {
            box.hidden = true;
            return;
        }
        box.hidden = false;
        const metersPerPixel = EQUATOR * Math.cos(current[1] * Math.PI / 180) / (256 * Math.pow(2, view.zoom));
        // Jari-jari dari titik asal (bukan dari tengah kotak), supaya seluruh model muat di kanvas.
        const radius = Math.hypot(Math.max(Math.abs(bounds.min[0]), Math.abs(bounds.max[0])), bounds.size[1] / 2,
            Math.max(Math.abs(bounds.min[2]), Math.abs(bounds.max[2]))) * scale; // meter
        const wanted = Math.max(16, Math.min(MAX_SIZE, Math.ceil(2.4 * radius / metersPerPixel)));
        if (wanted !== side) {
            side = wanted;
            box.style.width = side + "px";
            box.style.height = side + "px";
        }
        // Kamera melihat ke atas titik asal model, setinggi tengah model; kanvasnya digeser ke atas
        // sejauh itu (dilihat miring) supaya titik asal (0, 0, 0) tepat di titik peta.
        const lift = bounds.center[1] * scale * Math.cos(pitch * Math.PI / 180) / metersPerPixel;
        const point = map.toPoint(current);
        box.style.transform = `translate(${point[0] - side / 2}px, ${point[1] - side / 2 - lift}px)`;
        // Jarak kamera yang membuat 1 meter = 1/metersPerPixel piksel, seperti peta di bawahnya.
        const distance = side * metersPerPixel / (scale * 2 * Math.tan(FOV * Math.PI / 360));
        setCameraView(box.id, { yaw: heading, pitch, distance, target: [0, bounds.center[1], 0] }, false);
    };

    const stopFollowing = map.onMove(place);
    const loaded = loadModel(box.id, source, (info, error) => {
        if (info) {
            bounds = info.bounds;
            place();
        }
        if (typeof options.responseFunction === "function") options.responseFunction(info, error);
    });

    // Klik peta yang mengenai model (kanvasnya sendiri tidak menangkap klik, supaya peta tetap
    // bisa digeser dari atas model).
    const stopClick = typeof options.onClick === "function" ? map.onClick(position => {
        if (box.hidden || !bounds) return;
        const viewer = box.crootjs3d;
        const point = map.toPoint(position);
        const rect = box.getBoundingClientRect();
        const mapRect = map.root.getBoundingClientRect();
        const local = [point[0] - (rect.left - mapRect.left), point[1] - (rect.top - mapRect.top)];
        if (local[0] < 0 || local[1] < 0 || local[0] > side || local[1] > side) return;
        // Model di peta sering hanya puluhan piksel (rangka menara, kabel): kalau klik tepat
        // meleset, titik-titik di sekitarnya (4 dan 8 piksel) ikut dicoba.
        let hit = null;
        for (const radius of [0, 4, 8]) {
            for (let k = 0; k < (radius ? 8 : 1) && !hit; k++) {
                const angle = k * Math.PI / 4;
                const ray = viewer.rayAt([local[0] + Math.cos(angle) * radius, local[1] + Math.sin(angle) * radius]);
                hit = viewer.raycast(ray.origin, ray.direction);
            }
            if (hit) break;
        }
        if (!hit) return;
        const path = [];
        for (let node = hit.node; node; node = node.parent) path.unshift(node.name);
        options.onClick({ part: hit.node.name, mesh: hit.node.meshName, path, position: hit.position, distance: hit.t });
    }) : () => {};

    return {
        viewerId: box.id,
        loaded,
        setPosition(value) {
            current = value.slice();
            place();
        },
        setHeading(degrees) {
            heading = Number(degrees) || 0;
            place();
        },
        remove() {
            stopFollowing();
            stopClick();
            removeViewer(box.id);
            box.remove();
            count--;
        }
    };
}
