<?php
/**
 * @file OreDashboardFlagSchema.php
 * Flag table installation for OJS 3.6.
 * Copyright (c) 2026 Anthony Finnerty.
 * Licensed under GPL-3.0-only; see LICENSE.
 */
namespace APP\plugins\generic\oreDashboardFilters;

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Idempotent installation for fresh and already-enabled OJS instances.
 * Never modifies or drops an existing table or its assignments.
 */
class OreDashboardFlagSchema extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('ore_dashboard_flag_definitions')) {
            Schema::create('ore_dashboard_flag_definitions', static function (Blueprint $table): void {
                $table->unsignedBigInteger('context_id');
                $table->string('flag_key', 20);
                $table->string('label', 80);
                $table->string('color', 7);
                $table->unsignedInteger('sort_order')->default(0);
                $table->timestamp('updated_at')->nullable();
                $table->primary(['context_id', 'flag_key'], 'ore_flag_definitions_pk');
            });
        }

        if (!Schema::hasTable('ore_dashboard_flags')) {
            Schema::create('ore_dashboard_flags', static function (Blueprint $table): void {
                $table->unsignedBigInteger('submission_id')->primary();
                $table->unsignedBigInteger('context_id');
                $table->string('flag', 20);
                $table->unsignedBigInteger('updated_by')->nullable();
                $table->timestamp('updated_at')->nullable();
                $table->index(['context_id', 'flag'], 'ore_flags_context_flag_idx');
            });
        }
    }

    /** Flag assignments are editorial data. Disabling or upgrading the plugin must not erase them. */
    public function down(): void
    {
    }
}
