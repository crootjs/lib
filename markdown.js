// markdown.js - mengubah Markdown (subset CommonMark + GFM) menjadi HTML yang aman.
// Semua HTML mentah di masukan di-escape; tidak ada mode yang mengizinkannya. URL tautan dan
// gambar hanya http(s), mailto, tel, relatif, atau #anchor. Pengurai ditulis tangan dengan
// pemindaian karakter (bukan regex bertumpuk) supaya waktunya tetap linear untuk masukan jahat.

// Batas sarang kutipan/daftar. Lebih dalam dari ini, penanda dibaca sebagai teks biasa; tanpa
// batas, ">" sepanjang 50.000 karakter akan menghabiskan stack rekursi.
const MAX_DEPTH = 32;
// Batas kurung di tujuan tautan, seperti yang diizinkan CommonMark, supaya pemindaian "](" yang
// gagal tidak berjalan sampai akhir teks berulang kali.
const MAX_PARENS = 32;
// Sel kosong yang ditambahkan ke baris tabel yang kurang sel. Tanpa batas, satu baris judul
// dengan ribuan kolom diikuti ribuan baris pendek menghasilkan HTML berukuran kuadrat.
const MAX_FILLER_CELLS = 100000;

const ENTITIES = {
    amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ", colon: ":", tab: "\t",
    newline: "\n", copy: "©", reg: "®", trade: "™", hellip: "…", mdash: "—", ndash: "–",
    lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", laquo: "«", raquo: "»", times: "×",
    divide: "÷", deg: "°", plusmn: "±", middot: "·", bull: "•", euro: "€", larr: "←", rarr: "→"
};

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" };

function escapeHTML(text) {
    return text.replace(/[&<>"']/g, ch => ESCAPES[ch]);
}

function isPunct(ch) {
    return /[\p{P}\p{S}]/u.test(ch);
}

function isSpace(ch) {
    return ch === undefined || /\s/.test(ch);
}

function isAsciiPunct(ch) {
    return ch !== undefined && /[!-/:-@[-`{-~]/.test(ch);
}

function fromCodePoint(code) {
    return code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff) ? "�" : String.fromCodePoint(code);
}

// Escape backslash dan entitas dalam satu lintasan, untuk URL, judul tautan, dan info blok kode.
// Entitas bernama yang tidak dikenal dibiarkan apa adanya; nanti "&"-nya di-escape sehingga
// browser tidak pernah mendekodenya lagi.
function unescapeText(text) {
    return text.replace(/\\([!-/:-@[-`{-~])|&(?:#[xX]([0-9a-fA-F]{1,6})|#([0-9]{1,7})|([A-Za-z][A-Za-z0-9]{1,31}));/g,
        (match, escaped, hex, dec, name) => {
            if (escaped) return escaped;
            if (hex) return fromCodePoint(parseInt(hex, 16));
            if (dec) return fromCodePoint(parseInt(dec, 10));
            return Object.prototype.hasOwnProperty.call(ENTITIES, name) ? ENTITIES[name] : match;
        });
}

const ENTITY = /&(?:#[xX]([0-9a-fA-F]{1,6})|#([0-9]{1,7})|([A-Za-z][A-Za-z0-9]{1,31}));/y;
const URL_SAFE = /[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]/;

// Mengembalikan URL yang aman dipasang di href/src, atau null. Browser membuang tab/baris baru
// di mana saja dan karakter kontrol/spasi di ujung URL sebelum membaca skemanya, jadi URL
// dibersihkan dengan cara yang sama lebih dulu, lalu karakter lain di-percent-encode; skema
// diperiksa pada hasil akhirnya, yaitu persis teks yang akan dibaca browser.
function safeUrl(raw) {
    const decoded = unescapeText(raw);
    let start = 0;
    let end = decoded.length;
    while (start < end && decoded.charCodeAt(start) <= 0x20) start++;
    while (end > start && decoded.charCodeAt(end - 1) <= 0x20) end--;
    let url = "";
    for (const ch of decoded.slice(start, end)) {
        if (ch === "\t" || ch === "\n" || ch === "\r") continue;
        if (URL_SAFE.test(ch)) url += ch;
        else if (ch.length === 1 && ch >= "\ud800" && ch <= "\udfff") url += "%EF%BF%BD";
        else url += encodeURIComponent(ch);
    }
    // "%" yang tidak diikuti dua digit heksadesimal di-encode supaya URL-nya valid.
    url = url.replace(/%(?![0-9a-fA-F]{2})/g, "%25");
    const scheme = /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(url);
    if (scheme && !/^(?:https?|mailto|tel)$/i.test(scheme[1])) return null;
    return url;
}

// ---------- Inline ----------

// Membaca "(tujuan "judul")" sesudah "]". Mengembalikan { dest, title, end } atau null.
function parseLinkTail(src, pos, memo) {
    let p = pos + 1;
    const skipSpace = () => {
        while (p < src.length && (src[p] === " " || src[p] === "\t" || src[p] === "\n")) p++;
    };
    skipSpace();
    let dest = "";
    if (src[p] === "<") {
        let q = p + 1;
        while (q < src.length && src[q] !== ">" && src[q] !== "<" && src[q] !== "\n") q += src[q] === "\\" ? 2 : 1;
        if (src[q] !== ">") return null;
        dest = src.slice(p + 1, q);
        p = q + 1;
    } else {
        const begin = p;
        let depth = 0;
        while (p < src.length) {
            const ch = src[p];
            if (ch === "\\" && isAsciiPunct(src[p + 1])) { p += 2; continue; }
            if (ch === "(") {
                if (++depth > MAX_PARENS) return null;
            } else if (ch === ")") {
                if (depth === 0) break;
                depth--;
            } else if (src.charCodeAt(p) <= 0x20) {
                break;
            }
            p++;
        }
        if (depth !== 0) return null;
        dest = src.slice(begin, p);
    }
    const beforeTitle = p;
    skipSpace();
    let title = null;
    const open = src[p];
    if ((open === "\"" || open === "'" || open === "(") && p > beforeTitle) {
        const close = open === "(" ? ")" : open;
        // memo: posisi terjauh yang sudah diketahui tidak punya penutup judul jenis ini, supaya
        // judul yang tak pernah ditutup tidak dipindai ulang dari setiap "](".
        if (memo[close] !== undefined && p >= memo[close]) return null;
        let q = p + 1;
        while (q < src.length && src[q] !== close) {
            if (open === "(" && src[q] === "(") return null;
            q += src[q] === "\\" ? 2 : 1;
        }
        if (q >= src.length) {
            if (open !== "(") memo[close] = p;
            return null;
        }
        title = src.slice(p + 1, q);
        p = q + 1;
        skipSpace();
    }
    if (src[p] !== ")") return null;
    return { dest, title, end: p + 1 };
}

function isEmail(text) {
    const at = text.indexOf("@");
    if (at < 1 || at !== text.lastIndexOf("@")) return false;
    if (!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(text.slice(0, at))) return false;
    return text.slice(at + 1).split(".").every(label => label.length <= 63 && /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(label));
}

function linkAttrs(url, title, options) {
    let attrs = ` href="${escapeHTML(url)}"`;
    if (title !== null && title !== undefined) attrs += ` title="${escapeHTML(unescapeText(title))}"`;
    if (/^(?:https?:)?\/\//i.test(url)) {
        let rel = options.linkRel || "";
        if (options.linkTarget) {
            attrs += ` target="${escapeHTML(options.linkTarget)}"`;
            // Halaman yang dibuka dengan target="_blank" tidak boleh bisa mengubah halaman ini.
            if (options.linkTarget === "_blank" && !/\bnoopener\b/.test(rel)) rel = (rel + " noopener noreferrer").trim();
        }
        if (rel) attrs += ` rel="${escapeHTML(rel)}"`;
    }
    return attrs;
}

// Teks satu paragraf/judul/sel tabel → { html, plain }. plain dipakai untuk alt gambar dan slug.
// Penekanan memakai algoritme "delimiter stack" CommonMark: penanda dicatat dulu, dipasangkan
// sesudahnya, dan tag-nya disisipkan langsung pada node penanda, jadi tidak ada pohon yang dibangun.
function parseInline(src, options) {
    const nodes = [];
    let html = "";
    let plain = "";
    const flush = () => {
        if (html || plain) nodes.push({ html, plain });
        html = "";
        plain = "";
    };
    const addText = (text, raw) => {
        html += raw === undefined ? escapeHTML(text) : raw;
        plain += text;
    };

    let firstD = null;
    let lastD = null;
    const removeD = d => {
        if (d.prevD) d.prevD.nextD = d.nextD; else firstD = d.nextD;
        if (d.nextD) d.nextD.prevD = d.prevD; else lastD = d.prevD;
    };

    const processEmphasis = bottom => {
        const openersBottom = {};
        let closer = bottom ? bottom.nextD : firstD;
        while (closer) {
            if (!closer.canClose) {
                closer = closer.nextD;
                continue;
            }
            const key = closer.ch + (closer.canOpen ? "1" : "0") + (closer.orig % 3);
            const floor = key in openersBottom ? openersBottom[key] : bottom;
            let opener = closer.prevD;
            let found = false;
            while (opener && opener !== bottom && opener !== floor) {
                if (opener.ch === closer.ch && opener.canOpen) {
                    const sum = opener.orig + closer.orig;
                    const odd = (closer.canOpen || opener.canClose) && sum % 3 === 0 && !(opener.orig % 3 === 0 && closer.orig % 3 === 0);
                    if (!odd) {
                        found = true;
                        break;
                    }
                }
                opener = opener.prevD;
            }
            const next = closer.nextD;
            if (found) {
                const use = closer.ch === "~" || (closer.count >= 2 && opener.count >= 2) ? 2 : 1;
                const tag = closer.ch === "~" ? "del" : use === 2 ? "strong" : "em";
                opener.count -= use;
                closer.count -= use;
                opener.open = `<${tag}>` + opener.open;
                closer.close += `</${tag}>`;
                opener.nextD = closer;
                closer.prevD = opener;
                if (opener.count === 0) removeD(opener);
                if (closer.count === 0) {
                    removeD(closer);
                    closer = next;
                }
            } else {
                openersBottom[key] = closer.prevD;
                if (!closer.canOpen) removeD(closer);
                closer = next;
            }
        }
        if (bottom) {
            bottom.nextD = null;
            lastD = bottom;
        } else {
            firstD = null;
            lastD = null;
        }
    };

    // Plain text node[from..to), mengikuti skipTo milik gambar yang sudah jadi.
    const plainOf = (from, to) => {
        let text = "";
        for (let i = from; i < to; i = nodes[i].skipTo || i + 1) {
            const node = nodes[i];
            text += node.ch ? node.ch.repeat(node.count) : node.plain;
        }
        return text;
    };

    const brackets = [];
    let inactiveBelow = 0;
    const memo = {};
    let runs = null;
    const runPointer = {};

    let pos = 0;
    while (pos < src.length) {
        const ch = src[pos];
        if (ch === "\\") {
            const next = src[pos + 1];
            if (next === "\n") {
                addText("\n", "<br>\n");
                pos += 2;
            } else if (isAsciiPunct(next)) {
                addText(next);
                pos += 2;
            } else {
                addText("\\");
                pos++;
            }
        } else if (ch === "\n") {
            let spaces = 0;
            while (html[html.length - 1 - spaces] === " ") spaces++;
            html = html.slice(0, html.length - spaces);
            plain = plain.trimEnd();
            addText("\n", spaces >= 2 ? "<br>\n" : "\n");
            // Penampung dikosongkan setiap baris supaya pemotongan spasi di atas tidak menyalin
            // seluruh paragraf berulang kali.
            flush();
            pos++;
        } else if (ch === "`") {
            let n = 1;
            while (src[pos + n] === "`") n++;
            if (!runs) {
                // Semua deret backtick dicatat sekali; pencarian penutup lalu maju dengan penunjuk
                // per panjang deret, bukan memindai ulang teks untuk setiap pembuka.
                runs = {};
                for (let i = 0; i < src.length;) {
                    if (src[i] !== "`") {
                        i++;
                        continue;
                    }
                    let len = 1;
                    while (src[i + len] === "`") len++;
                    (runs[len] = runs[len] || []).push(i);
                    i += len;
                }
            }
            const list = runs[n] || [];
            let k = runPointer[n] || 0;
            while (k < list.length && list[k] <= pos) k++;
            runPointer[n] = k;
            if (k < list.length) {
                let code = src.slice(pos + n, list[k]).replace(/\n/g, " ");
                if (code.length > 2 && code[0] === " " && code[code.length - 1] === " " && code.trim() !== "") code = code.slice(1, -1);
                addText(code, `<code>${escapeHTML(code)}</code>`);
                pos = list[k] + n;
            } else {
                addText("`".repeat(n));
                pos += n;
            }
        } else if (ch === "&") {
            ENTITY.lastIndex = pos;
            const m = ENTITY.exec(src);
            if (!m) {
                addText("&");
                pos++;
            } else if (m[3]) {
                // Entitas bernama diteruskan apa adanya: di dalam teks browser hanya mengubahnya
                // menjadi karakter, tidak pernah menjadi tag.
                const known = Object.prototype.hasOwnProperty.call(ENTITIES, m[3]);
                addText(known ? ENTITIES[m[3]] : m[0], m[0]);
                pos += m[0].length;
            } else {
                addText(fromCodePoint(m[1] ? parseInt(m[1], 16) : parseInt(m[2], 10)));
                pos += m[0].length;
            }
        } else if (ch === "<") {
            let q = pos + 1;
            while (q < src.length && src[q] !== ">" && src[q] !== "<" && src.charCodeAt(q) > 0x20) q++;
            const inner = src[q] === ">" ? src.slice(pos + 1, q) : "";
            let url = null;
            if (/^[A-Za-z][A-Za-z0-9+.-]{1,31}:/.test(inner)) url = safeUrl(inner);
            else if (isEmail(inner)) url = "mailto:" + inner;
            if (url) {
                addText(inner, `<a${linkAttrs(url, null, options)}>${escapeHTML(inner)}</a>`);
                pos = q + 1;
            } else {
                addText("<");
                pos++;
            }
        } else if (ch === "*" || ch === "_" || ch === "~") {
            let n = 1;
            while (src[pos + n] === ch) n++;
            const before = pos === 0 ? undefined : src[pos - 1];
            const after = src[pos + n];
            const left = !isSpace(after) && (!isPunct(after) || isSpace(before) || isPunct(before));
            const right = !isSpace(before) && (!isPunct(before) || isSpace(after) || isPunct(after));
            let canOpen = left;
            let canClose = right;
            if (ch === "_") {
                canOpen = left && (!right || isPunct(before));
                canClose = right && (!left || isPunct(after));
            } else if (ch === "~" && n !== 2) {
                // Coret hanya "~~teks~~"; "~" tunggal (misalnya "~5 km") tetap teks.
                canOpen = canClose = false;
            }
            if (canOpen || canClose) {
                flush();
                const node = { ch, count: n, orig: n, canOpen, canClose, open: "", close: "", prevD: lastD, nextD: null };
                if (lastD) lastD.nextD = node; else firstD = node;
                lastD = node;
                nodes.push(node);
            } else {
                addText(ch.repeat(n));
            }
            pos += n;
        } else if (ch === "[" || (ch === "!" && src[pos + 1] === "[")) {
            const image = ch === "!";
            flush();
            nodes.push({ html: image ? "![" : "[", plain: image ? "![" : "[" });
            brackets.push({ index: nodes.length - 1, image, bottom: lastD });
            pos += image ? 2 : 1;
        } else if (ch === "]") {
            const opener = brackets.pop();
            const active = opener && (opener.image || brackets.length >= inactiveBelow);
            inactiveBelow = Math.min(inactiveBelow, brackets.length);
            const tail = active && src[pos + 1] === "(" ? parseLinkTail(src, pos + 1, memo) : null;
            if (!tail) {
                addText("]");
                pos++;
                continue;
            }
            flush();
            processEmphasis(opener.bottom);
            const start = nodes[opener.index];
            const url = safeUrl(tail.dest);
            if (opener.image) {
                const alt = plainOf(opener.index + 1, nodes.length);
                let img = escapeHTML(alt);
                if (url !== null) {
                    img = `<img src="${escapeHTML(url)}" alt="${escapeHTML(alt)}"`;
                    if (tail.title !== null) img += ` title="${escapeHTML(unescapeText(tail.title))}"`;
                    img += ">";
                }
                start.html = img;
                start.plain = alt;
                start.skipTo = nodes.length;
            } else {
                // Tautan dengan URL terlarang hanya menampilkan teksnya.
                start.html = url === null ? "" : `<a${linkAttrs(url, tail.title, options)}>`;
                start.plain = "";
                nodes.push({ html: url === null ? "" : "</a>", plain: "" });
                // Tidak ada tautan di dalam tautan: "[" yang masih terbuka di luarnya jadi teks biasa.
                inactiveBelow = brackets.length;
            }
            pos = tail.end;
        } else {
            // Teks biasa dikumpulkan sekaligus sampai karakter istimewa berikutnya.
            let q = pos + 1;
            while (q < src.length && !"\\\n`&<*_~[]!".includes(src[q])) q++;
            addText(src.slice(pos, q));
            pos = q;
        }
    }
    flush();
    processEmphasis(null);

    let out = "";
    let text = "";
    for (let i = 0; i < nodes.length; i = nodes[i].skipTo || i + 1) {
        const node = nodes[i];
        if (node.ch) {
            out += node.close + node.ch.repeat(node.count) + node.open;
            text += node.ch.repeat(node.count);
        } else {
            out += node.html;
            text += node.plain;
        }
    }
    return { html: out.trimEnd(), plain: text.trim() };
}

// ---------- Blok ----------

function isBlank(line) {
    return line.trim() === "";
}

function indentOf(line) {
    let n = 0;
    while (line[n] === " ") n++;
    return n;
}

// Tab di awal baris diubah menjadi spasi (kelipatan 4) supaya lekukan bisa dihitung per karakter.
function expandTabs(line) {
    let col = 0;
    let i = 0;
    let lead = "";
    while (i < line.length && (line[i] === " " || line[i] === "\t")) {
        const width = line[i] === "\t" ? 4 - (col % 4) : 1;
        lead += " ".repeat(width);
        col += width;
        i++;
    }
    return i === 0 ? line : lead + line.slice(i);
}

function fenceOpen(line) {
    const indent = indentOf(line);
    if (indent > 3) return null;
    const ch = line[indent];
    if (ch !== "`" && ch !== "~") return null;
    let n = 0;
    while (line[indent + n] === ch) n++;
    if (n < 3) return null;
    const info = line.slice(indent + n).trim();
    if (ch === "`" && info.includes("`")) return null;
    return { indent, ch, n, info };
}

function isFenceClose(line, fence) {
    const indent = indentOf(line);
    if (indent > 3) return false;
    let n = 0;
    while (line[indent + n] === fence.ch) n++;
    return n >= fence.n && line.slice(indent + n).trim() === "";
}

function atxHeading(line) {
    const indent = indentOf(line);
    if (indent > 3) return null;
    let level = 0;
    while (line[indent + level] === "#") level++;
    if (level < 1 || level > 6) return null;
    const after = line[indent + level];
    if (after !== undefined && after !== " " && after !== "\t") return null;
    let text = line.slice(indent + level).trim();
    // "## Judul ##": deret # penutup dibuang kalau didahului spasi (atau judulnya hanya #).
    let end = text.length;
    while (end > 0 && text[end - 1] === "#") end--;
    if (end === 0) text = "";
    else if (end < text.length && (text[end - 1] === " " || text[end - 1] === "\t")) text = text.slice(0, end).trim();
    return { level, text };
}

function isThematicBreak(line) {
    if (indentOf(line) > 3) return false;
    const chars = line.replace(/[ \t]/g, "");
    if (chars.length < 3) return false;
    const ch = chars[0];
    if (ch !== "-" && ch !== "*" && ch !== "_") return false;
    for (let i = 1; i < chars.length; i++) if (chars[i] !== ch) return false;
    return true;
}

function listMarker(line) {
    const indent = indentOf(line);
    if (indent > 3) return null;
    let p = indent;
    let ordered = false;
    let start = 1;
    let type;
    if (line[p] === "-" || line[p] === "+" || line[p] === "*") {
        type = line[p];
        p++;
    } else {
        let digits = "";
        while (digits.length < 10 && line[p] >= "0" && line[p] <= "9") digits += line[p++];
        if (digits.length < 1 || digits.length > 9 || (line[p] !== "." && line[p] !== ")")) return null;
        ordered = true;
        start = parseInt(digits, 10);
        type = line[p];
        p++;
    }
    if (p < line.length && line[p] !== " ") return null;
    const rest = line.slice(p);
    const spaces = indentOf(rest);
    const empty = rest.trim() === "";
    // Lebih dari 4 spasi sesudah penanda berarti blok kode indentasi di dalam butir.
    const gap = empty || spaces > 4 ? 1 : spaces;
    return { ordered, start, type, width: p + gap, content: empty ? "" : line.slice(p + gap), empty };
}

function isQuote(line) {
    const indent = indentOf(line);
    return indent <= 3 && line[indent] === ">";
}

// Memecah baris tabel pada "|" yang tidak di-escape. Pipa di awal/akhir baris opsional.
function splitRow(line) {
    let text = line.trim();
    if (text[0] === "|") text = text.slice(1);
    const cells = [];
    let cell = "";
    let closed = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        closed = false;
        if (ch === "\\" && text[i + 1] === "|") {
            cell += "|";
            i++;
        } else if (ch === "\\" && i + 1 < text.length) {
            cell += ch + text[i + 1];
            i++;
        } else if (ch === "|") {
            cells.push(cell.trim());
            cell = "";
            closed = true;
        } else {
            cell += ch;
        }
    }
    if (!closed || cell.trim() !== "") cells.push(cell.trim());
    return cells;
}

function hasPipe(line) {
    for (let i = 0; i < line.length; i++) {
        if (line[i] === "\\") i++;
        else if (line[i] === "|") return true;
    }
    return false;
}

function tableAligns(header, delimiter) {
    if (delimiter === undefined || indentOf(header) > 3 || indentOf(delimiter) > 3) return null;
    if (!hasPipe(header) && !hasPipe(delimiter)) return null;
    const cells = splitRow(delimiter);
    const aligns = [];
    for (const cell of cells) {
        let body = cell;
        const left = body[0] === ":";
        const right = body.length > 1 && body[body.length - 1] === ":";
        body = body.slice(left ? 1 : 0, right ? -1 : undefined);
        if (body === "" || body.replace(/-/g, "") !== "") return null;
        aligns.push(left && right ? "center" : right ? "right" : left ? "left" : "");
    }
    return aligns.length === splitRow(header).length ? aligns : null;
}

// Apakah baris ini memulai blok baru (sehingga menghentikan paragraf)?
function startsBlock(lines, i, depth) {
    const line = lines[i];
    if (isBlank(line)) return true;
    if (indentOf(line) > 3) return false;
    if (fenceOpen(line) || atxHeading(line) || isThematicBreak(line)) return true;
    if (depth < MAX_DEPTH) {
        if (isQuote(line)) return true;
        const marker = listMarker(line);
        // Daftar hanya memotong paragraf kalau butirnya berisi, dan daftar berurut mulai dari 1.
        if (marker && !marker.empty && (!marker.ordered || marker.start === 1)) return true;
    }
    return tableAligns(line, lines[i + 1]) !== null;
}

// Mengurai baris-baris menjadi daftar blok { type, html, inner, start, end }. start/end adalah
// rentang baris (end eksklusif, tanpa baris kosong di ujung) untuk menentukan daftar renggang.
function parseBlocks(lines, depth, ctx) {
    const blocks = [];
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        const start = i;
        if (isBlank(line)) {
            i++;
            continue;
        }
        const indent = indentOf(line);

        if (indent >= 4) {
            const code = [];
            while (i < lines.length && (isBlank(lines[i]) || indentOf(lines[i]) >= 4)) code.push(lines[i++].slice(4));
            while (isBlank(code[code.length - 1])) {
                code.pop();
                i--;
            }
            blocks.push({ type: "code", html: `<pre><code>${escapeHTML(code.join("\n"))}\n</code></pre>`, start, end: start + code.length });
            continue;
        }

        const fence = fenceOpen(line);
        if (fence) {
            const code = [];
            i++;
            while (i < lines.length && !isFenceClose(lines[i], fence)) {
                const l = lines[i++];
                code.push(l.slice(Math.min(fence.indent, indentOf(l))));
            }
            if (i < lines.length) i++;
            const lang = unescapeText(fence.info.split(/\s/)[0]);
            const cls = lang ? ` class="language-${escapeHTML(lang)}"` : "";
            const body = code.length ? escapeHTML(code.join("\n")) + "\n" : "";
            blocks.push({ type: "code", html: `<pre><code${cls}>${body}</code></pre>`, start, end: i });
            continue;
        }

        const heading = atxHeading(line);
        if (heading) {
            blocks.push({ type: "heading", html: headingHTML(heading.level, heading.text, ctx), start, end: ++i });
            continue;
        }

        if (isThematicBreak(line)) {
            blocks.push({ type: "hr", html: "<hr>", start, end: ++i });
            continue;
        }

        if (depth < MAX_DEPTH && isQuote(line)) {
            const inner = [];
            while (i < lines.length) {
                const l = lines[i];
                if (isQuote(l)) {
                    let rest = l.slice(indentOf(l) + 1);
                    if (rest[0] === " ") rest = rest.slice(1);
                    inner.push(rest);
                } else if (!isBlank(l) && inner.length && !isBlank(inner[inner.length - 1]) && !startsBlock(lines, i, depth)) {
                    // Baris "malas": lanjutan paragraf kutipan tanpa ">" di depannya.
                    inner.push(l);
                } else {
                    break;
                }
                i++;
            }
            const content = parseBlocks(inner, depth + 1, ctx).map(b => b.html).join("\n");
            blocks.push({ type: "quote", html: `<blockquote>\n${content}\n</blockquote>`, start, end: i });
            continue;
        }

        const first = depth < MAX_DEPTH ? listMarker(line) : null;
        if (first) {
            const result = parseList(lines, i, first, depth, ctx);
            blocks.push({ type: "list", html: result.html, start, end: result.end });
            i = result.next;
            continue;
        }

        const aligns = tableAligns(line, lines[i + 1]);
        if (aligns) {
            const result = parseTable(lines, i, aligns, depth, ctx);
            blocks.push({ type: "table", html: result.html, start, end: result.next });
            i = result.next;
            continue;
        }

        const para = [line.trim()];
        i++;
        let setext = 0;
        while (i < lines.length) {
            const l = lines[i];
            if (indentOf(l) <= 3 && /^ *(?:=+|-+) *$/.test(l)) {
                setext = l.trim()[0] === "=" ? 1 : 2;
                i++;
                break;
            }
            if (startsBlock(lines, i, depth)) break;
            para.push(l.trim());
            i++;
        }
        // Spasi di akhir baris dipertahankan (kecuali baris terakhir) karena dua spasi = <br>.
        const text = para.map((l, k) => k < para.length - 1 ? l + trailingSpaces(lines[start + k]) : l).join("\n");
        if (setext) {
            blocks.push({ type: "heading", html: headingHTML(setext, text, ctx), start, end: i });
        } else {
            const inner = parseInline(text, ctx.options).html;
            blocks.push({ type: "p", inner, html: `<p>${inner}</p>`, start, end: i });
        }
    }
    return blocks;
}

function trailingSpaces(line) {
    let n = 0;
    while (line[line.length - 1 - n] === " ") n++;
    return " ".repeat(n);
}

function headingHTML(level, text, ctx) {
    const { html, plain } = parseInline(text, ctx.options);
    let id = "";
    if (ctx.options.headingIds) {
        const base = (ctx.options.idPrefix || "") + (plain.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s_-]/gu, "").trim().replace(/\s+/g, "-") || "heading");
        const seen = ctx.ids[base] || 0;
        ctx.ids[base] = seen + 1;
        id = ` id="${escapeHTML(seen ? `${base}-${seen}` : base)}"`;
    }
    return `<h${level}${id}>${html}</h${level}>`;
}

function parseList(lines, i, first, depth, ctx) {
    const items = [];
    let marker = first;
    let loose = false;
    let end = i;
    while (marker) {
        const itemLines = [marker.content];
        let j = i + 1;
        // Butir yang dimulai kosong hanya boleh berlanjut lewat baris berlekuk tepat sesudahnya.
        const emptyStart = marker.empty;
        while (j < lines.length) {
            const l = lines[j];
            if (isBlank(l)) {
                if (emptyStart && itemLines.length === 1) break;
                itemLines.push("");
            } else if (indentOf(l) >= marker.width) {
                itemLines.push(l.slice(marker.width));
            } else if (!isBlank(itemLines[itemLines.length - 1]) && !startsBlock(lines, j, depth) && !listMarker(l)) {
                itemLines.push(l);
            } else {
                break;
            }
            j++;
        }
        let trailing = 0;
        while (itemLines.length > 1 && isBlank(itemLines[itemLines.length - 1])) {
            itemLines.pop();
            trailing++;
        }
        end = j - trailing;

        let task = "";
        const box = /^\[([ xX])\][ \t]+\S/.exec(itemLines[0]);
        if (box) {
            task = `<input type="checkbox" disabled${box[1] === " " ? "" : " checked"}> `;
            itemLines[0] = itemLines[0].slice(3).trimStart();
        }
        const blocks = parseBlocks(itemLines, depth + 1, ctx);
        for (let k = 1; k < blocks.length; k++) if (blocks[k].start > blocks[k - 1].end) loose = true;
        items.push({ blocks, task });

        const next = j < lines.length ? listMarker(lines[j]) : null;
        if (!next || next.ordered !== first.ordered || next.type !== first.type || isThematicBreak(lines[j])) break;
        if (trailing) loose = true;
        marker = next;
        i = j;
    }

    const tag = first.ordered ? "ol" : "ul";
    const startAttr = first.ordered && first.start !== 1 ? ` start="${first.start}"` : "";
    const body = items.map(({ blocks, task }) => {
        const parts = blocks.map(b => (b.type === "p" && !loose ? b.inner : b.html));
        if (task) {
            if (blocks[0] && blocks[0].type === "p") parts[0] = loose ? `<p>${task}${blocks[0].inner}</p>` : task + blocks[0].inner;
            else parts.unshift(task.trim());
        }
        const cls = task ? ` class="task-list-item"` : "";
        if (!parts.length) return `<li${cls}></li>`;
        const tight = !loose && blocks.length && blocks[0].type === "p";
        return tight && blocks.length === 1 ? `<li${cls}>${parts[0]}</li>` : `<li${cls}>${loose ? "\n" : ""}${parts.join("\n")}\n</li>`;
    }).join("\n");
    // next = baris sesudah daftar, termasuk baris kosong yang mengikutinya.
    let next = end;
    while (next < lines.length && isBlank(lines[next])) next++;
    return { html: `<${tag}${startAttr}>\n${body}\n</${tag}>`, end, next };
}

function parseTable(lines, i, aligns, depth, ctx) {
    const cellHTML = (tag, text, k) => {
        const align = aligns[k] ? ` align="${aligns[k]}"` : "";
        return `<${tag}${align}>${parseInline(text, ctx.options).html}</${tag}>`;
    };
    const header = splitRow(lines[i]).map((cell, k) => cellHTML("th", cell, k)).join("");
    let html = `<table>\n<thead>\n<tr>${header}</tr>\n</thead>\n`;
    let j = i + 2;
    const rows = [];
    while (j < lines.length && !startsBlock(lines, j, depth)) {
        const cells = splitRow(lines[j]).slice(0, aligns.length);
        ctx.filler += aligns.length - cells.length;
        if (ctx.filler > MAX_FILLER_CELLS) break;
        while (cells.length < aligns.length) cells.push("");
        rows.push(`<tr>${cells.map((cell, k) => cellHTML("td", cell, k)).join("")}</tr>`);
        j++;
    }
    if (rows.length) html += `<tbody>\n${rows.join("\n")}\n</tbody>\n`;
    return { html: html + "</table>", next: j };
}

// Mengubah teks Markdown menjadi string HTML. Semua HTML mentah di masukan di-escape.
// options (semua opsional):
//   headingIds  true: judul diberi id slug ("Cara Pakai" → id="cara-pakai") untuk tautan #anchor
//   idPrefix    awalan id judul, mis. "md-", supaya tidak bentrok dengan id lain di halaman
//   linkTarget  target untuk tautan http(s), mis. "_blank" (otomatis rel="noopener noreferrer")
//   linkRel     rel untuk tautan http(s), mis. "nofollow"
export function markdownToHTML(markdown, options = {}) {
    const lines = String(markdown ?? "").replace(/\r\n?/g, "\n").replace(/\0/g, "�").split("\n").map(expandTabs);
    const ctx = { options, ids: {}, filler: 0 };
    return parseBlocks(lines, 0, ctx).map(b => b.html).join("\n");
}

// Mengisi elemen id dengan hasil markdownToHTML. Mengembalikan string HTML-nya.
export function renderMarkdown(id, markdown, options = {}) {
    const html = markdownToHTML(markdown, options);
    const element = document.getElementById(id);
    if (element) element.innerHTML = html;
    else console.warn(`Elemen dengan ID "${id}" tidak ditemukan.`);
    return html;
}

// Mengambil file Markdown dari url lalu mengubahnya menjadi HTML. Hasil { status, data, markdown,
// error } dikirim ke responseFunction (boleh null) dan menjadi isi Promise yang tidak pernah
// reject. data = HTML dan markdown = teks asli kalau status 2xx, selain itu keduanya "".
// options: semua opsi markdownToHTML, ditambah timeout (ms, bawaan 15000) dan signal (AbortSignal).
// Gagal jaringan: status 0, error "timeout" / "abort" / "offline" / "network".
export function getMarkdown(url, responseFunction, options = {}) {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, Number(options.timeout) > 0 ? Number(options.timeout) : 15000);
    const abort = () => controller.abort();
    if (options.signal) {
        if (options.signal.aborted) abort();
        else options.signal.addEventListener("abort", abort);
    }
    return fetch(url, { signal: controller.signal })
        .then(response => response.text().then(text => response.ok
            ? { status: response.status, data: markdownToHTML(text, options), markdown: text, error: null }
            : { status: response.status, data: "", markdown: "", error: null }))
        .catch(error => {
            let kind = "network";
            if (timedOut) kind = "timeout";
            else if (options.signal && options.signal.aborted) kind = "abort";
            else if (navigator.onLine === false) kind = "offline";
            if (kind !== "abort") console.warn(`getMarkdown ${url} gagal (${kind}):`, error.message);
            return { status: 0, data: "", markdown: "", error: kind };
        })
        .finally(() => {
            clearTimeout(timer);
            if (options.signal) options.signal.removeEventListener("abort", abort);
        })
        .then(result => {
            if (typeof responseFunction === "function") responseFunction(result);
            return result;
        });
}
