# ORE Dashboard Filters

A generic plugin for the **Open Journal Systems (OJS) 3.6** editorial dashboard, developed for Open Research Europe. It adds editorial filters, custom submission flags and contextual information without changing OJS core files.

## Features

- **Filters:** Publication lifecycle (AO, PMUR, VoR), workflow stage, submission date/time, task or discussion title and status, submission flag, section and category.
- **Flags:** Custom full names, short labels, icons, colours, ordering and visibility. Editors can assign flags, filter by multiple selected flags (OR), and sort flag names.
- **Dashboard:** Compact or detailed layouts, configurable columns and date formatting, truncated titles with full details on hover, and expandable reviewer activity indicators.
- **Hover information:** Full title and corresponding author contacts, submission and updated dates, workflow/publishing stage, assigned participants, current-round reviewers and selected flag details. A flag badge can also appear within the open submission workflow view.
- **Access:** Role-based permissions plus journal-specific user overrides for filters, column visibility and flag viewing/editing. Existing OJS permissions protect author and reviewer information.
- **Sorting:** Native sorting, submitted/last-updated dates and optional ascending/descending flag-name sorting.

## Install

Copy the complete `oreDashboardFilters` directory into `plugins/generic/` on an OJS 3.6 installation, then enable it under **Settings → Website → Plugins → Installed Plugins**. Open its **Settings** once as a manager or administrator to initialise the flag tables. Back up the existing database and plugin directory before upgrading. See [Deployment](docs/deployment.md).

## Configure

Open **ORE Dashboard Filters → Settings** in Installed Plugins. Options cover flag definitions, available filters, additional columns, dashboard appearance, user roles and individual user overrides. Every saved override appears in a table until its role defaults are restored.

| Flag field | Example | Meaning |
| --- | --- | --- |
| Full name | Needs checking | Full name in settings and detail panels |
| Short label | Check | Abbreviated dashboard text |
| Icon | Circle alert | Symbol shown in the dashboard |
| Colour | Red | Flag colour |

The flag display options are **icon only**, **icon + short label**, and **icon + full name**. See [Configuration](docs/configuration.md).

## Flag sorting

Click the **FLAG** column heading to cycle through Z–A, A–Z, and normal ordering. The flag sort radio group is no longer present in the Filters dialogue. Journal managers can enable/disable sorting under plugin Settings.

## Source

The ready-to-use assets are included in `public/build/`. Editable files are in `resources/`. To rebuild, run `npm ci` followed by `npm run build` (Node.js required). The build retains all plugin assets.

## Compatibility

Target: **OJS 3.6.0.0**. Version 0.4.2.1 includes the Publication workflow flag placement fix and a persistent table of individually overridden users in Settings. The editable workflow flag has been tested on a local editorial account. **Individual Author overrides have been verified on a local Author account and require a separate QA validation before production deployment.** Do not enable Author or Reader permissions globally as a workaround. This is not approved for QA or production until tested on the target OJS instance.

## Copyright and licence

Copyright © 2026 **Anthony Finnerty**. Licensed under [GNU GPL v3](LICENSE).
