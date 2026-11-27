(function () {
    'use strict';

    if (
        typeof pkp === 'undefined' ||
        !pkp.registry ||
        typeof pkp.registry.storeExtend !== 'function'
    ) {
        return;
    }

    // Bundled with the dashboard; the filters need the filter permission.
    if (window.oreDashboardFiltersV3Config?.access?.filters !== true) {
        return;
    }

    const OPTION_FILTER_NAMES = [
        'oreVersionStage',
        'stageIds',
        'oreSubmissionDate',
    ];
    const DATE_FILTER_NAMES = ['oreDateFrom', 'oreDateTo'];
    const PLUGIN_FILTER_NAMES = [
        ...OPTION_FILTER_NAMES,
        ...DATE_FILTER_NAMES,
    ];
    const NATIVE_FILTER_NAMES = ['sectionIds', 'categoryIds'];
    const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

    function makeOptionsField({name, label, options}) {
        return {
            name,
            component: 'field-options',
            label,
            groupId: 'default',
            isRequired: false,
            isMultilingual: false,
            isInert: false,
            // OJS 3.6's active-filter calculation iterates every scalar value,
            // including an empty string. An empty array represents no filter
            // without creating an unwanted "All..." chip.
            value: [],
            selected: [],
            type: 'radio',
            isOrderable: false,
            allowOnlySorting: false,
            options: [
                // Vue's radio binding compares array values structurally, so
                // this option remains visibly selected while the inactive
                // value stays an empty array.
                {value: [], label: options.allLabel},
                ...options.values,
            ],
        };
    }

    function makeDateField({name, label}) {
        return {
            name,
            component: 'field-date',
            label,
            groupId: 'default',
            isRequired: false,
            isMultilingual: false,
            isInert: false,
            value: [],
            selected: [],
            showWhen: ['oreSubmissionDate', 'custom'],
        };
    }

    function getField(store, name) {
        return store.filtersForm?.fields?.find((field) => field.name === name);
    }

    function getInjectedNativeFields() {
        if (
            typeof window === 'undefined' ||
            !Array.isArray(
                window.oreDashboardFiltersConfig?.nativeFilterFields,
            )
        ) {
            return [];
        }

        return window.oreDashboardFiltersConfig.nativeFilterFields
            .filter(
                (field) =>
                    field &&
                    typeof field === 'object' &&
                    NATIVE_FILTER_NAMES.includes(field.name),
            )
            .map((field) => JSON.parse(JSON.stringify(field)));
    }

    function insertMissingNativeFields(currentFields, configuredFields) {
        const fields = [...currentFields];
        const configuredByName = new Map(
            configuredFields.map((field) => [field.name, field]),
        );

        const sectionField = configuredByName.get('sectionIds');
        if (
            sectionField &&
            !fields.some((field) => field.name === 'sectionIds')
        ) {
            const beforeIndex = fields.findIndex((field) =>
                [
                    'assignedTo',
                    'issueIds',
                    'categoryIds',
                    'daysInactive',
                ].includes(field.name),
            );
            fields.splice(beforeIndex === -1 ? 0 : beforeIndex, 0, sectionField);
        }

        const categoryField = configuredByName.get('categoryIds');
        if (
            categoryField &&
            !fields.some((field) => field.name === 'categoryIds')
        ) {
            const beforeIndex = fields.findIndex(
                (field) => field.name === 'daysInactive',
            );
            fields.splice(
                beforeIndex === -1 ? fields.length : beforeIndex,
                0,
                categoryField,
            );
        }

        return fields;
    }

    function valuesMatch(left, right) {
        return JSON.stringify(left) === JSON.stringify(right);
    }

    function setEmptyState(field) {
        if (!Array.isArray(field.value) || field.value.length) {
            field.value = [];
        }
        if (!Array.isArray(field.selected) || field.selected.length) {
            field.selected = [];
        }
    }

    function setSelectedState(field, value, label) {
        if (!valuesMatch(field.value, value)) {
            field.value = value;
        }

        const selected = [{value, label}];
        if (!valuesMatch(field.selected, selected)) {
            field.selected = selected;
        }
    }

    function firstScalar(value) {
        if (Array.isArray(value)) {
            value = value.find(
                (candidate) =>
                    candidate !== '' &&
                    candidate !== null &&
                    typeof candidate !== 'undefined',
            );
        }

        if (
            value === '' ||
            value === null ||
            typeof value === 'undefined' ||
            (typeof value !== 'string' &&
                typeof value !== 'number' &&
                typeof value !== 'boolean')
        ) {
            return null;
        }

        return value;
    }

    function isValidIsoDate(value) {
        if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value)) {
            return false;
        }

        const [year, month, day] = value.split('-').map(Number);
        if (year < 1 || month < 1 || month > 12 || day < 1) {
            return false;
        }

        const lastDayOfMonth = new Date(
            Date.UTC(year, month, 0),
        ).getUTCDate();
        return day <= lastDayOfMonth;
    }

    function normaliseOptionsField(field) {
        if (!field) {
            return null;
        }

        const rawValue = firstScalar(field.value);
        if (rawValue === null) {
            setEmptyState(field);
            return null;
        }

        const option = field.options.find(
            (candidate) =>
                !Array.isArray(candidate.value) &&
                String(candidate.value) === String(rawValue),
        );

        if (!option) {
            setEmptyState(field);
            return null;
        }

        setSelectedState(field, option.value, option.label);
        return option.value;
    }

    function normaliseDateField(field) {
        if (!field) {
            return;
        }

        const value = firstScalar(field.value);
        if (!isValidIsoDate(value)) {
            setEmptyState(field);
            return;
        }

        setSelectedState(field, value, value);
    }

    function normaliseFilterState(store) {
        OPTION_FILTER_NAMES.forEach((name) => {
            normaliseOptionsField(getField(store, name));
        });

        const dateMode = firstScalar(
            getField(store, 'oreSubmissionDate')?.value,
        );

        DATE_FILTER_NAMES.forEach((name) => {
            const field = getField(store, name);
            if (dateMode === 'custom') {
                normaliseDateField(field);
            } else if (field) {
                // Hidden dates must never continue filtering after Today,
                // Yesterday or All submission dates is selected.
                setEmptyState(field);
            }
        });
    }

    function readInitialUrlValues(fields) {
        if (
            typeof window === 'undefined' ||
            typeof window.URLSearchParams !== 'function'
        ) {
            return;
        }

        const query = new window.URLSearchParams(window.location.search);
        const fieldsByName = new Map(fields.map((field) => [field.name, field]));

        OPTION_FILTER_NAMES.forEach((name) => {
            const field = fieldsByName.get(name);
            const value = query.get(name);
            if (!field || value === null || value === '') {
                return;
            }

            const option = field.options.find(
                (candidate) =>
                    !Array.isArray(candidate.value) &&
                    String(candidate.value) === value,
            );

            if (option) {
                setSelectedState(field, option.value, option.label);
            }
        });

        if (
            firstScalar(fieldsByName.get('oreSubmissionDate')?.value) !==
            'custom'
        ) {
            return;
        }

        DATE_FILTER_NAMES.forEach((name) => {
            const field = fieldsByName.get(name);
            const value = query.get(name);
            if (field && isValidIsoDate(value)) {
                setSelectedState(field, value, value);
            }
        });
    }

    function getAllQueryValues(query, name) {
        return [
            ...query.getAll(name),
            ...query.getAll(`${name}[]`),
        ].filter((value) => value !== '');
    }

    function readInitialNativeUrlValues(fields) {
        if (
            typeof window === 'undefined' ||
            typeof window.URLSearchParams !== 'function'
        ) {
            return;
        }

        const query = new window.URLSearchParams(window.location.search);

        fields.forEach((field) => {
            const queryValues = getAllQueryValues(query, field.name);
            if (!queryValues.length || !Array.isArray(field.options)) {
                return;
            }

            const matchedOptions = [];
            queryValues.forEach((queryValue) => {
                const option = field.options.find(
                    (candidate) =>
                        !candidate.disabled &&
                        String(candidate.value) === queryValue,
                );

                if (
                    option &&
                    !matchedOptions.some(
                        (candidate) =>
                            String(candidate.value) === String(option.value),
                    )
                ) {
                    matchedOptions.push(option);
                }
            });

            if (!matchedOptions.length) {
                return;
            }

            field.value = matchedOptions.map((option) => option.value);
            if (Array.isArray(field.selected)) {
                field.selected = matchedOptions.map((option) => ({
                    value: option.value,
                    label: option.label,
                }));
            }
        });
    }

    pkp.registry.storeExtend('dashboard', ({store}) => {
        if (store.dashboardPage !== 'editorialDashboard') {
            return;
        }

        const currentForm = store.filtersForm;
        const watch = pkp.modules?.vue?.watch;

        if (
            !currentForm ||
            !Array.isArray(currentForm.fields) ||
            typeof store.updateFiltersForm !== 'function' ||
            typeof watch !== 'function'
        ) {
            return;
        }

        // Avoid duplicate fields if the store is recreated or another extension
        // invokes the plugin callback more than once.
        if (currentForm.fields.some((field) => field.name === 'oreVersionStage')) {
            return;
        }

        const stage = pkp.const || {};
        const configuredNativeFields = getInjectedNativeFields();
        const missingNativeFields = configuredNativeFields.filter(
            (configuredField) =>
                !currentForm.fields.some(
                    (currentField) =>
                        currentField.name === configuredField.name,
                ),
        );
        const addedFields = [
            makeOptionsField({
                name: 'oreVersionStage',
                label: 'Publication lifecycle',
                options: {
                    allLabel: 'All publication lifecycles',
                    values: [
                        {value: 'AO', label: 'Author Original (AO)'},
                        {
                            value: 'PMUR',
                            label: 'Published Manuscript Under Review (PMUR)',
                        },
                        {value: 'VoR', label: 'Version of Record (VoR)'},
                    ],
                },
            }),
            makeOptionsField({
                name: 'stageIds',
                label: 'Workflow stage',
                options: {
                    allLabel: 'All workflow stages',
                    values: [
                        {
                            value: stage.WORKFLOW_STAGE_ID_SUBMISSION ?? 1,
                            label: 'Submission',
                        },
                        {
                            value: stage.WORKFLOW_STAGE_ID_EDITING ?? 4,
                            label: 'Copyediting',
                        },
                        {
                            value:
                                stage.WORKFLOW_STAGE_ID_EXTERNAL_REVIEW ?? 3,
                            label: 'Peer review',
                        },
                        {
                            value: stage.WORKFLOW_STAGE_ID_PRODUCTION ?? 5,
                            label: 'Production',
                        },
                    ],
                },
            }),
            makeOptionsField({
                name: 'oreSubmissionDate',
                label: 'Submission date',
                options: {
                    allLabel: 'All submission dates',
                    values: [
                        {value: 'today', label: 'Today'},
                        {value: 'yesterday', label: 'Yesterday'},
                        {value: 'custom', label: 'Custom range'},
                    ],
                },
            }),
            makeDateField({name: 'oreDateFrom', label: 'From'}),
            makeDateField({name: 'oreDateTo', label: 'To'}),
        ];

        // The core URL initialiser has already run before store extensions are
        // invoked, so restore injected native and plugin values explicitly
        // before adding the fields.
        readInitialNativeUrlValues(missingNativeFields);
        readInitialUrlValues(addedFields);

        const nativeFields = insertMissingNativeFields(
            currentForm.fields,
            missingNativeFields,
        );

        store.updateFiltersForm({
            ...currentForm,
            fields: [...nativeFields, ...addedFields],
        });

        // The filter modal deep-clones and then replaces the complete form.
        // Resolve fields dynamically so this watcher follows every replacement.
        watch(
            () =>
                PLUGIN_FILTER_NAMES.map((name) => {
                    const field = getField(store, name);
                    return [field?.value, field?.selected];
                }),
            () => {
                normaliseFilterState(store);
            },
            {
                deep: true,
                immediate: true,
                // Normalise before OJS's active-chip and URL watchers evaluate
                // an intermediate empty-string or stale selected-label state.
                flush: 'sync',
            },
        );
    });
})();
