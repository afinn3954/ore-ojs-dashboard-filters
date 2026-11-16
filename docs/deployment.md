# Deployment

## Requirements

- Open Journal Systems **3.6**.
- Access to the plugin directory and an administrator account.
- A backup of the existing OJS database and `plugins/generic/oreDashboardFilters` folder.

## Install or upgrade

1. Confirm the target OJS version and back up the existing installation.
2. Copy the complete `oreDashboardFilters` folder into `plugins/generic/`.
3. Register or update the plugin using the method supported by that OJS installation and enable it under **Installed Plugins**.
4. Open **Installed Plugins → ORE Dashboard Filters → Settings** as a site administrator or journal manager. This automatically creates the two flag tables if they do not exist. The QA database user must be permitted to create tables on first use.
5. Save a test flag and check it is available on the dashboard. Existing flag definitions and assignments are preserved.
6. Clear the appropriate application and browser asset caches and reload the editorial dashboard. Hard refresh to load the new 0.3.9 assets.

Do not install the old `oreDashboardCompact` companion plugin or any of the local 8083 repair patches. The consolidated source includes those enhancements.

## Acceptance checks

- [ ] The plugin settings open without a missing-tables error.
- [ ] The two ORE flag tables exist, and flags can be saved and assigned.
- [ ] The compact dashboard fits the viewport at 900, 1440 and 1920px, with submission titles expanding on wide screens.
- [ ] Flags, colours, full and short labels, display options and assignments persist after refresh.
- [ ] Filters and date sorting work as intended.
- [ ] Role permissions are enforced for editors, managers and restricted accounts.
- [ ] Review indicators and native OJS popovers remain interactive.
- [ ] Hover panels close on pointer exit and navigation.
- [ ] Corresponding author details and reviewer identities respect OJS permissions.
- [ ] Stage hover lists current-stage participants and the current review round's reviewers.
- [ ] Default OJS 3.6 passes before testing any ORE-specific production theme.

## Rollback

Restore the previously backed-up plugin directory, clear application caches and verify the previous version. This version introduces two flag tables only when absent. Upgrading or disabling the plugin does not delete flag data. For rollback, restore the previous plugin code but leave the tables intact; a database administrator may remove them only after a confirmed data-retention decision.
