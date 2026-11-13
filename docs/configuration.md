# Configuration

Open **Settings → Website → Plugins → Installed Plugins → ORE Dashboard Filters → Settings**.

## Flags

Each journal flag has the following fields:

| Field | Description |
| --- | --- |
| Full name | Descriptive flag name, such as **Needs checking** |
| Short label | Compact label, such as **Check** |
| Icon | Symbol from the built-in icon library |
| Colour | Colour preset or six-digit hex value |
| Enabled in dropdown | Whether editors can select it |
| Order | Position in the dropdown |

Display modes: **icon only**, **icon + short label**, **icon + full name**. The selection menu should retain readable option names in all modes. Flag hover details use the selected flag's colour. An assigned flag may need its submission assignments cleared before it can be deleted.

## Filters

The following can be enabled individually:

- Publication lifecycle: Author's Original (AO), Published Manuscript Under Review (PMUR), Version of Record (VoR).
- Workflow stage.
- Submission date and date range.
- Submission time range.
- Editorial task/discussion title.
- Editorial task/discussion status (open or closed).
- Submission flag.
- OJS section and category.

## Columns and appearance

| Setting | Options |
| --- | --- |
| Layout | Compact or detailed |
| Columns | Submitted, Last updated, Publishing stage, Flag |
| Updated date format | Short or full |
| Flag display | Icon only, icon + short label, icon + full name |
| Compact mode | Separate Submitted column, separate Publishing stage column and Editorial Activity visibility |

Compact mode keeps the title on one line and places stage/version information below it. Additional information is available on hover rather than taking permanent column space. The native reviewer activity buttons and their popovers remain available; **+N** reveals additional indicators.

## Hover information

- **Title:** Full title, corresponding author names and emails where available.
- **Stage:** Workflow and publishing stage, assigned participants, current-round reviewers during Review.
- **Dates:** Submitted and last-updated timestamps.
- **Flag:** Full name, short label and colour.
- **ID / Days:** Submission identifier and elapsed activity information.

A review stage with no assigned reviewers shows **No reviewers assigned**. When an API response is inaccessible, the panel identifies the information as unavailable rather than assuming there are no assignments.

## Permissions

Site administrators and journal managers retain full access. Other roles can be permitted to use filters, view additional columns, view flags or edit flags. All author and reviewer metadata remains subject to OJS authorisation.
