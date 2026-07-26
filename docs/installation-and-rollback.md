# Installation and rollback

## Scope

These instructions apply to:

`oreDashboardFilters-ojs36-v0.1.2-prototype.zip`

The installer is supplied directly as a GitHub release asset and inside the
CERN IT evaluation package under `INSTALLER/`.

Use a disposable or non-production OJS 3.6 environment. Do not install this
prototype directly on the production ORE service.

## Before installation

Record:

1. OJS release and application commit SHA.
2. pkp-lib commit SHA.
3. ui-library commit SHA.
4. PHP version.
5. Database engine and version.
6. OJS server timezone.
7. Journal timezone, if configured separately.
8. Browser and version.
9. Whether an earlier `oreDashboardFilters` version is installed.

Retain a copy of any existing
`plugins/generic/oreDashboardFilters` directory before replacing it.

Verify the installer checksum from the extracted CERN IT evaluation package:

```bash
sha256sum -c CHECKSUMS.sha256
```

For the standalone GitHub release asset, compare its SHA-256 value with the
release notes. On macOS:

```bash
shasum -a 256 oreDashboardFilters-ojs36-v0.1.2-prototype.zip
```

Compare the output with `CHECKSUMS.sha256`.

## Option A: OJS plugin uploader

1. Sign in with permission to manage plugins.
2. Open the OJS plugin-management screen.
3. Choose the action to upload a new plugin.
4. Upload only `oreDashboardFilters-ojs36-v0.1.2-prototype.zip`. If using the
   CERN IT evaluation package, this is the file inside `INSTALLER/`.
5. Complete any installation or upgrade prompt.
6. Enable **ORE Dashboard Filters** under generic plugins.
7. Clear the OJS data and template caches.
8. Reload the editorial dashboard with a hard browser refresh.

The outer CERN IT evaluation ZIP and the development-kit ZIP are not OJS
installers.

## Option B: Filesystem deployment

From the OJS application root, extract the installer into `plugins/generic`:

```bash
unzip /path/to/oreDashboardFilters-ojs36-v0.1.2-prototype.zip -d plugins/generic
```

The resulting path must be:

```text
plugins/generic/oreDashboardFilters/OreDashboardFiltersPlugin.php
```

It must not contain an extra nested `oreDashboardFilters` directory.

Set file ownership and permissions according to the existing CERN OJS
deployment policy. Then clear the OJS cache:

```bash
php tools/clearCache.php
```

For Docker, run the same command inside the relevant OJS application service:

```bash
docker compose exec <ojs-app-service> php tools/clearCache.php
```

Enable **ORE Dashboard Filters** in the OJS plugin-management screen and
hard-refresh the dashboard.

## Initial smoke check

Confirm:

1. The plugin is listed as version `0.1.2.0` and is enabled.
2. The editorial dashboard opens without an HTTP 500 response.
3. Existing native filters such as Assigned To Editor and Days since last
   activity remain present.
4. Section and Categories are present.
5. Publication lifecycle, Workflow stage and Submission date are present.
6. Default All selections create no active chip.
7. Browser-console, PHP and OJS logs show no new error.

Continue with `CERN_IT_ACCEPTANCE_TEST_RECORD.md`.

## Upgrade from v0.1.1

If v0.1.1 is already installed:

1. Retain a copy of the existing plugin directory.
2. Disable the existing plugin.
3. Use the normal OJS upgrade mechanism, or replace only the
   `plugins/generic/oreDashboardFilters` directory with v0.1.2.
4. Clear OJS caches.
5. Enable the plugin.
6. Hard-refresh the dashboard.

v0.1.2 includes its own release number in the browser-asset URL to prevent an
older v0.1.1 JavaScript bundle from remaining cached.

## Rollback

1. Disable **ORE Dashboard Filters**.
2. Clear OJS caches.
3. Delete the plugin through OJS plugin management, or remove only:
   `plugins/generic/oreDashboardFilters`.
4. If testing an upgrade, restore the retained earlier plugin directory.
5. Reload the dashboard and confirm the ORE-specific fields have gone and the
   native dashboard still operates normally.

The plugin creates no database table, migration or plugin-owned setting.
Rollback therefore requires no schema or data reversal.

## Evidence to retain

Retain:

1. Completed acceptance-test record.
2. Plugin-management screenshot showing version and enabled state.
3. Dashboard screenshots before and after installation.
4. Relevant network requests to `/_submissions`.
5. PHP, OJS, SQL and browser-console errors, including timestamps.
6. Sample submission IDs used for AO, PMUR and VoR checks.
