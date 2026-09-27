#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
uuid="nativetray@pyrosfun.com"
archive="$project_dir/dist/$uuid.shell-extension.zip"
stage_dir="$(mktemp -d)"
trap 'rm -rf "$stage_dir"' EXIT

mkdir -p "$project_dir/dist"
rm -f "$archive"
cp "$project_dir"/{extension.js,prefs.js,stylesheet.css,metadata.json,README.md,CHANGELOG.md,LICENSE} "$stage_dir/"
cp -R "$project_dir/src" "$project_dir/schemas" "$stage_dir/"
glib-compile-schemas --strict "$stage_dir/schemas"
(
    cd "$stage_dir"
    zip -q -r "$archive" extension.js prefs.js stylesheet.css metadata.json \
        README.md CHANGELOG.md LICENSE src schemas
)
unzip -tq "$archive"
