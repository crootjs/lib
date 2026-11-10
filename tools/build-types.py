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
SKIP = {"mongo.js"}  # untuk server, bukan browser

FUNCTION = "(...args: any[]) => any"
# Tipe hasil yang diketahui; selain ini `any`.
RETURNS = {
    ("api.js", "getJSON"): "Promise<{ status: number; data: any }>",
    ("api.js", "postJSON"): "Promise<{ status: number; data: any }>",
    ("api.js", "putJSON"): "Promise<{ status: number; data: any }>",
    ("api.js", "deleteJSON"): "Promise<{ status: number; data: any }>",
    ("model3d.js", "loadModel"): "Promise<{ parts: string[]; triangles: number; bounds: { min: number[]; max: number[]; center: number[]; size: number[] } | null } | null>",
    ("model3dtools.js", "exportGLB"): "Promise<Blob | null>",
    ("model3dtools.js", "downloadGLB"): "Promise<Blob | null>",
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
        result.append(f"{doc}    export function {name}({', '.join(params)}): {returns};")
    for match in re.finditer(r"^export (?:const|let) (\w+)", source, re.M):
        result.append(f"    export const {match.group(1)}: any;")
    for match in re.finditer(r"^export \{ ([\w, ]+) \};", source, re.M):
        for name in match.group(1).split(","):
            result.append(f"    export const {name.strip()}: any;")
    return result


def main():
    modules = sorted(name for name in os.listdir(LIB) if name.endswith(".js") and name not in SKIP)
    out = [
        "// Deklarasi tipe CrootJS untuk import dari jsDelivr. Dibangkitkan oleh tools/build-types.py dari",
        "// kode sumber - jangan diubah manual. Salin ke folder proyek (di samping jsconfig.json),",
        "// lalu VS Code memberi autocomplete untuk:",
        f'//   import {{ createMap }} from "{CDN.replace("*", "<versi>")}map.min.js";',
        "",
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
