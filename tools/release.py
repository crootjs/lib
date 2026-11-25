"""Membuat tag dan GitHub Release dari CHANGELOG.md. Dijalankan workflow setiap push ke main,
setelah uji lolos (.github/workflows/test.yml):

- Versi teratas di CHANGELOG.md yang tag-nya belum ada -> tag dibuat di commit rilis: isi commit
  ini ditambah <modul>.min.js buatan tools/build-min.py (import-nya ke ./<modul>.min.js),
  <nama>.min.css, dan integrity.json (hash SRI), di
  branch dist (bukan main). jsDelivr menyajikan .min.js dari tag apa adanya.
- Setiap versi di CHANGELOG.md yang tag-nya ada tapi belum punya GitHub Release -> release
  dibuat dengan judul dan isi bagian versi itu. Yang terbaru ditandai "Latest".

Push yang tidak mengubah versi teratas (misalnya "bump CDN pins") tidak membuat apa-apa. Kalau
tag baru dibuat, versinya ditulis ke $GITHUB_OUTPUT sebagai `released` untuk langkah berikutnya.
Butuh git dan gh (sudah ada di runner GitHub). DRY_RUN=1 hanya mencetak rencananya.

    python3 tools/release.py
"""
import glob
import os
import re
import subprocess
import sys

LIB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DRY_RUN = os.environ.get("DRY_RUN") == "1"
# Branch berisi commit rilis (kode + .min.js). main tetap hanya kode sumber.
DIST = "dist"


def run(*args, check=True, env=None):
    result = subprocess.run(args, cwd=LIB, capture_output=True, text=True, env=env)
    if check and result.returncode != 0:
        sys.exit(f"{' '.join(args)} gagal:\n{result.stderr}")
    return result


def act(*args):
    print("+", " ".join(arg if len(arg) < 60 else arg[:57] + "..." for arg in args))
    if not DRY_RUN:
        run(*args)


# "## [0.0.26](...) - 2026-11-11", lalu "**Judul**", lalu isi sampai "## " berikutnya.
def sections():
    text = open(os.path.join(LIB, "CHANGELOG.md"), encoding="utf-8").read()
    found = []
    for match in re.finditer(r"^## \[(\d+\.\d+\.\d+)\]\([^)]*\) - [\d-]+\n(.*?)(?=^## |\Z)", text, re.M | re.S):
        body = match.group(2).strip()
        title = re.match(r"\*\*(.+?)\*\*\s*", body)
        if title:
            body = body[title.end():].strip()
        found.append({"version": match.group(1), "title": title.group(1) if title else "v" + match.group(1), "notes": body})
    return found  # terbaru dulu


def tag_with_min(tag):
    act(sys.executable, os.path.join("tools", "build-min.py"))
    built = sorted(os.path.basename(path) for pattern in ("*.min.js", "*.min.js.map", "*.min.css", "*.min.css.map", "integrity.json") for path in glob.glob(os.path.join(LIB, pattern)))
    if DRY_RUN:
        print(f"+ commit {tag} (main + {len(built)} berkas .min) di branch {DIST}, tag {tag}")
        return
    # Pohon commit rilis = main + .min.js + .min.css + integrity.json, disusun di index sementara supaya working tree dan
    # branch yang sedang aktif tidak tersentuh (-f karena .gitignore menolak *.min.js di main).
    index = os.path.join(LIB, ".git", "release-index")
    env = {**os.environ, "GIT_INDEX_FILE": index}
    run("git", "read-tree", "HEAD", env=env)
    run("git", "add", "-f", *built, env=env)
    tree = run("git", "write-tree", env=env).stdout.strip()
    os.remove(index)
    # Commit rilis disambung ke branch dist (induk: main dan ujung dist sebelumnya), supaya setiap
    # tag ada di sebuah branch dan tidak ditandai GitHub "does not belong to any branch". Saat dist
    # belum ada, tag lama yang belum masuk branch mana pun ikut menjadi induknya.
    parents = [run("git", "rev-parse", "HEAD").stdout.strip()]
    if run("git", "ls-remote", "--exit-code", "origin", f"refs/heads/{DIST}", check=False).returncode == 0:
        run("git", "fetch", "-q", "origin", DIST)
        parents.append(run("git", "rev-parse", "FETCH_HEAD").stdout.strip())
    else:
        orphans = run("git", "tag", "--no-merged", "HEAD", "-l", "v*").stdout.split()
        parents += [run("git", "rev-parse", f"{name}^{{commit}}").stdout.strip() for name in orphans]
    args = ["git", "commit-tree", tree, "-m", f"{tag}: built .min.js (importing .min.js) and .min.css files, and integrity.json"]
    for parent in parents:
        args += ["-p", parent]
    commit = run(*args).stdout.strip()
    act("git", "tag", tag, commit)
    act("git", "push", "origin", tag, f"{commit}:refs/heads/{DIST}")


def main():
    entries = sections()
    if not entries:
        sys.exit("Tidak ada versi di CHANGELOG.md.")
    tags = set(run("git", "tag", "-l").stdout.split())
    repo = os.environ.get("GITHUB_REPOSITORY", "crootjs/lib")
    listed = run("gh", "release", "list", "-R", repo, "--limit", "200", "--json", "tagName", "-q", ".[].tagName", check=False)
    if listed.returncode != 0:
        sys.exit("gh release list gagal:\n" + listed.stderr)
    released = set(listed.stdout.split())

    newest = entries[0]
    newest_tag = "v" + newest["version"]
    if newest_tag not in tags:
        tag_with_min(newest_tag)
        tags.add(newest_tag)
        # Langkah workflow berikutnya (pin, repo lain) hanya jalan kalau versi baru dibuat di sini.
        output = os.environ.get("GITHUB_OUTPUT")
        if output and not DRY_RUN:
            with open(output, "a", encoding="utf-8") as file:
                file.write(f"released={newest['version']}\n")

    # Dari yang terlama, supaya yang terbaru dibuat terakhir dan menjadi "Latest".
    for entry in reversed(entries):
        tag = "v" + entry["version"]
        if tag not in tags or tag in released:
            continue
        notes_file = os.path.join(LIB, ".release-notes.md")
        if not DRY_RUN:
            open(notes_file, "w", encoding="utf-8").write(entry["notes"] + "\n")
        act("gh", "release", "create", tag, "-R", repo, "--verify-tag", "--title", entry["title"],
            "--notes-file", notes_file, "--latest=" + ("true" if entry is newest else "false"))
        if not DRY_RUN:
            os.remove(notes_file)
    print("Selesai.")


main()
