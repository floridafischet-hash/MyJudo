#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <flutter-web-build-directory>" >&2
  exit 64
fi

source_dir=${1%/}
target_dir=/var/www/myjudo
web_group=www-data

if [[ ! -f "$source_dir/index.html" ]]; then
  echo "Missing Flutter web build: $source_dir/index.html" >&2
  exit 66
fi

install -d -o jarvis -g "$web_group" -m 2750 "$target_dir"
rsync -a --delete --chown=jarvis:"$web_group" \
  --chmod=D2750,F640 "$source_dir"/ "$target_dir"/

nginx -t
systemctl reload nginx
