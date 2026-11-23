import { describe, test, assert, fixture, nextFrame, skip } from "./runner.js";
import { makeSkinnedGLB, hasWebGL } from "./glb.js";
import { createViewer, loadModel, setPartTransform } from "../model3d.js";
import { getARLink, measureModel, startAR, isARSupported } from "../model3dtools.js";
import { makeGLB } from "./glb.js";

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

describe("model3dtools.js: measureModel", () => {
    // Tap di titik layar [x, y] pada kanvas penampil.
    const tapAt = (id, point) => {
        const canvas = document.getElementById(id).querySelector("canvas");
        const rect = canvas.getBoundingClientRect();
        const init = { bubbles: true, cancelable: true, pointerId: 7, pointerType: "mouse", button: 0, clientX: rect.left + point[0], clientY: rect.top + point[1] };
        canvas.dispatchEvent(new PointerEvent("pointerdown", init));
        canvas.dispatchEvent(new PointerEvent("pointerup", init));
    };
    test("jarak dan sudut dari titik-titik di permukaan", async () => {
        const id = fixture(400, 300);
        createViewer(id);
        await loadModel(id, makeGLB());
        await nextFrame();
        const viewer = document.getElementById(id).crootjs3d;
        const changes = [];
        const tool = measureModel(id, { scale: 2, onChange: result => changes.push(result) });
        // Dua titik di permukaan atas Kotak_B (x = 0,5..1,5, y = 0,5), berjarak 0,4 di x.
        tapAt(id, viewer.toScreen([0.8, 0.5, 0]));
        tapAt(id, viewer.toScreen([1.2, 0.5, 0]));
        const result = tool.getResult();
        assert.ok(result.complete);
        assert.close(result.distance, 0.8, 0.02, "0,4 satuan x 2 meter per satuan");
        assert.equal(changes.length, 2);
        const label = document.getElementById(id).querySelector(".crootjs-3d-measure-label");
        assert.equal(label.hidden, false);
        assert.ok(/cm$/.test(label.textContent), label.textContent);
        tool.remove();
        assert.equal(document.getElementById(id).querySelector(".crootjs-3d-measure"), null);

        const angle = measureModel(id, { mode: "angle" });
        tapAt(id, viewer.toScreen([1.3, 0.5, 0]));
        tapAt(id, viewer.toScreen([1, 0.5, 0]));
        tapAt(id, viewer.toScreen([1, 0.5, 0.3]));
        assert.close(angle.getResult().angle, 90, 2);
        angle.remove();
    }, { skip: noWebGL });
});

describe("model3dtools.js: startAR (WebXR tiruan)", () => {
    test("pratinjau mengikuti permukaan, ketukan menaruh model, Tutup mengakhiri", async () => {
        const id = fixture(200, 200);
        createViewer(id);
        await loadModel(id, makeGLB());
        const gl = document.getElementById(id).crootjs3d.gl;
        // Kamera tiruan di (0, 0.5, 3) menghadap -z; permukaan yang ditunjuk di titik asal. Alas
        // model (y = -0,5) naik ke permukaan, jadi Kotak_B (x = 1) tampil di piksel (160, 100).
        const projection = new Float32Array([1.8, 0, 0, 0, 0, 1.8, 0, 0, 0, 0, -1.002, -1, 0, 0, -0.2, 0]);
        const view = {
            projectionMatrix: projection,
            transform: { position: { x: 0, y: 0.5, z: 3 }, inverse: { matrix: new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -0.5, -3, 1]) } }
        };
        const frame = {
            getViewerPose: () => ({ views: [view] }),
            getHitTestResults: () => [{ getPose: () => ({ transform: { position: { x: 0, y: 0, z: 0 } } }) }]
        };
        let pixel = null;
        class FakeSession extends EventTarget {
            updateRenderState() {}
            requestReferenceSpace() { return Promise.resolve({}); }
            requestHitTestSource() { return Promise.resolve({ cancel() {} }); }
            requestAnimationFrame(callback) {
                if (this.frames++ > 2) return;
                setTimeout(() => {
                    callback(0, frame);
                    const out = new Uint8Array(4);
                    gl.readPixels(160, 100, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
                    pixel = [...out];
                }, 0);
            }
            end() { this.dispatchEvent(new Event("end")); }
        }
        const session = new FakeSession();
        session.frames = 0;
        const originalLayer = window.XRWebGLLayer;
        Object.defineProperty(navigator, "xr", { configurable: true, value: {
            isSessionSupported: () => Promise.resolve(true),
            requestSession: () => Promise.resolve(session)
        } });
        // Tanpa perangkat XR, makeXRCompatible asli menolak.
        gl.makeXRCompatible = () => Promise.resolve();
        window.XRWebGLLayer = class { constructor() { this.framebuffer = null; } getViewport() { return { x: 0, y: 0, width: 200, height: 200 }; } };
        try {
            assert.equal(await isARSupported(), true);
            const places = [];
            let ended = false;
            const ar = await startAR(id, { onPlace: position => places.push(position), onEnd: () => { ended = true; } });
            assert.equal(ar.supported, true);
            await new Promise(resolve => setTimeout(resolve, 50));
            assert.ok(pixel && pixel[3] > 0, "model tergambar di framebuffer AR");
            session.dispatchEvent(new Event("select"));
            assert.deepEqual(places, [[0, 0, 0]]);
            document.querySelector(".crootjs-3d-xr button").click();
            assert.ok(ended);
            assert.equal(document.querySelector(".crootjs-3d-xr"), null);
        } finally {
            delete navigator.xr;
            delete gl.makeXRCompatible;
            window.XRWebGLLayer = originalLayer;
        }
    }, { skip: noWebGL });
});
