#!/usr/bin/env bash
set -euo pipefail

validation_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
plugin_dir="$(cd "${validation_dir}/.." && pwd)"
php_file="${plugin_dir}/OreDashboardFiltersPlugin.php"
npm_cache_dir="${ORE_DASHBOARD_NPM_CACHE:-/tmp/ore-dashboard-filters-npm-cache}"

(
    cd "${plugin_dir}"
    npm ci --cache "${npm_cache_dir}"
    npm run build
    node --check resources/js/main.js
    node --check public/build/build.iife.js
)

(
    cd "${validation_dir}"
    npm ci --cache "${npm_cache_dir}"
    npm run test:php
    node mock-dashboard-store-test.cjs \
        ../resources/js/main.js
    node mock-dashboard-store-test.cjs \
        ../public/build/build.iife.js
    node static-release-test.cjs ..
)

if command -v php >/dev/null 2>&1; then
    php -l "${php_file}"
else
    npx --yes --cache "${npm_cache_dir}" @php-wasm/cli -l "${php_file}"
fi

python3 -c \
    "import xml.etree.ElementTree as ET; ET.parse('${plugin_dir}/version.xml')"

echo "ORE Dashboard Filters v0.1.2 validation passed."
