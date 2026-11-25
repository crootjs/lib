"""Versi patch otomatis. Dijalankan workflow sebelum tools/release.py, setiap push ke main yang
lolos uji:

- Kalau versi teratas CHANGELOG.md belum punya tag, tidak ada yang dilakukan: entri yang ditulis
  tangan itu yang dirilis.
- Kalau sudah ada tag-nya, tetapi sejak tag terakhir ada perubahan kode modul (*.js atau *.css di
  folder utama, bukan tests/ atau tools/), versi patch dinaikkan: entri baru di CHANGELOG.md dari
  judul commit yang mengubah kode itu (dalam bahasa Inggris, seperti CHANGELOG.md), crootjs.d.ts dibangkitkan ulang, lalu keduanya di-commit
  dan di-push ke main. tools/release.py kemudian membuat tag dan release seperti biasa.
- Push yang hanya mengubah dokumentasi, uji, atau workflow tidak membuat versi.

Push dengan GITHUB_TOKEN tidak memicu workflow lagi. DRY_RUN=1 hanya mencetak entrinya.

    python3 tools/auto-version.py
"""
import datetime
import os
import re
import subprocess
import sys

LIB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DRY_RUN = os.environ.get("DRY_RUN") == "1"
# Commit bot yang tidak perlu masuk catatan rilis.
SKIP_SUBJECT = re.compile(r"^bump pins to lib@")


def git(*args):
    result = subprocess.run(("git",) + args, cwd=LIB, capture_output=True, text=True)
    if result.returncode != 0:
        sys.exit(f"git {' '.join(args)} gagal:\n{result.stderr}")
    return result.stdout.strip()


def main():
    changelog_path = os.path.join(LIB, "CHANGELOG.md")
    changelog = open(changelog_path, encoding="utf-8").read()
    top = re.search(r"^## \[(\d+)\.(\d+)\.(\d+)\]", changelog, re.M)
    if not top:
        sys.exit("Tidak ada versi di CHANGELOG.md.")
    version = ".".join(top.groups())
    if not git("tag", "-l", "v" + version):
        print(f"v{version} belum punya tag: entri CHANGELOG yang ditulis tangan yang dirilis.")
        return
    # Sejak 0.0.38 tag menunjuk ke commit anak berisi .min.js; merge-base memberi commit main-nya.
    base = git("merge-base", "v" + version, "HEAD")
    changed = [name for name in git("diff", "--name-only", base, "HEAD").splitlines()
               if "/" not in name and name.endswith((".js", ".css")) and not name.endswith((".min.js", ".min.css"))]
    if not changed:
        print(f"Tidak ada perubahan kode modul sejak v{version}: tidak ada versi baru.")
        return
    subjects = [line for line in git("log", "--format=%s", f"{base}..HEAD", "--", *changed).splitlines()
                if line and not SKIP_SUBJECT.match(line)]
    subjects.reverse()  # yang terlama dulu
    major, minor, patch = (int(part) for part in top.groups())
    new = f"{major}.{minor}.{patch + 1}"
    title = subjects[0] if len(subjects) == 1 else f"{len(subjects)} changes: " + "; ".join(subjects)
    if len(title) > 120:
        title = title[:117] + "..."
    entry = (f"## [{new}](https://github.com/crootjs/lib/releases/tag/v{new}) - {datetime.date.today().isoformat()}\n\n"
             f"**{title}**\n\n"
             + "".join(f"- {subject}\n" for subject in subjects)
             + f"- Changed files: {', '.join(f'`{name}`' for name in sorted(changed))}.\n"
             + "- This version was made automatically from the commit subjects (tools/auto-version.py).\n\n")
    print(entry)
    if DRY_RUN:
        return
    changelog = changelog[:top.start()] + entry + changelog[top.start():]
    open(changelog_path, "w", encoding="utf-8").write(changelog)
    subprocess.run([sys.executable, os.path.join(LIB, "tools", "build-types.py")], cwd=LIB, check=True)
    git("add", "CHANGELOG.md", "crootjs.d.ts")
    git("commit", "-m", f"{new}: automatic version")
    git("push", "origin", "HEAD:main")


if __name__ == "__main__":
    main()
