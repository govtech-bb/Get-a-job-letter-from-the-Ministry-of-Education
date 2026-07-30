#!/usr/bin/env bash
# Assemble the public site into _site/.
#
# Vercel uses outputDirectory:"." and serves the repo root, which also exposes
# server sources and (on a CLI folder deploy) node_modules. Rather than copy
# that, build an explicit publish directory: copy everything, then drop what is
# server-side or not part of the site. Functions are bundled from the repo by
# Netlify, not from here, so removing server/ and api/ does not affect them.
set -euo pipefail

OUT=_site
rm -rf "$OUT"
mkdir -p "$OUT"

# Copy the working tree, excluding VCS, deps, build output and server-side code.
tar --exclude='./.git' \
    --exclude='./node_modules' \
    --exclude="./$OUT" \
    --exclude='./.netlify' \
    --exclude='./server' \
    --exclude='./api' \
    --exclude='./netlify' \
    --exclude='./scripts' \
    --exclude='./decisions' \
    --exclude='./docs' \
    --exclude='./data' \
    --exclude='./.github' \
    --exclude='./*.md' \
    --exclude='./.env.example' \
    --exclude='./vercel.json' \
    --exclude='./netlify.toml' \
    --exclude='./.gitignore' \
    --exclude='./package.json' \
    --exclude='./package-lock.json' \
    -cf - . | tar -xf - -C "$OUT"

echo "Published files:"
find "$OUT" -maxdepth 1 -mindepth 1 -printf '  %f\n' | sort
echo "Total: $(find "$OUT" -type f | wc -l) files, $(du -sh "$OUT" | cut -f1)"

# Fail loudly if an entry point is missing, rather than deploying a broken site.
for required in index.html request.html verify.html sent.html app.js styles.css \
                admin/index.html admin/login.html dist/styles.css; do
  if [ ! -e "$OUT/$required" ]; then
    echo "ERROR: $OUT/$required is missing" >&2
    exit 1
  fi
done
echo "Entry-point check: OK"
