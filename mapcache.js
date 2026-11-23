// Modul tambahan untuk map.js: peta dasar yang tetap tampil tanpa internet di area yang pernah
// dilihat. Setiap tile yang dimuat disimpan di Cache Storage browser; saat offline (atau server
// tile tidak menjawab) tile dari cache yang dipakai.
// Tanpa Service Worker: file Service Worker harus berada di domain situs sendiri, tidak bisa
// diimpor dari jsDelivr. Akibatnya halamannya sendiri tetap harus bisa dibuka (misalnya dari
// cache browser, aplikasi WebView, atau PWA milik Anda); yang dijamin modul ini adalah tile-nya.
// Cache Storage hanya ada di https dan localhost.
// Tidak mengimpor map.js: hasilnya diberikan ke createMap/setTiles lewat opsi tiles.

const OSM_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TIMEOUT_MS = 15000;
const TRIM_EVERY = 50;        // cache dirapikan setiap sekian tile baru
const MAX_DOWNLOAD = 10000;   // batas jumlah tile untuk downloadArea
const SAVED_AT = "X-CrootJS-Saved-At";

function tileURL(template, subdomains, z, x, y) {
    return template
        .replace(/\{s\}/g, subdomains.length ? subdomains[Math.abs(x + y) % subdomains.length] : "")
        .replace(/\{r\}/g, "")
        .replace(/\{z\}/g, z)
        .replace(/\{x\}/g, x)
        .replace(/\{-y\}/g, Math.pow(2, z) - 1 - y)
        .replace(/\{y\}/g, y);
}

// Tile di dalam bounds [minLng, minLat, maxLng, maxLat] pada zoom z (proyeksi Web Mercator).
function tileRange(bounds, z) {
    const n = Math.pow(2, z);
    const column = lng => Math.min(n - 1, Math.max(0, Math.floor((lng + 180) / 360 * n)));
    const row = lat => {
        const clamped = Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI / 180;
        return Math.min(n - 1, Math.max(0, Math.floor((1 - Math.log(Math.tan(clamped) + 1 / Math.cos(clamped)) / Math.PI) / 2 * n)));
    };
    return { minX: column(bounds[0]), maxX: column(bounds[2]), minY: row(bounds[3]), maxY: row(bounds[1]) };
}

// Sumber tile yang tersimpan di cache. template: pola URL seperti opsi tiles di createMap
// ({z}, {x}, {y}, {s}, {-y}); bawaan OpenStreetMap. Server tile-nya harus mengizinkan CORS
// (OpenStreetMap dan Esri mengizinkan).
// options (semua opsional):
//   name         nama cache. Bawaan "crootjs-tiles"; bedakan untuk tiap peta dasar.
//   maxAge       hari sebelum tile dianggap lama dan diambil ulang saat online. Bawaan 7
//                (paling sedikit 7 untuk server OpenStreetMap, sesuai kebijakannya).
//   maxTiles     tile terbanyak yang disimpan; yang paling lama dibuang. Bawaan 5000.
//   subdomains   sama dengan opsi createMap. Bawaan ["a", "b", "c"].
//   attribution  atribusi peta dasar (teks atau elemen). Untuk template bawaan, map.js
//                memasang atribusi OpenStreetMap sendiri.
// Mengembalikan { getTile(z, x, y), url, attribution, count(), clear(), downloadArea(...) },
// yang langsung bisa dipakai sebagai opsi tiles di createMap atau setTiles. Di browser tanpa
// Cache Storage, getTile memberi URL tile biasa (tanpa cache) dan peringatan di console.
export function cachedTiles(template = OSM_TILES, options = {}) {
    const name = options.name || "crootjs-tiles";
    const maxAge = (Number.isFinite(options.maxAge) ? options.maxAge : 7) * 86400000;
    const maxTiles = Number.isFinite(options.maxTiles) ? options.maxTiles : 5000;
    const subdomains = [].concat(options.subdomains === undefined ? ["a", "b", "c"] : options.subdomains);
    const supported = typeof caches !== "undefined";
    if (!supported) console.warn("Cache Storage tidak tersedia (perlu https atau localhost): tile tidak disimpan untuk offline.");
    let added = 0;
    let opening = null;
    const open = () => {
        opening = opening || caches.open(name);
        return opening;
    };

    const trim = async cache => {
        const keys = await cache.keys();
        // Urutan keys() = urutan disimpan, jadi yang terdepan paling lama.
        await Promise.all(keys.slice(0, Math.max(0, keys.length - maxTiles)).map(request => cache.delete(request)));
    };

    // Mengambil satu tile dari server lalu menyimpannya; null kalau gagal.
    const fetchAndStore = async (cache, url) => {
        const response = await fetch(url, { mode: "cors", signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (!response.ok) return { status: response.status, blob: null };
        const blob = await response.blob();
        // Waktu simpan dicatat di header sendiri; header Date server tidak selalu bisa dibaca.
        await cache.put(url, new Response(blob, { headers: { "Content-Type": blob.type, [SAVED_AT]: String(Date.now()) } }));
        if (++added % TRIM_EVERY === 0) await trim(cache);
        return { status: response.status, blob };
    };

    const source = {
        url: template,
        // map.js memasang atribusi OpenStreetMap (dengan tautan) sendiri kalau url-nya server OSM.
        attribution: options.attribution === undefined ? null : options.attribution,

        // Blob tile, URL biasa (browser tanpa Cache Storage), atau null kalau tidak ada.
        async getTile(z, x, y) {
            const url = tileURL(template, subdomains, z, x, y);
            if (!supported) return url;
            const cache = await open();
            const stored = await cache.match(url);
            const fresh = stored && Date.now() - Number(stored.headers.get(SAVED_AT) || 0) < maxAge;
            if (fresh || (stored && navigator.onLine === false)) return stored.blob();
            try {
                const { blob } = await fetchAndStore(cache, url);
                if (blob) return blob;
            } catch (error) {
                // offline atau server tidak menjawab: tile lama (kalau ada) lebih baik daripada kosong
            }
            return stored ? stored.blob() : null;
        },

        // Jumlah tile yang tersimpan.
        async count() {
            if (!supported) return 0;
            return (await (await open()).keys()).length;
        },

        // Menghapus semua tile yang tersimpan di cache ini.
        async clear() {
            if (!supported) return false;
            opening = null;
            return caches.delete(name);
        },

        // Mengunduh semua tile di bounds [minLng, minLat, maxLng, maxLat] dari minZoom sampai
        // maxZoom lebih dulu, misalnya sebelum ke lapangan. Hanya untuk server tile sendiri:
        // kebijakan OpenStreetMap melarang unduhan massal dari tile.openstreetmap.org, jadi
        // template bawaan ditolak. Paling banyak 10000 tile per panggilan.
        // onProgress(done, total) dipanggil setiap tile selesai.
        // Mengembalikan Promise { total, saved, failed, error } - error berisi alasan kalau
        // ditolak sebelum mulai.
        async downloadArea(bounds, minZoom, maxZoom, onProgress) {
            const refuse = error => {
                console.warn(`downloadArea: ${error}`);
                return { total: 0, saved: 0, failed: 0, error };
            };
            if (!supported) return refuse("Cache Storage tidak tersedia (perlu https atau localhost).");
            if (/(^|\.)openstreetmap\.org\//.test(template.replace(/^https?:\/\/(\{s\}\.)?/, ""))) {
                return refuse("kebijakan OpenStreetMap melarang unduhan massal dari server tile-nya; pakai server tile sendiri atau penyedia yang mengizinkan.");
            }
            const jobs = [];
            for (let z = Math.max(0, Math.floor(minZoom)); z <= Math.floor(maxZoom); z++) {
                const range = tileRange(bounds, z);
                for (let x = range.minX; x <= range.maxX; x++) {
                    for (let y = range.minY; y <= range.maxY; y++) jobs.push([z, x, y]);
                }
                if (jobs.length > MAX_DOWNLOAD) break;
            }
            if (jobs.length > MAX_DOWNLOAD) return refuse(`lebih dari ${MAX_DOWNLOAD} tile; perkecil area atau maxZoom.`);
            const total = jobs.length;
            const cache = await open();
            let done = 0;
            let saved = 0;
            let failed = 0;
            // Enam unduhan sekaligus, sesuai batas koneksi browser per server.
            const worker = async () => {
                while (jobs.length) {
                    const [z, x, y] = jobs.shift();
                    try {
                        const { blob } = await fetchAndStore(cache, tileURL(template, subdomains, z, x, y));
                        if (blob) saved++;
                        else failed++;
                    } catch (error) {
                        failed++;
                    }
                    done++;
                    if (typeof onProgress === "function") onProgress(done, total);
                }
            };
            await Promise.all(Array.from({ length: Math.min(6, total) }, worker));
            return { total, saved, failed, error: null };
        }
    };
    return source;
}
