import { describe, test, assert, fixture, nextFrame } from "./runner.js";
import { makeGLB, hasWebGL } from "./glb.js";
import { createViewer, loadModel, getParts, setPartTransform, getPartTransform, setPartColor, setPartVisible, onModelClick, removeViewer } from "../model3d.js";
import { exportGLB, explodeModel, getAnimations, playAnimation, addSection, addHotspot } from "../model3dtools.js";

const skip = hasWebGL() ? null : "WebGL tidak tersedia di browser ini";

async function newViewer(webgl) {
    const id = fixture(400, 300);
    createViewer(id, { webgl });
    const info = await loadModel(id, makeGLB());
    return { id, info };
}

// Bagian yang kena sinar dari titik layar [x, y].
function partAt(id, point) {
    const viewer = document.getElementById(id).crootjs3d;
    const ray = viewer.rayAt(point);
    const hit = viewer.raycast(ray.origin, ray.direction);
    return hit ? hit.node.name : null;
}

describe("model3d.js", () => {
    test("memuat GLB: bagian, segitiga, ukuran", async () => {
        const { info } = await newViewer();
        assert.deepEqual(info.parts, ["Grup", "Kotak_A", "Kotak_B"]);
        assert.equal(info.triangles, 24);
        assert.close(info.bounds.size, [3, 1, 1], 1e-6);
    }, { skip });
    test("cadangan WebGL1 juga memuat model", async () => {
        const { id, info } = await newViewer(1);
        assert.equal(info.parts.length, 3);
        assert.equal(document.getElementById(id).querySelector("canvas").getContext("webgl2"), null);
    }, { skip });
    test("file rusak gagal dengan pesan", async () => {
        const id = fixture(200, 200);
        createViewer(id);
        let error = null;
        const info = await loadModel(id, new TextEncoder().encode("bukan model").buffer, (value, message) => { error = message; });
        assert.equal(info, null);
        assert.ok(/glb|gltf/i.test(error), error);
    }, { skip });
    test("transform bagian: posisi, rotasi Euler, skala", async () => {
        const { id } = await newViewer();
        setPartTransform(id, "Kotak_B", { position: [2, 1, 0], rotation: [0, 150, 0], scale: 2 });
        const transform = getPartTransform(id, "Kotak_B");
        assert.close(transform.position, [2, 1, 0]);
        assert.close(transform.rotation, [0, 150, 0], 1e-4);
        assert.close(transform.scale, [2, 2, 2]);
    }, { skip });
    test("klik kena bagian yang benar; tersembunyi tidak bisa diklik", async () => {
        const { id } = await newViewer();
        await nextFrame();
        const viewer = document.getElementById(id).crootjs3d;
        const screenB = viewer.toScreen([1, 0, 0]);
        assert.equal(partAt(id, screenB), "Kotak_B");
        assert.ok(setPartColor(id, "Kotak_B", "#00ff00"));
        assert.equal(setPartColor(id, "Tidak_Ada", "red"), false);
        setPartVisible(id, "Kotak_B", false);
        assert.equal(partAt(id, screenB), null);
        const clicks = [];
        onModelClick(id, hit => clicks.push(hit && hit.part));
        assert.deepEqual(getParts(id).map(part => part.visible), [true, true, false]);
        removeViewer(id);
        assert.equal(document.getElementById(id).crootjs3d, undefined);
    }, { skip });
});

describe("model3dtools.js", () => {
    test("ekspor GLB lalu muat ulang: perubahan ikut tersimpan", async () => {
        const { id } = await newViewer();
        setPartTransform(id, "Kotak_A", { position: [-3, 0.5, 0] });
        setPartVisible(id, "Kotak_B", false);
        setPartColor(id, "Kotak_A", "#00ff00");
        const blob = await exportGLB(id);
        assert.equal(blob.type, "model/gltf-binary");
        createViewer(id);
        const info = await loadModel(id, blob);
        assert.close(getPartTransform(id, "Kotak_A").position, [-3, 0.5, 0], 1e-6);
        assert.equal(info.triangles, 12, "Kotak_B dikeluarkan dari scene");
        const json = JSON.parse(new TextDecoder().decode(new Uint8Array(await blob.arrayBuffer(), 20, new DataView(await blob.arrayBuffer()).getUint32(12, true))));
        assert.ok(json.materials.some(material => material.pbrMetallicRoughness.baseColorFactor[1] > 0.99 && material.pbrMetallicRoughness.baseColorFactor[0] < 0.01), "material hijau");
    }, { skip });
    test("animasi: daftar, seek, stop mengembalikan pose", async () => {
        const { id } = await newViewer();
        assert.deepEqual(getAnimations(id).map(animation => [animation.name, animation.duration]), [["Geser", 1]]);
        const animation = playAnimation(id, "Geser", { autoplay: false });
        animation.seek(0.5);
        assert.close(getPartTransform(id, "Kotak_B").position, [1, 1, 0], 1e-6);
        animation.stop();
        assert.close(getPartTransform(id, "Kotak_B").position, [1, 0, 0], 1e-6);
    }, { skip });
    test("tampilan meledak dan kembali rapat persis", async () => {
        const { id } = await newViewer();
        explodeModel(id, 1, { animate: false });
        assert.close(getPartTransform(id, "Kotak_A").position, [-2, 0, 0], 1e-6);
        assert.close(getPartTransform(id, "Kotak_B").position, [2, 0, 0], 1e-6);
        explodeModel(id, 0, { animate: false });
        assert.close(getPartTransform(id, "Kotak_A").position, [-1, 0, 0], 1e-6);
    }, { skip });
    test("potongan: sisi terpotong tidak bisa diklik; hotspot ikut tersembunyi", async () => {
        const { id } = await newViewer();
        await nextFrame();
        const viewer = document.getElementById(id).crootjs3d;
        const screenB = viewer.toScreen([1, 0, 0]);
        addHotspot(id, "Kotak_B", "B");
        const section = addSection(id, { axis: "x", position: 0.5 }); // buang x > 0
        await nextFrame();
        assert.equal(partAt(id, screenB), null);
        assert.equal(partAt(id, viewer.toScreen([-1, 0, 0])), "Kotak_A");
        assert.equal(document.getElementById(id).querySelector(".crootjs-3d-hotspot").hidden, true);
        section.set({ flip: true });
        assert.equal(partAt(id, screenB), "Kotak_B");
        section.remove();
    }, { skip });
});
