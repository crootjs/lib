// yaml.js - pengurai YAML 1.2 kecil (skema core), cukup untuk berkas konfigurasi dan spesifikasi
// OpenAPI. Didukung: mapping dan sequence blok (termasuk "- key: v" dan sequence yang sejajar
// dengan kuncinya), skalar polos, berkutip tunggal, dan berkutip ganda dengan escape, skalar blok
// | dan > (chomping - dan +, indikator indentasi), koleksi flow [..] dan {..} bersarang, komentar,
// satu dokumen (--- dan ... boleh), anchor &a dan alias *a (alias memakai node yang sama, tidak
// disalin), serta tag inti !!str, !!int, !!float, !!bool, !!null, !!map, !!seq (hanya !!str yang
// berpengaruh: nilainya tetap teks).
// Ditolak dengan SyntaxError: kunci merge "<<", tag lain, kunci kompleks "?", dokumen kedua, kunci
// ganda, dan tab sebagai indentasi. Pesan galat menyebut nomor baris (juga di error.line).
// Pemindaian satu arah per karakter dan sarang dibatasi MAX_DEPTH, jadi masukan jahat tidak
// membuat waktu meledak atau stack habis.

const MAX_DEPTH = 100;
const CORE_TAGS = new Set(["!!str", "!!int", "!!float", "!!bool", "!!null", "!!map", "!!seq"]);
const ESCAPES = {
    "0": "\0", a: "\x07", b: "\b", t: "\t", "\t": "\t", n: "\n", v: "\v", f: "\f", r: "\r", e: "\x1b",
    " ": " ", "\"": "\"", "/": "/", "\\": "\\", N: "\x85", _: "\xa0", L: " ", P: " "
};
const HEX_LENGTH = { x: 2, u: 4, U: 8 };
const FLOW_INDICATORS = ",[]{}";

function resolvePlain(raw) {
    if (/^(?:~|null|Null|NULL)?$/.test(raw)) return null;
    if (/^(?:true|True|TRUE)$/.test(raw)) return true;
    if (/^(?:false|False|FALSE)$/.test(raw)) return false;
    if (/^[-+]?[0-9]+$/.test(raw)) return Number(raw);
    if (/^0o[0-7]+$/.test(raw)) return parseInt(raw.slice(2), 8);
    if (/^0x[0-9a-fA-F]+$/.test(raw)) return parseInt(raw.slice(2), 16);
    if (/^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)(?:[eE][-+]?[0-9]+)?$/.test(raw)) return parseFloat(raw);
    if (/^[-+]?\.(?:inf|Inf|INF)$/.test(raw)) return raw[0] === "-" ? -Infinity : Infinity;
    if (/^\.(?:nan|NaN|NAN)$/.test(raw)) return NaN;
    return raw;
}

// "__proto__" dipasang sebagai properti biasa, bukan lewat setter prototipe, supaya berkas jahat
// tidak bisa mengganti prototipe object hasil.
function setKey(target, key, value) {
    if (key === "__proto__") Object.defineProperty(target, key, { value, enumerable: true, writable: true, configurable: true });
    else target[key] = value;
}

// Mengubah teks YAML menjadi nilai JavaScript. Melempar SyntaxError (dengan error.line) kalau
// teksnya tidak valid atau memakai fitur yang tidak didukung.
export function parseYAML(text) {
    const src = String(text ?? "").replace(/^﻿/, "").replace(/\r\n?/g, "\n");
    const len = src.length;
    const anchors = new Map();
    let pos = 0;

    function fail(message, at = pos) {
        let line = 1;
        for (let i = 0; i < at && i < len; i++) if (src.charCodeAt(i) === 10) line++;
        const error = new SyntaxError(`YAML baris ${line}: ${message}`);
        error.line = line;
        return error;
    }

    const isSep = p => p >= len || src[p] === " " || src[p] === "\t" || src[p] === "\n";
    const atLineEnd = p => p >= len || src[p] === "\n" || src[p] === "#";
    const lineEnd = p => {
        const q = src.indexOf("\n", p);
        return q < 0 ? len : q;
    };
    const nextLine = p => (p < len ? p + 1 : len);
    const indentOf = p => {
        let q = p;
        while (src[q] === " ") q++;
        return q - p;
    };
    const column = p => {
        let q = p;
        while (q > 0 && src[q - 1] !== "\n") q--;
        return p - q;
    };
    const atDocMarker = p => (src.startsWith("---", p) || src.startsWith("...", p)) && isSep(p + 3);
    const skipSpace = () => {
        while (src[pos] === " " || src[pos] === "\t") pos++;
    };

    // Melewati baris kosong dan baris komentar; pos berhenti di awal baris berisi berikutnya.
    function skipBlank() {
        while (pos < len) {
            let q = pos;
            while (src[q] === " " || src[q] === "\t") q++;
            if (q < len && src[q] !== "\n" && src[q] !== "#") {
                if (src.slice(pos, q).includes("\t")) throw fail("tab tidak boleh dipakai untuk indentasi", q);
                return;
            }
            pos = nextLine(lineEnd(q));
        }
    }

    // Sesudah sebuah nilai, sisa barisnya hanya boleh spasi dan komentar.
    function endLine() {
        const before = pos;
        skipSpace();
        if (src[pos] === "#" && (pos > before || src[pos - 1] === "\n")) pos = lineEnd(pos);
        if (pos < len && src[pos] !== "\n") throw fail("ada teks tak terduga sesudah nilai");
        pos = nextLine(pos);
    }

    function readProps() {
        let anchor = null;
        let tag = null;
        for (;;) {
            if (src[pos] === "&") {
                const start = ++pos;
                while (!isSep(pos) && !FLOW_INDICATORS.includes(src[pos])) pos++;
                if (pos === start) throw fail("nama anchor kosong");
                anchor = src.slice(start, pos);
            } else if (src[pos] === "!") {
                const start = pos;
                while (!isSep(pos)) pos++;
                tag = src.slice(start, pos);
                if (!CORE_TAGS.has(tag)) throw fail(`tag ${tag} tidak didukung`, start);
            } else {
                return { anchor, tag };
            }
            skipSpace();
        }
    }

    function readAlias() {
        const start = ++pos;
        while (!isSep(pos) && !FLOW_INDICATORS.includes(src[pos])) pos++;
        const name = src.slice(start, pos);
        if (!anchors.has(name)) throw fail(`alias *${name} belum didefinisikan`, start - 1);
        return anchors.get(name);
    }

    // Kunci mapping di p: teks berkutip atau polos yang diikuti ":" dan spasi/akhir baris.
    // Mengembalikan { key, end } (end = sesudah ":") atau null kalau ini bukan pasangan key: value.
    function scanKey(p) {
        const ch = src[p];
        if (ch === "\"" || ch === "'") {
            let q = p + 1;
            for (;;) {
                if (q >= len || src[q] === "\n") return null;
                if (src[q] === ch) {
                    if (ch === "'" && src[q + 1] === "'") {
                        q += 2;
                        continue;
                    }
                    break;
                }
                q += ch === "\"" && src[q] === "\\" ? 2 : 1;
            }
            let r = q + 1;
            while (src[r] === " " || src[r] === "\t") r++;
            if (src[r] !== ":" || !isSep(r + 1)) return null;
            const saved = pos;
            pos = p;
            const key = parseQuoted();
            pos = saved;
            return { key, end: r + 1 };
        }
        if (ch === "?" && isSep(p + 1)) throw fail("kunci kompleks (?) tidak didukung", p);
        if ("[]{},#&*!|>%@`".includes(ch) || ((ch === "-" || ch === ":") && isSep(p + 1))) return null;
        for (let q = p; q < len && src[q] !== "\n"; q++) {
            if (src[q] === ":" && isSep(q + 1)) return { key: src.slice(p, q).trimEnd(), end: q + 1 };
            if (src[q] === "#" && (src[q - 1] === " " || src[q - 1] === "\t")) return null;
        }
        return null;
    }

    // Node di baris-baris berikutnya yang menjorok lebih dari parent. mapValue: sequence boleh
    // sejajar dengan kuncinya ("key:\n- a"), bentuk yang umum di berkas OpenAPI.
    function nextLines(parent, depth, mapValue) {
        skipBlank();
        if (pos >= len || atDocMarker(pos)) return null;
        const ind = indentOf(pos);
        if (ind > parent) return parseNode(pos + ind, parent, depth, false);
        if (mapValue && ind === parent && src[pos + ind] === "-" && isSep(pos + ind + 1)) return parseSeq(pos + ind, ind, depth);
        return null;
    }

    // Node yang dimulai di p. inValue: nilai sesudah "key: " di baris yang sama, tempat mapping
    // atau sequence blok tidak boleh dimulai.
    function parseNode(p, parent, depth, inValue) {
        if (depth > MAX_DEPTH) throw fail("struktur bersarang terlalu dalam", p);
        pos = p;
        const { anchor, tag } = readProps();
        let value;
        if ((anchor || tag) && atLineEnd(pos)) {
            endLine();
            value = nextLines(parent, depth + 1, inValue);
        } else {
            value = parseContent(parent, depth, inValue, tag);
        }
        if (anchor) anchors.set(anchor, value);
        return value;
    }

    function parseContent(parent, depth, inValue, tag) {
        const ch = src[pos];
        if (ch === "*") {
            const value = readAlias();
            endLine();
            return value;
        }
        if (ch === "[" || ch === "{") {
            const value = parseFlow(depth);
            endLine();
            return value;
        }
        if (ch === "|" || ch === ">") return parseBlockScalar(parent);
        if (!inValue) {
            if (ch === "-" && isSep(pos + 1)) return parseSeq(pos, column(pos), depth);
            if (scanKey(pos)) return parseMap(pos, column(pos), depth);
        }
        if (ch === "\"" || ch === "'") {
            const value = parseQuoted();
            endLine();
            return value;
        }
        if ("]},%@`".includes(ch) || ((ch === "-" || ch === "?" || ch === ":") && isSep(pos + 1))) {
            throw fail(`"${ch}" tidak boleh mengawali nilai; beri tanda kutip`);
        }
        const raw = parsePlain(parent);
        return tag === "!!str" ? raw : resolvePlain(raw);
    }

    function parseSeq(p, col, depth) {
        const list = [];
        pos = p;
        for (;;) {
            pos++;
            skipSpace();
            if (atLineEnd(pos)) {
                endLine();
                list.push(nextLines(col, depth + 1, false));
            } else {
                list.push(parseNode(pos, col, depth + 1, false));
            }
            skipBlank();
            if (pos >= len || atDocMarker(pos)) break;
            const ind = indentOf(pos);
            if (ind > col) throw fail("indentasi tidak sesuai", pos + ind);
            if (ind < col || src[pos + ind] !== "-" || !isSep(pos + ind + 1)) break;
            pos += ind;
        }
        return list;
    }

    function parseMap(p, col, depth) {
        const map = {};
        pos = p;
        for (;;) {
            const found = scanKey(pos);
            if (!found) throw fail("diharapkan pasangan key: value");
            const key = found.key;
            if (key === "<<") throw fail("kunci merge << tidak didukung");
            if (Object.prototype.hasOwnProperty.call(map, key)) throw fail(`kunci "${key}" ganda`);
            pos = found.end;
            skipSpace();
            let value;
            if (atLineEnd(pos)) {
                endLine();
                value = nextLines(col, depth + 1, true);
            } else {
                value = parseNode(pos, col, depth + 1, true);
            }
            setKey(map, key, value);
            skipBlank();
            if (pos >= len || atDocMarker(pos)) break;
            const ind = indentOf(pos);
            if (ind > col) throw fail("indentasi tidak sesuai", pos + ind);
            if (ind < col) break;
            pos += ind;
        }
        return map;
    }

    function scanPlainLine() {
        const start = pos;
        while (pos < len && src[pos] !== "\n") {
            if (src[pos] === ":" && isSep(pos + 1)) throw fail("\": \" di dalam nilai polos; beri tanda kutip");
            if (src[pos] === "#" && (src[pos - 1] === " " || src[pos - 1] === "\t")) break;
            pos++;
        }
        return src.slice(start, pos).trim();
    }

    // Skalar polos boleh berlanjut ke baris yang menjorok lebih dari parent: pindah baris dilipat
    // jadi spasi, baris kosong jadi "\n". Komentar mengakhiri skalar.
    function parsePlain(parent) {
        let text = scanPlainLine();
        while (pos < len && src[pos] !== "#") {
            let lineStart = pos + 1;
            let empty = 0;
            let q;
            for (;;) {
                q = lineStart;
                while (src[q] === " " || src[q] === "\t") q++;
                if (q < len && src[q] === "\n") {
                    empty++;
                    lineStart = q + 1;
                } else {
                    break;
                }
            }
            if (q >= len || src[q] === "#" || q - lineStart <= parent || atDocMarker(lineStart)) break;
            pos = q;
            text += (empty ? "\n".repeat(empty) : " ") + scanPlainLine();
        }
        if (src[pos] === "#") pos = lineEnd(pos);
        pos = nextLine(pos);
        return text;
    }

    function parseQuoted() {
        const start = pos;
        const quote = src[pos++];
        let out = "";
        // Panjang out yang berasal dari escape: spasi hasil escape tidak ikut dipangkas saat dilipat.
        let keep = 0;
        for (;;) {
            if (pos >= len) throw fail("teks berkutip tidak ditutup", start);
            const ch = src[pos];
            if (ch === quote) {
                if (quote === "'" && src[pos + 1] === "'") {
                    out += "'";
                    pos += 2;
                    continue;
                }
                pos++;
                return out;
            }
            if (ch === "\n") {
                let end = out.length;
                while (end > keep && (out[end - 1] === " " || out[end - 1] === "\t")) end--;
                out = out.slice(0, end);
                let breaks = 0;
                while (pos < len && (src[pos] === "\n" || src[pos] === " " || src[pos] === "\t")) {
                    if (src[pos] === "\n") breaks++;
                    pos++;
                }
                out += breaks > 1 ? "\n".repeat(breaks - 1) : " ";
                continue;
            }
            if (ch === "\\" && quote === "\"") {
                const code = src[pos + 1];
                if (code === "\n") {
                    pos += 2;
                    skipSpace();
                } else if (HEX_LENGTH[code]) {
                    const hex = src.slice(pos + 2, pos + 2 + HEX_LENGTH[code]);
                    const value = /^[0-9a-fA-F]+$/.test(hex) && hex.length === HEX_LENGTH[code] ? parseInt(hex, 16) : -1;
                    if (value < 0 || value > 0x10ffff) throw fail(`escape \\${code} tidak valid`);
                    out += String.fromCodePoint(value);
                    pos += 2 + hex.length;
                } else if (Object.prototype.hasOwnProperty.call(ESCAPES, code)) {
                    out += ESCAPES[code];
                    pos += 2;
                } else {
                    throw fail(`escape \\${code ?? ""} tidak dikenal`);
                }
                keep = out.length;
                continue;
            }
            out += ch;
            pos++;
        }
    }

    function parseBlockScalar(parent) {
        const folded = src[pos++] === ">";
        let chomp = "";
        let explicit = 0;
        for (let i = 0; i < 2; i++) {
            if ((src[pos] === "-" || src[pos] === "+") && !chomp) chomp = src[pos++];
            else if (src[pos] >= "1" && src[pos] <= "9" && !explicit) explicit = Number(src[pos++]);
        }
        if (!isSep(pos)) throw fail("header skalar blok tidak valid");
        endLine();
        let indent = explicit ? parent + explicit : null;
        const lines = [];
        while (pos < len) {
            const ind = indentOf(pos);
            const end = lineEnd(pos);
            // Baris yang hanya berisi spasi termasuk skalar di indentasi berapa pun.
            if (pos + ind < end) {
                if (indent === null) {
                    if (ind <= parent) break;
                    indent = ind;
                }
                if (ind < indent || ind === 0 && atDocMarker(pos)) break;
            }
            lines.push(src.slice(pos, end));
            pos = nextLine(end);
        }
        const body = lines.map(line => line.slice(indent ?? 0));
        let count = body.length;
        while (count > 0 && !body[count - 1].trim()) count--;
        const trailing = body.length - count;
        let text;
        if (!folded) {
            text = body.slice(0, count).join("\n");
        } else {
            // Baris biasa yang berurutan digabung dengan spasi; baris yang lebih menjorok dan baris
            // kosong mempertahankan pindah barisnya.
            text = "";
            let empty = 0;
            let first = true;
            let previousMore = false;
            for (const line of body.slice(0, count)) {
                if (line === "") {
                    empty++;
                    continue;
                }
                const more = line[0] === " " || line[0] === "\t";
                if (first) text += "\n".repeat(empty);
                else if (more || previousMore) text += "\n".repeat(empty + 1);
                else text += empty ? "\n".repeat(empty) : " ";
                text += line;
                empty = 0;
                first = false;
                previousMore = more;
            }
        }
        if (chomp === "-") return text;
        if (chomp === "+") return count ? `${text}\n${"\n".repeat(trailing)}` : "\n".repeat(trailing);
        return count ? text + "\n" : "";
    }

    function skipFlowSpace() {
        for (;;) {
            if (pos >= len) throw fail("koleksi flow tidak ditutup");
            const ch = src[pos];
            if (ch === " " || ch === "\t" || ch === "\n") pos++;
            else if (ch === "#" && /[ \t\n]/.test(src[pos - 1])) pos = lineEnd(pos);
            else return;
        }
    }

    function parseFlowItem(depth, asKey) {
        const { anchor, tag } = readProps();
        const ch = src[pos];
        let value;
        if (ch === "[" || ch === "{") {
            value = parseFlow(depth + 1);
        } else if (ch === "\"" || ch === "'") {
            value = parseQuoted();
        } else if (ch === "*") {
            value = readAlias();
        } else {
            const start = pos;
            while (pos < len && !FLOW_INDICATORS.includes(src[pos])) {
                if (src[pos] === ":" && (isSep(pos + 1) || FLOW_INDICATORS.includes(src[pos + 1]))) break;
                if (src[pos] === "#" && /[ \t\n]/.test(src[pos - 1])) break;
                pos++;
            }
            const raw = src.slice(start, pos).split("\n").map(part => part.trim()).filter(Boolean).join(" ");
            if (!raw) {
                if (anchor || tag) value = null;
                else throw fail("nilai kosong di koleksi flow");
            } else {
                value = asKey || tag === "!!str" ? raw : resolvePlain(raw);
            }
        }
        if (anchor) anchors.set(anchor, value);
        return value;
    }

    function parseFlow(depth) {
        if (depth > MAX_DEPTH) throw fail("struktur bersarang terlalu dalam");
        const open = src[pos++];
        const close = open === "[" ? "]" : "}";
        const result = open === "[" ? [] : {};
        for (;;) {
            skipFlowSpace();
            if (src[pos] === close) {
                pos++;
                return result;
            }
            const item = parseFlowItem(depth, open === "{");
            skipFlowSpace();
            let pair = false;
            let value = null;
            if (src[pos] === ":") {
                pair = true;
                pos++;
                skipFlowSpace();
                if (src[pos] !== "," && src[pos] !== close) value = parseFlowItem(depth, false);
                skipFlowSpace();
            }
            if (open === "{") {
                const key = String(item);
                if (Object.prototype.hasOwnProperty.call(result, key)) throw fail(`kunci "${key}" ganda`);
                setKey(result, key, value);
            } else if (pair) {
                const entry = {};
                setKey(entry, String(item), value);
                result.push(entry);
            } else {
                result.push(item);
            }
            if (src[pos] === ",") pos++;
            else if (src[pos] !== close) throw fail(`diharapkan "," atau "${close}"`);
        }
    }

    skipBlank();
    while (src[pos] === "%") {
        pos = nextLine(lineEnd(pos));
        skipBlank();
    }
    let value;
    if (src.startsWith("---", pos) && isSep(pos + 3)) {
        pos += 3;
        skipSpace();
        if (atLineEnd(pos)) {
            endLine();
            value = nextLines(-1, 0, false);
        } else {
            value = parseNode(pos, -1, 0, true);
        }
    } else {
        value = nextLines(-1, 0, false);
    }
    skipBlank();
    if (src.startsWith("...", pos) && isSep(pos + 3)) {
        pos += 3;
        endLine();
        skipBlank();
    }
    if (pos < len) throw fail(atDocMarker(pos) ? "hanya satu dokumen YAML yang didukung" : "teks tak terduga");
    return value;
}
