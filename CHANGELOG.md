# Changelog

## 0.3.9.0 (16 November 2026, QA candidate)

- Install the missing flag definition and assignment tables on new OJS installations, and initialise them safely from authorised plugin settings on existing installations. Existing flag data is preserved.
- Make submission titles expand with the available width on large screens instead of allocating most spare space to Editorial Activity.
- Improve the QA installation checklist.

## 0.3.8.0 (13 November 2026, IT handover candidate)

- Consolidated the complete installed OJS 3.6 plugin into an auditable release.
- Included the latest compact layout, flag menu and hover enhancements, including assigned stage participants and current-round reviewers.
- Restored editable source files for previously installed JavaScript and CSS enhancements and made the asset build reproducible.
- Removed local installation records and aligned version metadata.
- No database schema changes. Final environment testing is required before production deployment.

## 0.3.7.0 (12 November 2026)

- Configurable flag definitions, icon library, colours, appearance and role permissions.
- Additional editorial filters and dashboard columns.

# Changelog

## 0.1.2 – 25 July 2026

- Restored the Section filter when core OJS omits it, including journals with
  only one configured section.
- Restored the Categories filter from the journal's current category
  hierarchy, breadcrumbs and controlled vocabulary.
- Preserved core-provided Section and Categories fields without duplication or
  replacement.
- Kept Section and Categories in native OJS order before the ORE-specific
  filters.
- Added initial dashboard URL restoration for injected `sectionIds` and
  `categoryIds` values.
- Added explicit disabled states when no sections or categories are configured.
- Cache-busted the frontend bundle with the installed plugin release so an
  upgrade cannot reuse the v0.1.1 browser asset.
- Added validation for native-field ordering, URL restoration, preservation,
  de-duplication and empty defaults.

## 0.1.1 – 25 July 2026

- Replaced the invalid `publications.version` lifecycle subquery with filtering
  on the collector's existing `po.version_stage` current-publication join.
- Prevented inactive All selections from becoming active filter chips.
- Removed unsafe empty `options` arrays from custom date fields.
- Preserved labels and empty state through modal apply, chip removal and Clear
  Filters.
- Restored plugin filter values from dashboard URLs after store extension.
- Rejected calendar-invalid custom dates during frontend normalisation.
- Added validation for URL restoration, modal form replacement, date clearing,
  chip removal, default state and lifecycle query generation.

## 0.1.0 – 25 July 2026

- Initial architectural prototype.
