<?php
/**
 * ORE Dashboard Filters: native OJS Installed Plugins > Settings modal.
 * Copyright (c) 2026 Anthony Finnerty.
 * GPL-3.0-only; see the plugin LICENSE.
 */
namespace APP\plugins\generic\oreDashboardFilters;

use APP\core\Application;
use Illuminate\Support\Facades\DB;
use PKP\core\JSONMessage;
use PKP\security\Role;

class OreDashboardFlagSettingsModal
{
    /**
     * Confirm the authenticated user manages THIS journal, or is a site admin.
     * A UI link is not an authorisation boundary: enforce it for direct manage requests.
     */
    public static function isSiteAdministrator(?int $userId): bool
    {
        if (!$userId) {
            return false;
        }
        return DB::table('user_user_groups as uug')
            ->join('user_groups as ug', 'ug.user_group_id', '=', 'uug.user_group_id')
            ->where('uug.user_id', $userId)
            ->where('ug.role_id', Role::ROLE_ID_SITE_ADMIN)
            ->exists();
    }

    public static function isManagerForContext(?int $contextId, ?int $userId): bool
    {
        if (!$contextId || !$userId) {
            return false;
        }
        if (self::isSiteAdministrator($userId)) {
            return true;
        }

        return DB::table('user_user_groups as uug')
            ->join('user_groups as ug', 'ug.user_group_id', '=', 'uug.user_group_id')
            ->where('uug.user_id', $userId)
            ->whereIn('ug.role_id', [Role::ROLE_ID_SITE_ADMIN, Role::ROLE_ID_MANAGER])
            ->where(function ($query) use ($contextId) {
                $query->where('ug.context_id', $contextId)
                    ->orWhere('ug.role_id', Role::ROLE_ID_SITE_ADMIN);
            })
            ->exists();
    }

    public static function render($request, OreDashboardFiltersPlugin $plugin): JSONMessage
    {
        $context = $request->getContext();
        $user = $request->getUser();
        $contextId = $context ? (int) $context->getId() : null;
        $userId = $user ? (int) $user->getId() : null;
        $isSiteAdmin = self::isSiteAdministrator($userId);
        if (!$isSiteAdmin && !self::isManagerForContext($contextId, $userId)) {
            return new JSONMessage(false, 'Journal manager permissions required.');
        }

        // On an already-installed OJS instance, copying a generic plugin does
        // not execute system-install migrations. The authorised settings action
        // safely creates missing flag tables without altering existing data.
        try {
            require_once __DIR__ . '/OreDashboardFlagSchema.php';
            (new OreDashboardFlagSchema())->up();
        } catch (\Throwable $error) {
            error_log('[ORE Dashboard Filters] Flag schema installation failed: ' . $error->getMessage());
            return new JSONMessage(false, 'Unable to initialise flag tables. Ask the QA database administrator to check table-creation permissions and the OJS error log.');
        }

        // Journal managers configure only the active journal. On the global
        // Site Administration plugin page, site administrators choose a journal.
        $targets = [];
        if ($context) {
            $targets[] = ['path' => $context->getPath(), 'label' => $context->getPath()];
        } elseif ($isSiteAdmin) {
            foreach (DB::table('journals')->orderBy('journal_id')->get(['journal_id', 'path']) as $journal) {
                if (is_string($journal->path) && $journal->path !== '') {
                    $targets[] = ['path' => $journal->path, 'label' => $journal->path];
                }
            }
        }
        if (!$targets) {
            return new JSONMessage(false, 'Choose a journal before configuring its flags.');
        }
        foreach ($targets as &$target) {
            $target['api'] = $request->getDispatcher()->url(
                $request,
                Application::ROUTE_API,
                $target['path'],
                'ore-dashboard-flags'
            );
        }
        unset($target);
        $safeUrl = htmlspecialchars($targets[0]['api'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $selector = '';
        if (count($targets) > 1) {
            $options = '';
            foreach ($targets as $target) {
                $safeValue = htmlspecialchars($target['api'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                $safeLabel = htmlspecialchars($target['label'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                $options .= "<option value=\"{$safeValue}\">{$safeLabel}</option>";
            }
            $selector = "<label class=\"ore-settings-journal-label\">Journal <select data-ore-journal>{$options}</select></label>";
        }

        // The Installed Plugins grid may be fetched asynchronously, after the
        // parent page has finished rendering. In this case, addJavaScript()
        // during the plugin's registration cannot put an asset on that already
        // rendered page. The OJS 3.6 LegacyAjax modal uses jQuery .html() to
        // insert this server response; a script tag inside the response loads
        // the editor reliably even when the grid was loaded asynchronously.
        $scriptUrl = htmlspecialchars(
            $plugin->assetUrl($request, 'ore-settings.js'),
            ENT_QUOTES | ENT_SUBSTITUTE,
            'UTF-8'
        );
        $fallbackRows = '';
        $fallbackContextId = $contextId;
        if ($fallbackContextId === null && count($targets) === 1) {
            $fallbackJournalPath = $targets[0]['path'];
            $fallbackContextId = DB::table('journals')
                ->where('path', $fallbackJournalPath)
                ->value('journal_id');
        }
        if ($fallbackContextId !== null) {
            $fallbackFlags = DB::table('ore_dashboard_flag_definitions')
                ->where('context_id', (int) $fallbackContextId)
                ->orderBy('sort_order')
                ->get(['label', 'color']);
            foreach ($fallbackFlags as $flag) {
                $label = htmlspecialchars((string) $flag->label, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                $colour = preg_match('/^#[0-9a-fA-F]{6}$/', (string) $flag->color)
                    ? $flag->color : '#64748b';
                $fallbackRows .= '<li><span style="display:inline-block;vertical-align:middle;'
                    . 'width:0.8em;height:0.8em;margin-right:0.4em;background:'
                    . $colour . ';border-radius:3px"></span>' . $label . '</li>';
            }
        }
        $fallback = '<div data-ore-fallback><p><strong>Current flag definitions (read-only)</strong></p>'
            . ($fallbackRows ? '<ul>' . $fallbackRows . '</ul>' : '<p>No saved definitions for this journal.</p>')
            . '<p>The editor should initialise automatically. If it does not, reload the plugin page.</p></div>';

        $content = <<<HTML
<div class="ore-dashboard-settings" data-ore-dashboard-settings="1" data-api-url="{$safeUrl}">
    <p class="ore-settings-intro">Configure flag names, short labels, icons, colours and ordering. Appearance and role access are configured below.</p>
    {$selector}
    <p class="ore-settings-notice" data-ore-status role="status" aria-live="polite">Loading the flag editor…</p>
    <div data-ore-rows>{$fallback}</div>
    <div class="ore-settings-footer">
        <button class="pkpButton" type="button" data-ore-action="add">Add flag</button>
        <button class="pkpButton pkpButton--primary" type="button" data-ore-action="save">Save flags</button>
    </div>
    <p class="ore-settings-footnote">These flags are shared by journal editors. A flag currently assigned to submissions cannot be removed until those assignments have been cleared.</p>
    <section class="ore-settings-permissions" aria-label="Role permissions and dashboard options">
        <h2>Roles and dashboard options</h2>
        <p class="ore-settings-notice" data-ore-preferences-status role="status" aria-live="polite">Loading role permissions and dashboard options…</p>
        <div data-ore-preferences></div>
    </section>
</div>
<script src="{$scriptUrl}"></script>
HTML;

        return new JSONMessage(true, $content);
    }
}
