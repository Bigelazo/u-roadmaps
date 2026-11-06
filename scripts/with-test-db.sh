#!/bin/sh
set -eu

name=${1:?usage: with-test-db.sh <notifications|e2e> <command> [args...]}
shift
case "$name" in
  notifications | e2e) ;;
  *) echo "with-test-db: unknown lock '$name'" >&2; exit 2 ;;
esac

locks="$(git rev-parse --path-format=absolute --git-common-dir)/test-db-locks"
lock="$locks/$name"
mkdir -p "$locks"

waiting=
until mkdir "$lock" 2>/dev/null; do
  holder=$(cat "$lock/pid" 2>/dev/null || true)
  if [ -n "$holder" ] && ! kill -0 "$holder" 2>/dev/null; then
    rm -rf "$lock"
    continue
  fi
  if [ -z "$waiting" ]; then
    echo "with-test-db: waiting for the $name lock (pid ${holder:-?})" >&2
    waiting=1
  fi
  sleep 2
done
echo $$ >"$lock/pid"
trap 'rm -rf "$lock"' EXIT
trap 'exit 130' INT TERM

"$@"
