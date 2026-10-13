import { parseGeoJSON } from "./geo.js";
import { getDistance } from "./geomeasure.js";

// Halaman yang menghitung rute hampir selalu juga butuh jarak. Fungsi geomeasure.js diekspor
// ulang dari sini supaya cukup satu import, dan geomeasure.js tidak terunduh dua kali.
export * from "./geomeasure.js";

// Semua garis di dalam data (LineString dan MultiLineString, termasuk yang berada di dalam
// GeometryCollection), masing-masing berupa array posisi. Titik dan polygon dilewati.
function linesOf(collection) {
    const flatten = geometry => {
        if (!geometry) return [];
        if (geometry.type === "LineString") return [geometry.coordinates];
        if (geometry.type === "MultiLineString") return geometry.coordinates;
        if (geometry.type === "GeometryCollection") return geometry.geometries.flatMap(flatten);
        return [];
    };
    return collection.features.flatMap(feature => flatten(feature.geometry));
}

// Antrean prioritas (min-heap): pop() selalu mengeluarkan simpul dengan jarak terkecil.
function createQueue() {
    const items = []; // [simpul, jarak]
    return {
        size: () => items.length,
        push(node, distance) {
            items.push([node, distance]);
            let i = items.length - 1;
            while (i > 0) {
                const parent = (i - 1) >> 1;
                if (items[parent][1] <= items[i][1]) break;
                [items[parent], items[i]] = [items[i], items[parent]];
                i = parent;
            }
        },
        pop() {
            const top = items[0];
            const last = items.pop();
            if (items.length > 0) {
                items[0] = last;
                let i = 0;
                for (;;) {
                    const left = 2 * i + 1;
                    const right = left + 1;
                    let smallest = i;
                    if (left < items.length && items[left][1] < items[smallest][1]) smallest = left;
                    if (right < items.length && items[right][1] < items[smallest][1]) smallest = right;
                    if (smallest === i) break;
                    [items[smallest], items[i]] = [items[i], items[smallest]];
                    i = smallest;
                }
            }
            return top;
        }
    };
}

// Titik pada ruas a-b yang paling dekat dengan position. Dihitung di bidang datar dengan
// bujur diskalakan cos(lintang), supaya jarak timur-barat tidak dilebih-lebihkan.
function closestOnSegment(position, a, b) {
    const scale = Math.cos(position[1] * Math.PI / 180);
    const ax = (a[0] - position[0]) * scale;
    const ay = a[1] - position[1];
    const dx = (b[0] - a[0]) * scale;
    const dy = b[1] - a[1];
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared));
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

// Mencari rute terpendek dari `from` ke `to` (keduanya [lng, lat]) di sepanjang garis-garis
// (LineString/MultiLineString) di dalam `geojson`. Dihitung di browser, tanpa layanan rute.
//
// - `from` dan `to` boleh di mana saja: masing-masing ditempelkan ke titik terdekat pada
//   garis terdekat, dan rutenya mulai/berakhir di titik tempel itu.
// - Dua garis dianggap bertemu kalau punya koordinat yang sama. Koordinat dibandingkan
//   setelah dibulatkan ke options.precision angka desimal (bawaan 6, kira-kira 11 cm).
//   Untuk data gambar tangan yang ujung garisnya hanya berdekatan, turunkan nilainya
//   (5 = kira-kira 1 m, 4 = kira-kira 11 m).
// - Semua garis dianggap dua arah, dan yang dicari jarak terpendek.
//
// Mengembalikan Feature LineString dengan properties.distance (panjang rute, meter),
// atau null kalau datanya tidak punya garis atau kedua titik tidak terhubung.
export function findRoute(from, to, geojson, options = {}) {
    const collection = parseGeoJSON(geojson);
    if (!collection) return null;
    const digits = Number.isInteger(options.precision) ? options.precision : 6;

    const positions = [];      // indeks simpul -> [lng, lat]
    const neighbours = [];     // indeks simpul -> [[indeks tetangga, jarak meter], ...]
    const segments = [];       // ruas garis sebagai [indeks simpul, indeks simpul]
    const indexOf = new Map(); // koordinat yang sudah dibulatkan -> indeks simpul

    const nodeAt = position => {
        const key = position[0].toFixed(digits) + "," + position[1].toFixed(digits);
        let index = indexOf.get(key);
        if (index === undefined) {
            index = positions.length;
            positions.push(position);
            neighbours.push([]);
            indexOf.set(key, index);
        }
        return index;
    };
    const connect = (a, b) => {
        const distance = getDistance(positions[a], positions[b]);
        neighbours[a].push([b, distance]);
        neighbours[b].push([a, distance]);
    };

    linesOf(collection).forEach(line => {
        for (let i = 1; i < line.length; i++) {
            const a = nodeAt(line[i - 1]);
            const b = nodeAt(line[i]);
            if (a === b) continue;
            connect(a, b);
            segments.push([a, b]);
        }
    });
    if (segments.length === 0) return null;

    // Titik awal dan akhir menjadi simpul sementara di tengah ruas terdekatnya.
    const attach = position => {
        let best = null;
        segments.forEach(segment => {
            const point = closestOnSegment(position, positions[segment[0]], positions[segment[1]]);
            const distance = getDistance(position, point);
            if (!best || distance < best.distance) best = { segment, point, distance };
        });
        const index = positions.length;
        positions.push(best.point);
        neighbours.push([]);
        connect(index, best.segment[0]);
        connect(index, best.segment[1]);
        return { index, segment: best.segment };
    };
    const start = attach(from);
    const end = attach(to);
    // Dua titik di ruas yang sama dihubungkan langsung; kalau tidak, rutenya memutar lewat
    // salah satu ujung ruas itu.
    if (start.segment === end.segment) connect(start.index, end.index);

    // Dijkstra
    const distances = new Array(positions.length).fill(Infinity);
    const previous = new Array(positions.length).fill(-1);
    const queue = createQueue();
    distances[start.index] = 0;
    queue.push(start.index, 0);
    while (queue.size() > 0) {
        const [node, distance] = queue.pop();
        if (distance > distances[node]) continue; // entri usang: simpul ini sudah dicapai lewat jalan yang lebih pendek
        if (node === end.index) break;
        neighbours[node].forEach(([next, length]) => {
            const candidate = distance + length;
            if (candidate < distances[next]) {
                distances[next] = candidate;
                previous[next] = node;
                queue.push(next, candidate);
            }
        });
    }
    if (distances[end.index] === Infinity) return null;

    const coordinates = [];
    for (let node = end.index; node !== -1; node = previous[node]) {
        const position = positions[node];
        const last = coordinates[coordinates.length - 1];
        // Titik tempel yang jatuh tepat di sebuah simpul menghasilkan posisi kembar; satu saja yang dipakai.
        if (!last || last[0] !== position[0] || last[1] !== position[1]) coordinates.push(position);
    }
    // LineString butuh sedikitnya dua posisi, juga saat awal dan akhir menempel di titik yang sama.
    if (coordinates.length === 1) coordinates.push(coordinates[0]);
    coordinates.reverse();

    return {
        type: "Feature",
        properties: { distance: distances[end.index] },
        geometry: { type: "LineString", coordinates }
    };
}
