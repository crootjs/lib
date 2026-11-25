"""Menaikkan pin CrootJS (crootjs/lib@<versi>) di sebuah folder dan memperbarui hash SRI-nya.
Dipakai workflow keempat repo CrootJS setelah rilis, dan untuk proyek pengguna:

    python3 bump-pins.py 0.0.42 [folder]
    python3 bump-pins.py latest [folder]      # versi dari https://croot.js.org/lib/version.json

Hanya butuh Python 3 (tanpa paket tambahan). Yang diubah, di berkas .html, .js, .md, .txt, .json:

- setiap crootjs/lib@x.y.z menjadi versi baru;
- atribut integrity="..." di tag <link>/<script> yang menunjuk ke jsDelivr CrootJS;
- pasangan "https://cdn.jsdelivr.net/gh/crootjs/lib@x.y.z/<berkas>": "sha384-..." (import map,
  mis. di integrity.js). Nilai kosong ("") ikut diisi, jadi entri baru cukup ditulis tanpa hash.

Hash diambil dari integrity.json rilis itu (sejak 0.0.42); untuk versi yang lebih lama berkasnya
diunduh dan di-hash. Kalau ada yang gagal diunduh, tidak ada berkas yang ditulis. Import map yang
tidak memuat modul yang diimpor modul lain di dalamnya (mis. storage.min.js untuk api.min.js)
dilaporkan, karena modul itu akan dimuat tanpa dicek. CHANGELOG.md, llms-full.txt, dan
crootjs.d.ts tidak diubah.
"""
import base64
import hashlib
import json
import os
import re
import sys
import urllib.error
import urllib.request

CDN = "https://cdn.jsdelivr.net/gh/crootjs/lib@{version}/{name}"
VERSION_JSON = "https://croot.js.org/lib/version.json"
EXTENSIONS = (".html", ".js", ".md", ".txt", ".json")
SKIP_FILES = {"CHANGELOG.md", "llms-full.txt", "crootjs.d.ts"}
SKIP_DIRS = {".git", "node_modules"}
PIN = re.compile(r"(crootjs/lib|\.\.\./lib)@\d+\.\d+\.\d+")
URL = r"https://cdn\.jsdelivr\.net/gh/crootjs/lib@(\d+\.\d+\.\d+)/([\w.-]+)"
TAG = re.compile(r"<(?:link|script)\b[^<>]*>")
TAG_URL = re.compile(r"""(?:href|src)\s*=\s*["']""" + URL + r"""["']""")
TAG_INTEGRITY = re.compile(r"""(integrity\s*=\s*)(["'])[^"']*\2""")
PAIR = re.compile(r"""(["'])(""" + URL + r""")\1(\s*:\s*)(["'])(?:sha\d{3}-[A-Za-z0-9+/=]+)?\6""")
# Import relatif di berkas yang diunduh (versi sebelum ada integrity.json).
RELATIVE = re.compile(r"""(?:\bfrom|\bimport)\s*\(?\s*["']\./([\w-]+(?:\.min)?\.js)["']""")
# Import dinamis dengan URL hasil hitungan, yang tidak terbaca RELATIVE.
DYNAMIC = {"openapi": ["yaml", "markdown"]}


def download(url):
    try:
        with urllib.request.urlopen(url, timeout=30) as response:
            return response.read()
    except urllib.error.HTTPError as error:
        if error.code == 404:
            return None
        sys.exit(f"{url}: HTTP {error.code}")
    except (urllib.error.URLError, TimeoutError) as error:
        sys.exit(f"{url}: {error}")


class Hashes:
    def __init__(self):
        self.releases = {}

    def release(self, version):
        if version not in self.releases:
            data = download(CDN.format(version=version, name="integrity.json"))
            if data is None:
                print(f"lib@{version} belum punya integrity.json: hash dihitung dari berkas yang diunduh.", file=sys.stderr)
                self.releases[version] = {"files": {}, "imports": {}, "downloaded": True}
            else:
                self.releases[version] = json.loads(data)
        return self.releases[version]

    def fetch(self, version, name):
        data = download(CDN.format(version=version, name=name))
        if data is None:
            sys.exit(f"lib@{version}/{name} tidak ada di jsDelivr.")
        release = self.release(version)
        release["files"][name] = "sha384-" + base64.b64encode(hashlib.sha384(data).digest()).decode()
        if name.endswith(".js"):
            suffix = ".min.js" if name.endswith(".min.js") else ".js"
            found = RELATIVE.findall(data.decode("utf-8", "replace"))
            found += [dep + suffix for dep in DYNAMIC.get(name[:-len(suffix)], [])]
            release["imports"][name] = list(dict.fromkeys(found))

    def integrity(self, version, name):
        release = self.release(version)
        if name not in release["files"]:
            if not release.get("downloaded"):
                hint = " .min.css buatan CrootJS (dengan hash) baru ada sejak 0.0.43." if name.endswith(".min.css") else ""
                sys.exit(f"{name} tidak ada di integrity.json lib@{version}.{hint}")
            self.fetch(version, name)
        return release["files"][name]

    def imports(self, version, name):
        release = self.release(version)
        if release.get("downloaded") and name not in release["imports"]:
            self.fetch(version, name)
        return release["imports"].get(name, [])


def latest():
    data = download(VERSION_JSON)
    if data is None:
        sys.exit(f"{VERSION_JSON} tidak ada.")
    return json.loads(data)["version"]


def files(folder):
    for root, dirs, names in os.walk(folder):
        dirs[:] = sorted(name for name in dirs if name not in SKIP_DIRS)
        for name in sorted(names):
            if name.endswith(EXTENSIONS) and name not in SKIP_FILES:
                yield os.path.join(root, name)


def update(text, version, hashes, path):
    text = PIN.sub(lambda m: f"{m.group(1)}@{version}", text)

    def tag(match):
        source = match.group(0)
        url = TAG_URL.search(source)
        if not url or not TAG_INTEGRITY.search(source):
            return source
        value = hashes.integrity(url.group(1), url.group(2))
        return TAG_INTEGRITY.sub(lambda m: f"{m.group(1)}{m.group(2)}{value}{m.group(2)}", source, count=1)

    text = TAG.sub(tag, text)
    listed = {}

    def pair(match):
        quote, url, pinned, name, colon, hash_quote = match.group(1, 2, 3, 4, 5, 6)
        listed.setdefault(pinned, set()).add(name)
        value = hashes.integrity(pinned, name)
        return f"{quote}{url}{quote}{colon}{hash_quote}{value}{hash_quote}"

    text = PAIR.sub(pair, text)
    # Modul yang diimpor modul lain lewat path relatif juga harus ada di import map yang sama.
    for pinned, names in listed.items():
        todo, seen = list(names), set(names)
        while todo:
            for dep in hashes.imports(pinned, todo.pop()):
                if dep not in seen:
                    seen.add(dep)
                    todo.append(dep)
                    print(f"  {path}: {dep} diimpor modul lain tetapi tidak ada di daftar integrity, "
                          "jadi dimuat tanpa dicek. Tambahkan:\n"
                          f'    "{CDN.format(version=pinned, name=dep)}": ""', file=sys.stderr)
    return text


def main():
    if len(sys.argv) not in (2, 3):
        sys.exit("Pakai: python3 bump-pins.py <versi|latest> [folder]")
    version = latest() if sys.argv[1] == "latest" else sys.argv[1]
    if not re.fullmatch(r"\d+\.\d+\.\d+", version):
        sys.exit(f"Versi tidak valid: {version!r}")
    folder = sys.argv[2] if len(sys.argv) == 3 else "."
    hashes = Hashes()
    changed = {}
    for path in files(folder):
        try:
            text = open(path, encoding="utf-8").read()
        except UnicodeDecodeError:
            continue
        if "crootjs/lib@" not in text and ".../lib@" not in text:
            continue
        new = update(text, version, hashes, path)
        if new != text:
            changed[path] = new
    # Ditulis setelah semua hash didapat, supaya kegagalan di tengah jalan tidak meninggalkan
    # pin baru dengan hash lama (browser akan menolak modulnya).
    for path, text in changed.items():
        with open(path, "w", encoding="utf-8", newline="") as file:
            file.write(text)
        print(f"  {path}")
    print(f"lib@{version}: {len(changed)} berkas diubah.")


if __name__ == "__main__":
    main()
