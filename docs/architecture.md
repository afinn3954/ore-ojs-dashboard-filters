# ORE OJS 3.6 Dashboard Filters

## Architecture, plugin feasibility and build brief

**Prototype:** `oreDashboardFilters` v0.1.2

**Target:** OJS 3.6 editorial dashboard

**Prepared:** 25 July 2026

---

## 1. Purpose

Open Research Europe needs dashboard filters that distinguish two independent dimensions:

1. **Publication lifecycle**: Author Original (AO), Published Manuscript Under Review (PMUR), Version of Record (VoR).
2. **Editorial workflow stage**: Submission, Editorial checks, Peer review, Production.

A submission may be in **Peer review** while its latest public lifecycle state is **PMUR**. Treating those as one status loses operational meaning. The dashboard also needs quick date filtering for triage and production planning.

The target interface is shown in
[`dashboard-filters-reference.png`](dashboard-filters-reference.png).
The ORE dashboard must also retain the journal's operational **Section** and
**Categories** filters.

---

## 2. Requested behaviour

### Journal classification

- Section: the journal's current sections
- Categories: the journal's current hierarchical categories

### Publication lifecycle

- All publication lifecycles
- Author Original (AO)
- Published Manuscript Under Review (PMUR)
- Version of Record (VoR)

### Workflow stage

- All workflow stages
- Submission
- Editorial checks
- Peer review
- Production

### Submission date

- All submission dates
- Today
- Yesterday
- Custom range

Default “All…” selections must not appear as active filter chips. PMUR and VoR filtering must use the **latest published lifecycle**, not any historical publication version. Section and Categories must remain visible even when core OJS omits them from the initial form.

---

## 3. Can this be a plugin?

**Yes, the prototype can be implemented as a normal generic plugin without patching core files.**

This is possible because OJS 3.6 exposes two useful extension points:

1. The dashboard is a named Pinia store (`dashboard`) and its filter form is exposed on the store. A plugin can use `pkp.registry.storeExtend('dashboard', ...)` to add form fields.
2. The submission collector invokes `Submission::Collector` after constructing the normal database query. A plugin can add portable query constraints for its own parameters.

The native `sectionIds`, `categoryIds` and `stageIds` filters are reused. Only lifecycle and date filtering require plugin-specific backend logic.

### Why this is preferable to a core patch

- The feature can be enabled or disabled per journal.
- No OJS, pkp-lib or ui-library source file is overwritten.
- OJS upgrades do not automatically overwrite the implementation.
- Failure is contained within a plugin hook rather than a modified core controller.
- The plugin can become an ORE-specific package while PKP considers whether the feature belongs in core.

---

## 4. Core OJS behaviour used by the plugin

### Filter form

Core OJS builds the filter form from `APP\components\forms\dashboard\SubmissionFilters`, which can add sections, assigned editor, issues, categories and days since last activity. It deliberately omits Section when exactly one section exists and omits Categories when the journal has none.

v0.1.2 does not replace this form. PHP builds the two native field
configurations from the active journal's repositories and passes them to the
frontend. The store extension:

- preserves any core-provided `sectionIds` or `categoryIds` field unchanged;
- inserts only a missing field;
- uses the journal's current section IDs and localised titles;
- uses the current category IDs, localised breadcrumbs and hierarchical
  vocabulary;
- shows a disabled explanatory state if no options are configured;
- keeps the core ordering: Section, Assigned To Editor, Issues, Categories,
  Days since last activity, then the ORE-specific filters.

### Query propagation

The dashboard store automatically converts non-empty filter field values into API query parameters and merges them into requests to `/_submissions`, `/_submissions/assigned` or `/_submissions/reviews`.

### Active filter chips

The OJS 3.6 filter composable iterates scalar field values before checking
whether they are empty. An empty-string default can therefore become an
unwanted All chip, while a date field with `options: []` can dereference a
missing option.

The plugin uses an empty array for the inactive state. Its All radio option also
uses an empty-array value, which Vue compares structurally and therefore shows
as selected. Active scalar values carry a matching `selected` label. This keeps
core API query generation, URL persistence and chip removal intact without
patching ui-library.

### Backend collection

The core backend recognises `sectionIds`, `categoryIds` and `stageIds` natively. The plugin uses `Submission::Collector` for:

- `oreVersionStage`
- `oreSubmissionDate`
- `oreDateFrom`
- `oreDateTo`

---

## 5. Lifecycle filtering semantics

### AO, PMUR and VoR

OJS 3.6 maintains `submissions.current_publication_id` as the most mature
published publication. If no publication has been published, it uses the most
mature unpublished publication. The submission collector already joins this
publication as `po`.

All three lifecycle filters therefore use:

```text
po.version_stage = AO | PMUR | VoR
```

This naturally prevents an old PMUR from matching after a VoR is published,
while still allowing an unpublished AO to match when no public version exists.
It also avoids the removed pre-3.6 `publications.version` column.

The values follow the OJS 3.6 `VersionStage` enum exactly:

- `AO`
- `PMUR`
- `VoR`

---

## 6. Date filtering semantics

- Today: server-local midnight to the next midnight.
- Yesterday: previous server-local midnight to today.
- Custom: inclusive From and To dates; internally the To date is converted to an exclusive next-day boundary.
- Invalid date input is ignored rather than breaking the dashboard.

### UAT point

The ORE environment must confirm whether dashboard date boundaries should follow:

- the CERN/OJS server timezone,
- the journal timezone, or
- the individual user timezone.

The prototype uses the PHP/OJS server timezone.

---

## 7. Plugin contents

```text
oreDashboardFilters/
├── OreDashboardFiltersPlugin.php
├── version.xml
├── README.md
├── LICENSE
├── locale/en/locale.po
├── registry/uiLocaleKeysBackend.json
├── resources/js/main.js
├── public/build/build.iife.js
├── package.json
└── vite.config.js
```

---

## 8. What v0.1.2 does

- Loads only on dashboard pages.
- Restores Section and Categories when the initial OJS form omits them.
- Preserves core-provided Section and Categories configurations unchanged.
- Uses live journal metadata rather than hard-coded section or category values.
- Restores injected Section and Categories values from dashboard URLs.
- Adds the five filter form fields to the editorial dashboard.
- Reuses native workflow-stage filtering.
- Implements lifecycle and date constraints through the collector hook.
- Filters lifecycle through the collector's current-publication `po` join.
- Keeps custom date fields hidden until Custom range is selected.
- Prevents default All selections from appearing as filter chips.
- Clears hidden custom dates when Today, Yesterday or All is selected.
- Follows complete form replacement when the filter modal is applied.
- Preserves safe date labels during chip removal and Clear Filters.
- Restores plugin-specific filter values from dashboard URLs.
- Avoids duplicate field registration.
- Cache-busts the compiled frontend asset with the installed plugin release.

---

## 9. What is not included

This package deliberately does not include:

- the separate **All submissions** dashboard view;
- the **hide empty dashboard categories** preference;
- dashboard table columns such as lead author and submission date;
- saved personal filter presets;
- reporting/export;
- database migrations;
- changes to publication version-stage data itself.

Those should remain separate modules or later plugin features so they can be tested and deployed independently.

---

## 10. Risks and tests

### Required runtime tests

1. Install and enable on a disposable OJS 3.6 instance.
2. Confirm the plugin list and dashboard load normally.
3. Confirm every filter issues the expected query parameters.
4. Confirm Section options match all configured journal sections and filter
   correctly.
5. Confirm Categories match the configured hierarchy, including nested
   category breadcrumbs, and filter correctly.
6. Confirm the disabled Categories state is replaced after a category is
   created and the dashboard is reloaded.
7. Confirm stage filter results for all four stages.
8. Create a submission with AO only and verify AO.
9. Publish PMUR and verify PMUR.
10. Publish a newer PMUR version and verify it remains PMUR.
11. Publish VoR and verify PMUR no longer matches while VoR does.
12. Test Today and Yesterday around midnight.
13. Test one-sided and two-sided custom date ranges.
14. Test My Assigned, review-specific and global dashboard views.
15. Test MySQL and PostgreSQL if both are in the support matrix.
16. Verify clear-filter behaviour, modal reapplication and URL persistence.
17. Verify imported records with historic dates and publication versions.

### Main risks

- OJS internal store or hook signatures may change before the deployed 3.6 tag is fixed.
- A journal with no configured categories cannot perform category filtering;
  v0.1.2 shows this explicitly instead of silently hiding the control.
- Migrated records must have the intended `current_publication_id` and
  `version_stage` values.
- Date timezone expectations may differ from the server timezone.
- The PKP-hosted UAT plugin grid is currently affected by an unrelated broken bulk-keyword plugin and is not a safe installation target until recovered.

---

## 11. Plugin versus central OJS change

### Keep in the plugin

- ORE labels and available lifecycle options.
- The definition of “latest published lifecycle”.
- ORE-specific custom query parameters.
- ORE deployment settings and future saved views.

### Candidate for OJS core

- A generic documented way for plugins to add dashboard filter fields server-side.
- Native API filtering by publication `versionStage`.
- Native submitted-date range filters.
- First-class filter-chip formatting for date fields.
- Configurable workflow-stage labels.

A later core contribution could replace the plugin-specific query parameters with documented API parameters while retaining the same UI.

---

## 12. Source references used

- OJS 3.6 API schema supplied by the user: `api/OJS_3.6_openapi.json`.
- OJS 3.6 rendered API documentation supplied by the user: `api/OJS_3.6_API_documentation.html`.
- `pkp/ojs/classes/components/forms/dashboard/SubmissionFilters.php`.
- `pkp/pkp-lib/classes/components/forms/dashboard/PKPSubmissionFilters.php`.
- `pkp/ui-library/src/pages/dashboard/dashboardPageStore.js`, inspected at
  commit `332e4db8850d079c4cb18eb8f6c36f4caabe97df`.
- `pkp/ui-library/src/composables/useFiltersForm.js`, inspected at the same
  commit.
- `pkp/pkp-lib/api/v1/_submissions/PKPBackendSubmissionsController.php`,
  inspected at commit `9a91dc2ee952eb0707444c090f1fd2088e9e1419`.
- `pkp/pkp-lib/classes/submission/Collector.php` and
  `classes/submission/Repository.php`, inspected at the same commit.
- `pkp/ojs/classes/publication/enums/VersionStage.php`.
- `pkp/ojs/classes/migration/install/OJSMigration.php`, inspected at commit
  `56c788d131aded84452b384351831355c7710a56`.
- PKP UI Library plugin extension guide.

---

## 13. Recommended next development phase

Treat v0.1.2 as an installable architectural prototype. After disposable OJS
3.6 runtime verification, v0.2.0 may add:

- journal-level settings to enable individual filter groups;
- translated JavaScript labels;
- configurable lifecycle semantics after migration;
- diagnostics showing active plugin parameters;
- automated PHP integration tests against OJS fixtures;
- optional saved ORE operational views.
