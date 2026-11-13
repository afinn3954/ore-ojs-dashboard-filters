# ORE Dashboard Filters

A generic plugin for the **Open Journal Systems (OJS) 3.6** editorial dashboard. It adds ORE-specific filters, configurable submission flags, dashboard display options and contextual information on hover without modifying OJS core files.

> **Handover preparation:** This branch contains documentation for the enhanced plugin tested locally on OJS 3.6.0.0. The complete installed v0.3.7 source and later enhancements have not yet been imported. **Do not deploy this branch as the current release.**

## Features

- **Editorial filters:** Publication lifecycle (AO, PMUR, VoR), workflow stage, submission date and time, editorial task or discussion title, task status, submission flag, section and category.
- **Submission flags:** Custom full names, short labels, icons, colours, ordering and visibility. Flags can be assigned to submissions and filtered in the dashboard.
- **Role permissions:** Configurable viewing and editing access for different OJS roles, with administrator and journal-manager access maintained.
- **Dashboard layout:** Compact or detailed display, optional columns, configurable date formatting, title truncation and expandable reviewer activity indicators.
- **Sorting:** Submission and last-updated dates, alongside native dashboard sorting.
- **Contextual hover information:** Full submission title and corresponding-author details; submission dates; stage and publication version; assigned stage participants; and current-round reviewers where the user is authorised to see them.
- **Native OJS integration:** Original dashboard controls, reviewer activity popovers and workflow actions remain available.

## Configuration

Open **Settings → Website → Plugins → Installed Plugins → ORE Dashboard Filters → Settings**.

| Area | Controls |
| --- | --- |
| Flags | Full name, short label, icon, colour, dropdown visibility and order |
| Filters | Enable or disable the additional editorial filters |
| Columns | Submitted, last updated, publishing stage, flags and editorial activity |
| Appearance | Compact or detailed layout, updated-date format and flag display style |
| Roles | Permission to use filters and view or edit flags |

**Full name** identifies the flag in its definition and detailed information, for example **Needs checking**. **Short label** is the compact dashboard label, for example **Check**. The **icon** can appear alone or alongside either label.

See [Configuration](docs/configuration.md) for a description of the options and [Deployment](docs/deployment.md) for the IT checklist.

## Installation

The plugin directory must be installed as:

```text
plugins/generic/oreDashboardFilters/
```

Back up the OJS database and existing plugin files before replacing an installation. Install or update the plugin through the supported OJS plugin procedure, enable it in **Installed Plugins**, and verify the dashboard and settings with an authorised editor. Avoid using the experimental 8083 patch installers as the handover release.

## Compatibility

- Target: **OJS 3.6**.
- Development validation: default OJS 3.6.0.0 on an isolated local instance, port 8083.
- The final consolidated source and integration tests are required before deployment to the production ORE theme.

## Author and licence

**Anthony Finnerty**, 2026. Copyright © 2026 Anthony Finnerty.

Licensed under the **GNU General Public License v3**; see [LICENSE](LICENSE). Preserve existing source-file copyright notices and confirm any CERN attribution requirements before wider distribution.
