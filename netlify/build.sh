#!/usr/bin/env bash
# Assemble the public site into _site/.
#
# Rather than publish the repo root (which would expose server sources), build
# an explicit publish directory: copy everything, then drop what is server-side
# or not part of the site. Functions are bundled from the repo by Netlify, not
# from here, so excluding server/ and api/ does not affect them.
set -euo pipefail

OUT=_site
rm -rf "$OUT"
mkdir -p "$OUT"

# Copy the working tree, excluding VCS, deps, build output and server-side code.
tar --exclude='./.git' \
    --exclude='./.github' \
    --exclude='./.claude' \
    --exclude='./node_modules' \
    --exclude="./$OUT" \
    --exclude='./.netlify' \
    --exclude='./server' \
    --exclude='./api' \
    --exclude='./netlify' \
    --exclude='./scripts' \
    --exclude='./decisions' \
    --exclude='./data' \
    --exclude='./test' \
    --exclude='./*.md' \
    --exclude='./.env.example' \
    --exclude='./netlify.toml' \
    --exclude='./.gitignore' \
    --exclude='./package.json' \
    --exclude='./package-lock.json' \
    -cf - . | tar -xf - -C "$OUT"

echo "Published files:"
find "$OUT" -maxdepth 1 -mindepth 1 | sort | sed 's|^_site/|  |'
echo "Total: $(find "$OUT" -type f | wc -l | tr -d ' ') files, $(du -sh "$OUT" | cut -f1)"

# Fail loudly if an entry point is missing, rather than deploying a broken site.
for required in index.html request.html verify.html sent.html contact.html \
                not-found.html app.js styles.css page.css \
                admin/index.html admin/login.html \
                assets/images/govbb-crest.svg; do
  if [ ! -e "$OUT/$required" ]; then
    echo "ERROR: $OUT/$required is missing" >&2
    exit 1
  fi
done
echo "Entry-point check: OK"
