#!/bin/sh
# Runs a command while holding a test database lock shared by every worktree
# of this repository, so parallel agents take turns on the same database.
#
#   scripts/with-test-db.sh <notifications|e2e> <command> [args...]
#
# `notifications` guards roadmap_notifications_test_db (test:unit and
# test:integration); `e2e` guards roadmap_e2e_db and ports 3200/3201.
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
  # A holder that exited without cleanup leaves a stale lock behind.
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
