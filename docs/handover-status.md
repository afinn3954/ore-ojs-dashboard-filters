# Handover status

**As of 13 November 2026: documentation prepared; source consolidation outstanding.**

- GitHub `main` currently contains **0.1.2.0** (last plugin commit 26 July 2026).
- The local isolated OJS 3.6 instance on **8083** uses **0.3.7.0**, plus later installation-specific improvements to flags, layouts, hover panels and workflow participant/reviewer information.
- The latest workflow hover patch is **v7**; it is not a complete plugin release.
- The tested complete installed directory must be exported and audited before merging an updated release into `main`.
- The development branch and documentation are not a production-ready release.

## Remaining work

1. Export the **entire installed** `oreDashboardFilters` directory from the isolated 8083 instance.
2. Inspect files for credentials, development-only paths and scripts, and missing build sources.
3. Consolidate installed code into a versioned plugin release and validate against OJS 3.6.
4. Update `version.xml`, changelog and installation package from the verified source.
5. Merge into `main`, tag the release and grant IT access after technical review.

**Author:** Anthony Finnerty.
