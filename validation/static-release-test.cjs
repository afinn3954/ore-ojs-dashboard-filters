const assert = require('assert');
const fs = require('fs');
const path = require('path');

const pluginRoot = path.resolve(process.argv[2]);
const php = fs.readFileSync(
    path.join(pluginRoot, 'OreDashboardFiltersPlugin.php'),
    'utf8',
);
const javascript = fs.readFileSync(
    path.join(pluginRoot, 'resources', 'js', 'main.js'),
    'utf8',
);
const builtJavascript = fs.readFileSync(
    path.join(pluginRoot, 'public', 'build', 'build.iife.js'),
    'utf8',
);
const versionXml = fs.readFileSync(
    path.join(pluginRoot, 'version.xml'),
    'utf8',
);
const readme = fs.readFileSync(path.join(pluginRoot, 'README.md'), 'utf8');
const licence = fs.readFileSync(path.join(pluginRoot, 'LICENSE'), 'utf8');
const packageJson = JSON.parse(
    fs.readFileSync(path.join(pluginRoot, 'package.json'), 'utf8'),
);

assert.ok(
    php.includes("$query->where('po.version_stage', $versionStage);"),
    'Lifecycle filtering does not use the current-publication join',
);
assert.ok(
    !php.includes('ore_newer_published_publication.version'),
    'Removed publications.version column is still referenced',
);
assert.ok(
    !php.includes('whereExists(function'),
    'Obsolete lifecycle version subquery is still present',
);
assert.ok(
    javascript.includes("flush: 'sync'"),
    'Filter-state watcher is not synchronous',
);
assert.ok(
    javascript.includes('readInitialUrlValues(addedFields)'),
    'Plugin URL restoration is missing',
);
assert.ok(
    javascript.includes('readInitialNativeUrlValues(missingNativeFields)'),
    'Injected native-filter URL restoration is missing',
);
assert.ok(
    javascript.includes('insertMissingNativeFields('),
    'Missing native-filter insertion is not implemented',
);
assert.ok(
    !javascript.includes('options: []'),
    'Unsafe empty date options array is still present',
);
assert.ok(
    php.includes("new FieldOptions('sectionIds'"),
    'Server-provided Section field configuration is missing',
);
assert.ok(
    php.includes("new FieldAutosuggestPreset('categoryIds'"),
    'Server-provided Categories field configuration is missing',
);
assert.ok(
    php.includes('OreDashboardFiltersConfig'),
    'Native filter configuration is not injected before the bundle',
);
assert.ok(
    php.includes('$this->getCurrentVersion()') &&
        php.includes("'?v=' . rawurlencode($assetVersion)"),
    'Plugin-version cache busting is missing from the frontend bundle URL',
);
assert.ok(
    php.includes("'disabled' => true"),
    'Empty journal metadata does not produce an explicit disabled state',
);
assert.ok(
    versionXml.includes('<release>0.1.2.0</release>'),
    'Plugin XML version is not 0.1.2.0',
);
assert.strictEqual(packageJson.version, '0.1.2');
assert.strictEqual(
    packageJson.license,
    'GPL-3.0-only',
    'Package licence is not GNU GPL v3 only',
);
assert.strictEqual(
    packageJson.author?.name,
    'Anthony Finnerty',
    'Package author is not Anthony Finnerty',
);
assert.ok(
    php.includes('Original developer: Anthony Finnerty') &&
        javascript.includes('Original developer: Anthony Finnerty') &&
        builtJavascript.includes('Original developer: Anthony Finnerty') &&
        versionXml.includes('Original developer: Anthony Finnerty') &&
        readme.includes('Anthony Finnerty'),
    'Original-developer attribution is incomplete',
);
assert.ok(
    licence.includes('GNU GENERAL PUBLIC LICENSE') &&
        licence.includes('Version 3, 29 June 2007'),
    'Complete GNU GPL v3 licence text is missing',
);

console.log(
    JSON.stringify(
        {
            lifecycleJoin: 'po.version_stage',
            removedColumnReference: false,
            sectionRestoration: true,
            categoryRestoration: true,
            nativeUrlRestoration: true,
            pluginVersionCacheBusting: true,
            synchronousNormalisation: true,
            urlRestoration: true,
            author: 'Anthony Finnerty',
            licence: 'GPL-3.0-only',
            version: '0.1.2',
        },
        null,
        2,
    ),
);
