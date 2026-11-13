<?php

/**
 * @file plugins/generic/oreDashboardFilters/OreDashboardFiltersPlugin.php
 *
 * Copyright (c) 2026 Anthony Finnerty
 * Distributed under the GNU GPL v3. For full terms see the file LICENSE.
 *
 * @class OreDashboardFiltersPlugin
 *
 * @brief Adds ORE-specific filters to the OJS 3.6 editorial dashboard.
 */

namespace APP\plugins\generic\oreDashboardFilters;

use APP\core\Application;
use APP\facades\Repo;
use APP\template\TemplateManager;
use DateInterval;
use DateTimeImmutable;
use Exception;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\LazyCollection;
use PKP\components\forms\FieldAutosuggestPreset;
use PKP\components\forms\FieldOptions;
use PKP\context\Context;
use PKP\core\PKPPageRouter;
use PKP\plugins\GenericPlugin;
use PKP\plugins\Hook;

class OreDashboardFiltersPlugin extends GenericPlugin
{
    /**
     * @copydoc Plugin::register()
     *
     * @param null|mixed $mainContextId
     */
    public function register($category, $path, $mainContextId = null)
    {
        $success = parent::register($category, $path, $mainContextId);
        require_once __DIR__ . '/OreDashboardAccess.php';
        // Native OJS Installed Plugins > Settings modal browser asset.
        // Never bootstrap template JS during CLI installation or upgrades.
        if ($success && PHP_SAPI !== 'cli') {
            $nativeSettingsRequest = Application::get()->getRequest();
            $nativeSettingsRouter = $nativeSettingsRequest->getRouter();
            if ($nativeSettingsRouter instanceof PKPPageRouter &&
                in_array($nativeSettingsRouter->getRequestedPage($nativeSettingsRequest), ['admin', 'management'], true)) {
                $nativeSettingsTemplateManager = TemplateManager::getManager($nativeSettingsRequest);
                $nativeSettingsTemplateManager->addJavaScript(
                    'OreDashboardFiltersNativeSettings',
                    "{$nativeSettingsRequest->getBaseUrl()}/{$this->getPluginPath()}/public/build/ore-settings.js?v=0.3.8.0",
                    [
                        'inline' => false,
                        'contexts' => ['backend'],
                        'priority' => TemplateManager::STYLE_SEQUENCE_LAST,
                    ]
                );
            }
        }

        if (!$success || !$this->getEnabled($mainContextId)) {
            return $success;
        }

        // Add backend filtering without changing OJS core. The core submission
        // collector exposes this hook after its standard query has been built.
        Hook::add('Submission::Collector', $this->filterSubmissionCollector(...));

        require_once __DIR__ . "/OreDashboardFlagsController.php";
        require_once __DIR__ . "/OreDashboardFiltersExtensions.php";
        OreDashboardFiltersExtensions::register($this);

        $request = Application::get()->getRequest();
            /* ORE SETTINGS UI v6 BEGIN */
            $oreSettingsUiManager = \APP\template\TemplateManager::getManager($request);
            $oreSettingsUiManager->addJavaScript(
                'OreDashboardFiltersSettingsRefined',
                "{$request->getBaseUrl()}/{$this->getPluginPath()}/public/build/ore-settings-refined.js?v=0.3.8-settings6",
                [
                    'inline' => false,
                    'contexts' => ['backend'],
                    'priority' => \APP\template\TemplateManager::STYLE_SEQUENCE_LAST,
                ]
            );
            /* ORE SETTINGS UI v6 END */
        $router = $request->getRouter();

        // Load only on dashboard pages. The JavaScript also checks that the
        // active Pinia store is the editorial dashboard before adding fields.
        if ($router instanceof PKPPageRouter && $router->getRequestedPage($request) === 'dashboard' && OreDashboardAccess::allowsCurrentUser('filters')) {
            $templateMgr = TemplateManager::getManager($request);
            $nativeFilterConfig = json_encode(
                [
                    'nativeFilterFields' => $this->getNativeFilterFields(
                        $request->getContext()
                    ),
                ],
                JSON_HEX_TAG
                    | JSON_HEX_AMP
                    | JSON_HEX_APOS
                    | JSON_HEX_QUOT
                    | JSON_UNESCAPED_UNICODE
                    | JSON_UNESCAPED_SLASHES
            );

            if ($nativeFilterConfig !== false) {
                $templateMgr->addJavaScript(
                    'OreDashboardFiltersConfig',
                    "window.oreDashboardFiltersConfig = {$nativeFilterConfig};",
                    [
                        'inline' => true,
                        'contexts' => ['backend'],
                        'priority' => TemplateManager::STYLE_SEQUENCE_LATE,
                    ]
                );
            }

            $pluginVersion = $this->getCurrentVersion();
            $assetVersion = $pluginVersion
                ? $pluginVersion->getVersionString()
                : '0.3.8.0';

            $templateMgr->addJavaScript(
                'OreDashboardFilters',
                "{$request->getBaseUrl()}/{$this->getPluginPath()}/public/build/build.iife.js"
                    . '?v=' . rawurlencode($assetVersion),
                [
                    'inline' => false,
                    'contexts' => ['backend'],
                    'priority' => TemplateManager::STYLE_SEQUENCE_LAST,
                ]
            );
        }

        return $success;
    }

    /**
     * Native Settings action in OJS's Installed Plugins listing.
     * Only journal managers / site administrators may configure definitions.
     */
    public function getActions($request, $actionArgs)
    {
        $actions = parent::getActions($request, $actionArgs);
        $context = $request->getContext();
        $user = $request->getUser();
        if (!$user) {
            return $actions;
        }
        require_once __DIR__ . '/OreDashboardFlagSettingsModal.php';
        if ($context) {
            if (!$this->getEnabled() || !OreDashboardFlagSettingsModal::isManagerForContext(
                (int) $context->getId(), (int) $user->getId()
            )) {
                return $actions;
            }
        } elseif (!OreDashboardFlagSettingsModal::isSiteAdministrator((int) $user->getId())) {
            return $actions;
        }
        $url = $request->getRouter()->url(
            $request, null, null, 'manage', null,
            ['verb' => 'settings', 'plugin' => $this->getName(), 'category' => 'generic']
        );
        array_unshift($actions, new \PKP\linkAction\LinkAction(
            'settings',
            new \PKP\linkAction\request\AjaxModal($url, $this->getDisplayName()),
            __('manager.plugins.settings')
        ));
        return $actions;
    }

    /** Serve flag settings inside the standard OJS plugin-settings modal. */
    public function manage($args, $request)
    {
        if ($request->getUserVar('verb') !== 'settings') {
            return parent::manage($args, $request);
        }
        require_once __DIR__ . '/OreDashboardFlagSettingsModal.php';
        return OreDashboardFlagSettingsModal::render($request);
    }

    /** @copydoc Plugin::getDisplayName() */
    public function getDisplayName()
    {
        return __('plugins.generic.oreDashboardFilters.displayName');
    }

    /** @copydoc Plugin::getDescription() */
    public function getDescription()
    {
        return __('plugins.generic.oreDashboardFilters.description');
    }

    /**
     * Build exact OJS form configurations for Section and Categories.
     *
     * Core OJS omits Section when the journal has exactly one section and
     * omits Categories when none have been configured. ORE requires both
     * controls to remain explicit, so the frontend receives the journal's
     * current options and only inserts a field when core did not provide it.
     *
     * @return array<int, array<string, mixed>>
     */
    private function getNativeFilterFields(?Context $context): array
    {
        if (!$context) {
            return [];
        }

        $sections = Repo::section()
            ->getCollector()
            ->filterByContextIds([$context->getId()])
            ->getMany();

        $categories = Repo::category()
            ->getCollector()
            ->filterByContextIds([$context->getId()])
            ->getMany();

        return [
            $this->getSectionFilterConfig($sections),
            $this->getCategoryFilterConfig($categories),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function getSectionFilterConfig(LazyCollection $sections): array
    {
        $options = $sections
            ->map(fn ($section) => [
                'value' => $section->getId(),
                'label' => $section->getLocalizedTitle(),
            ])
            ->values()
            ->all();

        $description = '';
        if (!$options) {
            $description = __(
                'plugins.generic.oreDashboardFilters.noSectionsConfigured'
            );
            $options = [
                [
                    'value' => '__ore_no_sections__',
                    'label' => $description,
                    'disabled' => true,
                ],
            ];
        }

        return (new FieldOptions('sectionIds', [
            'groupId' => 'default',
            'label' => __('section.section'),
            'description' => $description,
            'options' => $options,
            'value' => [],
        ]))->getConfig();
    }

    /**
     * @return array<string, mixed>
     */
    private function getCategoryFilterConfig(LazyCollection $categories): array
    {
        if (!$categories->count()) {
            $description = __(
                'plugins.generic.oreDashboardFilters.noCategoriesConfigured'
            );

            return (new FieldOptions('categoryIds', [
                'groupId' => 'default',
                'label' => __('category.category'),
                'description' => $description,
                'options' => [
                    [
                        'value' => '__ore_no_categories__',
                        'label' => $description,
                        'disabled' => true,
                    ],
                ],
                'value' => [],
            ]))->getConfig();
        }

        $options = Repo::category()
            ->getBreadcrumbs($categories)
            ->map(fn ($breadcrumb, $id) => [
                'value' => $id,
                'label' => $breadcrumb,
            ])
            ->values()
            ->all();

        $hasAllBreadcrumbs = $categories->count() === count($options);
        $vocabulary = Repo::category()
            ->getCategoryVocabularyStructure($categories);

        return (new FieldAutosuggestPreset('categoryIds', [
            'groupId' => 'default',
            'label' => __('category.category'),
            'description' => $hasAllBreadcrumbs
                ? ''
                : __('submission.categories.circularReferenceWarning'),
            'options' => $options,
            'value' => [],
            'vocabularies' => [
                [
                    'addButtonLabel' => __('manager.selectCategories'),
                    'modalTitleLabel' => __('manager.selectCategories'),
                    'items' => $vocabulary,
                ],
            ],
        ]))->getConfig();
    }

    /**
     * Apply the plugin-specific dashboard query parameters to the submission query.
     *
     * The native stageIds filter is already supported by OJS. This hook adds:
     *
     * - oreVersionStage: AO | PMUR | VoR
     * - oreSubmissionDate: today | yesterday | custom
     * - oreDateFrom: YYYY-MM-DD (used with custom)
     * - oreDateTo: YYYY-MM-DD (used with custom)
     *
     * @param string $hookName
     * @param array{0: Builder, 1?: mixed} $args The query and active collector.
     */
    public function filterSubmissionCollector(string $hookName, array $args): bool
    {
        // Submission::Collector currently invokes the legacy Hook::call API,
        // so the query builder and collector arrive inside one arguments array.
        // The query itself is stored by reference in args[0].
        $query =& $args[0]; /** @var Builder $query */
        if (!$query instanceof Builder) {
            return Hook::CONTINUE;
        }

        $request = Application::get()->getRequest();
        if (!OreDashboardAccess::allowsCurrentUser('filters')) {
            return Hook::CONTINUE;
        }
        $oreContext = $request->getContext();
        if (!$oreContext) {
            return Hook::CONTINUE;
        }
        $oreContextId = (int) $oreContext->getId();

        $versionStage = $this->normaliseScalar($request->getUserVar('oreVersionStage'));
        if (OreDashboardAccess::feature($oreContextId, 'oreVersionStage') && in_array($versionStage, ['AO', 'PMUR', 'VoR'], true)) {
            $this->applyVersionStageFilter($query, $versionStage);
        }

        $dateMode = $this->normaliseScalar($request->getUserVar('oreSubmissionDate'));
        $dateFrom = $this->normaliseScalar($request->getUserVar('oreDateFrom'));
        $dateTo = $this->normaliseScalar($request->getUserVar('oreDateTo'));
        if (OreDashboardAccess::feature($oreContextId, 'oreSubmissionDate')) {
            $this->applySubmissionDateFilter($query, $dateMode, $dateFrom, $dateTo);
        }

        return Hook::CONTINUE;
    }

    /**
     * Filter by the publication lifecycle that is operationally relevant to ORE.
     *
     * OJS 3.6 maintains submissions.current_publication_id as the most mature
     * published publication, or the most mature unpublished publication when
     * none has been published. The submission collector already joins that
     * publication as "po", so filtering the existing join gives ORE the latest
     * operational lifecycle without a version subquery.
     */
    private function applyVersionStageFilter(Builder $query, string $versionStage): void
    {
        $query->where('po.version_stage', $versionStage);
    }

    /**
     * Apply today, yesterday or inclusive custom date-range filtering.
     *
     * OJS stores date_submitted as a timestamp. The prototype uses the PHP/OJS
     * server timezone. Runtime UAT should confirm this against the target installation's configured
     * timezone and imported historical records.
     */
    private function applySubmissionDateFilter(
        Builder $query,
        ?string $dateMode,
        ?string $dateFrom,
        ?string $dateTo
    ): void {
        try {
            if ($dateMode === 'today') {
                $start = new DateTimeImmutable('today');
                $end = $start->add(new DateInterval('P1D'));
                $this->applyHalfOpenDateRange($query, $start, $end);
                return;
            }

            if ($dateMode === 'yesterday') {
                $end = new DateTimeImmutable('today');
                $start = $end->sub(new DateInterval('P1D'));
                $this->applyHalfOpenDateRange($query, $start, $end);
                return;
            }

            if ($dateMode !== 'custom') {
                return;
            }

            $start = $this->parseDate($dateFrom);
            $inclusiveEnd = $this->parseDate($dateTo);

            if ($start) {
                $query->where('s.date_submitted', '>=', $start->format('Y-m-d 00:00:00'));
            }

            if ($inclusiveEnd) {
                $exclusiveEnd = $inclusiveEnd->add(new DateInterval('P1D'));
                $query->where('s.date_submitted', '<', $exclusiveEnd->format('Y-m-d 00:00:00'));
            }
        } catch (Exception $exception) {
            // Invalid date input must never break the dashboard. Ignore the
            // malformed plugin-specific filter and allow the core query to run.
        }
    }

    private function applyHalfOpenDateRange(
        Builder $query,
        DateTimeImmutable $start,
        DateTimeImmutable $end
    ): void {
        $query
            ->where('s.date_submitted', '>=', $start->format('Y-m-d H:i:s'))
            ->where('s.date_submitted', '<', $end->format('Y-m-d H:i:s'));
    }

    private function parseDate(?string $value): ?DateTimeImmutable
    {
        if (!$value || !preg_match('/^\\d{4}-\\d{2}-\\d{2}$/', $value)) {
            return null;
        }

        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
        $errors = DateTimeImmutable::getLastErrors();

        if (!$date || (is_array($errors) && ($errors['warning_count'] || $errors['error_count']))) {
            return null;
        }

        return $date;
    }

    private function normaliseScalar($value): ?string
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
