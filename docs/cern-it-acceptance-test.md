# CERN IT acceptance-test record

## Environment

| Field | Result |
| --- | --- |
| Tester | |
| Test date and time | |
| Environment and URL | |
| OJS release | |
| OJS application commit SHA | |
| pkp-lib commit SHA | |
| ui-library commit SHA | |
| PHP version | |
| Database engine and version | |
| OJS server timezone | |
| Journal timezone | |
| Browser and version | |
| Test journal ID or path | |
| Installation method | OJS uploader / filesystem |
| Previous plugin version | None / |
| Installed plugin version | 0.1.2.0 |

Use `Pass`, `Fail`, `Blocked` or `Not tested` in the Result column. Record
submission IDs, screenshots, requests, logs or query evidence where useful.

## A. Installation and baseline

| ID | Test | Expected result | Result | Evidence or notes |
| --- | --- | --- | --- | --- |
| A01 | Verify installer SHA-256 | Checksum matches `CHECKSUMS.sha256` | | |
| A02 | Install plugin | Installation completes without an HTTP or PHP error | | |
| A03 | Enable plugin | ORE Dashboard Filters 0.1.2.0 is enabled | | |
| A04 | Clear caches and open dashboard | Dashboard loads without an HTTP 500 response | | |
| A05 | Inspect PHP, OJS and browser logs | No plugin-related error is introduced | | |
| A06 | Capture baseline after enablement | Existing dashboard data and queues remain accessible | | |

## B. Filter form and native-field preservation

| ID | Test | Expected result | Result | Evidence or notes |
| --- | --- | --- | --- | --- |
| B01 | Existing native filters | Assigned To Editor and Days since last activity remain present | | |
| B02 | Section field | Section is visible, including when only one section exists | | |
| B03 | Section options | Options exactly match the active journal's sections | | |
| B04 | Categories field with configured categories | Hierarchy and breadcrumbs match journal configuration | | |
| B05 | Categories field with no configured category | Disabled explanatory state is shown | | |
| B06 | Add a category and reload | Functional Categories control replaces the disabled state | | |
| B07 | Check field order | Native fields precede ORE-specific fields without duplicates | | |
| B08 | Default All states | All selections are visibly selected and create no chip or API parameter | | |

## C. Section and Categories behaviour

| ID | Test | Expected result | Result | Evidence or notes |
| --- | --- | --- | --- | --- |
| C01 | Select one section | Only submissions in that section match | | |
| C02 | Select multiple sections | Union of selected sections matches | | |
| C03 | Select one category | Only submissions in that category match | | |
| C04 | Select nested categories | Breadcrumbs, selections and results are correct | | |
| C05 | Select multiple categories | Union of selected categories matches | | |
| C06 | Reload with selections | Values and results are restored from the dashboard URL | | |
| C07 | Remove Section or Category chip | Only that constraint is removed | | |
| C08 | Use stale or invalid IDs in URL | Invalid values do not break the dashboard | | |

## D. Publication lifecycle

Prepare or identify submissions with known publication histories. Record every
submission ID used.

| ID | Test | Expected result | Result | Evidence or notes |
| --- | --- | --- | --- | --- |
| D01 | AO-only submission | AO matches; PMUR and VoR do not | | |
| D02 | Current PMUR | PMUR matches; AO and VoR do not | | |
| D03 | Newer PMUR version | Submission remains a PMUR match | | |
| D04 | Current VoR with historic PMUR | VoR matches; historic PMUR no longer matches | | |
| D05 | Migrated ORE record | Result agrees with `current_publication_id` and `version_stage` | | |
| D06 | All publication lifecycles | Lifecycle parameter and chip are removed | | |
| D07 | Inspect generated request and query | Expected parameter and `po.version_stage` constraint are used | | |

## E. Workflow stage

| ID | Test | Expected result | Result | Evidence or notes |
| --- | --- | --- | --- | --- |
| E01 | Submission | Only submissions in the native Submission stage match | | |
| E02 | Editorial checks | Only submissions in the renamed native editing stage match | | |
| E03 | Peer review | Only submissions in the native review stage match | | |
| E04 | Production | Only submissions in the native production stage match | | |
| E05 | Combine workflow and lifecycle | Both independent constraints apply correctly | | |
| E06 | All workflow stages | Stage parameter and chip are removed | | |

## F. Submission date

| ID | Test | Expected result | Result | Evidence or notes |
| --- | --- | --- | --- | --- |
| F01 | Today | Records submitted since server-local midnight match | | |
| F02 | Yesterday | Records from the previous server-local day match | | |
| F03 | Custom From only | From boundary is inclusive | | |
| F04 | Custom To only | To boundary is inclusive | | |
| F05 | Two-sided custom range | Both inclusive calendar boundaries behave correctly | | |
| F06 | Invalid calendar date in URL | Invalid input is ignored and dashboard remains usable | | |
| F07 | Change Custom to preset | Hidden custom dates and their chips are cleared | | |
| F08 | Test around midnight | Results agree with the recorded server timezone | | |

## G. State, views and permissions

| ID | Test | Expected result | Result | Evidence or notes |
| --- | --- | --- | --- | --- |
| G01 | Apply filters repeatedly | Modal replacement does not duplicate or lose fields | | |
| G02 | Remove every chip individually | Each field returns to its correct inactive state | | |
| G03 | Clear Filters | All plugin and native values clear without an error | | |
| G04 | Reload filtered URL | Values, labels, chips and results are restored | | |
| G05 | My Assigned view | Filters work within the records authorised for the user | | |
| G06 | Review-specific view | Filters work without expanding access | | |
| G07 | Global editorial view | Filters work within the user's normal OJS permission scope | | |
| G08 | Repeat with each editorial role | No role receives records it could not access before | | |

## H. Database and performance

| ID | Test | Expected result | Result | Evidence or notes |
| --- | --- | --- | --- | --- |
| H01 | Database execution | No SQL error on the CERN-supported database | | |
| H02 | Lifecycle query plan | `po.version_stage` condition is valid and acceptably efficient | | |
| H03 | Date query plan | `s.date_submitted` bounds are valid and acceptably efficient | | |
| H04 | Large result set | Filtered dashboard response time remains acceptable | | |
| H05 | Category hierarchy | Large or nested vocabulary remains usable | | |

## I. Rollback

| ID | Test | Expected result | Result | Evidence or notes |
| --- | --- | --- | --- | --- |
| I01 | Disable plugin | ORE-specific filters cease loading after cache clear | | |
| I02 | Remove plugin directory or package | Native dashboard continues to work | | |
| I03 | Inspect database | No schema or data rollback is required | | |
| I04 | Restore earlier version if applicable | Earlier version operates after cache clear | | |

## Defects

| Defect ID | Severity | Test ID | Description | Evidence | Status |
| --- | --- | --- | --- | --- | --- |
| | | | | | |

## Conclusion

| Decision | Select one |
| --- | --- |
| Technically suitable for further UAT | Yes / No / Conditional |
| Suitable for production consideration | Yes / No / Not assessed |
| Rollback verified | Yes / No |
| Further code changes required | Yes / No |

### Conditions, required changes or unresolved risks



### Tester sign-off

| Field | Value |
| --- | --- |
| Name | |
| Date | |
| Signature or approval reference | |
