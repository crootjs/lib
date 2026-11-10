import { describe, test, assert, fixture, nextFrame, skip } from "./runner.js";
import { makeSkinnedGLB, hasWebGL } from "./glb.js";
import { createViewer, loadModel, setPartTransform } from "../model3d.js";
import { getARLink } from "../model3dtools.js";

const noWebGL = hasWebGL() ? null : "WebGL tidak tersedia di browser ini";

describe("model3d.js: skinning dan Draco", () => {
    test("vertex ber-skin ikut tulang (kotak pembatas dan klik)", async () => {
        const id = fixture(400, 300);
        createViewer(id);
        const info = await loadModel(id, makeSkinnedGLB());
        assert.close(info.bounds.max, [2, 0.1, 0], 1e-5);
        setPartTransform(id, "Siku", { rotation: [0, 0, 90] });
        const viewer = document.getElementById(id).crootjs3d;
        const bounds = viewer.boundsOf(viewer.getModel().roots);
        assert.close(bounds.max[1], 1, 1e-4, "ujung lengan naik ke y = 1");
        assert.close(bounds.max[0], 1.1, 1e-4);
        await nextFrame();
        const ray = viewer.rayAt(viewer.toScreen([1, 0.9, 0]));
        const hit = viewer.raycast(ray.origin, ray.direction);
        assert.equal(hit && hit.node.name, "Lengan", "klik mengenai bagian yang sudah ditekuk");
    }, { skip: noWebGL });
    test("model Draco diurai dengan dekoder resmi", async () => {
        const id = fixture(300, 200);
        createViewer(id);
        let error = null;
        const info = await loadModel(id, "fixtures/Box.gltf", (value, message) => { error = message; });
        if (!info && /dekoder Draco/.test(error || "")) skip("dekoder Draco (www.gstatic.com) tidak terjangkau");
        assert.ok(info, error);
        assert.equal(info.triangles, 12);
        assert.close(info.bounds.size, [1, 1, 1], 1e-4);
    }, { skip: noWebGL });
});

describe("model3dtools.js: AR", () => {
    test("getARLink membuat intent Scene Viewer dengan URL absolut", () => {
        const link = getARLink("models/bts.glb", { title: "BTS" });
        assert.ok(link.startsWith("intent://arvr.google.com/scene-viewer/1.0?"), link);
        const query = new URLSearchParams(link.slice(link.indexOf("?") + 1, link.indexOf("#")));
        assert.equal(query.get("file"), new URL("models/bts.glb", location.href).href);
        assert.equal(query.get("mode"), "ar_preferred");
        assert.equal(query.get("title"), "BTS");
        assert.ok(link.includes("S.browser_fallback_url=" + encodeURIComponent(location.href)));
    });
});
