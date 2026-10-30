import { parseGeoJSON } from "./geo.js";

// Jari-jari rata-rata bumi dalam meter. Semua perhitungan di modul ini menganggap bumi bola
// dengan jari-jari ini - nilai yang sama dengan yang dipakai Turf.js, jadi angkanya cocok.
const EARTH_RADIUS = 6371008.8;

function toRadians(degrees) {
    return degrees * Math.PI / 180;
}

function toDegrees(radians) {
    return radians * 180 / Math.PI;
}

// Semua geometri di dalam data, dengan GeometryCollection sudah diuraikan.
function geometriesOf(geojson) {
    const collection = parseGeoJSON(geojson);
    if (!collection) return [];
    const flatten = geometry => {
        if (!geometry) return [];
        return geometry.type === "GeometryCollection" ? geometry.geometries.flatMap(flatten) : [geometry];
    };
    return collection.features.flatMap(feature => flatten(feature.geometry));
}

// Garis-garis milik sebuah geometri: garisnya sendiri, atau ring-ring polygonnya.
function linesOf(geometry) {
    switch (geometry.type) {
        case "LineString": return [geometry.coordinates];
        case "MultiLineString": return geometry.coordinates;
        case "Polygon": return geometry.coordinates;
        case "MultiPolygon": return geometry.coordinates.flat();
        default: return [];
    }
}

// Polygon-polygon milik sebuah geometri, masing-masing berupa array ring
// (ring pertama tepi luar, sisanya lubang).
function polygonsOf(geometry) {
    if (geometry.type === "Polygon") return [geometry.coordinates];
    if (geometry.type === "MultiPolygon") return geometry.coordinates;
    return [];
}

function ringArea(ring) {
    let total = 0;
    for (let i = 0; i < ring.length; i++) {
        const from = ring[i];
        const to = ring[(i + 1) % ring.length];
        total += toRadians(to[0] - from[0]) * (Math.sin(toRadians(from[1])) + Math.sin(toRadians(to[1])));
    }
    return Math.abs(total * EARTH_RADIUS * EARTH_RADIUS / 2);
}

// Uji "sinar": hitung berapa kali garis mendatar dari titik itu memotong tepi ring.
function isInRing(position, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const a = ring[i];
        const b = ring[j];
        const crosses = (a[1] > position[1]) !== (b[1] > position[1])
            && position[0] < (b[0] - a[0]) * (position[1] - a[1]) / (b[1] - a[1]) + a[0];
        if (crosses) inside = !inside;
    }
    return inside;
}

function isInPolygon(position, rings) {
    return rings.length > 0 && isInRing(position, rings[0]) && !rings.slice(1).some(hole => isInRing(position, hole));
}

// Jarak antara dua posisi [lng, lat], dalam meter, mengikuti lengkung bumi (haversine).
export function getDistance(from, to) {
    const dLat = toRadians(to[1] - from[1]);
    const dLng = toRadians(to[0] - from[0]);
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(toRadians(from[1])) * Math.cos(toRadians(to[1])) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_RADIUS * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Panjang semua garis di dalam data, dalam meter. Untuk polygon yang dihitung kelilingnya
// (termasuk tepi lubang). Titik tidak punya panjang.
export function getLength(geojson) {
    let total = 0;
    geometriesOf(geojson).forEach(geometry => linesOf(geometry).forEach(line => {
        for (let i = 1; i < line.length; i++) total += getDistance(line[i - 1], line[i]);
    }));
    return total;
}

// Luas semua polygon di dalam data, dalam meter persegi. Lubang dikurangkan.
// Titik dan garis tidak punya luas.
export function getArea(geojson) {
    let total = 0;
    geometriesOf(geojson).forEach(geometry => polygonsOf(geometry).forEach(rings => {
        if (rings.length === 0) return;
        const holes = rings.slice(1).reduce((sum, hole) => sum + ringArea(hole), 0);
        total += Math.max(0, ringArea(rings[0]) - holes);
    }));
    return total;
}

// Fitur-fitur polygon yang memuat position [lng, lat]. Array kosong kalau tidak ada.
// Titik yang jatuh di dalam lubang sebuah polygon dihitung berada di luar polygon itu.
export function getFeaturesAt(position, geojson) {
    const collection = parseGeoJSON(geojson);
    if (!collection) return [];
    return collection.features.filter(feature =>
        geometriesOf(feature).some(geometry => polygonsOf(geometry).some(rings => isInPolygon(position, rings))));
}

// true kalau position [lng, lat] berada di dalam salah satu polygon di dalam data.
export function isInside(position, geojson) {
    return getFeaturesAt(position, geojson).length > 0;
}

// Fitur titik (Point/MultiPoint) yang paling dekat dengan position [lng, lat].
// Mengembalikan { feature, distance } - distance dalam meter - atau null kalau datanya
// tidak punya fitur titik. Garis dan polygon tidak ikut dibandingkan.
export function getNearest(position, geojson) {
    const collection = parseGeoJSON(geojson);
    if (!collection) return null;
    let nearest = null;
    collection.features.forEach(feature => geometriesOf(feature).forEach(geometry => {
        const points = geometry.type === "Point" ? [geometry.coordinates]
            : (geometry.type === "MultiPoint" ? geometry.coordinates : []);
        points.forEach(point => {
            const distance = getDistance(position, point);
            if (!nearest || distance < nearest.distance) nearest = { feature, distance };
        });
    }));
    return nearest;
}

// Membuat Feature polygon berbentuk lingkaran: pusat di center [lng, lat], jari-jari
// `radius` meter. GeoJSON tidak mengenal lingkaran, jadi ini segi banyak dengan `steps`
// sisi (bawaan 64). Cocok untuk menggambar radius (misalnya batas presensi) di peta.
export function createCircle(center, radius, steps = 64) {
    const latitude = toRadians(center[1]);
    const longitude = toRadians(center[0]);
    const angular = radius / EARTH_RADIUS;
    const ring = [];
    for (let i = 0; i < steps; i++) {
        // Arah diputar berlawanan jarum jam: RFC 7946 meminta tepi luar polygon begitu.
        const bearing = -2 * Math.PI * i / steps;
        const lat = Math.asin(Math.sin(latitude) * Math.cos(angular) + Math.cos(latitude) * Math.sin(angular) * Math.cos(bearing));
        const lng = longitude + Math.atan2(
            Math.sin(bearing) * Math.sin(angular) * Math.cos(latitude),
            Math.cos(angular) - Math.sin(latitude) * Math.sin(lat)
        );
        ring.push([toDegrees(lng), toDegrees(lat)]);
    }
    ring.push(ring[0]);
    return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } };
}

// Menyelesaikan sistem 3x3 `matrix` * x = `vector` (eliminasi Gauss). null kalau singular.
function solve3(matrix, vector) {
    const m = matrix.map((row, i) => [...row, vector[i]]);
    for (let column = 0; column < 3; column++) {
        let pivot = column;
        for (let row = column + 1; row < 3; row++) {
            if (Math.abs(m[row][column]) > Math.abs(m[pivot][column])) pivot = row;
        }
        if (Math.abs(m[pivot][column]) < 1e-12) return null;
        [m[column], m[pivot]] = [m[pivot], m[column]];
        for (let row = 0; row < 3; row++) {
            if (row === column) continue;
            const factor = m[row][column] / m[column][column];
            for (let k = column; k < 4; k++) m[row][k] -= factor * m[column][k];
        }
    }
    return m.map((row, i) => row[3] / m[i][i]);
}

// Transformasi affine (geser, putar, skala, miring) dari pasangan titik kontrol: titik ke-i
// di `from` berpasangan dengan titik ke-i di `to`, masing-masing [x, y]. Gunanya mengubah
// koordinat sistem lokal (grid CAD, denah, piksel gambar) ke [lng, lat] dan sebaliknya.
// Minimal 3 pasangan yang tidak segaris; lebih dari 3 dicocokkan dengan kuadrat terkecil.
// Mengembalikan function transform([x, y]) -> [x, y] dengan:
//   transform.inverse([x, y])  arah sebaliknya (dari `to` ke `from`)
//   transform.error            selisih rata-rata (RMS) titik kontrol setelah ditransformasi,
//                              dalam satuan `to` - besar berarti ada titik kontrol yang salah
// atau null kalau titik kontrolnya kurang atau segaris.
// Untuk area seukuran kawasan (beberapa km) affine dari lng/lat cukup teliti; untuk area
// yang jauh lebih luas, pakai proyeksi sungguhan.
export function createAffineTransform(from, to) {
    if (!Array.isArray(from) || !Array.isArray(to) || from.length < 3 || from.length !== to.length) return null;
    const normal = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    const sumX = [0, 0, 0];
    const sumY = [0, 0, 0];
    from.forEach((point, i) => {
        const v = [point[0], point[1], 1];
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) normal[r][c] += v[r] * v[c];
            sumX[r] += v[r] * to[i][0];
            sumY[r] += v[r] * to[i][1];
        }
    });
    const rowX = solve3(normal, sumX);
    const rowY = solve3(normal, sumY);
    if (!rowX || !rowY) return null;
    const [a, b, c] = rowX;
    const [d, e, f] = rowY;
    const determinant = a * e - b * d;
    if (Math.abs(determinant) < 1e-18) return null;

    const transform = point => [a * point[0] + b * point[1] + c, d * point[0] + e * point[1] + f];
    transform.inverse = point => {
        const x = point[0] - c;
        const y = point[1] - f;
        return [(e * x - b * y) / determinant, (a * y - d * x) / determinant];
    };
    const squared = from.reduce((sum, point, i) => {
        const result = transform(point);
        return sum + (result[0] - to[i][0]) ** 2 + (result[1] - to[i][1]) ** 2;
    }, 0);
    transform.error = Math.sqrt(squared / from.length);
    return transform;
}
