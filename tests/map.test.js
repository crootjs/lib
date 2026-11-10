import { describe, test, assert, nextFrame, wait } from "./runner.js";
import { newMap, tap } from "./maputil.js";
import { removeMap, setMapView, getMapView, mapToPoint, pointToPosition, addGeoJSON, getLayers, hideLayer, showLayer, onMapClick, fitMap } from "../map.js";
import { addContextMenu, addScaleBar } from "../mapcontrol.js";
import { addGridMap, addHeatmap } from "../mapheat.js";
import { formatLength, formatArea, exportMapImage } from "../maptools.js";
import { addMarker } from "../mapmarker.js";

describe("map.js", () => {
    test("tampilan dan konversi titik <-> posisi", async () => {
        const id = newMap();
        assert.close(getMapView(id).center, [107.6, -6.9], 1e-9);
        assert.equal(getMapView(id).zoom, 14);
        setMapView(id, [106.8, -6.2], 12);
        assert.close(getMapView(id).center, [106.8, -6.2], 1e-9);
        const point = mapToPoint(id, [106.8, -6.2]);
        assert.close(point, [200, 150], 0.01);
        assert.close(pointToPosition(id, point), [106.8, -6.2], 1e-9);
        removeMap(id);
        assert.equal(document.getElementById(id).querySelector(".crootjs-map"), null);
    });
    test("lapisan bernama dan klik fitur", async () => {
        const id = newMap();
        const clicks = [];
        onMapClick(id, (position, feature) => clicks.push(feature ? feature.properties.nama : null));
        addGeoJSON(id, { type: "Feature", properties: { nama: "Kantor" }, geometry: { type: "Point", coordinates: [107.6, -6.9] } }, { name: "kantor" });
        await nextFrame();
        assert.deepEqual(getLayers(id).map(layer => layer.name), ["kantor"]);
        const shape = document.getElementById(id).querySelector(".crootjs-map svg circle, .crootjs-map svg path");
        tap(id, [200, 150], shape);
        assert.ok(document.getElementById(id).querySelector(".crootjs-map-popup:not([hidden])"), "popup terbuka");
        tap(id, [20, 20]);
        assert.deepEqual(clicks, ["Kantor", null]);
        assert.equal(document.getElementById(id).querySelector(".crootjs-map-popup:not([hidden])"), null, "popup tertutup");
        hideLayer(id, "kantor");
        assert.equal(getLayers(id)[0].visible, false);
        showLayer(id, "kantor");
        assert.equal(getLayers(id)[0].visible, true);
    });
    test("fitMap memuat seluruh data", () => {
        const id = newMap();
        fitMap(id, { type: "LineString", coordinates: [[107, -7], [108, -6]] });
        const a = mapToPoint(id, [107, -7]);
        const b = mapToPoint(id, [108, -6]);
        [a, b].forEach(point => assert.ok(point[0] >= 0 && point[0] <= 400 && point[1] >= 0 && point[1] <= 300, "titik di dalam peta"));
    });
});

describe("mapcontrol.js, mapmarker.js", () => {
    test("menu klik kanan berisi item sesuai titiknya", async () => {
        const id = newMap();
        const menu = addContextMenu(id, (position, feature) => ["coordinates", "-", feature && { label: "Hapus" }, { label: "Tambah titik" }]);
        const root = document.getElementById(id).querySelector(".crootjs-map");
        const rect = root.getBoundingClientRect();
        root.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: rect.left + 200, clientY: rect.top + 150 }));
        const items = [...document.querySelectorAll(".crootjs-map-menu .crootjs-map-menu-item")].map(item => item.textContent);
        assert.deepEqual(items, ["-6.900000, 107.600000", "Tambah titik"]);
        menu.remove();
        assert.equal(document.querySelectorAll(".crootjs-map-menu").length, 0);
    });
    test("skala dan marker", async () => {
        const id = newMap();
        addScaleBar(id);
        const marker = addMarker(id, [107.6, -6.9], { label: "A" });
        await nextFrame();
        assert.ok(document.getElementById(id).querySelector(".crootjs-map-scale").textContent.match(/m|km/));
        assert.ok(document.getElementById(id).querySelector(".crootjs-marker"));
        marker.remove();
    });
});

describe("mapheat.js", () => {
    test("addGridMap: rata-rata nilai per petak dan cellAt", () => {
        const id = newMap();
        const grid = addGridMap(id, [[107.6, -6.9, -80], [107.6001, -6.9001, -90], [107.7, -6.95, -120]], { cellMeters: 200 });
        const cell = grid.cellAt([107.6, -6.9]);
        assert.equal(cell.count, 2);
        assert.equal(cell.value, -85);
        assert.equal(grid.cellAt([107.65, -6.92]), null);
        grid.hide();
        assert.equal(grid.cellAt([107.6, -6.9]), null);
        grid.remove();
    });
    test("addHeatmap menggambar canvas", async () => {
        const id = newMap();
        const heat = addHeatmap(id, [[107.6, -6.9], [107.601, -6.9]], { legend: true });
        await wait(200);
        assert.ok(document.getElementById(id).querySelector("canvas.crootjs-heat-canvas"));
        assert.ok(document.getElementById(id).querySelector(".crootjs-heat-legend"));
        heat.remove();
        assert.equal(document.getElementById(id).querySelector("canvas.crootjs-heat-canvas"), null);
    });
});

describe("maptools.js", () => {
    test("format jarak dan luas", () => {
        assert.equal(formatLength(850), "850 m");
        assert.ok(/1[,.]2\d* km/.test(formatLength(1234)), formatLength(1234));
        assert.ok(/ha|m²|km²/.test(formatArea(25000)), formatArea(25000));
    });
    test("exportMapImage menghasilkan PNG", async () => {
        const id = newMap();
        addGeoJSON(id, { type: "Point", coordinates: [107.6, -6.9] });
        const blob = await new Promise(resolve => exportMapImage(id, resolve));
        assert.ok(blob && blob.type === "image/png" && blob.size > 100, "PNG tidak kosong");
    });
});
