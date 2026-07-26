# v0.1.2

This is the first CERN IT evaluation release of the ORE Dashboard Filters
plugin for OJS 3.6.

## Author and licence

Original development and maintenance by Anthony Finnerty
([`afinn3954`](https://github.com/afinn3954)).

The plugin is supplied under the GNU General Public License version 3. The
repository and installer include the complete licence text.

## What changed

- Restores Section when core OJS omits it, including a single-section journal.
- Restores Categories from the active journal's real hierarchy.
- Preserves native Section and Categories controls when OJS already supplies
  them.
- Filters AO, PMUR and VoR against the current publication's
  `version_stage`.
- Keeps publication lifecycle separate from editorial workflow stage.
- Adds Today, Yesterday and custom submission-date filters.
- Restores filter state from dashboard URLs.
- Correctly handles Apply, individual chip removal and Clear Filters.
- Uses the plugin release number to invalidate the browser asset cache.

## Status

The plugin passed its JavaScript build, PHP syntax checks, static release
checks and mock OJS dashboard-store tests. It also passed a smoke test on a
disposable local OJS 3.6 Docker installation.

It is not production certified. CERN should test it against the exact OJS,
pkp-lib and ui-library revisions, supported database, migrated ORE records,
editorial roles and timezone configuration.

## Release assets

- `oreDashboardFilters-ojs36-v0.1.2-prototype.zip` is the OJS installer.
- `ORE_OJS36_Dashboard_Filters_CERN_IT_Evaluation_Package_v0.1.2_20260726.zip`
  contains the installer, review documentation, test record, source,
  validation evidence and checksums.

The OJS plugin uploader must receive only the standalone installer, not the
outer CERN IT evaluation package.

## Integrity

The CERN IT evaluation package includes `CHECKSUMS.sha256`. Checksums for
standalone GitHub release assets should also be recorded in the corresponding
GitHub release notes.
