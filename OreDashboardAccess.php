<?php
/**
 * @file OreDashboardAccess.php
 * Journal-scoped permissions and dashboard preferences for ORE Dashboard Filters.
 * Copyright (c) 2026 Anthony Finnerty.
 * Distributed under GPL-3.0-only; see the plugin LICENSE.
 */
namespace APP\plugins\generic\oreDashboardFilters;

use APP\core\Application;
use APP\facades\Repo;
use Illuminate\Support\Facades\DB;
use PKP\security\Role;

final class OreDashboardAccess
{
    private const PLUGIN = 'oredashboardfiltersplugin';
    private const SETTING = 'oreDashboardAccessV1';
    private const APPEARANCE_SETTING = 'oreDashboardAppearanceV1';
    private const USER_PERMISSIONS_SETTING = 'oreDashboardUserPermissionsV1';
    public const ABILITIES = ['filters', 'viewColumns', 'viewFlags', 'editFlags'];

    public const DEFAULT_ROLES = [
        'subEditor' => ['filters' => true, 'viewColumns' => true, 'viewFlags' => true, 'editFlags' => true],
        'assistant' => ['filters' => true, 'viewColumns' => true, 'viewFlags' => true, 'editFlags' => false],
        'author' => ['filters' => false, 'viewColumns' => false, 'viewFlags' => false, 'editFlags' => false],
        'reviewer' => ['filters' => false, 'viewColumns' => false, 'viewFlags' => false, 'editFlags' => false],
        'reader' => ['filters' => false, 'viewColumns' => false, 'viewFlags' => false, 'editFlags' => false],
        'subscriptionManager' => ['filters' => false, 'viewColumns' => false, 'viewFlags' => false, 'editFlags' => false],
    ];

    /** Site Admin and Journal Manager are intentionally not configurable. */
    public const ROLE_IDS = [
        'subEditor' => Role::ROLE_ID_SUB_EDITOR,
        'assistant' => Role::ROLE_ID_ASSISTANT,
        'author' => Role::ROLE_ID_AUTHOR,
        'reviewer' => Role::ROLE_ID_REVIEWER,
        'reader' => Role::ROLE_ID_READER,
        'subscriptionManager' => Role::ROLE_ID_SUBSCRIPTION_MANAGER,
    ];

    public const DEFAULT_FEATURES = [
        'oreVersionStage' => true,
        'stageIds' => true,
        'oreSubmissionDate' => true,
        'oreSubmissionTime' => true,
        'oreTaskTitle' => true,
        'oreTaskStatus' => true,
        'oreFlag' => true,
        'oreFlagMultiSelect' => true,
        'oreFlagSort' => true,
        'oreSection' => true,
        'oreCategory' => true,
    ];

    public const DEFAULT_COLUMNS = [
        'submitted' => true,
        'lastUpdated' => true,
        'publishingStage' => true,
        'flag' => true,
    ];

    /** Missing settings retain secure defaults, and malformed settings never grant access. */
    public static function configuration(int $contextId): array
    {
        $default = [
            'roles' => self::DEFAULT_ROLES,
            'features' => self::DEFAULT_FEATURES,
            'columns' => self::DEFAULT_COLUMNS,
        ];
        if ($contextId < 1) {
            return $default;
        }
        $raw = DB::table('plugin_settings')
            ->where('plugin_name', self::PLUGIN)
            ->where('context_id', $contextId)
            ->where('setting_name', self::SETTING)
            ->value('setting_value');
        if (!is_string($raw) || $raw === '') {
            return $default;
        }
        $parsed = json_decode($raw, true);
        // Upgrade existing v0.3.3 settings transparently, keeping editor choices
        // and making all newly configurable non-editorial roles opt-in.
        $valid = self::validateSettings(self::upgradeLegacyRoles($parsed));
        if ($valid !== null) {
            return $valid;
        }
        // A malformed saved setting must NOT silently restore editor grants.
        // Site Admins and Journal Managers can still reach Settings to repair it.
        foreach ($default['roles'] as $role => $permissions) {
            foreach ($permissions as $ability => $_) {
                $default['roles'][$role][$ability] = false;
            }
        }
        return $default;
    }

    /** Upgrade only the exact earlier v0.3.3 two-role shape. Never accept unknown roles. */
    private static function upgradeLegacyRoles(mixed $settings): mixed
    {
        if (!is_array($settings) || !isset($settings['roles']) || !is_array($settings['roles'])) {
            return $settings;
        }
        if (array_keys($settings) === ['roles', 'features', 'columns'] &&
            array_keys($settings['roles']) === ['subEditor', 'assistant']) {
            $settings = [
                'roles' => array_replace(self::DEFAULT_ROLES, $settings['roles']),
                'features' => $settings['features'],
                'columns' => $settings['columns'],
            ];
        }
        if (array_keys($settings) === ['roles', 'features', 'columns'] &&
            isset($settings['features']) && is_array($settings['features'])) {
            // Preserve all existing filter settings when new capabilities are introduced.
            foreach (['oreFlagMultiSelect', 'oreFlagSort'] as $key) {
                if (!array_key_exists($key, $settings['features'])) {
                    $settings['features'][$key] = self::DEFAULT_FEATURES[$key];
                }
            }
            if (array_diff(array_keys($settings['features']), array_keys(self::DEFAULT_FEATURES))) {
                return $settings;
            }
            // Reorder exactly as the known feature schema.
            $settings['features'] = array_replace(self::DEFAULT_FEATURES, $settings['features']);
        }
        return $settings;
    }

    /** Validation is strict to avoid accidental privilege escalation. */
    public static function validateSettings(mixed $settings): ?array
    {
        if (!is_array($settings) || array_keys($settings) !== ['roles', 'features', 'columns']) {
            return null;
        }
        foreach (['roles' => self::DEFAULT_ROLES, 'features' => self::DEFAULT_FEATURES,
                  'columns' => self::DEFAULT_COLUMNS] as $group => $options) {
            if (!isset($settings[$group]) || !is_array($settings[$group]) ||
                array_keys($settings[$group]) !== array_keys($options)) {
                return null;
            }
            foreach ($options as $key => $value) {
                if ($group === 'roles') {
                    if (!is_array($settings['roles'][$key]) ||
                        array_keys($settings['roles'][$key]) !== array_keys($value)) {
                        return null;
                    }
                    foreach ($value as $ability => $_) {
                        if (!is_bool($settings['roles'][$key][$ability])) {
                            return null;
                        }
                    }
                } elseif (!is_bool($settings[$group][$key])) {
                    return null;
                }
            }
        }
        // A role cannot edit flags without being allowed to view them.
        foreach ($settings['roles'] as $role) {
            if ($role['editFlags'] && !$role['viewFlags']) {
                return null;
            }
        }
        return $settings;
    }

    public static function saveConfiguration(int $contextId, array $settings): void
    {
        $valid = self::validateSettings($settings);
        if ($contextId < 1 || $valid === null) {
            throw new \InvalidArgumentException('Invalid ORE dashboard access configuration');
        }
        DB::table('plugin_settings')->updateOrInsert(
            ['plugin_name' => self::PLUGIN, 'context_id' => $contextId, 'setting_name' => self::SETTING],
            ['setting_type' => 'string', 'setting_value' => json_encode($valid, JSON_THROW_ON_ERROR)]
        );
    }

    /** Independent display preferences, never used as access-control settings. */
    public const DEFAULT_APPEARANCE = [
        'layout' => 'compact',
        'dateFormat' => 'short',
        'flagDisplay' => 'short',
        'showSubmitted' => false,
        'showPublishingStage' => false,
        'showEditorialActivity' => true,
        'showWorkflowFlag' => true,
    ];

    public static function validateAppearance(mixed $value): ?array
    {
        if (!is_array($value) || array_keys($value) !== array_keys(self::DEFAULT_APPEARANCE)) {
            return null;
        }
        if (!in_array($value['layout'], ['compact', 'detailed'], true) ||
            !in_array($value['dateFormat'], ['short', 'full'], true) ||
            !in_array($value['flagDisplay'], ['icon', 'short', 'full'], true)) {
            return null;
        }
        foreach (['showSubmitted', 'showPublishingStage', 'showEditorialActivity', 'showWorkflowFlag'] as $key) {
            if (!is_bool($value[$key])) {
                return null;
            }
        }
        return $value;
    }

    public static function appearance(int $contextId): array
    {
        if ($contextId < 1) return self::DEFAULT_APPEARANCE;
        $raw = DB::table('plugin_settings')
            ->where('plugin_name', self::PLUGIN)
            ->where('context_id', $contextId)
            ->where('setting_name', self::APPEARANCE_SETTING)
            ->value('setting_value');
        if (!is_string($raw)) return self::DEFAULT_APPEARANCE;
        $value = json_decode($raw, true);
        if (is_array($value) && !array_key_exists('showWorkflowFlag', $value)) {
            $value['showWorkflowFlag'] = self::DEFAULT_APPEARANCE['showWorkflowFlag'];
        }
        return self::validateAppearance($value) ?? self::DEFAULT_APPEARANCE;
    }

    public static function saveAppearance(int $contextId, array $preferences): void
    {
        $valid = self::validateAppearance($preferences);
        if ($contextId < 1 || $valid === null) throw new \InvalidArgumentException('Invalid appearance settings');
        DB::table('plugin_settings')->updateOrInsert(
            ['plugin_name' => self::PLUGIN, 'context_id' => $contextId,
             'setting_name' => self::APPEARANCE_SETTING],
            ['setting_type' => 'string', 'setting_value' => json_encode($valid, JSON_THROW_ON_ERROR)]
        );
    }

    public static function contextAndUser(): ?array
    {
        $request = Application::get()->getRequest();
        $context = $request->getContext();
        $user = $request->getUser();
        return $context && $user ? [(int) $context->getId(), (int) $user->getId()] : null;
    }

    public static function roles(int $contextId, int $userId): array
    {
        if ($contextId < 1 || $userId < 1) {
            return [];
        }
        $roleIds = DB::table('user_user_groups as uug')
            ->join('user_groups as ug', 'ug.user_group_id', '=', 'uug.user_group_id')
            ->where('uug.user_id', $userId)
            ->where(function ($q) use ($contextId) {
                $q->where('ug.context_id', $contextId)
                    ->orWhere('ug.role_id', Role::ROLE_ID_SITE_ADMIN);
            })
            ->pluck('ug.role_id')->map(static fn ($id) => (int) $id)->all();
        return array_values(array_unique($roleIds));
    }

    /** Individual overrides are separate from the existing role settings. */
    public static function userOverrides(int $contextId): array
    {
        if ($contextId < 1) return [];
        $raw = DB::table('plugin_settings')->where('plugin_name', self::PLUGIN)
            ->where('context_id', $contextId)
            ->where('setting_name', self::USER_PERMISSIONS_SETTING)
            ->value('setting_value');
        $decoded = is_string($raw) ? json_decode($raw, true) : null;
        if (!is_array($decoded)) return [];
        $valid = [];
        foreach ($decoded as $id => $abilities) {
            if (!ctype_digit((string) $id) || (int) $id <= 0 ||
                !self::validateAbilities($abilities)) continue;
            $valid[(string) (int) $id] = $abilities;
        }
        return $valid;
    }

    public static function validateAbilities(mixed $abilities): bool
    {
        if (!is_array($abilities) || array_keys($abilities) !== self::ABILITIES) return false;
        foreach (self::ABILITIES as $ability) {
            if (!is_bool($abilities[$ability])) return false;
        }
        return !$abilities['editFlags'] || $abilities['viewFlags'];
    }

    public static function saveUserOverride(int $contextId, int $userId, ?array $abilities): void
    {
        if ($contextId < 1 || $userId < 1 ||
            ($abilities !== null && !self::validateAbilities($abilities))) {
            throw new \InvalidArgumentException('Invalid individual user permissions');
        }
        $current = self::userOverrides($contextId);
        if ($abilities === null) unset($current[(string) $userId]);
        else $current[(string) $userId] = $abilities;
        if (count($current) > 100) throw new \InvalidArgumentException('Maximum 100 individual overrides');
        DB::table('plugin_settings')->updateOrInsert(
            ['plugin_name' => self::PLUGIN, 'context_id' => $contextId,
             'setting_name' => self::USER_PERMISSIONS_SETTING],
            ['setting_type' => 'string', 'setting_value' => json_encode($current, JSON_THROW_ON_ERROR)]
        );
    }

    public static function userHasJournalRole(int $contextId, int $userId): bool
    {
        return count(self::roles($contextId, $userId)) > 0;
    }

    public static function allowed(int $contextId, int $userId, string $ability): bool
    {
        if (!in_array($ability, ['filters', 'viewColumns', 'viewFlags', 'editFlags', 'settings'], true)) {
            return false;
        }
        $roles = self::roles($contextId, $userId);
        if (in_array(Role::ROLE_ID_SITE_ADMIN, $roles, true) || in_array(Role::ROLE_ID_MANAGER, $roles, true)) {
            return true; // never lock journal managers or site administrators out of settings
        }
        if ($ability === 'settings') {
            return false;
        }
        $override = self::userOverrides($contextId)[(string) $userId] ?? null;
        if ($override !== null && array_key_exists($ability, $override)) {
            return count($roles) > 0 && $override[$ability];
        }
        $cfg = self::configuration($contextId)['roles'];
        // A genuine journal membership is required. Multiple roles combine by
        // OR; the browser may never assert a role itself.
        foreach (self::ROLE_IDS as $key => $roleId) {
            if (in_array($roleId, $roles, true) && $cfg[$key][$ability]) {
                return true;
            }
        }
        return false;
    }

    public static function allowsCurrentUser(string $ability): bool
    {
        $identity = self::contextAndUser();
        return $identity && self::allowed($identity[0], $identity[1], $ability);
    }

    public static function feature(int $contextId, string $name): bool
    {
        return (bool) (self::configuration($contextId)['features'][$name] ?? false);
    }

    public static function column(int $contextId, string $name): bool
    {
        return (bool) (self::configuration($contextId)['columns'][$name] ?? false);
    }

    public static function canAccessSubmission(int $contextId, int $userId, int $submissionId, string $ability): bool
    {
        if ($submissionId < 1 || !self::allowed($contextId, $userId, $ability)) {
            return false;
        }
        $submission = Repo::submission()->get($submissionId);
        if (!$submission || (int) $submission->getData('contextId') !== $contextId) {
            return false;
        }
        $roles = self::roles($contextId, $userId);
        if (in_array(Role::ROLE_ID_SITE_ADMIN, $roles, true) || in_array(Role::ROLE_ID_MANAGER, $roles, true)) {
            return true;
        }
        // Only check the requested operation on records actually associated
        // with the user, not journal-wide merely because a role is enabled.
        $settings = self::configuration($contextId)['roles'];
        $override = self::userOverrides($contextId)[(string) $userId] ?? null;
        $assignmentRoles = [];
        foreach (['subEditor', 'assistant', 'author'] as $key) {
            $roleId = self::ROLE_IDS[$key];
            if (in_array($roleId, $roles, true) && ($override[$ability] ?? $settings[$key][$ability])) {
                $assignmentRoles[] = $roleId;
            }
        }
        if ($assignmentRoles && DB::table('stage_assignments as sa')
            ->join('user_groups as ug', 'ug.user_group_id', '=', 'sa.user_group_id')
            ->join('user_user_groups as uug', function ($join) {
                $join->on('uug.user_group_id', '=', 'sa.user_group_id')
                    ->on('uug.user_id', '=', 'sa.user_id');
            })
            ->where('sa.submission_id', $submissionId)
            ->where('sa.user_id', $userId)
            ->where('ug.context_id', $contextId)
            ->whereIn('ug.role_id', $assignmentRoles)
            ->exists()) {
            return true;
        }

        if (in_array(Role::ROLE_ID_REVIEWER, $roles, true) && ($override[$ability] ?? $settings['reviewer'][$ability])) {
            if (DB::table('review_assignments')
                ->where('submission_id', $submissionId)
                ->where('reviewer_id', $userId)
                ->where('cancelled', 0)
                ->exists()) {
                return true;
            }
        }

        // Reader-only and subscription-manager accounts have no editorial
        // submission assignment. A plugin override cannot expose journal-wide
        // internal flag data or convert those accounts into editors.
        return false;
    }
}
