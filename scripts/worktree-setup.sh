#!/bin/sh
set -eu

root=$(git rev-parse --show-toplevel)
main=$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")
cd "$root"

if [ ! -f .env ] && [ "$main" != "$root" ] && [ -f "$main/.env" ]; then
  cp "$main/.env" .env
fi

pnpm install --frozen-lockfile
pnpm run prisma:generate
pnpm exec next typegen
