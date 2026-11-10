"""Membuat tag dan GitHub Release dari CHANGELOG.md. Dijalankan workflow setiap push ke main,
setelah uji lolos (.github/workflows/test.yml):

- Versi teratas di CHANGELOG.md yang tag-nya belum ada -> tag dibuat di commit ini.
- Setiap versi di CHANGELOG.md yang tag-nya ada tapi belum punya GitHub Release -> release
  dibuat dengan judul dan isi bagian versi itu. Yang terbaru ditandai "Latest".

Push yang tidak mengubah versi teratas (misalnya "bump CDN pins") tidak membuat apa-apa.
Butuh git dan gh (sudah ada di runner GitHub). DRY_RUN=1 hanya mencetak rencananya.

    python3 tools/release.py
"""
import os
import re
import subprocess
import sys

LIB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DRY_RUN = os.environ.get("DRY_RUN") == "1"


def run(*args, check=True):
    result = subprocess.run(args, cwd=LIB, capture_output=True, text=True)
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
        act("git", "tag", newest_tag)
        act("git", "push", "origin", newest_tag)
        tags.add(newest_tag)

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
