<?php
/**
 * @file OreDashboardFlagsController.php
 * ORE dashboard flags, configurable per journal, October OJS 3.6.
 * Copyright (c) 2026 Anthony Finnerty.
 * Distributed under GPL-3.0-only (see plugin LICENSE).
 */
namespace APP\plugins\generic\oreDashboardFilters;

use APP\core\Application;
use APP\facades\Repo;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use PKP\core\PKPBaseController;
use PKP\core\PKPRequest;
use PKP\security\authorization\ContextAccessPolicy;
use PKP\security\authorization\UserRolesRequiredPolicy;
use PKP\security\Role;

class OreDashboardFlagsController extends PKPBaseController
{
    public const ICONS = ['check-circle', 'circle-alert', 'clock', 'flag', 'shield-check',
        'bookmark', 'star', 'eye', 'file-check', 'search', 'pause-circle', 'circle-x',
        'message-circle', 'mail', 'calendar', 'clipboard-check', 'alert-triangle',
        'info', 'tag', 'layers', 'check', 'circle-help', 'hourglass', 'bell'];

    private const PRESENTATION_SETTING = 'oreDashboardFlagPresentationV1';

    public const DEFAULT_FLAGS = [
        ['id' => 'completed', 'label' => 'Completed', 'color' => '#178346'],
        ['id' => 'check', 'label' => 'Needs checking', 'color' => '#b4232a'],
        ['id' => 'in_progress', 'label' => 'In progress', 'color' => '#b86b07'],
    ];

    public function getHandlerPath(): string
    {
        return 'ore-dashboard-flags';
    }

    public function getRouteGroupMiddleware(): array
    {
        return ['has.user', 'has.context'];
    }

    public function getGroupRoutes(): void
    {
        // The role matrix grants optional capabilities. Every operation still
        // passes the journal and submission-level server-side checks below.
        $editors = [
            Role::ROLE_ID_SITE_ADMIN, Role::ROLE_ID_MANAGER,
            Role::ROLE_ID_SUB_EDITOR, Role::ROLE_ID_ASSISTANT,
            Role::ROLE_ID_AUTHOR, Role::ROLE_ID_REVIEWER,
            Role::ROLE_ID_READER, Role::ROLE_ID_SUBSCRIPTION_MANAGER,
        ];
        $managers = [Role::ROLE_ID_SITE_ADMIN, Role::ROLE_ID_MANAGER];
        Route::get('', $this->getMany(...))->name('ore.dashboard.flags.getMany')
            ->middleware([self::roleAuthorizer($editors)]);
        Route::post('', $this->save(...))->name('ore.dashboard.flags.save')
            ->middleware([self::roleAuthorizer($editors)]);
        Route::get('definitions', $this->getDefinitions(...))
            ->name('ore.dashboard.flags.definitions')->middleware([self::roleAuthorizer($editors)]);
        Route::put('definitions', $this->saveDefinitions(...))
            ->name('ore.dashboard.flags.definitions.save')->middleware([self::roleAuthorizer($managers)]);
        Route::get('preferences', $this->getPreferences(...))
            ->name('ore.dashboard.flags.preferences')->middleware([self::roleAuthorizer($managers)]);
        Route::put('preferences', $this->savePreferences(...))
            ->name('ore.dashboard.flags.preferences.save')->middleware([self::roleAuthorizer($managers)]);
        Route::get('user-permissions', $this->getUserPermissions(...))
            ->name('ore.dashboard.flags.userPermissions')->middleware([self::roleAuthorizer($managers)]);
        Route::put('user-permissions', $this->saveUserPermissions(...))
            ->name('ore.dashboard.flags.userPermissions.save')->middleware([self::roleAuthorizer($managers)]);
        Route::get('appearance', $this->getAppearance(...))
            ->name('ore.dashboard.flags.appearance')->middleware([self::roleAuthorizer($managers)]);
        Route::put('appearance', $this->saveAppearance(...))
            ->name('ore.dashboard.flags.appearance.save')->middleware([self::roleAuthorizer($managers)]);
    }

    public function authorize(PKPRequest $request, array &$args, $roleAssignments): bool
    {
        $this->addPolicy(new UserRolesRequiredPolicy($request), true);
        $this->addPolicy(new ContextAccessPolicy($request, $roleAssignments));
        return parent::authorize($request, $args, $roleAssignments);
    }

    private function identity(): ?array
    {
        $request = Application::get()->getRequest();
        $context = $request->getContext();
        $user = $request->getUser();
        if (!$context || !$user) {
            return null;
        }
        return [(int) $context->getId(), (int) $user->getId()];
    }

    private function isManager(): bool
    {
        $identity = $this->identity();
        return $identity && OreDashboardAccess::allowed($identity[0], $identity[1], 'settings');
    }

    private function currentUserCanViewFlag(int $submissionId): bool
    {
        $identity = $this->identity();
        return $identity && OreDashboardAccess::canAccessSubmission(
            $identity[0], $identity[1], $submissionId, 'viewFlags'
        );
    }

    private function currentUserCanFlag(int $submissionId): bool
    {
        $identity = $this->identity();
        return $identity && OreDashboardAccess::canAccessSubmission(
            $identity[0], $identity[1], $submissionId, 'editFlags'
        );
    }

    public static function definitionsTableExists(): bool
    {
        return DB::getSchemaBuilder()->hasTable('ore_dashboard_flag_definitions');
    }

    private function flagsTableExists(): bool
    {
        return DB::getSchemaBuilder()->hasTable('ore_dashboard_flags');
    }

    public static function ensureDefaultDefinitions(int $contextId): void
    {
        if (DB::table('ore_dashboard_flag_definitions')->where('context_id', $contextId)->exists()) {
            return;
        }
        foreach (self::DEFAULT_FLAGS as $position => $flag) {
            DB::table('ore_dashboard_flag_definitions')->insertOrIgnore([
                'context_id' => $contextId,
                'flag_key' => $flag['id'],
                'label' => $flag['label'],
                'color' => $flag['color'],
                'sort_order' => $position,
                'updated_at' => now(),
            ]);
        }
    }

    /** Existing definitions retain their stable IDs and the original table schema.
     * New visual metadata is in a separate, journal-scoped plugin setting. */
    public static function presentation(int $contextId): array
    {
        $raw = DB::table('plugin_settings')
            ->where('plugin_name', 'oredashboardfiltersplugin')
            ->where('context_id', $contextId)
            ->where('setting_name', self::PRESENTATION_SETTING)
            ->value('setting_value');
        $decoded = is_string($raw) ? json_decode($raw, true) : null;
        return is_array($decoded) ? $decoded : [];
    }

    private static function defaultVisual(string $key, string $label): array
    {
        $base = [
            'completed' => ['shortLabel' => 'Done', 'icon' => 'check-circle'],
            'check' => ['shortLabel' => 'Check', 'icon' => 'circle-alert'],
            'in_progress' => ['shortLabel' => 'WIP', 'icon' => 'clock'],
        ];
        return ($base[$key] ?? ['shortLabel' => mb_substr($label, 0, 20), 'icon' => 'flag'])
            + ['enabled' => true];
    }

    public static function definitions(int $contextId): array
    {
        self::ensureDefaultDefinitions($contextId);
        $metadata = self::presentation($contextId);
        return DB::table('ore_dashboard_flag_definitions')
            ->where('context_id', $contextId)
            ->orderBy('sort_order')->orderBy('flag_key')
            ->get(['flag_key', 'label', 'color'])
            ->map(static function ($row) use ($metadata) {
                $default = self::defaultVisual((string) $row->flag_key, (string) $row->label);
                $extra = $metadata[$row->flag_key] ?? [];
                if (!is_array($extra)) $extra = [];
                $icon = $extra['icon'] ?? $default['icon'];
                $short = $extra['shortLabel'] ?? $default['shortLabel'];
                $enabled = $extra['enabled'] ?? true;
                return [
                    'id' => $row->flag_key,
                    'label' => $row->label,
                    'color' => $row->color,
                    'shortLabel' => is_string($short) && mb_strlen($short) <= 20 ? $short : $default['shortLabel'],
                    'icon' => is_string($icon) && in_array($icon, self::ICONS, true) ? $icon : 'flag',
                    'enabled' => is_bool($enabled) ? $enabled : true,
                ];
            })->all();
    }

    /** GET /ore-dashboard-flags?ids=1,2,3 */
    public function getMany(Request $request): JsonResponse
    {
        if (!$this->flagsTableExists()) {
            return response()->json(['error' => 'ORE flags table is not installed'], Response::HTTP_SERVICE_UNAVAILABLE);
        }
        $ids = array_values(array_unique(array_filter(array_map(
            static fn ($id) => ctype_digit(trim($id)) ? (int) trim($id) : 0,
            explode(',', (string) $request->query('ids', ''))
        ))));
        if (count($ids) > 100) {
            return response()->json(['error' => 'Maximum 100 submission IDs'], Response::HTTP_BAD_REQUEST);
        }
        $identity = $this->identity();
        if (!$identity || !OreDashboardAccess::allowed($identity[0], $identity[1], 'viewFlags')) {
            return response()->json(['error' => 'Flag viewing is disabled for this role'], Response::HTTP_FORBIDDEN);
        }
        $allowed = array_values(array_filter($ids, $this->currentUserCanViewFlag(...)));
        $writable = array_values(array_filter($allowed, $this->currentUserCanFlag(...)));
        $flags = DB::table('ore_dashboard_flags')->whereIn('submission_id', $allowed ?: [-1])
            ->pluck('flag', 'submission_id')->all();
        return response()->json(['flags' => $flags, 'editableIds' => $writable], Response::HTTP_OK);
    }

    /** POST /ore-dashboard-flags {submissionId,flag} */
    public function save(Request $request): JsonResponse
    {
        if (!$this->flagsTableExists() || !self::definitionsTableExists()) {
            return response()->json(['error' => 'ORE flag tables are not installed'], Response::HTTP_SERVICE_UNAVAILABLE);
        }
        $submissionId = filter_var($request->input('submissionId'), FILTER_VALIDATE_INT);
        // Laravel's ConvertEmptyStringsToNull middleware may turn the JSON
        // value "flag": "" (the explicit No flag option) into null. Only an
        // *included* flag key may clear the existing assignment. Missing keys,
        // arrays and non-string flag values remain invalid.
        $input = $request->all();
        if (!array_key_exists('flag', $input)) {
            return response()->json(['error' => 'Flag field is required'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }
        $flag = $input['flag'];
        if ($flag === null) {
            $flag = '';
        }
        if (!$submissionId || $submissionId < 1 || !is_string($flag) || strlen($flag) > 20) {
            return response()->json(['error' => 'Invalid submission or flag'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }
        if (!$this->currentUserCanFlag((int) $submissionId)) {
            return response()->json(['error' => 'No editorial access to this submission'], Response::HTTP_FORBIDDEN);
        }
        [$contextId, $userId] = $this->identity();
        self::ensureDefaultDefinitions($contextId);
        if ($flag !== '' && !collect(self::definitions($contextId))->contains(
                static fn (array $definition) => $definition['id'] === $flag && $definition['enabled'])) {
            return response()->json(['error' => 'Unknown flag for this journal'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }
        if ($flag === '') {
            DB::table('ore_dashboard_flags')->where('submission_id', $submissionId)
                ->where('context_id', $contextId)->delete();
        } else {
            DB::table('ore_dashboard_flags')->updateOrInsert(
                ['submission_id' => (int) $submissionId],
                ['context_id' => $contextId, 'flag' => $flag, 'updated_by' => $userId, 'updated_at' => now()]
            );
        }
        return response()->json(['submissionId' => (int) $submissionId, 'flag' => $flag], Response::HTTP_OK);
    }

    /** GET /ore-dashboard-flags/definitions */
    public function getDefinitions(Request $request): JsonResponse
    {
        if (!self::definitionsTableExists()) {
            return response()->json(['error' => 'ORE definitions table is not installed'], Response::HTTP_SERVICE_UNAVAILABLE);
        }
        $identity = $this->identity();
        if (!$identity) {
            return response()->json(['error' => 'Unauthorised'], Response::HTTP_FORBIDDEN);
        }
        if (!OreDashboardAccess::allowed($identity[0], $identity[1], 'viewFlags')) {
            return response()->json(['error' => 'Flag viewing is disabled for this role'], Response::HTTP_FORBIDDEN);
        }
        return response()->json([
            'flags' => self::definitions($identity[0]),
            'canManage' => $this->isManager(),
        ], Response::HTTP_OK);
    }

    /** PUT /ore-dashboard-flags/definitions {flags:[{id?,label,color},...]} */
    public function saveDefinitions(Request $request): JsonResponse
    {
        if (!self::definitionsTableExists() || !$this->flagsTableExists()) {
            return response()->json(['error' => 'ORE flag tables are not installed'], Response::HTTP_SERVICE_UNAVAILABLE);
        }
        if (!$this->isManager()) {
            return response()->json(['error' => 'Journal manager permissions required'], Response::HTTP_FORBIDDEN);
        }
        $incoming = $request->input('flags');
        if (!is_array($incoming) || !array_is_list($incoming) || count($incoming) < 1 || count($incoming) > 30) {
            return response()->json(['error' => 'Supply between 1 and 30 ordered flags'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }
        [$contextId] = $this->identity();
        self::ensureDefaultDefinitions($contextId);
        $existing = DB::table('ore_dashboard_flag_definitions')->where('context_id', $contextId)
            ->pluck('flag_key')->all();
        $existingSet = array_fill_keys($existing, true);
        $normalised = [];
        $seenIds = [];
        $seenLabels = [];
        foreach ($incoming as $index => $row) {
            if (!is_array($row)) {
                return response()->json(['error' => 'Invalid flag row'], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
            $id = $row['id'] ?? '';
            $label = $row['label'] ?? null;
            $color = $row['color'] ?? null;
            $short = $row['shortLabel'] ?? null;
            $icon = $row['icon'] ?? null;
            $enabled = $row['enabled'] ?? null;
            if (!is_string($id) || !is_string($label) || !is_string($color)) {
                return response()->json(['error' => 'Invalid flag values'], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
            $label = trim($label);
            $color = strtolower(trim($color));
            if (!is_string($short) || !is_string($icon) || !is_bool($enabled)) {
                return response()->json(['error' => 'Invalid icon, short label or enabled state'], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
            $short = trim($short);
            if ($id !== '' && (!isset($existingSet[$id]) || isset($seenIds[$id]))) {
                return response()->json(['error' => 'Unknown or duplicate flag ID'], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
            $len = mb_strlen($label);
            if ($len < 1 || $len > 80 || !preg_match('/^#[0-9a-f]{6}$/', $color) ||
                mb_strlen($short) < 1 || mb_strlen($short) > 20 ||
                !in_array($icon, self::ICONS, true)) {
                return response()->json(['error' => 'Flag names must be 1–80 characters and colours must be #RRGGBB'], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
            $lowerLabel = mb_strtolower($label);
            if (isset($seenLabels[$lowerLabel])) {
                return response()->json(['error' => 'Duplicate flag names are not allowed'], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
            $seenLabels[$lowerLabel] = true;
            if ($id !== '') {
                $seenIds[$id] = true;
            }
            $normalised[] = ['id' => $id, 'label' => $label, 'color' => $color,
                'shortLabel' => $short, 'icon' => $icon, 'enabled' => $enabled, 'sort' => $index];
        }
        $removed = array_values(array_diff($existing, array_keys($seenIds)));
        if ($removed) {
            $assigned = DB::table('ore_dashboard_flags')->where('context_id', $contextId)
                ->whereIn('flag', $removed)->exists();
            if ($assigned) {
                return response()->json([
                    'error' => 'A removed flag is still assigned to submissions. Clear those assignments first.',
                ], Response::HTTP_CONFLICT);
            }
        }
        DB::transaction(function () use ($normalised, $removed, $contextId): void {
            $metadata = [];
            foreach ($normalised as $flag) {
                $id = $flag['id'] ?: ('f_' . bin2hex(random_bytes(6)));
                $metadata[$id] = ['shortLabel' => $flag['shortLabel'],
                    'icon' => $flag['icon'], 'enabled' => $flag['enabled']];
                DB::table('ore_dashboard_flag_definitions')->updateOrInsert(
                    ['context_id' => $contextId, 'flag_key' => $id],
                    ['label' => $flag['label'], 'color' => $flag['color'],
                        'sort_order' => $flag['sort'], 'updated_at' => now()]
                );
            }
            DB::table('plugin_settings')->updateOrInsert(
                ['plugin_name' => 'oredashboardfiltersplugin', 'context_id' => $contextId,
                 'setting_name' => self::PRESENTATION_SETTING],
                ['setting_type' => 'string', 'setting_value' => json_encode($metadata, JSON_THROW_ON_ERROR)]
            );
            if ($removed) {
                DB::table('ore_dashboard_flag_definitions')->where('context_id', $contextId)
                    ->whereIn('flag_key', $removed)->delete();
            }
        });
        return response()->json(['flags' => self::definitions($contextId)], Response::HTTP_OK);
    }
    /** Separate appearance settings avoid changing existing role preference structure. */
    public function getAppearance(Request $request): JsonResponse
    {
        if (!$this->isManager()) return response()->json(['error' => 'Manager required'], Response::HTTP_FORBIDDEN);
        [$contextId] = $this->identity();
        return response()->json(['appearance' => OreDashboardAccess::appearance($contextId)]);
    }

    public function saveAppearance(Request $request): JsonResponse
    {
        if (!$this->isManager()) return response()->json(['error' => 'Manager required'], Response::HTTP_FORBIDDEN);
        $valid = OreDashboardAccess::validateAppearance($request->input('appearance'));
        if ($valid === null) return response()->json(['error' => 'Invalid appearance preferences'], Response::HTTP_UNPROCESSABLE_ENTITY);
        [$contextId] = $this->identity();
        OreDashboardAccess::saveAppearance($contextId, $valid);
        return response()->json(['appearance' => OreDashboardAccess::appearance($contextId)]);
    }

    /** GET /ore-dashboard-flags/preferences: only journal managers can inspect role settings. */
    public function getPreferences(Request $request): JsonResponse
    {
        if (!$this->isManager()) {
            return response()->json(['error' => 'Journal manager permissions required'], Response::HTTP_FORBIDDEN);
        }
        $identity = $this->identity();
        return response()->json(['preferences' => OreDashboardAccess::configuration($identity[0])]);
    }

    /** PUT /ore-dashboard-flags/preferences: strict, journal-scoped permission settings. */
    public function savePreferences(Request $request): JsonResponse
    {
        if (!$this->isManager()) {
            return response()->json(['error' => 'Journal manager permissions required'], Response::HTTP_FORBIDDEN);
        }
        $valid = OreDashboardAccess::validateSettings($request->input('preferences'));
        if ($valid === null) {
            return response()->json(['error' => 'Invalid role, filter, or column preferences'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }
        $identity = $this->identity();
        OreDashboardAccess::saveConfiguration($identity[0], $valid);
        return response()->json(['preferences' => OreDashboardAccess::configuration($identity[0])]);
    }

    /**
     * Read the users who have explicit permissions, using one journal-scoped
     * lookup. Retain orphaned override IDs in the manager's list so they can
     * still be revoked after a user leaves the journal.
     *
     * @return array<int, array<string, mixed>>
     */
    private function getOverriddenUsers(int $contextId, array $overrides): array
    {
        if (!$overrides) return [];

        $ids = array_map('intval', array_keys($overrides));
        $found = [];
        $journalUsers = Repo::user()->getCollector()
            ->filterByContextIds([$contextId])
            ->filterByUserIds($ids)
            ->getMany();

        foreach ($journalUsers as $user) {
            $id = (int) $user->getId();
            if (!array_key_exists((string) $id, $overrides)) continue;
            $found[(string) $id] = [
                'id' => $id,
                'username' => (string) $user->getUsername(),
                'fullName' => (string) $user->getFullName(),
                'email' => (string) $user->getData('email'),
                'inJournal' => true,
            ];
        }

        foreach (array_keys($overrides) as $id) {
            if (isset($found[(string) $id])) continue;
            $found[(string) $id] = [
                'id' => (int) $id,
                'username' => '',
                'fullName' => 'User #' . $id,
                'email' => '',
                'inJournal' => false,
            ];
        }

        $users = array_values($found);
        usort($users, static fn (array $a, array $b): int =>
            strcasecmp($a['fullName'] ?: $a['username'], $b['fullName'] ?: $b['username'])
            ?: ($a['id'] <=> $b['id'])
        );
        return $users;
    }

    /** Search journal users, and read saved per-user permissions (manager only). */
    public function getUserPermissions(Request $request): JsonResponse
    {
        if (!$this->isManager()) return response()->json(['error' => 'Journal manager required'], 403);
        [$contextId] = $this->identity();
        $searchTerm = $request->query('q', '');
        $search = is_string($searchTerm) ? trim($searchTerm) : '';
        if (mb_strlen($search) > 60) return response()->json(['error' => 'Search too long'], 422);
        $overrides = OreDashboardAccess::userOverrides($contextId);
        $users = [];
        if (mb_strlen($search) >= 2) {
            // Use OJS's native user search to find username, email AND
            // localised given/family names, scoped to this journal only.
            $users = Repo::user()->getCollector()
                ->filterByContextIds([$contextId])
                ->searchPhrase($search)->limit(15)->getMany()
                ->map(static fn ($user) => [
                    'id' => (int) $user->getId(),
                    'username' => (string) $user->getUsername(),
                    'fullName' => (string) $user->getFullName(),
                    'email' => (string) $user->getData('email'),
                    'effective' => [
                        'filters' => OreDashboardAccess::allowed($contextId, (int) $user->getId(), 'filters'),
                        'viewColumns' => OreDashboardAccess::allowed($contextId, (int) $user->getId(), 'viewColumns'),
                        'viewFlags' => OreDashboardAccess::allowed($contextId, (int) $user->getId(), 'viewFlags'),
                        'editFlags' => OreDashboardAccess::allowed($contextId, (int) $user->getId(), 'editFlags'),
                    ],
                ])->values()->all();
        }
        return response()->json([
            'users' => $users,
            'overrides' => $overrides,
            'overriddenUsers' => $this->getOverriddenUsers($contextId, $overrides),
        ]);
    }

    /** Save or remove a complete user-specific override. Native OJS permissions remain enforced. */
    public function saveUserPermissions(Request $request): JsonResponse
    {
        if (!$this->isManager()) return response()->json(['error' => 'Journal manager required'], 403);
        [$contextId] = $this->identity();
        $userId = filter_var($request->input('userId'), FILTER_VALIDATE_INT);
        $abilities = $request->input('abilities');
        if (!$userId || $userId < 1 ||
            ($abilities !== null && !OreDashboardAccess::validateAbilities($abilities))) {
            return response()->json(['error' => 'Invalid user permissions'], 422);
        }
        // Managers must be able to revoke saved overrides for users who
        // have since left the journal, but cannot grant them new access.
        $isRevokingSavedOverride = $abilities === null &&
            array_key_exists((string) $userId, OreDashboardAccess::userOverrides($contextId));
        if (!$isRevokingSavedOverride && !OreDashboardAccess::userHasJournalRole($contextId, $userId)) {
            return response()->json(['error' => 'User does not belong to this journal'], 422);
        }
        $roles = OreDashboardAccess::roles($contextId, $userId);
        if (in_array(Role::ROLE_ID_SITE_ADMIN, $roles, true) ||
            in_array(Role::ROLE_ID_MANAGER, $roles, true)) {
            return response()->json(['error' => 'Administrator and journal manager access is fixed'], 422);
        }
        try {
            OreDashboardAccess::saveUserOverride($contextId, $userId, $abilities);
        } catch (\InvalidArgumentException $error) {
            return response()->json(['error' => $error->getMessage()], 422);
        }
        $overrides = OreDashboardAccess::userOverrides($contextId);
        return response()->json([
            'overrides' => $overrides,
            'overriddenUsers' => $this->getOverriddenUsers($contextId, $overrides),
        ]);
    }

}
