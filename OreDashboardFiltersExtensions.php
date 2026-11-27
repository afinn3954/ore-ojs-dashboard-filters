<?php

/**
 * ORE Dashboard Filters: frontend and submission collector extensions.
 * Copyright (c) 2026 Anthony Finnerty.
 * GPL-3.0-only; see plugin LICENSE.
 */

namespace APP\plugins\generic\oreDashboardFilters;

use APP\core\Application;
use APP\facades\Repo;
use APP\template\TemplateManager;
use DateTimeImmutable;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
use PKP\core\PKPApplication;
use PKP\core\PKPPageRouter;
use PKP\plugins\GenericPlugin;
use PKP\plugins\Hook;

class OreDashboardFiltersExtensions
{
    public static function register(GenericPlugin $plugin): void
    {
        Hook::add('Submission::Collector', self::filterSubmissionCollector(...));
        Hook::add('APIHandler::endpoints::plugin', self::registerApiController(...));

        $request = Application::get()->getRequest();
        $router = $request->getRouter();
        if (!($router instanceof PKPPageRouter) || $router->getRequestedPage($request) !== 'dashboard') {
            return;
        }

        $context = $request->getContext();
        $user = $request->getUser();
        if (!$context || !$user) {
            return;
        }
        $contextId = (int) $context->getId();
        $userId = (int) $user->getId();
        $canFilter = OreDashboardAccess::allowed($contextId, $userId, 'filters');
        $canViewColumns = OreDashboardAccess::allowed($contextId, $userId, 'viewColumns');
        $canViewFlags = OreDashboardAccess::allowed($contextId, $userId, 'viewFlags');
        $canEditFlags = OreDashboardAccess::allowed($contextId, $userId, 'editFlags');
        if (!$canFilter && !$canViewFlags && !$canViewColumns) {
            return;
        }
        $roles = OreDashboardAccess::roles($contextId, $userId);
        $canSeeAll = in_array(\PKP\security\Role::ROLE_ID_SITE_ADMIN, $roles, true) ||
            in_array(\PKP\security\Role::ROLE_ID_MANAGER, $roles, true);
        $prefs = OreDashboardAccess::configuration($contextId);
        $config = json_encode([
            'taskTitles' => $canFilter && $prefs['features']['oreTaskTitle']
                ? self::getTaskTitles($contextId, $userId, $canSeeAll) : [],
            'access' => [
                'filters' => $canFilter,
                'viewColumns' => $canViewColumns,
                'viewFlags' => $canViewFlags,
                'editFlags' => $canEditFlags,
            ],
            'features' => $prefs['features'],
            'columns' => $prefs['columns'],
            'appearance' => OreDashboardAccess::appearance($contextId),
            'flagsApiUrl' => $request->getDispatcher()->url(
                $request,
                Application::ROUTE_API,
                $context->getPath(),
                'ore-dashboard-flags'
            ),
        ], JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $templateManager = TemplateManager::getManager($request);
        if ($config !== false) {
            $templateManager->addJavaScript(
                'OreDashboardFiltersV3Config',
                "window.oreDashboardFiltersV3Config = {$config};",
                ['inline' => true, 'contexts' => ['backend'], 'priority' => TemplateManager::STYLE_SEQUENCE_LATE]
            );
        }
        $templateManager->addJavaScript(
            'OreDashboardFlagIcons',
            "{$request->getBaseUrl()}/{$plugin->getPluginPath()}/public/build/ore-flag-icons.js?v=0.4.2.0",
            ['inline' => false, 'contexts' => ['backend'], 'priority' => TemplateManager::STYLE_SEQUENCE_LATE]
        );
        $templateManager->addJavaScript(
            'OreDashboardFiltersV3',
            "{$request->getBaseUrl()}/{$plugin->getPluginPath()}/public/build/ore-v3.js?v=0.4.2.0",
            ['inline' => false, 'contexts' => ['backend'], 'priority' => TemplateManager::STYLE_SEQUENCE_LAST]
        );
        if ($canViewFlags && OreDashboardAccess::appearance($contextId)['showWorkflowFlag']) {
            $templateManager->addJavaScript(
                'OreDashboardWorkflowFlag',
                "{$request->getBaseUrl()}/{$plugin->getPluginPath()}/public/build/ore-workflow-flag.js?v=0.4.2.1",
                ['inline' => false, 'contexts' => ['backend'],
                 'priority' => TemplateManager::STYLE_SEQUENCE_LAST]
            );
        }
        // Scoped dashboard layout CSS. Load as a proper stylesheet after OJS's
        // build.css, so plugin cells use the native border tokens and the
        // dashboard table scrolls internally without squeezing its text.
        $cssUrl = "{$request->getBaseUrl()}/{$plugin->getPluginPath()}/public/build/ore-dashboard-layout.css?v=0.4.2.0";
        $templateManager->addHeader(
            'OreDashboardFiltersV36Layout',
            '<link rel="stylesheet" href="' . htmlspecialchars($cssUrl, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '">',
            ['contexts' => ['backend'], 'priority' => TemplateManager::STYLE_SEQUENCE_LAST]
        );
    }

    public static function registerApiController(string $hookName, $router): bool
    {
        $router->registerPluginApiControllers([new OreDashboardFlagsController()]);
        return Hook::CONTINUE;
    }

    /**
     * Task/discussion titles from the current journal. An old June record may
     * retain its title in edit_task_settings instead of edit_tasks.title.
     * Include discussions, because OJS can close them through the same UI.
     */
    private static function getTaskTitles(int $contextId, int $userId, bool $canSeeAll): array
    {
        $query = DB::table('edit_tasks as et')
            ->join('submissions as s', 's.submission_id', '=', 'et.assoc_id')
            ->leftJoin('edit_task_settings as ets', function ($join) {
                $join->on('ets.edit_task_id', '=', 'et.edit_task_id')
                    ->where('ets.setting_name', '=', 'title');
            })
            ->where('et.assoc_type', PKPApplication::ASSOC_TYPE_SUBMISSION)
            ->whereIn('et.type', [1, 2])
            ->where('s.context_id', $contextId);
        if (!$canSeeAll) {
            $query->whereExists(function (Builder $assignment) use ($userId, $contextId): void {
                $assignment->selectRaw('1')
                    ->from('stage_assignments as sa')
                    ->join('user_groups as ug', 'ug.user_group_id', '=', 'sa.user_group_id')
                    ->whereColumn('sa.submission_id', 's.submission_id')
                    ->where('sa.user_id', $userId)
                    ->where('ug.context_id', $contextId)
                    ->whereIn('ug.role_id', [
                        \PKP\security\Role::ROLE_ID_SUB_EDITOR,
                        \PKP\security\Role::ROLE_ID_ASSISTANT,
                    ]);
            });
        }
        return $query->selectRaw(
            "DISTINCT COALESCE(NULLIF(et.title, ''), NULLIF(ets.setting_value, '')) AS task_title"
        )->orderBy('task_title')->limit(250)->pluck('task_title')
            ->filter(static fn ($value) => is_string($value) && trim($value) !== '')
            ->values()->all();
    }

    public static function filterSubmissionCollector(string $hookName, array $args): bool
    {
        $query = &$args[0];
        if (!$query instanceof Builder) {
            return Hook::CONTINUE;
        }
        $request = Application::get()->getRequest();
        $router = $request->getRouter();
        if (!($router instanceof \PKP\core\APIRouter) || $router->getEntity() !== '_submissions') {
            return Hook::CONTINUE;
        }

        // The current user's actual journal role controls query parameters,
        // not the role claimed in the request or the visibility of UI fields.
        $context = $request->getContext();
        $user = $request->getUser();
        if (!$context || !$user) {
            return Hook::CONTINUE;
        }
        $contextId = (int) $context->getId();
        $userId = (int) $user->getId();
        $canFilter = OreDashboardAccess::allowed($contextId, $userId, 'filters');
        $canFlagFilter = OreDashboardAccess::allowed($contextId, $userId, 'viewFlags') &&
            $canFilter && OreDashboardAccess::feature($contextId, 'oreFlag');
        if (!$canFilter && !$canFlagFilter) {
            return Hook::CONTINUE;
        }

        $taskTitle = self::scalar($request->getUserVar('oreTaskTitle'));
        $taskState = self::scalar($request->getUserVar('oreTaskStatus'));
        $taskTitle = ($canFilter && OreDashboardAccess::feature($contextId, 'oreTaskTitle')) ? $taskTitle : null;
        $taskState = ($canFilter && OreDashboardAccess::feature($contextId, 'oreTaskStatus')) ? $taskState : null;
        if ($taskTitle !== null || in_array($taskState, ['open', 'closed'], true)) {
            $roleIds = OreDashboardAccess::roles($contextId, $userId);
            if (!in_array(\PKP\security\Role::ROLE_ID_SITE_ADMIN, $roleIds, true) &&
                !in_array(\PKP\security\Role::ROLE_ID_MANAGER, $roleIds, true)) {
                // Task filtering cannot disclose task associations from an
                // unrelated submission merely because the user is an author
                // there or holds a different editorial role elsewhere.
                $query->whereExists(function (Builder $assignment) use ($contextId, $userId): void {
                    $assignment->selectRaw('1')->from('stage_assignments as ore_task_assignment')
                        ->join('user_groups as ore_task_group',
                            'ore_task_group.user_group_id', '=', 'ore_task_assignment.user_group_id')
                        ->whereColumn('ore_task_assignment.submission_id', 's.submission_id')
                        ->where('ore_task_assignment.user_id', $userId)
                        ->where('ore_task_group.context_id', $contextId)
                        ->whereIn('ore_task_group.role_id', [
                            \PKP\security\Role::ROLE_ID_SUB_EDITOR,
                            \PKP\security\Role::ROLE_ID_ASSISTANT,
                        ]);
                });
            }
            $query->whereExists(function (Builder $subquery) use ($taskTitle, $taskState): void {
                $subquery->selectRaw('1')
                    ->from('edit_tasks as ore_task')
                    ->whereColumn('ore_task.assoc_id', 's.submission_id')
                    ->where('ore_task.assoc_type', PKPApplication::ASSOC_TYPE_SUBMISSION)
                    ->whereIn('ore_task.type', [1, 2]);
                if ($taskTitle !== null) {
                    $subquery->where(function (Builder $titleQuery) use ($taskTitle): void {
                        $titleQuery->where('ore_task.title', $taskTitle)
                            ->orWhereExists(function (Builder $legacyTitle) use ($taskTitle): void {
                                $legacyTitle->selectRaw('1')
                                    ->from('edit_task_settings as ore_task_setting')
                                    ->whereColumn('ore_task_setting.edit_task_id', 'ore_task.edit_task_id')
                                    ->where('ore_task_setting.setting_name', 'title')
                                    ->where('ore_task_setting.setting_value', $taskTitle);
                            });
                    });
                }
                // October's close action writes date_closed, while older
                // imported records can instead carry the legacy closed flag.
                if ($taskState === 'open') {
                    $subquery->whereNull('ore_task.date_closed')
                        ->where(function (Builder $q): void {
                            $q->whereNull('ore_task.closed')->orWhere('ore_task.closed', '=', 0);
                        });
                } elseif ($taskState === 'closed') {
                    $subquery->where(function (Builder $q): void {
                        $q->whereNotNull('ore_task.date_closed')
                            ->orWhere('ore_task.closed', '=', 1);
                    });
                }
            });
        }

        $rawFlag = $request->getUserVar('oreFlag');
        $flagSelection = is_array($rawFlag) ? $rawFlag : [$rawFlag];
        $flagSelection = array_merge(...array_map(
            static fn ($value) => is_string($value) ? explode(',', $value) : [$value], $flagSelection
        ));
        $flagSelection = array_values(array_unique(array_filter(array_map(
            static fn ($value) => is_scalar($value) ? trim((string) $value) : '', $flagSelection
        ))));
        if (!OreDashboardAccess::feature($contextId, 'oreFlagMultiSelect')) {
            $flagSelection = array_slice($flagSelection, 0, 1);
        }
        $flagSelection = array_slice($flagSelection, 0, 30);
        $selectedFlags = array_values(array_filter($flagSelection,
            static fn ($value) => preg_match('/^[a-z0-9_]{1,20}$/', $value) && $value !== 'unflagged'
        ));
        $includeUnflagged = in_array('unflagged', $flagSelection, true);
        if ($canFlagFilter && ($selectedFlags || $includeUnflagged)) {
            $roles = OreDashboardAccess::roles($contextId, $userId);
            if (!in_array(\PKP\security\Role::ROLE_ID_SITE_ADMIN, $roles, true) &&
                !in_array(\PKP\security\Role::ROLE_ID_MANAGER, $roles, true)) {
                $query->whereExists(function (Builder $assignment) use ($contextId, $userId): void {
                    $assignment->selectRaw('1')
                        ->from('stage_assignments as ore_assigned')
                        ->join('user_groups as ore_assignment_group',
                            'ore_assignment_group.user_group_id', '=', 'ore_assigned.user_group_id')
                        ->whereColumn('ore_assigned.submission_id', 's.submission_id')
                        ->where('ore_assigned.user_id', $userId)
                        ->where('ore_assignment_group.context_id', $contextId)
                        ->whereIn('ore_assignment_group.role_id', [
                            \PKP\security\Role::ROLE_ID_SUB_EDITOR,
                            \PKP\security\Role::ROLE_ID_ASSISTANT,
                            // Author permissions are limited to the author's
                            // own stage-assigned submissions. The native OJS
                            // My Submissions collector still restricts access.
                            \PKP\security\Role::ROLE_ID_AUTHOR,
                        ]);
                });
            }
        }
        if ($canFlagFilter && ($selectedFlags || $includeUnflagged)) {
            // OR semantics: any selected flag, optionally including unflagged.
            $query->where(function (Builder $match) use ($selectedFlags, $includeUnflagged): void {
                if ($selectedFlags) {
                    $match->whereExists(function (Builder $subquery) use ($selectedFlags): void {
                        $subquery->selectRaw('1')->from('ore_dashboard_flags as ore_flag')
                            ->whereColumn('ore_flag.submission_id', 's.submission_id')
                            ->whereIn('ore_flag.flag', $selectedFlags);
                    });
                }
                if ($includeUnflagged) {
                    $method = $selectedFlags ? 'orWhereNotExists' : 'whereNotExists';
                    $match->{$method}(function (Builder $subquery): void {
                        $subquery->selectRaw('1')->from('ore_dashboard_flags as ore_no_flag')
                            ->whereColumn('ore_no_flag.submission_id', 's.submission_id');
                    });
                }
            });
        }

        // The native OJS dashboard heading sends orderBy=oreFlag and an
        // orderDirection. OJS does not recognise plugin-specific sort keys,
        // so we sort the collector query on the server across all pages.
        $flagOrderBy = self::scalar($request->getUserVar('orderBy'));
        $flagOrderDirection = self::scalar($request->getUserVar('orderDirection'));
        if ($canFlagFilter && OreDashboardAccess::feature($contextId, 'oreFlagSort') &&
            $flagOrderBy === 'oreFlag' &&
            in_array($flagOrderDirection, ['ASC', 'DESC'], true)) {
            // Sort by the configured full flag name, not internal flag key.
            $direction = $flagOrderDirection;
            $query->reorder();
            $query->orderByRaw('CASE WHEN EXISTS (SELECT 1 FROM ore_dashboard_flags osf WHERE osf.submission_id = s.submission_id) THEN 0 ELSE 1 END ASC');
            $query->orderByRaw('(SELECT fd.label FROM ore_dashboard_flags osf JOIN ore_dashboard_flag_definitions fd ON fd.flag_key = osf.flag AND fd.context_id = osf.context_id WHERE osf.submission_id = s.submission_id LIMIT 1) ' . $direction);
            $query->orderBy('s.submission_id', 'desc');
        }

        $timeFrom = self::parseTime(self::scalar($request->getUserVar('oreTimeFrom')));
        $timeTo = self::parseTime(self::scalar($request->getUserVar('oreTimeTo')));
        if ($canFilter && OreDashboardAccess::feature($contextId, 'oreSubmissionTime') &&
            ($timeFrom !== null || $timeTo !== null)) {
            $mode = self::scalar($request->getUserVar('oreSubmissionDate'));
            $dateFrom = self::parseDate(self::scalar($request->getUserVar('oreDateFrom')));
            $dateTo = self::parseDate(self::scalar($request->getUserVar('oreDateTo')));

            // With custom date boundaries, constrain the selected range's actual
            // start/end timestamps. One-sided date ranges are supported too.
            // Without custom dates, times are a daily time-of-day filter.
            if ($mode === 'custom' && ($dateFrom !== null || $dateTo !== null)) {
                if ($timeFrom !== null && $dateFrom !== null) {
                    $query->where('s.date_submitted', '>=', "{$dateFrom} {$timeFrom}:00");
                }
                if ($timeTo !== null && $dateTo !== null) {
                    $query->where('s.date_submitted', '<=', "{$dateTo} {$timeTo}:59");
                }
            } else {
                if ($timeFrom !== null && $timeTo !== null && $timeFrom > $timeTo) {
                    $query->where(function (Builder $q) use ($timeFrom, $timeTo): void {
                        $q->whereRaw('TIME(s.date_submitted) >= ?', ["{$timeFrom}:00"])
                            ->orWhereRaw('TIME(s.date_submitted) <= ?', ["{$timeTo}:59"]);
                    });
                } else {
                    if ($timeFrom !== null) {
                        $query->whereRaw('TIME(s.date_submitted) >= ?', ["{$timeFrom}:00"]);
                    }
                    if ($timeTo !== null) {
                        $query->whereRaw('TIME(s.date_submitted) <= ?', ["{$timeTo}:59"]);
                    }
                }
            }
        }
        return Hook::CONTINUE;
    }

    private static function parseDate(?string $value): ?string
    {
        if (!$value || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            return null;
        }
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
        return ($date && $date->format('Y-m-d') === $value) ? $value : null;
    }

    private static function parseTime(?string $value): ?string
    {
        return $value !== null && preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $value) ? $value : null;
    }

    private static function scalar($value): ?string
    {
        if (is_array($value)) {
            $value = reset($value);
        }
        if (!is_scalar($value)) {
            return null;
        }
        $value = trim((string) $value);
        return $value === '' ? null : $value;
    }
}
