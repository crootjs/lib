import { describe, test, assert } from "./runner.js";
import { parseGeoJSON, getBBox, getCenter, getPropertyKeys, toLatLng } from "../geo.js";
import { getDistance, getLength, getArea, isInside, getNearest, createCircle, createAffineTransform } from "../geomeasure.js";
import { findRoute } from "../georoute.js";

const square = { type: "Polygon", coordinates: [[[107, -7], [107.01, -7], [107.01, -6.99], [107, -6.99], [107, -7]]] };

describe("geo.js", () => {
    test("parseGeoJSON menyeragamkan masukan jadi FeatureCollection", () => {
        const fromGeometry = parseGeoJSON({ type: "Point", coordinates: [107, -7] });
        assert.equal(fromGeometry.type, "FeatureCollection");
        assert.deepEqual(fromGeometry.features[0].properties, {});
        const fromString = parseGeoJSON('{"type":"Feature","properties":{"a":1},"geometry":{"type":"Point","coordinates":[1,2]}}');
        assert.equal(fromString.features.length, 1);
        assert.equal(parseGeoJSON("bukan json"), null);
    });
    test("getBBox, getCenter, getPropertyKeys, toLatLng", () => {
        const data = { type: "FeatureCollection", features: [
            { type: "Feature", properties: { nama: "A", tinggi: 3 }, geometry: { type: "Point", coordinates: [107, -7] } },
            { type: "Feature", properties: { nama: "B", warna: "merah" }, geometry: { type: "Point", coordinates: [108, -6] } }
        ] };
        assert.deepEqual(getBBox(data), [107, -7, 108, -6]);
        assert.deepEqual(getCenter(data), [107.5, -6.5]);
        assert.deepEqual(getPropertyKeys(data), ["nama", "tinggi", "warna"]);
        assert.deepEqual(toLatLng([107, -7]), [-7, 107]);
    });
});

describe("geomeasure.js", () => {
    test("jarak dan panjang (Bandung - Jakarta sekitar 117 km)", () => {
        const bandung = [107.6191, -6.9175];
        const jakarta = [106.8456, -6.2088];
        assert.close(getDistance(bandung, jakarta) / 1000, 116.8, 1);
        assert.close(getLength({ type: "LineString", coordinates: [[0, 0], [0, 1]] }) / 1000, 111.2, 0.2);
    });
    test("luas, di dalam, terdekat, lingkaran", () => {
        // 0,01° x 0,01° di lintang 7° LS: 1.104 m (bujur, x cos 7°) x 1.112 m (lintang)
        assert.close(getArea(square) / 1e6, 1.227, 0.005);
        assert.ok(isInside([107.005, -6.995], square));
        assert.ok(!isInside([107.02, -6.995], square));
        const nearest = getNearest([107, -7], { type: "MultiPoint", coordinates: [[107.1, -7], [107.001, -7]] });
        assert.close(nearest.distance, 110.5, 1);
        const circle = createCircle([107, -7], 1000);
        assert.close(getArea(circle) / (Math.PI * 1e6), 1, 0.01);
    });
    test("createAffineTransform bolak-balik", () => {
        const grid = [[1000, 2000], [1500, 2000], [1000, 2400]];
        const wgs = [[107.5752, -6.8741], [107.57974, -6.87407], [107.57517, -6.87048]];
        const transform = createAffineTransform(grid, wgs);
        assert.close(transform([1500, 2000]), wgs[1], 1e-9);
        assert.close(transform.inverse(transform([1234, 2111])), [1234, 2111], 1e-6);
        assert.equal(createAffineTransform([[0, 0], [1, 1], [2, 2]], wgs), null);
    });
});

describe("georoute.js", () => {
    test("rute terpendek lewat persimpangan", () => {
        // dua jalan: A-B-C lurus, dan jalan memutar A-D-C yang lebih panjang
        const roads = { type: "FeatureCollection", features: [
            { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[0, 0], [0.01, 0], [0.02, 0]] } },
            { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[0, 0], [0.01, 0.01], [0.02, 0]] } }
        ] };
        const route = findRoute([0, 0], [0.02, 0], roads);
        assert.close(route.properties.distance, getDistance([0, 0], [0.02, 0]), 1);
        assert.equal(findRoute([0, 0], [5, 5], { type: "FeatureCollection", features: [] }), null);
    });
});
