#!/usr/bin/env bash
set -euo pipefail

target="${1:-}"
if [[ -z "$target" ]]; then
  echo "Usage: scripts/export-public.sh /path/to/empty/public-repo"
  exit 1
fi

if [[ -e "$target" && -n "$(find "$target" -mindepth 1 -maxdepth 1 -print -quit)" ]]; then
  echo "Target exists and is not empty: $target"
  exit 1
fi

mkdir -p "$target"

copy_path() {
  local path="$1"
  if [[ -e "$path" ]]; then
    mkdir -p "$target/$(dirname "$path")"
    cp -R "$path" "$target/$path"
  fi
}

allowlist=(
  ".env.local.example"
  ".github"
  ".gitignore"
  ".nvmrc"
  "LICENSE"
  "README.md"
  "SECURITY.md"
  "__tests__"
  "app"
  "components"
  "docs"
  "eslint.config.mjs"
  "extension"
  "lib"
  "middleware.ts"
  "next-env.d.ts"
  "next.config.mjs"
  "package-lock.json"
  "package.json"
  "postcss.config.mjs"
  "scripts"
  "tailwind.config.ts"
  "tsconfig.json"
  "vercel.json"
)

for path in "${allowlist[@]}"; do
  copy_path "$path"
done

find "$target" -name ".DS_Store" -delete

echo "Public export written to $target"
echo "Before pushing: run npm ci, lint, tests, build, audit-high, gitleaks, and trufflehog inside the export."
echo "Use: find . -maxdepth 2 \\( -name '.env*' -o -name '.git' \\) -print"
