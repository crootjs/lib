// Modul tambahan untuk map.js: peta dasar dari satu file PMTiles (https://docs.protomaps.com/pmtiles/),
// dari server biasa (dibaca sepotong-sepotong lewat HTTP Range) atau dari file di perangkat
// (<input type="file">) - yang terakhir ini jalan tanpa internet sama sekali.
// Hanya PMTiles versi 3 berisi tile raster (PNG, JPEG, WebP, AVIF); tile vektor belum didukung.
// Tidak mengimpor map.js: hasilnya diberikan ke createMap/setTiles lewat opsi tiles.

const HEADER_BYTES = 127;
const MAX_DEPTH = 4; // root + leaf directory, sesuai spesifikasi paling banyak 3 tingkat
const TILE_TYPES = { 1: "mvt", 2: "image/png", 3: "image/jpeg", 4: "image/webp", 5: "image/avif" };

// Bilangan bulat tanpa tanda varint (LEB128) di posisi state.offset.
function readVarint(bytes, state) {
    let result = 0;
    let shift = 1;
    for (;;) {
        const byte = bytes[state.offset++];
        if (byte === undefined) throw new Error("direktori PMTiles terpotong");
        result += (byte & 0x7f) * shift;
        if (byte < 0x80) return result;
        shift *= 128;
    }
}

// Nomor tile di kurva Hilbert, seperti spesifikasi PMTiles: tile di semua zoom sebelumnya,
// ditambah urutan (x, y) di kurva Hilbert level z.
export function tileId(z, x, y) {
    let id = (Math.pow(4, z) - 1) / 3;
    let tx = x;
    let ty = y;
    for (let s = Math.pow(2, z - 1); s >= 1; s /= 2) {
        const rx = (tx & s) > 0 ? 1 : 0;
        const ry = (ty & s) > 0 ? 1 : 0;
        id += s * s * ((3 * rx) ^ ry);
        if (ry === 0) {
            if (rx === 1) {
                tx = s - 1 - tx;
                ty = s - 1 - ty;
            }
            [tx, ty] = [ty, tx];
        }
    }
    return id;
}

async function decompress(bytes, compression) {
    if (compression === 0 || compression === 1) return bytes; // tidak diketahui / tanpa kompresi
    if (compression === 2) {
        if (typeof DecompressionStream !== "function") throw new Error("browser ini tidak bisa membuka gzip (DecompressionStream)");
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
        return new Uint8Array(await new Response(stream).arrayBuffer());
    }
    throw new Error(`kompresi ${compression === 3 ? "brotli" : compression === 4 ? "zstd" : compression} belum didukung; buat ulang file-nya dengan gzip`);
}

function parseDirectory(bytes) {
    const state = { offset: 0 };
    const count = readVarint(bytes, state);
    const entries = [];
    let id = 0;
    for (let i = 0; i < count; i++) {
        id += readVarint(bytes, state);
        entries.push({ tileId: id, offset: 0, length: 0, runLength: 1 });
    }
    for (let i = 0; i < count; i++) entries[i].runLength = readVarint(bytes, state);
    for (let i = 0; i < count; i++) entries[i].length = readVarint(bytes, state);
    for (let i = 0; i < count; i++) {
        const value = readVarint(bytes, state);
        // 0 = tepat sesudah entri sebelumnya (data berurutan), selain itu offset + 1
        entries[i].offset = value === 0 && i > 0 ? entries[i - 1].offset + entries[i - 1].length : value - 1;
    }
    return entries;
}

// Entri dengan tileId terbesar yang <= id (pencarian biner; entri urut naik).
function findEntry(entries, id) {
    let low = 0;
    let high = entries.length - 1;
    while (low <= high) {
        const middle = (low + high) >> 1;
        const difference = id - entries[middle].tileId;
        if (difference > 0) low = middle + 1;
        else if (difference < 0) high = middle - 1;
        else return entries[middle];
    }
    if (high >= 0) {
        const entry = entries[high];
        // runLength 0 = penunjuk ke leaf directory, yang meliputi semua id sesudahnya
        if (entry.runLength === 0 || id - entry.tileId < entry.runLength) return entry;
    }
    return null;
}

// Pembaca potongan byte: dari Blob/File (offline), atau URL lewat header Range.
function byteReader(source) {
    if (typeof Blob !== "undefined" && source instanceof Blob) {
        return (offset, length) => source.slice(offset, offset + length).arrayBuffer().then(buffer => new Uint8Array(buffer));
    }
    const url = new URL(String(source), location.href).href;
    let whole = null; // server yang mengabaikan Range mengirim seluruh file: disimpan sekali
    return async (offset, length) => {
        if (whole) return whole.subarray(offset, offset + length);
        const response = await fetch(url, { headers: { Range: `bytes=${offset}-${offset + length - 1}` } });
        if (!response.ok) throw new Error(`HTTP ${response.status} saat membaca ${url}`);
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (response.status === 200 && bytes.length > length) {
            whole = bytes;
            return whole.subarray(offset, offset + length);
        }
        return bytes;
    };
}

// Membuka file PMTiles. source: URL (server harus mengizinkan header Range; GitHub Pages,
// Cloudflare R2, S3, dan nginx biasa sudah), atau File/Blob dari <input type="file">.
// responseFunction(archive, error) dipanggil sekali; juga mengembalikan Promise berisi archive
// (atau null kalau gagal - alasannya di error dan console).
// archive = { getTile(z, x, y), minZoom, maxZoom, bounds: [minLng, minLat, maxLng, maxLat],
//             center: [lng, lat], centerZoom, tileType, metadata, attribution }
// archive langsung bisa dipakai sebagai opsi tiles di createMap atau setTiles.
export async function openPMTiles(source, responseFunction) {
    const respond = (archive, error) => {
        if (typeof responseFunction === "function") responseFunction(archive, error);
        return archive;
    };
    try {
        const read = byteReader(source);
        const header = await read(0, HEADER_BYTES);
        const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
        const magic = String.fromCharCode(...header.subarray(0, 7));
        if (magic !== "PMTiles") throw new Error("bukan file PMTiles");
        if (header[7] !== 3) throw new Error(`PMTiles versi ${header[7]} belum didukung (hanya versi 3)`);
        const number = offset => Number(view.getBigUint64(offset, true));
        const info = {
            rootOffset: number(8), rootLength: number(16),
            metadataOffset: number(24), metadataLength: number(32),
            leafOffset: number(40), dataOffset: number(56),
            internalCompression: header[97], tileCompression: header[98], tileType: header[99],
            minZoom: header[100], maxZoom: header[101]
        };
        const mime = TILE_TYPES[info.tileType];
        if (mime === "mvt") throw new Error("file ini berisi tile vektor (MVT), yang belum didukung; pakai PMTiles raster");
        const degrees = offset => view.getInt32(offset, true) / 1e7;

        let metadata = {};
        if (info.metadataLength > 0) {
            const raw = await decompress(await read(info.metadataOffset, info.metadataLength), info.internalCompression);
            try {
                metadata = JSON.parse(new TextDecoder().decode(raw));
            } catch (parseError) {
                metadata = {};
            }
        }

        const directories = new Map(); // offset -> entri, supaya directory yang sama tidak dibaca ulang
        const directory = (offset, length) => {
            if (!directories.has(offset)) {
                directories.set(offset, read(offset, length).then(bytes => decompress(bytes, info.internalCompression)).then(parseDirectory));
            }
            return directories.get(offset);
        };

        const archive = {
            minZoom: info.minZoom,
            maxZoom: info.maxZoom,
            bounds: [degrees(102), degrees(106), degrees(110), degrees(114)],
            center: [degrees(119), degrees(123)],
            centerZoom: header[118],
            tileType: mime || "unknown",
            metadata,
            attribution: typeof metadata.attribution === "string" ? metadata.attribution : null,
            // Blob tile itu, atau null kalau file tidak punya tile di sana.
            async getTile(z, x, y) {
                if (z < info.minZoom || z > info.maxZoom) return null;
                const id = tileId(z, x, y);
                let offset = info.rootOffset;
                let length = info.rootLength;
                for (let depth = 0; depth < MAX_DEPTH; depth++) {
                    const entry = findEntry(await directory(offset, length), id);
                    if (!entry) return null;
                    if (entry.runLength > 0) {
                        const bytes = await decompress(await read(info.dataOffset + entry.offset, entry.length), info.tileCompression);
                        return new Blob([bytes], { type: mime || "application/octet-stream" });
                    }
                    offset = info.leafOffset + entry.offset;
                    length = entry.length;
                }
                return null;
            }
        };
        return respond(archive);
    } catch (error) {
        const name = typeof source === "string" ? source : source && source.name ? source.name : "PMTiles";
        console.warn(`PMTiles "${name}" gagal dibuka: ${error.message}`);
        return respond(null, error.message);
    }
}
