#!/bin/bash

set -euxo pipefail

REPOSITORY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$REPOSITORY_ROOT"

npm run build
dotnet pack scripts/Picollo.Picolloscope.csproj \
  --output "$REPOSITORY_ROOT/dist"
