#!/bin/bash

set -euxo pipefail

npm run typecheck
npm run lint
npm run coverage
node scripts/generate-input-format-schema-json.js > /dev/null
