# Technical and security review

## Summary

`oreDashboardFilters` is a generic OJS 3.6 plugin. It extends the editorial
dashboard filter form and adds read-only query constraints. It does not patch
OJS core, create a route, write publication data or require an external
service.

## Runtime changes

| Area | Behaviour |
| --- | --- |
| Plugin registration | Registers through OJS `GenericPlugin` |
| Page scope | Loads the frontend extension only on OJS dashboard pages |
| Native metadata | Reads the active journal's Section and Category repositories |
| Frontend | Extends the named `dashboard` Pinia store |
| Existing filters | Reuses native `sectionIds`, `categoryIds` and `stageIds` |
| New parameters | Adds `oreVersionStage`, `oreSubmissionDate`, `oreDateFrom` and `oreDateTo` |
| Backend | Uses the existing `Submission::Collector` hook |
| Lifecycle query | Adds a condition on the collector's existing `po.version_stage` join |
| Date query | Adds conditions on `s.date_submitted` |
| Browser asset | Loads the included compiled IIFE bundle with plugin-version cache busting |

## Data impact

| Question | Answer |
| --- | --- |
| New database tables | No |
| Database migration | No |
| New plugin settings | No |
| Submission or publication writes | No |
| File uploads or generated files | No |
| Public API endpoint | No |
| External network calls | No |
| Credentials, secrets or tokens | None |
| Background or scheduled process | No |

The plugin reads journal configuration and the authenticated user's dashboard
query parameters. It only adds constraints to OJS's existing submission query.
Normal OJS dashboard access control remains responsible for determining which
records a user may request.

## Input handling

1. `oreVersionStage` is accepted only when it exactly matches `AO`, `PMUR` or
   `VoR`.
2. Date values must match `YYYY-MM-DD` and must also be valid calendar dates.
3. Malformed or unsupported plugin-specific values are ignored.
4. Query constraints are added through Laravel's query builder rather than
   concatenated SQL.
5. Section, Category and workflow-stage values continue through OJS's native
   filtering path.
6. Frontend configuration embedded in the page is JSON encoded with HTML,
   quote and ampersand escaping flags.

## Lifecycle semantics

The plugin relies on OJS 3.6 maintaining
`submissions.current_publication_id` as:

1. The most mature published publication.
2. The most mature unpublished publication when none has been published.

The submission collector already joins this publication as `po`. The plugin
filters on:

```text
po.version_stage = AO | PMUR | VoR
```

This avoids the removed pre-3.6 `publications.version` column. Migrated ORE
records must nevertheless be checked to ensure that `current_publication_id`
and `version_stage` contain the intended values.

## Date semantics

1. Today starts at server-local midnight and ends at the next midnight.
2. Yesterday starts at the previous server-local midnight and ends at today's
   midnight.
3. A custom From date is inclusive.
4. A custom To date is inclusive in the interface and converted to an exclusive
   next-day boundary in the query.
5. Either custom boundary may be supplied independently.

The operational timezone decision remains open. The prototype currently uses
the PHP/OJS server timezone.

## Dependencies

### Runtime

The installer relies on the OJS 3.6 plugin, repository, form, dashboard-store
and submission-collector interfaces. It also relies on the PHP and Laravel
components already supplied by OJS.

There is no additional runtime package manager or service.

### Build and validation only

The supplied source uses Vite 6.4.3 to rebuild the browser asset. The installer
already includes that asset, so npm and Node.js are not required for normal
installation.

The repository contains locked npm dependencies and repeatable validation
scripts.

## Compatibility boundary

The proof of concept targets OJS 3.6 and was designed against the source
references recorded in [`architecture.md`](architecture.md).

CERN testing must record and compare the exact:

1. OJS application release and commit.
2. pkp-lib commit.
3. ui-library commit.
4. PHP version.
5. Database engine and version.

Compatibility with OJS 3.5 or a later changed 3.6 internal interface is not
claimed.

## Performance considerations

Each dashboard page load reads the active journal's current Section and
Category configuration. Filtered submission requests add simple constraints
to the existing submission query.

The following should be measured on realistic migrated ORE data:

1. Query duration for unfiltered and filtered dashboards.
2. Query plans for lifecycle and date conditions.
3. Behaviour with large category hierarchies.
4. MySQL and PostgreSQL behaviour where both remain relevant.

The plugin currently emits no dedicated diagnostic log. Use the normal OJS and
PHP logs, database query logging and browser developer tools during testing.

## Main files for code review

| File | Purpose |
| --- | --- |
| `OreDashboardFiltersPlugin.php` | Plugin registration, journal metadata configuration and backend query constraints |
| `resources/js/main.js` | Readable dashboard-store extension source |
| `public/build/build.iife.js` | Compiled browser asset shipped to OJS |
| `locale/en/locale.po` | Plugin name, description and empty-state strings |
| `registry/uiLocaleKeysBackend.json` | Backend locale-key registration |
| `version.xml` | OJS plugin metadata and release |
| `package-lock.json` | Locked build-time JavaScript dependency tree |

All files are present in the installer. The full source is at the repository
root and the repeatable checks are in `validation/`.

## Known limitations

1. CERN's exact OJS 3.6 runtime and migrated database remain to be validated.
2. Plugin-specific JavaScript labels are currently English.
3. Date boundaries use the PHP/OJS server timezone.
4. Internal OJS store or hook interfaces may change before the deployed 3.6
   version is fixed.
5. A journal without categories cannot perform category filtering. The plugin
   shows an explicit disabled state.
6. The package does not repair incorrect migrated lifecycle metadata.
7. This is a proof of concept, not a production-certified release.

## Licence

The plugin is supplied under GNU GPL v3. The full licence is included in the
installer. Anthony Finnerty is recorded as the original developer in the
README, package metadata and principal source files.

The code currently identifies CERN as the copyright holder because it was
developed as part of CERN's Open Research Europe transition work. This is
separate from author credit. Before a public release, CERN should confirm the
final copyright notice and any wording required for its status as an
intergovernmental organisation.
