# ORE Dashboard Filters

A generic plugin for the **Open Journal Systems (OJS) 3.6** editorial dashboard, developed for Open Research Europe. It adds editorial filters, custom submission flags and contextual information without changing OJS core files.

## Features

- **Filters:** Publication lifecycle (AO, PMUR, VoR), workflow stage, submission date/time, task or discussion title and status, submission flag, section and category.
- **Flags:** Custom full names, short labels, icons, colours, ordering and visibility. Editors can assign flags to submissions and filter by them.
- **Dashboard:** Compact or detailed layouts, configurable columns and date formatting, truncated titles with full details on hover, and expandable reviewer activity indicators.
- **Hover information:** Full title and corresponding author contacts, submission and updated dates, workflow/publishing stage, assigned stage participants, current-round reviewers and selected flag details.
- **Access:** Role-based permissions for filters, column visibility and flag viewing/editing. Existing OJS permissions protect author and reviewer information.
- **Sorting:** Native sorting plus submitted/last-updated date sorting.

## Install

Copy the complete `oreDashboardFilters` directory into `plugins/generic/` on an OJS 3.6 installation, then enable it under **Settings → Website → Plugins → Installed Plugins**. Back up the existing plugin files and database before upgrading. See [Deployment](docs/deployment.md).

## Configure

Open **ORE Dashboard Filters → Settings** in Installed Plugins. Options cover flag definitions, available filters, additional columns, dashboard appearance and user roles.

| Flag field | Example | Meaning |
| --- | --- | --- |
| Full name | Needs checking | Full name in settings and detail panels |
| Short label | Check | Abbreviated dashboard text |
| Icon | Circle alert | Symbol shown in the dashboard |
| Colour | Red | Flag colour |

The flag display options are **icon only**, **icon + short label**, and **icon + full name**. See [Configuration](docs/configuration.md).

## Source

The ready-to-use assets are included in `public/build/`. Editable files are in `resources/`. To rebuild, run `npm ci` followed by `npm run build` (Node.js required). The build retains all plugin assets.

## Compatibility

Target: **OJS 3.6.0.0**. Consolidated from the plugin tested on the isolated 8083 development instance on 13 November 2026. Verify functionality and permissions on the target environment before production deployment.

## Copyright and licence

Copyright © 2026 **Anthony Finnerty**. Licensed under [GNU GPL v3](LICENSE).
