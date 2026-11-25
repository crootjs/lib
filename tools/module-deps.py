"""Mencetak, dalam Markdown, modul CrootJS yang mengimpor modul lain beserta seluruh dependensinya
(termasuk dependensi dari dependensi), dan potongan <link rel="modulepreload"> untuk masing-masing.
Hasilnya ditempel ke docs (README "Memuat lebih cepat").

Tanpa modulepreload browser baru tahu storage.min.js dibutuhkan setelah api.min.js selesai
diunduh: setiap tingkat import menambah satu kali bolak-balik ke server (~150 ms di seluler).

Dengan versi rilis, setiap baris juga diberi integrity (hash SRI dari integrity.json rilis itu,
lewat tools/bump-pins.py), supaya bisa ditempel apa adanya.

    python3 tools/module-deps.py [versi]     # versi bawaan "<versi>", tanpa integrity
"""
import glob
import importlib.util
import os
import re
import sys

LIB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CDN = "https://cdn.jsdelivr.net/gh/crootjs/lib@{version}/{name}.min.js"
# Hanya pernyataan di awal baris, bukan contoh import di dalam komentar.
STATEMENT = re.compile(r"""^(?:import|export)\b[^;]*?\bfrom\s*["']\./([\w-]+)\.js["']|^import\s*["']\./([\w-]+)\.js["']""", re.M)


def direct():
    deps = {}
    for path in sorted(glob.glob(os.path.join(LIB, "*.js"))):
        name = os.path.basename(path)[:-3]
        if name.endswith(".min"):
            continue
        found = []
        for match in STATEMENT.finditer(open(path, encoding="utf-8").read()):
            dep = match.group(1) or match.group(2)
            if dep not in found:
                found.append(dep)
        deps[name] = found
    return deps


def closure(deps, name):
    order = []
    def visit(module):
        for dep in deps.get(module, []):
            if dep not in order:
                order.append(dep)
                visit(dep)
    visit(name)
    return order


def depth(deps, name, seen=()):
    return max((1 + depth(deps, dep, seen + (name,)) for dep in deps.get(name, []) if dep not in seen), default=0)


def hashes():
    spec = importlib.util.spec_from_file_location("bump_pins", os.path.join(LIB, "tools", "bump-pins.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.Hashes()


def main():
    version = sys.argv[1] if len(sys.argv) > 1 else "<versi>"
    sri = hashes() if version != "<versi>" else None
    deps = direct()
    rows = [(name, closure(deps, name), depth(deps, name)) for name in deps if deps[name]]
    print("| Modul | Ikut dimuat | Tingkat |")
    print("|---|---|---|")
    for name, needed, levels in rows:
        print(f"| `{name}.js` | {', '.join(f'`{dep}.js`' for dep in needed)} | {levels} |")
    print()
    for name, needed, _ in rows:
        print(f"`{name}.min.js`:\n")
        print("```html")
        for module in [name] + needed:
            integrity = f' integrity="{sri.integrity(version, module + ".min.js")}"' if sri else ""
            print(f'<link rel="modulepreload" href="{CDN.format(version=version, name=module)}"{integrity}>')
        print("```\n")


if __name__ == "__main__":
    main()
