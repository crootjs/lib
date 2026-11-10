import { describe, test, assert, nextFrame } from "./runner.js";
import { newMap, tap, pointer, doubleClick } from "./maputil.js";
import { mapToPoint, pointToPosition } from "../map.js";
import { startDrawing, editFeature, addDrawControl } from "../mapdraw.js";

const keyboard = key => document.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));

describe("mapdraw.js", () => {
    test("poligon: klik titik pertama menutupnya", () => {
        const id = newMap();
        let result;
        startDrawing(id, "polygon", feature => { result = feature; }, { properties: { nama: "Blok A" } });
        [[100, 100], [300, 100], [300, 200]].forEach(point => tap(id, point));
        tap(id, [103, 102]); // dekat titik pertama
        assert.equal(result.geometry.type, "Polygon");
        const ring = result.geometry.coordinates[0];
        assert.equal(ring.length, 4);
        assert.deepEqual(ring[0], ring[3]);
        assert.close(ring[1], pointToPosition(id, [300, 100]), 1e-6);
        assert.deepEqual(result.properties, { nama: "Blok A" });
    });
    test("garis: klik ganda selesai, Backspace menghapus titik, Esc membatalkan", () => {
        const id = newMap();
        let line;
        startDrawing(id, "line", feature => { line = feature; });
        tap(id, [50, 50]);
        tap(id, [120, 80]);
        tap(id, [200, 60]);
        keyboard("Backspace");
        doubleClick(id, [120, 80]);
        assert.equal(line.geometry.coordinates.length, 2);
        let cancelled = "belum";
        startDrawing(id, "line", feature => { cancelled = feature; });
        tap(id, [50, 50]);
        keyboard("Escape");
        assert.equal(cancelled, null);
    });
    test("titik selesai dengan satu klik; tap tidak sampai ke onMapClick", () => {
        const id = newMap();
        let point;
        startDrawing(id, "point", feature => { point = feature; });
        tap(id, [200, 150]);
        assert.close(point.geometry.coordinates, [107.6, -6.9], 1e-6);
    });
    test("editFeature: geser simpul, tambah dari titik tengah, hapus dengan klik ganda", async () => {
        const id = newMap();
        const line = { type: "Feature", properties: { a: 1 }, geometry: { type: "LineString", coordinates: [pointToPosition(id, [100, 150]), pointToPosition(id, [300, 150])] } };
        const changes = [];
        const editor = editFeature(id, line, { onChange: feature => changes.push(feature) });
        const vertex = () => document.querySelectorAll(`#${id} .crootjs-draw-vertex`)[1];
        // geser simpul kedua ke (300, 50)
        // Gerakan dikirim ke peta, seperti mouse sungguhan: pegangannya sendiri digambar ulang.
        pointer(id, "pointerdown", [300, 150], vertex());
        pointer(id, "pointermove", [300, 100]);
        pointer(id, "pointermove", [300, 50]);
        pointer(id, "pointerup", [300, 50]);
        assert.close(mapToPoint(id, editor.getFeature().geometry.coordinates[1]), [300, 50], 0.01);
        // tarik titik tengah: simpul baru di antaranya
        const middle = document.querySelector(`#${id} .crootjs-draw-midpoint`);
        pointer(id, "pointerdown", [200, 100], middle);
        pointer(id, "pointermove", [200, 250]);
        pointer(id, "pointerup", [200, 250]);
        assert.equal(editor.getFeature().geometry.coordinates.length, 3);
        // klik ganda simpul tengah: terhapus
        document.querySelectorAll(`#${id} .crootjs-draw-vertex`)[1].dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
        assert.equal(editor.getFeature().geometry.coordinates.length, 2);
        // garis tidak boleh kurang dari 2 simpul
        document.querySelectorAll(`#${id} .crootjs-draw-vertex`)[0].dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
        assert.equal(editor.getFeature().geometry.coordinates.length, 2);
        assert.equal(changes.length, 3);
        assert.deepEqual(editor.getFeature().properties, { a: 1 });
        assert.equal(line.geometry.coordinates.length, 2, "data asli tidak diubah");
        editor.stop();
        assert.equal(document.querySelectorAll(`#${id} .crootjs-draw-vertex`).length, 0);
    });
    test("editFeature: poligon tetap tertutup", () => {
        const id = newMap();
        const square = { type: "Polygon", coordinates: [[[107.59, -6.91], [107.61, -6.91], [107.61, -6.89], [107.59, -6.89], [107.59, -6.91]]] };
        const editor = editFeature(id, square);
        assert.equal(document.querySelectorAll(`#${id} .crootjs-draw-vertex`).length, 4);
        assert.equal(document.querySelectorAll(`#${id} .crootjs-draw-midpoint`).length, 4);
        const ring = editor.getFeature().coordinates[0];
        assert.equal(ring.length, 5);
        assert.deepEqual(ring[0], ring[4]);
    });
    test("addDrawControl: gambar, lalu hapus fitur", async () => {
        const id = newMap();
        const changes = [];
        const control = addDrawControl(id, { onChange: data => changes.push(data.features.length) });
        const tool = label => document.querySelector(`#${id} button[aria-label="${label}"]`);
        tool("Gambar titik").click();
        assert.equal(tool("Gambar titik").getAttribute("aria-pressed"), "true");
        tap(id, [150, 150]);
        tap(id, [250, 150]); // alat titik tetap aktif untuk titik berikutnya
        assert.equal(control.getData().features.length, 2);
        tool("Gambar titik").click(); // matikan
        tool("Hapus fitur").click();
        await nextFrame();
        const dots = document.querySelectorAll(`#${id} circle.crootjs-draw-feature`);
        assert.equal(dots.length, 2);
        tap(id, [150, 150], dots[0]);
        assert.equal(control.getData().features.length, 1);
        assert.deepEqual(changes, [1, 2, 1]);
        control.setData({ type: "LineString", coordinates: [[107.59, -6.9], [107.61, -6.9]] });
        assert.equal(control.getData().features[0].geometry.type, "LineString");
        control.remove();
        assert.equal(document.querySelector(`#${id} .crootjs-map-draw`), null);
    });
});
