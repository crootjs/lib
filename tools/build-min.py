"""Membuat <modul>.min.js (dan .min.js.map) untuk setiap modul, dengan import relatif yang
diarahkan ke ./<modul>.min.js. Dipakai tools/release.py: berkasnya masuk ke commit tag rilis saja,
bukan ke main, lalu jsDelivr menyajikannya apa adanya.

Tanpa ini jsDelivr memperkecil sendiri, tetapi tidak mengubah path import: api.min.js mengimpor
"./storage.js", sehingga halaman yang juga memuat storage.min.js mendapat dua salinan modul
storage, masing-masing dengan state sendiri (mapmodel.js + model3d.js lebih parah: viewer yang
dibuat lewat satu salinan tidak dikenal salinan lain).

    python3 tools/build-min.py          # terser lewat npx (versi dipatok di TERSER)
    TERSER=/path/ke/terser python3 tools/build-min.py
"""
import glob
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


def main():
    built = []
    with tempfile.TemporaryDirectory() as workdir:
        for name in modules():
            built.append(build(name, workdir))
    print(f"{len(built)} berkas .min.js dibuat")


if __name__ == "__main__":
    main()
