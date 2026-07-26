# Validation record

The `oreDashboardFilters` v0.1.2 prototype package was checked on 26 July 2026.

## Completed

- Vite 6.4.3 production build completed from `resources/js/main.js`.
- JavaScript syntax checks passed for the source and deployable IIFE bundle.
- PHP lint passed using the PHP WebAssembly CLI:

  ```text
  No syntax errors detected in OreDashboardFiltersPlugin.php
  ```

- A second independent PHP AST parse passed with `php-parser` 3.7.0.
- `version.xml` parsed successfully and declares release `0.1.2.0`.
- Licence validation confirms the complete GNU GPL v3 text, package identifier
  `GPL-3.0-only` and original-developer attribution for Anthony Finnerty in the
  README, package metadata and principal source files.
- Static lifecycle-query validation confirms use of `po.version_stage` and no
  reference to the removed `publications.version` column.
- Static native-filter validation confirms that Section and Categories are
  configured from OJS repositories and injected before the frontend bundle.
- Static asset validation confirms that the bundle URL is cache-busted with
  the installed plugin release rather than only the OJS application version.
- Mock OJS 3.6 dashboard-store tests passed for:

  - Section and Categories restoration when absent from the core form;
  - native OJS ordering;
  - preservation of core-provided Section and Categories fields;
  - duplicate native-field protection;
  - Section and Categories dashboard URL restoration;
  - invalid or stale Section and Category IDs being ignored;
  - an explicit inactive Categories state when the journal has no categories;
  - five ORE-field registration;
  - empty defaults without All chips;
  - initial dashboard URL restoration;
  - custom-date labels;
  - rejection of calendar-invalid ISO date values;
  - complete filter-form replacement after modal Apply;
  - clearing hidden dates when a non-custom preset is selected;
  - individual chip removal;
  - Clear Filters;
  - duplicate-registration protection;
  - restriction to the editorial dashboard;
  - execution against both source and deployable JavaScript.

- Vue 3.5.13, the version locked by the inspected ui-library commit, was
  checked directly to confirm that its radio binding comparison treats two
  empty arrays as equal.
- The standalone installer ZIP contains one top-level
  `oreDashboardFilters/` directory and excludes development dependencies.
- The standalone ZIP was extracted and all packaged validation checks were
  repeated against the extracted copy.

## Not completed

- Installation and execution in a live OJS 3.6 application.
- Database-query execution against MySQL or PostgreSQL.
- Browser-rendered confirmation that the All radio options are visibly
  selected.
- Browser-rendered confirmation of populated and disabled Section and
  Categories states.
- Live category hierarchy and breadcrumb selection.
- Permission testing for every editorial role and dashboard view.
- Migration-data testing for `current_publication_id` and `version_stage`.
- Server, journal and user timezone boundary testing.
- Browser comparison against the supplied screenshot.

The package is therefore an installable prototype for disposable OJS 3.6
runtime testing, not a production-certified release.

## Required disposable-instance test matrix

1. Record the exact OJS, pkp-lib and ui-library commit SHAs.
2. Install and enable the plugin, clear OJS caches and load the editorial
   dashboard.
3. Confirm Section and Categories are present whether supplied by core or
   restored by the plugin.
4. Confirm Section options and Categories hierarchy exactly match the active
   journal configuration.
5. Confirm a journal with no categories shows the disabled explanatory state;
   create a category, reload and confirm the functional control replaces it.
6. Select multiple sections and categories, apply, reload, remove their chips
   and directly open a URL containing their IDs.
7. Confirm every All option is visibly selected by default and creates no chip
   or API parameter.
8. Test AO, PMUR and VoR with realistic publication histories.
9. Confirm an old PMUR stops matching once VoR becomes the current published
   publication.
10. Test all four workflow stages.
11. Test Today, Yesterday, one-sided and two-sided custom ranges.
12. Apply filters repeatedly through the modal.
13. Remove each chip individually, then use Clear Filters.
14. Reload and directly open URLs containing every plugin filter.
15. Repeat in each accessible editorial dashboard view.
16. Inspect generated SQL or database logs on MySQL and PostgreSQL where
    available.
17. Repeat around midnight in the configured OJS timezone.

## Rollback

Disable the plugin, clear OJS caches and remove
`plugins/generic/oreDashboardFilters` if it was copied manually. No database
migration or plugin-owned setting needs to be reversed.
