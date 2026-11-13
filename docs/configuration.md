# Configuration

Settings are managed in **Settings → Website → Plugins → Installed Plugins → ORE Dashboard Filters → Settings**. Changes are journal-specific where supported by the plugin.

## Flags

Each flag has the following properties:

| Setting | Purpose | Example |
| --- | --- | --- |
| Full name | Descriptive flag name in settings and detailed information | Needs checking |
| Short label | Abbreviated label in compact display | Check |
| Icon | Symbol selected from the plugin icon library | Circle alert |
| Colour | Preset or custom hex colour | #b4232a |
| Enabled in dropdown | Whether users can select the flag | On |
| Order | Position in the selector | Move up/down |

The flag column can display **icon only**, **icon + short label** or **icon + full name**. The selection menu should retain readable flag names in every mode. An assigned flag is not deleted merely because it is disabled in the dropdown.

## Filters

Additional filters can be enabled individually:

- Publication lifecycle: Author's Original (AO), Published Manuscript Under Review (PMUR), Version of Record (VoR).
- Workflow stage.
- Submission date and date range.
- Submission time range.
- Editorial task or discussion title.
- Open or closed editorial task/discussion.
- Submission flag.
- Section.
- Category.

These extend rather than replace the standard OJS dashboard filters.

## Dashboard columns and appearance

| Setting | Behaviour |
| --- | --- |
| Layout | Compact or detailed |
| Submitted | Optional separate date/time column |
| Last updated | Optional date/time column; format configurable |
| Publishing stage | Optional separate PMUR/VoR column |
| Flag column | Display and assign submission flags |
| Editorial activity | Show native reviewer activity indicators |
| Flag display | Icon only, icon + short label or icon + full name |

**Compact mode** favours a truncated one-line submission title, keeps stage and publishing version beneath it, and moves supplementary detail into hover panels. Submission and last-updated date information can be displayed together on hover. Review activity controls remain interactive; where many are present, the surplus can be opened with a **+N** control.

**Detailed mode** exposes more standalone columns and should be checked at the target screen width.

## Hover information

- **Submission title:** Full title, corresponding authors and emails where available.
- **Stage:** Current workflow stage and publishing version; assigned participants; current-round reviewers for submissions in Review.
- **Dates:** Submitted and last-updated timestamps.
- **Flag:** Selected flag name, short label and colour.

If there are no reviewers in the current round, show **No reviewers assigned**. If permission or API access prevents retrieval, show **Details unavailable**, not a misleading empty state. Author and reviewer data are retrieved through the authenticated OJS API and remain subject to OJS access controls.

## Permissions

Site administrators and journal managers retain access. Other user roles can be configured for filter use, flag visibility and flag editing. Test representative roles before deploying to a shared installation.
