// openapi.js - penampil dokumentasi OpenAPI 3.0/3.1, pengganti ringan Swagger UI. Setiap operasi
// diberi contoh kode yang memanggilnya dengan api.js, dan bisa dicoba langsung dari halaman.
// Spesifikasi YAML diurai dengan yaml.js dan deskripsi (CommonMark) dengan markdown.js; keduanya
// baru diunduh kalau dibutuhkan. Teks dari spesifikasi selalu dipasang sebagai teks, kecuali
// keluaran markdownToHTML yang sudah meng-escape HTML mentah; tautan hanya http(s) dan mailto.

const TEXTS = {
    loading: "Memuat spesifikasi…",
    loadNetwork: "Spesifikasi tidak bisa diambil: server tidak terjangkau atau diblokir CORS.",
    loadTimeout: "Spesifikasi tidak bisa diambil: waktu habis.",
    loadHTTP: status => `Spesifikasi tidak bisa diambil: HTTP ${status}.`,
    loadParse: detail => `Spesifikasi tidak bisa dibaca. ${detail}`,
    swagger2: "Ini spesifikasi Swagger 2.0. Ubah dulu ke OpenAPI 3.x (mis. dengan converter.swagger.io).",
    notOpenAPI: "Ini bukan spesifikasi OpenAPI 3.x (field \"openapi\" tidak ada atau versinya tidak dikenal).",
    server: "Server",
    filter: "Saring operasi",
    noMatch: "Tidak ada operasi yang cocok.",
    untagged: "Lainnya",
    contact: "Kontak",
    license: "Lisensi",
    terms: "Ketentuan layanan",
    externalDocs: "Dokumentasi lain",
    deprecated: "usang",
    required: "wajib",
    parameters: "Parameter",
    columns: ["Nama", "Lokasi", "Tipe", "Keterangan"],
    requestBody: "Body permintaan",
    responses: "Respons",
    schema: "Skema",
    oneOf: "Salah satu dari:",
    anyOf: "Satu atau lebih dari:",
    additional: "kunci lain",
    unresolved: ref => `$ref tidak ditemukan: ${ref}`,
    snippet: "Kode CrootJS",
    snippetToken: "isi dengan token login",
    snippetFetch: method => `api.js tidak punya fungsi untuk ${method} dengan body ini, jadi pakai fetch.`,
    snippetUpload: "\"file\" = id <input type=\"file\"> di halaman Anda.",
    copy: "Salin",
    copied: "Tersalin",
    copyFailed: "Salin manual",
    tryIt: "Coba",
    send: "Kirim",
    sending: "Mengirim…",
    status: (status, ms) => `Status ${status} · ${ms} ms`,
    responseHeaders: count => `Header respons (${count})`,
    invalidJSON: "Body bukan JSON yang valid.",
    unsupportedBody: type => `Body ${type} tidak bisa dicoba di sini; pakai kode di atas.`,
    networkError: "Permintaan gagal: server tidak terjangkau, atau browser memblokirnya karena CORS (server harus mengizinkan origin halaman ini lewat Access-Control-Allow-Origin).",
    timeout: seconds => `Permintaan dibatalkan: tidak ada jawaban dalam ${seconds} detik.`
};

const METHODS = ["get", "put", "post", "delete", "options", "head", "patch", "trace"];
const HELPERS = { get: "getJSON", post: "postJSON", put: "putJSON", delete: "deleteJSON" };
const FORMATS = {
    "date-time": "2024-01-31T09:00:00Z", date: "2024-01-31", time: "09:00:00", email: "user@example.com",
    uuid: "3fa85f64-5717-4562-b3fc-2c963f66afa6", uri: "https://example.com", url: "https://example.com",
    hostname: "example.com", ipv4: "192.0.2.1", ipv6: "2001:db8::1", byte: "U3RyaW5n", binary: ""
};
const RESERVED = new Set(("break case catch class const continue debugger default delete do else enum export extends false " +
    "finally for function if import in instanceof let new null return super switch this throw true try typeof var void " +
    "while with yield await").split(" "));
const TIMEOUT_MS = 15000;
const MAX_SCHEMA_DEPTH = 10;

// Modul pendamping diambil dari folder dan varian (.min.js atau .js) yang sama dengan modul ini,
// jadi versi jsDelivr-nya selalu cocok.
const SUFFIX = import.meta.url.split(/[?#]/)[0].endsWith(".min.js") ? ".min.js" : ".js";
const sibling = name => new URL(`./${name}${SUFFIX}`, import.meta.url).href;
// Contoh kode dipakai di proyek lain, jadi hanya URL jsDelivr yang ditulis lengkap.
const API_MODULE = new URL(import.meta.url).hostname === "cdn.jsdelivr.net" ? sibling("api") : "./api.js";

let counter = 0;

function injectStyles() {
    if (document.getElementById("crootjs-openapi-style")) return;
    const style = document.createElement("style");
    style.id = "crootjs-openapi-style";
    style.textContent = `
.crootjs-openapi { min-width: 0; max-width: 100%; color: var(--croot-text, #1e293b); overflow-wrap: anywhere; }
.crootjs-openapi h2 { margin: 0 0 0.5rem; }
.crootjs-openapi h4 { margin: 1rem 0 0.5rem; font-size: 1rem; }
.crootjs-openapi-badge { display: inline-block; margin-left: 0.5rem; padding: 0 0.5rem; border: 1px solid var(--croot-border, #d4dbe3); border-radius: 999px; color: var(--croot-muted, #64748b); font-size: 0.8rem; font-weight: 400; vertical-align: middle; }
.crootjs-openapi-links { display: flex; flex-wrap: wrap; gap: 0.25rem 1rem; margin: 0.5rem 0; padding: 0; list-style: none; }
.crootjs-openapi-md > :first-child { margin-top: 0; }
.crootjs-openapi-md > :last-child { margin-bottom: 0; }
.crootjs-openapi-tools { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 0.75rem 1rem; margin: 1rem 0; }
.crootjs-openapi-field { flex: 1 1 14rem; min-width: 0; margin: 0 0 0.5rem; }
.crootjs-openapi-field label { display: block; }
.crootjs-openapi-field :is(input, select, textarea) { box-sizing: border-box; width: 100%; max-width: 100%; }
.crootjs-openapi-field textarea { min-height: 8rem; font-family: var(--croot-mono, ui-monospace, monospace); }
.crootjs-openapi-server { margin: 0 0 0.5rem; }
.crootjs-openapi-tag { margin: 1.5rem 0; }
.crootjs-openapi-tag > h3 { margin: 0 0 0.5rem; padding-bottom: 0.25rem; border-bottom: 1px solid var(--croot-border, #d4dbe3); }
.crootjs-openapi-op { margin: 0.5rem 0; border: 1px solid var(--croot-border, #d4dbe3); border-radius: var(--croot-radius, 8px); background: var(--croot-surface, #ffffff); }
.crootjs-openapi-op > summary { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.25rem 0.75rem; padding: 0.6rem 0.75rem; cursor: pointer; list-style: none; }
.crootjs-openapi-op > summary::-webkit-details-marker { display: none; }
.crootjs-openapi-op > summary::before { content: "▸"; content: "▸" / ""; color: var(--croot-muted, #64748b); }
.crootjs-openapi-op[open] > summary::before { content: "▾"; content: "▾" / ""; }
.crootjs-openapi-method { min-width: 4.2rem; padding: 0 0.4rem; border: 1px solid; border-radius: 4px; font: 700 0.8rem/1.6 var(--croot-mono, ui-monospace, monospace); text-align: center; color: var(--croot-muted, #64748b); }
.crootjs-openapi-get { color: var(--croot-info, #1d4ed8); }
.crootjs-openapi-post { color: var(--croot-success, #15803d); }
.crootjs-openapi-put, .crootjs-openapi-patch { color: var(--croot-warning, #a16207); }
.crootjs-openapi-delete { color: var(--croot-danger, #b91c1c); }
.crootjs-openapi-path { font-family: var(--croot-mono, ui-monospace, monospace); font-weight: 600; word-break: break-all; }
.crootjs-openapi-summary { flex: 1 1 12rem; min-width: 0; color: var(--croot-muted, #64748b); }
.crootjs-openapi-gone .crootjs-openapi-path { text-decoration: line-through; }
.crootjs-openapi-flag { color: var(--croot-danger, #b91c1c); font-size: 0.85rem; }
.crootjs-openapi-body { min-width: 0; padding: 0 0.75rem 0.75rem; border-top: 1px solid var(--croot-border, #d4dbe3); }
.crootjs-openapi-scroll { max-width: 100%; overflow-x: auto; }
.crootjs-openapi-scroll table { width: 100%; margin: 0; border-collapse: collapse; }
:where(.crootjs-openapi-scroll) :is(th, td) { padding: 0.4rem 0.5rem; border-bottom: 1px solid var(--croot-border, #d4dbe3); text-align: left; vertical-align: top; overflow-wrap: normal; }
/* Kolom pendek tidak dipatahkan per huruf di layar sempit; tabelnya digulir di kotaknya sendiri. */
.crootjs-openapi-scroll :is(th, td:not(:last-child)) { white-space: nowrap; }
.crootjs-openapi-scroll td:last-child { min-width: 12rem; }
.crootjs-openapi pre { box-sizing: border-box; max-width: 100%; max-height: 24rem; overflow: auto; margin: 0.5rem 0; padding: 0.75rem; border: 1px solid var(--croot-border, #d4dbe3); border-radius: var(--croot-radius, 8px); background: var(--croot-bg, #f8fafc); color: inherit; font: 0.85rem/1.5 var(--croot-mono, ui-monospace, monospace); white-space: pre; overflow-wrap: normal; }
.crootjs-openapi pre code { padding: 0; background: none; font: inherit; }
.crootjs-openapi-type, .crootjs-openapi-meta { color: var(--croot-muted, #64748b); font-size: 0.85rem; }
.crootjs-openapi-type { font-family: var(--croot-mono, ui-monospace, monospace); }
.crootjs-openapi-req { color: var(--croot-danger, #b91c1c); font-size: 0.8rem; }
.crootjs-openapi-tree, .crootjs-openapi-tree ul { margin: 0; padding: 0; list-style: none; }
.crootjs-openapi-tree ul { margin-left: 0.4rem; padding-left: 0.75rem; border-left: 1px solid var(--croot-border, #d4dbe3); }
.crootjs-openapi-tree li { margin: 0.25rem 0; }
.crootjs-openapi-tree .crootjs-openapi-md { font-size: 0.9rem; }
.crootjs-openapi-prop { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 0.5rem; }
.crootjs-openapi details details { margin: 0.25rem 0; }
.crootjs-openapi details details > summary { color: var(--croot-muted, #64748b); }
.crootjs-openapi-response { padding: 0.5rem 0; border-top: 1px dashed var(--croot-border, #d4dbe3); }
.crootjs-openapi-response > p, .crootjs-openapi p.crootjs-openapi-meta { margin: 0.25rem 0; }
.crootjs-openapi-code { font-family: var(--croot-mono, ui-monospace, monospace); font-weight: 700; margin-right: 0.5rem; }
.crootjs-openapi-s2 { color: var(--croot-success, #15803d); }
.crootjs-openapi-s3 { color: var(--croot-info, #1d4ed8); }
.crootjs-openapi-s4, .crootjs-openapi-s5 { color: var(--croot-danger, #b91c1c); }
.crootjs-openapi-bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.5rem; }
.crootjs-openapi-bar h4 { margin: 0.5rem 0 0; }
.crootjs-openapi-try { margin: 0.5rem 0 0; }
.crootjs-openapi-error { padding: 0.75rem; border: 1px solid var(--croot-danger, #b91c1c); border-radius: var(--croot-radius, 8px); color: var(--croot-danger, #b91c1c); }
.crootjs-openapi-message { color: var(--croot-muted, #64748b); }
`;
    const previous = [...document.head.querySelectorAll('style[id^="crootjs-"]')].pop();
    if (previous) previous.after(style);
    else document.head.prepend(style);
}

const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

function el(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined && text !== null) element.textContent = text;
    return element;
}

// "__proto__" dari spesifikasi dipasang sebagai properti biasa, bukan mengganti prototipe.
function setKey(target, key, value) {
    Object.defineProperty(target, key, { value, enumerable: true, writable: true, configurable: true });
}

function safeLink(raw, text) {
    let url;
    try {
        url = new URL(String(raw));
    } catch (error) {
        return null;
    }
    if (!["http:", "https:", "mailto:"].includes(url.protocol)) return null;
    const link = el("a", "", text);
    link.href = url.href;
    return link;
}

// JSON rapi dengan batas jumlah node: alias YAML bisa membuat banyak acuan ke node yang sama,
// dan JSON.stringify atas alias bertumpuk menghasilkan teks yang meledak ukurannya.
function pretty(value, step = "  ") {
    let budget = 5000;
    const walk = (item, indent, depth) => {
        if (item === null || typeof item !== "object") return JSON.stringify(item) ?? "null";
        if (--budget < 0 || depth > 32) return "…";
        const inner = indent + step;
        if (Array.isArray(item)) {
            return item.length ? `[\n${item.map(child => inner + walk(child, inner, depth + 1)).join(",\n")}\n${indent}]` : "[]";
        }
        const keys = Object.keys(item);
        return keys.length
            ? `{\n${keys.map(key => `${inner}${JSON.stringify(key)}: ${walk(item[key], inner, depth + 1)}`).join(",\n")}\n${indent}}`
            : "{}";
    };
    return walk(value, "", 0);
}

const short = value => {
    const text = pretty(value).replace(/\s*\n\s*/g, " ");
    return text.length > 80 ? text.slice(0, 79) + "…" : text;
};

// JSON Pointer lokal ("#/components/schemas/Note"). Acuan ke berkas lain menghasilkan undefined.
function pointer(spec, ref) {
    if (typeof ref !== "string" || ref[0] !== "#") return undefined;
    let node = spec;
    if (ref === "#") return node;
    if (ref[1] !== "/") return undefined;
    for (const raw of ref.slice(2).split("/")) {
        let part;
        try {
            part = decodeURIComponent(raw);
        } catch (error) {
            return undefined;
        }
        part = part.replace(/~1/g, "/").replace(/~0/g, "~");
        if (node === null || typeof node !== "object" || !own(node, part)) return undefined;
        node = node[part];
    }
    return node;
}

// Mengikuti rantai $ref. value undefined kalau acuannya tidak ditemukan, eksternal, atau berputar.
function follow(spec, value) {
    let ref = null;
    for (let i = 0; i < 32 && isObject(value) && typeof value.$ref === "string"; i++) {
        ref = value.$ref;
        value = pointer(spec, ref);
    }
    if (isObject(value) && typeof value.$ref === "string") value = undefined;
    return { value, ref };
}

const refName = ref => ref.split("/").pop().replace(/~1/g, "/").replace(/~0/g, "~");

// allOf digabung jadi satu skema untuk ditampilkan: properties dan required disatukan, kata kunci
// lain diambil dari bagian pertama yang memilikinya.
function mergeAllOf(spec, schema, seen, depth = 0) {
    if (!Array.isArray(schema.allOf) || depth > 8) return schema;
    const { allOf, ...out } = schema;
    let properties = isObject(schema.properties) ? { ...schema.properties } : {};
    let required = Array.isArray(schema.required) ? schema.required.slice() : [];
    for (const part of allOf) {
        const { value, ref } = follow(spec, part);
        if (!isObject(value) || (ref && seen.has(ref))) continue;
        if (ref) seen.add(ref);
        const merged = mergeAllOf(spec, value, seen, depth + 1);
        if (isObject(merged.properties)) properties = { ...properties, ...merged.properties };
        if (Array.isArray(merged.required)) required = required.concat(merged.required);
        for (const [key, value] of Object.entries(merged)) {
            if (out[key] === undefined && key !== "properties" && key !== "required") setKey(out, key, value);
        }
    }
    if (Object.keys(properties).length) out.properties = properties;
    if (required.length) out.required = required;
    return out;
}

// { schema, ref }: skema yang sudah diikuti $ref-nya dan digabung allOf-nya; schema null kalau
// $ref tidak ditemukan. Skema boolean OpenAPI 3.1 true berarti nilai apa pun.
function resolveSchema(spec, input) {
    const { value, ref } = follow(spec, input);
    if (value === true) return { schema: {}, ref };
    return { schema: isObject(value) ? mergeAllOf(spec, value, new Set(ref ? [ref] : [])) : null, ref };
}

function typeOf(schema) {
    const types = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
    if (types.length) return types;
    if (schema.properties || schema.additionalProperties) return ["object"];
    return schema.items ? ["array"] : [];
}

function typeLabel(spec, schema) {
    const types = typeOf(schema).slice();
    if (schema.nullable === true && !types.includes("null")) types.push("null");
    let label = types.join(" | ") || (schema.oneOf ? "oneOf" : schema.anyOf ? "anyOf" : "any");
    const items = follow(spec, schema.items);
    if (items.ref && types.includes("array")) label = label.replace("array", `array<${refName(items.ref)}>`);
    return schema.format ? `${label} (${schema.format})` : label;
}

function constraints(schema, texts) {
    const list = [];
    if (Array.isArray(schema.enum)) list.push(`enum: ${schema.enum.map(short).join(", ")}`);
    for (const key of ["const", "default", "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "minLength", "maxLength", "minItems", "maxItems", "pattern"]) {
        if (schema[key] !== undefined && own(schema, key)) list.push(`${key}: ${short(schema[key])}`);
    }
    if (schema.readOnly) list.push("readOnly");
    if (schema.writeOnly) list.push("writeOnly");
    if (schema.deprecated) list.push(texts.deprecated);
    return list.join(" · ");
}

function sample(state, input, direction, depth, stack) {
    if (--state.budget < 0 || depth > 8) return null;
    const { schema, ref } = resolveSchema(state.spec, input);
    if (!schema || (ref && stack.includes(ref))) return null;
    const next = ref ? stack.concat(ref) : stack;
    for (const key of ["example", "const", "default"]) if (schema[key] !== undefined && own(schema, key)) return schema[key];
    if (Array.isArray(schema.examples) && schema.examples.length) return schema.examples[0];
    if (Array.isArray(schema.enum) && schema.enum.length) return schema.enum[0];
    const choice = schema.oneOf || schema.anyOf;
    if (Array.isArray(choice) && choice.length) return sample(state, choice[0], direction, depth + 1, next);
    const type = typeOf(schema).find(name => name !== "null");
    if (type === "object") {
        const result = {};
        for (const [key, property] of Object.entries(isObject(schema.properties) ? schema.properties : {})) {
            const resolved = resolveSchema(state.spec, property).schema;
            // readOnly hanya ada di respons dan writeOnly hanya di permintaan.
            if (resolved && (direction === "request" ? resolved.readOnly : resolved.writeOnly)) continue;
            setKey(result, key, sample(state, property, direction, depth + 1, next));
        }
        if (isObject(schema.additionalProperties) && !Object.keys(result).length) {
            setKey(result, "key", sample(state, schema.additionalProperties, direction, depth + 1, next));
        }
        return result;
    }
    if (type === "array") return schema.items ? [sample(state, schema.items, direction, depth + 1, next)] : [];
    if (type === "string") return own(FORMATS, schema.format) ? FORMATS[schema.format] : "string";
    if (type === "integer" || type === "number") return typeof schema.minimum === "number" ? schema.minimum : 0;
    return type === "boolean" ? true : null;
}

// Contoh nilai untuk sebuah skema: example/default/enum dari spesifikasi, atau dibuat dari tipenya
// (format date-time, email, uuid, ...; array berisi satu butir). $ref berputar berhenti dengan null.
// direction "request" melewatkan properti readOnly, "response" melewatkan writeOnly.
export function openAPIExample(schema, spec = {}, direction = "response") {
    return sample({ spec, budget: 500 }, schema, direction, 0, []);
}

// Contoh dari media type (example, examples, atau skemanya).
function mediaExample(spec, media, direction) {
    if (media.example !== undefined) return media.example;
    if (isObject(media.examples)) {
        for (const item of Object.values(media.examples)) {
            const { value } = follow(spec, item);
            if (isObject(value) && value.value !== undefined) return value.value;
        }
    }
    return media.schema === undefined ? undefined : openAPIExample(media.schema, spec, direction);
}

// Contoh parameter yang ditulis di spesifikasi; generate = buat dari skema kalau tidak ada.
function paramExample(spec, param, generate) {
    const media = { ...param };
    if (!generate) {
        const schema = resolveSchema(spec, param.schema).schema;
        if (media.example === undefined && schema) media.example = schema.example ?? schema.default ?? (Array.isArray(schema.enum) ? schema.enum[0] : undefined);
        delete media.schema;
    }
    return mediaExample(spec, media, "request");
}

function hasDescription(spec) {
    const stack = [spec];
    const seen = new Set();
    while (stack.length) {
        const node = stack.pop();
        if (node === null || typeof node !== "object" || seen.has(node)) continue;
        seen.add(node);
        if (typeof node.description === "string" && node.description.trim()) return true;
        // push satu per satu: spread array besar ke push() melampaui batas jumlah argumen.
        for (const value of Object.values(node)) stack.push(value);
    }
    return false;
}

function serverList(spec, base, override) {
    const servers = override ? [{ url: override }] : Array.isArray(spec.servers) && spec.servers.length ? spec.servers : [{ url: "/" }];
    return servers.filter(isObject).map(server => {
        const variables = isObject(server.variables) ? server.variables : {};
        let url = String(server.url ?? "/").replace(/\{([^}]+)\}/g, (match, name) => {
            const variable = own(variables, name) ? variables[name] : null;
            return isObject(variable) && variable.default !== undefined ? String(variable.default) : match;
        });
        // URL server relatif dihitung dari lokasi berkas spesifikasi, sesuai standar OpenAPI.
        try {
            url = new URL(url, base).href;
        } catch (error) {
            // Variabel tanpa default membuat URL tidak valid; ditampilkan apa adanya.
        }
        return { url: url.replace(/\/+$/, ""), description: typeof server.description === "string" ? server.description : "" };
    });
}

// Cara mengirim token untuk sebuah skema keamanan, atau null kalau tidak bisa dari browser.
// OAuth2 dan OpenID Connect pada akhirnya juga mengirim "Authorization: Bearer".
function authKind(scheme) {
    if (!isObject(scheme)) return null;
    if ((scheme.type === "http" && /^bearer$/i.test(scheme.scheme)) || scheme.type === "oauth2" || scheme.type === "openIdConnect") return { type: "bearer" };
    if (scheme.type === "apiKey" && (scheme.in === "header" || scheme.in === "query") && typeof scheme.name === "string") return { type: scheme.in, key: scheme.name };
    return null;
}

function securitySchemes(spec) {
    const list = new Map();
    const schemes = isObject(spec.components) && isObject(spec.components.securitySchemes) ? spec.components.securitySchemes : {};
    for (const [name, raw] of Object.entries(schemes)) {
        const kind = authKind(follow(spec, raw).value);
        if (kind) list.set(name, kind);
    }
    return list;
}

// Skema keamanan pertama yang bisa dipakai operasi ini (security operasi, atau milik spesifikasi).
function authFor(spec, op, schemes) {
    const requirements = Array.isArray(op.security) ? op.security : Array.isArray(spec.security) ? spec.security : [];
    for (const requirement of requirements) {
        for (const name of isObject(requirement) ? Object.keys(requirement) : []) {
            if (schemes.has(name)) return { name, ...schemes.get(name) };
        }
    }
    return null;
}

function collectOperations(spec, schemes) {
    const list = [];
    for (const [path, raw] of Object.entries(isObject(spec.paths) ? spec.paths : {})) {
        const item = follow(spec, raw).value;
        if (!isObject(item)) continue;
        for (const method of METHODS) {
            const op = item[method];
            if (!isObject(op)) continue;
            const params = new Map();
            for (const rawParam of [].concat(Array.isArray(item.parameters) ? item.parameters : [], Array.isArray(op.parameters) ? op.parameters : [])) {
                const { value, ref } = follow(spec, rawParam);
                if (isObject(value) && typeof value.name === "string") params.set(`${value.in}:${value.name}`, value);
                else if (ref) params.set(`$ref:${ref}`, { unresolved: ref });
            }
            const body = follow(spec, op.requestBody).value;
            const content = isObject(body) && isObject(body.content) ? Object.entries(body.content) : [];
            list.push({
                method, path, op,
                params: [...params.values()],
                body: isObject(body) ? body : null,
                media: content.find(([, media]) => isObject(media)) || null,
                auth: authFor(spec, op, schemes)
            });
        }
    }
    return list;
}

function identifier(name, used) {
    let id = String(name).replace(/[^\w$]+(.)?/g, (match, next) => (next ? next.toUpperCase() : ""));
    if (!/^[A-Za-z_$]/.test(id)) id = "_" + id;
    while (RESERVED.has(id) || used.has(id)) id += "_";
    used.add(id);
    return id;
}

const propKey = key => (/^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key));
const objectLiteral = entries => `{ ${entries.map(([key, value]) => `${propKey(key)}: ${value}`).join(", ")} }`;

// Kode contoh yang memanggil operasi ini dengan api.js (getJSON/postJSON/putJSON/deleteJSON,
// uploadFile untuk multipart), atau fetch untuk method dan body yang tidak dimiliki api.js.
function snippet(spec, entry, server, texts) {
    const { method, path, params, media, auth } = entry;
    const used = new Set(["API_URL", "body", "query", "token", "responseFunction"]);
    const lines = [`const API_URL = ${JSON.stringify(server)};`];
    const values = new Map();
    let url = "`${API_URL}";
    for (const part of path.split(/(\{[^}]+\})/)) {
        const name = /^\{(.+)\}$/.exec(part);
        if (!name) {
            url += part.replace(/[`\\$]/g, "\\$&");
            continue;
        }
        if (!values.has(name[1])) {
            const param = params.find(item => item.in === "path" && item.name === name[1]);
            const id = identifier(name[1], used);
            values.set(name[1], id);
            lines.push(`const ${id} = ${JSON.stringify(param ? paramExample(spec, param, true) ?? "" : "")};`);
        }
        url += "${" + values.get(name[1]) + "}";
    }
    const query = [];
    const headers = [];
    for (const param of params) {
        const value = JSON.stringify(String(paramExample(spec, param, true) ?? ""));
        if (param.in === "query") query.push([param.name, value]);
        else if (param.in === "header" && !/^(accept|content-type|authorization)$/i.test(param.name)) headers.push([param.name, value]);
    }
    if (auth) {
        lines.push(`const token = ""; // ${texts.snippetToken}`);
        if (auth.type === "bearer") headers.push(["Authorization", "\"Bearer \" + token"]);
        else (auth.type === "query" ? query : headers).push([auth.key, "token"]);
    }
    if (query.length) {
        lines.push(`const query = new URLSearchParams(${objectLiteral(query)});`);
        url += "?${query}";
    }
    url += "`";
    const type = media && method !== "get" && method !== "head" ? media[0] : null;
    const json = !type || /json/i.test(type);
    if (type && type !== "multipart/form-data") {
        const example = mediaExample(spec, media[1], "request");
        lines.push(`const body = ${json ? pretty(example ?? {}, "    ") : JSON.stringify(typeof example === "string" ? example : "")};`);
    }
    const response = ["", "function responseFunction({ status, data }) {", "    console.log(status, data);", "}", ""];
    let helper = HELPERS[method];
    let call;
    if (type === "multipart/form-data" && method !== "get") {
        helper = "uploadFile";
        const schema = resolveSchema(spec, media[1].schema).schema;
        const field = Object.entries(schema && isObject(schema.properties) ? schema.properties : {})
            .find(([, property]) => isObject(property) && (property.format === "binary" || property.contentMediaType !== undefined));
        const options = [["field", JSON.stringify(field ? field[0] : "file")]];
        if (method !== "post") options.push(["method", JSON.stringify(method.toUpperCase())]);
        if (headers.length) options.push(["headers", objectLiteral(headers)]);
        call = `// ${texts.snippetUpload}\nuploadFile(${url}, "file", responseFunction, ${objectLiteral(options)});`;
    } else if (helper && json) {
        const options = headers.length ? `, { headers: ${objectLiteral(headers)} }` : "";
        call = method === "get"
            ? `getJSON(${url}, responseFunction${options});`
            : `${helper}(${url}, ${type ? "body" : "undefined"}, responseFunction${options});`;
    } else {
        helper = null;
        if (type) headers.unshift(["Content-Type", JSON.stringify(type)]);
        const init = [`    method: ${JSON.stringify(method.toUpperCase())}`];
        if (headers.length) init.push(`    headers: ${objectLiteral(headers)}`);
        if (type) init.push(`    body: ${json ? "JSON.stringify(body)" : "body"}`);
        call = `// ${texts.snippetFetch(method.toUpperCase())}\nfetch(${url}, {\n${init.join(",\n")}\n})\n    .then(response => response.text().then(text => console.log(response.status, text)));`;
    }
    const head = helper ? [`import { ${helper} } from ${JSON.stringify(API_MODULE)};`, ""] : [];
    return head.concat(lines, helper ? response : [""], call).join("\n");
}

function operationId(entry, taken) {
    const raw = typeof entry.op.operationId === "string" && entry.op.operationId ? entry.op.operationId : `${entry.method}-${entry.path}`;
    const id = raw.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || entry.method;
    let unique = id;
    for (let n = 2; taken.has(unique) || document.getElementById(unique); n++) unique = `${id}-${n}`;
    taken.add(unique);
    return unique;
}

// Mengambil dan memeriksa spesifikasi. source: URL (JSON, atau YAML yang diurai dengan yaml.js)
// atau object yang sudah jadi. Promise tidak pernah reject; hasilnya { spec, error, message }:
// error null, atau "network" / "timeout" / "http" / "parse" / "swagger2" / "version", dengan
// message yang bisa dibaca orang. options: texts (pesan), timeout (ms, bawaan 15000).
export async function loadOpenAPI(source, options = {}) {
    const texts = { ...TEXTS, ...options.texts };
    const failed = (error, message) => ({ spec: null, error, message });
    let spec = source;
    if (typeof source === "string") {
        const controller = new AbortController();
        let timedOut = false;
        const timer = setTimeout(() => {
            timedOut = true;
            controller.abort();
        }, Number(options.timeout) > 0 ? Number(options.timeout) : TIMEOUT_MS);
        let text;
        try {
            const response = await fetch(source, { signal: controller.signal });
            text = await response.text();
            if (!response.ok) return failed("http", texts.loadHTTP(response.status));
        } catch (error) {
            console.warn(`loadOpenAPI ${source} gagal:`, error.message);
            return timedOut ? failed("timeout", texts.loadTimeout) : failed("network", texts.loadNetwork);
        } finally {
            clearTimeout(timer);
        }
        try {
            // JSON dikenali dari "{" di awal, supaya YAML tidak perlu diunduh untuk berkas JSON.
            if (text.trimStart()[0] === "{") {
                spec = JSON.parse(text);
            } else {
                const { parseYAML } = await import(sibling("yaml"));
                spec = parseYAML(text);
            }
        } catch (error) {
            if (!(error instanceof SyntaxError)) return failed("network", texts.loadNetwork);
            return failed("parse", texts.loadParse(error.message));
        }
    }
    if (isObject(spec) && spec.swagger !== undefined) return failed("swagger2", texts.swagger2);
    if (!isObject(spec) || !/^3\.\d/.test(String(spec.openapi))) return failed("version", texts.notOpenAPI);
    return { spec, error: null, message: "" };
}

// Menampilkan dokumentasi spesifikasi OpenAPI di dalam elemen id (isinya diganti). source: URL
// atau object spesifikasi. options: tryIt (true), snippets (true), server (URL dasar pengganti),
// expand (false: buka semua operasi), timeout (ms untuk memuat dan "Coba", bawaan 15000), texts,
// onError(result loadOpenAPI).
// Promise berisi { spec, element, remove() }, atau null kalau elemen tidak ada atau spesifikasi
// gagal dimuat (pesannya tampil di dalam elemen). Tidak pernah reject.
export async function renderOpenAPI(id, source, options = {}) {
    const container = document.getElementById(id);
    if (!container) {
        console.warn(`Elemen dengan ID "${id}" tidak ditemukan.`);
        return null;
    }
    injectStyles();
    const texts = { ...TEXTS, ...options.texts };
    container.replaceChildren(el("p", "crootjs-openapi-message", texts.loading));
    const timeout = Number(options.timeout) > 0 ? Number(options.timeout) : TIMEOUT_MS;
    const loaded = await loadOpenAPI(source, { texts, timeout });
    if (!loaded.spec) {
        const message = el("p", "crootjs-openapi-error", loaded.message);
        message.setAttribute("role", "alert");
        container.replaceChildren(message);
        if (typeof options.onError === "function") options.onError(loaded);
        return null;
    }
    const spec = loaded.spec;
    // Gagal mengunduh markdown.js (offline) tidak fatal: deskripsi tampil sebagai teks biasa.
    const markdown = hasDescription(spec)
        ? await import(sibling("markdown")).then(module => module.markdownToHTML, () => null)
        : null;
    const base = `crootjs-openapi-${++counter}`;
    const tryIt = options.tryIt !== false;
    const showSnippets = options.snippets !== false;
    const specURL = typeof source === "string" ? new URL(source, location.href).href : location.href;
    const servers = serverList(spec, specURL, options.server);
    let server = servers[0].url;
    const schemes = securitySchemes(spec);
    const tokens = new Map();
    const controllers = new Set();
    const snippetViews = [];
    let fieldCount = 0;
    const nextId = () => `${base}-${++fieldCount}`;

    const describe = text => {
        const box = el("div", "crootjs-openapi-md");
        if (markdown) box.innerHTML = markdown(String(text));
        else box.textContent = String(text);
        return box;
    };

    const field = (labelText, control) => {
        const wrap = el("div", "crootjs-openapi-field");
        const label = el("label", "", labelText);
        control.id = nextId();
        label.htmlFor = control.id;
        wrap.append(label, control);
        return wrap;
    };

    const codeBlock = (text, className) => {
        const pre = el("pre", className);
        // Blok yang bisa digulir harus bisa difokus supaya bisa digulir dengan keyboard.
        pre.tabIndex = 0;
        const code = el("code", "", text);
        pre.append(code);
        return { pre, code };
    };

    const collapsible = (title, content) => {
        const details = el("details");
        details.append(el("summary", "", title), content);
        return details;
    };

    function schemaNode(input, name, required, depth, stack, budget) {
        const li = el("li");
        const line = el("div", "crootjs-openapi-prop");
        li.append(line);
        if (name !== null) line.append(el("code", "", name));
        const { schema, ref } = resolveSchema(spec, input);
        if (--budget.left < 0 || depth > MAX_SCHEMA_DEPTH) {
            line.append(el("span", "crootjs-openapi-type", "…"));
            return li;
        }
        if (!schema) {
            line.append(el("span", "crootjs-openapi-type", ref ? texts.unresolved(ref) : "any"));
            return li;
        }
        if (ref && stack.includes(ref)) {
            line.append(el("span", "crootjs-openapi-type", `↻ ${refName(ref)}`));
            return li;
        }
        line.append(el("span", "crootjs-openapi-type", (ref ? `${refName(ref)} · ` : "") + typeLabel(spec, schema)));
        if (required) line.append(el("span", "crootjs-openapi-req", texts.required));
        const meta = constraints(schema, texts);
        if (meta) line.append(el("span", "crootjs-openapi-meta", meta));
        const description = isObject(input) && typeof input.description === "string" ? input.description : schema.description;
        if (typeof description === "string" && description) li.append(describe(description));
        const next = ref ? stack.concat(ref) : stack;
        const children = el("ul");
        const requiredList = Array.isArray(schema.required) ? schema.required : [];
        for (const [key, property] of Object.entries(isObject(schema.properties) ? schema.properties : {})) {
            children.append(schemaNode(property, key, requiredList.includes(key), depth + 1, next, budget));
        }
        if (isObject(schema.additionalProperties)) children.append(schemaNode(schema.additionalProperties, `[${texts.additional}]`, false, depth + 1, next, budget));
        if (schema.items !== undefined && !Array.isArray(schema.items)) children.append(schemaNode(schema.items, "[ ]", false, depth + 1, next, budget));
        if (children.childElementCount) li.append(children);
        for (const key of ["oneOf", "anyOf"]) {
            if (!Array.isArray(schema[key])) continue;
            const choices = el("ul");
            for (const choice of schema[key]) choices.append(schemaNode(choice, null, false, depth + 1, next, budget));
            li.append(el("div", "crootjs-openapi-meta", texts[key]), choices);
        }
        return li;
    }

    const schemaView = schema => {
        const tree = el("ul", "crootjs-openapi-tree");
        tree.append(schemaNode(schema, null, false, 0, [], { left: 300 }));
        return collapsible(texts.schema, tree);
    };

    // Isi media type: skema (terlipat) dan contoh.
    function mediaView(parent, type, media, direction) {
        parent.append(el("p", "crootjs-openapi-meta", type));
        if (media.schema !== undefined) parent.append(schemaView(media.schema));
        const example = mediaExample(spec, media, direction);
        if (example !== undefined) parent.append(codeBlock(typeof example === "string" && !/json/i.test(type) ? example : pretty(example)).pre);
    }

    function copyButton(code) {
        const button = el("button", "secondary", texts.copy);
        button.type = "button";
        let timer = null;
        button.addEventListener("click", () => {
            const write = navigator.clipboard ? navigator.clipboard.writeText(code.textContent) : Promise.reject(new Error("clipboard"));
            write.then(() => {
                button.textContent = texts.copied;
            }, () => {
                // Clipboard ditolak (bukan HTTPS, atau izin): teksnya dipilih supaya tinggal Ctrl+C.
                button.textContent = texts.copyFailed;
                getSelection().selectAllChildren(code);
            }).then(() => {
                clearTimeout(timer);
                timer = setTimeout(() => {
                    button.textContent = texts.copy;
                }, 2000);
            });
        });
        return button;
    }

    function tryForm(entry) {
        const form = el("form", "crootjs-openapi-try");
        const inputs = [];
        for (const param of entry.params) {
            if (param.unresolved || !["path", "query", "header"].includes(param.in)) continue;
            const schema = resolveSchema(spec, param.schema).schema || {};
            const example = paramExample(spec, param, false);
            let control;
            if (Array.isArray(schema.enum)) {
                control = el("select");
                if (!param.required) control.append(new Option("", ""));
                for (const value of schema.enum) control.append(new Option(String(value), String(value)));
            } else {
                control = el("input");
                control.type = "text";
            }
            if (example !== undefined && example !== null) control.value = typeof example === "object" ? JSON.stringify(example) : String(example);
            control.required = param.required === true;
            control.autocomplete = "off";
            inputs.push({ param, control });
            form.append(field(`${param.name} (${param.in})${param.required ? ` · ${texts.required}` : ""}`, control));
        }
        let bodyInput = null;
        const type = entry.media && entry.method !== "get" && entry.method !== "head" ? entry.media[0] : null;
        if (type && (/json/i.test(type) || /^text\/|urlencoded|xml/i.test(type))) {
            bodyInput = el("textarea");
            bodyInput.spellcheck = false;
            bodyInput.wrap = "off";
            const example = mediaExample(spec, entry.media[1], "request");
            bodyInput.value = example === undefined ? "" : typeof example === "string" && !/json/i.test(type) ? example : pretty(example);
            form.append(field(`${texts.requestBody} (${type})`, bodyInput));
        } else if (type) {
            form.append(el("p", "crootjs-openapi-meta", texts.unsupportedBody(type)));
        }
        const button = el("button", "", texts.send);
        button.type = "submit";
        const result = el("div", "crootjs-openapi-result");
        result.setAttribute("role", "status");
        form.append(button, result);

        form.addEventListener("submit", async event => {
            event.preventDefault();
            const query = new URLSearchParams();
            const headers = new Headers();
            let path = entry.path;
            for (const { param, control } of inputs) {
                const value = control.value;
                if (param.in === "path") path = path.split(`{${param.name}}`).join(encodeURIComponent(value));
                else if (value === "") continue;
                else if (param.in === "query") query.append(param.name, value);
                else headers.set(param.name, value);
            }
            const token = entry.auth ? tokens.get(entry.auth.name) : "";
            if (token) {
                if (entry.auth.type === "bearer") headers.set("Authorization", `Bearer ${token}`);
                else if (entry.auth.type === "query") query.set(entry.auth.key, token);
                else headers.set(entry.auth.key, token);
            }
            let body;
            if (bodyInput && bodyInput.value.trim()) {
                if (/json/i.test(type)) {
                    try {
                        JSON.parse(bodyInput.value);
                    } catch (error) {
                        bodyInput.setAttribute("aria-invalid", "true");
                        result.replaceChildren(el("p", "crootjs-openapi-error", texts.invalidJSON));
                        return;
                    }
                }
                bodyInput.removeAttribute("aria-invalid");
                body = bodyInput.value;
                headers.set("Content-Type", type);
            }
            const url = server + path + (String(query) ? `?${query}` : "");
            const method = entry.method.toUpperCase();
            const controller = new AbortController();
            controllers.add(controller);
            let timedOut = false;
            const timer = setTimeout(() => {
                timedOut = true;
                controller.abort();
            }, timeout);
            button.disabled = true;
            result.replaceChildren(el("p", "crootjs-openapi-message", texts.sending));
            const started = performance.now();
            try {
                const response = await fetch(url, { method, headers, body, signal: controller.signal });
                const text = await response.text();
                const ms = Math.round(performance.now() - started);
                const status = el("p", `crootjs-openapi-code crootjs-openapi-s${String(response.status)[0]}`, texts.status(`${response.status} ${response.statusText}`.trim(), ms));
                const list = [...response.headers].map(([key, value]) => `${key}: ${value}`);
                let shown = text.length > 200000 ? text.slice(0, 200000) + "\n…" : text;
                try {
                    shown = pretty(JSON.parse(text));
                } catch (error) {
                    // Bukan JSON: tampilkan teksnya apa adanya.
                }
                result.replaceChildren(el("p", "crootjs-openapi-meta", `${method} ${url}`), status,
                    collapsible(texts.responseHeaders(list.length), codeBlock(list.join("\n")).pre));
                if (text) result.append(codeBlock(shown).pre);
            } catch (error) {
                if (!controllers.has(controller)) return;
                console.warn(`${method} ${url} gagal:`, error.message);
                result.replaceChildren(el("p", "crootjs-openapi-error", timedOut ? texts.timeout(timeout / 1000) : texts.networkError));
            } finally {
                clearTimeout(timer);
                controllers.delete(controller);
                button.disabled = false;
            }
        });
        return form;
    }

    function buildBody(entry) {
        if (entry.built) return;
        entry.built = true;
        const { op } = entry;
        const body = el("div", "crootjs-openapi-body");
        if (typeof op.description === "string" && op.description) body.append(describe(op.description));
        const docs = isObject(op.externalDocs) && safeLink(op.externalDocs.url, op.externalDocs.description || texts.externalDocs);
        if (docs) {
            const line = el("p");
            line.append(docs);
            body.append(line);
        }

        if (entry.params.length) {
            body.append(el("h4", "", texts.parameters));
            const scroll = el("div", "crootjs-openapi-scroll");
            const table = el("table");
            const head = table.createTHead().insertRow();
            for (const title of texts.columns) {
                const th = el("th", "", title);
                th.scope = "col";
                head.append(th);
            }
            const tbody = table.createTBody();
            for (const param of entry.params) {
                const row = tbody.insertRow();
                const name = row.insertCell();
                if (param.unresolved) {
                    name.textContent = texts.unresolved(param.unresolved);
                    name.colSpan = 4;
                    continue;
                }
                name.append(el("code", "", param.name));
                if (param.required) name.append(" ", el("span", "crootjs-openapi-req", texts.required));
                if (param.deprecated) name.append(" ", el("span", "crootjs-openapi-flag", texts.deprecated));
                row.insertCell().textContent = String(param.in ?? "");
                const schema = resolveSchema(spec, param.schema).schema;
                row.insertCell().append(el("span", "crootjs-openapi-type", schema ? typeLabel(spec, schema) : "any"));
                const cell = row.insertCell();
                if (typeof param.description === "string" && param.description) cell.append(describe(param.description));
                const meta = schema ? constraints(schema, texts) : "";
                if (meta) cell.append(el("div", "crootjs-openapi-meta", meta));
            }
            scroll.append(table);
            body.append(scroll);
        }

        if (entry.body) {
            body.append(el("h4", "", texts.requestBody + (entry.body.required ? ` · ${texts.required}` : "")));
            if (typeof entry.body.description === "string" && entry.body.description) body.append(describe(entry.body.description));
            for (const [type, media] of Object.entries(isObject(entry.body.content) ? entry.body.content : {})) {
                if (isObject(media)) mediaView(body, type, media, "request");
            }
        }

        const responses = isObject(op.responses) ? Object.entries(op.responses) : [];
        if (responses.length) {
            body.append(el("h4", "", texts.responses));
            for (const [code, raw] of responses) {
                const { value, ref } = follow(spec, raw);
                const box = el("div", "crootjs-openapi-response");
                const title = el("p");
                title.append(el("span", `crootjs-openapi-code crootjs-openapi-s${code[0]}`, code));
                box.append(title);
                if (!isObject(value)) {
                    title.append(texts.unresolved(ref));
                } else {
                    if (typeof value.description === "string" && value.description) box.append(describe(value.description));
                    for (const [type, media] of Object.entries(isObject(value.content) ? value.content : {})) {
                        if (isObject(media)) mediaView(box, type, media, "response");
                    }
                }
                body.append(box);
            }
        }

        if (showSnippets) {
            const { pre, code } = codeBlock(snippet(spec, entry, server, texts), "crootjs-openapi-snippet");
            const bar = el("div", "crootjs-openapi-bar");
            bar.append(el("h4", "", texts.snippet), copyButton(code));
            body.append(bar, pre);
            snippetViews.push({ entry, code });
        }
        if (tryIt) body.append(el("h4", "", texts.tryIt), tryForm(entry));
        entry.details.append(body);
    }

    const root = el("div", "crootjs-openapi");
    const info = isObject(spec.info) ? spec.info : {};
    const header = el("header", "crootjs-openapi-info");
    const title = el("h2", "", String(info.title ?? "API"));
    if (info.version !== undefined) title.append(el("span", "crootjs-openapi-badge", String(info.version)));
    title.append(el("span", "crootjs-openapi-badge", `OpenAPI ${spec.openapi}`));
    header.append(title);
    if (typeof info.description === "string" && info.description) header.append(describe(info.description));
    const links = el("ul", "crootjs-openapi-links");
    const addLink = (raw, text) => {
        const link = safeLink(raw, text);
        if (!link) return;
        const item = el("li");
        item.append(link);
        links.append(item);
    };
    const contact = isObject(info.contact) ? info.contact : {};
    addLink(contact.url, `${texts.contact}: ${contact.name || contact.url}`);
    if (typeof contact.email === "string") addLink(`mailto:${contact.email}`, contact.email);
    if (isObject(info.license)) addLink(info.license.url, `${texts.license}: ${info.license.name || info.license.url}`);
    addLink(info.termsOfService, texts.terms);
    if (isObject(spec.externalDocs)) addLink(spec.externalDocs.url, spec.externalDocs.description || texts.externalDocs);
    if (links.childElementCount) header.append(links);
    root.append(header);

    const tools = el("div", "crootjs-openapi-tools");
    if (servers.length > 1) {
        const select = el("select");
        for (const item of servers) select.append(new Option(item.description ? `${item.url} (${item.description})` : item.url, item.url));
        select.addEventListener("change", () => {
            server = select.value;
            for (const view of snippetViews) view.code.textContent = snippet(spec, view.entry, server, texts);
        });
        tools.append(field(texts.server, select));
    } else {
        const line = el("p", "crootjs-openapi-server", `${texts.server}: `);
        line.append(el("code", "", server));
        root.append(line);
    }
    if (tryIt) {
        for (const [name, kind] of schemes) {
            const input = el("input");
            input.type = "password";
            input.autocomplete = "off";
            input.spellcheck = false;
            // Token hanya disimpan di memori halaman ini, tidak di storage atau cookie.
            input.addEventListener("input", () => tokens.set(name, input.value.trim()));
            tools.append(field(`${name} (${kind.type === "bearer" ? "Bearer token" : `API key, ${kind.type} ${kind.key}`})`, input));
        }
    }
    const filter = el("input");
    filter.type = "search";
    filter.autocomplete = "off";
    tools.append(field(texts.filter, filter));
    root.append(tools);

    const entries = collectOperations(spec, schemes);
    const taken = new Set();
    const byId = new Map();
    const groups = new Map();
    for (const tag of Array.isArray(spec.tags) ? spec.tags : []) {
        if (isObject(tag) && typeof tag.name === "string" && !groups.has(tag.name)) groups.set(tag.name, { tag, entries: [] });
    }
    const untagged = { tag: { name: texts.untagged }, entries: [] };
    for (const entry of entries) {
        const tagName = Array.isArray(entry.op.tags) && typeof entry.op.tags[0] === "string" ? entry.op.tags[0] : null;
        // Operasi dengan beberapa tag hanya tampil di tag pertamanya, supaya id tautannya tunggal.
        if (tagName !== null && !groups.has(tagName)) groups.set(tagName, { tag: { name: tagName }, entries: [] });
        (tagName === null ? untagged : groups.get(tagName)).entries.push(entry);
    }
    groups.set(null, untagged);

    const sections = [];
    for (const group of groups.values()) {
        if (!group.entries.length) continue;
        const section = el("section", "crootjs-openapi-tag");
        section.append(el("h3", "", group.tag.name));
        if (typeof group.tag.description === "string" && group.tag.description) section.append(describe(group.tag.description));
        for (const entry of group.entries) {
            const { op, method, path } = entry;
            const details = el("details", "crootjs-openapi-op");
            entry.details = details;
            details.id = operationId(entry, taken);
            byId.set(details.id, entry);
            if (op.deprecated) details.classList.add("crootjs-openapi-gone");
            const summary = el("summary");
            summary.append(el("span", `crootjs-openapi-method crootjs-openapi-${method}`, method.toUpperCase()), el("span", "crootjs-openapi-path", path));
            if (typeof op.summary === "string" && op.summary) summary.append(el("span", "crootjs-openapi-summary", op.summary));
            if (op.deprecated) summary.append(el("span", "crootjs-openapi-flag", texts.deprecated));
            details.append(summary);
            entry.text = [method, path, op.summary, op.operationId].filter(part => typeof part === "string").join(" ").toLowerCase();
            details.addEventListener("toggle", () => {
                if (details.open) buildBody(entry);
            });
            // Klik (dan Enter/Spasi) pada summary terjadi sebelum details berubah, jadi open masih
            // nilai lama. Isinya dibuat di sini juga, karena toggle baru datang sesudah details
            // tergambar kosong. Hash tidak diubah saat dibuka oleh kode (expand, tautan).
            summary.addEventListener("click", () => {
                const hash = `#${details.id}`;
                if (!details.open) {
                    buildBody(entry);
                    history.replaceState(history.state, "", hash);
                } else if (location.hash === hash) history.replaceState(history.state, "", location.pathname + location.search);
            });
            if (options.expand) {
                details.open = true;
                buildBody(entry);
            }
            section.append(details);
        }
        sections.push({ section, entries: group.entries });
        root.append(section);
    }
    const empty = el("p", "crootjs-openapi-message", texts.noMatch);
    empty.hidden = sections.length > 0;
    empty.setAttribute("role", "status");
    root.append(empty);

    filter.addEventListener("input", () => {
        const needle = filter.value.trim().toLowerCase();
        let shown = 0;
        for (const entry of entries) {
            entry.details.hidden = Boolean(needle) && !entry.text.includes(needle);
            if (!entry.details.hidden) shown++;
        }
        for (const { section, entries: list } of sections) section.hidden = list.every(entry => entry.details.hidden);
        empty.hidden = shown > 0;
    });

    function openFromHash() {
        let target;
        try {
            target = decodeURIComponent(location.hash.slice(1));
        } catch (error) {
            return;
        }
        const entry = byId.get(target);
        if (!entry) return;
        entry.details.open = true;
        buildBody(entry);
        entry.details.scrollIntoView({ block: "start" });
    }

    container.replaceChildren(root);
    openFromHash();
    window.addEventListener("hashchange", openFromHash);

    return {
        spec,
        element: root,
        remove() {
            window.removeEventListener("hashchange", openFromHash);
            const pending = [...controllers];
            controllers.clear();
            pending.forEach(controller => controller.abort());
            root.remove();
        }
    };
}
