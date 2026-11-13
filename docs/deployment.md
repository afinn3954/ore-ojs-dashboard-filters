# Deployment and verification

## Prerequisites

- An OJS 3.6 installation and administrator access.
- A **complete** `oreDashboardFilters` plugin directory from the verified release, including PHP, JavaScript assets, version metadata, translations and dependencies that ship with the plugin.
- A backup of the OJS database and the existing plugin directory.

Do **not** deploy from the July 2026 v0.1.2 repository state or from individual 8083 patch ZIPs.

## Install or upgrade

1. Confirm the target OJS build and the plugin's `version.xml` release.
2. Back up the database and the entire existing `plugins/generic/oreDashboardFilters` directory.
3. Copy the complete release into `plugins/generic/oreDashboardFilters`, preserving its directory structure.
4. Follow the plugin installation or upgrade procedure for the target OJS 3.6 instance; enable it under **Installed Plugins**.
5. Refresh OJS assets/caches using the procedure supported by that particular installation.
6. Verify settings, filters, role permissions and flag assignments before authorising production use.

## Acceptance checklist

- [ ] Plugin loads on stock OJS 3.6 without browser console errors.
- [ ] Compact dashboard stays within the available viewport width.
- [ ] Full and short flag names, icons, colours and selection persist after refresh.
- [ ] Site administrators, journal managers and restricted roles have correct access.
- [ ] Submission/updated sorting and filters return expected results.
- [ ] Title hover shows the full title and authorised corresponding-author metadata.
- [ ] Stage hover displays participants and current-round reviewers correctly.
- [ ] Empty and restricted review-data states are distinguishable.
- [ ] Original OJS reviewer popovers and flag actions work after navigation.
- [ ] No hover panel remains visible after leaving the dashboard.
- [ ] Production ORE theme compatibility is checked separately.

## Rollback

Restore the backed-up plugin directory. If the release applies database migrations, also follow the approved database rollback plan. Clear the relevant OJS caches and verify the previous version loads. Disabling the plugin alone does not constitute a complete database rollback.

## Release control

The handover release must be built from the complete, tested 8083 plugin source. Exclude environment files, secrets, SQL backups, production user data, screenshots containing private information and one-off local repair installers.
