# Deployment

## Requirements

- Open Journal Systems **3.6**.
- Access to the plugin directory and an administrator account.
- A backup of the existing OJS database and `plugins/generic/oreDashboardFilters` folder.

## Install or upgrade

1. Confirm the target OJS version and back up the existing installation.
2. Copy the complete `oreDashboardFilters` folder into `plugins/generic/`.
3. Register or update the plugin using the method supported by that OJS installation and enable it under **Installed Plugins**.
4. Clear the appropriate application and browser asset caches and reload the editorial dashboard.
5. Verify the saved flags and permissions, which are stored in the OJS database rather than the source ZIP.

Do not install the old `oreDashboardCompact` companion plugin or any of the local 8083 repair patches. The consolidated source includes those enhancements.

## Acceptance checks

- [ ] The compact dashboard fits the viewport and title truncation works.
- [ ] Flags, colours, full and short labels, display options and assignments persist after refresh.
- [ ] Filters and date sorting work as intended.
- [ ] Role permissions are enforced for editors, managers and restricted accounts.
- [ ] Review indicators and native OJS popovers remain interactive.
- [ ] Hover panels close on pointer exit and navigation.
- [ ] Corresponding author details and reviewer identities respect OJS permissions.
- [ ] Stage hover lists current-stage participants and the current review round's reviewers.
- [ ] Default OJS 3.6 passes before testing any ORE-specific production theme.

## Rollback

Restore the previously backed-up plugin directory, clear application caches and verify the previous version. If a future version introduces database migrations, follow the approved database recovery procedure. This source consolidation introduces no migration.
