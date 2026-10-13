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
