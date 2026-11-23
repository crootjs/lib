#!/bin/sh
# Mengganti semua pin crootjs/lib@<versi> di sebuah repo dengan versi baru. Dipakai workflow
# di keempat repo CrootJS setelah rilis; bisa juga dijalankan manual:
#   sh bump-pins.sh 0.0.31 [folder]
# CHANGELOG.md (riwayat) dan llms-full.txt (dibangun ulang build.sh) tidak diubah.
set -e
VERSION=$1
DIR=${2:-.}
case $VERSION in
    [0-9]*.[0-9]*.[0-9]*) ;;
    *) echo "Pakai: sh bump-pins.sh <versi> [folder]" >&2; exit 1 ;;
esac
find "$DIR" -type f \( -name '*.md' -o -name '*.html' -o -name '*.js' -o -name '*.txt' -o -name '*.json' \) \
    -not -path '*/.git/*' -not -name CHANGELOG.md -not -name llms-full.txt -not -name crootjs.d.ts \
    -exec grep -lE '(crootjs/lib|\.\.\./lib)@[0-9]+\.[0-9]+\.[0-9]+' {} + 2>/dev/null |
while read -r file; do
    before=$(cksum < "$file")
    sed -i -E "s#(crootjs/lib|\.\.\./lib)@[0-9]+\.[0-9]+\.[0-9]+#\1@$VERSION#g" "$file"
    [ "$(cksum < "$file")" = "$before" ] || echo "  $file"
done
