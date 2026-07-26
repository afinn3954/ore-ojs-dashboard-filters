# Changelog

## 0.1.2 – 25 July 2026

- Added explicit original-developer attribution for Anthony Finnerty and
  completed the GNU GPL v3 repository and package metadata.
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
