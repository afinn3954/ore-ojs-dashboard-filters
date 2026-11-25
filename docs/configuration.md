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

## Additional features (0.4.1.0 local test release)

- **Individual user permissions:** A manager searches by journal username or email, selects a user and sets the same four access checkboxes used by the role matrix. The override applies only to that user in that journal. **Restore role defaults** removes it. Administrators and managers retain their fixed access, and OJS submission permissions continue to apply.
- **Select multiple flags:** The submission flag filter becomes a multi-select; any selected flag matches (OR). “No flag” can also be included.
- **Sort by flag name:** Click the **FLAG** column heading to cycle through descending, ascending and unsorted, just like other OJS columns. Sorting applies to the full server-side result; unflagged submissions sort after flagged ones. The administrator can enable or disable this capability.
- **Show flag in workflow:** Displays the selected flag next to the submission language in the open workflow drawer. An authorised editor can change it there using a dropdown; users with view-only permission see a read-only badge. The server checks permission for each save.

These options are journal-scoped. Remove an individual override to return to role defaults; disabling the display and filter options does not delete flag data.

### Author-specific permissions (not yet confirmed on live OJS)

An individual override can enable the **Flag** column and flag filter on the OJS **My Submissions** dashboard for a user with an actual Author role. The user's submission list remains restricted by OJS. Flag API access also requires an author stage assignment to the particular submission. The plugin does **not** grant editorial dashboard or journal-manager access. A reader-only account is not given access to private submission flags.

This feature is currently a local test candidate. Do not turn on the Author role globally as a workaround; instead, assign a single test Author an individual override, log in as that Author, and check the result.

## Saved individual permissions

The **Users with custom permissions** table is shown immediately on opening plugin Settings. It lists each user with a saved individual override and the corresponding filter, column and flag permissions. Use **Edit** to change that user’s permissions or **Restore defaults** to revoke the override. The user then follows their configured role permissions again.

Use the search field below the table to add overrides for other users. Individual overrides do not provide broader submission access or confer editorial roles. A former journal user’s saved override remains visible for removal, but cannot be edited unless the user rejoins the journal.
