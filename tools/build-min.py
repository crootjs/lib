"""Membuat <modul>.min.js (dan .min.js.map) untuk setiap modul, dengan import relatif yang
diarahkan ke ./<modul>.min.js. Dipakai tools/release.py: berkasnya masuk ke commit tag rilis saja,
bukan ke main, lalu jsDelivr menyajikannya apa adanya.

Tanpa ini jsDelivr memperkecil sendiri, tetapi tidak mengubah path import: api.min.js mengimpor
"./storage.js", sehingga halaman yang juga memuat storage.min.js mendapat dua salinan modul
storage, masing-masing dengan state sendiri (mapmodel.js + model3d.js lebih parah: viewer yang
dibuat lewat satu salinan tidak dikenal salinan lain).

Sekaligus menulis integrity.json: hash SRI (sha384) setiap .js, .min.js, dan .css, plus import
relatif tiap modul, untuk atribut integrity dan tools/bump-pins.py. jsDelivr menyajikan berkas
dari tag byte per byte, jadi hash ini cocok dengan yang diunduh browser; kecuali .min.css, yang
dibuat jsDelivr sendiri dan tidak ada di tag.

    python3 tools/build-min.py          # terser lewat npx (versi dipatok di TERSER)
    TERSER=/path/ke/terser python3 tools/build-min.py
"""
import base64
import glob
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile

LIB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TERSER = os.environ.get("TERSER", "npx --yes terser@5.51.4").split()
# Skrip klasik (bukan modul ES): dimuat lewat importScripts di service worker pengguna.
CLASSIC = {"serviceworker.js"}
# from "./x.js", import "./x.js", import("./x.js"), export ... from "./x.js"
RELATIVE = re.compile(r"""((?:\bfrom|\bimport)\s*\(?\s*)(["'])\./([\w-]+)\.js\2""")
# Import dinamis dengan URL hasil hitungan (sibling() di openapi.js), yang tidak terbaca regex.
DYNAMIC = {"openapi": ["yaml", "markdown"]}
MIN_RELATIVE = re.compile(r"""(?:\bfrom|\bimport)\s*\(?\s*["']\./([\w-]+)\.min\.js["']""")


def modules():
    return sorted(name for name in map(os.path.basename, glob.glob(os.path.join(LIB, "*.js")))
                  if not name.endswith(".min.js"))


def build(name, workdir):
    source = open(os.path.join(LIB, name), encoding="utf-8").read()
    rewritten = RELATIVE.sub(lambda m: f"{m.group(1)}{m.group(2)}./{m.group(3)}.min.js{m.group(2)}", source)
    # Nama berkas sumber sama dengan aslinya, supaya source map menunjuk ke nama yang dikenal.
    temp = os.path.join(workdir, name)
    open(temp, "w", encoding="utf-8").write(rewritten)
    target = name[:-3] + ".min.js"
    args = TERSER + [name, "-c", "-m", "-o", os.path.join(LIB, target),
                     "--source-map", f"url='{target}.map',includeSources"]
    if name not in CLASSIC:
        args.append("--module")
    result = subprocess.run(args, cwd=workdir, capture_output=True, text=True)
    if result.returncode != 0:
        sys.exit(f"terser {name} gagal:\n{result.stderr}")
    output = open(os.path.join(LIB, target), encoding="utf-8").read()
    leftover = RELATIVE.findall(output.replace(".min.js", ".MIN"))
    if leftover:
        sys.exit(f"{target} masih mengimpor versi biasa: {leftover}")
    return target


def sri(path):
    return "sha384-" + base64.b64encode(hashlib.sha384(open(path, "rb").read()).digest()).decode()


def write_integrity(built):
    names = sorted(modules() + built + [os.path.basename(path) for path in glob.glob(os.path.join(LIB, "*.css"))])
    # Dari hasil terser, yang sudah tanpa komentar (contoh import di komentar tidak ikut);
    # modul .js mengimpor nama yang sama tanpa .min.
    imports = {}
    for name in built:
        output = open(os.path.join(LIB, name), encoding="utf-8").read()
        found = list(dict.fromkeys(MIN_RELATIVE.findall(output) + DYNAMIC.get(name[:-7], [])))
        if found:
            imports[name] = [dep + ".min.js" for dep in found]
            imports[name[:-7] + ".js"] = [dep + ".js" for dep in found]
    data = {"files": {name: sri(os.path.join(LIB, name)) for name in names}, "imports": imports}
    with open(os.path.join(LIB, "integrity.json"), "w", encoding="utf-8") as file:
        json.dump(data, file, indent=1)
        file.write("\n")


def main():
    built = []
    with tempfile.TemporaryDirectory() as workdir:
        for name in modules():
            built.append(build(name, workdir))
    write_integrity(built)
    print(f"{len(built)} berkas .min.js dibuat, hash di integrity.json")


if __name__ == "__main__":
    main()
