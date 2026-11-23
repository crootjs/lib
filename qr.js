// qr.js - pembuat kode QR (ISO/IEC 18004) yang ditulis sendiri, keluarannya SVG.
// Teks dikodekan sebagai byte UTF-8, versi 1-40 dipilih otomatis (yang terkecil
// yang muat), dan pola mask dipilih dengan aturan penalti dari standar.

const LEVELS = {
    // [bit format, kode koreksi per blok (indeks = versi), jumlah blok]
    L: [1,
        [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
        [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25]],
    M: [0,
        [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
        [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49]],
    Q: [3,
        [0, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
        [0, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68]],
    H: [2,
        [0, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
        [0, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81]],
};

const bit = (value, index) => ((value >>> index) & 1) !== 0;

// Jumlah modul untuk data dan koreksi (di luar pola tetap) pada satu versi.
function rawModules(version) {
    let result = (16 * version + 128) * version + 64;
    if (version >= 2) {
        const align = Math.floor(version / 7) + 2;
        result -= (25 * align - 10) * align - 55;
        if (version >= 7) result -= 36;
    }
    return result;
}

function dataCodewords(version, level) {
    const [, ecc, blocks] = LEVELS[level];
    return Math.floor(rawModules(version) / 8) - ecc[version] * blocks[version];
}

// Perkalian di GF(2^8) dengan polinom 0x11D.
function multiply(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i--) {
        z = (z << 1) ^ ((z >>> 7) * 0x11d);
        z ^= ((y >>> i) & 1) * x;
    }
    return z;
}

function divisor(degree) {
    const result = new Array(degree).fill(0);
    result[degree - 1] = 1;
    let root = 1;
    for (let i = 0; i < degree; i++) {
        for (let j = 0; j < degree; j++) {
            result[j] = multiply(result[j], root);
            if (j + 1 < degree) result[j] ^= result[j + 1];
        }
        root = multiply(root, 2);
    }
    return result;
}

function remainder(data, div) {
    const result = div.map(() => 0);
    for (const value of data) {
        const factor = value ^ result.shift();
        result.push(0);
        div.forEach((coefficient, i) => { result[i] ^= multiply(coefficient, factor); });
    }
    return result;
}

// Data dibagi ke beberapa blok, masing-masing diberi kode Reed-Solomon, lalu
// disisipkan selang-seling supaya kerusakan di satu tempat tersebar ke banyak blok.
function withErrorCorrection(data, version, level) {
    const [, eccTable, blockTable] = LEVELS[level];
    const blocks = blockTable[version];
    const eccLength = eccTable[version];
    const total = Math.floor(rawModules(version) / 8);
    const shortBlocks = blocks - (total % blocks);
    const shortLength = Math.floor(total / blocks);
    const div = divisor(eccLength);
    const all = [];
    for (let i = 0, k = 0; i < blocks; i++) {
        const block = data.slice(k, k + shortLength - eccLength + (i < shortBlocks ? 0 : 1));
        k += block.length;
        const ecc = remainder(block, div);
        if (i < shortBlocks) block.push(0);
        all.push(block.concat(ecc));
    }
    const result = [];
    for (let i = 0; i < all[0].length; i++) {
        all.forEach((block, j) => {
            if (i !== shortLength - eccLength || j >= shortBlocks) result.push(block[i]);
        });
    }
    return result;
}

function encode(bytes, level) {
    let version = 1;
    for (; version <= 40; version++) {
        const countBits = version < 10 ? 8 : 16;
        if (4 + countBits + bytes.length * 8 <= dataCodewords(version, level) * 8) break;
    }
    if (version > 40) throw new RangeError("Teks terlalu panjang untuk satu kode QR");

    const bits = [];
    const put = (value, length) => { for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1); };
    put(4, 4); // mode byte
    put(bytes.length, version < 10 ? 8 : 16);
    bytes.forEach(value => put(value, 8));
    const capacity = dataCodewords(version, level) * 8;
    put(0, Math.min(4, capacity - bits.length));
    put(0, (8 - (bits.length % 8)) % 8);
    for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) put(pad, 8);

    const codewords = [];
    for (let i = 0; i < bits.length; i += 8) codewords.push(parseInt(bits.slice(i, i + 8).join(""), 2));
    return { version, codewords: withErrorCorrection(codewords, version, level) };
}

function alignmentPositions(version, size) {
    if (version === 1) return [];
    const count = Math.floor(version / 7) + 2;
    const step = Math.floor((version * 8 + count * 3 + 5) / (count * 4 - 4)) * 2;
    const result = [6];
    for (let position = size - 7; result.length < count; position -= step) result.splice(1, 0, position);
    return result;
}

const MASKS = [
    (x, y) => (x + y) % 2 === 0,
    (x, y) => y % 2 === 0,
    (x) => x % 3 === 0,
    (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
    (x, y) => (x * y) % 2 + (x * y) % 3 === 0,
    (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0,
    (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0,
];

function build(version, level, codewords) {
    const size = version * 4 + 17;
    const modules = Array.from({ length: size }, () => new Array(size).fill(false));
    const fixed = Array.from({ length: size }, () => new Array(size).fill(false));
    const set = (x, y, dark) => { modules[y][x] = dark; fixed[y][x] = true; };

    for (let i = 0; i < size; i++) {
        set(6, i, i % 2 === 0);
        set(i, 6, i % 2 === 0);
    }
    [[3, 3], [size - 4, 3], [3, size - 4]].forEach(([cx, cy]) => {
        for (let dy = -4; dy <= 4; dy++) {
            for (let dx = -4; dx <= 4; dx++) {
                const x = cx + dx, y = cy + dy;
                const distance = Math.max(Math.abs(dx), Math.abs(dy));
                if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, distance !== 2 && distance !== 4);
            }
        }
    });
    const aligns = alignmentPositions(version, size);
    aligns.forEach((cy, i) => aligns.forEach((cx, j) => {
        const last = aligns.length - 1;
        if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
        for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
    }));

    const drawFormat = mask => {
        const data = (LEVELS[level][0] << 3) | mask;
        let rem = data;
        for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
        const bits = ((data << 10) | rem) ^ 0x5412;
        for (let i = 0; i <= 5; i++) set(8, i, bit(bits, i));
        set(8, 7, bit(bits, 6));
        set(8, 8, bit(bits, 7));
        set(7, 8, bit(bits, 8));
        for (let i = 9; i < 15; i++) set(14 - i, 8, bit(bits, i));
        for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(bits, i));
        for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(bits, i));
        set(8, size - 8, true);
    };
    drawFormat(0); // menandai area format sebagai pola tetap sebelum data ditulis

    if (version >= 7) {
        let rem = version;
        for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
        const bits = (version << 12) | rem;
        for (let i = 0; i < 18; i++) {
            const a = size - 11 + (i % 3), b = Math.floor(i / 3);
            set(a, b, bit(bits, i));
            set(b, a, bit(bits, i));
        }
    }

    // Data ditulis zig-zag dua kolom sekaligus dari kanan bawah, melompati kolom timing.
    let index = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
        if (right === 6) right = 5;
        for (let vertical = 0; vertical < size; vertical++) {
            for (let j = 0; j < 2; j++) {
                const x = right - j;
                const y = ((right + 1) & 2) === 0 ? size - 1 - vertical : vertical;
                if (!fixed[y][x] && index < codewords.length * 8) {
                    modules[y][x] = bit(codewords[index >>> 3], 7 - (index & 7));
                    index++;
                }
            }
        }
    }

    const applyMask = mask => {
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                if (!fixed[y][x] && MASKS[mask](x, y)) modules[y][x] = !modules[y][x];
            }
        }
    };
    let best = 0, lowest = Infinity;
    for (let mask = 0; mask < 8; mask++) {
        applyMask(mask);
        drawFormat(mask);
        const score = penalty(modules);
        if (score < lowest) { best = mask; lowest = score; }
        applyMask(mask); // XOR lagi = kembali seperti semula
    }
    applyMask(best);
    drawFormat(best);
    return modules;
}

// Penalti mask (ISO/IEC 18004 bagian 7.8.3): deretan warna sama, blok 2x2,
// pola mirip penanda sudut, dan ketidakseimbangan gelap-terang.
function penalty(modules) {
    const size = modules.length;
    let result = 0;
    const addHistory = (length, history) => {
        if (history[0] === 0) length += size;
        history.pop();
        history.unshift(length);
    };
    const countFinders = history => {
        const n = history[1];
        const core = n > 0 && history[2] === n && history[3] === n * 3 && history[4] === n && history[5] === n;
        return (core && history[0] >= n * 4 && history[6] >= n ? 1 : 0) + (core && history[6] >= n * 4 && history[0] >= n ? 1 : 0);
    };
    const line = read => {
        let color = false, run = 0;
        const history = [0, 0, 0, 0, 0, 0, 0];
        for (let i = 0; i < size; i++) {
            if (read(i) === color) {
                run++;
                if (run === 5) result += 3;
                else if (run > 5) result++;
            } else {
                addHistory(run, history);
                if (!color) result += countFinders(history) * 40;
                color = read(i);
                run = 1;
            }
        }
        if (color) {
            addHistory(run, history);
            run = 0;
        }
        addHistory(run + size, history);
        result += countFinders(history) * 40;
    };
    for (let i = 0; i < size; i++) {
        line(x => modules[i][x]);
        line(y => modules[y][i]);
    }
    let dark = 0;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            if (modules[y][x]) dark++;
            if (y < size - 1 && x < size - 1) {
                const c = modules[y][x];
                if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) result += 3;
            }
        }
    }
    const total = size * size;
    result += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
    return result;
}

// Matriks modul QR: array baris berisi true (gelap) / false (terang), tanpa margin.
// ecc: "L" (7%), "M" (15%, bawaan), "Q" (25%), "H" (30% bagian boleh rusak/tertutup).
export function qrMatrix(text, options = {}) {
    const level = String(options.ecc || "M").toUpperCase();
    if (!LEVELS[level]) throw new RangeError(`ecc harus L, M, Q, atau H, bukan "${options.ecc}"`);
    const { version, codewords } = encode(Array.from(new TextEncoder().encode(String(text))), level);
    return build(version, level, codewords);
}

const escapeXML = text => String(text).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// Kode QR sebagai teks SVG. Satu <path> untuk semua modul gelap, jadi ringan
// dan tajam di ukuran berapa pun; ukurannya diatur lewat CSS (width).
// options: ecc, margin (modul, bawaan 4 sesuai standar), color, background, label.
export function qrSVG(text, options = {}) {
    const modules = qrMatrix(text, options);
    const margin = options.margin ?? 4;
    const full = modules.length + margin * 2;
    let path = "";
    modules.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
            if (!row[x]) continue;
            const start = x;
            while (x + 1 < row.length && row[x + 1]) x++;
            path += `M${start + margin} ${y + margin}h${x - start + 1}v1h${start - x - 1}z`;
        }
    });
    const label = options.label ?? text;
    const background = options.background ?? "#fff";
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${full} ${full}" shape-rendering="crispEdges" role="img" aria-label="${escapeXML(label)}">`
        + (background === "transparent" ? "" : `<rect width="${full}" height="${full}" fill="${escapeXML(background)}"/>`)
        + `<path fill="${escapeXML(options.color ?? "#000")}" d="${path}"/></svg>`;
}

// Mengganti isi elemen dengan kode QR. Mengembalikan elemen <svg>-nya.
export function renderQR(id, text, options = {}) {
    const element = document.getElementById(id);
    element.innerHTML = qrSVG(text, options);
    return element.firstElementChild;
}
