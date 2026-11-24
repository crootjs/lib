"""Membangkitkan crootjs.d.ts dari kode sumber: satu file deklarasi TypeScript untuk semua
modul, ditulis sebagai `declare module "https://cdn.jsdelivr.net/gh/crootjs/lib@*/<modul>.js"`
(dan .min.js), supaya VS Code memberi autocomplete, urutan parameter, dan dokumentasi untuk
import langsung dari CDN. Komentar di atas setiap fungsi menjadi JSDoc-nya.

    python3 tools/build-types.py        # dari folder lib; jalankan setiap rilis
"""
import os
import re

LIB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CDN = "https://cdn.jsdelivr.net/gh/crootjs/lib@*/"
SKIP = {"mongo.js", "serviceworker.js"}  # untuk server / skrip klasik service worker, bukan modul halaman

FUNCTION = "(...args: any[]) => any"
# Tipe bersama untuk api.js, dipakai deklarasi di OVERRIDES lewat CrootJS.<nama>.
SHARED = """declare namespace CrootJS {
    type Failure = "timeout" | "abort" | "offline" | "network";
    /** Hasil api.js. error: null, atau jenis kegagalan saat status 0 (lihat docs api.js). */
    interface Result<T = any, E = never> {
        status: number;
        data: T;
        headers: Headers;
        error: null | Failure | E;
        /** getJSON dengan cache: true kalau data dari cache. */
        cached?: boolean;
        /** getJSON dengan cache.staleIfError: true kalau request gagal dan data tersimpan dipakai. */
        stale?: boolean;
        /** Kalau stale: status HTTP kegagalannya, atau jenis kegagalan jaringan. */
        staleReason?: number | "timeout" | "offline" | "network";
    }
    type Callback<R> = ((result: R) => void) | null;
    interface RequestOptions {
        /** Header tambahan, mis. { Authorization: "Bearer " + token }. */
        headers?: Record<string, string> | Headers;
        /** Milidetik sebelum request dibatalkan. Bawaan 15000. */
        timeout?: number;
        /** controller.abort() membatalkan request (error "abort"). */
        signal?: AbortSignal;
    }
    interface CacheOptions<T = any> {
        /** Nama entri di localStorage. */
        key: string;
        /** Detik tanpa request sama sekali. */
        ttl?: number;
        /** Request sesudah ttl gagal: pakai data tersimpan (stale: true). */
        staleIfError?: boolean;
        /** Memangkas balasan 2xx sebelum disimpan dan dikembalikan. */
        select?: (data: any) => T;
    }
    interface GetOptions<T = any> extends RequestOptions {
        cache?: CacheOptions<T>;
    }
    interface UploadOptions extends RequestOptions {
        /** Nama field file. Bawaan "file". */
        field?: string;
        /** Field tambahan di form. */
        data?: Record<string, string | Blob>;
        /** Bawaan "POST". */
        method?: string;
        onProgress?: (fraction: number, loaded: number, total: number) => void;
    }
    interface DownloadOptions extends RequestOptions {
        /** Kalau diisi, file 2xx langsung disimpan browser dengan nama ini. */
        fileName?: string;
    }
}
"""

# Fungsi yang deklarasinya ditulis tangan (overload, generik), menggantikan hasil otomatis.
# Komentar di atas fungsinya tetap menjadi JSDoc.
OVERRIDES = {
    ("api.js", "getJSON"): [
        "getJSON<T = any>(target_url: string, responseFunction: CrootJS.Callback<CrootJS.Result<T, \"select\">> | undefined, options: CrootJS.GetOptions<T>): Promise<CrootJS.Result<T, \"select\">>",
        "getJSON<T = any>(target_url: string, responseFunction?: CrootJS.Callback<CrootJS.Result<T>>, tokenkey?: string, tokenvalue?: string): Promise<CrootJS.Result<T>>",
    ],
    **{("api.js", name): [
        f"{name}<T = any>(target_url: string, datajson: any, responseFunction: CrootJS.Callback<CrootJS.Result<T>> | undefined, options: CrootJS.RequestOptions): Promise<CrootJS.Result<T>>",
        f"{name}<T = any>(target_url: string, datajson: any, responseFunction?: CrootJS.Callback<CrootJS.Result<T>>, tokenkey?: string, tokenvalue?: string): Promise<CrootJS.Result<T>>",
    ] for name in ("postJSON", "putJSON", "deleteJSON")},
    ("api.js", "uploadFile"): [
        "uploadFile<T = any>(target_url: string, source: string | Blob | FileList | File[] | FormData, responseFunction?: CrootJS.Callback<CrootJS.Result<T, \"nofile\">>, options?: CrootJS.UploadOptions): Promise<CrootJS.Result<T, \"nofile\">>",
    ],
    ("api.js", "downloadFile"): [
        "downloadFile(target_url: string, responseFunction?: CrootJS.Callback<CrootJS.Result<Blob | any>>, options?: CrootJS.DownloadOptions): Promise<CrootJS.Result<Blob | any>>",
    ],
}

# Tipe hasil yang diketahui; selain ini `any`.
RETURNS = {
    ("element.js", "serializeForm"): "Record<string, string | boolean | string[]>",
    ("form.js", "validateForm"): "boolean",
    ("form.js", "handleForm"): "{ validate(): boolean; clear(): void; remove(): void }",
    ("mapcache.js", "cachedTiles"): "{ getTile(z: number, x: number, y: number): Promise<Blob | string | null>; url: string; attribution: any; count(): Promise<number>; clear(): Promise<boolean>; downloadArea(bounds: number[], minZoom: number, maxZoom: number, onProgress?: (done: number, total: number) => void): Promise<{ total: number; saved: number; failed: number; error: string | null }> }",
    ("mapvector.js", "decodeMVT"): "Record<string, { extent: number; features: { type: number; properties: Record<string, any>; geometry: number[][][] }[] }>",
    ("mapvector.js", "renderVectorTile"): "Promise<Blob>",
    ("model3d.js", "loadModel"): "Promise<{ parts: string[]; triangles: number; bounds: { min: number[]; max: number[]; center: number[]; size: number[] } | null } | null>",
    ("model3dtools.js", "measureModel"): "{ getResult(): { mode: string; points: number[][]; distance: number | null; angle: number | null; text: string; complete: boolean }; clear(): void; remove(): void }",
    ("model3dtools.js", "isARSupported"): "Promise<boolean>",
    ("model3dtools.js", "startAR"): "Promise<{ supported: boolean; end(): void }>",
    ("model3dtools.js", "exportGLB"): "Promise<Blob | null>",
    ("model3dtools.js", "downloadGLB"): "Promise<Blob | null>",
    ("qr.js", "qrMatrix"): "boolean[][]",
    ("qr.js", "qrSVG"): "string",
    ("qr.js", "renderQR"): "SVGSVGElement",
    ("table.js", "createTable"): "{ setRows(rows: Record<string, any>[]): Promise<void>; refresh(): Promise<void>; ready: Promise<void>; getState(): { page: number; pageSize: number; sort: { key: string; dir: \"asc\" | \"desc\" } | null; query: string; total: number }; remove(): void } | null",
    ("chart.js", "niceScale"): "{ min: number; max: number; step: number; ticks: number[] }",
    ("chart.js", "createChart"): "{ element: HTMLElement; update(changes: Record<string, any>): void; remove(): void } | null",
    ("router.js", "startRouter"): "{ navigate(path: string, options?: { replace?: boolean }): Promise<void>; href(path: string): string; current(): { path: string; params: Record<string, string>; query: URLSearchParams; pattern: string | null } | null; stop(): void }",
    ("markdown.js", "markdownToHTML"): "string",
    ("markdown.js", "renderMarkdown"): "string",
    ("markdown.js", "getMarkdown"): "Promise<{ status: number; data: string; markdown: string; error: null | \"timeout\" | \"abort\" | \"offline\" | \"network\" }>",
    ("yaml.js", "parseYAML"): "any",
    ("openapi.js", "loadOpenAPI"): "Promise<{ spec: Record<string, any> | null; error: null | \"network\" | \"timeout\" | \"http\" | \"parse\" | \"swagger2\" | \"version\"; message: string }>",
    ("openapi.js", "renderOpenAPI"): "Promise<{ spec: Record<string, any>; element: HTMLElement; remove(): void } | null>",
    ("openapi.js", "openAPIExample"): "any",
    ("pwa.js", "registerServiceWorker"): "Promise<{ ok: boolean; registration: ServiceWorkerRegistration | null; error: \"insecure\" | \"unsupported\" | \"failed\" | null }>",
    ("pwa.js", "onNetworkChange"): "() => void",
    ("pwa.js", "isStandalone"): "boolean",
    ("pwa.js", "installButton"): "void",
}


def param_type(name, default):
    lower = name.lower()
    if lower.endswith("function") or lower in ("callback", "fn", "items"):
        return FUNCTION if lower != "items" else "any"
    if default is not None:
        if default.startswith(("\"", "'", "`")):
            return "string"
        if re.fullmatch(r"-?[\d.]+", default):
            return "number"
        if default in ("true", "false"):
            return "boolean"
        if default.startswith("{"):
            return "Record<string, any>"
    if lower in ("id", "url", "target_url", "name", "key", "classname", "filename", "type", "mode", "corner"):
        return "string"
    if lower in ("position", "center", "point", "from", "to"):
        return "number[]"
    return "any"


def split_params(text):
    params, depth, current = [], 0, ""
    for char in text:
        if char in "([{":
            depth += 1
        elif char in ")]}":
            depth -= 1
        if char == "," and depth == 0:
            params.append(current.strip())
            current = ""
        else:
            current += char
    if current.strip():
        params.append(current.strip())
    return params


def declarations(module, seen=None):
    seen = seen or set()
    if module in seen:
        return []
    seen.add(module)
    source = open(os.path.join(LIB, module), encoding="utf-8").read()
    lines = source.split("\n")
    result = []
    for number, line in enumerate(lines):
        reexport = re.match(r'export \* from "\./([\w]+\.js)";', line)
        if reexport:
            result += declarations(reexport.group(1), seen)
            continue
        match = re.match(r"export (async )?function (\w+)\((.*)\)\s*\{", line)
        if not match:
            continue
        name = match.group(2)
        # Komentar // tepat di atas fungsi menjadi JSDoc.
        comment = []
        k = number - 1
        while k >= 0 and lines[k].strip().startswith("//"):
            comment.insert(0, lines[k].strip()[2:].strip())
            k -= 1
        params = []
        for raw in split_params(match.group(3)):
            raw = raw.strip()
            if raw.startswith("..."):
                params.append(f"...{raw[3:]}: any[]")
                continue
            if "=" in raw:
                pname, default = [part.strip() for part in raw.split("=", 1)]
                params.append(f"{pname}?: {param_type(pname, default)}")
            else:
                params.append(f"{raw}?: {param_type(raw, None)}" if raw.lower().endswith("function") and name not in ("onClick", "onChange", "onInput") else f"{raw}: {param_type(raw, None)}")
        # Sesudah parameter opsional pertama, sisanya juga opsional (aturan TypeScript).
        optional = False
        for i, param in enumerate(params):
            if param.startswith("...") or "?:" in param:
                optional = True
            elif optional:
                params[i] = param.replace(":", "?:", 1)
        returns = RETURNS.get((module, name), "Promise<any>" if match.group(1) else "any")
        doc = ""
        if comment:
            doc = "    /**\n" + "".join(f"     * {text}\n" for text in comment) + "     */\n"
        if (module, name) in OVERRIDES:
            result.append("\n".join(f"{doc}    export function {signature};" for signature in OVERRIDES[(module, name)]))
            continue
        result.append(f"{doc}    export function {name}({', '.join(params)}): {returns};")
    for match in re.finditer(r"^export (?:const|let) (\w+)", source, re.M):
        result.append(f"    export const {match.group(1)}: any;")
    for match in re.finditer(r"^export \{ ([\w, ]+) \};", source, re.M):
        for name in match.group(1).split(","):
            result.append(f"    export const {name.strip()}: any;")
    return result


def main():
    # .min.js lokal (dari tools/build-min.py) bukan modul tersendiri.
    modules = sorted(name for name in os.listdir(LIB) if name.endswith(".js") and not name.endswith(".min.js") and name not in SKIP)
    out = [
        "// Deklarasi tipe CrootJS untuk import dari jsDelivr. Dibangkitkan oleh tools/build-types.py dari",
        "// kode sumber - jangan diubah manual. Salin ke folder proyek (di samping jsconfig.json),",
        "// lalu VS Code memberi autocomplete untuk:",
        f'//   import {{ createMap }} from "{CDN.replace("*", "<versi>")}map.min.js";',
        "",
        SHARED,
    ]
    for module in modules:
        body = "\n".join(declarations(module))
        for suffix in (".js", ".min.js"):
            out.append(f'declare module "{CDN}{module[:-3]}{suffix}" {{')
            out.append(body)
            out.append("}")
            out.append("")
    open(os.path.join(LIB, "crootjs.d.ts"), "w", encoding="utf-8").write("\n".join(out))
    print(f"crootjs.d.ts: {len(modules)} modul")


main()
