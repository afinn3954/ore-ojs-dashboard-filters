# ORE Dashboard Filters for OJS 3.6

Prototype generic plugin for the OJS 3.6 editorial dashboard.

Version 0.1.2 has passed the supplied build and mock-store checks and a smoke
test on a disposable local OJS 3.6 Docker installation. It still requires
testing against CERN's exact OJS build, database and migrated ORE records.

## Author

Original development and maintenance by
[Anthony Finnerty](https://github.com/afinn3954).

The plugin was developed in 2026 as part of the Open Research Europe
transition work at CERN.

## Filters

- Section: current journal sections
- Categories: current journal category hierarchy
- Publication lifecycle: AO, PMUR, VoR
- Workflow stage: Submission, Editorial checks, Peer review, Production
- Submission date: Today, Yesterday, Custom range

The plugin deliberately treats publication lifecycle and editorial workflow
stage as separate dimensions. A submission can therefore be in Peer review
while its current published lifecycle is PMUR.

## Installation

Install the ZIP through the OJS plugin uploader or copy the
`oreDashboardFilters` directory to:

```text
plugins/generic/oreDashboardFilters
```

Clear OJS caches, then enable **ORE Dashboard Filters** in the plugin list.

## Architecture

- Frontend fields are injected through the documented OJS 3.6 `dashboard`
  Pinia store extension mechanism.
- Section and Categories use OJS's current server-side field configurations,
  labels, IDs, breadcrumbs and category vocabulary. The plugin only inserts
  either field when core OJS did not already provide it.
- A journal with no configured categories receives a visible disabled
  Categories state instead of silently losing the filter.
- The native `stageIds` filter is reused.
- Native `sectionIds` and `categoryIds` backend filtering is reused.
- Plugin-specific lifecycle and date parameters are applied through the core
  `Submission::Collector` hook.
- Lifecycle filtering uses the collector's existing current-publication join,
  `po.version_stage`.
- Empty filters use an empty-array state so OJS 3.6 does not create unwanted
  All chips or dereference a missing option.
- A synchronous watcher follows complete filter-form replacement by the modal,
  restores plugin filters from dashboard URLs and keeps date labels safe.
- The frontend asset URL uses the installed plugin release for cache busting
  during upgrades.
- No OJS, pkp-lib or ui-library source file is patched.

## Prototype limits

- Not yet runtime-tested on the PKP-hosted or CERN ORE instance.
- Date boundaries use the PHP/OJS server timezone and need UAT confirmation.
- Labels are currently English in the JavaScript bundle.
- Section and Categories labels and options are supplied by OJS in the active
  interface locale.
- Lifecycle means the stage of OJS's `current_publication_id`: the most mature
  published publication, or the most mature unpublished publication when none
  has been published.
- The plugin does not add the separate All submissions dashboard view,
  dashboard columns or hide-empty-category option.

## Rollback

Disable **ORE Dashboard Filters**, clear OJS caches and remove
`plugins/generic/oreDashboardFilters` if the files were installed manually.
The plugin creates no database tables or settings, so no data migration needs
to be reversed.

## Licence

This plugin is licensed under the GNU General Public License version 3, in
line with OJS and official PKP plugins. See [`LICENSE`](LICENSE) for the
complete terms.

The repository remains private during CERN IT evaluation. Before any public
release, CERN should confirm the final copyright notice and any wording
required for its status as an intergovernmental organisation.

## Technical documentation

- [Architecture and filter semantics](docs/architecture.md)
- [Installation and rollback](docs/installation-and-rollback.md)
- [Technical and security review](docs/technical-and-security-review.md)
- [CERN IT acceptance-test record](docs/cern-it-acceptance-test.md)
- [Validation record](validation/VALIDATION.md)

See `CHANGELOG.md` for the release history.
